"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esStaff } from "@/lib/auth";
import { parsearCsv, aNumero } from "@/lib/csv";

export type Estado = { error?: string; ok?: string };

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const TIPOS = ["departamento", "estacionamiento", "deposito", "local"] as const;

async function staff() {
  const perfil = await getPerfil();
  if (!esStaff(perfil) || !perfil.empresa_id) throw new Error("Sin permiso");
  return perfil;
}

// ---------- Empresa ----------
export async function crearEmpresa(_: Estado, fd: FormData): Promise<Estado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_empresa", {
    p_nombre: txt(fd, "nombre"),
    p_ruc: txt(fd, "ruc"),
  });
  if (error) return { error: error.message };
  redirect("/panel");
}

// ---------- Edificios ----------
export async function crearEdificio(_: Estado, fd: FormData): Promise<Estado> {
  const perfil = await staff();
  const nombre = txt(fd, "nombre");
  if (!nombre) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const { error } = await supabase.from("edificios").insert({
    empresa_id: perfil.empresa_id,
    nombre,
    direccion: txt(fd, "direccion") || null,
    distrito: txt(fd, "distrito") || null,
    dia_vencimiento: Number(txt(fd, "dia_vencimiento") || 10),
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: `Edificio "${nombre}" creado.` };
}

// ---------- Unidades ----------
export async function crearUnidad(_: Estado, fd: FormData): Promise<Estado> {
  const perfil = await staff();
  const supabase = await createClient();
  const edificio_id = txt(fd, "edificio_id");
  const codigo = txt(fd, "codigo");
  if (!codigo) return { error: "El código de la unidad es obligatorio." };

  let propietario_id: string | null = null;
  const nombres = txt(fd, "propietario");
  if (nombres) {
    const { data, error } = await supabase
      .from("personas")
      .insert({
        empresa_id: perfil.empresa_id,
        nombres,
        documento: txt(fd, "documento") || null,
        email: txt(fd, "email") || null,
        telefono: txt(fd, "telefono") || null,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    propietario_id = data.id;
  }

  const tipo = txt(fd, "tipo");
  const { error } = await supabase.from("unidades").insert({
    empresa_id: perfil.empresa_id,
    edificio_id,
    codigo,
    tipo: (TIPOS as readonly string[]).includes(tipo) ? tipo : "departamento",
    area_m2: aNumero(txt(fd, "area_m2")),
    porcentaje_participacion: aNumero(txt(fd, "porcentaje")) ?? 0,
    propietario_id,
  });
  if (error) {
    return { error: error.code === "23505" ? `Ya existe la unidad ${codigo}.` : error.message };
  }
  refresh();
  return { ok: `Unidad ${codigo} agregada.` };
}

export async function eliminarUnidad(fd: FormData) {
  await staff();
  const supabase = await createClient();
  await supabase.from("unidades").delete().eq("id", txt(fd, "id"));
  refresh();
}

// ---------- Importación masiva desde CSV (Excel → Guardar como CSV) ----------
export async function importarUnidades(_: Estado, fd: FormData): Promise<Estado> {
  const perfil = await staff();
  const edificio_id = txt(fd, "edificio_id");
  const archivo = fd.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Selecciona un archivo CSV." };

  const filas = parsearCsv(await archivo.text());
  if (filas.length === 0) return { error: "El archivo no tiene filas." };
  if (!("codigo" in filas[0])) {
    return { error: "No se encontró la columna 'codigo'. Usa la plantilla." };
  }

  const supabase = await createClient();

  // Personas existentes de la empresa, para no duplicar propietarios
  const { data: existentes } = await supabase
    .from("personas")
    .select("id, documento, email, nombres")
    .eq("empresa_id", perfil.empresa_id!);
  const porClave = new Map<string, string>();
  for (const p of existentes ?? []) {
    if (p.documento) porClave.set(`d:${p.documento}`, p.id);
    if (p.email) porClave.set(`e:${p.email.toLowerCase()}`, p.id);
  }

  const errores: string[] = [];
  let importadas = 0;

  for (const [i, f] of filas.entries()) {
    const n = i + 2; // fila en Excel (con cabecera)
    const codigo = f.codigo?.trim();
    if (!codigo) continue;

    let propietario_id: string | null = null;
    const nombres = f.propietario?.trim();
    if (nombres) {
      const documento = f.documento?.trim() || null;
      const email = f.email?.trim().toLowerCase() || null;
      propietario_id =
        (documento && porClave.get(`d:${documento}`)) || (email && porClave.get(`e:${email}`)) || null;
      if (!propietario_id) {
        const { data, error } = await supabase
          .from("personas")
          .insert({ empresa_id: perfil.empresa_id, nombres, documento, email, telefono: f.telefono?.trim() || null })
          .select("id")
          .single();
        if (error) {
          errores.push(`Fila ${n}: ${error.message}`);
          continue;
        }
        propietario_id = data.id;
        if (documento) porClave.set(`d:${documento}`, data.id);
        if (email) porClave.set(`e:${email}`, data.id);
      }
    }

    const tipo = (f.tipo ?? "").trim().toLowerCase().replace("ó", "o");
    const { error } = await supabase.from("unidades").upsert(
      {
        empresa_id: perfil.empresa_id,
        edificio_id,
        codigo,
        tipo: (TIPOS as readonly string[]).includes(tipo) ? tipo : "departamento",
        area_m2: aNumero(f.area_m2),
        porcentaje_participacion: aNumero(f.porcentaje) ?? 0,
        propietario_id,
      },
      { onConflict: "edificio_id,codigo" }
    );
    if (error) errores.push(`Fila ${n} (${codigo}): ${error.message}`);
    else importadas++;
  }

  refresh();
  if (errores.length) {
    return { error: `Se importaron ${importadas} unidades. Errores:\n${errores.slice(0, 10).join("\n")}` };
  }
  return { ok: `Se importaron ${importadas} unidades.` };
}
