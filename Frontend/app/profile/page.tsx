"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000";

function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function getUserRole() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("role");
}

function getUsername() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("username");
}

interface UserProfile {
  id: number;
  username: string;
  email: string | null;
  role: string;
  wallet_address: string | null;
  created_at: string | null;
}

// Type definitions moved to types/ethereum.d.ts

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();

    // Nếu chưa đăng nhập
    if (!token) {
      router.replace("/login");
      return;
    }

    // Fetch profile từ API
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          if (res.status === 401) {
            // Token không hợp lệ, redirect về login
            localStorage.removeItem("access_token");
            localStorage.removeItem("role");
            localStorage.removeItem("username");
            router.replace("/login");
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        setProfile(data);
      } catch (err: any) {
        console.error("Failed to fetch profile:", err);
        setError("Không thể tải thông tin profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    router.replace("/reliefs");
  };

  const connectWallet = async () => {
    if (typeof window === "undefined" || typeof window.ethereum === "undefined") {
      setWalletError("Vui lòng cài đặt MetaMask!");
      return;
    }

    setIsConnectingWallet(true);
    setWalletError(null);

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length === 0) {
        throw new Error("Không có tài khoản nào được chọn");
      }

      const walletAddress = accounts[0].toLowerCase();

      // Save to backend
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/api/v1/auth/me/wallet`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ wallet_address: walletAddress }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({
          detail: `HTTP ${res.status}`,
        }));
        throw new Error(errorData.detail || "Không thể lưu địa chỉ ví");
      }

      // Update profile state
      if (profile) {
        setProfile({ ...profile, wallet_address: walletAddress });
      }

      // Also fetch updated profile
      const profileRes = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (profileRes.ok) {
        const updatedProfile = await profileRes.json();
        setProfile(updatedProfile);
      }
    } catch (err: any) {
      console.error("Error connecting wallet:", err);
      setWalletError(err.message || "Không thể kết nối ví");
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const disconnectWallet = async () => {
    const token = getAccessToken();
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/me/wallet`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Không thể xóa liên kết ví");
      }

      // Update profile state
      if (profile) {
        setProfile({ ...profile, wallet_address: null });
      }
    } catch (err: any) {
      console.error("Error disconnecting wallet:", err);
      setError(err.message || "Không thể xóa liên kết ví");
    }
  };

  const formatWalletAddress = (address: string | null) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-black to-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
          <div>Đang tải thông tin...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-black to-slate-900 text-white">
        <div className="text-center">
          <div className="text-red-500 mb-4">❌ {error}</div>
          <button
            onClick={() => router.push("/reliefs")}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-semibold transition"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-8">👤 Thông tin tài khoản</h1>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Thông tin cơ bản */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>📋</span> Thông tin cơ bản
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">Tên đăng nhập</label>
                <div className="mt-1 text-lg font-medium">{profile.username}</div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Email</label>
                <div className="mt-1 text-lg font-medium">
                  {profile.email || (
                    <span className="text-gray-500 italic">Chưa cập nhật</span>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Vai trò</label>
                <div className="mt-1">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      profile.role === "admin"
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/50"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/50"
                    }`}
                  >
                    {profile.role === "admin" ? "👑 Admin" : "👤 User"}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Ngày tạo tài khoản</label>
                <div className="mt-1 text-sm text-gray-300">
                  {formatDate(profile.created_at)}
                </div>
              </div>
            </div>
          </div>

          {/* Liên kết ví */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>🦊</span> Ví Ethereum
            </h2>
            <div className="space-y-4">
              {profile.wallet_address ? (
                <>
                  <div>
                    <label className="text-sm text-gray-400">Địa chỉ ví đã liên kết</label>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="font-mono text-sm font-medium text-emerald-400">
                        {formatWalletAddress(profile.wallet_address)}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(profile.wallet_address || "");
                          alert("Đã sao chép địa chỉ ví!");
                        }}
                        className="text-xs text-gray-400 hover:text-gray-300 transition"
                        title="Sao chép"
                      >
                        📋
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 font-mono break-all">
                      {profile.wallet_address}
                    </div>
                  </div>
                  <button
                    onClick={disconnectWallet}
                    className="w-full px-4 py-2 rounded-lg bg-red-600/20 text-red-400 border border-red-600/50 hover:bg-red-600/30 transition text-sm font-medium"
                  >
                    🔌 Ngắt kết nối ví
                  </button>
                </>
              ) : (
                <>
                  <div className="text-sm text-gray-400 mb-4">
                    Chưa liên kết ví. Liên kết ví để quyên góp và xem lịch sử giao dịch.
                  </div>
                  <button
                    onClick={connectWallet}
                    disabled={isConnectingWallet}
                    className="w-full px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition font-semibold flex items-center justify-center gap-2"
                  >
                    {isConnectingWallet ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                        Đang kết nối...
                      </>
                    ) : (
                      <>
                        <span>🦊</span>
                        Kết nối MetaMask
                      </>
                    )}
                  </button>
                  {walletError && (
                    <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                      {walletError}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Quyền hạn */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>🔐</span> Quyền hạn
            </h2>
            <div className="space-y-3">
              {profile.role === "admin" ? (
                <>
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span>
                    <span>Tạo và quản lý campaigns</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span>
                    <span>Xem dashboard admin</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span>
                    <span>Rút tiền từ campaigns</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span>
                    <span>Xuất báo cáo</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span>
                    <span>Quyên góp cho campaigns</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span>
                    <span>Xem danh sách campaigns</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span>
                    <span>Tạo campaigns</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span>
                    <span>Quyên góp cho campaigns</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <span>✗</span>
                    <span>Tạo campaign on-chain (chỉ admin)</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <span>✗</span>
                    <span>Rút tiền từ campaigns (chỉ admin)</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <span>✗</span>
                    <span>Truy cập dashboard admin (chỉ admin)</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Thống kê */}
        {profile.role !== "admin" && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>📊</span> Thống kê
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <div className="text-2xl font-bold text-emerald-400">
                  <Link
                    href="/user/donations"
                    className="hover:text-emerald-300 transition"
                  >
                    Lịch sử quyên góp
                  </Link>
                </div>
                <div className="text-sm text-gray-400 mt-1">Xem chi tiết</div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-wrap gap-4">
          {profile.role === "admin" && (
            <button
              onClick={() => router.push("/reliefadmin/dashboard")}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-semibold transition"
            >
              🏠 Về Dashboard
            </button>
          )}
          {profile.role !== "admin" && (
            <button
              onClick={() => router.push("/user/donations")}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold transition"
            >
              💝 Lịch sử quyên góp
            </button>
          )}
          <button
            onClick={() => router.push("/reliefs")}
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold transition"
          >
            📋 Xem Campaigns
          </button>
          {!profile.email && (
            <button
              onClick={() => router.push("/forgot-password")}
              className="px-6 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-700 font-semibold transition"
            >
              📧 Cập nhật Email
            </button>
          )}
          <button
            onClick={handleLogout}
            className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 font-semibold transition"
          >
            🚪 Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}

