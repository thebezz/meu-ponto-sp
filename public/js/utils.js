/** Funções auxiliares sem dependência de tela. */

const MINUTOS_NO_DIA = 24 * 60;

/** Converte "HH:MM" em minutos desde a meia-noite. */
function paraMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Quantos minutos faltam de `horaReferencia` até `horaPrevista` (ambas "HH:MM").
 * Trata a virada da meia-noite (ex.: 23:58 → 00:04 = 6 min).
 */
export function minutosAte(horaPrevista, horaReferencia) {
  let diferenca = paraMinutos(horaPrevista) - paraMinutos(horaReferencia);
  if (diferenca < -MINUTOS_NO_DIA / 2) diferenca += MINUTOS_NO_DIA;
  return Math.max(0, diferenca);
}

/** Texto amigável para o tempo de espera. */
export function textoEspera(minutos) {
  if (minutos <= 1) return 'chegando';
  return `${minutos} min`;
}

/** Distância em metros entre dois pontos (fórmula de Haversine). */
export function distanciaMetros(lat1, lon1, lat2, lon2) {
  const raioTerra = 6371000;
  const rad = (graus) => (graus * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * raioTerra * Math.asin(Math.sqrt(a));
}

export function textoDistancia(metros) {
  return metros < 1000 ? `${Math.round(metros)} m` : `${(metros / 1000).toFixed(1)} km`;
}

/** Evita que textos vindos da API sejam interpretados como HTML. */
export function escaparHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

/**
 * Dados de exibição de uma linha retornada por /Linha/Buscar.
 * sl = 1: do terminal principal (tp) para o secundário (ts); sl = 2: o contrário.
 */
export function descreverLinha(linha) {
  const origem = linha.sl === 1 ? linha.tp : linha.ts;
  const destino = linha.sl === 1 ? linha.ts : linha.tp;
  return {
    letreiro: `${linha.lt}-${linha.tl}`,
    trajeto: `${origem} → ${destino}`,
  };
}
