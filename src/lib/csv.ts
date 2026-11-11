// Lector de CSV tolerante: separador "," o ";" (Excel en español), comillas, BOM
// y cabeceras con tildes/mayúsculas ("Código", "% Participación"…).

const ALIAS: Record<string, string> = {
  codigo: "codigo", unidad: "codigo", departamento: "codigo", dpto: "codigo",
  tipo: "tipo",
  area: "area_m2", aream2: "area_m2", area_m2: "area_m2",
  porcentaje: "porcentaje", participacion: "porcentaje", porcentajeparticipacion: "porcentaje",
  propietario: "propietario", nombre: "propietario", nombres: "propietario",
  documento: "documento", dni: "documento", ruc: "documento",
  email: "email", correo: "email",
  telefono: "telefono", celular: "telefono",
};

function normalizar(h: string) {
  const k = h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  return ALIAS[k] ?? k;
}

function dividir(linea: string, sep: string): string[] {
  const out: string[] = [];
  let actual = "";
  let comillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (comillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else comillas = !comillas;
    } else if (c === sep && !comillas) {
      out.push(actual);
      actual = "";
    } else actual += c;
  }
  out.push(actual);
  return out.map((s) => s.trim());
}

export function parsearCsv(texto: string): Record<string, string>[] {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lineas.length < 2) return [];
  const sep = (lineas[0].match(/;/g)?.length ?? 0) > (lineas[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const cab = dividir(lineas[0], sep).map(normalizar);
  return lineas.slice(1).map((l) => {
    const v = dividir(l, sep);
    return Object.fromEntries(cab.map((h, i) => [h, v[i] ?? ""]));
  });
}

// "2,5" / "2.5" / "2.5%" → 2.5 ; vacío → null
export function aNumero(v: string | undefined | null): number | null {
  if (v == null) return null;
  const s = String(v).replace("%", "").replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
