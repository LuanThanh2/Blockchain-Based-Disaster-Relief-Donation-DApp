"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

type CampaignSummary = {
  id: number;
  title: string;
  short_desc?: string;
  target_amount?: number;
  currency?: string;
  image_url?: string;
  onchain_id?: number | null;
};

const API_BASE = (process?.env?.NEXT_PUBLIC_API_BASE_URL as string) || (process?.env?.NEXT_PUBLIC_API_URL as string) || "http://127.0.0.1:8000";

export default function ReliefsPage() {
  const [items, setItems] = useState<CampaignSummary[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/campaigns/`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mounted) setItems(data || []);
      } catch (e) {
        console.error("Failed to load campaigns", e);
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold mb-4">Danh sách Campaign</h1>

        {loading ? (
          <div>Đang tải...</div>
        ) : items && items.length > 0 ? (
          <div className="grid gap-4">
            {items.map((c) => (
              <div key={c.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-lg">{c.title}</div>
                    <div className="text-sm text-slate-600">{c.short_desc}</div>
                  </div>
                  <div className="text-sm text-slate-500">Target: {c.target_amount ?? 0} {c.currency || 'ETH'}</div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href={`/reliefs/${c.onchain_id ?? c.id}`} className="px-3 py-1 rounded border">Xem chi tiết</Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-600">Không có campaign nào. Bạn có thể tạo campaign trong dashboard.</div>
        )}
      </div>
    </div>
  );
}
