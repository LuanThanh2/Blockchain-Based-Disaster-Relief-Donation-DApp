"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function getUserRole() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("role");
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = getAccessToken();
    const role = getUserRole();

    // Nếu chưa đăng nhập
    if (!token) {
      router.replace("/login");
      return;
    }

    // Chỉ admin mới được truy cập khu vực /reliefadmin
    if (role !== "admin" && pathname.startsWith("/reliefadmin")) {
      alert("Bạn không có quyền truy cập khu vực admin");
      router.replace("/reliefs");
      return;
    }
  }, [router, pathname]);

  return <>{children}</>;
}