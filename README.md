# Blockchain-Based Disaster Relief Donation DApp

Hệ thống quyên góp cứu trợ thiên tai dựa trên blockchain, đảm bảo minh bạch và có thể kiểm chứng. Mọi giao dịch quyên góp và giải ngân được ghi nhận on-chain, giảm thiểu sự phụ thuộc vào bên trung gian.

## Mục tiêu

- Minh bạch hóa quyên góp: Tất cả số tiền vào/ra và lịch sử giao dịch có thể kiểm tra công khai trên blockchain
- Chuẩn hóa quy trình gây quỹ: Tạo chiến dịch, nhận quyên góp, theo dõi tiến độ, và giải ngân
- Cung cấp API backend để tích hợp với UI và ứng dụng khác
- Quản lý người dùng và phân quyền: Hệ thống xác thực với vai trò Admin và User

## Kiến trúc hệ thống

### Smart Contract (Solidity)
- **File**: `contracts/DisasterFund.sol`
- **Chức năng**: Logic xử lý campaign, donate, withdraw
- **Events**: `CampaignCreated`, `DonationReceived`, `FundsWithdrawn`

### Backend API (Python/FastAPI)
- **Thư mục**: `backend/`
- **Framework**: FastAPI + web3.py
- **Database**: SQLite (có thể chuyển sang PostgreSQL)
- **Chức năng**: 
  - RESTful API cho campaigns, donations, withdrawals
  - Xác thực và phân quyền (JWT)
  - Quản lý người dùng
  - Indexer tự động đồng bộ events từ blockchain
  - Auto-disburse (tự động giải ngân khi đạt ngưỡng)
  - Audit logs
  - Báo cáo và xuất dữ liệu

### Frontend (Next.js/React)
- **Thư mục**: `Frontend/`
- **Framework**: Next.js 14+ với TypeScript
- **Chức năng**:
  - Trang công khai xem campaigns
  - Trang quản trị cho admin
  - Trang quyên góp với MetaMask
  - Quản lý profile và lịch sử quyên góp
  - Quản lý users (admin only)

### Hardhat (Node.js)
- **Chức năng**: Compile, test, và deploy smart contracts
- **Scripts**: Trong thư mục `scripts/`

## Yêu cầu hệ thống

- **Node.js**: LTS version (khuyến nghị 18.x trở lên)
- **Python**: 3.10 trở lên
- **npm** hoặc **yarn**
- **MetaMask** extension (để test quyên góp)
- **Git**

## Cài đặt

### 1. Clone repository

```bash
git clone <repository-url>
cd Blockchain-Based-Disaster-Relief-Donation-DApp
```

### 2. Cài đặt dependencies cho Hardhat và Frontend

```bash
# Cài đặt dependencies cho Hardhat
npm install

# Cài đặt dependencies cho Frontend
cd Frontend
npm install
cd ..
```

### 3. Cài đặt dependencies cho Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
cd ..
```

## Cấu hình

### 1. Cấu hình Hardhat (cho Sepolia testnet)

Tạo file `.env` ở thư mục root:

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
DEPLOYER_PRIVATE_KEY=0x...
EXPECTED_DEPLOYER_ADDRESS=0x...
```

### 2. Cấu hình Backend

Tạo file `backend/.env`:

```env
# Blockchain Configuration
CHAIN_ID=11155111
RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
PRIVATE_KEY=0x...
DISASTER_FUND_ADDRESS=0x...

# Database
DATABASE_URL=sqlite:///./dev.db

# Server
BACKEND_PORT=8000

# CORS
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Email Configuration (cho password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
```

### 3. Deploy Smart Contract

```bash
# Compile contract
npx hardhat compile

# Deploy lên Sepolia
npx hardhat run scripts/deploy_disaster_fund.js --network sepolia
```

Copy địa chỉ contract được in ra và điền vào `DISASTER_FUND_ADDRESS` trong `backend/.env`.

## Chạy ứng dụng

### Cách 1: Chạy trên Sepolia Testnet (Khuyến nghị)

#### Terminal 1: Backend

```bash
cd backend
.venv\Scripts\activate  # Windows
# hoặc source .venv/bin/activate  # Linux/Mac

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend sẽ chạy tại `http://127.0.0.1:8000`

