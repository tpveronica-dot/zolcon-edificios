import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof createClient>>;

// Usuarios activos de la empresa que se pueden vincular (no vinculados a otra persona)
export async function usuariosVinculables(supabase: Cliente, empresaId: string, personalId?: string) {
  const [{ data: usuarios }, { data: vinculados }] = await Promise.all([
    supabase.from("perfiles").select("id, nombre, email").eq("empresa_id", empresaId).eq("activo", true).order("nombre"),
    supabase.from("personal").select("id, usuario_id").not("usuario_id", "is", null),
  ]);
  const ocupados = new Set((vinculados ?? []).filter((v) => v.id !== personalId).map((v) => v.usuario_id));
  return (usuarios ?? []).filter((u) => !ocupados.has(u.id));
}
