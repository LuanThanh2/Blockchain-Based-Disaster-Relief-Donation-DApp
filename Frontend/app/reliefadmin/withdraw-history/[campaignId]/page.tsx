"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type WithdrawLog = {
  id?: number;
  campaign_id: number;
  onchain_campaign_id?: number | null;
  owner_address: string;
  amount_eth: number;
  amount_wei?: string;
  tx_hash: string;
  block_number?: number;
  timestamp?: string | number;
  created_at?: string;
};

type Campaign = {
  id: number;
  title: string;
  target_amount: number;
  total_raised?: number;
};

export default function WithdrawHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [withdraws, setWithdraws] = useState<WithdrawLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("role");
    
    if (!token || role !== "admin") {
      router.replace("/login");
      return;
    }

    fetchData();
  }, [campaignId, router]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("Not authenticated");
      }

      // Fetch campaign info with stats
      const campaignRes = await fetch(`${API_URL}/api/v1/campaigns/${campaignId}/stats`);
      if (campaignRes.ok) {
        const campaignData = await campaignRes.json();
        setCampaign({
          id: campaignData.id,
          title: campaignData.title,
          target_amount: campaignData.target_amount,
          total_raised: campaignData.total_raised || 0,
        });
      } else {
        // Fallback to basic campaign info
        const basicRes = await fetch(`${API_URL}/api/v1/campaigns/${campaignId}`);
        if (basicRes.ok) {
          const basicData = await basicRes.json();
          setCampaign({
            id: basicData.id,
            title: basicData.title,
            target_amount: basicData.target_amount,
            total_raised: 0,
          });
        }
      }

      // Fetch withdraw history
      const res = await fetch(`${API_URL}/api/v1/campaigns/${campaignId}/withdraws`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Bạn không có quyền truy cập trang này");
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setWithdraws(data);
    } catch (err: any) {
      console.error("Failed to fetch withdraw history:", err);
      setError(err.message || "Không thể tải lịch sử rút tiền");
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string | number | undefined): string => {
    if (!timestamp) return "N/A";
    try {
      const date = typeof timestamp === 'string' 
        ? new Date(timestamp)
        : new Date(timestamp * 1000);
      return new Intl.DateTimeFormat("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date);
    } catch {
      return "N/A";
    }
  };

  const formatETH = (amount: number): string => {
    return `${amount.toFixed(4)} ETH`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
            <p className="mt-4 text-gray-600">Đang tải lịch sử rút tiền...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/reliefadmin/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition mb-4"
          >
            <span>←</span>
            <span>Về Dashboard</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">📜 Lịch sử rút tiền</h1>
          {campaign && (
            <p className="mt-2 text-gray-600">
              Campaign: <span className="font-semibold">{campaign.title}</span> (ID: {campaign.id})
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Stats */}
        {campaign && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Mục tiêu</p>
              <p className="text-2xl font-bold text-gray-900">{formatETH(campaign.target_amount)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Đã quyên góp</p>
              <p className="text-2xl font-bold text-purple-600">{formatETH(campaign.total_raised || 0)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Tổng đã rút</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatETH(withdraws.reduce((sum, w) => sum + (w.amount_eth || 0), 0))}
              </p>
            </div>
          </div>
        )}

        {/* Withdraw History Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              Danh sách giao dịch rút tiền ({withdraws.length})
            </h2>
          </div>

          {withdraws.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💸</div>
              <p className="text-gray-500 text-lg mb-2">Chưa có giao dịch rút tiền nào</p>
              <p className="text-gray-400 text-sm">
                Các giao dịch rút tiền sẽ hiển thị ở đây
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Số tiền
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Người rút
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thời gian
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction Hash
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {withdraws.map((withdraw, index) => (
                    <tr key={withdraw.id || index} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-blue-600">
                          {formatETH(withdraw.amount_eth)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900 font-mono">
                          {withdraw.owner_address.slice(0, 10)}...{withdraw.owner_address.slice(-8)}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTimestamp(withdraw.timestamp || withdraw.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {withdraw.tx_hash ? (
                          <p className="text-xs text-gray-500 font-mono">
                            {withdraw.tx_hash.slice(0, 10)}...{withdraw.tx_hash.slice(-8)}
                          </p>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {withdraw.tx_hash && (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${withdraw.tx_hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Xem trên Etherscan →
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

