# backend/app/utils/security.py

from passlib.context import CryptContext

# Password hashing: bcrypt_sha256 (tự động hash SHA-256 trước rồi bcrypt sau)
pwd_context = CryptContext(
    schemes=["bcrypt_sha256"],
    deprecated="auto",
)


def hash_password(password: str) -> str:
    """
    Hash password bằng bcrypt_sha256
    
    Args:
        password: Plain text password to hash
        
    Returns:
        Hashed password string
        
    Note:
        bcrypt_sha256 tự động hash SHA-256 trước rồi bcrypt sau,
        không có giới hạn 72 bytes như bcrypt thuần
    """
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """
    Verify password với bcrypt_sha256 hash
    
    Args:
        password: Plain text password to verify
        hashed: Hashed password to compare against
        
    Returns:
        True if password matches, False otherwise
        
    Note:
        bcrypt_sha256 tự động xử lý SHA-256 → bcrypt khi verify
    """
    return pwd_context.verify(password, hashed)

