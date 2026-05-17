import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF OCR Editor",
  description: "Web-based PDF OCR instant editor MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
