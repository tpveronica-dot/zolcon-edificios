import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esAdminEmpresa } from "@/lib/auth";
import { Tarjeta } from "@/components/form-accion";
import { crearUsuario } from "../actions";
import { FormularioUsuario } from "../formulario-usuario";

export default function NuevoUsuarioPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  const yo = await getPerfil();
  if (!esAdminEmpresa(yo)) redirect("/panel");
  const supabase = await createClient();
  const { data: edificios } = await supabase.from("edificios").select("id, nombre").order("nombre");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/panel/usuarios" className="text-sm text-slate-500 hover:underline">← Usuarios</Link>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Nuevo usuario</h1>
        <p className="text-sm text-slate-500">
          Al guardar se genera un enlace de acceso para enviarle. Si la persona ya tiene cuenta en Zolcon, obtiene acceso de inmediato.
        </p>
      </div>
      <Tarjeta>
        <FormularioUsuario action={crearUsuario} edificios={edificios ?? []} />
      </Tarjeta>
    </div>
  );
}
