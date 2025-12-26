"use client";

import { useState } from "react";

interface DonateCardProps {
  walletAddress: string | null;
  isConnecting: boolean;
  wrongNetwork: boolean;
  amount: string;
  loading: boolean;
  success: boolean;
  error: string | null;
  txHash: string | null;
  onConnectWallet: () => void;
  onSwitchNetwork: () => void;
  onAmountChange: (amount: string) => void;
  onDonate: () => void;
  onViewCampaign?: () => void;
}

export default function DonateCard({
  walletAddress,
  isConnecting,
  wrongNetwork,
  amount,
  loading,
  success,
  error,
  txHash,
  onConnectWallet,
  onSwitchNetwork,
  onAmountChange,
  onDonate,
  onViewCampaign,
}: DonateCardProps) {
  const presetAmounts = ["0.1", "0.5", "1.0", "2.0"];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6 sticky top-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
        <span>💝</span>
        <span>Quyên góp</span>
      </h2>

      {/* Wallet Connection */}
      {!walletAddress ? (
        <button
          onClick={onConnectWallet}
          disabled={isConnecting}
          className="mb-5 w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-400 transition"
        >
          {isConnecting ? "Đang kết nối ví..." : "🦊 Kết nối MetaMask"}
        </button>
      ) : (
        <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                Ví đã kết nối
              </p>
              <p className="font-mono text-xs font-semibold text-gray-900">
                {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
              </p>
            </div>
            {wrongNetwork && (
              <button
                onClick={onSwitchNetwork}
                className="ml-3 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-600 transition"
              >
                Chuyển Sepolia
              </button>
            )}
          </div>
        </div>
      )}

      {/* Preset Amounts */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 mb-2">
          Chọn nhanh số tiền
        </p>
        <div className="grid grid-cols-4 gap-2">
          {presetAmounts.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => onAmountChange(val)}
              disabled={!walletAddress || wrongNetwork}
              className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                amount === val
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {val} ETH
            </button>
          ))}
        </div>
      </div>

      {/* Custom Amount */}
      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Hoặc nhập số tiền tùy chỉnh
        </label>
        <div className="relative mt-1">
          <input
            type="number"
            step="0.001"
            min="0"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.0"
            disabled={!walletAddress || wrongNetwork}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:cursor-not-allowed"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-gray-500">
            ETH
          </span>
        </div>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          ❌ {error}
        </div>
      )}

      {success && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          ✅ Quyên góp thành công!{" "}
          {txHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="ml-1 font-semibold text-emerald-800 underline"
            >
              Xem trên Etherscan
            </a>
          )}
        </div>
      )}

      {/* Donate Button */}
      <button
        onClick={onDonate}
        disabled={loading || success || !walletAddress || wrongNetwork}
        className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300 transition"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
            Đang xử lý giao dịch...
          </span>
        ) : (
          "💝 Quyên góp ngay"
        )}
      </button>

      {success && onViewCampaign && (
        <button
          type="button"
          onClick={onViewCampaign}
          className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 transition"
        >
          Xem chi tiết campaign
        </button>
      )}

      {/* Info */}
      <p className="mt-4 text-[11px] text-gray-500 leading-relaxed">
        Giao dịch được gửi trực tiếp từ ví của bạn tới smart contract. Nền tảng
        không giữ tiền hộ và bạn luôn có thể kiểm tra lại trên Etherscan.
      </p>
    </div>
  );
}




