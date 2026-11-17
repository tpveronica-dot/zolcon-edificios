"use client";

import { useMemo, useState } from "react";
import { FormAccion } from "@/components/form-accion";
import { guardarDistribucion } from "@/app/panel/actions";
import { METODOS, type Metodo } from "@/lib/distribucion";

type Unidad = { id: string; codigo: string; tipo: string; area: number | null; pct: number };

const soles = (n: number) => `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v: string) => {
  const n = Number(String(v).replace(/\s/g, "").replace(",", ".").replace("%", ""));
  return Number.isFinite(n) ? n : 0;
};

export function Distribucion({
  edificioId,
  mes,
  metodoActual,
  unidades,
  totalMensual,
  editable,
}: {
  edificioId: string;
  mes: string;
  metodoActual: Metodo;
  unidades: Unidad[];
  totalMensual: number;
  editable: boolean;
}) {
  const [metodo, setMetodo] = useState<Metodo>(metodoActual);
  const [pcts, setPcts] = useState<Record<string, string>>(
    Object.fromEntries(unidades.map((u) => [u.id, u.pct ? String(u.pct) : ""]))
  );

  const calculo = useMemo(() => {
    const areaTotal = unidades.reduce((s, u) => s + (u.area ?? 0), 0);
    const filas = unidades.map((u) => {
      let fraccion = 0;
      if (metodo === "metraje") fraccion = areaTotal > 0 && (u.area ?? 0) > 0 ? (u.area ?? 0) / areaTotal : 0;
      else if (metodo === "igual") fraccion = unidades.length ? 1 / unidades.length : 0;
      else fraccion = num(pcts[u.id] ?? "") / 100;
      return { ...u, fraccion, cuota: totalMensual * fraccion };
    });
    const sumaPct = filas.reduce((s, f) => s + f.fraccion * 100, 0);
    const sinArea = unidades.filter((u) => !((u.area ?? 0) > 0)).map((u) => u.codigo);
    return { filas, sumaPct, sinArea };
  }, [metodo, pcts, unidades, totalMensual]);

  const cuadra = Math.abs(calculo.sumaPct - 100) < 0.01;
  const aviso =
    metodo === "metraje" && calculo.sinArea.length
      ? `Falta el área de: ${calculo.sinArea.join(", ")}. Complétala en Unidades para repartir por metraje.`
      : metodo === "libre" && !cuadra
        ? `Los porcentajes suman ${calculo.sumaPct.toFixed(2)} %; deben sumar 100 %.`
        : null;

  return (
    <FormAccion action={guardarDistribucion} boton={editable ? "Guardar forma de reparto" : ""} limpiar={false} className="space-y-5">
      <input type="hidden" name="edificio_id" value={edificioId} />
      <input type="hidden" name="mes" value={mes} />
      <input type="hidden" name="metodo" value={metodo} />
      <input type="hidden" name="porcentajes" value={JSON.stringify(pcts)} />

      <fieldset className="grid gap-3 sm:grid-cols-3" disabled={!editable}>
        <legend className="sr-only">Forma de reparto</legend>
        {METODOS.map((m) => (
          <label
            key={m.valor}
            className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 ${
              metodo === m.valor ? "border-petroleo-700 bg-petroleo-50 ring-1 ring-petroleo-700" : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <input
                type="radio"
                name="metodo_radio"
                value={m.valor}
                checked={metodo === m.valor}
                onChange={() => setMetodo(m.valor)}
                className="h-4 w-4 accent-petroleo-700"
              />
              {m.titulo}
            </span>
            <span className="text-xs text-slate-600">{m.descripcion}</span>
          </label>
        ))}
      </fieldset>

      {aviso && <p className="rounded-xl border border-amber-200 bg-amber-100/60 p-3 text-sm text-amber-800">{aviso}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3">Unidad</th>
              <th className="py-2 pr-3 text-right">Área m²</th>
              <th className="w-36 py-2 pr-3 text-right">% de la cuota</th>
              <th className="py-2 text-right">Cuota mensual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {calculo.filas.map((f) => (
              <tr key={f.id}>
                <td className="py-2 pr-3 font-medium text-slate-900">{f.codigo}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{f.area ?? "—"}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {metodo === "libre" && editable ? (
                    <input
                      aria-label={`% de la unidad ${f.codigo}`}
                      inputMode="decimal"
                      value={pcts[f.id] ?? ""}
                      onChange={(e) => setPcts((p) => ({ ...p, [f.id]: e.target.value }))}
                      placeholder="0"
                      className="min-h-10 w-24 rounded-lg border border-slate-300 bg-white px-2 text-right outline-none focus:border-petroleo-700 focus:ring-1 focus:ring-petroleo-700"
                    />
                  ) : (
                    `${(f.fraccion * 100).toFixed(2)} %`
                  )}
                </td>
                <td className="py-2 text-right tabular-nums">{soles(f.cuota)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 font-semibold">
            <tr>
              <td className="py-2 pr-3" colSpan={2}>Total</td>
              <td className={`py-2 pr-3 text-right tabular-nums ${cuadra ? "" : "text-amber-700"}`}>{calculo.sumaPct.toFixed(2)} %</td>
              <td className="py-2 text-right tabular-nums">{soles(calculo.filas.reduce((s, f) => s + f.cuota, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Vista previa con el total mensual del presupuesto ({soles(totalMensual)}). Al generar, los céntimos de redondeo se ajustan
        para que la suma sea exacta. Cambiar el reparto afecta las cuotas que se generen desde ahora.
      </p>
    </FormAccion>
  );
}
