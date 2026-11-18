"""
API Router for REGRAVA AI Assistant.
Provides endpoints for conversational messaging, SSE streaming, conversation management,
provider status checks, and repository/PR context resolution.
"""

import json
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from app.config import settings
from app.db.session_db import db
from app.services.assistant_service import assistant_service
from app.services.assistant_tools import AssistantTools
from app.services.auth_service import get_current_user
from app.services.github_service import github_service
from app.services.llm_provider import get_llm_provider

router = APIRouter(prefix="/assistant", tags=["AI Assistant"])


# --- Pydantic Schemas ---

class ProviderConfigRequest(BaseModel):
    provider: str = Field(..., description="LLM provider name: 'gemini', 'openai', or 'anthropic'")
    api_key: Optional[str] = Field(None, description="API key for the selected provider")
    model: Optional[str] = Field(None, description="Model identifier to use")


class CreateConversationRequest(BaseModel):
    title: Optional[str] = "New Conversation"
    selected_repo: Optional[str] = None
    selected_pr_number: Optional[int] = None
    selected_finding_id: Optional[str] = None


class UpdateConversationRequest(BaseModel):
    title: Optional[str] = None
    selected_repo: Optional[str] = None
    selected_pr_number: Optional[int] = None
    selected_finding_id: Optional[str] = None


class ChatMessageRequest(BaseModel):
    conversation_id: str
    message: str
    selected_repo: Optional[str] = None
    selected_pr_number: Optional[int] = None
    selected_finding_id: Optional[str] = None


class RegenerateRequest(BaseModel):
    message_id: Optional[str] = None
    selected_repo: Optional[str] = None
    selected_pr_number: Optional[int] = None
    selected_finding_id: Optional[str] = None


# --- Provider Endpoints ---

@router.get("/providers/status")
def get_provider_status():
    """Return the currently configured LLM provider and readiness status."""
    provider = get_llm_provider()
    status_info = provider.validate_provider()
    status_info["configured_provider"] = settings.get_llm_provider()
    return status_info


