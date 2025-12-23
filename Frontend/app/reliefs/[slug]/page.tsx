"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Campaign = {
  id: number;
  title: string;
  description: string;
  target_amount: string;
  deadline: string;
  beneficiary: string;
};

export default function CampaignDetailPage() {
  const params = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    async function fetchCampaign() {
      try {
        const res = await fetch(`/api/campaigns/${params.slug}`);
        const data = await res.json();
        setCampaign(data);
      } catch (err) {
        console.error(err);
      }
    }
    fetchCampaign();
  }, [params.slug]);

  if (!campaign) return <div className="text-center mt-10">Loading campaign...</div>;

  return (
    <div className="mx-auto max-w-3xl p-6 bg-white/5 rounded-3xl backdrop-blur border border-white/10 shadow-lg">
      <h1 className="text-2xl font-bold mb-3">{campaign.title}</h1>
      <p className="text-gray-300 mb-4">{campaign.description}</p>

      <div className="flex gap-4 mb-4 text-sm text-gray-400">
        <span>🎯 Target: {campaign.target_amount} ETH</span>
        <span>⏰ Deadline: {campaign.deadline}</span>
        <span>👤 Beneficiary: {campaign.beneficiary}</span>
      </div>

      <Link
        href="/user/donate"
        className="inline-block rounded-xl px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:opacity-90 transition"
      >
        Donate Now
      </Link>
    </div>
  );
}
