import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esAdminEmpresa } from "@/lib/auth";
import { FormAccion, Campo, Tarjeta } from "@/components/form-accion";
import { CampoSupervisor } from "@/components/campo-supervisor";
import { listarSupervisores } from "@/lib/supervisores";
import { crearEdificio } from "@/app/panel/actions";

export default function NuevoEdificioPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  const perfil = await getPerfil();
  if (!esAdminEmpresa(perfil)) redirect("/panel");
  const supabase = await createClient();
  const supervisores = await listarSupervisores(supabase, perfil.empresa_id!);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/panel" className="text-sm text-slate-500 hover:underline">← Edificios</Link>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Crear edificio</h1>
        </div>
        <Link
          href="/panel"
          className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </Link>
      </div>

      <Tarjeta titulo="Datos del edificio">
        <FormAccion action={crearEdificio} boton="Guardar" limpiar={false} className="grid gap-4 sm:grid-cols-2">
          <Campo name="nombre" label="Nombre" required className="sm:col-span-2" />
          <Campo name="direccion" label="Dirección" />
          <Campo name="distrito" label="Distrito" />
          <Campo name="dia_vencimiento" label="Día de vencimiento de la cuota" type="number" min={1} max={28} defaultValue={10} required />
          <CampoSupervisor supervisores={supervisores} />
        </FormAccion>
      </Tarjeta>
    </div>
  );
}
