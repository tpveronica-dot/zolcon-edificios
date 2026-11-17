"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esAdminEmpresa } from "@/lib/auth";

export type Estado = { error?: string; ok?: string };

const CARGOS = ["supervisor", "conserje", "limpieza"];
const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function admin() {
  const perfil = await getPerfil();
  if (!esAdminEmpresa(perfil)) throw new Error("Sin permiso");
  return perfil;
}

function volver(mensaje: string): never {
  redirect(`/panel/personal?ok=${encodeURIComponent(mensaje)}`);
}

// Crea (sin personal_id) o actualiza (con personal_id) a una persona del personal
export async function guardarPersonal(_: Estado, fd: FormData): Promise<Estado> {
  const perfil = await admin();
  const id = txt(fd, "personal_id");
  const nombre = txt(fd, "nombre");
  const cargo = txt(fd, "cargo");
  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!CARGOS.includes(cargo)) return { error: "Elige un cargo." };
  const email = txt(fd, "email").toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "El correo no es válido." };

  const datos = {
    nombre,
    cargo,
    telefono: txt(fd, "telefono") || null,
    email: email || null,
    usuario_id: txt(fd, "usuario_id") || null,
  };

  const supabase = await createClient();
  let personalId = id;
  if (id) {
    const { error } = await supabase.from("personal").update(datos).eq("id", id);
    if (error) return { error: error.code === "23505" ? "Ese usuario ya está vinculado a otra persona del personal." : error.message };
  } else {
    const { data, error } = await supabase
      .from("personal")
      .insert({ ...datos, empresa_id: perfil.empresa_id })
      .select("id")
      .single();
    if (error) return { error: error.code === "23505" ? "Ese usuario ya está vinculado a otra persona del personal." : error.message };
    personalId = data.id;
  }

  // Edificios asignados: reemplazar por la selección actual
  const edificios = fd.getAll("edificios").map(String);
  const { error: errDel } = await supabase.from("personal_edificios").delete().eq("personal_id", personalId);
  if (errDel) return { error: errDel.message };
  if (edificios.length) {
    const { error } = await supabase
      .from("personal_edificios")
      .insert(edificios.map((edificio_id) => ({ personal_id: personalId, edificio_id })));
    if (error) return { error: error.message };
  }

  volver(id ? `Datos de ${nombre} actualizados.` : `${nombre} agregado al personal.`);
}

export async function eliminarPersonal(fd: FormData) {
  await admin();
  const supabase = await createClient();
  const { error } = await supabase.from("personal").delete().eq("id", txt(fd, "personal_id"));
  if (error) redirect(`/panel/personal?error=${encodeURIComponent(error.message)}`);
  volver("Persona eliminada del personal.");
}
