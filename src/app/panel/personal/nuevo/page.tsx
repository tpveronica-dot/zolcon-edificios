import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esAdminEmpresa } from "@/lib/auth";
import { Tarjeta } from "@/components/form-accion";
import { usuariosVinculables } from "@/lib/personal";
import { FormularioPersonal } from "../formulario-personal";

export default function NuevoPersonalPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  const yo = await getPerfil();
  if (!esAdminEmpresa(yo)) redirect("/panel");
  const supabase = await createClient();
  const [{ data: edificios }, usuarios] = await Promise.all([
    supabase.from("edificios").select("id, nombre").order("nombre"),
    usuariosVinculables(supabase, yo.empresa_id!),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/panel/personal" className="text-sm text-slate-500 hover:underline">← Personal</Link>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Agregar personal</h1>
        </div>
        <Link
          href="/panel/personal"
          className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </Link>
      </div>
      <Tarjeta>
        <FormularioPersonal edificios={edificios ?? []} usuarios={usuarios} />
      </Tarjeta>
    </div>
  );
}
