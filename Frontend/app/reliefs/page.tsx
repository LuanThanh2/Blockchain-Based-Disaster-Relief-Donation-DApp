"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Campaign = {
  id: number;
  title: string;
  short_desc: string;
  target_amount: string;
  deadline: string;
};

export default function ReliefsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const res = await fetch("/api/campaigns"); // Thay URL API backend của bạn
        const data = await res.json();
        setCampaigns(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchCampaigns();
  }, []);

  if (loading) return <div className="text-center mt-10">Loading campaigns...</div>;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((c) => (
        <Link
          key={c.id}
          href={`/reliefs/${c.id}`}
          className="block p-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur hover:scale-[1.02] transition-transform shadow-lg"
        >
          <h2 className="text-lg font-bold mb-2">{c.title}</h2>
          <p className="text-sm text-gray-300 mb-2">{c.short_desc}</p>
          <div className="flex justify-between text-xs text-gray-400">
            <span>🎯 {c.target_amount} ETH</span>
            <span>⏰ {c.deadline}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
