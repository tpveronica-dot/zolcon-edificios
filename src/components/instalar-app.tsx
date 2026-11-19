"use client";

import { useEffect, useState } from "react";

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Registra el service worker y ofrece "Instalar la app" (Android) o explica cómo en iPhone
export function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [ios, setIos] = useState(false);
  const [instalada, setInstalada] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstalada(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const alOfrecer = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    const alInstalar = () => setInstalada(true);
    window.addEventListener("beforeinstallprompt", alOfrecer);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alOfrecer);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  if (instalada || (!evento && !ios)) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-petroleo-100 bg-petroleo-50 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="h-11 w-11 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-slate-900">Ten la app en tu celular</p>
        {evento ? (
          <p className="text-slate-600">Accede a tu cuota con un toque.</p>
        ) : (
          <p className="text-slate-600">
            En Safari, toca <strong>Compartir</strong> <span aria-hidden>⬆︎</span> y luego <strong>“Agregar a inicio”</strong>.
          </p>
        )}
      </div>
      {evento && (
        <button
          type="button"
          onClick={async () => {
            await evento.prompt();
            await evento.userChoice;
            setEvento(null);
          }}
          className="inline-flex min-h-11 items-center rounded-xl bg-petroleo-700 px-4 text-sm font-semibold text-white"
        >
          Instalar
        </button>
      )}
    </div>
  );
}
