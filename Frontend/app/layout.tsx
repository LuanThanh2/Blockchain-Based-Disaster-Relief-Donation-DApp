import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Disaster Relief DApp - Blockchain-Based Donation Platform",
  description: "Nền tảng quyên góp cứu trợ minh bạch và phi tập trung trên blockchain",
};

import Header from "./components/Header";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="scroll-smooth">
      <body className="antialiased text-gray-900 bg-gray-50 min-h-screen">
        <Header />
        <main className="px-6 py-10 max-w-7xl mx-auto w-full">{children}</main>
      </body>
    </html>
  );
}
