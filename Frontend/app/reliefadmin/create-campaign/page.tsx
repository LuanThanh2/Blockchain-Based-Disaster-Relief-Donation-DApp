"use client";

import React, { useState } from "react";
import { createCampaign } from "@/lib/disasterApi";

export default function CreateCampaignPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goalEth, setGoalEth] = useState("1");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTxHash(null);
    setStatus(null);

    if (!title.trim() || !description.trim() || !goalEth.trim()) {
      setError("Please fill title, description, and goal (ETH).");
      return;
    }

    try {
      setLoading(true);
      const res = await createCampaign({
        title: title.trim(),
        description: description.trim(),
        goal_eth: goalEth.trim(),
      });
      setTxHash(res.tx_hash);
      setStatus(res.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900">Create Campaign</h1>
      <p className="text-sm text-gray-600 mt-1">Creates an on-chain campaign via the backend.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Flood Relief Central Region"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Support families affected by flooding"
            rows={4}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Goal (ETH)</label>
          <input
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            value={goalEth}
            onChange={(e) => setGoalEth(e.target.value)}
            inputMode="decimal"
            placeholder="1"
          />
          <p className="text-xs text-gray-500 mt-1">Example: 0.1</p>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {txHash ? (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <div>tx_hash: {txHash}</div>
            {status ? <div>status: {status}</div> : null}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Campaign"}
        </button>
      </form>
    </div>
  );
}
