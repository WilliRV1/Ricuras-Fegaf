import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ricuras Fegaf | Sistema de Gestión",
  description: "Sistema operativo para toma de pedidos y KDS",
};

import { Header } from '@/components/ui/Header';
import { BottomNav } from '@/components/ui/BottomNav';
import { sesionActual } from '@/lib/sesionServidor';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // La sesión se lee aquí, en el servidor: la cookie es httpOnly y el
  // navegador no puede leerla. Se le pasa a la navegación para saludar por el
  // nombre y mostrar solo las pantallas que le tocan a cada rol.
  const sesion = await sesionActual();
  const datosSesion = sesion ? { nombre: sesion.nombre, rol: sesion.rol } : null;

  return (
    <html lang="es" className={`${inter.variable} ${sora.variable}`}>
      <body>
        <Header sesion={datosSesion} />
        <main className="main-content">
          {children}
        </main>
        <BottomNav sesion={datosSesion} />
      </body>
    </html>
  );
}
