"use client";

import { useState } from "react";
import Link from "next/link";
import { FormAccion, Campo, Selector } from "@/components/form-accion";
import type { Estado } from "./actions";

const ROLES: [string, string, string][] = [
  ["administrador", "Administrador de edificio", "Gestiona unidades, cuotas y pagos de los edificios que le asignes."],
  ["junta", "Junta directiva", "Solo consulta: presupuesto, gastos, cuotas y morosidad de su edificio."],
  ["propietario", "Propietario", "Ve su unidad, sus cuotas y pagos. Se vincula con la ficha que tenga el mismo correo."],
  ["admin_empresa", "Admin. de empresa", "Acceso total a la empresa, incluida esta pantalla de usuarios."],
];
const CON_EDIFICIOS = ["administrador", "junta"];

export function FormularioUsuario({
  action,
  edificios,
  usuario,
  esYo = false,
}: {
  action: (prev: Estado, fd: FormData) => Promise<Estado>;
  edificios: { id: string; nombre: string }[];
  usuario?: { id: string; rol: string; edificios: string[] };
  esYo?: boolean;
}) {
  const [rol, setRol] = useState(usuario?.rol ?? "administrador");
  const descripcion = ROLES.find((r) => r[0] === rol)?.[2];

  return (
    <FormAccion action={action} boton="Guardar" limpiar={false} className="grid gap-4">
      {usuario ? (
        <input type="hidden" name="usuario_id" value={usuario.id} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo name="nombre" label="Nombre completo" required />
          <Campo name="email" label="Correo" type="email" required />
        </div>
      )}

      <div>
        <Selector
          name="rol"
          label="Rol"
          opciones={ROLES.map(([v, t]) => [v, t] as [string, string])}
          value={rol}
          onChange={(e) => setRol(e.target.value)}
          disabled={esYo}
        />
        {esYo && <input type="hidden" name="rol" value={rol} />}
        {descripcion && <p className="mt-2 text-sm text-slate-500">{descripcion}</p>}
        {esYo && <p className="mt-1 text-xs text-amber-700">No puedes cambiar tu propio rol.</p>}
      </div>

      {CON_EDIFICIOS.includes(rol) && (
        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-xs font-semibold text-slate-600">Edificios a los que tendrá acceso</legend>
          {edificios.length === 0 ? (
            <p className="text-sm text-slate-500">Primero crea un edificio.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {edificios.map((e) => (
                <label key={e.id} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    name="edificios"
                    value={e.id}
                    defaultChecked={usuario?.edificios.includes(e.id)}
                    className="h-4 w-4 accent-petroleo-700"
                  />
                  {e.nombre}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}

      <div className="col-span-full -mb-2">
        <Link href="/panel/usuarios" className="text-sm text-slate-500 hover:underline">
          Cancelar
        </Link>
      </div>
    </FormAccion>
  );
}
