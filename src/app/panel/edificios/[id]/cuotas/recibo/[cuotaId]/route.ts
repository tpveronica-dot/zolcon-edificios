import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { cargarBalance } from "@/lib/balance";
import { generarReciboPdf } from "@/lib/recibo-pdf";
import { hoyLima } from "@/lib/formato";

// PDF del estado de cuota de un vecino (una cuota)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; cuotaId: string }> }) {
  const { id, cuotaId } = await params;
  await getPerfil();
  const mes = request.nextUrl.searchParams.get("mes") ?? hoyLima().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(mes)) return new NextResponse("Mes no válido", { status: 400 });

  const supabase = await createClient();
  const balance = await cargarBalance(supabase, id, mes, cuotaId);
  if (!balance || balance.vecinos.length === 0) return new NextResponse("Cuota no encontrada", { status: 404 });

  const pdf = await generarReciboPdf(balance, hoyLima());
  const nombre = `cuota-${mes}-${balance.vecinos[0].codigo}.pdf`.replace(/[^\w.-]/g, "_");
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
