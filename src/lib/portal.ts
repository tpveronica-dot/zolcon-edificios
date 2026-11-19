import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof createClient>>;

export type PagoPortal = { id: string; monto: number; fecha: string; medio: string; operacion: string | null; validado: boolean };
export type CuotaPortal = {
  id: string;
  mes: string; // "YYYY-MM"
  monto: number;
  vencimiento: string;
  estado: string;
  pagado: number;
  enRevision: number;
  saldo: number;
  pagos: PagoPortal[];
};
export type UnidadPortal = {
  id: string;
  codigo: string;
  tipo: string;
  edificioId: string;
  edificio: string;
  direccion: string;
  empresa: string | null;
  deuda: number;
  cuotas: CuotaPortal[]; // más reciente primero
};

// Unidades del propietario conectado, con sus últimas cuotas y pagos.
// Las reglas de la base garantizan que solo recibe lo suyo.
export async function cargarPortal(supabase: Cliente, usuarioId: string): Promise<UnidadPortal[]> {
  const { data: unidades } = await supabase
    .from("unidades")
    .select("id, codigo, tipo, edificio_id, edificios(nombre, direccion, distrito, empresas(nombre)), personas!inner(usuario_id)")
    .eq("personas.usuario_id", usuarioId)
    .order("codigo");
  if (!unidades?.length) return [];
  const ids = unidades.map((u) => u.id);

  const [{ data: cuotas }, { data: cuentas }] = await Promise.all([
    supabase
      .from("cuotas")
      .select("id, unidad_id, periodo, monto, vencimiento, estado, pagos(id, monto, fecha, medio, operacion, validado)")
      .in("unidad_id", ids)
      .neq("estado", "anulada")
      .order("periodo", { ascending: false })
      .limit(24 * ids.length),
    supabase.from("estado_cuenta").select("unidad_id, deuda").in("unidad_id", ids),
  ]);
  const deuda = new Map((cuentas ?? []).map((c) => [c.unidad_id, Number(c.deuda)]));

  return unidades.map((u) => {
    const e = u.edificios as unknown as { nombre: string; direccion: string | null; distrito: string | null; empresas: { nombre: string } | null };
    const propias = (cuotas ?? [])
      .filter((c) => c.unidad_id === u.id)
      .slice(0, 12)
      .map((c) => {
        const pagos = (c.pagos as PagoPortal[])
          .map((p) => ({ ...p, monto: Number(p.monto) }))
          .sort((a, b) => b.fecha.localeCompare(a.fecha));
        const pagado = pagos.filter((p) => p.validado).reduce((s, p) => s + p.monto, 0);
        const enRevision = pagos.filter((p) => !p.validado).reduce((s, p) => s + p.monto, 0);
        const monto = Number(c.monto);
        return {
          id: c.id,
          mes: String(c.periodo).slice(0, 7),
          monto,
          vencimiento: c.vencimiento,
          estado: c.estado,
          pagado,
          enRevision,
          saldo: Math.max(Math.round((monto - pagado) * 100) / 100, 0),
          pagos,
        };
      });
    return {
      id: u.id,
      codigo: u.codigo,
      tipo: u.tipo,
      edificioId: u.edificio_id,
      edificio: e?.nombre ?? "",
      direccion: [e?.direccion, e?.distrito].filter(Boolean).join(", "),
      empresa: e?.empresas?.nombre ?? null,
      deuda: deuda.get(u.id) ?? 0,
      cuotas: propias,
    };
  });
}

export const enlaceRecibo = (edificioId: string, cuota: { id: string; mes: string }) =>
  `/panel/edificios/${edificioId}/cuotas/recibo/${cuota.id}?mes=${cuota.mes}&ver=1`;
