import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esStaff, esAdminEmpresa } from "@/lib/auth";
import { FormAccion, Campo, Selector, Tarjeta } from "@/components/form-accion";
import { soles, nombreMes, hoyLima, fechaCorta } from "@/lib/formato";
import { Encabezado, Indicador } from "../encabezado";
import { EstadoCuota } from "@/components/estado-cuota";
import { anularCuota, eliminarPago, registrarPago, validarPago, rechazarPago } from "../../../actions";

export default function PagosPage({ params, searchParams }: PageProps<"/panel/edificios/[id]/pagos">) {
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
  const { data: porValidar } = await supabase
    .from("pagos")
    .select("id, monto, fecha, medio, operacion, voucher_url, creado_en, cuotas!inner(edificio_id, periodo, monto, unidades(codigo, personas(nombres)))")
    .eq("validado", false)
    .eq("cuotas.edificio_id", id)
    .order("creado_en");
  const rutas = (porValidar ?? []).map((p) => p.voucher_url).filter((v): v is string => !!v);
  const { data: firmadas } = rutas.length
    ? await supabase.storage.from("vouchers").createSignedUrls(rutas, 60 * 30)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlVoucher = new Map((firmadas ?? []).map((f) => [f.path, f.signedUrl]));
  const mensaje = typeof sp.ok === "string" ? sp.ok : null;
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
      <Encabezado id={id} edificio={edificio} activa="pagos" gestionar={esAdminEmpresa(perfil)} />

      {mensaje && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">✓ {mensaje}</p>}

      {staff && (porValidar?.length ?? 0) > 0 && (
        <section className="rounded-2xl border-2 border-amber-400 bg-amber-100/40 p-6">
          <h2 className="text-lg font-bold text-slate-900">Pagos reportados por propietarios · por validar ({porValidar!.length})</h2>
          <p className="mb-4 text-sm text-slate-600">Revisa el voucher contra tu cuenta bancaria. Al validar, el pago cuenta para la cuota.</p>
          <ul className="space-y-3">
            {porValidar!.map((p) => {
              const c = p.cuotas as unknown as { periodo: string; unidades: { codigo: string; personas: { nombres: string } | null } };
              const url = p.voucher_url ? urlVoucher.get(p.voucher_url) : null;
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm">
                    <p className="font-semibold text-slate-900">
                      Unidad {c.unidades.codigo} · {c.unidades.personas?.nombres ?? "—"}
                    </p>
                    <p className="text-slate-600">
                      {soles(Number(p.monto))} · <span className="capitalize">{p.medio}</span> · {fechaCorta(p.fecha)}
                      {p.operacion && ` · Op. ${p.operacion}`} · cuota de <span className="capitalize">{nombreMes(String(c.periodo).slice(0, 7))}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {url ? (
                      <a href={url} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-petroleo-700 hover:bg-petroleo-50">
                        Ver voucher
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">Sin voucher</span>
                    )}
                    <form action={validarPago}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="inline-flex min-h-10 items-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">Validar</button>
                    </form>
                    <form action={rechazarPago}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm text-slate-500 hover:text-red-700">Rechazar</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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

      <Tarjeta titulo={`Pagos de ${nombreMes(mes)}`}>
        {filas.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay cuotas generadas para este mes.{" "}
            <Link href={`/panel/edificios/${id}/cuotas?mes=${mes}`} className="font-semibold text-petroleo-700 hover:underline">
              Generarlas en Cuotas
            </Link>
          </p>
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
