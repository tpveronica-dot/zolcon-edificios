import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esAdminEmpresa, NOMBRE_ROL, type Perfil } from "@/lib/auth";
import { Tarjeta } from "@/components/form-accion";
import { cambiarEstadoUsuario, cancelarInvitacion } from "./actions";
import { CopiarEnlace } from "./copiar-enlace";

export default function UsuariosPage({ searchParams }: PageProps<"/panel/usuarios">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

const COLOR_ROL: Record<string, string> = {
  admin_empresa: "bg-petroleo-50 text-petroleo-700",
  administrador: "bg-sky-100 text-sky-800",
  junta: "bg-amber-100 text-amber-800",
  propietario: "bg-slate-100 text-slate-700",
  superadmin: "bg-slate-900 text-white",
};

function RolBadge({ rol }: { rol: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${COLOR_ROL[rol] ?? COLOR_ROL.propietario}`}>
      {NOMBRE_ROL[rol as Perfil["rol"]] ?? rol}
    </span>
  );
}

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const yo = await getPerfil();
  if (!esAdminEmpresa(yo)) redirect("/panel");
  const supabase = await createClient();

  const [{ data: usuarios }, { data: invitaciones }, { data: edificios }, { data: asignaciones }] = await Promise.all([
    supabase.from("perfiles").select("id, nombre, email, rol, activo").eq("empresa_id", yo.empresa_id!).order("nombre"),
    supabase.from("invitaciones").select("id, email, nombre, rol, edificios, creado_en").is("aceptada_en", null).order("creado_en", { ascending: false }),
    supabase.from("edificios").select("id, nombre"),
    supabase.from("edificio_usuarios").select("usuario_id, edificio_id"),
  ]);
  const nombreEdificio = new Map((edificios ?? []).map((e) => [e.id, e.nombre]));
  const edificiosDe = (ids: string[]) => ids.map((i) => nombreEdificio.get(i)).filter(Boolean).join(", ");
  const asignados = new Map<string, string[]>();
  for (const a of asignaciones ?? []) asignados.set(a.usuario_id, [...(asignados.get(a.usuario_id) ?? []), a.edificio_id]);

  const lista = usuarios ?? [];
  const activos = lista.filter((u) => u.activo).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Usuarios</h1>
          <p className="text-sm text-slate-500">
            {activos} activos · {lista.length - activos} desactivados · {invitaciones?.length ?? 0} invitaciones pendientes
          </p>
        </div>
        <Link
          href="/panel/usuarios/nuevo"
          className="inline-flex min-h-11 items-center rounded-xl bg-petroleo-700 px-5 text-sm font-semibold text-white hover:bg-petroleo-800"
        >
          + Nuevo usuario
        </Link>
      </div>

      {ok && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">✓ {ok}</p>}
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <Tarjeta titulo="Usuarios de la empresa">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">Usuario</th>
                <th className="py-2 pr-4">Rol</th>
                <th className="py-2 pr-4">Edificios</th>
                <th className="py-2 pr-4">Estado</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((u) => {
                const esYo = u.id === yo.id;
                const eds = asignados.get(u.id) ?? [];
                return (
                  <tr key={u.id} className={u.activo ? "" : "text-slate-400"}>
                    <td className="py-3 pr-4">
                      <span className={`font-semibold ${u.activo ? "text-slate-900" : ""}`}>{u.nombre || "—"}</span>
                      {esYo && <span className="ml-2 text-xs text-slate-500">(tú)</span>}
                      <span className="block text-xs text-slate-500">{u.email}</span>
                    </td>
                    <td className="py-3 pr-4"><RolBadge rol={u.rol} /></td>
                    <td className="py-3 pr-4 text-slate-600">
                      {u.rol === "admin_empresa" ? "Todos" : eds.length ? edificiosDe(eds) : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {u.activo ? (
                        <span className="text-xs font-semibold text-emerald-700">● Activo</span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-500">○ Desactivado</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-3 text-right">
                      <Link href={`/panel/usuarios/${u.id}`} className="mr-3 text-xs font-semibold text-petroleo-700 hover:underline">
                        Editar
                      </Link>
                      {!esYo && (
                        <form action={cambiarEstadoUsuario} className="inline">
                          <input type="hidden" name="usuario_id" value={u.id} />
                          <input type="hidden" name="activo" value={String(!u.activo)} />
                          <button className={`text-xs font-semibold ${u.activo ? "text-red-700 hover:underline" : "text-emerald-700 hover:underline"}`}>
                            {u.activo ? "Desactivar" : "Reactivar"}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      {(invitaciones?.length ?? 0) > 0 && (
        <Tarjeta titulo="Invitaciones pendientes">
          <p className="mb-4 text-sm text-slate-600">
            Copia el enlace y envíalo por WhatsApp o correo. La persona crea su contraseña con <strong>ese mismo correo</strong> y entra
            directo con su rol.
          </p>
          <ul className="divide-y divide-slate-100">
            {invitaciones!.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    {i.nombre || i.email} <RolBadge rol={i.rol} />
                  </p>
                  <p className="text-xs text-slate-500">
                    {i.email}
                    {i.edificios?.length ? ` · ${edificiosDe(i.edificios)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <CopiarEnlace email={i.email} />
                  <form action={cancelarInvitacion}>
                    <input type="hidden" name="id" value={i.id} />
                    <button className="text-xs text-slate-500 hover:text-red-700">Cancelar</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}
