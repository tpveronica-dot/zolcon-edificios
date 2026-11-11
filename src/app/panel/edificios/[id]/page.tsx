import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esStaff, esAdminEmpresa } from "@/lib/auth";
import { Tarjeta } from "@/components/form-accion";
import { Encabezado, Indicador } from "./encabezado";
import { eliminarUnidad } from "../../actions";

export default function EdificioPage({ params, searchParams }: PageProps<"/panel/edificios/[id]">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const NOMBRE_TIPO: Record<string, string> = {
  departamento: "Departamento",
  estacionamiento: "Estacionamiento",
  deposito: "Depósito",
  local: "Local",
};

type Persona = { nombres: string; documento: string | null; email: string | null; telefono: string | null };

async function Contenido({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const mensaje = typeof sp.ok === "string" ? sp.ok : null;
  const perfil = await getPerfil();
  const supabase = await createClient();

  const [{ data: edificio }, { data: unidades }] = await Promise.all([
    supabase.from("edificios").select("id, nombre, direccion, distrito, dia_vencimiento").eq("id", id).single(),
    supabase
      .from("unidades")
      .select("id, codigo, tipo, area_m2, porcentaje_participacion, personas(nombres, documento, email, telefono)")
      .eq("edificio_id", id),
  ]);
  if (!edificio) notFound();

  const staff = esStaff(perfil);
  const lista = [...(unidades ?? [])].sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
  const sumaPct = lista.reduce((s, u) => s + Number(u.porcentaje_participacion), 0);
  const cuadra = Math.abs(sumaPct - 100) < 0.01;
  const nPropietarios = new Set(
    lista.map((u) => (u.personas as unknown as Persona | null)?.nombres).filter(Boolean)
  ).size;

  return (
    <div className="space-y-6">
      <Encabezado id={id} edificio={edificio} activa="unidades" gestionar={esAdminEmpresa(perfil)} />

      {mensaje && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">✓ {mensaje}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Indicador titulo="Unidades" valor={String(lista.length)} />
        <Indicador titulo="Propietarios" valor={String(nPropietarios)} />
        <Indicador
          titulo="Suma de % de participación"
          valor={`${sumaPct.toFixed(2)} %`}
          tono={lista.length > 0 && !cuadra ? "alerta" : "normal"}
          nota={lista.length > 0 && !cuadra ? "Debe sumar 100 % para calcular bien las cuotas" : undefined}
        />
      </div>

      <Tarjeta>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Unidades y propietarios</h2>
          {staff && (
            <Link
              href={`/panel/edificios/${id}/unidades/nueva`}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              + Agregar unidades
            </Link>
          )}
        </div>

        {lista.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay unidades registradas. Usa “+ Agregar unidades”.</p>
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
                  const p = u.personas as unknown as Persona | null;
                  return (
                    <tr key={u.id}>
                      <td className="py-2 pr-4 font-medium text-slate-900">{u.codigo}</td>
                      <td className="py-2 pr-4 text-slate-600">{NOMBRE_TIPO[u.tipo] ?? u.tipo}</td>
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
                        <td className="whitespace-nowrap py-2 text-right">
                          <Link
                            href={`/panel/edificios/${id}/unidades/${u.id}`}
                            className="mr-3 text-xs font-medium text-slate-700 hover:underline"
                          >
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
