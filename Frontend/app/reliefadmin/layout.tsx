"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    const token = getAccessToken();
    const role = getUserRole();

    if (!token) {
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      alert("Bạn không có quyền truy cập khu vực admin");
      router.replace("/");
    }
  }, [router]);

  return <>{children}</>;
}
