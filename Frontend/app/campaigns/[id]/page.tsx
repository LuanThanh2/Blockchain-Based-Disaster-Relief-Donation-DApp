"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ProgressBar from "../../components/ProgressBar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

declare global {
  interface Window {
    ethereum?: any;
  }
}

type Donation = {
  id: number;
  donor_address: string;
  amount_eth: number;
  tx_hash: string;
  timestamp: string;
};

type CampaignStats = {
  id: number;
  title: string;
  short_desc: string;
  description: string;
  image_url: string;
  target_amount: number;
  total_raised: number;
  donor_count: number;
  donation_count: number;
  onchain_id: number;
  status: string;
  recent_donations: Donation[];
};

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);

  const fetchCampaignStats = async () => {
    try {
      // Try /stats endpoint first
      let res = await fetch(`${API_URL}/api/v1/campaigns/${campaignId}/stats`);
      if (res.ok) {
        const data = await res.json();
        setCampaign(data);
        setLoading(false);
        return;
      }
      
      // Fallback: fetch basic campaign and donations separately
      res = await fetch(`${API_URL}/api/v1/campaigns/${campaignId}`);
      if (res.ok) {
        const campaignData = await res.json();
        
        // Fetch donations
        try {
          const donationsRes = await fetch(`${API_URL}/api/v1/campaigns/${campaignId}/donations`);
          const donations = donationsRes.ok ? await donationsRes.json() : [];
          
          const total_raised = donations.reduce((sum: number, d: any) => sum + (d.amount_eth || 0), 0);
          const donor_count = new Set(donations.map((d: any) => d.donor_address)).size;
          
          setCampaign({
            ...campaignData,
            total_raised: total_raised || 0,
            donor_count: donor_count || 0,
            donation_count: donations.length || 0,
            recent_donations: donations.slice(0, 5) || [],
          });
        } catch {
          setCampaign({
            ...campaignData,
            total_raised: 0,
            donor_count: 0,
            donation_count: 0,
            recent_donations: [],
          });
        }
      }
    } catch (error) {
      console.error("Error fetching campaign:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncDonations = async () => {
    setSyncing(true);
    try {
      await fetch(`${API_URL}/api/v1/campaigns/${campaignId}/sync-donations`, {
        method: "POST",
      });
      await new Promise(r => setTimeout(r, 3000));
      await fetchCampaignStats();
    } catch (error) {
      console.error("Error syncing donations:", error);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchCampaignStats();
    const interval = setInterval(fetchCampaignStats, 30000);
    return () => clearInterval(interval);
  }, [campaignId]);

  // Check existing wallet connection
  useEffect(() => {
    const checkWallet = async () => {
      if (typeof window === "undefined" || typeof window.ethereum === "undefined") return;
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          await checkNetwork();
        }
      } catch (err) {
        console.error("Error checking wallet:", err);
      }
    };
    checkWallet();
  }, []);

  // Listen for account / chain changes
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.ethereum === "undefined") return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        checkNetwork();
      } else {
        setWalletAddress(null);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (!window.ethereum) return;
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  const checkNetwork = async () => {
    if (typeof window === "undefined" || typeof window.ethereum === "undefined") return;
    try {
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      setWrongNetwork(chainId !== "0xaa36a7"); // Sepolia
    } catch (err) {
      console.error("Error checking network:", err);
    }
  };

  const connectWallet = async () => {
    if (typeof window === "undefined" || typeof window.ethereum === "undefined") {
      alert("Vui lòng cài đặt MetaMask!");
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWalletAddress(accounts[0]);
      await checkNetwork();
    } catch (err: any) {
      console.error("Error connecting wallet:", err);
      alert(err?.message || "Không thể kết nối ví");
    } finally {
      setIsConnecting(false);
    }
  };

  const switchToSepolia = async () => {
    if (typeof window === "undefined" || typeof window.ethereum === "undefined") return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
    } catch (err: any) {
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xaa36a7",
                chainName: "Sepolia Testnet",
                rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
                nativeCurrency: {
                  name: "ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
        } catch (addErr) {
          console.error("Error adding Sepolia:", addErr);
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
          <p className="mt-4 text-gray-600">Đang tải thông tin chiến dịch...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-2xl font-bold text-gray-900 mb-2">Không tìm thấy campaign</p>
          <p className="text-gray-600 mb-6">Campaign này có thể đã bị xóa hoặc không tồn tại.</p>
          <button
            onClick={() => router.push("/reliefadmin/dashboard")}
            className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 shadow-sm transition"
          >
            Về Dashboard
          </button>
        </div>
      </div>
    );
  }

  const progressPercent = Math.min((campaign.total_raised / campaign.target_amount) * 100, 100);
  const remaining = Math.max(campaign.target_amount - campaign.total_raised, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <span>←</span> Quay lại
          </button>
          
          <div className="flex items-center gap-3">
            {/* Wallet Connection Button */}
            {!walletAddress ? (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50 transition text-sm font-medium"
              >
                {isConnecting ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                    Đang kết nối...
                  </>
                ) : (
                  <>🦊 Kết nối MetaMask</>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                <span className="text-gray-600">Ví:</span>
                <span className="font-mono font-semibold text-gray-900">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
                {wrongNetwork && (
                  <button
                    onClick={switchToSepolia}
                    className="ml-2 px-2 py-1 bg-amber-500 text-white rounded text-xs font-semibold hover:bg-amber-600"
                  >
                    Chuyển Sepolia
                  </button>
                )}
                <button
                  onClick={() => {
                    setWalletAddress(null);
                    setWrongNetwork(false);
                  }}
                  className="ml-2 px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-semibold hover:bg-gray-300"
                  title="Ngắt kết nối ví"
                >
                  ✕
                </button>
              </div>
            )}
            
                  <button
                    onClick={syncDonations}
                    disabled={syncing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium"
                  >
                    {syncing ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                        Đang đồng bộ...
                      </>
                    ) : (
                      <>🔄 Đồng bộ Donations</>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      window.open(`${API_URL}/api/v1/campaigns/${campaignId}/donations/export?format=csv`, '_blank');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                    title="Xuất donations ra CSV"
                  >
                    📊 Export CSV
                  </button>
                  
                  <button
                    onClick={() => {
                      window.open(`${API_URL}/api/v1/campaigns/${campaignId}/donations/export?format=json`, '_blank');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
                    title="Xuất donations ra JSON"
                  >
                    📄 Export JSON
                  </button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Campaign Image */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {campaign.image_url ? (
                <img
                  src={campaign.image_url}
                  alt={campaign.title}
                  className="w-full h-64 object-cover"
                />
              ) : (
                <div className="w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <span className="text-6xl">🌍</span>
                </div>
              )}
            </div>

            {/* Campaign Info */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                {campaign.title}
              </h1>
              
              {campaign.short_desc && (
                <p className="text-lg text-gray-600 mb-6">
                  {campaign.short_desc}
                </p>
              )}
              
              {campaign.description && (
                <div className="prose prose-slate max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {campaign.description}
                  </p>
                </div>
              )}
            </div>

            {/* Recent Donations */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <span>💝</span> Donations gần đây
                </h2>
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                  {campaign.recent_donations.length}
                </span>
              </div>
              
              {campaign.recent_donations.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">💔</div>
                  <p className="text-gray-600 text-lg">Chưa có donations nào</p>
                  <p className="text-gray-500 text-sm mt-2">Hãy là người đầu tiên quyên góp!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaign.recent_donations.map((donation) => (
                    <div
                      key={donation.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-gray-100 bg-gray-50 hover:bg-gray-100 transition"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                          {donation.donor_address.slice(2, 4).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="font-mono font-semibold text-gray-900 text-sm">
                            {donation.donor_address.slice(0, 8)}...{donation.donor_address.slice(-6)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(donation.timestamp).toLocaleString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-bold text-lg text-emerald-600 mb-1">
                          +{donation.amount_eth.toFixed(4)} ETH
                        </p>
                        <a
                          href={`https://sepolia.etherscan.io/tx/${
                            donation.tx_hash?.startsWith("0x")
                              ? donation.tx_hash
                              : `0x${donation.tx_hash || ""}`
                          }`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 justify-end"
                        >
                          <span>Etherscan</span>
                          <span>→</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Sidebar Stats */}
          <div className="space-y-6">
            
            {/* Progress Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4 uppercase tracking-wider">
                Tiến độ gây quỹ
              </h3>
              
              <div className="mb-6">
                <div className="flex items-baseline justify-between mb-4">
                  <span className="text-3xl font-bold text-gray-900">
                    {campaign.total_raised.toFixed(2)}
                  </span>
                  <span className="text-lg text-gray-600">
                    / {campaign.target_amount} ETH
                  </span>
                </div>
                
                <ProgressBar
                  current={campaign.total_raised}
                  target={campaign.target_amount}
                  showRemaining={true}
                />
              </div>

              <div className="space-y-3 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <span>👥</span> Donors
                  </span>
                  <span className="font-bold text-lg text-gray-900">{campaign.donor_count}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <span>💰</span> Donations
                  </span>
                  <span className="font-bold text-lg text-gray-900">{campaign.donation_count}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <span>📊</span> Trạng thái
                  </span>
                  <span className={`px-3 py-1 text-xs rounded-full font-semibold ${
                    campaign.status === "active" 
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {campaign.status === "active" ? "Đang hoạt động" : "Đã đóng"}
                  </span>
                </div>
              </div>
            </div>

            {/* Donate Button */}
            <button
              onClick={() => router.push(`/campaigns/${campaignId}/donate`)}
              className="w-full py-4 bg-emerald-600 text-white font-bold text-lg rounded-xl hover:bg-emerald-700 shadow-sm transition"
            >
              💝 Quyên góp ngay
            </button>

            {/* On-chain Info */}
            {campaign.onchain_id && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">On-chain ID</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-700 text-xs font-bold">#</span>
                  </div>
                  <p className="font-mono text-xl font-bold text-gray-900">
                    {campaign.onchain_id}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-3">Được lưu trữ trên blockchain Sepolia</p>
              </div>
            )}

            {/* Blockchain Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <p className="text-xs text-blue-900 mb-3 uppercase tracking-wider font-semibold">
                🔗 Blockchain
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Network:</span>
                  <span className="text-gray-900 font-semibold">Sepolia</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Contract:</span>
                  <span className="text-gray-900 font-mono text-xs">0x8DB4...8cdE</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

