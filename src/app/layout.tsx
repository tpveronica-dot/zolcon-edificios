import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zolcon Edificios",
  description: "Administración de edificios: presupuesto, cuotas y cobranza",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
