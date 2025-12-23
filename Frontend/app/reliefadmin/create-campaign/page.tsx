"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process?.env?.NEXT_PUBLIC_API_URL ||
  process?.env?.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000";

type FormState = {
  title: string;
  short_desc: string;
  description: string;
  image_url: string;
  target_amount: string;
  currency: "ETH" | "USDT" | "USDC";
  beneficiary: string;
  deadline: string; // yyyy-mm-dd
  createOnChain: boolean;
};

// ===== Spinner =====
function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
      aria-hidden
    />
  );
}

// ===== Page Component =====
export default function CreateCampaignPage() {
  const router = useRouter();

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
  const [txHash, setTxHash] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [onchainId, setOnchainId] = useState<number | null>(null);
  const [onchainStatus, setOnchainStatus] = useState<"idle" | "pending" | "done">("idle");

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
    const amount = parseFloat(form.target_amount || "0");
    if (!(amount > 0)) return "Target phải lớn hơn 0";
    if (!/^0x[a-fA-F0-9]{40}$/.test(form.beneficiary.trim()))
      return "Địa chỉ beneficiary không hợp lệ";
    if (form.deadline && isNaN(Date.parse(form.deadline)))
      return "Deadline không hợp lệ";
    if (!isImageUrlValid) return "Image URL không hợp lệ (cần http/https)";
    return null;
  };

  const canSubmit = useMemo(() => {
    if (loading) return false;
    return validate() === null;
  }, [form, loading, isImageUrlValid]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((s) => ({ ...s, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setTxHash(null);
    setCampaignId(null);
    setOnchainId(null);
    setOnchainStatus("idle");

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: form.title.trim(),
        short_desc: form.short_desc.trim(),
        description: form.description.trim(),
        image_url: form.image_url.trim(),
        target_amount: parseFloat(form.target_amount || "0"),
        currency: form.currency,
        beneficiary: form.beneficiary.trim(),
        deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
        createOnChain: form.createOnChain,
      };

      const res = await fetch(`${API_URL}/api/v1/campaigns/`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          msg = data?.detail || data?.error || JSON.stringify(data);
        } catch {}
        throw new Error(msg);
      }

      const data = await res.json();
      setCampaignId(data?.id ?? null);
      setTxHash(data?.contract_tx_hash || data?.txHash || null);
      setOnchainId(data?.onchain_id ?? null);
      setSuccess(true);

      if (form.createOnChain && data?.id) {
        setOnchainStatus("pending");
        const startedAt = Date.now();
        const timeoutMs = 60_000;
        const intervalMs = 1500;

        while (Date.now() - startedAt < timeoutMs) {
          try {
            const r = await fetch(`${API_URL}/api/v1/campaigns/${data.id}`);
            if (r.ok) {
              const latest = await r.json();
              if (latest?.contract_tx_hash) setTxHash(latest.contract_tx_hash);
              if (latest?.onchain_id !== undefined) setOnchainId(latest.onchain_id);
              if (latest?.contract_tx_hash && latest?.onchain_id !== undefined) {
                setOnchainStatus("done");
                break;
              }
            }
          } catch {}
          await new Promise((r) => setTimeout(r, intervalMs));
        }
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => router.push("/reliefadmin/dashboard"), 3000);
    return () => clearTimeout(t);
  }, [success, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 text-white py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Tạo Campaign</h1>
            <p className="mt-2 text-gray-300 text-sm">
              Điền thông tin cơ bản, đặt mục tiêu gây quỹ và (tuỳ chọn) tạo on-chain.
            </p>
          </div>
          <button
            onClick={() => router.push("/reliefadmin/dashboard")}
            className="btn border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur hover:bg-white/20"
          >
            Về Dashboard
          </button>
        </div>

{/* Main Grid: Form + Preview */}
<div className="grid lg:grid-cols-[1.2fr,0.8fr] gap-8">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
            {success && <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">✅ Tạo campaign thành công! Chuyển hướng dashboard...</div>}

            <div className="grid grid-cols-3 gap-4 items-start">
              {/* Fields */}
              <div className="text-sm font-medium">Tiêu đề</div>
              <div className="text-xs text-gray-300">Ngắn gọn, rõ ràng.</div>
              <input name="title" value={form.title} onChange={handleChange} className="input" placeholder="Ví dụ: Hỗ trợ đồng bào vùng lũ" />

              <div className="text-sm font-medium">Mục tiêu (ETH)</div>
              <div className="text-xs text-gray-300">Số tiền cần gây quỹ.</div>
              <input name="target_amount" value={form.target_amount} onChange={handleChange} className="input" placeholder="1.5" inputMode="decimal" />

              <div className="text-sm font-medium">Mô tả ngắn</div>
              <div className="text-xs text-gray-300">Hiển thị danh sách.</div>
              <input name="short_desc" value={form.short_desc} onChange={handleChange} className="input" placeholder="Ví dụ: Gây quỹ khẩn cấp" />

              <div className="text-sm font-medium">Deadline</div>
              <div className="text-xs text-gray-300">YYYY-MM-DD</div>
              <input name="deadline" type="date" value={form.deadline} onChange={handleChange} className="input" />

              <div className="text-sm font-medium">Mô tả chi tiết</div>
              <div className="text-xs text-gray-300">Nêu rõ mục tiêu, phạm vi hỗ trợ.</div>
              <textarea name="description" value={form.description} onChange={handleChange} rows={4} className="textarea" />

              <div className="text-sm font-medium">Ảnh cover (URL)</div>
              <div className="text-xs text-gray-300">Đường link ảnh.</div>
              <input name="image_url" value={form.image_url} onChange={handleChange} className="input" placeholder="https://..." />

              <div className="text-sm font-medium">Beneficiary</div>
              <div className="text-xs text-gray-300">Địa chỉ 0x...</div>
              <input name="beneficiary" value={form.beneficiary} onChange={handleChange} className="input font-mono" />

              {/* On-chain toggle */}
              <div className="text-sm font-medium">Tạo on-chain</div>
              <div className="text-xs text-gray-300">Nếu bật, backend gửi tx tạo campaign.</div>
              <label className="inline-flex items-center gap-3 cursor-pointer">
                <input type="checkbox" name="createOnChain" checked={form.createOnChain} onChange={handleChange} className="h-5 w-5 rounded border-white/20 bg-transparent" />
                <span className="text-sm">{form.createOnChain ? "Bật" : "Tắt"}</span>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full rounded-3xl px-6 py-3 text-sm font-bold uppercase transition-all duration-200
                ${canSubmit ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg hover:scale-105 hover:shadow-xl" : "bg-gray-600 text-gray-400 cursor-not-allowed"}`}
            >
              {loading ? <span className="inline-flex items-center gap-2"><Spinner /> Đang tạo...</span> : "Tạo Campaign"}
            </button>
          </form>

          {/* Preview */}
          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm">
              <div className="text-sm font-semibold">Preview</div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <div className="aspect-[16/9] w-full bg-gray-800">
                  {form.image_url.trim() && isImageUrlValid ? (
                    <img src={form.image_url.trim()} alt="cover" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-400">Chưa có ảnh / URL không hợp lệ</div>
                  )}
                </div>
                <div className="p-4">
                  <div className="text-base font-semibold">{form.title || "Tiêu đề sẽ hiển thị ở đây"}</div>
                  <div className="mt-1 text-sm text-gray-300">{form.short_desc || "Mô tả ngắn sẽ hiển thị ở đây..."}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300">
                    <span className="rounded-full bg-white/10 px-2 py-1 ring-1 ring-white/20">Target: {form.target_amount || "0"} {form.currency}</span>
                    <span className="rounded-full bg-white/10 px-2 py-1 ring-1 ring-white/20">Deadline: {form.deadline || "—"}</span>
                  </div>
                  <div className="mt-3 text-xs text-gray-400">Beneficiary: <code className="break-all">{form.beneficiary || "0x..."}</code></div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Global Styles */}
      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          padding: 12px 14px;
          font-size: 14px;
          line-height: 20px;
          color: white;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          outline: none;
        }
        .input:focus {
          border-color: rgba(99, 102, 241, 0.5);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2);
        }
        .input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }
        .textarea {
          width: 100%;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          padding: 12px 14px;
          font-size: 14px;
          line-height: 20px;
          color: white;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          outline: none;
          resize: vertical;
        }
        .textarea:focus {
          border-color: rgba(99, 102, 241, 0.5);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2);
        }
        .textarea::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 999px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn:hover {
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}
