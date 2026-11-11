import { Suspense } from "react";
import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { cerrarSesion } from "@/app/login/actions";

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/panel" className="font-semibold text-slate-900">
            Zolcon <span className="font-normal text-slate-500">Edificios</span>
          </Link>
          <Suspense fallback={<span className="text-sm text-slate-400">…</span>}>
            <Usuario />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

async function Usuario() {
  const perfil = await getPerfil();
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-slate-600">
        {perfil.empresa_nombre && <strong className="text-slate-900">{perfil.empresa_nombre} · </strong>}
        {perfil.nombre || perfil.email}
      </span>
      <form action={cerrarSesion}>
        <button className="text-slate-500 hover:text-slate-900">Salir</button>
      </form>
    </div>
  );
}
