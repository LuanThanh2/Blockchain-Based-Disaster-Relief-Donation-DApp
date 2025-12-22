"use client";

import Link from "next/link";

export default function DonatePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-2">Relief Donations (Core-only)</h1>
        <p className="text-gray-700 mb-4">
          Route này đang là placeholder để UI core chạy ổn định (không phụ thuộc Temple/legacy backend).
        </p>
        <Link className="text-orange-700 underline" href="/reliefs">
          Go to Reliefs
        </Link>
      </div>
    </div>
  );
}
