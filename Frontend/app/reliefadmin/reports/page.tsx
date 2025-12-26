"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type ReportSummary = {
  total_campaigns: number;
  active_campaigns: number;
  total_raised: number;
  total_withdrawn: number;
  total_donors: number;
  total_donations: number;
  recent_campaigns: Array<{
    id: number;
    title: string;
    short_desc?: string;
    target_amount: number;
    status: string;
    created_at: string;
  }>;
  top_campaigns: Array<{
    id: number;
    title: string;
    short_desc?: string;
    target_amount: number;
    total_raised: number;
    donor_count: number;
    donation_count: number;
    status: string;
  }>;
};

export default function ReportsPage() {
  const router = useRouter();
  const [report, setReport] = useState<ReportSummary | null>(null);
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

    fetchReports();
  }, [router]);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(`${API_URL}/api/v1/campaigns/admin/reports`, {
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
      setReport(data);
    } catch (err: any) {
      console.error("Failed to fetch reports:", err);
      setError(err.message || "Không thể tải báo cáo");
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return new Intl.DateTimeFormat("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return timestamp;
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
            <p className="mt-4 text-gray-600">Đang tải báo cáo...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link
              href="/reliefadmin"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition mb-4"
            >
              <span>←</span>
              <span>Về Dashboard</span>
            </Link>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/reliefadmin"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition mb-4"
          >
            <span>←</span>
            <span>Về Dashboard</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">📊 Báo Cáo Tổng Hợp</h1>
          <p className="mt-2 text-gray-600">Thống kê và phân tích hệ thống ReliefChain</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tổng Campaigns</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{report.total_campaigns}</p>
              </div>
              <div className="text-4xl">📊</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Campaigns Đang Hoạt Động</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{report.active_campaigns}</p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tổng Quyên Góp</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{formatETH(report.total_raised)}</p>
              </div>
              <div className="text-4xl">💰</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tổng Đã Rút</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{formatETH(report.total_withdrawn)}</p>
              </div>
              <div className="text-4xl">💸</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tổng Donors</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{report.total_donors}</p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tổng Donations</p>
                <p className="text-3xl font-bold text-indigo-600 mt-2">{report.total_donations}</p>
              </div>
              <div className="text-4xl">💝</div>
            </div>
          </div>
        </div>

        {/* Top Campaigns */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🏆 Top 5 Campaigns (Theo Số Tiền Quyên Góp)</h2>
          {report.top_campaigns.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Chưa có campaign nào</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Campaign
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mục Tiêu
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Đã Quyên Góp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Donors
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Donations
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trạng Thái
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report.top_campaigns.map((campaign, index) => (
                    <tr key={campaign.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{campaign.title}</div>
                        {campaign.short_desc && (
                          <div className="text-sm text-gray-500">{campaign.short_desc}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatETH(campaign.target_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-purple-600">
                        {formatETH(campaign.total_raised)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {campaign.donor_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {campaign.donation_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          campaign.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {campaign.status === "active" ? "Hoạt động" : campaign.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Campaigns */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🕐 Campaigns Gần Đây (10 Campaigns Mới Nhất)</h2>
          {report.recent_campaigns.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Chưa có campaign nào</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Campaign
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mục Tiêu
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trạng Thái
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ngày Tạo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hành Động
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report.recent_campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {campaign.id}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{campaign.title}</div>
                        {campaign.short_desc && (
                          <div className="text-sm text-gray-500">{campaign.short_desc}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatETH(campaign.target_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          campaign.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {campaign.status === "active" ? "Hoạt động" : campaign.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTimestamp(campaign.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          href={`/campaigns/${campaign.id}`}
                          className="text-emerald-600 hover:text-emerald-800 font-medium"
                        >
                          Xem chi tiết →
                        </Link>
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




