"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

function getRoleDisplayName(role: string | null): string {
  if (!role) return "👤 User";
  
  // Chỉ có 2 role: admin và user
  // Normalize role để tránh case-sensitive issues
  const normalizedRole = role.toLowerCase().trim();
  
  if (normalizedRole === "admin") {
    return "👑 Admin";
  }
  
  return "👤 User"; // user, donor, hoặc bất kỳ role nào khác đều hiển thị là User
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Lấy role và username ngay lập tức
    const initialRole = getUserRole();
    const initialUsername = getUsername();
    console.log("[Header] Initial role from localStorage:", initialRole);
    console.log("[Header] Initial username from localStorage:", initialUsername);
    setRole(initialRole);
    setUsername(initialUsername);
    
    // Listen for storage changes (khi đăng nhập/đăng xuất ở tab khác)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "role") {
        setRole(e.newValue);
      }
      if (e.key === "username") {
        setUsername(e.newValue);
      }
    };
    
    // Polling để cập nhật role và username khi localStorage thay đổi trong cùng tab
    // Giảm interval xuống 500ms để cập nhật nhanh hơn
    const interval = setInterval(() => {
      const newRole = getUserRole();
      const newUsername = getUsername();
      setRole((prevRole) => {
        // Luôn cập nhật nếu khác nhau
        if (prevRole !== newRole) {
          return newRole;
        }
        return prevRole;
      });
      setUsername((prevUsername) => {
        if (prevUsername !== newUsername) {
          return newUsername;
        }
        return prevUsername;
      });
    }, 500);
    
    window.addEventListener("storage", handleStorageChange);
    
    // Cũng listen cho custom event khi đăng nhập thành công
    const handleLoginSuccess = () => {
      const newRole = getUserRole();
      const newUsername = getUsername();
      setRole(newRole);
      setUsername(newUsername);
    };
    
    window.addEventListener("login-success", handleLoginSuccess);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("login-success", handleLoginSuccess);
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    router.replace("/reliefs");
  };

  // Không hiển thị header ở trang login, register, forgot-password và reset-password
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  ) {
    return null;
  }

  return (
    <header className="flex items-center justify-between px-10 py-5 border-b border-gray-200 bg-white shadow-sm">
      <div className="text-2xl font-bold tracking-tight text-gray-900 cursor-default">
        🌍 ReliefChain
      </div>
      <nav className="flex items-center gap-4 text-sm">
        {mounted && role ? (
          <>
            {/* Nút Về Dashboard cho admin khi không ở trang admin */}
            {role === "admin" && !pathname.startsWith("/reliefadmin") && (
              <Link
                href="/reliefadmin"
                className="px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-medium"
              >
                📊 Về Dashboard
              </Link>
            )}
            
            {/* Chỉ admin mới được tạo campaign */}
            {role === "admin" && !pathname.startsWith("/reliefadmin") && (
              <Link
                href="/reliefadmin/create-campaign"
                className="hover:text-emerald-600 transition font-medium"
              >
                ➕ Tạo Campaign
              </Link>
            )}
            
            {/* Audit Logs link cho admin */}
            {role === "admin" && (
              <Link
                href="/reliefadmin/audit-logs"
                className="hover:text-emerald-600 transition font-medium"
              >
                📋 Audit Logs
              </Link>
            )}
            
            {/* Reports link cho admin */}
            {role === "admin" && (
              <Link
                href="/reliefadmin/reports"
                className="hover:text-emerald-600 transition font-medium"
              >
                📊 Reports
              </Link>
            )}
            
            {/* Users Management link cho admin */}
            {role === "admin" && (
              <Link
                href="/reliefadmin/users"
                className="hover:text-emerald-600 transition font-medium"
              >
                👥 Users
              </Link>
            )}
            <span className="text-gray-400">|</span>
            {role !== "admin" && (
              <Link
                href="/user/donations"
                className="text-gray-600 hover:text-emerald-600 transition font-medium"
              >
                Lịch sử quyên góp
              </Link>
            )}
            <Link
              href="/profile"
              className="text-gray-600 hover:text-emerald-600 transition font-medium"
              title={getRoleDisplayName(role)}
            >
              {username ? `👤 ${username}` : getRoleDisplayName(role)}
            </Link>
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 transition text-sm"
            >
              Đăng xuất
            </button>
          </>
        ) : (
          <>
            <Link
              href="/register"
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition font-medium"
            >
              Đăng ký
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition font-medium"
            >
              Đăng nhập
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

