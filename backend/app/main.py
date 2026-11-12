"""
FastAPI application entry point for REGRAVA.
Evidence-Based Pull-Request Security and Regression Analysis Platform.
"""

import sys
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.analysis import router as analysis_router
from app.api.auth import router as auth_router
from app.api.demo import router as demo_router
from app.api.health import router as health_router
from app.api.pull_requests import router as pr_router
from app.api.github_reviews import router as github_reviews_router
from app.api.security import router as security_router
from app.api.ai_steering import router as ai_steering_router
from app.config import settings

app = FastAPI(
    title=f"{settings.APP_NAME} API",
    description=f"{settings.APP_TAGLINE} - Pull-Request Security & API Regression Platform",
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    err = traceback.format_exc()
    print("UNCAUGHT API EXCEPTION:\n" + err, file=sys.stderr, flush=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "traceback": err},
    )

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https://([a-zA-Z0-9_-]+\.)?vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers (both with /api prefix and at root for full proxy compatibility)
routers = [
    health_router,
    auth_router,
    pr_router,
    github_reviews_router,
    security_router,
    demo_router,
    analysis_router,
    ai_steering_router,
]

for r in routers:
    app.include_router(r, prefix="/api")
    app.include_router(r)


@app.get("/")
def root():
    return {
        "service": settings.APP_NAME,
        "tagline": settings.APP_TAGLINE,
        "version": settings.APP_VERSION,
        "docs": "/api/docs",
        "health": "/api/health",
    }
