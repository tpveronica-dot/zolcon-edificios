"use client";

import { useMemo, useState } from "react";
import { FormAccion } from "@/components/form-accion";
import { guardarInforme } from "@/app/panel/actions";

export type Linea = { partida_id: string | null; concepto: string; presupuestado: number; real: string; nota: string };

const soles = (n: number) =>
  `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v: string) => {
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const celda = "w-full min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-petroleo-700 focus:ring-1 focus:ring-petroleo-700 disabled:bg-slate-50 disabled:text-slate-500";

export function FormularioInforme({
  edificioId,
  mes,
  partidas,
  extras: extrasIniciales,
  notas,
  editable,
}: {
  edificioId: string;
  mes: string;
  partidas: Linea[];
  extras: Linea[];
  notas: string;
  editable: boolean;
}) {
  const [lineas, setLineas] = useState(partidas);
  const [extras, setExtras] = useState<Linea[]>(
    extrasIniciales.length || !editable ? extrasIniciales : []
  );

  const totales = useMemo(() => {
    const pres = lineas.reduce((s, l) => s + l.presupuestado, 0);
    const real = lineas.reduce((s, l) => s + num(l.real), 0);
    const noPres = extras.reduce((s, l) => s + num(l.real), 0);
    return { pres, real, noPres, totalReal: real + noPres, dif: pres - real - noPres };
  }, [lineas, extras]);

  const cambiar = (i: number, campo: "real" | "nota", v: string) =>
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: v } : l)));
  const cambiarExtra = (i: number, campo: "concepto" | "real" | "nota", v: string) =>
    setExtras((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: v } : l)));
  const agregarExtra = () => setExtras((ls) => [...ls, { partida_id: null, concepto: "", presupuestado: 0, real: "", nota: "" }]);
  const quitarExtra = (i: number) => setExtras((ls) => ls.filter((_, j) => j !== i));

  const payload = JSON.stringify([...lineas, ...extras]);

  return (
    <FormAccion action={guardarInforme} boton={editable ? "Guardar informe" : ""} limpiar={false} className="space-y-6">
      <input type="hidden" name="edificio_id" value={edificioId} />
      <input type="hidden" name="mes" value={mes} />
      <input type="hidden" name="lineas" value={payload} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Resumen titulo="Presupuestado del mes" valor={soles(totales.pres)} />
        <Resumen titulo="Gasto real" valor={soles(totales.totalReal)} nota={totales.pres ? `${((totales.totalReal / totales.pres) * 100).toFixed(0)} % del presupuesto` : undefined} />
        <Resumen titulo="No presupuestado" valor={soles(totales.noPres)} tono={totales.noPres > 0 ? "alerta" : "normal"} />
        <Resumen
          titulo={totales.dif >= 0 ? "Ahorro del mes" : "Exceso del mes"}
          valor={soles(Math.abs(totales.dif))}
          tono={totales.dif >= 0 ? "bien" : "mal"}
        />
      </div>

      <section>
        <h3 className="mb-3 text-lg font-bold text-slate-900">Partidas del presupuesto</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Partida</th>
                <th className="py-2 pr-3 text-right">Presupuestado</th>
                <th className="w-40 py-2 pr-3 text-right">Gasto real S/</th>
                <th className="py-2 pr-3 text-right">Diferencia</th>
                <th className="py-2">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lineas.map((l, i) => {
                const dif = l.presupuestado - num(l.real);
                return (
                  <tr key={l.partida_id ?? i}>
                    <td className="py-2 pr-3 font-medium text-slate-900">{l.concepto}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{soles(l.presupuestado)}</td>
                    <td className="py-2 pr-3">
                      <input
                        aria-label={`Gasto real de ${l.concepto}`}
                        inputMode="decimal"
                        value={l.real}
                        onChange={(e) => cambiar(i, "real", e.target.value)}
                        disabled={!editable}
                        placeholder="0.00"
                        className={`${celda} text-right tabular-nums`}
                      />
                    </td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${l.real === "" ? "text-slate-400" : dif >= 0 ? "text-emerald-700" : "font-semibold text-red-700"}`}>
                      {l.real === "" ? "—" : `${dif >= 0 ? "" : "−"}${soles(Math.abs(dif))}`}
                    </td>
                    <td className="py-2">
                      <input
                        aria-label={`Nota de ${l.concepto}`}
                        value={l.nota}
                        onChange={(e) => cambiar(i, "nota", e.target.value)}
                        disabled={!editable}
                        className={celda}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900">Gastos no presupuestados</h3>
          {editable && (
            <button
              type="button"
              onClick={agregarExtra}
              className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-petroleo-700 hover:bg-petroleo-50"
            >
              + Agregar gasto no presupuestado
            </button>
          )}
        </div>
        {extras.length === 0 ? (
          <p className="text-sm text-slate-500">No hay gastos no presupuestados este mes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Concepto</th>
                  <th className="w-40 py-2 pr-3 text-right">Monto S/</th>
                  <th className="py-2 pr-3">Nota</th>
                  {editable && <th />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {extras.map((l, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3">
                      <input
                        aria-label="Concepto"
                        value={l.concepto}
                        onChange={(e) => cambiarExtra(i, "concepto", e.target.value)}
                        disabled={!editable}
                        placeholder="Ej. Reparación de bomba de agua"
                        className={celda}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        aria-label="Monto"
                        inputMode="decimal"
                        value={l.real}
                        onChange={(e) => cambiarExtra(i, "real", e.target.value)}
                        disabled={!editable}
                        placeholder="0.00"
                        className={`${celda} text-right tabular-nums`}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        aria-label="Nota"
                        value={l.nota}
                        onChange={(e) => cambiarExtra(i, "nota", e.target.value)}
                        disabled={!editable}
                        className={celda}
                      />
                    </td>
                    {editable && (
                      <td className="py-2 text-right">
                        <button type="button" onClick={() => quitarExtra(i)} className="text-xs text-slate-400 hover:text-red-700">
                          Quitar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600">Observaciones del mes</span>
        <textarea
          name="notas"
          defaultValue={notas}
          disabled={!editable}
          rows={3}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-petroleo-700 focus:ring-1 focus:ring-petroleo-700 disabled:bg-slate-50"
        />
      </label>
    </FormAccion>
  );
}

function Resumen({ titulo, valor, nota, tono = "normal" }: { titulo: string; valor: string; nota?: string; tono?: "normal" | "alerta" | "bien" | "mal" }) {
  const color = { normal: "text-slate-900", alerta: "text-amber-700", bien: "text-emerald-700", mal: "text-red-700" }[tono];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className={`mt-1 font-display text-2xl font-extrabold tabular-nums ${color}`}>{valor}</p>
      {nota && <p className="mt-1 text-xs text-slate-500">{nota}</p>}
    </div>
  );
}
