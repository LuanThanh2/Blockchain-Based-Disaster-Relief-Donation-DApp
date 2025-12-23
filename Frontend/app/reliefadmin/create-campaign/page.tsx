"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = (process?.env?.NEXT_PUBLIC_API_URL as string) || (process?.env?.NEXT_PUBLIC_API_BASE_URL as string) || "http://127.0.0.1:8000";

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

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
      aria-hidden
    />
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
    <label className="block">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium text-slate-900">
          {label} {required ? <span className="text-rose-600">*</span> : null}
        </div>
        {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
      </div>
      <div className="mt-2">{children}</div>
      {error ? <div className="mt-1 text-xs text-rose-600">{error}</div> : null}
    </label>
  );
}

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
  const [serverErrorDetails, setServerErrorDetails] = useState<any>(null);

  // ✅ new: store DB id + onchain id + onchain progress status
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [onchainId, setOnchainId] = useState<number | null>(null);
  const [onchainStatus, setOnchainStatus] = useState<"idle" | "pending" | "done">("idle");

  // ✅ redirect logic:
  // - if not createOnChain: redirect after success
  // - if createOnChain: wait until we have BOTH txHash + onchainId, then redirect
  useEffect(() => {
    if (!success) return;

    if (!form.createOnChain) {
      const t = setTimeout(() => router.push("/reliefadmin/dashboard"), 3000);
      return () => clearTimeout(t);
    }

    if (txHash && onchainId !== null) {
      const t = setTimeout(() => router.push("/reliefadmin/dashboard"), 3000);
      return () => clearTimeout(t);
    }
  }, [success, router, form.createOnChain, txHash, onchainId]);

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
    if (!/^0x[a-fA-F0-9]{40}$/.test(form.beneficiary.trim())) return "Địa chỉ beneficiary không hợp lệ";
    if (form.deadline && isNaN(Date.parse(form.deadline))) return "Deadline không hợp lệ";
    if (!isImageUrlValid) return "Image URL không hợp lệ (cần http/https)";
    return null;
  };

  const canSubmit = useMemo(() => {
    if (loading) return false;
    return validate() === null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setError(null);
    setSuccess(false);
    setTxHash(null);
    setCampaignId(null);
    setOnchainId(null);
    setOnchainStatus("idle");

    console.log('[CreateCampaign] handleSubmit clicked', { form });

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
        // convert date-only (YYYY-MM-DD) to full ISO datetime so backend pydantic can parse
        deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
        createOnChain: form.createOnChain,
      };

      console.log('[CreateCampaign] sending payload', payload);

      const res = await fetch(`${API_URL}/api/v1/campaigns/`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // đọc json nếu có, fallback text/status
        let msg = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          // lưu chi tiết trả về từ server để debug
          setServerErrorDetails(data);
          msg = data?.detail || data?.error || JSON.stringify(data);
        } catch {
          try {
            const t = await res.text();
            if (t) msg = t;
          } catch {}
        }
        console.error('[CreateCampaign] server returned error', { status: res.status, msg });
        throw new Error(msg);
      }

      const data = await res.json();
      console.log('[CreateCampaign] server response json', data);
      setServerErrorDetails(null);

      const createdId = (data?.id ?? null) as number | null;
      setCampaignId(createdId);

      // In case backend returns immediately (rare), set them now.
      setTxHash(data?.contract_tx_hash || data?.txHash || null);
      setOnchainId(data?.onchain_id ?? null);

      setSuccess(true);

      // If createOnChain is enabled, backend runs on-chain in background.
      // Poll campaign detail to fetch contract_tx_hash + onchain_id when available.
      if (form.createOnChain && createdId) {
        setOnchainStatus("pending");

        const startedAt = Date.now();
        const timeoutMs = 60_000; // 60s
        const intervalMs = 1500;

        while (Date.now() - startedAt < timeoutMs) {
          try {
            const r = await fetch(`${API_URL}/api/v1/campaigns/${createdId}`);
            if (r.ok) {
              const latest = await r.json();
              const latestTx = latest?.contract_tx_hash || null;
              const latestOnchainId = latest?.onchain_id ?? null;

              if (latestTx) setTxHash(latestTx);
              if (latestOnchainId !== null && latestOnchainId !== undefined) setOnchainId(latestOnchainId);

              if (latestTx && (latestOnchainId !== null && latestOnchainId !== undefined)) {
                setOnchainStatus("done");
                break;
              }
            }
          } catch {
            // ignore and retry
          }

          await new Promise((rr) => setTimeout(rr, intervalMs));
        }
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Tạo Campaign
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Điền thông tin cơ bản, đặt mục tiêu gây quỹ và (tuỳ chọn) tạo on-chain qua backend deployer.
            </p>
          </div>

          <button
            onClick={() => router.push("/reliefadmin/dashboard")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Về Dashboard
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="space-y-6">
              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <div className="font-semibold">Không thể tạo campaign</div>
                  <div className="mt-1 text-sm">{error}</div>
                </div>
              )}

              {serverErrorDetails && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <div className="font-semibold">Chi tiết server</div>
                  <div className="mt-2 text-xs text-amber-900">
                    {serverErrorDetails?.detail ? (
                      <span>
                        detail: <code>{String(serverErrorDetails.detail)}</code>
                      </span>
                    ) : serverErrorDetails?.error ? (
                      <span>
                        error: <code>{String(serverErrorDetails.error)}</code>
                      </span>
                    ) : null}
                  </div>
                  <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-white p-3 text-xs text-slate-800 shadow-inner ring-1 ring-slate-200">
                    {JSON.stringify(serverErrorDetails, null, 2)}
                  </pre>
                </div>
              )}

              {success && (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  <div className="font-semibold">Tạo campaign thành công</div>

                  {campaignId !== null && (
                    <div className="mt-1 text-xs">
                      DB ID: <code>{campaignId}</code>
                    </div>
                  )}

                  {form.createOnChain && (
                    <div className="mt-2 text-xs text-slate-700">
                      On-chain:{" "}
                      {onchainStatus === "pending" && !txHash ? (
                        <span>Đang xử lý… (backend đang gửi tx)</span>
                      ) : onchainStatus === "pending" && txHash ? (
                        <span>Đã có tx, đang chờ cập nhật onchain_id…</span>
                      ) : onchainStatus === "done" ? (
                        <span>Hoàn tất ✅</span>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  )}

                  {onchainId !== null && (
                    <div className="mt-1 text-xs">
                      On-chain ID: <code>{onchainId}</code>
                    </div>
                  )}

                  {txHash && (
                    <div className="mt-1 text-xs">
                      Tx: <code className="break-all">{txHash}</code>
                      <div className="mt-1">
                        <a
                          className="underline"
                          target="_blank"
                          rel="noreferrer"
                          href={`https://sepolia.etherscan.io/tx/${txHash}`}
                        >
                          Mở trên Etherscan
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 text-sm text-slate-600">
                    Chuyển hướng tới dashboard trong 3 giây...
                  </div>
                </div>
              )}

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Tiêu đề" hint="Ngắn gọn, rõ ràng." required>
                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Ví dụ: Hỗ trợ đồng bào vùng lũ"
                    className="input"
                  />
                </Field>

                <Field label="Mục tiêu (ETH)" hint="Số tiền cần gây quỹ." required>
                  <input
                    name="target_amount"
                    value={form.target_amount}
                    onChange={handleChange}
                    placeholder="Ví dụ: 1.5"
                    inputMode="decimal"
                    className="input"
                  />
                </Field>

                <Field label="Mô tả ngắn" hint="1–2 câu tóm tắt để hiển thị ở danh sách." required>
                  <input
                    name="short_desc"
                    value={form.short_desc}
                    onChange={handleChange}
                    placeholder="Ví dụ: Gây quỹ khẩn cấp cho nhu yếu phẩm"
                    className="input"
                  />
                </Field>

                <Field label="Deadline" hint="Ngày kết thúc (YYYY-MM-DD)." required>
                  <input
                    name="deadline"
                    type="date"
                    value={form.deadline}
                    onChange={handleChange}
                    className="input"
                  />
                </Field>
              </div>

              <Field label="Mô tả chi tiết" hint="Nêu rõ mục tiêu, phạm vi hỗ trợ, cách sử dụng quỹ." required>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Viết mô tả chi tiết tại đây..."
                  rows={6}
                  className="textarea"
                />
              </Field>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field
                  label="Ảnh cover (URL)"
                  hint="Dán link https://... để có ảnh đại diện."
                  error={!isImageUrlValid ? "URL không hợp lệ (cần http/https)." : undefined}
                >
                  <input
                    name="image_url"
                    value={form.image_url}
                    onChange={handleChange}
                    placeholder="https://images..."
                    className="input"
                  />
                </Field>

                <Field label="Beneficiary (ví nhận)" hint="Địa chỉ 0x... (40 hex)." required>
                  <input
                    name="beneficiary"
                    value={form.beneficiary}
                    onChange={handleChange}
                    placeholder="0x..."
                    className="input font-mono"
                  />
                </Field>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">Tạo on-chain</div>
                  <div className="mt-1 text-xs text-slate-600">
                    Nếu bật, backend sẽ gửi tx tạo campaign trên contract (chạy background).
                  </div>
                </div>

                <label className="inline-flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    name="createOnChain"
                    checked={form.createOnChain}
                    onChange={handleChange}
                    className="h-5 w-5 rounded border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-800">
                    {form.createOnChain ? "Bật" : "Tắt"}
                  </span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={[
                    "w-full rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm transition",
                    canSubmit
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "cursor-not-allowed bg-slate-200 text-slate-500",
                  ].join(" ")}
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner />
                      Đang tạo...
                    </span>
                  ) : (
                    "Tạo Campaign"
                  )}
                </button>
              </div>
            </div>
          </form>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Preview</div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <div className="aspect-[16/9] w-full bg-slate-100">
                  {form.image_url.trim() && isImageUrlValid ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.image_url.trim()}
                      alt="cover"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">
                      Chưa có ảnh / URL không hợp lệ
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="text-base font-semibold text-slate-900">
                    {form.title.trim() || "Tiêu đề sẽ hiển thị ở đây"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {form.short_desc.trim() || "Mô tả ngắn sẽ hiển thị ở đây..."}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                      Target: {form.target_amount || "0"} {form.currency}
                    </span>
                    <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                      Deadline: {form.deadline || "—"}
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Beneficiary:{" "}
                    <code className="break-all">{form.beneficiary.trim() || "0x..."}</code>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Ghi chú</div>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
                <li>Backend yêu cầu deadline là datetime ISO, UI tự convert từ date.</li>
                <li>Nếu bật on-chain: backend sẽ chạy background và cập nhật tx_hash/onchain_id sau.</li>
                <li>Donate/withdraw trên UI nên dùng <code>onchain_id</code>, không dùng DB <code>id</code>.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 16px;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 12px 14px;
          font-size: 14px;
          line-height: 20px;
          color: rgb(15 23 42);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          outline: none;
        }
        .input:focus {
          border-color: rgb(148 163 184);
          box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.2);
        }
        .textarea {
          width: 100%;
          border-radius: 16px;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 12px 14px;
          font-size: 14px;
          line-height: 20px;
          color: rgb(15 23 42);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          outline: none;
          resize: vertical;
        }
        .textarea:focus {
          border-color: rgb(148 163 184);
          box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.2);
        }
      `}</style>
    </div>
  );
}
