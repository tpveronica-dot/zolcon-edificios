import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esAdminEmpresa } from "@/lib/auth";
import { Tarjeta } from "@/components/form-accion";
import { actualizarUsuario, cambiarEstadoUsuario } from "../actions";
import { FormularioUsuario } from "../formulario-usuario";

export default function EditarUsuarioPage({ params }: PageProps<"/panel/usuarios/[usuarioId]">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ usuarioId: string }> }) {
  const { usuarioId } = await params;
  const yo = await getPerfil();
  if (!esAdminEmpresa(yo)) redirect("/panel");
  const supabase = await createClient();

  const [{ data: usuario }, { data: edificios }, { data: asignaciones }] = await Promise.all([
    supabase.from("perfiles").select("id, nombre, email, rol, activo").eq("id", usuarioId).eq("empresa_id", yo.empresa_id!).single(),
    supabase.from("edificios").select("id, nombre").order("nombre"),
    supabase.from("edificio_usuarios").select("edificio_id").eq("usuario_id", usuarioId),
  ]);
  if (!usuario) notFound();
  const esYo = usuario.id === yo.id;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/panel/usuarios" className="text-sm text-slate-500 hover:underline">← Usuarios</Link>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-900">{usuario.nombre || usuario.email}</h1>
        <p className="text-sm text-slate-500">{usuario.email}</p>
      </div>

      <Tarjeta titulo="Rol y acceso">
        <FormularioUsuario
          action={actualizarUsuario}
          edificios={edificios ?? []}
          usuario={{ id: usuario.id, rol: usuario.rol, edificios: (asignaciones ?? []).map((a) => a.edificio_id) }}
          esYo={esYo}
        />
      </Tarjeta>

      {!esYo && (
        <section
          className={`rounded-2xl border p-6 ${usuario.activo ? "border-red-200 bg-red-50/40" : "border-emerald-200 bg-emerald-50"}`}
        >
          <h2 className={`text-lg font-bold ${usuario.activo ? "text-red-800" : "text-emerald-800"}`}>
            {usuario.activo ? "Desactivar usuario" : "Reactivar usuario"}
          </h2>
          <p className={`mt-1 text-sm ${usuario.activo ? "text-red-700" : "text-emerald-800"}`}>
            {usuario.activo
              ? "La persona ya no podrá ingresar ni ver información. Sus registros (pagos, cambios) se conservan y puedes reactivarla cuando quieras."
              : "La persona vuelve a ingresar con su mismo correo y contraseña, con el rol de arriba."}
          </p>
          <form action={cambiarEstadoUsuario} className="mt-4">
            <input type="hidden" name="usuario_id" value={usuario.id} />
            <input type="hidden" name="activo" value={String(!usuario.activo)} />
            <button
              className={`inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold ${
                usuario.activo
                  ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
                  : "bg-emerald-700 text-white hover:bg-emerald-800"
              }`}
            >
              {usuario.activo ? "Desactivar" : "Reactivar"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
