import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ricuras Fegaf | Sistema de Gestión",
  description: "Sistema operativo para toma de pedidos y KDS",
};

import { Header } from '@/components/ui/Header';
import { BottomNav } from '@/components/ui/BottomNav';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        <Header />
        <main className="main-content">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
