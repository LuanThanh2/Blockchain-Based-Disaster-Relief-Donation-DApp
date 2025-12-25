"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      alert("Vui lòng nhập tên đăng nhập và mật khẩu");
      return;
    }

    setLoading(true);
    
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 
                       process.env.NEXT_PUBLIC_API_URL || 
                       "http://127.0.0.1:8000";
      
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: "Đăng nhập thất bại" }));
        throw new Error(errorData.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      
      // Lưu token, role và username từ API response
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("username", data.username || username);
      
      // Debug: Log role để kiểm tra
      console.log("[Login] Role saved to localStorage:", data.role);
      console.log("[Login] Full response:", data);
      
      // Dispatch custom event để Header component cập nhật ngay lập tức
      window.dispatchEvent(new Event("login-success"));
      
      // Redirect theo role
      if (data.role === "admin") {
        router.replace("/reliefadmin");
      } else {
        // user hoặc bất kỳ role nào khác
        router.replace("/reliefs");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "Đăng nhập thất bại";
      
      if (error.message) {
        if (error.message.includes("401") || error.message.includes("Invalid credentials")) {
          errorMessage = "Sai tên đăng nhập hoặc mật khẩu";
        } else if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
          errorMessage = "Không thể kết nối đến server. Vui lòng kiểm tra backend đã chạy chưa.";
        } else {
          errorMessage = error.message;
        }
      }
      
      alert(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg fade-in">
        {/* Branding Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold gradient-text mb-3">
            🌍 ReliefChain
          </h1>
          <p className="text-gray-300 text-lg">
            Nền tảng quyên góp cứu trợ minh bạch trên blockchain
          </p>
        </div>

        {/* Login Form */}
        <div className="card p-10">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            🔐 Đăng nhập
          </h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Tên đăng nhập
              </label>
              <input
                className="input w-full text-lg py-3"
                placeholder="Nhập tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Mật khẩu
              </label>
              <input
                type="password"
                className="input w-full text-lg py-3"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              onClick={handleLogin}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleLogin();
                }
              }}
              disabled={loading}
              className="w-full btn btn-primary mt-8 py-4 text-lg"
            >
              {loading ? (
                <>
                  <div className="spinner mr-2" />
                  Đang đăng nhập...
                </>
              ) : (
                "🚀 Đăng nhập"
              )}
            </button>
          </div>

          <div className="mt-8 p-6 bg-white/5 rounded-lg border border-white/10">
            <h3 className="text-sm font-semibold text-white mb-3">
              Tài khoản demo:
            </h3>
            <div className="text-sm text-gray-300 space-y-2">
              <p><strong>Admin:</strong> admin / admin123</p>
              <p><strong>User (Donor):</strong> user / user123</p>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              💡 Guest không cần đăng nhập để xem campaigns
            </p>
          </div>

          {/* Forgot Password Link */}
          <div className="mt-4 text-center">
            <Link
              href="/forgot-password"
              className="text-sm text-indigo-400 hover:text-indigo-300 font-medium underline"
            >
              🔑 Quên mật khẩu?
            </Link>
          </div>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-300">
              Chưa có tài khoản?{" "}
              <Link
                href="/register"
                className="text-indigo-400 hover:text-indigo-300 font-medium underline"
              >
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
