import { apiUrl } from "./apiBase";

export type HealthResponse = {
  status: string;
} & Record<string, unknown>;

export type CreateCampaignRequest = {
  title: string;
  description: string;
  goal_eth?: string;
  goal_wei?: number;
};

export type CreateCampaignResponse = {
  tx_hash: string;
  status: string;
};

export async function health(): Promise<HealthResponse> {
  const res = await fetch(apiUrl("/health"), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return (await res.json()) as HealthResponse;
}

export async function createCampaign(payload: CreateCampaignRequest): Promise<CreateCampaignResponse> {
  const res = await fetch(apiUrl("/campaigns"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as CreateCampaignResponse & { detail?: unknown };

  if (!res.ok) {
    throw new Error(typeof data?.detail === "string" ? data.detail : `Create campaign failed: ${res.status}`);
  }

  return data;
}
