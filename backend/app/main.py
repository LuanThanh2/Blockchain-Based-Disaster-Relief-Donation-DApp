from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .database import init_db
from .routes import campaigns
# nếu có auth router thì bật dòng dưới
# from .routes import auth

from .config import BACKEND_PORT, FRONTEND_ORIGINS


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan events (startup / shutdown)
    """
    # Startup
    init_db()
    print("✅ Database initialized")

    yield

    # Shutdown (nếu cần)
    print("🛑 Application shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Disaster Relief Donation Backend",
        description="Blockchain-based transparent donation system",
        version="1.0.0",
        lifespan=lifespan,
    )

    # ==========================
    # CORS
    # ==========================
    app.add_middleware(
        CORSMiddleware,
        allow_origins=FRONTEND_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ==========================
    # Routers
    # ==========================
    app.include_router(campaigns.router)

    # nếu có login / admin
    # app.include_router(auth.router)

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

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=BACKEND_PORT,
        reload=True,
    )
