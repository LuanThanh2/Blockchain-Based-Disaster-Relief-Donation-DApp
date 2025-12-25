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
  is_visible?: boolean;
};

export default function DashboardPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        // Admin cần xem TẤT CẢ campaigns (kể cả invisible)
        const res = await fetch(`${API_URL}/api/v1/campaigns/?visible_only=false`);
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
      const token = localStorage.getItem("access_token");
      if (!token) {
        alert("Bạn cần đăng nhập để thực hiện thao tác này");
        router.push("/login");
        return;
      }

      const res = await fetch(`${API_URL}/api/v1/campaigns/${campaignId}/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ amount_eth: amount }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.tx_hash) {
          // Success notification với transaction hash
          const etherscanUrl = `https://sepolia.etherscan.io/tx/${data.tx_hash}`;
          const message = `✅ Rút tiền thành công!\n\n` +
            `Số tiền: ${data.amount_eth} ETH\n` +
            `Transaction Hash: ${data.tx_hash}\n\n` +
            `Bạn có thể xem chi tiết trên Etherscan.`;
          
          if (confirm(message + "\n\nBấm OK để mở Etherscan, Cancel để đóng.")) {
            window.open(etherscanUrl, '_blank');
          }
          
          // Refresh sau 2 giây để cập nhật dữ liệu
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          alert(`⚠️ ${data.message || "Đã gửi yêu cầu rút tiền nhưng chưa có transaction hash"}`);
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      } else {
        const error = await res.json().catch(() => ({ detail: "Không thể rút tiền" }));
        alert(`❌ Lỗi: ${error.detail || error.message || "Không thể rút tiền"}`);
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
      const token = localStorage.getItem("access_token");
      if (!token) {
        alert("Bạn cần đăng nhập để thực hiện thao tác này");
        router.push("/login");
        return;
      }

      const res = await fetch(`${API_URL}/api/v1/campaigns/${campaignId}/set-active`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
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
    router.push(`/reliefadmin/withdraw-history/${campaignId}`);
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/reliefadmin")}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-sm font-medium flex items-center gap-2"
            >
              ← Về Admin
            </button>
            <div>
              <h1 className="text-3xl font-bold gradient-text mb-2">
                🏠 Admin Dashboard
              </h1>
              <p className="text-gray-300">
                Quản lý các chiến dịch cứu trợ trên blockchain
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/reliefadmin/reports")}
              className="btn bg-white/10 hover:bg-white/20 text-white"
            >
              📊 Reports
            </button>
            <button
              onClick={() => router.push("/reliefadmin/audit-logs")}
              className="btn bg-white/10 hover:bg-white/20 text-white"
            >
              📋 Audit Logs
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
                  is_visible={campaign.is_visible}
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

    </div>
  );
}
