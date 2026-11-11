import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esStaff, esAdminEmpresa } from "@/lib/auth";
import { FormAccion, Campo, Tarjeta } from "@/components/form-accion";
import { soles, hoyLima } from "@/lib/formato";
import { Encabezado, Indicador } from "../encabezado";
import { agregarPartida, aprobarPresupuesto, crearPresupuesto, eliminarPartida } from "../../../actions";

export default function PresupuestoPage({ params, searchParams }: PageProps<"/panel/edificios/[id]/presupuesto">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const perfil = await getPerfil();
  const anio = Number(sp.anio) || Number(hoyLima().slice(0, 4));
  const supabase = await createClient();

  const [{ data: edificio }, { data: presupuesto }] = await Promise.all([
    supabase.from("edificios").select("nombre, direccion, distrito, dia_vencimiento").eq("id", id).single(),
    supabase
      .from("presupuestos")
      .select("id, anio, aprobado, partidas(id, nombre, monto_mensual, es_fondo_reserva)")
      .eq("edificio_id", id)
      .eq("anio", anio)
      .maybeSingle(),
  ]);
  if (!edificio) notFound();

  const staff = esStaff(perfil);
  const partidas = [...(presupuesto?.partidas ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const mensual = partidas.reduce((s, p) => s + Number(p.monto_mensual), 0);
  const reserva = partidas.filter((p) => p.es_fondo_reserva).reduce((s, p) => s + Number(p.monto_mensual), 0);

  // Ejecución: lo gastado por partida en el año
  const { data: ejecucion } = presupuesto
    ? await supabase.from("ejecucion_presupuesto").select("partida_id, ejecutado").eq("edificio_id", id).eq("anio", anio)
    : { data: [] };
  const gastado = new Map((ejecucion ?? []).map((e) => [e.partida_id, Number(e.ejecutado)]));

  return (
    <div className="space-y-6">
      <Encabezado id={id} edificio={edificio} activa="presupuesto" gestionar={esAdminEmpresa(perfil)} />

      <div className="flex items-center gap-3 text-sm">
        <Link href={`?anio=${anio - 1}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100">
          ← {anio - 1}
        </Link>
        <span className="text-lg font-semibold text-slate-900">Presupuesto {anio}</span>
        <Link href={`?anio=${anio + 1}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100">
          {anio + 1} →
        </Link>
        {presupuesto && (
          <span className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${presupuesto.aprobado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
            {presupuesto.aprobado ? "Aprobado por la junta" : "Borrador"}
          </span>
        )}
      </div>

      {!presupuesto ? (
        <Tarjeta>
          <p className="text-sm text-slate-600">Este edificio aún no tiene presupuesto para {anio}.</p>
          {staff && (
            <form action={crearPresupuesto} className="mt-4">
              <input type="hidden" name="edificio_id" value={id} />
              <input type="hidden" name="anio" value={anio} />
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                Crear presupuesto {anio}
              </button>
            </form>
          )}
        </Tarjeta>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Indicador titulo="Total mensual" valor={soles(mensual)} nota="Base para calcular las cuotas" />
            <Indicador titulo="Total anual" valor={soles(mensual * 12)} />
            <Indicador titulo="Fondo de reserva mensual" valor={soles(reserva)} nota={mensual ? `${((reserva / mensual) * 100).toFixed(1)} % del total` : undefined} />
          </div>

          <Tarjeta titulo="Partidas del presupuesto">
            {partidas.length === 0 ? (
              <p className="text-sm text-slate-500">Agrega las partidas: vigilancia, limpieza, luz y agua de áreas comunes, mantenimiento de ascensor, etc.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Partida</th>
                    <th className="py-2 pr-4 text-right">Mensual</th>
                    <th className="py-2 pr-4 text-right">Anual</th>
                    <th className="py-2 pr-4 text-right">Gastado {anio}</th>
                    <th className="py-2 pr-4 text-right">Avance</th>
                    {staff && <th />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partidas.map((p) => {
                    const anual = Number(p.monto_mensual) * 12;
                    const g = gastado.get(p.id) ?? 0;
                    const pct = anual ? (g / anual) * 100 : 0;
                    return (
                      <tr key={p.id}>
                        <td className="py-2 pr-4 font-medium text-slate-900">
                          {p.nombre}
                          {p.es_fondo_reserva && <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-800">Reserva</span>}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">{soles(Number(p.monto_mensual))}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{soles(anual)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{soles(g)}</td>
                        <td className={`py-2 pr-4 text-right tabular-nums ${pct > 100 ? "text-red-600" : "text-slate-600"}`}>{pct.toFixed(0)} %</td>
                        {staff && (
                          <td className="py-2 text-right">
                            <form action={eliminarPartida}>
                              <input type="hidden" name="id" value={p.id} />
                              <button className="text-xs text-slate-400 hover:text-red-600">Eliminar</button>
                            </form>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 font-semibold">
                  <tr>
                    <td className="py-2 pr-4">Total</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{soles(mensual)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{soles(mensual * 12)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            )}
          </Tarjeta>

          {staff && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Tarjeta titulo="Agregar partida">
                  <FormAccion action={agregarPartida} boton="Agregar" className="grid gap-3 sm:grid-cols-3">
                    <input type="hidden" name="presupuesto_id" value={presupuesto.id} />
                    <Campo name="nombre" label="Partida (ej. Vigilancia)" required className="sm:col-span-2" />
                    <Campo name="monto_mensual" label="Monto mensual S/" inputMode="decimal" required />
                    <label className="col-span-full flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" name="es_fondo_reserva" className="h-4 w-4" /> Es aporte al fondo de reserva
                    </label>
                  </FormAccion>
                </Tarjeta>
              </div>
              <Tarjeta titulo="Aprobación">
                <p className="mb-4 text-sm text-slate-600">
                  Marca el presupuesto como aprobado cuando la junta de propietarios lo apruebe.
                </p>
                <form action={aprobarPresupuesto}>
                  <input type="hidden" name="id" value={presupuesto.id} />
                  <input type="hidden" name="aprobado" value={String(!presupuesto.aprobado)} />
                  <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100">
                    {presupuesto.aprobado ? "Volver a borrador" : "Marcar como aprobado"}
                  </button>
                </form>
              </Tarjeta>
            </div>
          )}
        </>
      )}
    </div>
  );
}
