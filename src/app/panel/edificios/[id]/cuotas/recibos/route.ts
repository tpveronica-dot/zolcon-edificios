import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { cargarBalance } from "@/lib/balance";
import { generarReciboPdf } from "@/lib/recibo-pdf";
import { hoyLima } from "@/lib/formato";

// PDF con el estado de cuota de todos los vecinos del mes (una página por vecino)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getPerfil();
  const mes = request.nextUrl.searchParams.get("mes") ?? hoyLima().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(mes)) return new NextResponse("Mes no válido", { status: 400 });

  const supabase = await createClient();
  const balance = await cargarBalance(supabase, id, mes);
  if (!balance) return new NextResponse("Edificio no encontrado", { status: 404 });

  const pdf = await generarReciboPdf(balance, hoyLima());
  const nombre = `cuotas-${mes}-${balance.edificio.nombre}.pdf`.replace(/[^\w.-]/g, "_");
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
