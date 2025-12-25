import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env at repo root: E:\Disaster_Relief_Dapp\.env
root = Path(__file__).resolve().parents[2]
env_path = root / ".env"
if env_path.exists():
    load_dotenv(env_path)

RPC_URL = os.getenv("RPC_URL") or os.getenv("SEPOLIA_RPC_URL")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")
DEPLOYER_PRIVATE_KEY = os.getenv("DEPLOYER_PRIVATE_KEY")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", 5050))
CHAIN_ID = int(os.getenv("CHAIN_ID", 11155111))

# Contract address (required when createOnChain=true)
DISASTER_FUND_ADDRESS = os.getenv("DISASTER_FUND_ADDRESS")

# CORS origins (comma-separated)
# Mặc định cho phép localhost:3000 và 127.0.0.1:3000
default_origins = "http://localhost:3000,http://127.0.0.1:3000"
FRONTEND_ORIGINS = [
    o.strip()
    for o in (os.getenv("FRONTEND_ORIGINS") or default_origins).split(",")
    if o.strip()
]
# Debug: print CORS origins
print(f"🌐 CORS allowed origins: {FRONTEND_ORIGINS}")

# Email/SMTP configuration for password reset
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")  # Gmail address
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")  # Gmail App Password
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USER)  # From email address
