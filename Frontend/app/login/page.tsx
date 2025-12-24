"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    // ===== DEMO LOGIN =====
    if (username === "admin" && password === "admin123") {
      localStorage.setItem("access_token", "demo-admin-token");
      localStorage.setItem("role", "admin");
      router.replace("/reliefadmin");
      return;
    }

    if (username === "user" && password === "user123") {
      localStorage.setItem("access_token", "demo-user-token");
      localStorage.setItem("role", "user");
      router.replace("/");
      return;
    }

    alert("Sai tài khoản hoặc mật khẩu");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-sm rounded-2xl bg-white/5 p-6">
        <h1 className="mb-4 text-xl font-bold text-center">Login</h1>

        <input
          className="mb-3 w-full rounded-lg p-2 text-black"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          className="mb-4 w-full rounded-lg p-2 text-black"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleLogin}
          className="w-full rounded-lg bg-indigo-600 py-2 font-semibold"
        >
          Login
        </button>

        <div className="mt-4 text-xs text-gray-300">
          <p>Admin: admin / admin123</p>
          <p>User: user / user123</p>
        </div>
      </div>
    </div>
  );
}
