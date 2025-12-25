"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardStatCard from "../../components/DashboardStatCard";
import CampaignCard from "../../components/CampaignCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type CampaignStats = {
  id: number;
  title: string;
  short_desc: string;
  image_url: string;
  target_amount: number;
  total_raised: number;
  donor_count: number;
  donation_count: number;
  onchain_id: number;
  status: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [withdraws, setWithdraws] = useState<any[]>([]);
  const [loadingWithdraws, setLoadingWithdraws] = useState(false);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/campaigns/`);
        if (res.ok) {
          const data = await res.json();
          
          const campaignsWithStats = await Promise.all(
            data.map(async (campaign: any) => {
              try {
                // Try /stats endpoint first
                const statsRes = await fetch(`${API_URL}/api/v1/campaigns/${campaign.id}/stats`);
                if (statsRes.ok) {
                  return await statsRes.json();
                }
                
                // Fallback: fetch donations to calculate stats
                try {
                  const donationsRes = await fetch(`${API_URL}/api/v1/campaigns/${campaign.id}/donations`);
                  const donations = donationsRes.ok ? await donationsRes.json() : [];
                  
                  const total_raised = donations.reduce((sum: number, d: any) => sum + (d.amount_eth || 0), 0);
                  const donor_count = new Set(donations.map((d: any) => d.donor_address)).size;
                  
                  return {
                    ...campaign,
                    total_raised: total_raised || 0,
                    donor_count: donor_count || 0,
                    donation_count: donations.length || 0,
                  };
                } catch {
                  return { ...campaign, total_raised: 0, donor_count: 0, donation_count: 0 };
                }
              } catch {
                return { ...campaign, total_raised: 0, donor_count: 0, donation_count: 0 };
              }
            })
          );
          
          setCampaigns(campaignsWithStats);
        }
      } catch (error) {
        console.error("Error fetching campaigns:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
    
    const interval = setInterval(fetchCampaigns, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleWithdraw = async (campaignId: number) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign || !campaign.onchain_id) {
      alert("Campaign chưa được tạo on-chain!");
      return;
    }

    const amountStr = prompt(`Nhập số tiền muốn rút (ETH).\nSố tiền đã quyên góp: ${campaign.total_raised.toFixed(4)} ETH`);
    if (!amountStr) return;

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert("Số tiền không hợp lệ!");
      return;
    }

    if (amount > campaign.total_raised) {
      alert(`Số tiền không được vượt quá số đã quyên góp (${campaign.total_raised.toFixed(4)} ETH)`);
      return;
    }

    if (!confirm(`Bạn có chắc muốn rút ${amount} ETH từ campaign "${campaign.title}"?`)) {
      return;
    }

    setWithdrawing(campaignId);
    try {
      const res = await fetch(`${API_URL}/api/v1/campaigns/${campaignId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_eth: amount }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Đã gửi yêu cầu rút tiền!\n${data.message}\nTransaction sẽ được xử lý trong background.`);
        // Refresh sau 3 giây
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        const error = await res.json();
        alert(`Lỗi: ${error.detail || "Không thể rút tiền"}`);
      }
    } catch (error) {
      console.error("Error withdrawing:", error);
      alert("Có lỗi xảy ra khi rút tiền");
    } finally {
      setWithdrawing(null);
    }
  };

  const handleToggleStatus = async (campaignId: number, currentStatus: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign || !campaign.onchain_id) {
      alert("Campaign chưa được tạo on-chain!");
      return;
    }

    const newStatus = currentStatus === "active" ? "closed" : "active";
    const action = newStatus === "active" ? "mở" : "đóng";
    
    if (!confirm(`Bạn có chắc muốn ${action} campaign "${campaign.title}"?`)) {
      return;
    }

    setToggling(campaignId);
    try {
      const res = await fetch(`${API_URL}/api/v1/campaigns/${campaignId}/set-active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newStatus === "active" }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Đã gửi yêu cầu ${action} campaign!\n${data.message}\nTransaction sẽ được xử lý trong background.`);
        // Refresh sau 3 giây
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        const error = await res.json();
        alert(`Lỗi: ${error.detail || `Không thể ${action} campaign`}`);
      }
    } catch (error) {
      console.error("Error toggling status:", error);
      alert("Có lỗi xảy ra");
    } finally {
      setToggling(null);
    }
  };

  const handleViewWithdraws = async (campaignId: number) => {
    console.log("handleViewWithdraws called for campaign:", campaignId);
    setSelectedCampaignId(campaignId);
    setShowWithdrawModal(true);
    setLoadingWithdraws(true);
    
    try {
      const res = await fetch(`${API_URL}/api/v1/campaigns/${campaignId}/withdraws`);
      console.log("Withdraws API response:", res.status, res.ok);
      if (res.ok) {
        const data = await res.json();
        console.log("Withdraws data:", data);
        setWithdraws(data);
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("Error response:", errorData);
        alert("Không thể lấy lịch sử rút tiền");
        setWithdraws([]);
      }
    } catch (error) {
      console.error("Error fetching withdraws:", error);
      alert("Có lỗi xảy ra");
      setWithdraws([]);
    } finally {
      setLoadingWithdraws(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 flex items-center justify-center">
        <div className="text-center fade-in">
          <div className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-white/20 border-t-white mb-6" />
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-white">Đang tải dữ liệu...</h2>
            <p className="text-gray-300">Vui lòng đợi trong giây lát</p>
            <div className="flex justify-center mt-4">
              <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse" style={{width: '60%'}} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalRaised = campaigns.reduce((sum, c) => sum + (c.total_raised || 0), 0);
  const totalDonors = campaigns.reduce((sum, c) => sum + (c.donor_count || 0), 0);
  const activeCampaigns = campaigns.filter(c => c.status === "active").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4 fade-in">
          <div>
            <h1 className="text-3xl font-bold gradient-text mb-2">
              🏠 Admin Dashboard
            </h1>
            <p className="text-gray-300">
              Quản lý các chiến dịch cứu trợ trên blockchain
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                window.open(`${API_URL}/api/v1/campaigns/export/all?format=csv`, '_blank');
              }}
              className="btn bg-white/10 hover:bg-white/20 text-white"
            >
              📊 Export CSV
            </button>
            <button
              onClick={() => {
                window.open(`${API_URL}/api/v1/campaigns/export/all?format=json`, '_blank');
              }}
              className="btn bg-white/10 hover:bg-white/20 text-white"
            >
              📄 Export JSON
            </button>
            <button
              onClick={() => router.push("/reliefadmin/create-campaign")}
              className="btn btn-success"
            >
              ➕ Tạo Campaign Mới
            </button>
          </div>
        </div>

        {/* Stats Overview - KPI Cards */}
        <div className="card p-6 mb-8 fade-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">
              📈 Thống kê tổng quan
            </h2>
            <span className="px-3 py-1 bg-white/20 text-white rounded-full text-sm font-medium">
              {campaigns.length} campaigns
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <DashboardStatCard
              icon="📊"
              label="Tổng Campaigns"
              value={campaigns.length}
              color="blue"
            />
            <DashboardStatCard
              icon="✅"
              label="Đang hoạt động"
              value={activeCampaigns}
              color="green"
            />
            <DashboardStatCard
              icon="💰"
              label="Tổng quyên góp"
              value={`${totalRaised.toFixed(2)} ETH`}
              color="purple"
            />
            <DashboardStatCard
              icon="👥"
              label="Tổng Donors"
              value={totalDonors}
              color="orange"
            />
          </div>
        </div>

        {/* Campaigns List */}
        <div className="card p-6 fade-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">
              📋 Danh sách Campaigns
            </h2>
            <span className="px-3 py-1 bg-white/20 text-white rounded-full text-sm font-medium">
              {campaigns.length} campaigns
            </span>
          </div>
          
          {campaigns.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-600 text-lg mb-2">Chưa có campaign nào</p>
              <p className="text-gray-500 text-sm mb-6">
                Hãy tạo campaign đầu tiên để bắt đầu!
              </p>
              <button
                onClick={() => router.push("/reliefadmin/create-campaign")}
                className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 shadow-sm transition"
              >
                Tạo Campaign Đầu Tiên
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  id={campaign.id}
                  title={campaign.title}
                  short_desc={campaign.short_desc}
                  image_url={campaign.image_url}
                  target_amount={campaign.target_amount}
                  total_raised={campaign.total_raised}
                  donor_count={campaign.donor_count}
                  donation_count={campaign.donation_count}
                  status={campaign.status}
                  onchain_id={campaign.onchain_id}
                  showDonateButton={false}
                  showAdminControls={true}
                  onWithdraw={handleWithdraw}
                  onToggleStatus={handleToggleStatus}
                  onViewWithdraws={handleViewWithdraws}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Withdraw History Modal */}
      {showWithdrawModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowWithdrawModal(false);
              setSelectedCampaignId(null);
              setWithdraws([]);
            }
          }}
        >
          <div className="glass rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">
                📜 Lịch sử rút tiền
              </h2>
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setSelectedCampaignId(null);
                  setWithdraws([]);
                }}
                className="text-gray-400 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center transition"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingWithdraws ? (
                <div className="text-center py-16 fade-in">
                  <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white mb-4" />
                  <h4 className="text-lg font-semibold text-white mb-2">Đang tải lịch sử...</h4>
                  <p className="text-gray-300">Vui lòng đợi trong giây lát</p>
                </div>
              ) : withdraws.length === 0 ? (
                <div className="text-center py-16 fade-in">
                  <div className="text-6xl mb-4 animate-pulse">💰</div>
                  <h4 className="text-xl font-semibold text-white mb-2">Chưa có giao dịch rút tiền nào</h4>
                  <p className="text-gray-300">Các giao dịch rút tiền sẽ hiển thị ở đây</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {withdraws.map((withdraw: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                            💰
                          </div>
                          <div>
                            <p className="font-semibold text-white">
                              Rút {withdraw.amount_eth?.toFixed(4) || "0.0000"} ETH
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {withdraw.timestamp
                                ? new Date(withdraw.timestamp * 1000).toLocaleString("vi-VN", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 font-mono ml-[52px]">
                          {withdraw.owner ? `${withdraw.owner.slice(0, 10)}...${withdraw.owner.slice(-8)}` : "N/A"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://sepolia.etherscan.io/tx/${withdraw.tx_hash || ""}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary text-xs"
                        >
                          Etherscan →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
