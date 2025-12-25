# backend/app/utils/roles.py

# Chỉ có 2 role: user (Donor/User) và admin (Admin)
# Guest không cần role (không đăng nhập)

ADMIN_ROLES = ["admin"]
USER_ROLE = "user"

# Backwards-compatible named constants
ROLE_ADMIN = "admin"
ROLE_USER = USER_ROLE

# Các role được phép tạo campaign (chỉ Admin)
CAMPAIGN_CREATOR_ROLES = [ROLE_ADMIN]

# Tất cả roles
ALL_ROLES = [ROLE_ADMIN, ROLE_USER]
