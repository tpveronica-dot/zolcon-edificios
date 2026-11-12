"use client";

import { useState } from "react";

// Copia el enlace de registro para enviarlo por WhatsApp o correo
export function CopiarEnlace({ email }: { email: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    const enlace = `${window.location.origin}/login?registro=${encodeURIComponent(email)}`;
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt("Copia este enlace:", enlace);
    }
  };
  return (
    <button
      type="button"
      onClick={copiar}
      className="inline-flex min-h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-petroleo-700 hover:bg-petroleo-50"
    >
      {copiado ? "¡Enlace copiado!" : "Copiar enlace de acceso"}
    </button>
  );
}
