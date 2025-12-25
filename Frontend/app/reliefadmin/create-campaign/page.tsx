"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/* ================= CONFIG ================= */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000";

/* ================= TYPES ================= */
type FormState = {
  title: string;
  short_desc: string;
  description: string;
  image_url: string;
  target_amount: string;
  currency: "ETH" | "USDT" | "USDC";
  beneficiary: string;
  deadline: string;
  createOnChain: boolean;
};

/* ================= HELPERS ================= */
const getAccessToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

const getUserRole = () =>
  typeof window !== "undefined" ? localStorage.getItem("role") : null;

/* ================= PAGE ================= */
export default function CreateCampaignPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  /* ---------- AUTH ---------- */
  useEffect(() => {
    const token = getAccessToken();
    const role = getUserRole();

    if (!token) {
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      alert("Chỉ admin mới được tạo campaign");
      router.replace("/");
      return;
    }

    setAuthorized(true);
  }, [router]);

  /* ---------- STATE ---------- */
  const [form, setForm] = useState<FormState>({
    title: "",
    short_desc: "",
    description: "",
    image_url: "",
    target_amount: "",
    currency: "ETH",
    beneficiary: "",
    deadline: "",
    createOnChain: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /* ---------- VALIDATION ---------- */
  const isImageUrlValid = useMemo(() => {
    if (!form.image_url.trim()) return true;
    try {
      const u = new URL(form.image_url);
      return ["http:", "https:"].includes(u.protocol);
    } catch {
      return false;
    }
  }, [form.image_url]);

  const validate = () => {
    if (!form.title.trim()) return "Thiếu tiêu đề";
    if (!form.short_desc.trim()) return "Thiếu mô tả ngắn";
    if (!form.description.trim()) return "Thiếu mô tả chi tiết";

    const amount = Number(form.target_amount);
    if (!(amount > 0)) return "Số tiền không hợp lệ";

    if (!/^0x[a-fA-F0-9]{40}$/.test(form.beneficiary))
      return "Ví nhận không hợp lệ";

    if (form.deadline && isNaN(Date.parse(form.deadline)))
      return "Deadline không hợp lệ";

    if (!isImageUrlValid) return "Image URL không hợp lệ";

    return null;
  };

  /* ---------- SUBMIT ---------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const role = getUserRole();
    if (role !== "admin") {
      setError("Bạn không có quyền tạo campaign");
      return;
    }

    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/campaigns/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          ...form,
          target_amount: Number(form.target_amount),
          deadline: new Date(form.deadline).toISOString(),
        }),
      });

      if (!res.ok) throw new Error("Tạo campaign thất bại");

      setSuccess(true);
      setTimeout(() => router.push("/reliefadmin/dashboard"), 1500);
    } catch (e: any) {
      setError(e.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- GUARD ---------- */
  if (!authorized) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Đang kiểm tra quyền truy cập...
      </div>
    );
  }

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-black text-white p-10 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Tạo Campaign</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input label="Tiêu đề" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <Input label="Mô tả ngắn" value={form.short_desc} onChange={(v) => setForm({ ...form, short_desc: v })} />
          <Textarea label="Mô tả chi tiết" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <Input label="Image URL" value={form.image_url} onChange={(v) => setForm({ ...form, image_url: v })} />
          <Input label="Target (ETH)" value={form.target_amount} onChange={(v) => setForm({ ...form, target_amount: v })} />
          <Input label="Beneficiary" value={form.beneficiary} onChange={(v) => setForm({ ...form, beneficiary: v })} />
          <Input type="date" label="Deadline" value={form.deadline} onChange={(v) => setForm({ ...form, deadline: v })} />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.createOnChain}
              onChange={(e) =>
                setForm({ ...form, createOnChain: e.target.checked })
              }
            />
            Tạo campaign on-chain
          </label>

          {error && <p className="text-red-400">{error}</p>}
          {success && <p className="text-green-400">Tạo thành công!</p>}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-3 font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Đang tạo..." : "Tạo Campaign"}
          </button>
        </form>

        <div className="rounded-xl border border-white/10 p-6 bg-white/5">
          <h3 className="font-semibold mb-3">Preview</h3>
          <div className="aspect-video bg-gray-800 rounded mb-4 overflow-hidden">
            {form.image_url && isImageUrlValid ? (
              <img
                src={form.image_url}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                Chưa có ảnh
              </div>
            )}
          </div>
          <h4 className="font-semibold">{form.title || "Tiêu đề"}</h4>
          <p className="text-sm text-gray-300 mt-1">
            {form.short_desc || "Mô tả ngắn"}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================= COMPONENTS ================= */
function Input({ label, value, onChange, type = "text" }: any) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
      />
    </div>
  );
}

function Textarea({ label, value, onChange }: any) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
      />
    </div>
  );
}
