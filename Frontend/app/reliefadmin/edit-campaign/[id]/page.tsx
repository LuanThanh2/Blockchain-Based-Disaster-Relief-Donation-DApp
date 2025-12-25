"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Campaign = {
  id: number;
  title: string;
  short_desc?: string;
  description?: string;
  image_url?: string;
  target_amount: number;
  beneficiary?: string;
  deadline?: string;
  is_visible: boolean;
  auto_disburse: boolean;
  disburse_threshold: number;
};

export default function EditCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    title: "",
    short_desc: "",
    description: "",
    image_url: "",
    target_amount: "",
    beneficiary: "",
    deadline: "",
    is_visible: true,
    auto_disburse: false,
    disburse_threshold: 0.8,
  });

  useEffect(() => {
    // Check auth - chỉ admin mới được edit
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("role");
    if (!token || role !== "admin") {
      router.replace("/login");
      return;
    }

    fetchCampaign();
  }, [campaignId, router]);

  const fetchCampaign = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/api/v1/campaigns/${campaignId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setCampaign(data);
      setForm({
        title: data.title || "",
        short_desc: data.short_desc || "",
        description: data.description || "",
        image_url: data.image_url || "",
        target_amount: data.target_amount?.toString() || "",
        beneficiary: data.beneficiary || "",
        deadline: data.deadline ? new Date(data.deadline).toISOString().slice(0, 16) : "",
        is_visible: data.is_visible ?? true,
        auto_disburse: data.auto_disburse ?? false,
        disburse_threshold: data.disburse_threshold ?? 0.8,
      });
    } catch (err) {
      console.error("Failed to fetch campaign:", err);
      setError("Không thể tải thông tin campaign");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const token = localStorage.getItem("access_token");
      const payload: any = {
        title: form.title,
        short_desc: form.short_desc || null,
        description: form.description || null,
        image_url: form.image_url || null,
        target_amount: parseFloat(form.target_amount),
        beneficiary: form.beneficiary || null,
        is_visible: form.is_visible,
        auto_disburse: form.auto_disburse,
        disburse_threshold: form.disburse_threshold,
      };

      if (form.deadline) {
        payload.deadline = new Date(form.deadline).toISOString();
      }

      const res = await fetch(`${API_BASE}/api/v1/campaigns/${campaignId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Cập nhật thất bại");
      }

      // Lấy dữ liệu response để đảm bảo update thành công
      const updatedData = await res.json();
      console.log("Campaign updated successfully:", updatedData);

      setSuccess(true);
      // Không redirect tự động, user có thể dùng nút "Quay lại" hoặc tiếp tục chỉnh sửa
    } catch (err: any) {
      console.error("Update failed:", err);
      setError(err.message || "Cập nhật campaign thất bại");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Không tìm thấy campaign</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition"
          >
            <span>←</span>
            <span>Quay lại</span>
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Chỉnh sửa Campaign</h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              ✅ Cập nhật thành công!
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tiêu đề <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mô tả ngắn
              </label>
              <input
                type="text"
                value={form.short_desc}
                onChange={(e) => setForm({ ...form, short_desc: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mô tả chi tiết
              </label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL hình ảnh
              </label>
              <input
                type="url"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mục tiêu (ETH) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.target_amount}
                  onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deadline
                </label>
                <input
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beneficiary (Địa chỉ ví)
              </label>
              <input
                type="text"
                value={form.beneficiary}
                onChange={(e) => setForm({ ...form, beneficiary: e.target.value })}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_visible"
                  checked={form.is_visible}
                  onChange={(e) => setForm({ ...form, is_visible: e.target.checked })}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                />
                <label htmlFor="is_visible" className="ml-2 text-sm text-gray-700">
                  Hiển thị công khai
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="auto_disburse"
                  checked={form.auto_disburse}
                  onChange={(e) => setForm({ ...form, auto_disburse: e.target.checked })}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                />
                <label htmlFor="auto_disburse" className="ml-2 text-sm text-gray-700">
                  Tự động rút tiền khi đạt ngưỡng
                </label>
              </div>

              {form.auto_disburse && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ngưỡng tự động rút (0.0 - 1.0)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={form.disburse_threshold}
                    onChange={(e) => setForm({ ...form, disburse_threshold: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Ví dụ: 0.8 = tự động rút khi đạt 80% mục tiêu
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

