import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Disaster Relief DApp - Blockchain-Based Donation Platform",
  description: "Nền tảng quyên góp cứu trợ minh bạch và phi tập trung trên blockchain",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="scroll-smooth">
      <body className="antialiased text-gray-900 bg-gray-50 min-h-screen">
        <header className="flex items-center justify-between px-10 py-5 border-b border-gray-200 bg-white shadow-sm">
          <Link href="/" className="text-2xl font-bold tracking-tight text-gray-900">
            🌍 ReliefChain
          </Link>
          <nav className="flex gap-8 text-sm text-gray-600">
            <Link href="/reliefs" className="hover:text-emerald-600 transition font-medium">
              Campaigns
            </Link>
            <Link href="/reliefadmin/dashboard" className="hover:text-emerald-600 transition font-medium">
              Admin
            </Link>
          </nav>
        </header>
        <main className="px-6 py-10 max-w-7xl mx-auto w-full">{children}</main>
      </body>
    </html>
  );
}
