# Zolcon Edificios

Aplicación web multiempresa para administradoras de edificios: presupuesto, gastos, cálculo y cobranza de cuotas, y portal del propietario.

**Stack:** Next.js (App Router, TypeScript, Tailwind) · Supabase (Postgres + Auth + RLS) · Vercel · GitHub

## Estructura
- `supabase/migrations/0001_esquema_base.sql` — tablas, seguridad multiempresa (RLS), cálculo de cuotas, estado de cuenta y ejecución de presupuesto.
- `src/lib/supabase/` — conexión a Supabase desde el navegador y el servidor.

## Roles
superadmin (Zolcon) · admin_empresa · administrador (de edificios asignados) · junta (lectura) · propietario (portal propio)

## Puesta en marcha
1. Crear proyecto en Supabase → SQL Editor → ejecutar `0001_esquema_base.sql`.
2. Copiar `.env.example` a `.env.local` con la URL y la anon key del proyecto.
3. `npm install` y `npm run dev`.
4. En Vercel: importar el repo de GitHub y cargar las mismas dos variables de entorno.

## Regla de cálculo
Cuota mensual de una unidad = suma de partidas mensuales del presupuesto del año × % de participación de la unidad.