#### Terminal 2: Frontend

```bash
cd Frontend
npm run dev
```

Frontend sẽ chạy tại `http://localhost:3000`

### Cách 2: Chạy trên Local Hardhat Node

#### Terminal 1: Hardhat Node

```bash
npx hardhat node
```

Hardhat node sẽ chạy tại `http://127.0.0.1:8545`

#### Terminal 2: Deploy Contract lên Local

```bash
npx hardhat run scripts/deploy_disaster_fund.js --network localhost
```

Copy địa chỉ contract và cập nhật `backend/.env`:
- `CHAIN_ID=31337`
- `RPC_URL=http://127.0.0.1:8545`

#### Terminal 3: Backend

```bash
cd backend
.venv\Scripts\activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Terminal 4: Frontend

```bash
cd Frontend
npm run dev
```

## Tính năng chính

### 1. Quản lý Campaigns

- **Tạo campaign**: Admin có thể tạo campaign với metadata (title, description, target amount, deadline, v.v.)
- **Tạo on-chain**: Tùy chọn tạo campaign trực tiếp trên blockchain
- **Chỉnh sửa campaign**: Admin có thể cập nhật thông tin campaign
- **Ẩn/hiện campaign**: Admin có thể ẩn campaign khỏi trang công khai
- **Tự động giải ngân**: Cấu hình auto-disburse khi đạt ngưỡng phần trăm mục tiêu

### 2. Quyên góp (Donations)

- **Quyên góp qua MetaMask**: Người dùng có thể quyên góp ETH trực tiếp từ ví MetaMask
- **Lịch sử quyên góp**: Người dùng có thể xem lịch sử quyên góp của mình
- **Đồng bộ tự động**: Backend tự động index các events `DonationReceived` từ blockchain
- **Hiển thị tiến độ**: Hiển thị số tiền đã quyên góp, số lượng donors, và phần trăm hoàn thành

### 3. Rút tiền (Withdrawals)

- **Rút tiền**: Admin có thể rút tiền từ campaign (on-chain)
- **Lịch sử rút tiền**: Xem tất cả các giao dịch rút tiền của campaign
- **Tự động giải ngân**: Hệ thống tự động rút tiền khi campaign đạt ngưỡng đã cấu hình

### 4. Xác thực và Phân quyền

- **Đăng ký**: Người dùng có thể đăng ký tài khoản mới
- **Đăng nhập**: Xác thực bằng username/password với JWT
- **Phân quyền**: 
  - **Admin**: Quản lý campaigns, users, xem audit logs, báo cáo
  - **User**: Quyên góp, xem lịch sử quyên góp, quản lý profile
- **Reset password**: Quên mật khẩu và reset qua OTP email

### 5. Quản lý Users (Admin)

- **Danh sách users**: Xem tất cả users với filters (role, status, search)
- **Cập nhật user**: Thay đổi role, email, trạng thái active
- **Ban/Unban user**: Vô hiệu hóa hoặc kích hoạt lại tài khoản
- **Xóa user**: Soft delete (set is_active=false)

### 6. Audit Logs

- **Ghi nhận tất cả actions**: Mọi hành động quan trọng đều được ghi lại
- **Filters**: Lọc theo action, username, thời gian
- **Chi tiết**: Mỗi log bao gồm username, action, details, timestamp

### 7. Báo cáo và Xuất dữ liệu

- **Báo cáo tổng hợp**: Thống kê tổng campaigns, donations, withdrawals
- **Top campaigns**: Danh sách campaigns có số tiền quyên góp cao nhất
- **Xuất sao kê**: Admin có thể xuất sao kê đầy đủ (donations + withdrawals) dạng CSV/JSON
- **Xuất donations**: User có thể xuất lịch sử donations dạng CSV/JSON

### 8. Profile Management

- **Xem profile**: Thông tin user, email, role, ngày tạo
- **Liên kết ví**: Kết nối MetaMask wallet với tài khoản
- **Lịch sử quyên góp**: Xem tất cả donations đã thực hiện

## API Endpoints

### Public Endpoints

- `GET /api/v1/campaigns` - Danh sách campaigns (có thể filter visible_only)
- `GET /api/v1/campaigns/{id}` - Chi tiết campaign
- `GET /api/v1/campaigns/{id}/stats` - Thống kê campaign
- `GET /api/v1/campaigns/{id}/donations` - Danh sách donations của campaign

### Authentication Endpoints

- `POST /api/v1/auth/register` - Đăng ký user mới
- `POST /api/v1/auth/login` - Đăng nhập
- `POST /api/v1/auth/forgot-password` - Yêu cầu reset password (gửi OTP)
- `POST /api/v1/auth/reset-password` - Reset password với OTP
- `GET /api/v1/auth/me` - Lấy thông tin user hiện tại
- `PUT /api/v1/auth/me/wallet` - Cập nhật wallet address
- `DELETE /api/v1/auth/me/wallet` - Xóa liên kết wallet

### Campaign Management (Admin)

- `POST /api/v1/campaigns` - Tạo campaign mới
- `PUT /api/v1/campaigns/{id}` - Cập nhật campaign
- `POST /api/v1/campaigns/{id}/toggle-visibility` - Ẩn/hiện campaign
- `POST /api/v1/campaigns/{id}/create-onchain` - Tạo campaign on-chain
- `POST /api/v1/campaigns/{id}/sync-donations` - Đồng bộ donations từ blockchain
- `POST /api/v1/campaigns/{id}/withdraw` - Rút tiền từ campaign
- `POST /api/v1/campaigns/{id}/set-active` - Bật/tắt campaign (on-chain)
- `GET /api/v1/campaigns/{id}/withdraws` - Lịch sử rút tiền
- `GET /api/v1/campaigns/{id}/export/statement` - Xuất sao kê (admin only)
- `GET /api/v1/campaigns/{id}/export/donations` - Xuất donations (authenticated)

### User Management (Admin)

- `GET /api/v1/admin/users` - Danh sách users (với filters)
- `GET /api/v1/admin/users/{id}` - Chi tiết user
- `PUT /api/v1/admin/users/{id}` - Cập nhật user
- `DELETE /api/v1/admin/users/{id}` - Xóa user (soft delete)
- `POST /api/v1/admin/users/{id}/toggle-active` - Ban/unban user

### Reports & Analytics (Admin)

- `GET /api/v1/campaigns/admin/reports` - Báo cáo tổng hợp
- `GET /api/v1/campaigns/admin/audit-logs` - Audit logs với filters

### User Endpoints

- `GET /api/v1/campaigns/my-donations?donor_address=...` - Lịch sử quyên góp của user

## Cấu trúc thư mục

```
Blockchain-Based-Disaster-Relief-Donation-DApp/
├── contracts/              # Smart contracts (Solidity)
│   └── DisasterFund.sol
├── scripts/                # Hardhat deployment scripts
│   ├── deploy_disaster_fund.js
│   ├── check_deployer_balance.js
│   └── ...
├── abi/                    # Contract ABIs
│   └── DisasterFund.json
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── main.py         # FastAPI app entry point
│   │   ├── models.py       # SQLModel database models
│   │   ├── schemas.py      # Pydantic schemas
│   │   ├── crud.py         # Database operations
│   │   ├── database.py     # Database setup & migrations
│   │   ├── config.py       # Configuration
│   │   ├── routes/         # API routes
│   │   │   ├── campaigns.py
│   │   │   ├── auth.py
│   │   │   └── admin.py
│   │   ├── services/       # Business logic
│   │   │   ├── web3_service.py      # Blockchain interactions
│   │   │   ├── auto_disburse.py     # Auto-disburse job
│   │   │   └── email_service.py     # Email sending
│   │   ├── utils/          # Utilities
│   │   │   ├── jwt.py      # JWT token handling
│   │   │   ├── security.py # Password hashing
│   │   │   └── roles.py    # Role definitions
│   │   └── dependencies/   # FastAPI dependencies
│   │       └── auth.py     # Authentication dependencies
│   ├── requirements.txt
│   └── .env
├── Frontend/               # Next.js frontend
│   ├── app/
│   │   ├── page.tsx        # Home page
│   │   ├── login/          # Authentication pages
│   │   ├── register/
│   │   ├── profile/
│   │   ├── reliefs/        # Public campaign pages
│   │   ├── campaigns/      # Campaign detail & donate
│   │   ├── reliefadmin/    # Admin pages
│   │   │   ├── dashboard/
│   │   │   ├── create-campaign/
│   │   │   ├── edit-campaign/
│   │   │   ├── users/
│   │   │   ├── audit-logs/
│   │   │   └── reports/
│   │   └── components/     # React components
│   ├── package.json
│   └── .env.local
├── hardhat.config.js       # Hardhat configuration
├── package.json
└── README.md
```

## Database Schema

### Tables

- **campaign**: Lưu metadata của campaigns
- **donation**: Lưu lịch sử quyên góp (đồng bộ từ blockchain)
- **withdrawlog**: Lưu lịch sử rút tiền (đồng bộ từ blockchain)
- **user**: Thông tin người dùng, xác thực
- **auditlog**: Log tất cả các actions quan trọng
- **passwordresetotp**: OTP codes cho password reset

## Bảo mật

### Backend

- **JWT Authentication**: Tất cả endpoints (trừ public) yêu cầu JWT token
- **Password Hashing**: Sử dụng bcrypt_sha256 (passlib)
- **Role-based Access Control**: Phân quyền Admin/User
- **CORS**: Cấu hình CORS để chỉ cho phép origins được chỉ định
- **Input Validation**: Pydantic schemas validate tất cả inputs
- **SQL Injection Protection**: SQLModel/SQLAlchemy ORM tự động escape

### Smart Contract

- **Access Control**: Chỉ owner có thể rút tiền
- **Reentrancy Protection**: Sử dụng checks-effects-interactions pattern
- **Safe Math**: Solidity 0.8+ tự động kiểm tra overflow/underflow

### Lưu ý

- **Private Keys**: KHÔNG commit private keys vào git. Sử dụng `.env` và thêm vào `.gitignore`
- **Production**: Sử dụng secrets manager (AWS Secrets Manager, HashiCorp Vault) cho production
- **HTTPS**: Luôn sử dụng HTTPS trong production
- **Rate Limiting**: Cân nhắc thêm rate limiting cho các endpoints public

## Troubleshooting

### Backend không khởi động

- Kiểm tra `.env` có đủ các biến: `RPC_URL`, `DISASTER_FUND_ADDRESS`, `PRIVATE_KEY`
- Kiểm tra Python version: `python --version` (cần 3.10+)
- Kiểm tra virtual environment đã activate chưa
- Kiểm tra dependencies: `pip install -r requirements.txt`

### Frontend không kết nối được Backend

- Kiểm tra backend đang chạy tại `http://127.0.0.1:8000`
- Kiểm tra CORS configuration trong `backend/app/config.py`
- Kiểm tra `NEXT_PUBLIC_API_URL` trong `Frontend/.env.local` (nếu có)

### MetaMask không kết nối

- Kiểm tra MetaMask đã cài đặt và unlock
- Kiểm tra network: Sepolia testnet (Chain ID: 11155111) hoặc Localhost (Chain ID: 31337)
- Kiểm tra account có ETH để trả gas fee

### Transaction failed

- Kiểm tra account có đủ ETH để trả gas
- Kiểm tra RPC URL có hoạt động không
- Kiểm tra contract address đúng chưa
- Xem logs trong backend console để biết lỗi chi tiết

### Database migration errors

- Database sẽ tự động migrate khi khởi động backend
- Nếu có lỗi, có thể xóa `backend/dev.db` và tạo lại (mất dữ liệu)
- Hoặc chạy migration thủ công trong `backend/app/database.py`

## Development

### Chạy tests

```bash
# Hardhat tests
npx hardhat test

# Backend tests (nếu có)
cd backend
pytest
```

### Code style

- **Python**: Tuân thủ PEP 8
- **TypeScript**: Sử dụng ESLint và Prettier
- **Solidity**: Tuân thủ Solidity Style Guide

## License

[Thêm license nếu có]

## Contributors

[Thêm danh sách contributors nếu có]

## Liên hệ

[Thêm thông tin liên hệ nếu cần]
