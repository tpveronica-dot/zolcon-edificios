import Link from "next/link";
import { FormAccion, Campo, Selector } from "@/components/form-accion";
import { guardarPersonal } from "./actions";

export const CARGOS: [string, string][] = [
  ["supervisor", "Supervisor"],
  ["conserje", "Conserje"],
  ["limpieza", "Personal de limpieza"],
];

export type Persona = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  usuario_id: string | null;
  cargo: string;
  edificios: string[];
};

export function FormularioPersonal({
  persona,
  edificios,
  usuarios,
}: {
  persona?: Persona;
  edificios: { id: string; nombre: string }[];
  usuarios: { id: string; nombre: string | null; email: string | null }[];
}) {
  const opcionesUsuario: [string, string][] = [
    ["", "Sin usuario (no ingresa a la app)"],
    ...usuarios.map((u): [string, string] => [u.id, u.nombre ? `${u.nombre} · ${u.email}` : (u.email ?? "")]),
  ];

  return (
    <FormAccion action={guardarPersonal} boton="Guardar" limpiar={false} className="grid gap-4 sm:grid-cols-2">
      {persona && <input type="hidden" name="personal_id" value={persona.id} />}
      <Campo name="nombre" label="Nombre completo" defaultValue={persona?.nombre} required className="sm:col-span-2" />
      <Campo name="telefono" label="Teléfono" type="tel" defaultValue={persona?.telefono ?? ""} />
      <Campo name="email" label="Correo" type="email" defaultValue={persona?.email ?? ""} />
      <Selector name="cargo" label="Cargo" opciones={CARGOS} defaultValue={persona?.cargo ?? "conserje"} />
      <div>
        <Selector name="usuario_id" label="Usuario en la app (opcional)" opciones={opcionesUsuario} defaultValue={persona?.usuario_id ?? ""} />
        <p className="mt-1 text-xs text-slate-500">
          Solo si esta persona ingresa a la app.{" "}
          <Link href="/panel/usuarios/nuevo" className="font-semibold text-petroleo-700 hover:underline">
            Crear usuario
          </Link>
        </p>
      </div>

      <fieldset className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
        <legend className="px-1 text-xs font-semibold text-slate-600">Edificios asignados</legend>
        {edificios.length === 0 ? (
          <p className="text-sm text-slate-500">Primero crea un edificio.</p>
        ) : (
          <div className="grid gap-1 sm:grid-cols-2">
            {edificios.map((e) => (
              <label key={e.id} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  name="edificios"
                  value={e.id}
                  defaultChecked={persona?.edificios.includes(e.id)}
                  className="h-4 w-4 accent-petroleo-700"
                />
                {e.nombre}
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </FormAccion>
  );
}
