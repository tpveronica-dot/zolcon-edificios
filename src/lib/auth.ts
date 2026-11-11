import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Perfil = {
  id: string;
  email: string | null;
  nombre: string | null;
  rol: "superadmin" | "admin_empresa" | "administrador" | "junta" | "propietario";
  empresa_id: string | null;
  empresa_nombre: string | null;
};

// Capa de acceso: devuelve el perfil del usuario actual o redirige al login
export async function getPerfil(): Promise<Perfil> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("perfiles")
    .select("id, email, nombre, rol, empresa_id, empresas(nombre)")
    .eq("id", user.id)
    .single();

  if (!data) redirect("/login");
  const empresa = data.empresas as unknown as { nombre: string } | null;
  return { ...data, empresa_nombre: empresa?.nombre ?? null } as Perfil;
}

export function esStaff(p: Perfil) {
  return ["superadmin", "admin_empresa", "administrador"].includes(p.rol);
}