@router.post("/providers/config")
def set_provider_config(
    body: ProviderConfigRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Dynamically save LLM provider and API key in backend app_config."""
    prov = body.provider.strip().lower()
    if prov not in ("gemini", "openai", "anthropic"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supported providers are 'gemini', 'openai', and 'anthropic'.",
        )

    db.set_config("LLM_PROVIDER", prov)
    if body.model:
        db.set_config("LLM_MODEL", body.model.strip())

    if body.api_key:
        clean_key = body.api_key.strip()
        if prov == "gemini":
            db.set_config("GEMINI_API_KEY", clean_key)
        elif prov == "openai":
            db.set_config("OPENAI_API_KEY", clean_key)
        elif prov == "anthropic":
            db.set_config("ANTHROPIC_API_KEY", clean_key)

    provider = get_llm_provider(prov)
    return provider.validate_provider()


# --- Conversation Management Endpoints ---

@router.get("/conversations")
def list_conversations(
    q: Optional[str] = Query(None, description="Search term for conversation titles"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List conversations belonging to the authenticated user."""
    return db.list_conversations(current_user["id"], search_query=q)


@router.post("/conversations")
def create_conversation(
    body: CreateConversationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Create a new conversational thread."""
    return db.create_conversation(
        user_id=current_user["id"],
        title=body.title or "New Conversation",
        selected_repo=body.selected_repo,
        selected_pr_number=body.selected_pr_number,
        selected_finding_id=body.selected_finding_id,
    )


@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve full conversation details and historical messages."""
    conv = db.get_conversation(current_user["id"], conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied.",
        )
    return conv


@router.patch("/conversations/{conversation_id}")
def update_conversation(
    conversation_id: str,
    body: UpdateConversationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Rename conversation or change attached repository/PR context."""
    updated = db.update_conversation(
        user_id=current_user["id"],
        conversation_id=conversation_id,
        title=body.title,
        selected_repo=body.selected_repo,
        selected_pr_number=body.selected_pr_number,
        selected_finding_id=body.selected_finding_id,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied.",
        )
    return updated


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Delete a conversation and its messages."""
    deleted = db.delete_conversation(current_user["id"], conversation_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied.",
        )
    return {"deleted": True, "conversation_id": conversation_id}


# --- Chat & Streaming Endpoints ---

@router.post("/chat")
async def chat_non_streaming(
    body: ChatMessageRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Send a message to the assistant and await the full response."""
    conv = db.get_conversation(current_user["id"], body.conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    res = await assistant_service.chat_sync(
        user_id=current_user["id"],
        conversation_id=body.conversation_id,
        user_message=body.message,
        selected_repo=body.selected_repo or conv.get("selected_repo"),
        selected_pr_number=body.selected_pr_number or conv.get("selected_pr_number"),
        selected_finding_id=body.selected_finding_id or conv.get("selected_finding_id"),
    )
    return res


@router.post("/chat/stream")
async def chat_stream(
    body: ChatMessageRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Stream assistant response progressively via Server-Sent Events (SSE)."""
    conv = db.get_conversation(current_user["id"], body.conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    async def sse_event_generator():
        async for packet in assistant_service.chat_stream(
            user_id=current_user["id"],
            conversation_id=body.conversation_id,
            user_message=body.message,
            selected_repo=body.selected_repo or conv.get("selected_repo"),
            selected_pr_number=body.selected_pr_number or conv.get("selected_pr_number"),
            selected_finding_id=body.selected_finding_id or conv.get("selected_finding_id"),
        ):
            event_type = packet.get("event", "message")
            data_json = json.dumps(packet.get("data", {}))
            yield f"event: {event_type}\ndata: {data_json}\n\n"

    return StreamingResponse(
        sse_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/conversations/{conversation_id}/regenerate")
async def regenerate_response(
    conversation_id: str,
    body: RegenerateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Regenerate the latest assistant response in a conversation."""
    conv = db.get_conversation(current_user["id"], conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    messages = conv.get("messages", [])
    if not messages:
        raise HTTPException(status_code=400, detail="Conversation has no messages to regenerate.")

    # Find the last user message and assistant message
    last_user_msg = None
    target_asst_msg_id = None
    for m in reversed(messages):
        if m["role"] == "assistant" and not target_asst_msg_id:
            target_asst_msg_id = m["id"]
        elif m["role"] == "user":
            last_user_msg = m["content"]
            break

    if not last_user_msg:
        raise HTTPException(status_code=400, detail="No preceding user message found to regenerate.")

    # Delete the assistant message (and anything after it)
    if target_asst_msg_id:
        db.delete_messages_after(conversation_id, target_asst_msg_id)

    async def sse_event_generator():
        async for packet in assistant_service.chat_stream(
            user_id=current_user["id"],
            conversation_id=conversation_id,
            user_message=last_user_msg,
            selected_repo=body.selected_repo or conv.get("selected_repo"),
            selected_pr_number=body.selected_pr_number or conv.get("selected_pr_number"),
            selected_finding_id=body.selected_finding_id or conv.get("selected_finding_id"),
        ):
            event_type = packet.get("event", "message")
            data_json = json.dumps(packet.get("data", {}))
            yield f"event: {event_type}\ndata: {data_json}\n\n"

    return StreamingResponse(
        sse_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# --- Context Helper Endpoints ---

@router.get("/context/repositories")
async def get_context_repositories(current_user: Dict[str, Any] = Depends(get_current_user)):
    """List accessible repositories for the assistant context selector."""
    repos = await github_service.list_authorized_repositories(current_user["id"])
    return [
        {
            "full_name": r["full_name"],
            "name": r["name"],
            "owner": r["owner"],
            "description": r.get("description", ""),
            "open_prs_count": r.get("open_pull_requests_count", 0),
        }
        for r in repos
    ]


@router.get("/context/pull-requests")
async def get_context_pull_requests(
    repo: str = Query(..., description="Repository full name (owner/repo)"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List open pull requests for the selected repository."""
    try:
        prs = await github_service.list_pull_requests(current_user["id"], repo)
        return [
            {
                "number": p["number"],
                "title": p["title"],
                "author": p["author"],
                "state": p["state"],
                "base_ref": p.get("base_ref", "main"),
                "head_ref": p.get("head_ref", "feature"),
            }
            for p in prs
        ]
    except Exception as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/context/findings")
def get_context_findings(
    repo: str = Query(..., description="Repository full name"),
    pr: Optional[int] = Query(None, description="Optional pull request number"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List security and regression findings for context selection."""
    try:
        findings = AssistantTools.get_security_findings(current_user["id"], repo, pr)
        return [
            {
                "id": f.get("id"),
                "title": f.get("title"),
                "severity": f.get("severity"),
                "category": f.get("category"),
                "file_path": f.get("file_path"),
                "line_number": f.get("line_number"),
                "lifecycle_status": f.get("lifecycle_status", "Open"),
            }
            for f in findings
        ]
    except Exception as e:
        raise HTTPException(status_code=403, detail=str(e))
