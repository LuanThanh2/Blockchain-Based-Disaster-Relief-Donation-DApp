# Blockchain-Based Disaster Relief Donation DApp

Đề tài xây dựng một DApp quyên góp cứu trợ thiên tai theo hướng **minh bạch và dễ kiểm chứng**: mọi giao dịch quyên góp/giải ngân được ghi nhận on-chain, giảm phụ thuộc vào niềm tin vào một bên trung gian.

## Mục tiêu

- Minh bạch hoá quyên góp: số tiền vào/ra và lịch sử giao dịch có thể kiểm tra công khai.
- Chuẩn hoá quy trình gây quỹ: tạo chiến dịch (campaign), nhận donate, theo dõi tiến độ, giải ngân.
- Cung cấp API backend để tích hợp với UI/ứng dụng khác.

## Kiến trúc

- Smart contract (Solidity): `contracts/DisasterFund.sol` (logic campaign/donate/withdraw).
- Backend API (Python): `backend/` (FastAPI + web3.py) gọi contract qua RPC.
- Hardhat (Node.js): cung cấp lệnh `compile`, `test`, và chạy script deploy/kiểm tra trong thư mục `scripts/`.

## Hardhat scripts đang có

Các file trong `scripts/` là các script chạy bằng Hardhat 

- `scripts/deploy_disaster_fund.js`: deploy contract `DisasterFund`.
- `scripts/check_deployer_balance.js`: in địa chỉ deployer + số dư ETH.
- `scripts/print_address_from_pk.js`: in địa chỉ từ private key.
- `scripts/inspect_account.js`: kiểm tra account (balance/nonce/code) để biết EOA hay contract.

## Chức năng chính

- Tạo campaign với mục tiêu gây quỹ.
- Quyên góp ETH cho campaign (on-chain).
- Rút/giải ngân theo logic contract (on-chain).
- Truy vấn thông tin campaign để hiển thị tiến độ.

## Setup & Run (Windows)

### 1) Hardhat

```cmd
cd /d E:\Disaster_Relief_Dapp
npm install
npx hardhat compile
```

Deploy lên Sepolia:

```cmd
cd /d E:\Disaster_Relief_Dapp
npx hardhat run scripts\deploy_disaster_fund.js --network sepolia
```

Sau khi deploy, copy địa chỉ in ra và cập nhật `DISASTER_FUND_ADDRESS` trong `.env`.

### 2) Backend (FastAPI)

```cmd
cd /d E:\Disaster_Relief_Dapp\backend
python -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
```

Chạy API:

```cmd
cd /d E:\Disaster_Relief_Dapp
call backend\.venv\Scripts\activate.bat
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Test nhanh:

```cmd
curl http://127.0.0.1:8000/health
```

🛠️ Một số việc cần làm

Tạo chiến dịch gây quỹ (Campaign)
Tạo campaign với tiêu đề, mô tả, mục tiêu gây quỹ (goal), thời hạn và trạng thái hoạt động.

Nhận quyên góp (Donate)
Người dùng gửi ETH vào campaign; giao dịch được ghi nhận on-chain và tự động cập nhật tổng số tiền quyên góp.

Theo dõi & hiển thị tiến độ
Xem số tiền đã nhận, số lượng người quyên góp và lịch sử các giao dịch donate.

Giải ngân / rút tiền (Withdraw)
Người quản lý campaign rút tiền theo rule của smart contract (rút toàn bộ hoặc từng phần); mọi giao dịch đều được ghi nhận on-chain.

Quản lý campaign
Bật/tắt campaign, cập nhật thông tin (nếu được cho phép) và đóng campaign khi hoàn thành.

Báo cáo & minh bạch
Xuất danh sách giao dịch, tổng thu/chi theo từng campaign và theo dõi log sự kiện (events) từ smart contract.