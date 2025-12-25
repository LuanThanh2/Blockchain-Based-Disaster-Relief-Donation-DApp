"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL =
  (process?.env?.NEXT_PUBLIC_API_URL as string) ||
  (process?.env?.NEXT_PUBLIC_API_BASE_URL as string) ||
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
  auto_disburse: boolean;
  disburse_threshold: number;
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

// ===== Field Component =====
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
    auto_disburse: false,
    disburse_threshold: 0.8,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [serverErrorDetails, setServerErrorDetails] = useState<any>(null);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [onchainId, setOnchainId] = useState<number | null>(null);
  const [onchainStatus, setOnchainStatus] = useState<
    "idle" | "pending" | "done"
  >("idle");

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

    setForm((s) => ({
      ...s,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[Create Campaign] Form submitted");
    console.log("[Create Campaign] Form data:", form);
    
    setError(null);
    setSuccess(false);
    setTxHash(null);
    setCampaignId(null);
    setOnchainId(null);
    setOnchainStatus("idle");

    const v = validate();
    console.log("[Create Campaign] Validation result:", v);
    if (v) {
      console.error("[Create Campaign] Validation failed:", v);
      setError(v);
      return;
    }
    
    console.log("[Create Campaign] Validation passed, proceeding...");

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
        auto_disburse: form.auto_disburse,
        disburse_threshold: form.disburse_threshold,
      };

      // Lấy token từ localStorage
      const token = localStorage.getItem("access_token");
      if (!token) {
        setError("Bạn chưa đăng nhập. Vui lòng đăng nhập lại.");
        setLoading(false);
        return;
      }

      console.log("[Create Campaign] Sending request to:", `${API_URL}/api/v1/campaigns/`);
      console.log("[Create Campaign] Payload:", payload);

      const res = await fetch(`${API_URL}/api/v1/campaigns/`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      console.log("[Create Campaign] Response status:", res.status);

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const errorData = await res.json();
          console.error("[Create Campaign] Error response:", errorData);
          setServerErrorDetails(errorData);
          msg = errorData?.detail || errorData?.error || JSON.stringify(errorData);
        } catch (e) {
          console.error("[Create Campaign] Failed to parse error response:", e);
          const text = await res.text();
          console.error("[Create Campaign] Error text:", text);
        }
        throw new Error(msg);
      }

      const data = await res.json();
      setServerErrorDetails(null);
      setCampaignId(data?.id ?? null);
      setTxHash(data?.contract_tx_hash || data?.txHash || null);
      setOnchainId(data?.onchain_id ?? null);
      setSuccess(true);

      // Poll for on-chain status if needed
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
      console.error("[Create Campaign] Error:", err);
      setError(err?.message || String(err));
      setLoading(false);
    }
  };

  // Redirect after success
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => router.push("/reliefadmin/dashboard"), 3000);
    return () => clearTimeout(t);
  }, [success, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Tạo Campaign
            </h1>
            <p className="mt-2 text-sm text-gray-300">
              Điền thông tin cơ bản, đặt mục tiêu gây quỹ và (tuỳ chọn) tạo on-chain qua backend deployer.
            </p>
          </div>

          <button
            onClick={() => router.push("/reliefadmin/dashboard")}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-white/20 backdrop-blur"
          >
            Về Dashboard
          </button>
        </div>

        {/* Main Grid */}
        <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
          {/* Form */}
          <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-6">
            {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
            {success && <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">✅ Tạo campaign thành công</div>}

            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Tiêu đề" hint="Ngắn gọn, rõ ràng." required>
                <input name="title" value={form.title} onChange={handleChange} className="input" placeholder="Ví dụ: Hỗ trợ đồng bào vùng lũ" aria-label="Tiêu đề"/>
              </Field>

              <Field label="Mục tiêu (ETH)" hint="Số tiền cần gây quỹ." required>
                <input name="target_amount" value={form.target_amount} onChange={handleChange} className="input" placeholder="Ví dụ: 1.5" inputMode="decimal" aria-label="Mục tiêu (ETH)"/>
              </Field>

              <Field label="Mô tả ngắn" hint="1–2 câu tóm tắt để hiển thị ở danh sách." required>
                <input name="short_desc" value={form.short_desc} onChange={handleChange} className="input" placeholder="Ví dụ: Gây quỹ khẩn cấp cho nhu yếu phẩm" aria-label="Mô tả ngắn"/>
              </Field>

              <Field label="Deadline" hint="Ngày kết thúc (YYYY-MM-DD)." required>
                <input name="deadline" type="date" value={form.deadline} onChange={handleChange} className="input" aria-label="Deadline"/>
              </Field>

              <Field label="Mô tả chi tiết" hint="Nêu rõ mục tiêu, phạm vi hỗ trợ, cách sử dụng quỹ." required>
                <textarea name="description" value={form.description} onChange={handleChange} rows={6} className="textarea" aria-label="Mô tả chi tiết"/>
              </Field>

              <Field label="Ảnh cover (URL)" error={!isImageUrlValid ? "URL không hợp lệ" : undefined}>
                <input name="image_url" value={form.image_url} onChange={handleChange} placeholder="https://..." className="input" aria-label="Ảnh cover (URL)"/>
              </Field>

              <Field label="Beneficiary (ví nhận)" hint="Địa chỉ 0x... (40 hex)." required>
                <input name="beneficiary" value={form.beneficiary} onChange={handleChange} placeholder="0x..." className="input font-mono" aria-label="Beneficiary (ví nhận)"/>
              </Field>
            </div>

            {/* On-chain toggle */}
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div>
                <div className="text-sm font-medium text-white">Tạo on-chain</div>
                <div className="mt-1 text-xs text-gray-300">
                  Nếu bật, backend sẽ gửi tx tạo campaign trên contract (chạy background).
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-3">
                <input type="checkbox" name="createOnChain" checked={form.createOnChain} onChange={handleChange} className="h-5 w-5 rounded border-white/20 bg-transparent"/>
                <span className="text-sm font-medium text-white">{form.createOnChain ? "Bật" : "Tắt"}</span>
              </label>
            </div>

            {/* Auto-disburse toggle */}
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div>
                <div className="text-sm font-medium text-white">Tự động rút tiền</div>
                <div className="mt-1 text-xs text-gray-300">
                  Tự động rút tiền khi đạt ngưỡng phần trăm mục tiêu.
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-3">
                <input type="checkbox" name="auto_disburse" checked={form.auto_disburse} onChange={handleChange} className="h-5 w-5 rounded border-white/20 bg-transparent"/>
                <span className="text-sm font-medium text-white">{form.auto_disburse ? "Bật" : "Tắt"}</span>
              </label>
            </div>

            {/* Disburse threshold */}
            {form.auto_disburse && (
              <Field label="Ngưỡng tự động rút" hint="Tỷ lệ phần trăm (0.0 - 1.0). Ví dụ: 0.8 = tự động rút khi đạt 80% mục tiêu.">
                <input 
                  name="disburse_threshold" 
                  type="number" 
                  step="0.1" 
                  min="0" 
                  max="1" 
                  value={form.disburse_threshold} 
                  onChange={handleChange} 
                  className="input" 
                  placeholder="0.8"
                  aria-label="Ngưỡng tự động rút"
                />
              </Field>
            )}

            <button type="submit" disabled={!canSubmit} className={`w-full rounded-2xl px-5 py-3 text-sm font-semibold transition ${canSubmit ? "bg-gradient-to-r from-indigo-600 to-purple-700 text-white hover:scale-[1.02]" : "cursor-not-allowed bg-gray-600 text-gray-400"}`}>
              {loading ? <span className="inline-flex items-center gap-2"><Spinner /> Đang tạo...</span> : "Tạo Campaign"}
            </button>
          </form>

          {/* Preview */}
          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm">
              <div className="text-sm font-semibold text-white">Preview</div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <div className="aspect-[16/9] w-full bg-gray-800">
                  {form.image_url.trim() && isImageUrlValid ? (
                    <img src={form.image_url.trim()} alt="cover" className="h-full w-full object-cover"/>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-400">Chưa có ảnh / URL không hợp lệ</div>
                  )}
                </div>
                <div className="p-4">
                  <div className="text-base font-semibold text-white">{form.title.trim() || "Tiêu đề sẽ hiển thị ở đây"}</div>
                  <div className="mt-1 text-sm text-gray-300">{form.short_desc.trim() || "Mô tả ngắn sẽ hiển thị ở đây..."}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300">
                    <span className="rounded-full bg-white/10 px-2 py-1 ring-1 ring-white/20">Target: {form.target_amount || "0"} {form.currency}</span>
                    <span className="rounded-full bg-white/10 px-2 py-1 ring-1 ring-white/20">Deadline: {form.deadline || "—"}</span>
                  </div>
                  <div className="mt-3 text-xs text-gray-400">Beneficiary: <code className="break-all">{form.beneficiary.trim() || "0x..."}</code></div>
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
      `}</style>
    </div>
  );
}
