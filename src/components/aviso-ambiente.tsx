// Franja visible cuando la app NO es producción (rama develop / previews de Vercel)
export function AvisoAmbiente() {
  const ambiente = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (ambiente === "production") return null;
  return (
    <div className="bg-amber-400 px-4 py-1 text-center text-xs font-semibold uppercase tracking-wide text-amber-950">
      Ambiente de desarrollo · datos de prueba
    </div>
  );
}
