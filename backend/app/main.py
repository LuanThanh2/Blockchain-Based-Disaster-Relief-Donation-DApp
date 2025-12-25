from fastapi import FastAPI, Request, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from contextlib import asynccontextmanager
import traceback
import logging

from .database import init_db
from .routes import campaigns, auth, admin
from .services.web3_service import start_donation_event_poller_thread
from .services.auto_disburse import start_auto_disburse_thread
# nếu có auth router thì bật dòng dưới
# from .routes import auth

from .config import BACKEND_PORT, FRONTEND_ORIGINS

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan events (startup / shutdown)
    """
    # Startup
    init_db()
    print("✅ Database initialized")
    # Start background donation event poller (if configured)
    try:
        start_donation_event_poller_thread()
        print("🔎 Donation event poller started")
    except Exception as e:
        print("⚠️ Failed to start donation poller:", e)
    
    # Start auto-disburse background job
    try:
        start_auto_disburse_thread(poll_interval=300)  # Check every 5 minutes
        print("💰 Auto-disburse job started")
    except Exception as e:
        print("⚠️ Failed to start auto-disburse job:", e)

    yield

    # Shutdown (nếu cần)
    print("🛑 Application shutdown")


class CORSHeaderMiddleware(BaseHTTPMiddleware):
    """Custom middleware to ensure CORS headers are always present, even on errors"""
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "*")
        
        try:
            response = await call_next(request)
        except Exception as e:
            # If an exception occurs, create a response with CORS headers
            logger.exception(f"Exception in middleware: {e}")
            response = JSONResponse(
                status_code=500,
                content={"detail": f"Internal server error: {str(e)}"}
            )
        
        # Always add CORS headers to response, regardless of origin
        response.headers["Access-Control-Allow-Origin"] = origin if origin != "*" else "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Expose-Headers"] = "*"
        
        return response


def create_app() -> FastAPI:
    app = FastAPI(
        title="Disaster Relief Donation Backend",
        description="Blockchain-based transparent donation system",
        version="1.0.0",
        lifespan=lifespan,
    )

    # ==========================
    # CORS - Add custom middleware FIRST to ensure headers are always present
    # ==========================
    print(f"🌐 Configuring CORS with origins: {FRONTEND_ORIGINS}")
    app.add_middleware(CORSHeaderMiddleware)
    
    # Also add standard CORS middleware as backup
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if not FRONTEND_ORIGINS else FRONTEND_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    # ==========================
    # Exception Handlers - MUST be before routers
    # ==========================
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """Handle HTTPException (from dependencies like get_current_user) with CORS headers"""
        origin = request.headers.get("origin", "*")
        response = JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )
        # Ensure CORS headers are present
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Handle validation errors with CORS headers"""
        logger.error(f"Validation error: {exc}")
        origin = request.headers.get("origin", "*")
        response = JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": exc.errors(), "body": exc.body}
        )
        # Ensure CORS headers are present
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response
    
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """Handle all unhandled exceptions and return JSON response with CORS headers"""
        logger.exception(f"Unhandled exception: {exc}")
        traceback_str = traceback.format_exc()
        logger.error(f"Traceback: {traceback_str}")
        
        origin = request.headers.get("origin", "*")
        response = JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": f"Internal server error: {str(exc)}",
                "type": type(exc).__name__,
            }
        )
        # Ensure CORS headers are present even in error responses
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response

    # ==========================
    # Routers
    # ==========================
    # Include routers AFTER CORS middleware
    app.include_router(campaigns.router)
    
    # Auth router (login, etc.)
    app.include_router(auth.router)
    
    # Admin router (user management)
    app.include_router(admin.router)
    
    print("✅ Routers registered")

    # ==========================
    # Health check (demo rất tốt)
    # ==========================
    @app.get("/health")
    def health_check():
        return {
            "status": "ok",
            "service": "Disaster Relief Backend",
        }

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    import logging
    
    # Cấu hình logging để hiển thị tất cả logs
    logging.basicConfig(
        level=logging.DEBUG,  # Hiển thị tất cả logs (DEBUG, INFO, WARNING, ERROR)
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # Cấu hình uvicorn logging
    uvicorn_logger = logging.getLogger("uvicorn")
    uvicorn_logger.setLevel(logging.DEBUG)
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=BACKEND_PORT,
        reload=True,
        log_level="debug",  # Bật debug logging cho uvicorn
    )
