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
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 text-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>

          <button
            onClick={handleLogout}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-700"
          >
            Đăng xuất
          </button>
        </div>

        {/* Actions */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-2 text-lg font-semibold">
              Quản lý Campaign
            </h2>
            <p className="mb-4 text-sm text-gray-300">
              Tạo mới và quản lý các chiến dịch quyên góp.
            </p>

            <button
              onClick={() =>
                router.push("/reliefadmin/create-campaign")
              }
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold hover:bg-indigo-700"
            >
              ➕ Tạo Campaign mới
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-2 text-lg font-semibold">
              Thông tin hệ thống
            </h2>
            <p className="text-sm text-gray-300">
              Backend: FastAPI <br />
              Blockchain: Hardhat / Ethereum <br />
              Quyền: Admin
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
