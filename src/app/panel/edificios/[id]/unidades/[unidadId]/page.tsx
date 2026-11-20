import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esStaff, esAdminEmpresa, NOMBRE_ROL } from "@/lib/auth";
import { FormAccion, Campo, Selector, Tarjeta } from "@/components/form-accion";
import { actualizarPropietario, actualizarUnidad, darAccesoPortal } from "@/app/panel/actions";
import { CopiarEnlace } from "@/app/panel/usuarios/copiar-enlace";
import { CambiarPropietario } from "./cambiar-propietario";
import { OPCIONES_JUNTA } from "@/lib/junta";

export default function EditarUnidadPage({ params }: PageProps<"/panel/edificios/[id]/unidades/[unidadId]">) {
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

type Persona = { id: string; nombres: string; documento: string | null; email: string | null; telefono: string | null; usuario_id: string | null };

async function Contenido({ params }: { params: Promise<{ id: string; unidadId: string }> }) {
  const { id, unidadId } = await params;
  const perfil = await getPerfil();
  if (!esStaff(perfil)) redirect(`/panel/edificios/${id}`);
  const supabase = await createClient();

  const { data: unidad } = await supabase
    .from("unidades")
    .select("id, codigo, tipo, area_m2, propietario_id, edificios(nombre), personas(id, nombres, documento, email, telefono, usuario_id)")
    .eq("id", unidadId)
    .eq("edificio_id", id)
    .single();
  if (!unidad) notFound();

  const propietario = unidad.personas as unknown as Persona | null;
  const edificio = unidad.edificios as unknown as { nombre: string };

  const [{ data: personas }, { data: otrasUnidades }] = await Promise.all([
    supabase.from("personas").select("id, nombres, documento").order("nombres"),
    propietario
      ? supabase.from("unidades").select("codigo, edificios(nombre)").eq("propietario_id", propietario.id)
      : Promise.resolve({ data: [] as { codigo: string; edificios: unknown }[] }),
  ]);
  const nUnidades = otrasUnidades?.length ?? 0;
  const { data: invitacion } =
    propietario?.email && !propietario.usuario_id
      ? await supabase.from("invitaciones").select("id, rol").ilike("email", propietario.email.replace(/[%_\\]/g, "\\$&")).is("aceptada_en", null).maybeSingle()
      : { data: null };
  const { data: junta } = propietario
    ? await supabase.from("junta_directiva").select("cargo").eq("edificio_id", id).eq("persona_id", propietario.id).maybeSingle()
    : { data: null };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
       <div>
        <Link href={`/panel/edificios/${id}`} className="text-sm text-slate-500 hover:underline">
          ← {edificio.nombre}
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Unidad {unidad.codigo}</h1>
        <p className="text-sm text-slate-500">
          {propietario ? `Propietario: ${propietario.nombres}` : "Sin propietario asignado"}
        </p>
       </div>
        <Link
          href={`/panel/edificios/${id}`}
          className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Datos del propietario">
          {propietario ? (
            <>
              {nUnidades > 1 && (
                <p className="mb-4 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">
                  Esta persona tiene {nUnidades} unidades
                  ({otrasUnidades!.map((u) => u.codigo).join(", ")}). Los cambios se aplican en todas.
                </p>
              )}
              <FormAccion action={actualizarPropietario} boton="Guardar" limpiar={false} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="persona_id" value={propietario.id} />
                <input type="hidden" name="edificio_id" value={id} />
                <Campo name="nombres" label="Nombre completo" defaultValue={propietario.nombres} required className="sm:col-span-2" />
                <Campo name="documento" label="DNI / RUC" defaultValue={propietario.documento ?? ""} />
                <Campo name="telefono" label="Celular" defaultValue={propietario.telefono ?? ""} />
                <Campo name="email" label="Correo" type="email" defaultValue={propietario.email ?? ""} className="sm:col-span-2" />
                <div className="sm:col-span-2">
                  <Selector
                    name="cargo_junta"
                    label="Cargo en la junta directiva (opcional)"
                    opciones={OPCIONES_JUNTA}
                    defaultValue={junta?.cargo ?? ""}
                  />
                  <p className="mt-1 text-xs text-slate-500">Aplica solo a este edificio.</p>
                </div>
              </FormAccion>
            </>
          ) : (
            <p className="text-sm text-slate-500">Esta unidad no tiene propietario. Asígnale uno en “Cambiar propietario”.</p>
          )}
        </Tarjeta>

        <Tarjeta titulo="Datos de la unidad">
          <FormAccion action={actualizarUnidad} boton="Guardar" limpiar={false} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="unidad_id" value={unidad.id} />
            <input type="hidden" name="edificio_id" value={id} />
            <Campo name="codigo" label="Código" defaultValue={unidad.codigo} required />
            <Selector name="tipo" label="Tipo" opciones={TIPOS} defaultValue={unidad.tipo} />
            <Campo name="area_m2" label="Área m²" inputMode="decimal" defaultValue={unidad.area_m2 ?? ""} className="sm:col-span-2" />
          </FormAccion>
          <p className="mt-3 text-xs text-slate-500">
            Si cambias el área, afecta las cuotas que se generen desde ahora (cuando el reparto es por metraje).
          </p>
        </Tarjeta>
      </div>

      {propietario && (
        <Tarjeta titulo="Acceso al portal del propietario">
          {propietario.usuario_id ? (
            <p className="text-sm text-emerald-700">✓ {propietario.nombres} ya entra a la app y ve su cuota, sus pagos y sus recibos.</p>
          ) : invitacion && invitacion.rol !== "propietario" ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {propietario.email} tiene una invitación pendiente como <strong>{NOMBRE_ROL[invitacion.rol as keyof typeof NOMBRE_ROL] ?? invitacion.rol}</strong>.
              Para darle acceso como propietario, usa otro correo o elimina esa invitación en Usuarios.
            </p>
          ) : invitacion && propietario.email ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span>Invitación lista para <strong>{propietario.email}</strong>. Envíale este enlace por WhatsApp o correo:</span>
              <CopiarEnlace email={propietario.email} />
            </div>
          ) : !propietario.email ? (
            <p className="text-sm text-slate-600">Registra su correo en “Datos del propietario” para poder darle acceso a la app.</p>
          ) : esAdminEmpresa(perfil) ? (
            <FormAccion action={darAccesoPortal} boton="Dar acceso a la app" className="space-y-3">
              <input type="hidden" name="persona_id" value={propietario.id} />
              <p className="text-sm text-slate-600">
                Podrá ver su cuota, descargar recibos y reportar pagos con foto del voucher desde su celular. Entrará con {propietario.email}.
              </p>
            </FormAccion>
          ) : (
            <p className="text-sm text-slate-600">Pide a la administradora de la empresa que le dé acceso.</p>
          )}
        </Tarjeta>
      )}

      <Tarjeta titulo="Cambiar propietario">
        <p className="mb-4 text-sm text-slate-600">
          Úsalo cuando la unidad se vende o pasa a otra persona. Las cuotas y pagos anteriores quedan en el historial de la unidad.
        </p>
        <CambiarPropietario edificioId={id} unidadId={unidad.id} actualId={propietario?.id ?? null} personas={personas ?? []} />
      </Tarjeta>
    </div>
  );
}
