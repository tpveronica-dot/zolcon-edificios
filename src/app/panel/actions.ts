"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esStaff, esAdminEmpresa } from "@/lib/auth";
import { parsearCsv, aNumero } from "@/lib/csv";

export type Estado = { error?: string; ok?: string };

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
// Vuelve a la lista de unidades del edificio mostrando un mensaje
function volverALista(edificioId: string, mensaje: string): never {
  redirect(`/panel/edificios/${edificioId}?ok=${encodeURIComponent(mensaje)}`);
}

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
  const dia = Number(txt(fd, "dia_vencimiento") || 10);
  if (!Number.isInteger(dia) || dia < 1 || dia > 28) return { error: "El día de vencimiento debe estar entre 1 y 28." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("edificios")
    .insert({
      empresa_id: perfil.empresa_id,
      nombre,
      direccion: txt(fd, "direccion") || null,
      distrito: txt(fd, "distrito") || null,
      dia_vencimiento: dia,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const errSup = await asignarSupervisor(supabase, data.id, txt(fd, "supervisor_id") || null);
  if (errSup) return { error: `Edificio creado, pero no se pudo asignar el supervisor: ${errSup}` };
  redirect(`/panel?ok=${encodeURIComponent(`Edificio "${nombre}" creado.`)}`);
}

// Deja un único supervisor (personal con cargo Supervisor) en el edificio; null = ninguno.
// El acceso en la app del supervisor se sincroniza solo en la base de datos.
async function asignarSupervisor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  edificioId: string,
  personalId: string | null
): Promise<string | null> {
  const { data: actuales, error } = await supabase
    .from("personal_edificios")
    .select("personal_id, personal(cargo)")
    .eq("edificio_id", edificioId);
  if (error) return error.message;

  const supervisores = (actuales ?? [])
    .filter((a) => (a.personal as unknown as { cargo: string } | null)?.cargo === "supervisor")
    .map((a) => a.personal_id);
  const quitar = supervisores.filter((p) => p !== personalId);
  if (quitar.length) {
    const { error: e } = await supabase
      .from("personal_edificios")
      .delete()
      .eq("edificio_id", edificioId)
      .in("personal_id", quitar);
    if (e) return e.message;
  }
  if (personalId && !supervisores.includes(personalId)) {
    const { error: e } = await supabase
      .from("personal_edificios")
      .insert({ edificio_id: edificioId, personal_id: personalId });
    if (e) return e.message;
  }
  return null;
}

// ---------- Junta directiva (opcional, por edificio) ----------
const CARGOS_JUNTA: Record<string, string> = { presidente: "presidente", tesorero: "tesorero", miembro: "miembro de la junta" };

// cargo vacío = no es parte de la junta
async function guardarCargoJunta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  edificioId: string,
  personaId: string,
  cargo: string
): Promise<string | null> {
  if (!cargo || !(cargo in CARGOS_JUNTA)) {
    const { error } = await supabase.from("junta_directiva").delete().eq("edificio_id", edificioId).eq("persona_id", personaId);
    return error?.message ?? null;
  }
  if (cargo !== "miembro") {
    const { data: ocupado } = await supabase
      .from("junta_directiva")
      .select("persona_id, personas(nombres)")
      .eq("edificio_id", edificioId)
      .eq("cargo", cargo)
      .neq("persona_id", personaId)
      .maybeSingle();
    if (ocupado) {
      const nombre = (ocupado.personas as unknown as { nombres: string } | null)?.nombres ?? "otra persona";
      return `Este edificio ya tiene ${CARGOS_JUNTA[cargo]}: ${nombre}. Cámbiale el cargo primero.`;
    }
  }
  const { error } = await supabase
    .from("junta_directiva")
    .upsert({ edificio_id: edificioId, persona_id: personaId, cargo }, { onConflict: "edificio_id,persona_id" });
  return error?.message ?? null;
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
    propietario_id,
  });
  if (error) {
    return { error: error.code === "23505" ? `Ya existe la unidad ${codigo}.` : error.message };
  }
  if (propietario_id && txt(fd, "cargo_junta")) {
    const errJunta = await guardarCargoJunta(supabase, edificio_id, propietario_id, txt(fd, "cargo_junta"));
    if (errJunta) volverALista(edificio_id, `Unidad ${codigo} agregada, pero no se asignó el cargo en la junta: ${errJunta}`);
  }
  volverALista(edificio_id, `Unidad ${codigo} agregada.`);
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
  const conPorcentaje = "porcentaje" in filas[0]; // columna opcional (reparto por % libre)

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
        ...(conPorcentaje ? { porcentaje_participacion: aNumero(f.porcentaje) ?? 0 } : {}),
        propietario_id,
      },
      { onConflict: "edificio_id,codigo" }
    );
    if (error) errores.push(`Fila ${n} (${codigo}): ${error.message}`);
    else importadas++;
  }

  if (errores.length) {
    refresh();
    return { error: `Se importaron ${importadas} unidades. Errores:\n${errores.slice(0, 10).join("\n")}` };
  }
  volverALista(edificio_id, `Se importaron ${importadas} unidades.`);
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

