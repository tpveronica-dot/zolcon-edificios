"use client";

import { useActionState, useRef, useEffect } from "react";

type Estado = { error?: string; ok?: string };

// Formulario genérico: ejecuta una Server Action y muestra el resultado
export function FormAccion({
  action,
  children,
  boton,
  className = "",
}: {
  action: (prev: Estado, fd: FormData) => Promise<Estado>;
  children: React.ReactNode;
  boton: string;
  className?: string;
}) {
  const [estado, accion, cargando] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok) ref.current?.reset();
  }, [estado]);

  return (
    <form ref={ref} action={accion} className={className}>
      {children}
      <div className="col-span-full flex flex-wrap items-center gap-3">
        <button
          disabled={cargando}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {cargando ? "Guardando…" : boton}
        </button>
        {estado.ok && <span className="text-sm text-emerald-700">{estado.ok}</span>}
      </div>
      {estado.error && (
        <p className="col-span-full whitespace-pre-line rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {estado.error}
        </p>
      )}
    </form>
  );
}

export function Campo({
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        {...props}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
      />
    </label>
  );
}

export function Selector({
  label,
  opciones,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; opciones: [string, string][] }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <select
        {...props}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
      >
        {opciones.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Tarjeta({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {titulo && <h2 className="mb-4 text-base font-semibold text-slate-900">{titulo}</h2>}
      {children}
    </section>
  );
}
