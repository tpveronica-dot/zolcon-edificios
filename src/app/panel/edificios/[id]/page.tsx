import Link from "next/link";
import { Suspense } from "react";
import { Encabezado, Indicador } from "./encabezado";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esStaff } from "@/lib/auth";
import { FormAccion, Campo, Selector, Tarjeta } from "@/components/form-accion";
import { crearUnidad, eliminarUnidad, importarUnidades } from "../../actions";

export default function EdificioPage({ params }: PageProps<"/panel/edificios/[id]">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

const TIPOS: [string, string][] = [
  ["departamento", "Departamento"],
  ["estacionamiento", "Estacionamiento"],
  ["deposito", "Depósito"],
  ["local", "Local"],
];

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await getPerfil();
  const supabase = await createClient();

  const [{ data: edificio }, { data: unidades }] = await Promise.all([
    supabase.from("edificios").select("id, nombre, direccion, distrito, dia_vencimiento").eq("id", id).single(),
    supabase
      .from("unidades")
      .select("id, codigo, tipo, area_m2, porcentaje_participacion, personas(nombres, documento, email, telefono)")
      .eq("edificio_id", id)
      .order("codigo"),
  ]);
  if (!edificio) notFound();

  const staff = esStaff(perfil);
  const lista = unidades ?? [];
  const sumaPct = lista.reduce((s, u) => s + Number(u.porcentaje_participacion), 0);
  const cuadra = Math.abs(sumaPct - 100) < 0.01;

  return (
    <div className="space-y-6">
      <Encabezado id={id} edificio={edificio} activa="unidades" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Indicador titulo="Unidades" valor={String(lista.length)} />
        <Indicador titulo="Propietarios" valor={String(new Set(lista.map((u) => (u.personas as unknown as { nombres: string } | null)?.nombres).filter(Boolean)).size)} />
        <Indicador
          titulo="Suma de % de participación"
          valor={`${sumaPct.toFixed(2)} %`}
          tono={lista.length > 0 && !cuadra ? "alerta" : "normal"}
          nota={lista.length > 0 && !cuadra ? "Debe sumar 100 % para calcular bien las cuotas" : undefined}
        />
      </div>

      {staff && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Tarjeta titulo="Agregar unidad">
            <FormAccion action={crearUnidad} boton="Agregar" className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="edificio_id" value={id} />
              <Campo name="codigo" label="Código (ej. 301)" required />
              <Selector name="tipo" label="Tipo" opciones={TIPOS} />
              <Campo name="area_m2" label="Área m²" inputMode="decimal" />
              <Campo name="porcentaje" label="% participación" inputMode="decimal" />
              <Campo name="propietario" label="Propietario" className="sm:col-span-2" />
              <Campo name="documento" label="DNI / RUC" />
              <Campo name="telefono" label="Celular" />
              <Campo name="email" label="Correo" type="email" className="sm:col-span-2" />
            </FormAccion>
          </Tarjeta>

          <Tarjeta titulo="Carga masiva desde Excel">
            <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>
                Descarga la{" "}
                <a href="/plantilla_unidades.csv" download className="font-medium text-slate-900 underline">
                  plantilla
                </a>{" "}
                y ábrela en Excel.
              </li>
              <li>Llena una fila por unidad (si una persona tiene varias unidades, repite sus datos).</li>
              <li>Guarda como <strong>CSV</strong> y súbelo aquí. Si un código ya existe, se actualiza.</li>
            </ol>
            <FormAccion action={importarUnidades} boton="Importar" className="space-y-3">
              <input type="hidden" name="edificio_id" value={id} />
              <input
                type="file"
                name="archivo"
                accept=".csv,text/csv"
                required
                className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
              />
            </FormAccion>
          </Tarjeta>
        </div>
      )}

      <Tarjeta titulo="Unidades y propietarios">
        {lista.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay unidades registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Código</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4 text-right">Área m²</th>
                  <th className="py-2 pr-4 text-right">% Part.</th>
                  <th className="py-2 pr-4">Propietario</th>
                  <th className="py-2 pr-4">Contacto</th>
                  {staff && <th />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((u) => {
                  const p = u.personas as unknown as { nombres: string; documento: string | null; email: string | null; telefono: string | null } | null;
                  return (
                    <tr key={u.id}>
                      <td className="py-2 pr-4 font-medium text-slate-900">{u.codigo}</td>
                      <td className="py-2 pr-4 capitalize text-slate-600">{u.tipo}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{u.area_m2 ?? "—"}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{Number(u.porcentaje_participacion).toFixed(4)}</td>
                      <td className="py-2 pr-4">
                        {p?.nombres ?? <span className="text-slate-400">Sin asignar</span>}
                        {p?.documento && <span className="block text-xs text-slate-500">{p.documento}</span>}
                      </td>
                      <td className="py-2 pr-4 text-slate-600">
                        {p?.telefono}
                        {p?.email && <span className="block text-xs">{p.email}</span>}
                      </td>
                      {staff && (
                        <td className="py-2 text-right">
                          <Link href={`/panel/edificios/${id}/unidades/${u.id}`} className="mr-3 text-xs font-medium text-slate-700 hover:underline">
                            Editar
                          </Link>
                          <form action={eliminarUnidad} className="inline">
                            <input type="hidden" name="id" value={u.id} />
                            <button className="text-xs text-slate-400 hover:text-red-600">Eliminar</button>
                          </form>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
