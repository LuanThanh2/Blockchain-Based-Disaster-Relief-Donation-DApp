"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/v1/campaigns/${params.slug}`)
      .then((res) => res.json())
      .then((data) => setCampaign(data));
  }, [params.slug]);

  if (!campaign) return <p>Loading...</p>;

  const percent = Math.min(
    (campaign.raised_amount / campaign.target_amount) * 100,
    100
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="card space-y-4">
        <img
          src={campaign.image_url || "/placeholder.png"}
          className="w-full h-64 object-cover rounded-2xl"
          alt={campaign.title}
        />
        <h1 className="text-2xl font-bold">{campaign.title}</h1>
        <p className="text-gray-300">{campaign.description}</p>

        <div>
          <div className="h-4 w-full bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-4 bg-gradient-to-r from-indigo-400 to-purple-500 transition-all"
              style={{ width: `${percent}%` }}
            ></div>
          </div>
          <div className="mt-1 text-sm text-gray-300">
            {campaign.raised_amount} / {campaign.target_amount} ETH
          </div>
        </div>

        <div className="flex gap-4 mt-4">
          <Link
            href={`/user/donate?campaignId=${campaign.id}`}
            className="btn btn-primary flex-1 text-center"
          >
            Donate
          </Link>
          <button
            onClick={() => router.back()}
            className="btn flex-1 bg-white text-black"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
