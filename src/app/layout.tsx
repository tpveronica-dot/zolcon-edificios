import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AvisoAmbiente } from "@/components/aviso-ambiente";

export const metadata: Metadata = {
  title: "Inmobiliaria app",
  description: "Administración de edificios: presupuesto, cuotas y cobranza",
  applicationName: "Inmobiliaria app",
  appleWebApp: { capable: true, title: "Inmobiliaria", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon-64.png", sizes: "64x64", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a3846",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
