"use client";

import React from "react";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold mb-4">Relief Admin Dashboard (Test)</h1>
        <p className="mb-4 text-sm text-slate-600">This is a placeholder dashboard page. Replace with real admin UI later.</p>

        <div className="space-y-3">
          <Link href="/reliefadmin/create-campaign" className="inline-block rounded-md bg-slate-900 px-4 py-2 text-white">
            Create Campaign
          </Link>

          <Link href="/reliefs" className="inline-block rounded-md border border-slate-200 px-4 py-2">
            View Relief List
          </Link>
        </div>
      </div>
    </div>
  );
}
