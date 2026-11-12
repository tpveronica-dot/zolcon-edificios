import { IconoAlerta, IconoAnulada, IconoCheck, IconoParcial, IconoReloj } from "./iconos";

// Insignia de estado: color + ícono propio (se distingue sin depender del color)
const ESTADOS = {
  pagada: { texto: "Pagada", clase: "bg-emerald-100 text-emerald-700", Icono: IconoCheck },
  parcial: { texto: "Parcial", clase: "bg-sky-100 text-sky-800", Icono: IconoParcial },
  pendiente: { texto: "Pendiente", clase: "bg-amber-100 text-amber-700", Icono: IconoReloj },
  vencida: { texto: "Vencida", clase: "bg-red-50 text-red-700", Icono: IconoAlerta },
  anulada: { texto: "Anulada", clase: "bg-slate-100 text-slate-500", Icono: IconoAnulada },
} as const;

export function EstadoCuota({ estado, vencida = false }: { estado: string; vencida?: boolean }) {
  const clave = (vencida && (estado === "pendiente" || estado === "parcial") ? "vencida" : estado) as keyof typeof ESTADOS;
  const { texto, clase, Icono } = ESTADOS[clave] ?? ESTADOS.pendiente;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${clase}`}>
      <Icono />
      {texto}
      {clave === "vencida" && estado === "parcial" && <span className="font-medium">· parcial</span>}
    </span>
  );
}
