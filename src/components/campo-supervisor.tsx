import Link from "next/link";
import { Selector } from "./form-accion";

export type Supervisor = { id: string; nombre: string; email: string | null; conUsuario: boolean };

// Lista desplegable con el personal de cargo Supervisor
export function CampoSupervisor({ supervisores, actual }: { supervisores: Supervisor[]; actual?: string | null }) {
  const opciones: [string, string][] = [
    ["", "Sin supervisor"],
    ...supervisores.map((s): [string, string] => [s.id, s.conUsuario ? s.nombre : `${s.nombre} (sin usuario en la app)`]),
  ];
  return (
    <div>
      <Selector name="supervisor_id" label="Supervisor asignado" opciones={opciones} defaultValue={actual ?? ""} />
      <p className="mt-1 text-xs text-slate-500">
        {supervisores.length === 0 ? "Aún no hay supervisores en Personal. " : "Personal con cargo Supervisor. "}
        <Link href="/panel/personal/nuevo" className="font-semibold text-petroleo-700 hover:underline">
          Agregar supervisor
        </Link>
      </p>
    </div>
  );
}
