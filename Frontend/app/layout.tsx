export const metadata = {
  title: "Disaster Relief DApp - Blockchain-Based Donation Platform",
  description: "Nền tảng quyên góp cứu trợ minh bạch và phi tập trung trên blockchain",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="scroll-smooth">
      <body className="antialiased text-gray-900 bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
