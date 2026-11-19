import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Datos mínimos que necesita el recibo (coinciden con BalanceMes / BalanceVecino)
export type DatosRecibo = {
  empresa: string | null;
  edificio: { nombre: string; direccion: string | null; distrito: string | null };
  mes: string; // "2026-11"
  totalMensual: number;
  vecinos: {
    codigo: string;
    tipo: string;
    area: number | null;
    propietario: string | null;
    documento: string | null;
    monto: number;
    vencimiento: string;
    estado: string;
    participacion: number;
    pagado: number;
    saldo: number;
    deudaTotal: number;
    pagos: { fecha: string; medio: string; monto: number; operacion: string | null }[];
    lineas: { nombre: string; monto: number; importe: number }[];
  }[];
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const PETROLEO = rgb(14 / 255, 74 / 255, 92 / 255);
const TINTA = rgb(21 / 255, 33 / 255, 43 / 255);
const PIZARRA = rgb(74 / 255, 88 / 255, 101 / 255);
const BORDE = rgb(217 / 255, 224 / 255, 229 / 255);
const FONDO = rgb(245 / 255, 247 / 255, 248 / 255);
const AMBAR = rgb(233 / 255, 180 / 255, 76 / 255);
const ESTADOS: Record<string, { texto: string; color: ReturnType<typeof rgb> }> = {
  pagada: { texto: "PAGADA", color: rgb(23 / 255, 112 / 255, 79 / 255) },
  parcial: { texto: "PAGO PARCIAL", color: rgb(31 / 255, 95 / 255, 168 / 255) },
  pendiente: { texto: "PENDIENTE", color: rgb(138 / 255, 90 / 255, 0) },
  vencida: { texto: "VENCIDA", color: rgb(180 / 255, 35 / 255, 44 / 255) },
};
const NOMBRE_TIPO: Record<string, string> = {
  departamento: "Departamento",
  estacionamiento: "Estacionamiento",
  deposito: "Depósito",
  local: "Local",
};

const soles = (n: number) =>
  `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};
const nombreMes = (ym: string) => {
  const [a, m] = ym.split("-").map(Number);
  return `${MESES[m - 1]} ${a}`;
};

// Las fuentes estándar de PDF solo traen caracteres latinos (WinAnsi): se reemplaza lo demás
const LATIN1 = /[^ -~ -ÿ–—‘’“”•…€]/g;
const limpio = (t: string) => t.replace(/\s+/g, " ").replace(LATIN1, "?");

export async function generarReciboPdf(datos: DatosRecibo, hoy: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Estado de cuota ${nombreMes(datos.mes)} - ${datos.edificio.nombre}`);
  pdf.setAuthor(datos.empresa ?? "Inmobiliaria app");
  pdf.setCreator("Inmobiliaria app");
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const v of datos.vecinos) {
    dibujarVecino(pdf, normal, negrita, datos, v, hoy);
  }
  if (datos.vecinos.length === 0) {
    const p = pdf.addPage([595.28, 841.89]);
    p.drawText(limpio("No hay cuotas para este mes."), { x: 48, y: 780, size: 12, font: normal, color: TINTA });
  }
  return pdf.save();
}

