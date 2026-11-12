-- =====================================================================
-- Endurecimiento sugerido por el Security Advisor de Supabase
-- =====================================================================

-- Ruta de búsqueda fija (evita que se suplanten tablas o funciones)
alter function generar_cuotas(uuid, date) set search_path = public;
alter function proteger_perfiles() set search_path = public;

-- Nadie sin sesión puede ejecutar funciones internas
revoke execute on function mi_empresa_id(), mi_rol(), yo_activo(),
  puede_gestionar(uuid), puede_ver_edificio(uuid), es_mi_unidad(uuid), asignado_a(uuid),
  registrar_empresa(text, text), invitar_usuario(text, text, rol_usuario, uuid[]),
  generar_cuotas(uuid, date)
  from public, anon;

-- Funciones de triggers: solo las ejecuta la base de datos, nunca la API
revoke execute on function actualizar_estado_cuota(), crear_perfil(), proteger_perfiles()
  from public, anon, authenticated;

-- Funciones que la app sí necesita con sesión iniciada
grant execute on function mi_empresa_id(), mi_rol(), yo_activo(),
  puede_gestionar(uuid), puede_ver_edificio(uuid), es_mi_unidad(uuid), asignado_a(uuid),
  registrar_empresa(text, text), invitar_usuario(text, text, rol_usuario, uuid[]),
  generar_cuotas(uuid, date)
  to authenticated;
