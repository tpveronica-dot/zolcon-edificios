import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { soles, nombreMes, hoyLima, fechaCorta } from "@/lib/formato";
import { FormularioPago } from "./formulario-pago";

export default function PagarPage({ params }: PageProps<"/portal/pagar/[cuotaId]">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ cuotaId: string }> }) {
  const { cuotaId } = await params;
  await getPerfil();
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("cuotas")
    .select("id, empresa_id, periodo, monto, vencimiento, estado, unidades(codigo), pagos(monto, validado)")
    .eq("id", cuotaId)
    .maybeSingle();
  if (!c || c.estado === "anulada") notFound();

  const pagado = (c.pagos as { monto: number; validado: boolean }[])
    .filter((p) => p.validado)
    .reduce((s, p) => s + Number(p.monto), 0);
  const saldo = Math.max(Math.round((Number(c.monto) - pagado) * 100) / 100, 0);
  const mes = String(c.periodo).slice(0, 7);
  const codigo = (c.unidades as unknown as { codigo: string }).codigo;

  return (
    <div className="space-y-5">
      <Link href="/portal" className="inline-flex min-h-11 items-center text-sm font-semibold text-petroleo-700">← Volver</Link>
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-900">Reportar pago</h1>
        <p className="text-sm text-slate-500">
          Dpto. {codigo} · cuota de {nombreMes(mes)}
        </p>
      </div>
      <div className="flex justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm">
        <span className="text-slate-600">Saldo por pagar</span>
        <span className="font-bold tabular-nums text-slate-900">{soles(saldo)}</span>
      </div>
      <p className="text-xs text-slate-500">Vence el {fechaCorta(c.vencimiento)}. Adjunta la foto o captura de tu voucher para que la administración lo valide rápido.</p>
      <FormularioPago cuotaId={c.id} empresaId={c.empresa_id} saldo={saldo} hoy={hoyLima()} />
    </div>
  );
}
