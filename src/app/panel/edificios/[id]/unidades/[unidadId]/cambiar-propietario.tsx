"use client";

import { useState } from "react";
import { FormAccion, Campo, Selector } from "@/components/form-accion";
import { cambiarPropietario } from "@/app/panel/actions";

export function CambiarPropietario({
  unidadId,
  actualId,
  personas,
}: {
  unidadId: string;
  actualId: string | null;
  personas: { id: string; nombres: string; documento: string | null }[];
}) {
  const [eleccion, setEleccion] = useState("nuevo");
  const opciones: [string, string][] = [
    ["nuevo", "➕ Registrar un propietario nuevo"],
    ...personas
      .filter((p) => p.id !== actualId)
      .map((p): [string, string] => [p.id, `${p.nombres}${p.documento ? ` · ${p.documento}` : ""}`]),
    ...(actualId ? ([["ninguno", "Dejar la unidad sin propietario"]] as [string, string][]) : []),
  ];

  return (
    <FormAccion action={cambiarPropietario} boton="Cambiar propietario" className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="unidad_id" value={unidadId} />
      <div className="sm:col-span-2">
        <Selector
          name="persona_id"
          label="Nuevo propietario"
          opciones={opciones}
          value={eleccion}
          onChange={(e) => setEleccion(e.target.value)}
        />
      </div>
      {eleccion === "nuevo" && (
        <>
          <Campo name="nombres" label="Nombre completo" required className="sm:col-span-2" />
          <Campo name="documento" label="DNI / RUC" />
          <Campo name="telefono" label="Celular" />
          <Campo name="email" label="Correo" type="email" className="sm:col-span-2" />
        </>
      )}
    </FormAccion>
  );
}
