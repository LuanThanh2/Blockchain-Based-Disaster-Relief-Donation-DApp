"""
Migration script để thêm các fields và tables mới vào database
Chạy: python migrate_database.py
"""
import sqlite3
import os
from pathlib import Path

# Đường dẫn đến database
DB_PATH = Path(__file__).parent / "dev.db"

def migrate():
    """Thực hiện migration"""
    if not DB_PATH.exists():
        print("⚠️ Database không tồn tại. SQLModel sẽ tự động tạo khi khởi động backend.")
        return
    
    print(f"📦 Đang migrate database: {DB_PATH}")
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    try:
        # Kiểm tra và thêm columns vào campaign table
        print("\n1. Kiểm tra campaign table...")
        cursor.execute("PRAGMA table_info(campaign)")
        existing_columns = [row[1] for row in cursor.fetchall()]
        
        if "is_visible" not in existing_columns:
            print("   ➕ Thêm column: is_visible")
            cursor.execute("ALTER TABLE campaign ADD COLUMN is_visible BOOLEAN DEFAULT 1")
            # Update existing records
            cursor.execute("UPDATE campaign SET is_visible = 1 WHERE is_visible IS NULL")
        else:
            print("   ✅ Column is_visible đã tồn tại")
        
        if "auto_disburse" not in existing_columns:
            print("   ➕ Thêm column: auto_disburse")
            cursor.execute("ALTER TABLE campaign ADD COLUMN auto_disburse BOOLEAN DEFAULT 0")
            cursor.execute("UPDATE campaign SET auto_disburse = 0 WHERE auto_disburse IS NULL")
        else:
            print("   ✅ Column auto_disburse đã tồn tại")
        
        if "disburse_threshold" not in existing_columns:
            print("   ➕ Thêm column: disburse_threshold")
            cursor.execute("ALTER TABLE campaign ADD COLUMN disburse_threshold REAL DEFAULT 0.8")
            cursor.execute("UPDATE campaign SET disburse_threshold = 0.8 WHERE disburse_threshold IS NULL")
        else:
            print("   ✅ Column disburse_threshold đã tồn tại")
        
        # Kiểm tra và thêm username vào auditlog table
        print("\n2. Kiểm tra auditlog table...")
        try:
            cursor.execute("PRAGMA table_info(auditlog)")
            existing_columns = [row[1] for row in cursor.fetchall()]
            
            if "username" not in existing_columns:
                print("   ➕ Thêm column: username")
                cursor.execute("ALTER TABLE auditlog ADD COLUMN username TEXT")
            else:
                print("   ✅ Column username đã tồn tại")
        except sqlite3.OperationalError:
            print("   ⚠️ Table auditlog chưa tồn tại (sẽ được tạo tự động)")
        
        # Kiểm tra withdrawlog table
        print("\n3. Kiểm tra withdrawlog table...")
        try:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='withdrawlog'")
            if cursor.fetchone():
                print("   ✅ Table withdrawlog đã tồn tại")
            else:
                print("   ➕ Tạo table: withdrawlog")
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
                # Tạo index cho tx_hash
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_withdrawlog_tx_hash ON withdrawlog(tx_hash)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_withdrawlog_campaign_id ON withdrawlog(campaign_id)")
        except sqlite3.OperationalError as e:
            print(f"   ⚠️ Lỗi khi tạo withdrawlog: {e}")
        
        # Commit changes
        conn.commit()
        print("\n✅ Migration hoàn tất!")
        
        # Hiển thị thông tin database
        print("\n📊 Thông tin database:")
        cursor.execute("SELECT COUNT(*) FROM campaign")
        campaign_count = cursor.fetchone()[0]
        print(f"   - Campaigns: {campaign_count}")
        
        cursor.execute("SELECT COUNT(*) FROM donation")
        donation_count = cursor.fetchone()[0]
        print(f"   - Donations: {donation_count}")
        
        try:
            cursor.execute("SELECT COUNT(*) FROM withdrawlog")
            withdraw_count = cursor.fetchone()[0]
            print(f"   - Withdraws: {withdraw_count}")
        except:
            print(f"   - Withdraws: 0")
        
        try:
            cursor.execute("SELECT COUNT(*) FROM auditlog")
            audit_count = cursor.fetchone()[0]
            print(f"   - Audit logs: {audit_count}")
        except:
            print(f"   - Audit logs: 0")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Lỗi migration: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 50)
    print("🚀 Database Migration Script")
    print("=" * 50)
    migrate()
    print("\n" + "=" * 50)
    print("💡 Tip: Nếu có lỗi, có thể xóa dev.db và để SQLModel tự tạo lại")
    print("=" * 50)

