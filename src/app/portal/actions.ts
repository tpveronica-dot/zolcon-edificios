"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";

export type Estado = { error?: string };
const MEDIOS = ["transferencia", "yape", "plin", "deposito", "efectivo", "otro"];
const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// El propietario reporta un pago; queda "en revisión" hasta que la administración lo valide
export async function reportarPago(_: Estado, fd: FormData): Promise<Estado> {
  await getPerfil();
  const monto = Number(txt(fd, "monto").replace(",", "."));
  if (!Number.isFinite(monto) || monto <= 0) return { error: "Ingresa un monto válido." };
  const medio = txt(fd, "medio");
  const fecha = txt(fd, "fecha");

  const supabase = await createClient();
  const { error } = await supabase.rpc("reportar_pago", {
    p_cuota: txt(fd, "cuota_id"),
    p_monto: monto,
    p_fecha: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
    p_medio: MEDIOS.includes(medio) ? medio : "transferencia",
    p_operacion: txt(fd, "operacion") || null,
    p_voucher: txt(fd, "voucher") || null,
  });
  if (error) return { error: error.message };
  redirect(`/portal?ok=${encodeURIComponent("Pago reportado. La administración lo revisará y te aparecerá como pagado.")}`);
}
