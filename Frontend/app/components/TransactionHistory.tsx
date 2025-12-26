"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const ETHERSCAN_BASE = "https://sepolia.etherscan.io/tx";

type Donation = {
  id: number;
  donor_address: string;
  amount_eth: number;
  tx_hash: string;
  timestamp: string;
};

type TransactionHistoryProps = {
  campaignId: number;
};

export default function TransactionHistory({ campaignId }: TransactionHistoryProps) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDonations();
  }, [campaignId]);

  const fetchDonations = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/campaigns/${campaignId}/donations`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setDonations(data);
    } catch (err) {
      console.error("Failed to fetch donations:", err);
      setError("Không thể tải lịch sử giao dịch");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
        <p className="mt-2 text-sm text-gray-600">Đang tải lịch sử giao dịch...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    );
  }

  if (donations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Chưa có giao dịch nào</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Lịch sử giao dịch ({donations.length})
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Tất cả các giao dịch đều được ghi nhận trên blockchain và có thể kiểm tra công khai
        </p>
      </div>
      <div className="divide-y divide-gray-200">
        {donations.map((donation) => (
          <div key={donation.id} className="px-6 py-4 hover:bg-gray-50 transition">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {donation.amount_eth.toFixed(4)} ETH
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(donation.timestamp).toLocaleString("vi-VN")}
                  </span>
                </div>
                <p className="text-xs text-gray-600 font-mono">
                  Từ: {donation.donor_address.slice(0, 10)}...{donation.donor_address.slice(-8)}
                </p>
              </div>
              <div className="ml-4">
                <a
                  href={`${ETHERSCAN_BASE}/${donation.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                >
                  <span>🔗</span>
                  Etherscan
                </a>
                <p className="text-xs text-gray-500 mt-1 font-mono text-center">
                  {donation.tx_hash.slice(0, 10)}...
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}




