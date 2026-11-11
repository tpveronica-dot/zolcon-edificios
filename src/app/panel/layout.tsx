import { Suspense } from "react";
import Link from "next/link";
import { getPerfil, esAdminEmpresa } from "@/lib/auth";
import { MenuLateral } from "@/components/menu-lateral";
import { cerrarSesion } from "@/app/login/actions";
import { IconoSalir, Logo } from "@/components/iconos";

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    <div className="flex min-h-screen flex-1 flex-wrap bg-slate-50">
      <aside className="flex w-full flex-col gap-6 bg-petroleo-800 px-4 py-5 text-white lg:min-h-screen lg:w-64 lg:py-6">
        <Link href="/panel" className="px-2">
          <Logo claro />
        </Link>
        <Suspense fallback={<div className="min-h-11" />}>
          <Menu />
        </Suspense>
        <div className="mt-auto hidden lg:block">
          <Suspense fallback={<span className="px-3 text-sm text-petroleo-100">…</span>}>
            <Usuario />
          </Suspense>
        </div>
      </aside>
      <div className="min-w-0 flex-[999_1_560px]">
        <div className="flex justify-end border-b border-slate-200 bg-white px-6 py-3 lg:hidden">
          <Suspense fallback={null}>
            <Usuario compacto />
          </Suspense>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

async function Usuario({ compacto = false }: { compacto?: boolean }) {
  const perfil = await getPerfil();
  return (
    <div className={compacto ? "flex items-center gap-4 text-sm" : "flex flex-col gap-3 border-t border-white/10 px-3 pt-4"}>
      <div className={compacto ? "text-slate-600" : "text-sm"}>
        <p className={compacto ? "font-semibold text-slate-900" : "font-semibold text-white"}>{perfil.nombre || perfil.email}</p>
        {perfil.empresa_nombre && <p className={compacto ? "text-xs" : "text-xs text-petroleo-100"}>{perfil.empresa_nombre}</p>}
      </div>
      <form action={cerrarSesion}>
        <button
          className={
            compacto
              ? "inline-flex min-h-11 items-center gap-2 text-slate-600 hover:text-slate-900"
              : "inline-flex min-h-11 items-center gap-2 text-sm text-petroleo-100 hover:text-white"
          }
        >
          <IconoSalir /> Salir
        </button>
      </form>
    </div>
  );
}

async function Menu() {
  const perfil = await getPerfil();
  return <MenuLateral mostrarUsuarios={esAdminEmpresa(perfil)} />;
}
