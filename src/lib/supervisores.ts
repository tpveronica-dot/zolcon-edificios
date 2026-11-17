import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Supervisor } from "@/components/campo-supervisor";

type Cliente = Awaited<ReturnType<typeof createClient>>;

// Personal activo con cargo Supervisor (la fuente de quién supervisa cada edificio)
export async function listarSupervisores(supabase: Cliente, empresaId: string): Promise<Supervisor[]> {
  const { data } = await supabase
    .from("personal")
    .select("id, nombre, email, usuario_id")
    .eq("empresa_id", empresaId)
    .eq("cargo", "supervisor")
    .eq("activo", true)
    .order("nombre");
  return (data ?? []).map((p) => ({ id: p.id, nombre: p.nombre, email: p.email, conUsuario: !!p.usuario_id }));
}

// Supervisor (del Personal) asignado a cada edificio: edificio_id → { id de personal, nombre }
export async function supervisoresPorEdificio(supabase: Cliente) {
  const { data } = await supabase
    .from("personal_edificios")
    .select("edificio_id, personal(id, nombre, cargo, activo)");
  const mapa = new Map<string, { id: string; nombre: string }>();
  for (const a of data ?? []) {
    const p = a.personal as unknown as { id: string; nombre: string; cargo: string; activo: boolean } | null;
    if (p?.cargo === "supervisor" && p.activo && !mapa.has(a.edificio_id)) {
      mapa.set(a.edificio_id, { id: p.id, nombre: p.nombre });
    }
  }
  return mapa;
}
