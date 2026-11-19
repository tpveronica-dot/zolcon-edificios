import Link from "next/link";
import { enlaceRecibo, type CuotaPortal, type UnidadPortal } from "@/lib/portal";
import type { LineaPartida } from "@/lib/repartir";
import { soles, nombreMes, fechaCorta } from "@/lib/formato";
import { EstadoCuota } from "@/components/estado-cuota";

// Vista (sin acceso a datos) de una unidad en el portal del propietario
const MEDIO: Record<string, string> = {
  transferencia: "Transferencia", yape: "Yape", plin: "Plin", deposito: "Depósito", efectivo: "Efectivo", otro: "Otro",
};

export function Unidad({ u, actual, lineas, hoy }: { u: UnidadPortal; actual: CuotaPortal | null; lineas: LineaPartida[]; hoy: string }) {
  const conSaldo = u.cuotas.filter((c) => c.saldo > 0);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-900">
          {u.tipo === "departamento" ? "Dpto." : u.tipo.charAt(0).toUpperCase() + u.tipo.slice(1)} {u.codigo}
        </h1>
        <p className="text-sm text-slate-500">{u.edificio}{u.direccion && ` · ${u.direccion}`}</p>
      </div>

      {/* Tarjeta principal */}
      {actual ? (
        <CuotaPrincipal u={u} c={actual} hoy={hoy} />
      ) : (
        <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Todavía no hay cuotas emitidas.</p>
      )}

      {u.deuda > 0 && conSaldo.length > 1 && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Tienes <strong>{conSaldo.length} cuotas</strong> con saldo. Deuda total: <strong>{soles(u.deuda)}</strong>
        </p>
      )}

      {lineas.length > 0 && actual && (
        <details className="group rounded-2xl border border-slate-200 bg-white">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 text-sm font-semibold text-slate-900">
            ¿En qué se usa mi cuota de {nombreMes(actual.mes)}?
            <span className="text-slate-400 transition group-open:rotate-180">⌄</span>
          </summary>
          <ul className="divide-y divide-slate-100 px-5 pb-3 text-sm">
            {lineas.map((l) => (
              <li key={l.id} className="flex justify-between py-2">
                <span className="text-slate-600">{l.nombre}</span>
                <span className="font-medium tabular-nums text-slate-900">{soles(l.importe)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Historial */}
      {u.cuotas.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <h2 className="px-5 pt-4 text-sm font-bold text-slate-900">Mis cuotas</h2>
          <ul className="divide-y divide-slate-100">
            {u.cuotas.map((c) => (
              <li key={c.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold capitalize text-slate-900">{nombreMes(c.mes)}</p>
                    <p className="text-xs text-slate-500">
                      {soles(c.monto)} · vence {fechaCorta(c.vencimiento)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <EstadoCuota estado={c.estado} vencida={c.vencimiento < hoy} />
                    <a
                      href={enlaceRecibo(u.edificioId, c)}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-petroleo-700 hover:bg-petroleo-50"
                      aria-label={`Recibo de ${nombreMes(c.mes)}`}
                    >
                      PDF
                    </a>
                  </div>
                </div>
                {c.pagos.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-slate-500">
                    {c.pagos.map((p) => (
                      <li key={p.id}>
                        {fechaCorta(p.fecha)} · {soles(p.monto)} · {MEDIO[p.medio] ?? p.medio}
                        {!p.validado && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">En revisión</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function CuotaPrincipal({ u, c, hoy }: { u: UnidadPortal; c: CuotaPortal; hoy: string }) {
  const vencida = c.saldo > 0 && c.vencimiento < hoy;
  const pagada = c.saldo <= 0;
  return (
    <div className={`rounded-2xl p-5 text-white ${pagada ? "bg-emerald-700" : vencida ? "bg-red-700" : "bg-petroleo-700"}`}>
      <p className="text-sm opacity-90">Cuota de {nombreMes(c.mes)}</p>
      <p className="mt-1 font-display text-4xl font-extrabold tabular-nums">{soles(pagada ? c.monto : c.saldo)}</p>
      <p className="mt-1 text-sm opacity-90">
        {pagada
          ? "¡Pagada! Gracias 🙌"
          : `${vencida ? "Venció" : "Vence"} el ${fechaCorta(c.vencimiento)}${c.pagado > 0 ? ` · ya pagaste ${soles(c.pagado)}` : ""}`}
      </p>
      {c.enRevision > 0 && (
        <p className="mt-2 rounded-lg bg-white/15 px-3 py-2 text-sm">Pago de {soles(c.enRevision)} en revisión por la administración.</p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {!pagada ? (
          <Link
            href={`/portal/pagar/${c.id}`}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-ambar px-3 text-sm font-bold text-slate-900"
          >
            Reportar pago
          </Link>
        ) : (
          <span />
        )}
        <a
          href={enlaceRecibo(u.edificioId, c)}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white/15 px-3 text-sm font-semibold text-white hover:bg-white/25"
        >
          Ver recibo PDF
        </a>
      </div>
    </div>
  );
}