function dibujarVecino(
  pdf: PDFDocument,
  normal: PDFFont,
  negrita: PDFFont,
  datos: DatosRecibo,
  v: DatosRecibo["vecinos"][number],
  hoy: string
) {
  const W = 595.28;
  const H = 841.89;
  const M = 48; // margen
  let page = pdf.addPage([W, H]);

  const texto = (p: PDFPage, t: string, x: number, y: number, size: number, font = normal, color = TINTA) =>
    p.drawText(limpio(t), { x, y, size, font, color });
  const derecha = (p: PDFPage, t: string, xDer: number, y: number, size: number, font = normal, color = TINTA) => {
    const s = limpio(t);
    p.drawText(s, { x: xDer - font.widthOfTextAtSize(s, size), y, size, font, color });
  };
  const recortar = (t: string, ancho: number, size: number, font = normal) => {
    let s = limpio(t);
    while (s.length > 1 && font.widthOfTextAtSize(s, size) > ancho) s = s.slice(0, -2) + "…";
    return s;
  };

  // ---------- Encabezado ----------
  page.drawRectangle({ x: 0, y: H - 96, width: W, height: 96, color: PETROLEO });
  page.drawRectangle({ x: M, y: H - 66, width: 26, height: 26, color: AMBAR });
  texto(page, datos.empresa ?? "Administración del edificio", M + 38, H - 50, 15, negrita, rgb(1, 1, 1));
  texto(page, "Estado de cuota de mantenimiento", M + 38, H - 66, 10, normal, rgb(201 / 255, 218 / 255, 223 / 255));
  derecha(page, nombreMes(datos.mes).replace(/^./, (c) => c.toUpperCase()), W - M, H - 50, 15, negrita, rgb(1, 1, 1));
  derecha(page, `Emitido el ${fecha(hoy)}`, W - M, H - 66, 10, normal, rgb(201 / 255, 218 / 255, 223 / 255));

  // ---------- Datos ----------
  let y = H - 132;
  const col2 = W / 2 + 8;
  const fila = (etq: string, val: string, x: number, yy: number) => {
    texto(page, etq, x, yy, 8, negrita, PIZARRA);
    texto(page, recortar(val, W / 2 - M - 16, 11), x, yy - 14, 11, normal, TINTA);
  };
  fila("EDIFICIO", datos.edificio.nombre, M, y);
  fila("UNIDAD", `${v.codigo} · ${NOMBRE_TIPO[v.tipo] ?? v.tipo}${v.area ? ` · ${v.area} m²` : ""}`, col2, y);
  y -= 38;
  fila("DIRECCIÓN", [datos.edificio.direccion, datos.edificio.distrito].filter(Boolean).join(", ") || "—", M, y);
  fila("PROPIETARIO", `${v.propietario ?? "Sin propietario"}${v.documento ? ` · ${v.documento}` : ""}`, col2, y);
  y -= 38;
  fila("PARTICIPACIÓN EN EL MES", `${v.participacion.toFixed(2)} % del presupuesto mensual`, M, y);
  fila("VENCIMIENTO", fecha(v.vencimiento), col2, y);

  // Estado
  const vencida = v.estado !== "pagada" && v.vencimiento < hoy;
  const est = ESTADOS[vencida ? "vencida" : v.estado] ?? ESTADOS.pendiente;
  y -= 40;
  const anchoEst = negrita.widthOfTextAtSize(est.texto, 9) + 20;
  page.drawRectangle({ x: M, y: y - 6, width: anchoEst, height: 20, color: rgb(1, 1, 1), borderColor: est.color, borderWidth: 1 });
  texto(page, est.texto, M + 10, y, 9, negrita, est.color);

  // ---------- Tabla de partidas ----------
  y -= 34;
  const xImp = W - M;
  const xPres = W - M - 140;
  const encabezado = () => {
    page.drawRectangle({ x: M, y: y - 8, width: W - 2 * M, height: 24, color: FONDO });
    texto(page, "PARTIDA DEL PRESUPUESTO", M + 10, y, 8, negrita, PIZARRA);
    derecha(page, "PRESUPUESTO DEL EDIFICIO", xPres, y, 8, negrita, PIZARRA);
    derecha(page, "LE CORRESPONDE", xImp - 10, y, 8, negrita, PIZARRA);
    y -= 24;
  };
  encabezado();
  for (const l of v.lineas) {
    if (y < 190) {
      page = pdf.addPage([W, H]);
      y = H - 64;
      encabezado();
    }
    texto(page, recortar(l.nombre, xPres - M - 160, 10), M + 10, y, 10);
    derecha(page, soles(l.monto), xPres, y, 10, normal, PIZARRA);
    derecha(page, soles(l.importe), xImp - 10, y, 10);
    page.drawLine({ start: { x: M, y: y - 7 }, end: { x: W - M, y: y - 7 }, thickness: 0.5, color: BORDE });
    y -= 20;
  }
  // Total
  y -= 4;
  page.drawLine({ start: { x: M, y: y + 13 }, end: { x: W - M, y: y + 13 }, thickness: 1.2, color: TINTA });
  texto(page, "Cuota del mes", M + 10, y, 11, negrita);
  derecha(page, soles(datos.totalMensual), xPres, y, 10, normal, PIZARRA);
  derecha(page, soles(v.monto), xImp - 10, y, 11, negrita);

  // ---------- Resumen de pago ----------
  y -= 40;
  const cajaX = W / 2 + 8;
  const cajaW = W - M - cajaX;
  page.drawRectangle({ x: cajaX, y: y - 66, width: cajaW, height: 84, color: FONDO, borderColor: BORDE, borderWidth: 0.5 });
  const linea = (etq: string, val: string, yy: number, font = normal, color = TINTA) => {
    texto(page, etq, cajaX + 12, yy, 10, font, PIZARRA);
    derecha(page, val, cajaX + cajaW - 12, yy, 10, font, color);
  };
  linea("Cuota del mes", soles(v.monto), y);
  linea("Pagado", soles(v.pagado), y - 18);
  linea("Saldo del mes", soles(v.saldo), y - 36, negrita, v.saldo > 0 ? est.color : ESTADOS.pagada.color);
  linea("Deuda total acumulada", soles(v.deudaTotal), y - 54, negrita, v.deudaTotal > 0 ? ESTADOS.vencida.color : TINTA);

  // Pagos registrados
  texto(page, "PAGOS REGISTRADOS", M, y, 8, negrita, PIZARRA);
  let yp = y - 16;
  if (v.pagos.length === 0) {
    texto(page, "Sin pagos registrados este mes.", M, yp, 10, normal, PIZARRA);
  } else {
    for (const p of v.pagos.slice(0, 4)) {
      const medio = p.medio.charAt(0).toUpperCase() + p.medio.slice(1);
      texto(page, recortar(`${fecha(p.fecha)} · ${medio}${p.operacion ? ` · Op. ${p.operacion}` : ""}`, cajaX - M - 90, 9), M, yp, 9);
      derecha(page, soles(p.monto), cajaX - 16, yp, 9);
      yp -= 15;
    }
    if (v.pagos.length > 4) texto(page, `y ${v.pagos.length - 4} pagos más`, M, yp, 9, normal, PIZARRA);
  }

  // ---------- Pie ----------
  page.drawLine({ start: { x: M, y: 70 }, end: { x: W - M, y: 70 }, thickness: 0.5, color: BORDE });
  texto(
    page,
    "Cada partida se calcula en la misma proporción que su cuota tiene sobre el presupuesto mensual del edificio.",
    M,
    54,
    8,
    normal,
    PIZARRA
  );
  texto(page, "Generado con Inmobiliaria app", M, 40, 8, negrita, PETROLEO);
  derecha(page, `${datos.edificio.nombre} · Unidad ${v.codigo}`, W - M, 40, 8, normal, PIZARRA);
}