export async function actualizarPartida(_: Estado, fd: FormData): Promise<Estado> {
  await staff();
  const nombre = txt(fd, "nombre");
  const monto = aNumero(txt(fd, "monto_mensual"));
  if (!nombre) return { error: "Escribe el nombre de la partida." };
  if (monto == null || monto < 0) return { error: "Escribe un monto mensual válido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partidas")
    .update({ nombre, monto_mensual: monto, es_fondo_reserva: fd.get("es_fondo_reserva") === "on" })
    .eq("id", txt(fd, "partida_id"))
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "No tienes permiso para editar esta partida." };
  redirect(
    `/panel/edificios/${txt(fd, "edificio_id")}/presupuesto?anio=${txt(fd, "anio")}&ok=${encodeURIComponent(`Partida "${nombre}" actualizada.`)}`
  );
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
    })
    .eq("id", txt(fd, "unidad_id"));
  if (error) return { error: error.code === "23505" ? `Ya existe otra unidad con el código ${codigo}.` : error.message };
  volverALista(txt(fd, "edificio_id"), `Unidad ${codigo} actualizada.`);
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
  const errJunta = await guardarCargoJunta(supabase, txt(fd, "edificio_id"), txt(fd, "persona_id"), txt(fd, "cargo_junta"));
  if (errJunta) return { error: errJunta };
  volverALista(txt(fd, "edificio_id"), `Datos de ${nombres} actualizados.`);
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
  volverALista(txt(fd, "edificio_id"), propietario_id ? "Propietario cambiado." : "La unidad quedó sin propietario.");
}

// ---------- Edificio: editar / eliminar ----------
export async function actualizarEdificio(_: Estado, fd: FormData): Promise<Estado> {
  await staff();
  const id = txt(fd, "edificio_id");
  const nombre = txt(fd, "nombre");
  if (!nombre) return { error: "El nombre es obligatorio." };
  const dia = Number(txt(fd, "dia_vencimiento"));
  if (!Number.isInteger(dia) || dia < 1 || dia > 28) return { error: "El día de vencimiento debe estar entre 1 y 28." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("edificios")
    .update({ nombre, direccion: txt(fd, "direccion") || null, distrito: txt(fd, "distrito") || null, dia_vencimiento: dia })
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "No tienes permiso para editar este edificio." };
  const errSup = await asignarSupervisor(supabase, id, txt(fd, "supervisor_id") || null);
  if (errSup) return { error: `Datos guardados, pero no se pudo asignar el supervisor: ${errSup}` };
  volverALista(id, "Datos del edificio actualizados.");
}

export async function eliminarEdificio(_: Estado, fd: FormData): Promise<Estado> {
  await staff();
  const id = txt(fd, "edificio_id");
  const supabase = await createClient();
  const { data: edificio } = await supabase.from("edificios").select("nombre").eq("id", id).single();
  if (!edificio) return { error: "Edificio no encontrado." };
  if (txt(fd, "confirmacion").toLowerCase() !== edificio.nombre.trim().toLowerCase()) {
    return { error: `Para confirmar, escribe exactamente: ${edificio.nombre}` };
  }
  const { data, error } = await supabase.from("edificios").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "No tienes permiso para eliminar este edificio." };
  redirect(`/panel?ok=${encodeURIComponent(`Edificio "${edificio.nombre}" eliminado.`)}`);
}

// ---------- Ejecución mensual del presupuesto ----------
type LineaInforme = { partida_id: string | null; concepto: string; presupuestado: number; real: number; nota: string };

