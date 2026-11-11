"use client";

import { useActionState, useState } from "react";
import { iniciarSesion, registrarse, type EstadoForm } from "./actions";

const inicial: EstadoForm = {};

export function LoginForm() {
  const [modo, setModo] = useState<"login" | "registro">("login");
  const [estLogin, accLogin, cargandoLogin] = useActionState(iniciarSesion, inicial);
  const [estReg, accReg, cargandoReg] = useActionState(registrarse, inicial);
  const esLogin = modo === "login";
  const estado = esLogin ? estLogin : estReg;
  const cargando = esLogin ? cargandoLogin : cargandoReg;

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Zolcon Edificios</h1>
      <p className="mt-1 text-sm text-slate-500">
        {esLogin ? "Ingresa a tu cuenta" : "Crea la cuenta de tu empresa administradora"}
      </p>

      <form action={esLogin ? accLogin : accReg} className="mt-6 space-y-4">
        {!esLogin && <Campo name="nombre" label="Tu nombre" required />}
        <Campo name="email" type="email" label="Correo" required />
        <Campo name="password" type="password" label="Contraseña" required />

        {estado.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{estado.error}</p>}
        {estado.ok && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{estado.ok}</p>}

        <button
          disabled={cargando}
          className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {cargando ? "Procesando…" : esLogin ? "Ingresar" : "Crear cuenta"}
        </button>
      </form>

      <button
        onClick={() => setModo(esLogin ? "registro" : "login")}
        className="mt-4 w-full text-center text-sm text-slate-600 hover:underline"
      >
        {esLogin ? "¿Eres una administradora nueva? Regístrate" : "¿Ya tienes cuenta? Ingresa"}
      </button>
    </div>
  );
}

export function Campo({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        {...props}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
      />
    </label>
  );
}
