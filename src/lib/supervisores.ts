import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Supervisor } from "@/components/campo-supervisor";

type Cliente = Awaited<ReturnType<typeof createClient>>;

export async function listarSupervisores(supabase: Cliente, empresaId: string): Promise<Supervisor[]> {
  const { data } = await supabase
    .from("perfiles")
    .select("id, nombre, email")
    .eq("empresa_id", empresaId)
    .eq("rol", "administrador")
    .eq("activo", true)
    .order("nombre");
  return data ?? [];
}

// Supervisor asignado a cada edificio (edificio_id → nombre / id)
export async function supervisoresPorEdificio(supabase: Cliente) {
  const { data } = await supabase.from("edificio_usuarios").select("edificio_id, usuario_id, perfiles(nombre, email, rol, activo)");
  const mapa = new Map<string, { id: string; nombre: string }>();
  for (const a of data ?? []) {
    const p = a.perfiles as unknown as { nombre: string | null; email: string | null; rol: string; activo: boolean } | null;
    if (p?.rol === "administrador" && p.activo && !mapa.has(a.edificio_id)) {
      mapa.set(a.edificio_id, { id: a.usuario_id, nombre: p.nombre || p.email || "—" });
    }
  }
  return mapa;
}
