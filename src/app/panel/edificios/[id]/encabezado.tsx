import Link from "next/link";

type Pestana = "unidades" | "presupuesto" | "cuotas";

export function Encabezado({
  id,
  edificio,
  activa,
  gestionar = false,
}: {
  id: string;
  edificio: { nombre: string; direccion: string | null; distrito: string | null; dia_vencimiento: number };
  activa: Pestana;
  gestionar?: boolean; // muestra Editar / Eliminar
}) {
  const pestanas: [Pestana, string, string][] = [
    ["unidades", "Unidades", `/panel/edificios/${id}`],
    ["presupuesto", "Presupuesto", `/panel/edificios/${id}/presupuesto`],
    ["cuotas", "Cuotas y pagos", `/panel/edificios/${id}/cuotas`],
  ];
  return (
    <div>
      <Link href="/panel" className="text-sm text-slate-500 hover:underline">
        ← Edificios
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold text-slate-900">{edificio.nombre}</h1>
        {gestionar && (
          <div className="flex gap-2">
            <Link
              href={`/panel/edificios/${id}/editar`}
              className="inline-flex min-h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Editar
            </Link>
            <Link
              href={`/panel/edificios/${id}/editar#eliminar`}
              className="inline-flex min-h-9 items-center rounded-xl border border-red-200 bg-white px-3 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Eliminar
            </Link>
          </div>
        )}
      </div>
      <p className="text-sm text-slate-500">
        {[edificio.direccion, edificio.distrito].filter(Boolean).join(", ")} · Vence el día {edificio.dia_vencimiento}
      </p>
      <nav className="mt-5 flex gap-1 border-b border-slate-200">
        {pestanas.map(([clave, texto, href]) => (
          <Link
            key={clave}
            href={href}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold ${
              activa === clave
                ? "border-petroleo-700 text-petroleo-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {texto}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function Indicador({ titulo, valor, nota, tono = "normal" }: { titulo: string; valor: string; nota?: string; tono?: "normal" | "alerta" | "bien" | "mal" }) {
  const color = { normal: "text-slate-900", alerta: "text-amber-600", bien: "text-emerald-700", mal: "text-red-600" }[tono];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className={`mt-1 font-display text-3xl font-extrabold tabular-nums ${color}`}>{valor}</p>
      {nota && <p className={`mt-1 text-xs ${tono === "alerta" ? "text-amber-700" : "text-slate-500"}`}>{nota}</p>}
    </div>
  );
}
