"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const ETHERSCAN_BASE = "https://sepolia.etherscan.io/tx";

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string }) => Promise<string[]>;
    };
  }
}

type Donation = {
  id: number;
  campaign_id: number;
  donor_address: string;
  amount_eth: number;
  tx_hash: string;
  timestamp: string;
};

type Campaign = {
  id: number;
  title: string;
};

export default function MyDonationsPage() {
  const router = useRouter();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [campaigns, setCampaigns] = useState<Record<number, Campaign>>({});
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [manualAddress, setManualAddress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    // Chỉ lấy wallet address từ profile của user (KHÔNG tự động lấy từ localStorage hoặc MetaMask)
    const checkWallet = async () => {
      try {
        // Chỉ lấy từ profile API - nếu user chưa liên kết ví trong profile thì không hiển thị gì cả
        const profileRes = await fetch(`${API_BASE}/api/v1/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile.wallet_address) {
            // User đã liên kết ví trong profile - hiển thị lịch sử
            setWalletAddress(profile.wallet_address);
            setManualAddress(profile.wallet_address);
            await fetchDonations(profile.wallet_address);
            return;
          } else {
            // User chưa có ví trong profile - xóa localStorage cũ (nếu có) để tránh nhầm lẫn
            localStorage.removeItem("donor_wallet_address");
          }
        }

        // Nếu không có ví trong profile → hiển thị form nhập/kết nối ví
        setShowManualInput(true);
        setLoading(false);
      } catch (err) {
        console.error("Error checking wallet:", err);
        // Nếu có lỗi khi fetch profile, hiển thị form nhập thủ công
        setShowManualInput(true);
        setLoading(false);
      }
    };

    checkWallet();
  }, [router]);

  const fetchDonations = async (donorAddress: string) => {
    if (!donorAddress || !donorAddress.trim()) {
      setError("Vui lòng nhập địa chỉ ví");
      setLoading(false);
      return;
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(donorAddress.trim())) {
      setError("Địa chỉ ví không hợp lệ (phải là địa chỉ Ethereum 0x...)");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("access_token");
      const normalizedAddress = donorAddress.trim();
      
      console.log("[Donations] Fetching donations for address:", normalizedAddress);
      
      const res = await fetch(
        `${API_BASE}/api/v1/campaigns/my-donations?donor_address=${encodeURIComponent(normalizedAddress)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("[Donations] Response status:", res.status);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        console.error("[Donations] Error response:", errorData);
        console.error("[Donations] Error detail:", JSON.stringify(errorData, null, 2));
        
        // Handle validation errors
        let errorMessage = `HTTP ${res.status}`;
        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            errorMessage = errorData.detail.map((e: any) => e.msg || e.loc?.join('.') || JSON.stringify(e)).join(', ');
          } else if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else {
            errorMessage = JSON.stringify(errorData.detail);
          }
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      console.log("[Donations] Received donations:", data);
      setDonations(data);

      // Fetch campaign details for each donation
      const campaignIds = [...new Set(data.map((d: Donation) => d.campaign_id))];
      const campaignMap: Record<number, Campaign> = {};
      
      for (const id of campaignIds) {
        try {
          const campaignRes = await fetch(`${API_BASE}/api/v1/campaigns/${id}`);
          if (campaignRes.ok) {
            campaignMap[id] = await campaignRes.json();
          }
        } catch (err) {
          console.error(`Failed to fetch campaign ${id}:`, err);
        }
      }
      
      setCampaigns(campaignMap);
    } catch (err) {
      console.error("Failed to fetch donations:", err);
      setError("Không thể tải lịch sử quyên góp");
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("Vui lòng cài đặt MetaMask!");
      setShowManualInput(true);
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const address = accounts[0].toLowerCase();
      
      // Lưu vào profile của user (backend)
      const token = localStorage.getItem("access_token");
      const saveRes = await fetch(`${API_BASE}/api/v1/auth/me/wallet`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ wallet_address: address }),
      });

      if (!saveRes.ok) {
        const errorData = await saveRes.json().catch(() => ({ detail: "Không thể lưu địa chỉ ví" }));
        throw new Error(errorData.detail || "Không thể lưu địa chỉ ví vào profile");
      }

      // Lưu thành công vào profile - refresh để lấy từ profile
      const profileRes = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (profileRes.ok) {
        const profile = await profileRes.json();
        setWalletAddress(profile.wallet_address);
        setManualAddress(profile.wallet_address);
        await fetchDonations(profile.wallet_address);
      } else {
        setWalletAddress(address);
        setManualAddress(address);
        await fetchDonations(address);
      }
    } catch (err: any) {
      console.error("Error connecting wallet:", err);
      setError(err?.message || "Không thể kết nối ví");
      setShowManualInput(true);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = manualAddress.trim().toLowerCase();
    if (!address) {
      setError("Vui lòng nhập địa chỉ ví");
      return;
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setError("Địa chỉ ví không hợp lệ (phải là địa chỉ Ethereum 0x...)");
      return;
    }
    
    // Lưu vào profile của user (backend)
    const token = localStorage.getItem("access_token");
    try {
      const saveRes = await fetch(`${API_BASE}/api/v1/auth/me/wallet`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ wallet_address: address }),
      });

      if (!saveRes.ok) {
        const errorData = await saveRes.json().catch(() => ({ detail: "Không thể lưu địa chỉ ví" }));
        throw new Error(errorData.detail || "Không thể lưu địa chỉ ví vào profile");
      }

      // Lưu thành công vào profile - refresh để lấy từ profile
      const profileRes = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (profileRes.ok) {
        const profile = await profileRes.json();
        setWalletAddress(profile.wallet_address);
        setManualAddress(profile.wallet_address);
        await fetchDonations(profile.wallet_address);
      } else {
        setWalletAddress(address);
        await fetchDonations(address);
      }
    } catch (err: any) {
      console.error("Error saving wallet:", err);
      setError(err.message || "Không thể lưu địa chỉ ví");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
          <p className="mt-4 text-gray-600">Đang tải lịch sử quyên góp...</p>
        </div>
      </div>
    );
  }

  if (showManualInput && !walletAddress) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
          <div className="text-6xl mb-4 text-center">🔍</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Nhập địa chỉ ví</h2>
          <p className="text-gray-600 mb-6 text-center">
            Để xem lịch sử quyên góp, vui lòng nhập địa chỉ ví Ethereum của bạn hoặc kết nối MetaMask.
          </p>
          
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Địa chỉ ví (0x...)
              </label>
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                Xem lịch sử
              </button>
              {typeof window !== "undefined" && window.ethereum && (
                <button
                  type="button"
                  onClick={connectWallet}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Kết nối MetaMask
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Lịch sử quyên góp của tôi</h1>
            <Link
              href="/reliefs"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              ← Về Campaigns
            </Link>
          </div>
          {walletAddress && (
            <p className="text-sm text-gray-600">
              Địa chỉ ví: <span className="font-mono">{walletAddress}</span>
            </p>
          )}
        </div>

        {/* Donations List */}
        {donations.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Chưa có quyên góp nào</h3>
            <p className="text-gray-600 mb-6">
              Bạn chưa thực hiện quyên góp nào. Hãy tham gia các chiến dịch cứu trợ!
            </p>
            <Link
              href="/reliefs"
              className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              Xem Campaigns
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {donations.map((donation) => {
              const campaign = campaigns[donation.campaign_id];
              return (
                <div
                  key={donation.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {campaign?.title || `Campaign #${donation.campaign_id}`}
                        </h3>
                        {campaign && (
                          <Link
                            href={`/reliefs/${donation.campaign_id}`}
                            className="text-sm text-emerald-600 hover:text-emerald-700"
                          >
                            Xem chi tiết →
                          </Link>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <p className="text-sm text-gray-600">Số tiền</p>
                          <p className="text-xl font-bold text-emerald-600">
                            {donation.amount_eth.toFixed(4)} ETH
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Thời gian</p>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(donation.timestamp).toLocaleString("vi-VN")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="ml-6">
                      <a
                        href={`${ETHERSCAN_BASE}/${donation.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                      >
                        <span>🔗</span>
                        Xem trên Etherscan
                      </a>
                      <p className="text-xs text-gray-500 mt-2 font-mono">
                        {donation.tx_hash.slice(0, 10)}...{donation.tx_hash.slice(-8)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && walletAddress && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

