"""
LLM Provider Abstraction Layer for REGRAVA AI Assistant.
Provides unified streaming and non-streaming responses across Google Gemini,
OpenAI, and Anthropic with automatic credential resolution and safe error handling.
"""

import json
import logging
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, List, Optional, Any
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Base error for LLM provider failures."""
    pass


class LLMConfigurationError(LLMError):
    """Raised when an API key or provider is not configured."""
    pass


class LLMProviderUnavailableError(LLMError):
    """Raised when the LLM service endpoint returns an error or times out."""
    pass


class BaseLLMProvider(ABC):
    """Abstract interface for LLM providers."""

    @abstractmethod
    def validate_provider(self) -> Dict[str, Any]:
        """Check whether the provider is configured with required credentials."""
        pass

    @abstractmethod
    async def stream_response(
        self,
        messages: List[Dict[str, str]],
        system_instruction: str = "",
        model: Optional[str] = None,
        temperature: float = 0.2,
    ) -> AsyncGenerator[str, None]:
        """Stream generated text chunks progressively."""
        pass

    @abstractmethod
    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        system_instruction: str = "",
        model: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        """Generate complete response text non-streamingly."""
        pass


class GeminiLLMProvider(BaseLLMProvider):
    """
    Google Gemini API implementation using native REST SSE endpoints.
    Requires GEMINI_API_KEY.
    """

    DEFAULT_MODEL = "gemini-2.0-flash"

    def get_api_key(self) -> Optional[str]:
        return settings.get_gemini_api_key()

    def get_model(self) -> str:
        configured = settings.get_llm_model()
        if "gemini" in configured.lower():
            return configured
        return self.DEFAULT_MODEL

    def validate_provider(self) -> Dict[str, Any]:
        key = self.get_api_key()
        if not key:
            return {
                "is_configured": False,
                "provider": "gemini",
                "model": self.get_model(),
                "error": "Missing GEMINI_API_KEY. Add your Gemini API key in Settings or set GEMINI_API_KEY in .env.",
                "setup_url": "https://aistudio.google.com/app/apikey",
            }
        return {
            "is_configured": True,
            "provider": "gemini",
            "model": self.get_model(),
            "status": "ready",
        }

    def _convert_messages(self, messages: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        gemini_contents = []
        for m in messages:
            role = m.get("role", "user")
            # Gemini roles: "user" or "model"
            gemini_role = "model" if role in ("assistant", "model") else "user"
            content = m.get("content", "")
            gemini_contents.append({
                "role": gemini_role,
                "parts": [{"text": content}],
            })
        return gemini_contents

    async def stream_response(
        self,
        messages: List[Dict[str, str]],
        system_instruction: str = "",
        model: Optional[str] = None,
        temperature: float = 0.2,
    ) -> AsyncGenerator[str, None]:
        key = self.get_api_key()
        if not key:
            raise LLMConfigurationError(
                "Gemini API key is not configured. Please add GEMINI_API_KEY in your environment or Settings."
            )

        active_model = model or self.get_model()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{active_model}:streamGenerateContent?alt=sse&key={key}"

        payload: Dict[str, Any] = {
            "contents": self._convert_messages(messages),
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": 4096,
            },
        }
        if system_instruction:
            payload["system_instruction"] = {
                "parts": [{"text": system_instruction}]
            }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                async with client.stream("POST", url, json=payload, headers={"Content-Type": "application/json"}) as response:
                    if response.status_code != 200:
                        err_body = await response.aread()
                        err_text = err_body.decode(errors="replace")
                        logger.error(f"Gemini API error ({response.status_code}): {err_text}")
                        raise LLMProviderUnavailableError(
                            f"Gemini API error ({response.status_code}): {err_text[:200]}"
                        )

                    async for line in response.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if not data_str or data_str == "[DONE]":
                            continue
                        try:
                            parsed = json.loads(data_str)
                            candidates = parsed.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for p in parts:
                                    txt = p.get("text", "")
                                    if txt:
                                        yield txt
                        except json.JSONDecodeError:
                            continue
            except httpx.TimeoutException:
                raise LLMProviderUnavailableError("Gemini request timed out.")
            except httpx.RequestError as e:
                raise LLMProviderUnavailableError(f"Network error connecting to Gemini API: {str(e)}")

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        system_instruction: str = "",
        model: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        chunks = []
        async for chunk in self.stream_response(messages, system_instruction, model, temperature):
            chunks.append(chunk)
        return "".join(chunks)


class OpenAILLMProvider(BaseLLMProvider):
    """
    OpenAI-compatible API implementation.
    Requires OPENAI_API_KEY.
    """

    DEFAULT_MODEL = "gpt-4o"

    def get_api_key(self) -> Optional[str]:
        return settings.get_openai_api_key()

    def get_model(self) -> str:
        configured = settings.get_llm_model()
        if "gpt" in configured.lower() or "o1" in configured.lower() or "o3" in configured.lower():
            return configured
        return self.DEFAULT_MODEL

    def validate_provider(self) -> Dict[str, Any]:
        key = self.get_api_key()
        if not key:
            return {
                "is_configured": False,
                "provider": "openai",
                "model": self.get_model(),
                "error": "Missing OPENAI_API_KEY. Configure it in Settings or set OPENAI_API_KEY in .env.",
                "setup_url": "https://platform.openai.com/api-keys",
            }
        return {
            "is_configured": True,
            "provider": "openai",
            "model": self.get_model(),
            "status": "ready",
        }

    async def stream_response(
        self,
        messages: List[Dict[str, str]],
        system_instruction: str = "",
        model: Optional[str] = None,
        temperature: float = 0.2,
    ) -> AsyncGenerator[str, None]:
        key = self.get_api_key()
        if not key:
            raise LLMConfigurationError("OpenAI API key is not configured.")

        active_model = model or self.get_model()
        url = "https://api.openai.com/v1/chat/completions"

        full_messages = []
        if system_instruction:
            full_messages.append({"role": "system", "content": system_instruction})
        full_messages.extend(messages)

        payload = {
            "model": active_model,
            "messages": full_messages,
            "temperature": temperature,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                async with client.stream(
                    "POST",
                    url,
                    json=payload,
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                ) as response:
                    if response.status_code != 200:
                        err_body = await response.aread()
                        raise LLMProviderUnavailableError(f"OpenAI error ({response.status_code}): {err_body.decode()[:200]}")

                    async for line in response.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            parsed = json.loads(data_str)
                            delta = parsed.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
            except httpx.TimeoutException:
                raise LLMProviderUnavailableError("OpenAI request timed out.")
            except httpx.RequestError as e:
                raise LLMProviderUnavailableError(f"Network error connecting to OpenAI: {str(e)}")

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        system_instruction: str = "",
        model: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        chunks = []
        async for chunk in self.stream_response(messages, system_instruction, model, temperature):
            chunks.append(chunk)
        return "".join(chunks)


class AnthropicLLMProvider(BaseLLMProvider):
    """
    Anthropic Claude API implementation.
    Requires ANTHROPIC_API_KEY.
    """

    DEFAULT_MODEL = "claude-3-5-sonnet-20241022"

    def get_api_key(self) -> Optional[str]:
        return settings.get_anthropic_api_key()

    def get_model(self) -> str:
        configured = settings.get_llm_model()
        if "claude" in configured.lower():
            return configured
        return self.DEFAULT_MODEL

    def validate_provider(self) -> Dict[str, Any]:
        key = self.get_api_key()
        if not key:
            return {
                "is_configured": False,
                "provider": "anthropic",
                "model": self.get_model(),
                "error": "Missing ANTHROPIC_API_KEY. Configure it in Settings or set ANTHROPIC_API_KEY in .env.",
                "setup_url": "https://console.anthropic.com/settings/keys",
            }
        return {
            "is_configured": True,
            "provider": "anthropic",
            "model": self.get_model(),
            "status": "ready",
        }

    async def stream_response(
        self,
        messages: List[Dict[str, str]],
        system_instruction: str = "",
        model: Optional[str] = None,
        temperature: float = 0.2,
    ) -> AsyncGenerator[str, None]:
        key = self.get_api_key()
        if not key:
            raise LLMConfigurationError("Anthropic API key is not configured.")

        active_model = model or self.get_model()
        url = "https://api.anthropic.com/v1/messages"

        # Anthropic requires user/assistant alternating messages, system prompt as top-level parameter
        payload = {
            "model": active_model,
            "max_tokens": 4096,
            "temperature": temperature,
            "messages": [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] in ("user", "assistant")],
            "stream": True,
        }
        if system_instruction:
            payload["system"] = system_instruction

        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                async with client.stream("POST", url, json=payload, headers=headers) as response:
                    if response.status_code != 200:
                        err_body = await response.aread()
                        raise LLMProviderUnavailableError(f"Anthropic error ({response.status_code}): {err_body.decode()[:200]}")

                    async for line in response.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        try:
                            parsed = json.loads(data_str)
                            event_type = parsed.get("type")
                            if event_type == "content_block_delta":
                                delta_text = parsed.get("delta", {}).get("text", "")
                                if delta_text:
                                    yield delta_text
                        except json.JSONDecodeError:
                            continue
            except httpx.TimeoutException:
                raise LLMProviderUnavailableError("Anthropic request timed out.")
            except httpx.RequestError as e:
                raise LLMProviderUnavailableError(f"Network error connecting to Anthropic: {str(e)}")

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        system_instruction: str = "",
        model: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        chunks = []
        async for chunk in self.stream_response(messages, system_instruction, model, temperature):
            chunks.append(chunk)
        return "".join(chunks)


def get_llm_provider(name: Optional[str] = None) -> BaseLLMProvider:
    """Factory to retrieve the configured LLM provider instance."""
    provider_name = (name or settings.get_llm_provider()).lower()
    if provider_name == "openai":
        return OpenAILLMProvider()
    elif provider_name == "anthropic":
        return AnthropicLLMProvider()
    else:
        return GeminiLLMProvider()
