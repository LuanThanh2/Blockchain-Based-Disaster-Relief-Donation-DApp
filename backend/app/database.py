from sqlmodel import SQLModel, create_engine, Session
from .config import DATABASE_URL
from .models import User, PasswordResetOTP  # Import models để SQLModel tạo tables
import sqlite3
from pathlib import Path

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)

def run_migrations():
    """Tự động chạy migration khi cần thiết"""
    if not DATABASE_URL.startswith("sqlite"):
        return  # Chỉ migrate cho SQLite
    
    db_path = Path(DATABASE_URL.replace("sqlite:///", "").replace("sqlite:///./", ""))
    if not db_path.exists():
        return  # Database chưa tồn tại, sẽ được tạo tự động
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Kiểm tra và thêm columns vào campaign
        cursor.execute("PRAGMA table_info(campaign)")
        existing_columns = [row[1] for row in cursor.fetchall()]
        
        if "is_visible" not in existing_columns:
            cursor.execute("ALTER TABLE campaign ADD COLUMN is_visible BOOLEAN DEFAULT 1")
            cursor.execute("UPDATE campaign SET is_visible = 1 WHERE is_visible IS NULL")
        
        if "auto_disburse" not in existing_columns:
            cursor.execute("ALTER TABLE campaign ADD COLUMN auto_disburse BOOLEAN DEFAULT 0")
            cursor.execute("UPDATE campaign SET auto_disburse = 0 WHERE auto_disburse IS NULL")
        
        if "disburse_threshold" not in existing_columns:
            cursor.execute("ALTER TABLE campaign ADD COLUMN disburse_threshold REAL DEFAULT 0.8")
            cursor.execute("UPDATE campaign SET disburse_threshold = 0.8 WHERE disburse_threshold IS NULL")
        
        # Kiểm tra và thêm username vào auditlog
        try:
            cursor.execute("PRAGMA table_info(auditlog)")
            audit_columns = [row[1] for row in cursor.fetchall()]
            if "username" not in audit_columns:
                cursor.execute("ALTER TABLE auditlog ADD COLUMN username TEXT")
        except:
            pass  # Table chưa tồn tại, sẽ được tạo tự động
        
        # Kiểm tra và thêm email, wallet_address vào user table
        try:
            cursor.execute("PRAGMA table_info(user)")
            user_columns = [row[1] for row in cursor.fetchall()]
            if "email" not in user_columns:
                cursor.execute("ALTER TABLE user ADD COLUMN email TEXT")
                print("✅ Added 'email' column to user table")
            if "wallet_address" not in user_columns:
                cursor.execute("ALTER TABLE user ADD COLUMN wallet_address TEXT")
                print("✅ Added 'wallet_address' column to user table")
            if "is_active" not in user_columns:
                cursor.execute("ALTER TABLE user ADD COLUMN is_active BOOLEAN DEFAULT 1")
                cursor.execute("UPDATE user SET is_active = 1 WHERE is_active IS NULL")
                print("✅ Added 'is_active' column to user table")
        except Exception as e:
            print(f"⚠️ Warning when checking user columns: {e}")
        
        # Kiểm tra và tạo passwordresetotp table nếu chưa có
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='passwordresetotp'")
        if not cursor.fetchone():
            cursor.execute("""
                CREATE TABLE passwordresetotp (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL,
                    email TEXT NOT NULL,
                    otp_code TEXT NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    used BOOLEAN NOT NULL DEFAULT 0,
                    created_at TIMESTAMP NOT NULL
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_passwordresetotp_username ON passwordresetotp(username)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_passwordresetotp_otp_code ON passwordresetotp(otp_code)")
            print("✅ Created passwordresetotp table")
        
        # Kiểm tra withdrawlog table
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='withdrawlog'")
        if not cursor.fetchone():
            cursor.execute("""
                CREATE TABLE withdrawlog (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    campaign_id INTEGER NOT NULL,
                    onchain_campaign_id INTEGER,
                    owner_address TEXT NOT NULL,
                    amount_eth REAL NOT NULL,
                    amount_wei TEXT NOT NULL,
                    tx_hash TEXT NOT NULL UNIQUE,
                    block_number INTEGER NOT NULL,
                    timestamp TIMESTAMP NOT NULL,
                    created_at TIMESTAMP NOT NULL,
                    FOREIGN KEY (campaign_id) REFERENCES campaign (id)
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_withdrawlog_tx_hash ON withdrawlog(tx_hash)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_withdrawlog_campaign_id ON withdrawlog(campaign_id)")
        
        conn.commit()
        conn.close()
    except Exception as e:
        # Nếu migration fail, không crash app, chỉ log warning
        print(f"⚠️ Migration warning: {e}")

def init_db():
    """Khởi tạo database và chạy migration tự động"""
    # Chạy migration trước (nếu database đã tồn tại)
    run_migrations()
    # Tạo tables mới (nếu chưa có)
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
