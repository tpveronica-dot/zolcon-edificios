import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esStaff, esAdminEmpresa } from "@/lib/auth";
import { FormAccion, Tarjeta } from "@/components/form-accion";
import { soles, nombreMes, hoyLima } from "@/lib/formato";
import { Encabezado } from "../encabezado";
import { EstadoCuota } from "@/components/estado-cuota";
import { Distribucion } from "./distribucion";
import { NOMBRE_METODO, type Metodo } from "@/lib/distribucion";
import { generarCuotas } from "../../../actions";
import { repartirEnPartidas } from "@/lib/repartir";

export default function CuotasPage({ params, searchParams }: PageProps<"/panel/edificios/[id]/cuotas">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function mover(ym: string, delta: number) {
  const [a, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
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
  const hoy = hoyLima();
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : hoy.slice(0, 7);
  const mensaje = typeof sp.ok === "string" ? sp.ok : null;
  const anio = Number(mes.slice(0, 4));
  const supabase = await createClient();

  const [{ data: edificio }, { data: cuotas }, { data: unidadesEd }, { data: presupuesto }] = await Promise.all([
    supabase.from("edificios").select("nombre, direccion, distrito, dia_vencimiento, metodo_distribucion").eq("id", id).single(),
    supabase
      .from("cuotas")
      .select("id, monto, vencimiento, estado, unidades(codigo, area_m2, personas(nombres))")
      .eq("edificio_id", id)
      .eq("periodo", `${mes}-01`),
    supabase.from("unidades").select("id, codigo, tipo, area_m2, porcentaje_participacion").eq("edificio_id", id),
    supabase.from("presupuestos").select("partidas(id, nombre, monto_mensual)").eq("edificio_id", id).eq("anio", anio).maybeSingle(),
  ]);
  if (!edificio) notFound();

  const staff = esStaff(perfil);
  const partidas = [...(presupuesto?.partidas ?? [])]
    .map((p) => ({ id: p.id, nombre: p.nombre, monto: Number(p.monto_mensual) }))
    .sort((a, b) => b.monto - a.monto);
  const totalMensual = partidas.reduce((s, p) => s + p.monto, 0);

  const unidadesReparto = [...(unidadesEd ?? [])]
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }))
    .map((u) => ({ id: u.id, codigo: u.codigo, tipo: u.tipo, area: u.area_m2 == null ? null : Number(u.area_m2), pct: Number(u.porcentaje_participacion) }));

  const vecinos = (cuotas ?? [])
    .filter((c) => c.estado !== "anulada")
    .map((c) => {
      const u = c.unidades as unknown as { codigo: string; area_m2: number | null; personas: { nombres: string } | null };
      const monto = Number(c.monto);
      return {
        id: c.id,
        codigo: u.codigo,
        area: u.area_m2,
        propietario: u.personas?.nombres ?? null,
        monto,
        estado: c.estado,
        vencida: c.estado !== "pagada" && c.vencimiento < hoy,
        participacion: totalMensual ? (monto / totalMensual) * 100 : 0,
        lineas: repartirEnPartidas(monto, partidas, totalMensual),
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
  const totalEmitido = vecinos.reduce((s, v) => s + v.monto, 0);
  const metodo = (edificio.metodo_distribucion ?? "metraje") as Metodo;

  return (
    <div className="space-y-6">
      <Encabezado id={id} edificio={edificio} activa="cuotas" gestionar={esAdminEmpresa(perfil)} />

      {mensaje && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">✓ {mensaje}</p>}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`?mes=${mover(mes, -1)}`} aria-label="Mes anterior" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 hover:bg-slate-100">←</Link>
        <span className="font-display text-xl font-bold capitalize text-slate-900">Cuotas de {nombreMes(mes)}</span>
        <Link href={`?mes=${mover(mes, 1)}`} aria-label="Mes siguiente" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 hover:bg-slate-100">→</Link>
        {mes !== hoy.slice(0, 7) && <Link href="?" className="text-slate-500 hover:underline">Ir al mes actual</Link>}
      </div>

      {staff && (
        <section id="distribucion" className="scroll-mt-6">
          <Tarjeta titulo="1 · Distribución de la cuota">
            {unidadesReparto.length === 0 ? (
              <p className="text-sm text-slate-500">Primero registra las unidades del edificio.</p>
            ) : (
              <Distribucion
                edificioId={id}
                mes={mes}
                metodoActual={metodo}
                unidades={unidadesReparto}
                totalMensual={totalMensual}
                editable={esAdminEmpresa(perfil)}
              />
            )}
          </Tarjeta>
        </section>
      )}

      {staff && (
        <Tarjeta titulo="2 · Generar las cuotas del mes">
          <p className="mb-4 text-sm text-slate-600">
            Reparte el total mensual del presupuesto ({soles(totalMensual)}){" "}
            <strong>{NOMBRE_METODO[metodo]?.toLowerCase() ?? "por metraje"}</strong>. Vence el día {edificio.dia_vencimiento}.
            Si ya existen cuotas de este mes, no se duplican.
          </p>
          {vecinos.length > 0 ? (
            <p className="text-sm font-semibold text-emerald-700">
              ✓ Cuotas de {nombreMes(mes)} generadas: {vecinos.length} unidades · {soles(totalEmitido)}
            </p>
          ) : (
            <FormAccion action={generarCuotas} boton={`Generar cuotas de ${nombreMes(mes)}`} className="space-y-3">
              <input type="hidden" name="edificio_id" value={id} />
              <input type="hidden" name="mes" value={mes} />
            </FormAccion>
          )}
        </Tarjeta>
      )}

      <Tarjeta titulo={`${staff ? "3 · " : ""}Balance del mes por vecino`}>
        {vecinos.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no se generan las cuotas de {nombreMes(mes)}.</p>
        ) : partidas.length === 0 ? (
          <p className="text-sm text-slate-500">No hay partidas en el presupuesto {anio} para detallar la cuota.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-2xl text-sm text-slate-600">
                Cada cuota se detalla por partida del presupuesto {anio}, en la misma proporción que la cuota tiene sobre el total
                mensual. Abre un vecino para ver su detalle o descarga su estado de cuota en PDF.
              </p>
              <a
                href={`/panel/edificios/${id}/cuotas/recibos?mes=${mes}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-petroleo-700 hover:bg-petroleo-50"
              >
                <IconoDescarga /> Descargar todos (PDF)
              </a>
            </div>
            {vecinos.map((v) => (
              <details key={v.id} className="group rounded-xl border border-slate-200 bg-white open:border-petroleo-700">
                <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <span className="text-slate-400 transition group-open:rotate-90" aria-hidden="true">›</span>
                  <span className="font-display text-base font-bold text-slate-900">{v.codigo}</span>
                  <span className="min-w-0 flex-1 text-sm text-slate-600">{v.propietario ?? "Sin propietario"}</span>
                  <EstadoCuota estado={v.estado} vencida={v.vencida} />
                  <span className="text-xs text-slate-500 tabular-nums">{v.participacion.toFixed(2)} %</span>
                  <span className="font-semibold tabular-nums text-slate-900">{soles(v.monto)}</span>
                </summary>
                <div className="border-t border-slate-100 px-4 pb-4 pt-2">
                  <div className="flex justify-end pt-1">
                    <a
                      href={`/panel/edificios/${id}/cuotas/recibo/${v.id}?mes=${mes}`}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-petroleo-700 px-4 text-sm font-semibold text-white hover:bg-petroleo-800"
                    >
                      <IconoDescarga /> Descargar PDF de {v.codigo}
                    </a>
                  </div>
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Detalle por partida de la unidad {v.codigo}</caption>
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">Partida</th>
                        <th className="py-2 pr-4 text-right">Presupuesto del edificio</th>
                        <th className="py-2 text-right">Le corresponde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {v.lineas.map((l) => (
                        <tr key={l.id}>
                          <td className="py-1.5 pr-4 text-slate-900">{l.nombre}</td>
                          <td className="py-1.5 pr-4 text-right tabular-nums text-slate-500">{soles(l.monto)}</td>
                          <td className="py-1.5 text-right tabular-nums">{soles(l.importe)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-200 font-semibold">
                      <tr>
                        <td className="py-2 pr-4">Total de la cuota</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-slate-500">{soles(totalMensual)}</td>
                        <td className="py-2 text-right tabular-nums">{soles(v.monto)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </details>
            ))}
            <p className="pt-2 text-right text-sm font-semibold text-slate-900">
              Total emitido: {soles(totalEmitido)} · {vecinos.length} vecinos
            </p>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

function IconoDescarga() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}
