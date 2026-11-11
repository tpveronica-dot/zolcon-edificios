"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconoEdificio } from "./iconos";

const IconoUsuarios = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .7 3 2.9 3 6" />
  </svg>
);

export function MenuLateral({ mostrarUsuarios }: { mostrarUsuarios: boolean }) {
  const ruta = usePathname();
  const items = [
    { href: "/panel", texto: "Edificios", Icono: IconoEdificio, activo: ruta === "/panel" || ruta.startsWith("/panel/edificios") },
    ...(mostrarUsuarios
      ? [{ href: "/panel/usuarios", texto: "Usuarios", Icono: IconoUsuarios, activo: ruta.startsWith("/panel/usuarios") }]
      : []),
  ];
  return (
    <nav aria-label="Menú principal" className="flex flex-row flex-wrap gap-1 lg:flex-col">
      {items.map(({ href, texto, Icono, activo }) => (
        <Link
          key={href}
          href={href}
          aria-current={activo ? "page" : undefined}
          className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${
            activo ? "bg-petroleo-700 font-semibold text-white" : "font-medium text-petroleo-100 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Icono /> {texto}
        </Link>
      ))}
    </nav>
  );
}
