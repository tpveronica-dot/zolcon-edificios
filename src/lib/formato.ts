export const soles = (n: number) =>
  `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// "2026-11" → "noviembre 2026"
export const nombreMes = (ym: string) => {
  const [a, m] = ym.split("-").map(Number);
  return `${MESES[m - 1]} ${a}`;
};

// Fecha de hoy en Lima, "YYYY-MM-DD"
export const hoyLima = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

export const fechaCorta = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};
