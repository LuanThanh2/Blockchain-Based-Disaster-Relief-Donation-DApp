from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routes import campaigns
from .config import BACKEND_PORT, FRONTEND_ORIGINS

def create_app() -> FastAPI:
    app = FastAPI(title="Disaster Relief Backend")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=FRONTEND_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(campaigns.router)

    @app.on_event("startup")
    def on_startup():
        init_db()

    return app

app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=BACKEND_PORT, reload=True)
