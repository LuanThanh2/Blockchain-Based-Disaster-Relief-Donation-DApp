"use client";

import React from "react";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-3xl bg-white/5 border border-white/10 rounded-2xl p-10 backdrop-blur">
        {/* Title */}
        <h1 className="text-3xl font-bold mb-2">
          🛠 Relief Admin Dashboard
        </h1>
        <p className="text-sm text-gray-300 mb-8">
          Quản lý chiến dịch cứu trợ (Admin only)
        </p>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Create Campaign */}
          <Link
            href="/reliefadmin/create-campaign"
            className="group bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-6 text-white hover:scale-[1.03] transition"
          >
            <h2 className="text-xl font-semibold mb-2">
              ➕ Create Campaign
            </h2>
            <p className="text-sm text-indigo-100">
              Tạo chiến dịch cứu trợ mới, thiết lập mục tiêu và mô tả
            </p>
          </Link>

          {/* View Campaigns */}
          <Link
            href="/reliefs"
            className="group bg-white/10 border border-white/10 rounded-xl p-6 hover:scale-[1.03] transition"
          >
            <h2 className="text-xl font-semibold mb-2 text-white">
              📋 View Campaigns
            </h2>
            <p className="text-sm text-gray-300">
              Xem danh sách chiến dịch và tiến độ quyên góp
            </p>
          </Link>
        </div>

        {/* Footer hint */}
        <p className="mt-8 text-xs text-gray-400">
          ⚠️ Trang admin demo – chưa kiểm soát quyền truy cập
        </p>
      </div>
    </div>
  );
}
