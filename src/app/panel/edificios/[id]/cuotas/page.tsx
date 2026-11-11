import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esStaff, esAdminEmpresa } from "@/lib/auth";
import { FormAccion, Campo, Selector, Tarjeta } from "@/components/form-accion";
import { soles, nombreMes, hoyLima, fechaCorta } from "@/lib/formato";
import { Encabezado, Indicador } from "../encabezado";
import { EstadoCuota } from "@/components/estado-cuota";
import { anularCuota, eliminarPago, generarCuotas, registrarPago } from "../../../actions";

export default function CuotasPage({ params, searchParams }: PageProps<"/panel/edificios/[id]/cuotas">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const MEDIOS: [string, string][] = [
  ["transferencia", "Transferencia"],
  ["yape", "Yape"],
  ["plin", "Plin"],
  ["deposito", "Depósito"],
  ["efectivo", "Efectivo"],
  ["otro", "Otro"],
];


function mover(ym: string, delta: number) {
  const [a, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

type Pago = { id: string; monto: number; fecha: string; medio: string; operacion: string | null; validado: boolean };

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
  const supabase = await createClient();

  const [{ data: edificio }, { data: cuotas }, { data: cuentas }] = await Promise.all([
    supabase.from("edificios").select("nombre, direccion, distrito, dia_vencimiento").eq("id", id).single(),
    supabase
      .from("cuotas")
      .select("id, unidad_id, monto, vencimiento, estado, unidades(codigo, personas(nombres)), pagos(id, monto, fecha, medio, operacion, validado)")
      .eq("edificio_id", id)
      .eq("periodo", `${mes}-01`),
    supabase.from("estado_cuenta").select("unidad_id, deuda, cuotas_vencidas").eq("edificio_id", id),
  ]);
  if (!edificio) notFound();

  const staff = esStaff(perfil);
  const deudaUnidad = new Map((cuentas ?? []).map((c) => [c.unidad_id, { deuda: Number(c.deuda), vencidas: Number(c.cuotas_vencidas) }]));

  const filas = (cuotas ?? [])
    .map((c) => {
      const u = c.unidades as unknown as { codigo: string; personas: { nombres: string } | null };
      const pagos = (c.pagos as Pago[]).filter((p) => p.validado);
      const pagado = pagos.reduce((s, p) => s + Number(p.monto), 0);
      return { ...c, codigo: u.codigo, propietario: u.personas?.nombres ?? null, pagos, pagado, saldo: Math.max(Number(c.monto) - pagado, 0) };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));

  const vigentes = filas.filter((f) => f.estado !== "anulada");
  const emitido = vigentes.reduce((s, f) => s + Number(f.monto), 0);
  const cobrado = vigentes.reduce((s, f) => s + f.pagado, 0);
  const pendiente = emitido - cobrado;
  const pctCobro = emitido ? (cobrado / emitido) * 100 : 0;
  const deudaTotal = [...deudaUnidad.values()].reduce((s, d) => s + d.deuda, 0);
  const morosos = [...deudaUnidad.values()].filter((d) => d.vencidas > 0).length;

  return (
    <div className="space-y-6">
      <Encabezado id={id} edificio={edificio} activa="cuotas" gestionar={esAdminEmpresa(perfil)} />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`?mes=${mover(mes, -1)}`} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 hover:bg-slate-100">←</Link>
        <span className="font-display text-xl font-bold capitalize text-slate-900">{nombreMes(mes)}</span>
        <Link href={`?mes=${mover(mes, 1)}`} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 hover:bg-slate-100">→</Link>
        {mes !== hoy.slice(0, 7) && (
          <Link href="?" className="text-slate-500 hover:underline">Ir al mes actual</Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador titulo="Emitido del mes" valor={soles(emitido)} nota={`${vigentes.length} cuotas`} />
        <Indicador titulo="Cobrado del mes" valor={soles(cobrado)} tono="bien" nota={`${pctCobro.toFixed(0)} % de cobranza`} />
        <Indicador titulo="Por cobrar del mes" valor={soles(pendiente)} tono={pendiente > 0 ? "alerta" : "normal"} />
        <Indicador titulo="Deuda total del edificio" valor={soles(deudaTotal)} tono={deudaTotal > 0 ? "mal" : "bien"} nota={`${morosos} unidades con cuotas vencidas`} />
      </div>

      {staff && (
        <Tarjeta titulo="Generar cuotas del mes">
          <p className="mb-4 text-sm text-slate-600">
            Calcula la cuota de cada unidad: <strong>total mensual del presupuesto × % de participación</strong>.
            Vence el día {edificio.dia_vencimiento}. Si ya existen cuotas de este mes, no se duplican.
          </p>
          <FormAccion action={generarCuotas} boton={`Generar cuotas de ${nombreMes(mes)}`} className="space-y-3">
            <input type="hidden" name="edificio_id" value={id} />
            <input type="hidden" name="mes" value={mes} />
          </FormAccion>
        </Tarjeta>
      )}

      <Tarjeta titulo={`Cuotas de ${nombreMes(mes)}`}>
        {filas.length === 0 ? (
          <p className="text-sm text-slate-500">No hay cuotas generadas para este mes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Unidad</th>
                  <th className="py-2 pr-4">Propietario</th>
                  <th className="py-2 pr-4 text-right">Cuota</th>
                  <th className="py-2 pr-4 text-right">Pagado</th>
                  <th className="py-2 pr-4 text-right">Saldo</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2 pr-4 text-right">Deuda total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map((f) => {
                  const vencida = f.estado !== "pagada" && f.estado !== "anulada" && f.vencimiento < hoy;
                  const deuda = deudaUnidad.get(f.unidad_id)?.deuda ?? 0;
                  return (
                    <tr key={f.id} className="align-top">
                      <td className="py-3 pr-4 font-medium text-slate-900">{f.codigo}</td>
                      <td className="py-3 pr-4">
                        {f.propietario ?? <span className="text-slate-400">Sin asignar</span>}
                        {f.pagos.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                            {f.pagos.map((p) => (
                              <li key={p.id} className="flex items-center gap-2">
                                {fechaCorta(p.fecha)} · {soles(Number(p.monto))} · <span className="capitalize">{p.medio}</span>
                                {p.operacion && ` · Op. ${p.operacion}`}
                                {staff && (
                                  <form action={eliminarPago}>
                                    <input type="hidden" name="id" value={p.id} />
                                    <button className="text-slate-400 hover:text-red-600" title="Eliminar pago">✕</button>
                                  </form>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        {staff && f.estado !== "pagada" && f.estado !== "anulada" && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs font-medium text-slate-700 hover:underline">
                              + Registrar pago
                            </summary>
                            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <FormAccion action={registrarPago} boton="Guardar pago" className="grid gap-2 sm:grid-cols-2">
                                <input type="hidden" name="cuota_id" value={f.id} />
                                <Campo name="monto" label="Monto S/" inputMode="decimal" defaultValue={f.saldo.toFixed(2)} required />
                                <Campo name="fecha" label="Fecha" type="date" defaultValue={hoy} />
                                <Selector name="medio" label="Medio" opciones={MEDIOS} />
                                <Campo name="operacion" label="Nº de operación" />
                              </FormAccion>
                              <form action={anularCuota} className="mt-2">
                                <input type="hidden" name="id" value={f.id} />
                                <button className="text-xs text-slate-400 hover:text-red-600">Anular esta cuota</button>
                              </form>
                            </div>
                          </details>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">{soles(Number(f.monto))}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{soles(f.pagado)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{soles(f.estado === "anulada" ? 0 : f.saldo)}</td>
                      <td className="py-3 pr-4">
                        <EstadoCuota estado={f.estado} vencida={vencida} />
                      </td>
                      <td className={`py-3 pr-4 text-right tabular-nums ${deuda > 0 ? "font-medium text-red-600" : "text-slate-400"}`}>
                        {soles(deuda)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
