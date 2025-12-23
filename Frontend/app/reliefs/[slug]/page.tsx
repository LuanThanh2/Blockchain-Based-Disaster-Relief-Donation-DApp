import { notFound } from "next/navigation";

type Params = {
  params: {
    slug: string;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default async function Page({ params }: Params) {
  const id = params.slug;

  try {
    const res = await fetch(`${API_BASE}/api/v1/campaigns/${id}`, { cache: "no-store" });
    if (!res.ok) return notFound();
    const data = await res.json();

    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-4xl bg-white rounded-lg p-6">
          <h1 className="text-2xl font-bold">{data.title}</h1>
          <p className="text-sm text-slate-600 mt-2">{data.short_desc}</p>

          <div className="mt-4">
            <div className="text-sm text-slate-700">Target: {data.target_amount} {data.currency}</div>
            <div className="text-sm text-slate-700">Beneficiary: <code>{data.beneficiary}</code></div>
            {data.contract_tx_hash && (
              <div className="mt-2 text-xs">Tx: <a className="underline" target="_blank" rel="noreferrer" href={`https://sepolia.etherscan.io/tx/${data.contract_tx_hash}`}>{data.contract_tx_hash}</a></div>
            )}
          </div>

          <div className="mt-6">
            <h3 className="font-semibold">Description</h3>
            <div className="mt-2 text-sm text-slate-700 whitespace-pre-line">{data.description}</div>
          </div>
        </div>
      </div>
    );
  } catch (err) {
    return notFound();
  }
}
