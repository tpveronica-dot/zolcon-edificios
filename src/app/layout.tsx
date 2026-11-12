import type { Metadata } from "next";
import "./globals.css";
import { AvisoAmbiente } from "@/components/aviso-ambiente";

export const metadata: Metadata = {
  title: "Zolcon Edificios",
  description: "Administración de edificios: presupuesto, cuotas y cobranza",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <AvisoAmbiente />
        {children}
      </body>
    </html>
  );
}
