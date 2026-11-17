import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esStaff, esAdminEmpresa } from "@/lib/auth";
import { Tarjeta } from "@/components/form-accion";
import { nombreMes, hoyLima } from "@/lib/formato";
import { Encabezado } from "../encabezado";
import { cambiarEstadoInforme } from "../../../actions";
import { FormularioInforme, type Linea } from "./formulario-informe";

export default function EjecucionPage({ params, searchParams }: PageProps<"/panel/edificios/[id]/ejecucion">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function mover(ym: string, delta: number) {
  const [a, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function Contenido({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const perfil = await getPerfil();
  const hoy = hoyLima();
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : hoy.slice(0, 7);
  const mensaje = typeof sp.ok === "string" ? sp.ok : null;
  const anio = Number(mes.slice(0, 4));
  const supabase = await createClient();

  const [{ data: edificio }, { data: presupuesto }, { data: informe }] = await Promise.all([
    supabase.from("edificios").select("nombre, direccion, distrito, dia_vencimiento").eq("id", id).single(),
    supabase
      .from("presupuestos")
      .select("id, aprobado, partidas(id, nombre, monto_mensual)")
      .eq("edificio_id", id)
      .eq("anio", anio)
      .maybeSingle(),
    supabase
      .from("informes_mensuales")
      .select("id, estado, notas, actualizado_en, perfiles(nombre, email), informe_lineas(partida_id, concepto, presupuestado, real, nota)")
      .eq("edificio_id", id)
      .eq("periodo", `${mes}-01`)
      .maybeSingle(),
  ]);
  if (!edificio) notFound();

  const staff = esStaff(perfil);
  const cerrado = informe?.estado === "cerrado";
  const editable = staff && !cerrado;
  const guardadas = (informe?.informe_lineas ?? []) as { partida_id: string | null; concepto: string; presupuestado: number; real: number; nota: string | null }[];

  const partidas: Linea[] = [...(presupuesto?.partidas ?? [])]
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((p) => {
      const g = guardadas.find((l) => l.partida_id === p.id);
      return {
        partida_id: p.id,
        concepto: p.nombre,
        presupuestado: g ? Number(g.presupuestado) : Number(p.monto_mensual),
        real: g ? String(Number(g.real)) : "",
        nota: g?.nota ?? "",
      };
    });
  const extras: Linea[] = guardadas
    .filter((l) => !l.partida_id)
    .map((l) => ({ partida_id: null, concepto: l.concepto, presupuestado: 0, real: String(Number(l.real)), nota: l.nota ?? "" }));
  const autor = informe?.perfiles as unknown as { nombre: string | null; email: string | null } | null;

  return (
    <div className="space-y-6">
      <Encabezado id={id} edificio={edificio} activa="ejecucion" gestionar={esAdminEmpresa(perfil)} />

      {mensaje && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">✓ {mensaje}</p>}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`?mes=${mover(mes, -1)}`} aria-label="Mes anterior" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 hover:bg-slate-100">←</Link>
        <span className="font-display text-xl font-bold capitalize text-slate-900">Ejecución de {nombreMes(mes)}</span>
        <Link href={`?mes=${mover(mes, 1)}`} aria-label="Mes siguiente" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 hover:bg-slate-100">→</Link>
        {informe ? (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cerrado ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
            {cerrado ? "Cerrado" : "Borrador"}
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Sin registrar</span>
        )}
        {informe && (
          <span className="text-xs text-slate-500">
            Última actualización: {new Date(informe.actualizado_en).toLocaleDateString("es-PE", { timeZone: "America/Lima" })}
            {autor ? ` · ${autor.nombre || autor.email}` : ""}
          </span>
        )}
      </div>

      {!presupuesto ? (
        <Tarjeta>
          <p className="text-sm text-slate-600">
            No hay presupuesto {anio} para este edificio.{" "}
            <Link href={`/panel/edificios/${id}/presupuesto?anio=${anio}`} className="font-semibold text-petroleo-700 hover:underline">
              Crear presupuesto {anio}
            </Link>
          </p>
        </Tarjeta>
      ) : (
        <>
          {!presupuesto.aprobado && (
            <p className="rounded-xl border border-amber-200 bg-amber-100/60 p-3 text-sm text-amber-800">
              El presupuesto {anio} aún está en borrador (no aprobado por la junta).
            </p>
          )}
          {!staff && !informe ? (
            <Tarjeta><p className="text-sm text-slate-500">Aún no se registra la ejecución de este mes.</p></Tarjeta>
          ) : (
            <Tarjeta>
              <FormularioInforme
                key={`${mes}-${informe?.id ?? "nuevo"}-${informe?.actualizado_en ?? ""}-${informe?.estado ?? ""}`}
                edificioId={id}
                mes={mes}
                partidas={partidas}
                extras={extras}
                notas={informe?.notas ?? ""}
                editable={editable}
              />
            </Tarjeta>
          )}

          {staff && informe && (
            <form action={cambiarEstadoInforme} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="informe_id" value={informe.id} />
              <input type="hidden" name="edificio_id" value={id} />
              <input type="hidden" name="mes" value={mes} />
              <input type="hidden" name="estado" value={cerrado ? "borrador" : "cerrado"} />
              <button
                className={`inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold ${
                  cerrado ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100" : "bg-emerald-700 text-white hover:bg-emerald-800"
                }`}
              >
                {cerrado ? "Reabrir para editar" : "Cerrar informe del mes"}
              </button>
              <span className="text-xs text-slate-500">
                {cerrado
                  ? "Un informe cerrado no se puede modificar."
                  : "Guarda primero los cambios. Al cerrarlo queda fijo como el informe oficial del mes."}
              </span>
            </form>
          )}
        </>
      )}
    </div>
  );
}
