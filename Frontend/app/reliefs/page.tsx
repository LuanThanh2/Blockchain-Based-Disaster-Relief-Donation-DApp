"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CampaignCard from "../components/CampaignCard";

type CampaignSummary = {
  id: number;
  title: string;
  short_desc?: string;
  target_amount?: number;
  currency?: string;
  image_url?: string;
  onchain_id?: number | null;
  total_raised?: number;
  donor_count?: number;
  donation_count?: number;
  status?: string;
};

const API_BASE = (process?.env?.NEXT_PUBLIC_API_BASE_URL as string) || 
                 (process?.env?.NEXT_PUBLIC_API_URL as string) || 
                 "http://127.0.0.1:8000";

export default function ReliefsPage() {
  const router = useRouter();
  const [items, setItems] = useState<CampaignSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    // Lấy role từ localStorage
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("role");
      setUserRole(role);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function fetchCampaigns() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/campaigns/`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        
        // Fetch stats for each campaign
        const campaignsWithStats = await Promise.all(
          data.map(async (campaign: any) => {
            try {
              // Try /stats endpoint first
              const statsRes = await fetch(`${API_BASE}/api/v1/campaigns/${campaign.id}/stats`);
              if (statsRes.ok) {
                return await statsRes.json();
              }
              
              // Fallback: fetch donations
              try {
                const donationsRes = await fetch(`${API_BASE}/api/v1/campaigns/${campaign.id}/donations`);
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
        
        if (mounted) setItems(campaignsWithStats || []);
      } catch (e) {
        console.error("Failed to load campaigns", e);
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchCampaigns();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-3">
            🌍 Chiến Dịch Cứu Trợ
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Quyên góp minh bạch trên blockchain. Mọi giao dịch đều được ghi nhận công khai và có thể kiểm tra.
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 fade-in">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="card overflow-hidden animate-pulse"
              >
                <div className="w-full h-48 bg-gradient-to-br from-gray-700 to-gray-800 shimmer" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-white/10 rounded w-3/4" />
                  <div className="h-4 bg-white/10 rounded w-full" />
                  <div className="h-4 bg-white/10 rounded w-2/3" />
                  <div className="flex gap-2 mt-4">
                    <div className="h-8 bg-white/10 rounded-full w-20" />
                    <div className="h-8 bg-white/10 rounded-full w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                id={campaign.id}
                title={campaign.title}
                short_desc={campaign.short_desc}
                image_url={campaign.image_url}
                target_amount={campaign.target_amount || 0}
                total_raised={campaign.total_raised || 0}
                donor_count={campaign.donor_count || 0}
                donation_count={campaign.donation_count || 0}
                status={campaign.status || "active"}
                onchain_id={campaign.onchain_id}
                showDonateButton={true}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 card fade-in">
            <div className="text-7xl mb-6 animate-pulse">🌍</div>
            <h3 className="text-2xl font-bold text-white mb-3">Chưa có chiến dịch nào</h3>
            <p className="text-gray-300 text-lg mb-6 max-w-md mx-auto">
              Hiện tại chưa có chiến dịch cứu trợ nào đang hoạt động. Hãy quay lại sau hoặc tạo chiến dịch mới.
            </p>
            {(userRole === "admin" || userRole === "superadmin") ? (
              <button
                onClick={() => router.push("/reliefadmin")}
                className="btn btn-primary text-lg px-8 py-4"
              >
                🏠 Về Admin Dashboard
              </button>
            ) : (
              <button
                onClick={() => router.push("/login")}
                className="btn btn-primary text-lg px-8 py-4"
              >
                🔐 Đăng nhập để tạo Campaign
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
