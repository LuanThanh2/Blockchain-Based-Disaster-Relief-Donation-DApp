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

> Gợi ý: mở **4 terminal** (Hardhat / Deploy / Backend / Frontend) để chạy mượt.

### Yêu cầu trước khi chạy

- Node.js (khuyến nghị LTS) + npm
- Python 3.10+ (để chạy FastAPI)

Thư mục quan trọng:

- Hardhat + scripts: `E:\Disaster_Relief_Dapp\` (root)
- Backend (FastAPI): `E:\Disaster_Relief_Dapp\backend\`
- Frontend (Next.js): `E:\Disaster_Relief_Dapp\Frontend\`

---

## Cách 1: Chạy LOCAL (khuyến nghị để dev/test nhanh)

### Bước 0 — Cài dependencies (chạy 1 lần)

```cmd
cd /d E:\Disaster_Relief_Dapp
npm install

cd /d E:\Disaster_Relief_Dapp\Frontend
npm install
```

- `npm install`: tải thư viện Node theo `package.json`.

### Bước 1 — Terminal A: chạy blockchain local (Hardhat)

```cmd
cd /d E:\Disaster_Relief_Dapp
npx hardhat node
```

- `npx hardhat node`: bật một blockchain giả lập trên máy (thường RPC `http://127.0.0.1:8545`) + tạo sẵn nhiều account có ETH để test.
- **Giữ terminal này chạy** trong suốt quá trình dev.

### Bước 2 — Terminal B: compile + deploy contract lên local chain

```cmd
cd /d E:\Disaster_Relief_Dapp
npx hardhat compile
npx hardhat run scripts\deploy_disaster_fund.js --network localhost
```

- `npx hardhat compile`: biên dịch Solidity → ABI/bytecode.
- `npx hardhat run ... --network localhost`: deploy contract lên Hardhat node.

Sau khi deploy, bạn sẽ thấy **địa chỉ contract** in ra. Copy lại để điền vào backend `.env`.

### Bước 3 — Cấu hình backend `.env` (LOCAL)

Tạo file `E:\Disaster_Relief_Dapp\backend\.env` (nếu chưa có) với tối thiểu:

```dotenv
CHAIN_ID=31337
RPC_URL=http://127.0.0.1:8545

# Lấy PRIVATE_KEY từ Terminal A (hardhat node) — account có sẵn ETH
PRIVATE_KEY=0x...

# Dán địa chỉ contract sau khi deploy ở Bước 2
DISASTER_FUND_ADDRESS=0x...
```

### Bước 4 — Terminal C: chạy Backend (FastAPI)

Tạo venv + cài requirements (chạy 1 lần):

```cmd
cd /d E:\Disaster_Relief_Dapp\backend
python -m venv .venv
call .venv\Scripts\activate.bat
pip install -r requirements.txt
```

Chạy API:

```cmd
cd /d E:\Disaster_Relief_Dapp\backend
call .venv\Scripts\activate.bat
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

- `python -m venv .venv`: tạo môi trường Python riêng cho backend.
- `pip install -r requirements.txt`: cài FastAPI/web3/uvicorn...
- `uvicorn main:app --reload`: chạy API tại `http://127.0.0.1:8000` và tự reload khi sửa code.

Test nhanh:

```cmd
curl http://127.0.0.1:8000/health
```

### Bước 5 — Terminal D: chạy Frontend (Next.js)

```cmd
cd /d E:\Disaster_Relief_Dapp\Frontend
npm run dev
```

- `npm run dev`: chạy Next.js dev server tại `http://localhost:3000`.

Mở UI:

- Trang tạo campaign: `http://localhost:3000/reliefadmin/create-campaign`

---

## Cách 2: Deploy & chạy trên SEPOLIA (testnet)

### Bước 0 — Cài dependencies (chạy 1 lần)

```cmd
cd /d E:\Disaster_Relief_Dapp
npm install
```

### Bước 1 — Cấu hình `.env` cho Hardhat (SEPOLIA)

Tạo/điền `E:\Disaster_Relief_Dapp\.env` (Hardhat sẽ tự load cả `.env` root và `backend\.env`):

```dotenv
SEPOLIA_RPC_URL=https://...
DEPLOYER_PRIVATE_KEY=0x...

# (tuỳ chọn) để Hardhat kiểm tra PK có khớp địa chỉ mong muốn
EXPECTED_DEPLOYER_ADDRESS=0x...
```

### Bước 2 — Compile + deploy lên Sepolia

```cmd
cd /d E:\Disaster_Relief_Dapp
npx hardhat compile
npx hardhat run scripts\deploy_disaster_fund.js --network sepolia
```

### Bước 3 — Cấu hình backend `.env` trỏ Sepolia

Sửa `E:\Disaster_Relief_Dapp\backend\.env`:

```dotenv
CHAIN_ID=11155111
RPC_URL=https://...
PRIVATE_KEY=0x...
DISASTER_FUND_ADDRESS=0x...   # địa chỉ contract Sepolia vừa deploy
```

### Bước 4 — Chạy Backend + Frontend

Backend:

