import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esStaff } from "@/lib/auth";
import { FormAccion, Campo, Selector, Tarjeta } from "@/components/form-accion";
import { crearUnidad, importarUnidades } from "@/app/panel/actions";

export default function NuevaUnidadPage({ params }: PageProps<"/panel/edificios/[id]/unidades/nueva">) {
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
  if (!esStaff(perfil)) redirect(`/panel/edificios/${id}`);
  const supabase = await createClient();
  const { data: edificio } = await supabase.from("edificios").select("nombre").eq("id", id).single();
  if (!edificio) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/panel/edificios/${id}`} className="text-sm text-slate-500 hover:underline">
            ← {edificio.nombre}
          </Link>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Agregar unidades</h1>
          <p className="text-sm text-slate-500">Agrega una unidad a mano o carga varias desde Excel.</p>
        </div>
        <Link
          href={`/panel/edificios/${id}`}
          className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Agregar una unidad">
          <FormAccion action={crearUnidad} boton="Guardar" limpiar={false} className="grid gap-3 sm:grid-cols-2">
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
          <FormAccion action={importarUnidades} boton="Importar" limpiar={false} className="space-y-3">
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
    </div>
  );
}
