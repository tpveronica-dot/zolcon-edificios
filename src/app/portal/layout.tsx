import { Suspense } from "react";
import Link from "next/link";
import { getPerfil } from "@/lib/auth";
import { cerrarSesion } from "@/app/login/actions";
import { IconoSalir, Logo } from "@/components/iconos";
import { InstalarApp } from "@/components/instalar-app";

// Portal del propietario: pensado primero para celular
export default function PortalLayout({ children }: LayoutProps<"/portal">) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-slate-50">
      <header className="sticky top-0 z-10 bg-petroleo-800 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <Link href="/portal" aria-label="Inicio">
            <Logo claro />
          </Link>
          <form action={cerrarSesion}>
            <button className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm text-petroleo-100 hover:text-white">
              <IconoSalir /> Salir
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5">
        <Suspense fallback={null}>
          <Saludo />
        </Suspense>
        {children}
        <div className="mt-8">
          <InstalarApp />
        </div>
      </main>
    </div>
  );
}

async function Saludo() {
  const perfil = await getPerfil();
  const nombre = (perfil.nombre || perfil.email || "").split(" ")[0];
  return (
    <p className="mb-4 text-sm text-slate-500">
      Hola{nombre ? `, ${nombre}` : ""} 👋
      {perfil.empresa_nombre && <span className="block text-xs">Administra: {perfil.empresa_nombre}</span>}
    </p>
  );
}
