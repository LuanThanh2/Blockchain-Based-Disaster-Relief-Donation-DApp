"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type AuditLog = {
  id: number;
  action: string;
  user_address: string | null;
  username: string | null;
  details: string | null;
  timestamp: string;
};

export default function AuditLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    action: "",
    username: "",
  });

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("role");
    
    if (!token || role !== "admin") {
      router.replace("/login");
      return;
    }

    fetchAuditLogs();
  }, [router, filters]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("Not authenticated");
      }

      // Build query params
      const params = new URLSearchParams();
      if (filters.action) {
        params.append("action", filters.action);
      }
      if (filters.username) {
        params.append("username", filters.username);
      }
      params.append("limit", "100");

      const url = `${API_URL}/api/v1/campaigns/admin/audit-logs${params.toString() ? `?${params.toString()}` : ""}`;
      
      const res = await fetch(url, {
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
      setLogs(data);
    } catch (err: any) {
      console.error("Failed to fetch audit logs:", err);
      setError(err.message || "Không thể tải audit logs");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      action: "",
      username: "",
    });
  };

  const getActionDisplayName = (action: string): string => {
    const actionMap: Record<string, string> = {
      create_campaign: "Tạo Campaign",
      update_campaign: "Cập nhật Campaign",
      withdraw: "Rút tiền",
      toggle_visibility: "Thay đổi hiển thị",
      create_onchain: "Tạo Campaign trên Blockchain",
      create_onchain_failed: "Lỗi tạo Campaign trên Blockchain",
      auto_disburse: "Tự động rút tiền",
    };
    return actionMap[action] || action;
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
        second: "2-digit",
      }).format(date);
    } catch {
      return timestamp;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
            <p className="mt-4 text-gray-600">Đang tải audit logs...</p>
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
            href="/reliefadmin"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition mb-4"
          >
            <span>←</span>
            <span>Về Dashboard</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="mt-2 text-gray-600">Lịch sử các thao tác của admin trên hệ thống</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Bộ lọc</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action
              </label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange("action", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Tất cả</option>
                <option value="create_campaign">Tạo Campaign</option>
                <option value="update_campaign">Cập nhật Campaign</option>
                <option value="withdraw">Rút tiền</option>
                <option value="toggle_visibility">Thay đổi hiển thị</option>
                <option value="create_onchain">Tạo Campaign trên Blockchain</option>
                <option value="create_onchain_failed">Lỗi tạo Campaign trên Blockchain</option>
                <option value="auto_disburse">Tự động rút tiền</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={filters.username}
                onChange={(e) => handleFilterChange("username", e.target.value)}
                placeholder="Nhập username..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Audit Logs Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>Không có audit logs nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Username
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {getActionDisplayName(log.action)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.username || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {log.user_address ? (
                          <span className="text-xs">
                            {log.user_address.slice(0, 10)}...{log.user_address.slice(-8)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate">
                        {log.details || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTimestamp(log.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        {logs.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            Hiển thị {logs.length} audit log{logs.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}




