"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { reportarPago, type Estado } from "../../actions";

const MEDIOS: [string, string][] = [
  ["yape", "Yape"],
  ["plin", "Plin"],
  ["transferencia", "Transferencia"],
  ["deposito", "Depósito"],
  ["efectivo", "Efectivo"],
  ["otro", "Otro"],
];
const MAX = 5 * 1024 * 1024;

// Reduce la foto del celular (suele pesar 3–6 MB) a un JPEG liviano
async function comprimir(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith("image/")) return archivo;
  try {
    const img = await createImageBitmap(archivo);
    const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(img.width * escala);
    lienzo.height = Math.round(img.height * escala);
    lienzo.getContext("2d")!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.82));
    return blob ?? archivo;
  } catch {
    return archivo;
  }
}

export function FormularioPago({ cuotaId, empresaId, saldo, hoy }: { cuotaId: string; empresaId: string; saldo: number; hoy: string }) {
  const [vista, setVista] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  const [estado, accion, enviando] = useActionState(async (prev: Estado, fd: FormData): Promise<Estado> => {
    const archivo = fd.get("archivo");
    fd.delete("archivo");
    if (archivo instanceof File && archivo.size > 0) {
      const blob = await comprimir(archivo);
      if (blob.size > MAX) return { error: "El archivo pesa más de 5 MB. Toma una captura de pantalla del voucher." };
      const ext = blob.type === "application/pdf" ? "pdf" : blob.type === "image/png" ? "png" : "jpg";
      const ruta = `${empresaId}/${cuotaId}/${Date.now()}.${ext}`;
      const { error } = await createClient()
        .storage.from("vouchers")
        .upload(ruta, blob, { contentType: blob.type || "image/jpeg", upsert: false });
      if (error) return { error: `No se pudo subir el voucher: ${error.message}` };
      fd.set("voucher", ruta);
    }
    return reportarPago(prev, fd);
  }, {});

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="cuota_id" value={cuotaId} />
      <label className="block">
        <span className="text-xs font-semibold text-slate-600">Monto pagado (S/)</span>
        <input
          name="monto"
          required
          inputMode="decimal"
          defaultValue={saldo > 0 ? saldo.toFixed(2) : ""}
          className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-lg font-semibold outline-none focus:border-petroleo-700 focus:ring-1 focus:ring-petroleo-700"
        />
      </label>
      <fieldset>
        <legend className="text-xs font-semibold text-slate-600">¿Cómo pagaste?</legend>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {MEDIOS.map(([v, t], i) => (
            <label key={v} className="cursor-pointer">
              <input type="radio" name="medio" value={v} defaultChecked={i === 0} className="peer sr-only" />
              <span className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm peer-checked:border-petroleo-700 peer-checked:bg-petroleo-50 peer-checked:font-semibold peer-checked:text-petroleo-700 peer-focus-visible:ring-2 peer-focus-visible:ring-petroleo-700">
                {t}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Fecha del pago</span>
          <input name="fecha" type="date" defaultValue={hoy} max={hoy} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Nº de operación</span>
          <input name="operacion" placeholder="Opcional" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm" />
        </label>
      </div>

      <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-white p-4 text-center hover:border-petroleo-700">
        <input
          name="archivo"
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setNombreArchivo(f?.name ?? null);
            setVista(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
          }}
        />
        {vista ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vista} alt="Vista previa del voucher" className="mx-auto max-h-56 rounded-lg" />
        ) : (
          <span className="block py-4 text-3xl" aria-hidden>📷</span>
        )}
        <span className="mt-2 block text-sm font-semibold text-petroleo-700">
          {nombreArchivo ? "Cambiar foto" : "Tomar foto o subir voucher"}
        </span>
        {nombreArchivo && !vista && <span className="block text-xs text-slate-500">{nombreArchivo}</span>}
      </label>

      {estado.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{estado.error}</p>}
      <button
        disabled={enviando}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-petroleo-700 text-base font-bold text-white hover:bg-petroleo-800 disabled:opacity-50"
      >
        {enviando ? "Enviando…" : "Enviar pago"}
      </button>
    </form>
  );
}
