"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ethers } from "ethers";
import DonateCard from "../../../components/DonateCard";
import ProgressBar from "../../../components/ProgressBar";
import TransactionHistory from "../../../components/TransactionHistory";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const CONTRACT_ADDRESS = "0x8DB43031693D2d9A45bAE5e0d1E4c01e74B98cdE";
const CONTRACT_ABI = ["function donate(uint256 campaignId) external payable"];

type Campaign = {
  id: number;
  title: string;
  short_desc?: string;
  image_url?: string;
  target_amount: number;
  total_raised: number;
  donor_count?: number;
  onchain_id: number;
};

// Type definitions moved to types/ethereum.d.ts

export default function DonatePage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [copied, setCopied] = useState(false);

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      // Guest chưa đăng nhập - redirect về login
      router.replace("/login");
      return;
    }
  }, [router]);

  // Fetch campaign stats
  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        // Try /stats endpoint first, fallback to basic endpoint
        let res = await fetch(`${API_URL}/api/v1/campaigns/${campaignId}/stats`);
        if (res.ok) {
          const data = await res.json();
          setCampaign(data);
          return;
        }
        
        // Fallback: fetch basic campaign and donations separately
        res = await fetch(`${API_URL}/api/v1/campaigns/${campaignId}`);
        if (res.ok) {
          const campaignData = await res.json();
          
          // Fetch donations to calculate stats
          try {
            const donationsRes = await fetch(`${API_URL}/api/v1/campaigns/${campaignId}/donations`);
            const donations = donationsRes.ok ? await donationsRes.json() : [];
            
            const total_raised = donations.reduce((sum: number, d: any) => sum + (d.amount_eth || 0), 0);
            const donor_count = new Set(donations.map((d: any) => d.donor_address)).size;
            
            setCampaign({
              ...campaignData,
              total_raised: total_raised || 0,
              donor_count: donor_count || 0,
              donation_count: donations.length || 0,
            });
          } catch {
            // If donations fetch fails, use campaign data without stats
            setCampaign({
              ...campaignData,
              total_raised: 0,
              donor_count: 0,
              donation_count: 0,
            });
          }
        } else {
          console.error("Failed to fetch campaign", res.status);
        }
      } catch (err) {
        console.error("Error fetching campaign:", err);
      }
    };
    fetchCampaign();
  }, [campaignId]);

  // Check existing wallet connection
  useEffect(() => {
    const checkWallet = async () => {
      if (typeof window === "undefined" || typeof window.ethereum === "undefined") return;
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          await checkNetwork();
        }
      } catch (err) {
        console.error("Error checking wallet:", err);
      }
    };
    checkWallet();
  }, []);

  // Listen for account / chain changes
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.ethereum === "undefined") return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        checkNetwork();
      } else {
        setWalletAddress(null);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (!window.ethereum) return;
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  const checkNetwork = async () => {
    if (typeof window === "undefined" || typeof window.ethereum === "undefined") return;
    try {
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      setWrongNetwork(chainId !== "0xaa36a7"); // Sepolia
    } catch (err) {
      console.error("Error checking network:", err);
    }
  };

  const connectWallet = async () => {
    if (typeof window === "undefined" || typeof window.ethereum === "undefined") {
      setError("Vui lòng cài đặt MetaMask!");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWalletAddress(accounts[0]);
      await checkNetwork();
    } catch (err: any) {
      console.error("Error connecting wallet:", err);
      setError(err?.message || "Không thể kết nối ví");
    } finally {
      setIsConnecting(false);
    }
  };

  const switchToSepolia = async () => {
    if (typeof window === "undefined" || typeof window.ethereum === "undefined") return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
    } catch (err: any) {
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xaa36a7",
                chainName: "Sepolia Testnet",
                rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
                nativeCurrency: {
                  name: "ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
        } catch (addErr) {
          console.error("Error adding Sepolia:", addErr);
        }
      }
    }
  };

  const handleDonate = async () => {
    if (!walletAddress) {
      setError("Vui lòng kết nối ví trước!");
      return;
    }

    if (wrongNetwork) {
      setError("Vui lòng chuyển sang Sepolia Testnet!");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Vui lòng nhập số tiền hợp lệ");
      return;
    }

    if (!campaign || !campaign.onchain_id) {
      setError("Campaign chưa được tạo on-chain");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setTxHash(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await contract.donate(campaign.onchain_id, {
        value: ethers.parseEther(amount),
      });

      console.log("Transaction sent:", tx.hash);
      setTxHash(tx.hash);

      await tx.wait();

      console.log("Transaction confirmed!");
      setSuccess(true);

      setTimeout(async () => {
        await fetch(`${API_URL}/api/v1/campaigns/${campaignId}/sync-donations`, {
          method: "POST",
        });
      }, 2000);
    } catch (err: any) {
      console.error("Error donating:", err);
      setError(err?.message || "Có lỗi xảy ra khi quyên góp");
    } finally {
      setLoading(false);
    }
  };

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
          <p className="mt-4 text-gray-600">Đang tải thông tin...</p>
        </div>
      </div>
    );
  }

  const remaining = Math.max(campaign.target_amount - campaign.total_raised, 0);
  const progressPercent = Math.min(
    (campaign.total_raised / campaign.target_amount) * 100,
    100
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition"
          >
            <span>←</span>
            <span>Quay lại</span>
          </button>
        </div>

        {/* Layout 2 cột */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
          
          {/* Cột trái - Thông tin chiến dịch */}
          <div className="space-y-6">
            {/* Campaign Image */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {campaign.image_url ? (
                <img
                  src={campaign.image_url}
                  alt={campaign.title}
                  className="w-full h-64 object-cover"
                />
              ) : (
                <div className="w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <span className="text-6xl">🌍</span>
                </div>
              )}
            </div>

            {/* Campaign Info Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                {campaign.title}
              </h1>
              
              {campaign.short_desc && (
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {campaign.short_desc}
                </p>
              )}

              {/* Progress Bar */}
              <div className="mb-6">
                <ProgressBar
                  current={campaign.total_raised}
                  target={campaign.target_amount}
                  showRemaining={true}
                />
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Đã quyên góp</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {campaign.total_raised.toFixed(2)} ETH
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Mục tiêu</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {campaign.target_amount.toFixed(2)} ETH
                  </p>
                </div>
              </div>

              {/* Donor Count & On-chain Info */}
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 pt-6 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-lg">👥</span>
                  <div>
                    <p className="font-semibold text-gray-900">Donors</p>
                    <p>{campaign.donor_count ?? 0} người đã quyên góp</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">#</span>
                  <div>
                    <p className="font-semibold text-gray-900">Chiến dịch on-chain</p>
                    <p className="font-mono text-xs">ID: {campaign.onchain_id}</p>
                  </div>
                </div>
              </div>

              {/* Smart Contract Address */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">
                  Địa chỉ smart contract
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-mono text-gray-800 break-all">
                    {CONTRACT_ADDRESS}
                  </code>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(CONTRACT_ADDRESS);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      } catch {
                        // ignore
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    {copied ? "✓ Đã copy" : "📋 Copy"}
                  </button>
                  <a
                    href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Xem trên Etherscan →
                  </a>
                </div>
              </div>
            </div>

            {/* Network Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <p className="text-xs font-semibold text-blue-900 mb-1 flex items-center gap-2">
                <span>🔗</span> Ethereum Sepolia Testnet
              </p>
              <p className="text-xs text-blue-700">
                Giao dịch của bạn sẽ được ghi nhận on-chain và có thể kiểm tra trên Etherscan.
              </p>
            </div>

            {/* Transaction History */}
            <TransactionHistory campaignId={parseInt(campaignId)} />
          </div>

          {/* Cột phải - Donate Card */}
          <div>
            <DonateCard
              walletAddress={walletAddress}
              isConnecting={isConnecting}
              wrongNetwork={wrongNetwork}
              amount={amount}
              loading={loading}
              success={success}
              error={error}
              txHash={txHash}
              onConnectWallet={connectWallet}
              onSwitchNetwork={switchToSepolia}
              onAmountChange={setAmount}
              onDonate={handleDonate}
              onViewCampaign={() => router.push(`/campaigns/${campaignId}`)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

