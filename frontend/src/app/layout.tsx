import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { MainLayout } from "@/components/layout/MainLayout";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "계측 시스템(오성사)",
  description: "계측 장비 제어 및 데이터 수집을 위한 웹 기반 애플리케이션",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className={`${inter.variable} font-sans antialiased h-full`}>
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
