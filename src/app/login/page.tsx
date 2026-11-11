import { LoginForm } from "./login-form";
import { Logo } from "@/components/iconos";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-1 flex-wrap bg-slate-50">
      <section className="flex flex-[1_1_420px] flex-col justify-between gap-10 bg-petroleo-700 p-8 text-white sm:p-12">
        <Logo claro />
        <div className="max-w-md space-y-4">
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">Cuotas claras, edificios en orden.</h1>
          <p className="text-lg text-petroleo-100">
            Presupuesto, cobranza y pagos de todos tus edificios en un solo lugar, con información transparente para cada propietario.
          </p>
        </div>
        <p className="text-sm text-petroleo-100">© Zolcon</p>
      </section>
      <section className="flex flex-[1_1_420px] items-center justify-center p-6 sm:p-12">
        <LoginForm />
      </section>
    </main>
  );
}
