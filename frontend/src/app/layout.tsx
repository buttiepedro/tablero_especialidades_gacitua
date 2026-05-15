import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tablero Especialidades",
  description: "Panel de administración — Gacitua Bot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
