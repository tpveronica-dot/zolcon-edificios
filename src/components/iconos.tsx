// Íconos de trazo (sin librerías externas)
type P = { className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconoEdificio = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M4 21V8l8-5 8 5v13" /><path d="M9 21v-6h6v6" /></svg>
);
export const IconoSalir = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5M5 12h11" /></svg>
);
export const IconoCheck = ({ className = "h-3.5 w-3.5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} strokeWidth={2.5}><path d="M5 12l5 5L20 7" /></svg>
);
export const IconoParcial = ({ className = "h-3.5 w-3.5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} strokeWidth={2.5}><circle cx="12" cy="12" r="8" /><path d="M12 4v16" /></svg>
);
export const IconoReloj = ({ className = "h-3.5 w-3.5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} strokeWidth={2.5}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>
);
export const IconoAlerta = ({ className = "h-3.5 w-3.5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} strokeWidth={2.5}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>
);
export const IconoAnulada = ({ className = "h-3.5 w-3.5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} strokeWidth={2.5}><circle cx="12" cy="12" r="9" /><path d="M6 18L18 6" /></svg>
);

export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ambar text-slate-900">
        <IconoEdificio className="h-5 w-5" />
      </span>
      <span className={`font-display text-lg font-extrabold ${claro ? "text-white" : "text-slate-900"}`}>
        Zolcon<span className={`font-semibold ${claro ? "text-petroleo-100" : "text-slate-500"}`}> Edificios</span>
      </span>
    </span>
  );
}
