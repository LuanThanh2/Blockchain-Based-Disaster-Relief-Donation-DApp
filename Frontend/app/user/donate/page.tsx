"use client";

import { useState } from "react";
import { ethers } from "ethers";

const CONTRACT_ADDRESS = "0xYourContractAddressHere"; // Thay bằng địa chỉ contract
const CONTRACT_ABI = [
  "function donate(uint256 campaignId) public payable",
];

export default function DonatePage() {
  const [campaignId, setCampaignId] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDonate = async () => {
    if (!window.ethereum) {
      setError("MetaMask not detected");
      return;
    }
    setError(null);
    setTxHash(null);

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await contract.donate(campaignId, { value: ethers.parseEther(amount) });
      const receipt = await tx.wait();

      setTxHash(receipt.transactionHash);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Donation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 flex items-center justify-center p-4">
      <div className="mx-auto max-w-xl p-6 bg-white/5 rounded-3xl backdrop-blur border border-white/10 shadow-lg">
        <h1 className="text-2xl font-bold mb-4 text-white">🚀 Donate ETH</h1>

      <div className="space-y-4">
        <input
          type="number"
          placeholder="Campaign ID"
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          className="input"
        />
        <input
          type="text"
          placeholder="Amount (ETH)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input"
        />

        <button
          onClick={handleDonate}
          disabled={loading || !campaignId || !amount}
          className={`w-full rounded-xl py-3 font-semibold transition ${
            !campaignId || !amount
              ? "bg-white/10 text-gray-500 cursor-not-allowed"
              : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white"
          }`}
        >
          {loading ? "⏳ Processing..." : "Donate"}
        </button>

        {txHash && (
          <div className="mt-3 text-sm">
            ✅ Donation sent:{" "}
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              className="underline"
            >
              View on Etherscan
            </a>
          </div>
        )}
        {error && <div className="text-red-400 text-sm">{error}</div>}
      </div>
    </div>
  );
}