```cmd
cd /d E:\Disaster_Relief_Dapp\backend
call .venv\Scripts\activate.bat
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Frontend:

```cmd
cd /d E:\Disaster_Relief_Dapp\Frontend
npm run dev
```

---

## Lệnh/script hữu ích

```cmd
cd /d E:\Disaster_Relief_Dapp

:: In địa chỉ deployer + số dư
npx hardhat run scripts\check_deployer_balance.js --network sepolia

:: In địa chỉ từ private key
npx hardhat run scripts\print_address_from_pk.js --network sepolia

:: Kiểm tra account (balance/nonce/code)
npx hardhat run scripts\inspect_account.js --network sepolia
```

---

## Troubleshooting nhanh

- Nếu mở `http://localhost:3000` bị `ERR_CONNECTION_REFUSED`: frontend chưa chạy → chạy `npm run dev` trong `Frontend`.
- Nếu backend báo thiếu biến môi trường: kiểm tra `backend\.env` có đủ `RPC_URL`, `PRIVATE_KEY`, `DISASTER_FUND_ADDRESS`.
- Nếu frontend gặp lỗi storage (`localStorage...`): project đã có `Frontend\instrumentation.ts` để tránh crash trong dev.

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


## Trạng thái hiện tại (tóm tắt ngắn — một dòng / chức năng)

- **Create campaign**: Hoàn thành — frontend form + backend lưu metadata + backend gửi on‑chain trong background. (Files: `Frontend/app/reliefadmin/create-campaign/page.tsx`, `backend/app/routes/campaigns.py`, `backend/app/services/web3_service.py`, `abi/DisasterFund.json`)
- **Donate**: Chưa có UI/API trong `E:\Disaster_Relief_Dapp` (smart contract đã hỗ trợ `donate`).
- **Track & display**: Một phần — DB lưu metadata và backend cố parse `CampaignCreated` để lấy `onchain_id`, nhưng thiếu API + frontend pages để hiển thị `raised` / donors / lịch sử donate.
- **Withdraw**: Smart contract hỗ trợ `withdraw` — UI/API chưa triển khai.
- **Manage campaign**: DB có trường `status` (cơ sở cho bật/tắt) — thiếu endpoint & UI để bật/tắt hoặc cập nhật campaign.
- **Reports & events**: Chưa có indexer/endpoint để lưu và tổng hợp `DonationReceived`/`FundsWithdrawn` events.

## Công việc ưu tiên (gợi ý thứ tự để chuyển giao)

1. **Thêm Donate UI (ưu tiên cao)**
	- Tạo `Frontend/app/user/donate/page.tsx` sử dụng MetaMask/ethers.js để user ký và gửi ETH tới hàm `donate(campaignId)` của contract.
2. **Thêm campaign list/detail pages**
	- Tạo `Frontend/app/reliefs/page.tsx` và `Frontend/app/reliefs/[slug]/page.tsx` để hiển thị tiến độ, link donate.
3. **Triển khai endpoint/ indexer cho donations**
	- Thêm endpoint backend để trả `raised`, `donor_count`, `donations` hoặc triển khai indexer đọc `DonationReceived` events và lưu vào DB.
4. **Rút tiền (withdraw) & admin controls**
	- Thêm endpoint/ UI admin để gọi `withdraw` (server‑signed hoặc client‑signed) và controls bật/tắt campaign.
5. **Báo cáo & export**
	- Sau khi có bảng `donations`, thêm endpoint xuất CSV/JSON cho báo cáo.

## Checklist chuyển giao (cho người tiếp nhận)

- [ ] Kiểm tra `.env` cho backend: `RPC_URL`, `DISASTER_FUND_ADDRESS`, `DEPLOYER_PRIVATE_KEY`, `DATABASE_URL`.
- [ ] Khởi động Hardhat node (local) hoặc xác nhận RPC Sepolia + contract address.
- [ ] Chạy backend (uvicorn) và frontend (Next.js) theo hướng dẫn phía trên.
- [ ] Tạo campaign từ UI → kiểm tra `POST /api/v1/campaigns/` trả 201 và DB có record mới.
- [ ] Nếu bật `createOnChain`, kiểm tra log backend (uvicorn) để thấy BG task gửi tx và cập nhật `contract_tx_hash` / `onchain_id`.
- [ ] Nếu cần donate testing: triển khai donate UI (task ưu tiên 1) hoặc test thủ công bằng scripts/hardhat.

## Kiểm thử nhanh (test plan ngắn)

1. Chạy Hardhat node hoặc sử dụng Sepolia RPC.
2. Deploy contract (local) hoặc dùng địa chỉ Sepolia đã deploy.
3. Cấu hình `backend/.env` với `DISASTER_FUND_ADDRESS` và `DEPLOYER_PRIVATE_KEY` (dev only).
4. Chạy backend và frontend.
5. Tạo campaign từ UI → quan sát network request và backend logs.
6. (Nếu on‑chain) mở Etherscan Sepolia hoặc Hardhat console để kiểm tra transaction receipt và event `CampaignCreated`.

## Ghi chú an toàn

- `DEPLOYER_PRIVATE_KEY` chỉ dùng cho môi trường phát triển; KHÔNG commit vào git. Dùng vault/KMS cho production.
- On‑chain actions tiêu tốn gas — đảm bảo private key có ETH trên testnet khi chạy.

