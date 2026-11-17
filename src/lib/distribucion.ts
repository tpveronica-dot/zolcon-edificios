export type Metodo = "metraje" | "igual" | "libre";

export const METODOS: { valor: Metodo; titulo: string; descripcion: string }[] = [
  { valor: "metraje", titulo: "Por metraje", descripcion: "Cada unidad paga según su área (m²) sobre el área total." },
  { valor: "igual", titulo: "Cuota igual", descripcion: "Todas las unidades pagan el mismo monto." },
  { valor: "libre", titulo: "% libre", descripcion: "Tú defines el % de cada unidad; debe sumar 100 %." },
];

export const NOMBRE_METODO: Record<string, string> = Object.fromEntries(METODOS.map((m) => [m.valor, m.titulo]));
