import { cerrarSesion } from "@/app/login/actions";
import { Logo } from "@/components/iconos";

export default function CuentaDesactivada() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-8">
        <Logo />
        <h1 className="text-2xl font-extrabold text-slate-900">Tu acceso está desactivado</h1>
        <p className="text-sm text-slate-600">
          La administradora de tu empresa desactivó esta cuenta. Si crees que es un error, comunícate con ella.
        </p>
        <form action={cerrarSesion}>
          <button className="inline-flex min-h-11 items-center rounded-xl bg-petroleo-700 px-5 text-sm font-semibold text-white hover:bg-petroleo-800">
            Salir
          </button>
        </form>
      </div>
    </main>
  );
}
