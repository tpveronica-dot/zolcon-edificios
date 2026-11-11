import { Suspense } from "react";
import Link from "next/link";
import { getPerfil, esStaff, esAdminEmpresa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FormAccion, Campo, Tarjeta } from "@/components/form-accion";
import { crearEmpresa } from "./actions";
import { IconoEdificio } from "@/components/iconos";
import { supervisoresPorEdificio } from "@/lib/supervisores";

export default function PanelPage({ searchParams }: PageProps<"/panel">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

const soles = (n: number) => `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const mensaje = typeof sp.ok === "string" ? sp.ok : null;
  const perfil = await getPerfil();

  // Usuario recién registrado sin empresa → alta de su administradora
  if (!perfil.empresa_id) {
    return (
      <div className="mx-auto max-w-lg">
        <Tarjeta titulo="Registra tu empresa administradora">
          <p className="mb-4 text-sm text-slate-600">
            Es el primer paso. Luego podrás crear tus edificios y cargar sus unidades.
          </p>
          <FormAccion action={crearEmpresa} boton="Crear empresa" className="space-y-4">
            <Campo name="nombre" label="Nombre de la empresa" required />
            <Campo name="ruc" label="RUC (opcional)" inputMode="numeric" maxLength={11} />
          </FormAccion>
        </Tarjeta>
      </div>
    );
  }

  if (!esStaff(perfil)) {
    return (
      <Tarjeta titulo={perfil.rol === "junta" ? "Vista de la junta directiva" : "Portal del propietario"}>
        <p className="text-sm text-slate-600">Muy pronto podrás ver aquí la información de tu edificio.</p>
      </Tarjeta>
    );
  }

  const supabase = await createClient();
  const [{ data: edificios }, { data: cuentas }] = await Promise.all([
    supabase.from("edificios").select("id, nombre, direccion, distrito, unidades(count)").order("nombre"),
    supabase.from("estado_cuenta").select("edificio_id, deuda"),
  ]);
  const supervisorDe = await supervisoresPorEdificio(supabase);
  const deuda = new Map<string, number>();
  for (const c of cuentas ?? []) deuda.set(c.edificio_id, (deuda.get(c.edificio_id) ?? 0) + Number(c.deuda));

  return (
    <div className="space-y-8">
      {mensaje && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">✓ {mensaje}</p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Edificios</h1>
          <p className="text-sm text-slate-500">{edificios?.length ?? 0} edificios administrados</p>
        </div>
        {esAdminEmpresa(perfil) && (
          <Link
            href="/panel/edificios/nuevo"
            className="inline-flex min-h-11 items-center rounded-xl bg-petroleo-700 px-5 text-sm font-semibold text-white hover:bg-petroleo-800"
          >
            + Crear edificio
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(edificios ?? []).map((e) => {
          const nUnidades = (e.unidades as unknown as { count: number }[])[0]?.count ?? 0;
          const d = deuda.get(e.id) ?? 0;
          return (
            <Link
              key={e.id}
              href={`/panel/edificios/${e.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-petroleo-700"
            >
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-petroleo-50 text-petroleo-700"><IconoEdificio className="h-4 w-4" /></span>{e.nombre}</h3>
              <p className="text-sm text-slate-500">{[e.direccion, e.distrito].filter(Boolean).join(", ") || "—"}</p>
              <p className="mt-2 text-xs text-slate-500">
                Supervisor:{" "}
                <span className="font-semibold text-slate-700">{supervisorDe.get(e.id)?.nombre ?? "Sin asignar"}</span>
              </p>
              <div className="mt-4 flex justify-between text-sm">
                <span className="text-slate-600">{nUnidades} unidades</span>
                <span className={d > 0 ? "font-semibold text-red-700" : "font-semibold text-emerald-700"}>
                  {d > 0 ? `Deuda ${soles(d)}` : "Al día"}
                </span>
              </div>
            </Link>
          );
        })}
        {edificios?.length === 0 && (
          <p className="text-sm text-slate-500">Aún no tienes edificios. Usa “+ Crear edificio”.</p>
        )}
      </div>
    </div>
  );
}
