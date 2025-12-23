"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

export default function ReliefsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/v1/campaigns")
      .then((res) => res.json())
      .then((data) => setCampaigns(data));
  }, []);

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((c) => {
        const percent = Math.min(
          (c.raised_amount / c.target_amount) * 100,
          100
        );
        return (
          <div key={c.id} className="card hover:scale-105 transition transform cursor-pointer">
            <img
              src={c.image_url || "/placeholder.png"}
              className="h-48 w-full object-cover rounded-xl mb-4"
              alt={c.title}
            />
            <h2 className="text-lg font-bold">{c.title}</h2>
            <p className="text-sm text-gray-300 mb-3">{c.short_desc}</p>

            <div className="h-3 w-full bg-white/20 rounded-full overflow-hidden mb-2">
              <div
                className="h-3 bg-gradient-to-r from-indigo-400 to-purple-500 transition-all"
                style={{ width: `${percent}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-300 mb-3">
              {c.raised_amount} / {c.target_amount} ETH
            </div>

            <Link
              href={`/reliefs/${c.slug}`}
              className="btn btn-primary w-full text-center"
            >
              View & Donate
            </Link>
          </div>
        );
      })}
    </div>
  );
}
