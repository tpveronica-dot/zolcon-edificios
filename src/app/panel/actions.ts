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

// ---------- Presupuesto ----------
export async function crearPresupuesto(fd: FormData) {
  const perfil = await staff();
  const supabase = await createClient();
  await supabase.from("presupuestos").insert({
    empresa_id: perfil.empresa_id,
    edificio_id: txt(fd, "edificio_id"),
    anio: Number(txt(fd, "anio")),
  });
  refresh();
}

export async function agregarPartida(_: Estado, fd: FormData): Promise<Estado> {
  const perfil = await staff();
  const nombre = txt(fd, "nombre");
  const monto = aNumero(txt(fd, "monto_mensual"));
  if (!nombre) return { error: "Escribe el nombre de la partida." };
  if (monto == null || monto < 0) return { error: "Escribe un monto mensual válido." };

  const supabase = await createClient();
  const { error } = await supabase.from("partidas").insert({
    empresa_id: perfil.empresa_id,
    presupuesto_id: txt(fd, "presupuesto_id"),
    nombre,
    monto_mensual: monto,
    es_fondo_reserva: fd.get("es_fondo_reserva") === "on",
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: `Partida "${nombre}" agregada.` };
}

export async function eliminarPartida(fd: FormData) {
  await staff();
  const supabase = await createClient();
  await supabase.from("partidas").delete().eq("id", txt(fd, "id"));
  refresh();
}

export async function aprobarPresupuesto(fd: FormData) {
  await staff();
  const supabase = await createClient();
  await supabase
    .from("presupuestos")
    .update({ aprobado: fd.get("aprobado") === "true" })
    .eq("id", txt(fd, "id"));
  refresh();
}

// ---------- Cuotas ----------
export async function generarCuotas(_: Estado, fd: FormData): Promise<Estado> {
  await staff();
  const supabase = await createClient();
  const periodo = `${txt(fd, "mes")}-01`;
  const { data, error } = await supabase.rpc("generar_cuotas", {
    p_edificio: txt(fd, "edificio_id"),
    p_periodo: periodo,
  });
  if (error) return { error: error.message };
  refresh();
  return data === 0
    ? { ok: "Las cuotas de este mes ya estaban generadas." }
    : { ok: `Se generaron ${data} cuotas.` };
}

export async function anularCuota(fd: FormData) {
  await staff();
  const supabase = await createClient();
  await supabase.from("cuotas").update({ estado: "anulada" }).eq("id", txt(fd, "id"));
  refresh();
}

// ---------- Pagos ----------
const MEDIOS = ["transferencia", "yape", "plin", "efectivo", "deposito", "otro"];

export async function registrarPago(_: Estado, fd: FormData): Promise<Estado> {
  const perfil = await staff();
  const monto = aNumero(txt(fd, "monto"));
  if (monto == null || monto <= 0) return { error: "Monto inválido." };
  const medio = txt(fd, "medio");

  const supabase = await createClient();
  const { error } = await supabase.from("pagos").insert({
    empresa_id: perfil.empresa_id,
    cuota_id: txt(fd, "cuota_id"),
    monto,
    fecha: txt(fd, "fecha") || undefined,
    medio: MEDIOS.includes(medio) ? medio : "transferencia",
    operacion: txt(fd, "operacion") || null,
    validado: true,
    registrado_por: perfil.id,
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: "Pago registrado." };
}

export async function eliminarPago(fd: FormData) {
  await staff();
  const supabase = await createClient();
  await supabase.from("pagos").delete().eq("id", txt(fd, "id"));
  refresh();
}

// ---------- Edición de unidades y propietarios ----------
export async function actualizarUnidad(_: Estado, fd: FormData): Promise<Estado> {
  await staff();
  const codigo = txt(fd, "codigo");
  if (!codigo) return { error: "El código es obligatorio." };
  const tipo = txt(fd, "tipo");
  const supabase = await createClient();
  const { error } = await supabase
    .from("unidades")
    .update({
      codigo,
      tipo: (TIPOS as readonly string[]).includes(tipo) ? tipo : "departamento",
      area_m2: aNumero(txt(fd, "area_m2")),
      porcentaje_participacion: aNumero(txt(fd, "porcentaje")) ?? 0,
    })
    .eq("id", txt(fd, "unidad_id"));
  if (error) return { error: error.code === "23505" ? `Ya existe otra unidad con el código ${codigo}.` : error.message };
  refresh();
  return { ok: "Datos de la unidad actualizados." };
}

export async function actualizarPropietario(_: Estado, fd: FormData): Promise<Estado> {
  await staff();
  const nombres = txt(fd, "nombres");
  if (!nombres) return { error: "El nombre es obligatorio." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("personas")
    .update({
      nombres,
      documento: txt(fd, "documento") || null,
      email: txt(fd, "email") || null,
      telefono: txt(fd, "telefono") || null,
    })
    .eq("id", txt(fd, "persona_id"));
  if (error) return { error: error.message };
  refresh();
  return { ok: "Datos del propietario actualizados." };
}

// Cambio de propietario (venta, herencia…): elegir uno existente o registrar uno nuevo
export async function cambiarPropietario(_: Estado, fd: FormData): Promise<Estado> {
  const perfil = await staff();
  const supabase = await createClient();
  let propietario_id: string | null = txt(fd, "persona_id") || null;

  if (propietario_id === "nuevo") {
    const nombres = txt(fd, "nombres");
    if (!nombres) return { error: "Escribe el nombre del nuevo propietario." };
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
  } else if (propietario_id === "ninguno") {
    propietario_id = null;
  }

  const { error } = await supabase.from("unidades").update({ propietario_id }).eq("id", txt(fd, "unidad_id"));
  if (error) return { error: error.message };
  refresh();
  return { ok: propietario_id ? "Propietario asignado." : "La unidad quedó sin propietario." };
}
