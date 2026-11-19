import type { MetadataRoute } from "next";

// Permite instalar la app en el celular (ícono en la pantalla de inicio)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Inmobiliaria app",
    short_name: "Inmobiliaria",
    description: "Tu cuota, tus pagos y tus recibos del edificio",
    lang: "es-PE",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a3846",
    theme_color: "#0a3846",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
