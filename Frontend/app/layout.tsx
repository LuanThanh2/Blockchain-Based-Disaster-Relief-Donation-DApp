import Link from "next/link";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 text-white">
        <header className="flex items-center justify-between px-10 py-5 border-b border-white/10 bg-black/40 backdrop-blur">
          <Link href="/" className="text-2xl font-bold tracking-tight">🌍 ReliefChain</Link>
          <nav className="flex gap-8 text-sm text-gray-300">
            <Link href="/reliefs" className="hover:text-white transition">Campaigns</Link>
            <Link href="/user/donate" className="hover:text-white transition">Donate</Link>
            <Link href="/reliefadmin/dashboard" className="hover:text-white transition">Admin</Link>
          </nav>
        </header>

        <main className="px-6 py-10 max-w-7xl mx-auto w-full">{children}</main>
      </body>
    </html>
  );
}
