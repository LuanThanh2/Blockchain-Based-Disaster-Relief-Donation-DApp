export const metadata = {
  title: "Relief Admin",
  description: "Campaign management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="antialiased text-slate-900 bg-white">{children}</body>
    </html>
  );
}
