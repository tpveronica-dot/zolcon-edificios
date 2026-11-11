"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, esAdminEmpresa } from "@/lib/auth";

export type Estado = { error?: string; ok?: string };

const ROLES = ["admin_empresa", "administrador", "junta", "propietario"] as const;
const CON_EDIFICIOS = ["administrador", "junta"];
const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function admin() {
  const perfil = await getPerfil();
  if (!esAdminEmpresa(perfil)) throw new Error("Sin permiso");
  return perfil;
}

function volver(mensaje: string, extra = ""): never {
  redirect(`/panel/usuarios?ok=${encodeURIComponent(mensaje)}${extra}`);
}

export async function crearUsuario(_: Estado, fd: FormData): Promise<Estado> {
  await admin();
  const rol = txt(fd, "rol");
  if (!(ROLES as readonly string[]).includes(rol)) return { error: "Elige un rol." };
  const edificios = CON_EDIFICIOS.includes(rol) ? fd.getAll("edificios").map(String) : [];
  if (CON_EDIFICIOS.includes(rol) && edificios.length === 0) {
    return { error: "Elige al menos un edificio para este rol." };
  }
  const email = txt(fd, "email").toLowerCase();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invitar_usuario", {
    p_email: email,
    p_nombre: txt(fd, "nombre"),
    p_rol: rol,
    p_edificios: edificios,
  });
  if (error) return { error: error.message };
  if (data === "activado") volver(`${email} ya tenía cuenta: ahora tiene acceso a tu empresa.`);
  volver(`Usuario creado. Envíale su enlace de acceso (en "Invitaciones pendientes").`);
}

export async function actualizarUsuario(_: Estado, fd: FormData): Promise<Estado> {
  const yo = await admin();
  const id = txt(fd, "usuario_id");
  const rol = txt(fd, "rol");
  if (!(ROLES as readonly string[]).includes(rol)) return { error: "Elige un rol." };
  const edificios = CON_EDIFICIOS.includes(rol) ? fd.getAll("edificios").map(String) : [];
  if (CON_EDIFICIOS.includes(rol) && edificios.length === 0) {
    return { error: "Elige al menos un edificio para este rol." };
  }

  const supabase = await createClient();
  if (id !== yo.id) {
    const { error } = await supabase.from("perfiles").update({ rol }).eq("id", id);
    if (error) return { error: error.message };
  }

  // Sincronizar edificios asignados (solo los de mi empresa, por las reglas de la base)
  const { data: actuales } = await supabase.from("edificio_usuarios").select("edificio_id").eq("usuario_id", id);
  const antes = new Set((actuales ?? []).map((a) => a.edificio_id));
  const despues = new Set(edificios);
  const quitar = [...antes].filter((e) => !despues.has(e));
  const agregar = [...despues].filter((e) => !antes.has(e));
  if (quitar.length) {
    const { error } = await supabase.from("edificio_usuarios").delete().eq("usuario_id", id).in("edificio_id", quitar);
    if (error) return { error: error.message };
  }
  if (agregar.length) {
    const { error } = await supabase
      .from("edificio_usuarios")
      .insert(agregar.map((edificio_id) => ({ edificio_id, usuario_id: id })));
    if (error) return { error: error.message };
  }
  volver("Usuario actualizado.");
}

export async function cambiarEstadoUsuario(fd: FormData) {
  await admin();
  const supabase = await createClient();
  const activo = txt(fd, "activo") === "true";
  const { error } = await supabase.from("perfiles").update({ activo }).eq("id", txt(fd, "usuario_id"));
  if (error) redirect(`/panel/usuarios?error=${encodeURIComponent(error.message)}`);
  volver(activo ? "Usuario reactivado." : "Usuario desactivado: ya no puede ingresar.");
}

export async function cancelarInvitacion(fd: FormData) {
  await admin();
  const supabase = await createClient();
  await supabase.from("invitaciones").delete().eq("id", txt(fd, "id"));
  refresh();
}
