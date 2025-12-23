"use client";

import React, { useEffect, useState } from "react";
import { ethers } from "ethers";

declare let window: any;

export default function DonatePage() {
  const [campaignId, setCampaignId] = useState("");
  const [amount, setAmount] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [address, setAddress] = useState("");
  const [balance, setBalance] = useState("0");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
  const CONTRACT_ABI = ["function donate(uint256 campaignId) payable"];

  const connectWallet = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not installed");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const addr = await signer.getAddress();
      setAddress(addr);
      setWalletConnected(true);

      const bal = await provider.getBalance(addr);
      setBalance(ethers.utils.formatEther(bal));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDonate = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not connected");
      setError("");
      setTxHash("");
      setLoading(true);

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await contract.donate(campaignId, {
        value: ethers.utils.parseEther(amount),
      });
      setTxHash(tx.hash);
      await tx.wait();
      alert("Donation successful!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-16 p-8 card space-y-6">
      <h1 className="text-2xl font-bold text-center">🚀 Donate ETH</h1>

      {!walletConnected ? (
        <button
          onClick={connectWallet}
          className="btn btn-primary w-full"
        >
          Connect Wallet
        </button>
      ) : (
        <div className="text-sm text-gray-300 text-center">
          <div>Connected: {address}</div>
          <div>Balance: {balance} ETH</div>
        </div>
      )}

      <div className="space-y-3">
        <input
          type="text"
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
      </div>

      <button
        onClick={handleDonate}
        disabled={!walletConnected || loading}
        className="btn btn-primary w-full"
      >
        {loading ? "⏳ Sending..." : "Donate"}
      </button>

      {txHash && (
        <p className="text-sm text-green-400 text-center">
          ✅ Tx Hash:{" "}
          <a
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            className="underline"
          >
            {txHash.slice(0, 10)}...{txHash.slice(-6)}
          </a>
        </p>
      )}

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
    </div>
  );
}
