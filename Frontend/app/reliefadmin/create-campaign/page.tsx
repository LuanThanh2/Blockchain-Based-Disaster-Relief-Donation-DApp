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

/* ================= AUTH HELPERS ================= */
function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function getUserRole() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("role"); // admin | user
}

/* ================= UI COMPONENTS ================= */
function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
  );
}

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-white">
        {label} {required && "*"}
      </label>
      {hint && <div className="text-xs text-gray-300">{hint}</div>}
      {children}
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  );
}

/* ================= PAGE ================= */
export default function CreateCampaignPage() {
  const router = useRouter();

  /* ====== AUTH GUARD ====== */
  useEffect(() => {
    const token = getAccessToken();
    const role = getUserRole();

    if (!token) {
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      alert("Bạn không có quyền tạo campaign");
      router.replace("/");
    }
  }, [router]);

  /* ====== STATE ====== */
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

  /* ====== VALIDATION ====== */
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
    if (!form.title.trim()) return "Tiêu đề không được để trống";
    if (!form.short_desc.trim()) return "Mô tả ngắn không được để trống";
    if (!form.description.trim()) return "Mô tả chi tiết không được để trống";

    const amount = parseFloat(form.target_amount);
    if (!(amount > 0)) return "Target phải lớn hơn 0";

    if (!/^0x[a-fA-F0-9]{40}$/.test(form.beneficiary))
      return "Beneficiary không hợp lệ";

    if (form.deadline && isNaN(Date.parse(form.deadline)))
      return "Deadline không hợp lệ";

    if (!isImageUrlValid) return "Image URL không hợp lệ";

    return null;
  };

  const canSubmit = !loading && validate() === null;

  /* ====== HANDLERS ====== */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        title: form.title.trim(),
        short_desc: form.short_desc.trim(),
        description: form.description.trim(),
        image_url: form.image_url.trim(),
        target_amount: parseFloat(form.target_amount),
        currency: form.currency,
        beneficiary: form.beneficiary.trim(),
        deadline: new Date(form.deadline).toISOString(),
        createOnChain: form.createOnChain,
      };

      const res = await fetch(`${API_URL}/api/v1/campaigns/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.detail || "Tạo campaign thất bại");
      }

      setSuccess(true);
      setTimeout(() => router.push("/reliefadmin/dashboard"), 2500);
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  /* ====== UI ====== */
  return (
    <div className="min-h-screen bg-black text-white p-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Tạo Campaign</h1>

      {error && <div className="mb-4 text-red-400">{error}</div>}
      {success && <div className="mb-4 text-green-400">Tạo thành công!</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Tiêu đề" required>
          <input name="title" className="input" value={form.title} onChange={handleChange} />
        </Field>

        <Field label="Mô tả ngắn" required>
          <input name="short_desc" className="input" value={form.short_desc} onChange={handleChange} />
        </Field>

        <Field label="Mô tả chi tiết" required>
          <textarea name="description" className="textarea" value={form.description} onChange={handleChange} />
        </Field>

        <Field label="Mục tiêu (ETH)" required>
          <input name="target_amount" className="input" value={form.target_amount} onChange={handleChange} />
        </Field>

        <Field label="Beneficiary" required>
          <input name="beneficiary" className="input" value={form.beneficiary} onChange={handleChange} />
        </Field>

        <Field label="Deadline" required>
          <input type="date" name="deadline" className="input" value={form.deadline} onChange={handleChange} />
        </Field>

        <label className="flex items-center gap-2">
          <input type="checkbox" name="createOnChain" checked={form.createOnChain} onChange={handleChange} />
          Tạo on-chain
        </label>

        <button
          disabled={!canSubmit}
          className="w-full py-3 rounded bg-indigo-600 disabled:bg-gray-600"
        >
          {loading ? <Spinner /> : "Tạo Campaign"}
        </button>
      </form>
    </div>
  );
}
