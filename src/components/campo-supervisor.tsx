import Link from "next/link";
import { Selector } from "./form-accion";

export type Supervisor = { id: string; nombre: string | null; email: string | null };

// Lista desplegable con los usuarios de rol Supervisor de la empresa
export function CampoSupervisor({ supervisores, actual }: { supervisores: Supervisor[]; actual?: string | null }) {
  const opciones: [string, string][] = [
    ["", "Sin supervisor"],
    ...supervisores.map((s): [string, string] => [s.id, s.nombre ? `${s.nombre} · ${s.email}` : (s.email ?? "")]),
  ];
  return (
    <div>
      <Selector name="supervisor_id" label="Supervisor asignado" opciones={opciones} defaultValue={actual ?? ""} />
      <p className="mt-1 text-xs text-slate-500">
        {supervisores.length === 0 ? "Aún no hay usuarios con rol Supervisor. " : "Solo aparecen usuarios activos con rol Supervisor. "}
        <Link href="/panel/usuarios/nuevo" className="font-semibold text-petroleo-700 hover:underline">
          Crear supervisor
        </Link>
      </p>
    </div>
  );
}
