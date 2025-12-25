"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function getUserRole() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("role");
}

export default function AdminDashboardPage() {
  const router = useRouter();

  // ===== Check auth + role =====
  useEffect(() => {
    const token = getAccessToken();
    const role = getUserRole();

    if (!token) {
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      alert("Bạn không có quyền truy cập trang admin");
      router.replace("/");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    router.replace("/reliefs");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4 fade-in">
          <div>
            <h1 className="text-3xl font-bold gradient-text mb-2">
              🛡️ Admin Dashboard
            </h1>
            <p className="text-gray-300">
              Quản lý hệ thống ReliefChain
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="btn btn-danger"
          >
            🚪 Đăng xuất
          </button>
        </div>

        {/* Quick Actions */}
        <div className="mb-12 card p-6 fade-in">
          <h3 className="text-lg font-semibold text-white mb-6">
            🚀 Quick Actions
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <button
              onClick={() => router.push("/reliefs")}
              className="p-4 bg-white/5 hover:bg-white/10 rounded-lg transition text-left hover:scale-105"
            >
              <div className="text-2xl mb-2">🌍</div>
              <div className="font-semibold text-white">Xem Campaigns</div>
              <div className="text-xs text-gray-400">Danh sách công khai</div>
            </button>
            <button
              onClick={() => window.open('/api/docs', '_blank')}
              className="p-4 bg-white/5 hover:bg-white/10 rounded-lg transition text-left hover:scale-105"
            >
              <div className="text-2xl mb-2">📚</div>
              <div className="font-semibold text-white">API Docs</div>
              <div className="text-xs text-gray-400">Tài liệu API</div>
            </button>
            <button
              onClick={() => window.open('https://sepolia.etherscan.io', '_blank')}
              className="p-4 bg-white/5 hover:bg-white/10 rounded-lg transition text-left hover:scale-105"
            >
              <div className="text-2xl mb-2">⛓️</div>
              <div className="font-semibold text-white">Etherscan</div>
              <div className="text-xs text-gray-400">Blockchain Explorer</div>
            </button>
            <button
              onClick={() => router.push("/")}
              className="p-4 bg-white/5 hover:bg-white/10 rounded-lg transition text-left hover:scale-105"
            >
              <div className="text-2xl mb-2">🏠</div>
              <div className="font-semibold text-white">Trang chủ</div>
              <div className="text-xs text-gray-400">Về trang user</div>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 fade-in">
          <div className="card p-8 hover:scale-105 transition-transform">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">📊</div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Quản lý Campaign
              </h2>
              <p className="text-sm text-gray-300">
                Tạo mới và quản lý các chiến dịch quyên góp trên blockchain.
              </p>
            </div>

            <button
              onClick={() =>
                router.push("/reliefadmin/create-campaign")
              }
              className="block mx-auto btn btn-success"
            >
              ➕ Tạo Campaign mới
            </button>
          </div>

          <div className="card p-8 hover:scale-105 transition-transform">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">📈</div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Dashboard Chi tiết
              </h2>
              <p className="text-sm text-gray-300">
                Xem thống kê và quản lý campaigns đang hoạt động.
              </p>
            </div>

            <button
              onClick={() =>
                router.push("/reliefadmin/dashboard")
              }
              className="block mx-auto btn btn-primary"
            >
              📊 Xem Dashboard
            </button>
          </div>

          <div className="card p-8 hover:scale-105 transition-transform">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Audit Logs
              </h2>
              <p className="text-sm text-gray-300">
                Xem lịch sử các thao tác của admin trên hệ thống.
              </p>
            </div>

            <button
              onClick={() =>
                router.push("/reliefadmin/audit-logs")
              }
              className="block mx-auto btn btn-primary"
            >
              📋 Xem Audit Logs
            </button>
          </div>

          <div className="card p-8 hover:scale-105 transition-transform">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">📊</div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Báo Cáo Tổng Hợp
              </h2>
              <p className="text-sm text-gray-300">
                Xem thống kê và phân tích hệ thống.
              </p>
            </div>

            <button
              onClick={() =>
                router.push("/reliefadmin/reports")
              }
              className="block mx-auto btn btn-primary"
            >
              📊 Xem Reports
            </button>
          </div>

          <div className="card p-8 md:col-span-2 lg:col-span-1 hover:scale-105 transition-transform">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚙️</div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Thông tin hệ thống
              </h2>
              <p className="text-sm text-gray-300 mb-4">
                Chi tiết về kiến trúc hệ thống
              </p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-gray-300">Backend:</span>
                <span className="font-semibold text-white">FastAPI</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-gray-300">Blockchain:</span>
                <span className="font-semibold text-white">Hardhat / Ethereum</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-gray-300">Quyền:</span>
                <span className="font-semibold text-green-400">Admin</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
