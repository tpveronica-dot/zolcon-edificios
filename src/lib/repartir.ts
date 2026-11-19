export type PartidaMonto = { id: string; nombre: string; monto: number };
export type LineaPartida = PartidaMonto & { importe: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

// Reparte la cuota de una unidad entre las partidas, en proporción a cada partida;
// los céntimos de redondeo se ajustan en la partida mayor para que sume exacto.
export function repartirEnPartidas(cuota: number, partidas: PartidaMonto[], total: number): LineaPartida[] {
  if (total <= 0) return [];
  const lineas = partidas.map((p) => ({ ...p, importe: r2((p.monto * cuota) / total) }));
  const dif = r2(cuota - lineas.reduce((s, l) => s + l.importe, 0));
  if (dif !== 0 && lineas.length) {
    const mayor = lineas.reduce((a, b) => (b.importe > a.importe ? b : a));
    mayor.importe = r2(mayor.importe + dif);
  }
  return lineas;
}
