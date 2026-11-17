import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esAdminEmpresa } from "@/lib/auth";
import { Tarjeta } from "@/components/form-accion";
import { eliminarPersonal } from "./actions";
import { CARGOS } from "./formulario-personal";

export default function PersonalPage({ searchParams }: PageProps<"/panel/personal">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

const NOMBRE_CARGO = Object.fromEntries(CARGOS);
const COLOR_CARGO: Record<string, string> = {
  supervisor: "bg-petroleo-50 text-petroleo-700",
  conserje: "bg-amber-100 text-amber-800",
  limpieza: "bg-sky-100 text-sky-800",
};

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const filtro = typeof sp.cargo === "string" ? sp.cargo : "";
  const yo = await getPerfil();
  if (!esAdminEmpresa(yo)) redirect("/panel");
  const supabase = await createClient();

  const [{ data: personal }, { data: edificios }] = await Promise.all([
    supabase
      .from("personal")
      .select("id, nombre, telefono, email, cargo, usuario_id, perfiles(nombre, email), personal_edificios(edificio_id)")
      .eq("empresa_id", yo.empresa_id!)
      .order("nombre"),
    supabase.from("edificios").select("id, nombre"),
  ]);
  const nombreEdificio = new Map((edificios ?? []).map((e) => [e.id, e.nombre]));
  const todos = personal ?? [];
  const lista = filtro ? todos.filter((p) => p.cargo === filtro) : todos;
  const cuenta = (c: string) => todos.filter((p) => p.cargo === c).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Personal</h1>
          <p className="text-sm text-slate-500">
            {todos.length} personas · {cuenta("supervisor")} supervisores · {cuenta("conserje")} conserjes · {cuenta("limpieza")} de limpieza
          </p>
        </div>
        <Link
          href="/panel/personal/nuevo"
          className="inline-flex min-h-11 items-center rounded-xl bg-petroleo-700 px-5 text-sm font-semibold text-white hover:bg-petroleo-800"
        >
          + Agregar personal
        </Link>
      </div>

      {ok && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">✓ {ok}</p>}
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <nav aria-label="Filtrar por cargo" className="flex flex-wrap gap-2">
        {[["", "Todos"], ...CARGOS].map(([valor, texto]) => (
          <Link
            key={valor}
            href={valor ? `?cargo=${valor}` : "?"}
            aria-current={filtro === valor ? "page" : undefined}
            className={`inline-flex min-h-9 items-center rounded-full border px-4 text-sm font-medium ${
              filtro === valor
                ? "border-petroleo-700 bg-petroleo-700 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {texto}
          </Link>
        ))}
      </nav>

      <Tarjeta>
        {lista.length === 0 ? (
          <p className="text-sm text-slate-500">
            {todos.length === 0 ? "Aún no registras personal. Usa “+ Agregar personal”." : "No hay personal con ese cargo."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Nombre</th>
                  <th className="py-2 pr-4">Cargo</th>
                  <th className="py-2 pr-4">Contacto</th>
                  <th className="py-2 pr-4">Usuario</th>
                  <th className="py-2 pr-4">Edificios</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((p) => {
                  const u = p.perfiles as unknown as { nombre: string | null; email: string | null } | null;
                  const eds = (p.personal_edificios as { edificio_id: string }[])
                    .map((x) => nombreEdificio.get(x.edificio_id))
                    .filter(Boolean);
                  return (
                    <tr key={p.id}>
                      <td className="py-3 pr-4 font-semibold text-slate-900">{p.nombre}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${COLOR_CARGO[p.cargo] ?? ""}`}>
                          {NOMBRE_CARGO[p.cargo] ?? p.cargo}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {p.telefono ?? "—"}
                        {p.email && <span className="block text-xs">{p.email}</span>}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {u ? (u.nombre || u.email) : <span className="text-slate-400">Sin usuario</span>}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{eds.length ? eds.join(", ") : <span className="text-slate-400">Sin asignar</span>}</td>
                      <td className="whitespace-nowrap py-3 text-right">
                        <Link href={`/panel/personal/${p.id}`} className="mr-3 text-xs font-semibold text-petroleo-700 hover:underline">
                          Editar
                        </Link>
                        <form action={eliminarPersonal} className="inline">
                          <input type="hidden" name="personal_id" value={p.id} />
                          <button className="text-xs text-slate-400 hover:text-red-700">Eliminar</button>
                        </form>
                      </td>
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
