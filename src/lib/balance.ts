import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { repartirEnPartidas, type LineaPartida } from "@/lib/repartir";

type Cliente = Awaited<ReturnType<typeof createClient>>;

export type BalanceVecino = {
  cuotaId: string;
  codigo: string;
  tipo: string;
  area: number | null;
  propietario: string | null;
  documento: string | null;
  monto: number;
  vencimiento: string;
  estado: string;
  participacion: number;
  pagado: number;
  saldo: number;
  deudaTotal: number;
  pagos: { fecha: string; medio: string; monto: number; operacion: string | null }[];
  lineas: LineaPartida[];
};

export type BalanceMes = {
  empresa: string | null;
  edificio: { nombre: string; direccion: string | null; distrito: string | null };
  mes: string;
  totalMensual: number;
  vecinos: BalanceVecino[];
};

// Datos del balance de un mes (opcionalmente de una sola cuota). Respeta los permisos
// de la base: cada usuario solo recibe lo que puede ver.
export async function cargarBalance(supabase: Cliente, edificioId: string, mes: string, cuotaId?: string): Promise<BalanceMes | null> {
  const anio = Number(mes.slice(0, 4));
  let consulta = supabase
    .from("cuotas")
    .select("id, unidad_id, monto, vencimiento, estado, unidades(codigo, tipo, area_m2, personas(nombres, documento)), pagos(monto, fecha, medio, operacion, validado)")
    .eq("edificio_id", edificioId)
    .neq("estado", "anulada");
  consulta = cuotaId ? consulta.eq("id", cuotaId) : consulta.eq("periodo", `${mes}-01`);

  const [{ data: edificio }, { data: cuotas }, { data: presupuesto }, { data: cuentas }] = await Promise.all([
    supabase.from("edificios").select("nombre, direccion, distrito, empresas(nombre)").eq("id", edificioId).single(),
    consulta,
    supabase.from("presupuestos").select("partidas(id, nombre, monto_mensual)").eq("edificio_id", edificioId).eq("anio", anio).maybeSingle(),
    supabase.from("estado_cuenta").select("unidad_id, deuda").eq("edificio_id", edificioId),
  ]);
  if (!edificio) return null;

  const partidas = [...(presupuesto?.partidas ?? [])]
    .map((p) => ({ id: p.id, nombre: p.nombre, monto: Number(p.monto_mensual) }))
    .sort((a, b) => b.monto - a.monto);
  const totalMensual = partidas.reduce((s, p) => s + p.monto, 0);
  const deuda = new Map((cuentas ?? []).map((c) => [c.unidad_id, Number(c.deuda)]));

  const vecinos = (cuotas ?? [])
    .map((c) => {
      const u = c.unidades as unknown as {
        codigo: string;
        tipo: string;
        area_m2: number | null;
        personas: { nombres: string; documento: string | null } | null;
      };
      const pagos = (c.pagos as { monto: number; fecha: string; medio: string; operacion: string | null; validado: boolean }[])
        .filter((p) => p.validado)
        .map((p) => ({ fecha: p.fecha, medio: p.medio, monto: Number(p.monto), operacion: p.operacion }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
      const monto = Number(c.monto);
      const pagado = pagos.reduce((s, p) => s + p.monto, 0);
      return {
        cuotaId: c.id,
        codigo: u.codigo,
        tipo: u.tipo,
        area: u.area_m2 == null ? null : Number(u.area_m2),
        propietario: u.personas?.nombres ?? null,
        documento: u.personas?.documento ?? null,
        monto,
        vencimiento: c.vencimiento,
        estado: c.estado,
        participacion: totalMensual ? (monto / totalMensual) * 100 : 0,
        pagado,
        saldo: Math.max(monto - pagado, 0),
        deudaTotal: deuda.get(c.unidad_id) ?? 0,
        pagos,
        lineas: repartirEnPartidas(monto, partidas, totalMensual),
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));

  const empresa = (edificio.empresas as unknown as { nombre: string } | null)?.nombre ?? null;
  return {
    empresa,
    edificio: { nombre: edificio.nombre, direccion: edificio.direccion, distrito: edificio.distrito },
    mes,
    totalMensual,
    vecinos,
  };
}
