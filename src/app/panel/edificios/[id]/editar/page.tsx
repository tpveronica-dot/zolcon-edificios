import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esAdminEmpresa } from "@/lib/auth";
import { FormAccion, Campo, Tarjeta } from "@/components/form-accion";
import { actualizarEdificio, eliminarEdificio } from "@/app/panel/actions";

export default function EditarEdificioPage({ params }: PageProps<"/panel/edificios/[id]/editar">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await getPerfil();
  if (!esAdminEmpresa(perfil)) redirect(`/panel/edificios/${id}`);
  const supabase = await createClient();

  const [{ data: edificio }, { count: nUnidades }, { count: nCuotas }] = await Promise.all([
    supabase.from("edificios").select("nombre, direccion, distrito, dia_vencimiento").eq("id", id).single(),
    supabase.from("unidades").select("id", { count: "exact", head: true }).eq("edificio_id", id),
    supabase.from("cuotas").select("id", { count: "exact", head: true }).eq("edificio_id", id),
  ]);
  if (!edificio) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/panel/edificios/${id}`} className="text-sm text-slate-500 hover:underline">
            ← {edificio.nombre}
          </Link>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Editar edificio</h1>
        </div>
        <Link
          href={`/panel/edificios/${id}`}
          className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </Link>
      </div>

      <Tarjeta titulo="Datos del edificio">
        <FormAccion action={actualizarEdificio} boton="Guardar" limpiar={false} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="edificio_id" value={id} />
          <Campo name="nombre" label="Nombre" defaultValue={edificio.nombre} required />
          <Campo name="direccion" label="Dirección" defaultValue={edificio.direccion ?? ""} />
          <Campo name="distrito" label="Distrito" defaultValue={edificio.distrito ?? ""} />
          <Campo
            name="dia_vencimiento"
            label="Día de vencimiento de la cuota"
            type="number"
            min={1}
            max={28}
            defaultValue={edificio.dia_vencimiento}
            required
          />
        </FormAccion>
        <p className="mt-3 text-xs text-slate-500">
          Si cambias el día de vencimiento, aplica a las cuotas que se generen desde ahora.
        </p>
      </Tarjeta>

      <section id="eliminar" className="scroll-mt-6 rounded-2xl border border-red-200 bg-red-50/40 p-6">
        <h2 className="text-base font-semibold text-red-800">Eliminar edificio</h2>
        <p className="mt-1 text-sm text-red-700">
          Se borrará el edificio junto con sus <strong>{nUnidades ?? 0} unidades</strong>, su presupuesto, sus{" "}
          <strong>{nCuotas ?? 0} cuotas</strong> y todos los pagos registrados. Esta acción no se puede deshacer.
        </p>
        <FormAccion action={eliminarEdificio} boton="Eliminar definitivamente" limpiar={false} className="mt-4 grid gap-3 sm:max-w-md">
          <input type="hidden" name="edificio_id" value={id} />
          <Campo
            name="confirmacion"
            label={`Para confirmar, escribe el nombre del edificio: ${edificio.nombre}`}
            autoComplete="off"
            required
          />
        </FormAccion>
      </section>
    </div>
  );
}
