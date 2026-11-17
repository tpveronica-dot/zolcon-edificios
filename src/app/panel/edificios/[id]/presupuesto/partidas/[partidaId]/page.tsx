import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esStaff } from "@/lib/auth";
import { FormAccion, Campo, Tarjeta } from "@/components/form-accion";
import { actualizarPartida } from "@/app/panel/actions";

export default function EditarPartidaPage({ params }: PageProps<"/panel/edificios/[id]/presupuesto/partidas/[partidaId]">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string; partidaId: string }> }) {
  const { id, partidaId } = await params;
  const perfil = await getPerfil();
  if (!esStaff(perfil)) redirect(`/panel/edificios/${id}/presupuesto`);
  const supabase = await createClient();

  const { data: partida } = await supabase
    .from("partidas")
    .select("id, nombre, monto_mensual, es_fondo_reserva, presupuestos!inner(anio, edificio_id, edificios(nombre))")
    .eq("id", partidaId)
    .eq("presupuestos.edificio_id", id)
    .single();
  if (!partida) notFound();
  const presupuesto = partida.presupuestos as unknown as { anio: number; edificios: { nombre: string } };
  const volver = `/panel/edificios/${id}/presupuesto?anio=${presupuesto.anio}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={volver} className="text-sm text-slate-500 hover:underline">
            ← {presupuesto.edificios.nombre} · Presupuesto {presupuesto.anio}
          </Link>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Editar partida</h1>
        </div>
        <Link
          href={volver}
          className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </Link>
      </div>

      <Tarjeta>
        <FormAccion action={actualizarPartida} boton="Guardar" limpiar={false} className="grid gap-4 sm:grid-cols-3">
          <input type="hidden" name="partida_id" value={partida.id} />
          <input type="hidden" name="edificio_id" value={id} />
          <input type="hidden" name="anio" value={presupuesto.anio} />
          <Campo name="nombre" label="Partida" defaultValue={partida.nombre} required className="sm:col-span-2" />
          <Campo
            name="monto_mensual"
            label="Monto mensual S/"
            inputMode="decimal"
            defaultValue={Number(partida.monto_mensual).toFixed(2)}
            required
          />
          <label className="col-span-full flex min-h-11 items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              name="es_fondo_reserva"
              defaultChecked={partida.es_fondo_reserva}
              className="h-4 w-4 accent-petroleo-700"
            />
            Es aporte al fondo de reserva
          </label>
        </FormAccion>
        <p className="mt-4 text-xs text-slate-500">
          El nuevo monto se usa en las cuotas que se generen desde ahora. Las cuotas ya emitidas no cambian.
        </p>
      </Tarjeta>
    </div>
  );
}
