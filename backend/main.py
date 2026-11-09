"""
Main FastAPI entrypoint for Vercel Services deployment.
"""
import sys
import traceback
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import JSONResponse

# Ensure the backend directory is in the Python module search path
_here = Path(__file__).resolve().parent
for _p in [str(_here), str(_here.parent)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

# Top-level assignment for Vercel's AST entrypoint scanner
app = FastAPI(title="REGRAVA API")

_init_error = None
try:
    from app.main import app as _real_app
    app = _real_app
except Exception:
    _init_error = traceback.format_exc()
    print("FATAL BACKEND INIT ERROR:\n" + _init_error, file=sys.stderr, flush=True)

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
    async def catch_all(path: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "BACKEND_INITIALIZATION_FAILED",
                "detail": _init_error,
                "sys_path": sys.path,
                "current_dir": str(Path.cwd()),
                "files_in_here": [f.name for f in _here.iterdir()] if _here.exists() else [],
            },
        )

__all__ = ["app"]
