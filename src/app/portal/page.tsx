import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPerfil, esStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cargarPortal } from "@/lib/portal";
import { cargarBalance } from "@/lib/balance";
import { hoyLima } from "@/lib/formato";
import { Unidad } from "./vista";

export default function PortalPage({ searchParams }: PageProps<"/portal">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}


async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const perfil = await getPerfil();
  if (esStaff(perfil)) redirect("/panel");
  const supabase = await createClient();
  const unidades = await cargarPortal(supabase, perfil.id);
  const mensaje = typeof sp.ok === "string" ? sp.ok : null;

  if (unidades.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-bold text-slate-900">Aún no vemos tu unidad</h1>
        <p className="mt-2 text-sm text-slate-600">
          Tu cuenta todavía no está vinculada a un departamento. Pide a tu administradora que registre tu correo{" "}
          <span className="font-semibold">{perfil.email}</span> en la ficha del propietario.
        </p>
      </section>
    );
  }

  // Cuota a destacar: la más antigua con saldo; si todo está pagado, la más reciente
  const detalles = await Promise.all(
    unidades.map(async (u) => {
      const actual = u.cuotas.filter((c) => c.saldo > 0).at(-1) ?? u.cuotas[0] ?? null;
      const balance = actual ? await cargarBalance(supabase, u.edificioId, actual.mes, actual.id) : null;
      return { u, actual, lineas: balance?.vecinos[0]?.lineas ?? [] };
    })
  );

  return (
    <div className="space-y-6">
      {mensaje && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">✓ {mensaje}</p>}
      {detalles.map(({ u, actual, lineas }) => (
        <Unidad key={u.id} u={u} actual={actual} lineas={lineas} hoy={hoyLima()} />
      ))}
    </div>
  );
}