export async function guardarInforme(_: Estado, fd: FormData): Promise<Estado> {
  const perfil = await staff();
  const edificio_id = txt(fd, "edificio_id");
  const mes = txt(fd, "mes");
  if (!/^\d{4}-\d{2}$/.test(mes)) return { error: "Mes no válido." };

  let lineas: LineaInforme[];
  try {
    lineas = JSON.parse(txt(fd, "lineas"));
  } catch {
    return { error: "No se pudieron leer las líneas del informe." };
  }
  const limpias: LineaInforme[] = [];
  for (const l of lineas) {
    const concepto = String(l.concepto ?? "").trim();
    const real = aNumero(String(l.real ?? "")) ?? 0;
    if (real < 0) return { error: `El monto de "${concepto}" no puede ser negativo.` };
    if (!l.partida_id && !concepto) {
      if (real > 0) return { error: "Escribe el concepto de cada gasto no presupuestado." };
      continue; // fila vacía
    }
    limpias.push({
      partida_id: l.partida_id || null,
      concepto,
      presupuestado: Number(l.presupuestado) || 0,
      real,
      nota: String(l.nota ?? "").trim(),
    });
  }

  const supabase = await createClient();
  const periodo = `${mes}-01`;
  const { data: existente } = await supabase
    .from("informes_mensuales")
    .select("id, estado")
    .eq("edificio_id", edificio_id)
    .eq("periodo", periodo)
    .maybeSingle();
  if (existente?.estado === "cerrado") return { error: "El informe está cerrado. Reábrelo para modificarlo." };

  let informeId = existente?.id;
  if (informeId) {
    const { error } = await supabase
      .from("informes_mensuales")
      .update({ notas: txt(fd, "notas") || null, actualizado_por: perfil.id, actualizado_en: new Date().toISOString() })
      .eq("id", informeId);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("informes_mensuales")
      .insert({ empresa_id: perfil.empresa_id, edificio_id, periodo, notas: txt(fd, "notas") || null, actualizado_por: perfil.id })
      .select("id")
      .single();
    if (error) return { error: error.message };
    informeId = data.id;
  }

  const { error: errDel } = await supabase.from("informe_lineas").delete().eq("informe_id", informeId);
  if (errDel) return { error: errDel.message };
  if (limpias.length) {
    const { error } = await supabase
      .from("informe_lineas")
      .insert(limpias.map((l) => ({ ...l, informe_id: informeId, nota: l.nota || null })));
    if (error) return { error: error.message };
  }
  redirect(`/panel/edificios/${edificio_id}/ejecucion?mes=${mes}&ok=${encodeURIComponent("Informe guardado.")}`);
}

export async function cambiarEstadoInforme(fd: FormData) {
  await staff();
  const supabase = await createClient();
  const estado = txt(fd, "estado") === "cerrado" ? "cerrado" : "borrador";
  await supabase.from("informes_mensuales").update({ estado }).eq("id", txt(fd, "informe_id"));
  redirect(
    `/panel/edificios/${txt(fd, "edificio_id")}/ejecucion?mes=${txt(fd, "mes")}&ok=${encodeURIComponent(
      estado === "cerrado" ? "Informe cerrado." : "Informe reabierto para edición."
    )}`
  );
}

// ---------- Distribución de la cuota ----------
export async function guardarDistribucion(_: Estado, fd: FormData): Promise<Estado> {
  const perfil = await getPerfil();
  if (!esAdminEmpresa(perfil)) return { error: "Solo la administradora de la empresa puede cambiar el reparto." };
  const edificio_id = txt(fd, "edificio_id");
  const metodo = txt(fd, "metodo");
  if (!["metraje", "igual", "libre"].includes(metodo)) return { error: "Elige una forma de reparto." };
  const supabase = await createClient();

  if (metodo === "libre") {
    let porcentajes: Record<string, string>;
    try {
      porcentajes = JSON.parse(txt(fd, "porcentajes"));
    } catch {
      return { error: "No se pudieron leer los porcentajes." };
    }
    const valores = Object.entries(porcentajes).map(([id, v]) => [id, aNumero(v) ?? 0] as const);
    if (valores.some(([, v]) => v < 0)) return { error: "Ningún porcentaje puede ser negativo." };
    const suma = valores.reduce((s, [, v]) => s + v, 0);
    if (Math.abs(suma - 100) > 0.01) return { error: `Los porcentajes suman ${suma.toFixed(2)} %; deben sumar 100 %.` };
    for (const [id, v] of valores) {
      const { error } = await supabase
        .from("unidades")
        .update({ porcentaje_participacion: v })
        .eq("id", id)
        .eq("edificio_id", edificio_id);
      if (error) return { error: error.message };
    }
  }

  const { data, error } = await supabase
    .from("edificios")
    .update({ metodo_distribucion: metodo })
    .eq("id", edificio_id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "No tienes permiso para cambiar este edificio." };
  redirect(
    `/panel/edificios/${edificio_id}/cuotas?mes=${txt(fd, "mes")}&ok=${encodeURIComponent("Forma de reparto guardada.")}#distribucion`
  );
}
