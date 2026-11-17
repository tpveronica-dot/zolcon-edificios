import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esAdminEmpresa } from "@/lib/auth";
import { Tarjeta } from "@/components/form-accion";
import { usuariosVinculables } from "@/lib/personal";
import { FormularioPersonal } from "../formulario-personal";

export default function EditarPersonalPage({ params }: PageProps<"/panel/personal/[personalId]">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ personalId: string }> }) {
  const { personalId } = await params;
  const yo = await getPerfil();
  if (!esAdminEmpresa(yo)) redirect("/panel");
  const supabase = await createClient();

  const [{ data: persona }, { data: edificios }, usuarios] = await Promise.all([
    supabase
      .from("personal")
      .select("id, nombre, telefono, email, usuario_id, cargo, personal_edificios(edificio_id)")
      .eq("id", personalId)
      .eq("empresa_id", yo.empresa_id!)
      .single(),
    supabase.from("edificios").select("id, nombre").order("nombre"),
    usuariosVinculables(supabase, yo.empresa_id!, personalId),
  ]);
  if (!persona) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/panel/personal" className="text-sm text-slate-500 hover:underline">← Personal</Link>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">{persona.nombre}</h1>
        </div>
        <Link
          href="/panel/personal"
          className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </Link>
      </div>
      <Tarjeta>
        <FormularioPersonal
          persona={{
            ...persona,
            edificios: (persona.personal_edificios as { edificio_id: string }[]).map((x) => x.edificio_id),
          }}
          edificios={edificios ?? []}
          usuarios={usuarios}
        />
      </Tarjeta>
    </div>
  );
}
