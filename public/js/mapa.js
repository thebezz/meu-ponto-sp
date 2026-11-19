/**
 * Tudo que envolve o mapa (biblioteca Leaflet, carregada no index.html).
 * Camadas separadas permitem limpar uma parte do mapa sem mexer nas outras.
 */
import { escaparHtml } from './utils.js';

const CENTRO_SP = [-23.5505, -46.6333];

let mapa;
const camadas = {};

export function iniciarMapa(elementoId) {
  mapa = L.map(elementoId, { zoomControl: true }).setView(CENTRO_SP, 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(mapa);

  for (const nome of ['usuario', 'ponto', 'trajeto', 'onibus']) {
    camadas[nome] = L.layerGroup().addTo(mapa);
  }
}

/** Recalcula o tamanho do mapa (necessário após mudar o layout). */
export function ajustarTamanho() {
  mapa?.invalidateSize();
}

export function mostrarUsuario(lat, lon) {
  camadas.usuario.clearLayers();
  L.circleMarker([lat, lon], { radius: 9, className: 'marcador-usuario' })
    .bindTooltip('Você está aqui')
    .addTo(camadas.usuario);
}

/** Destaca o ponto selecionado e centraliza o mapa nele. */
export function mostrarPonto(ponto) {
  camadas.ponto.clearLayers();
  if (!ponto?.py) return;

  L.marker([ponto.py, ponto.px], {
    icon: L.divIcon({ className: 'icone-ponto', html: '🚏', iconSize: [34, 34] }),
    title: ponto.np,
  })
    .bindPopup(`<strong>${escaparHtml(ponto.np)}</strong>`)
    .addTo(camadas.ponto);

  mapa.setView([ponto.py, ponto.px], 16);
}

/**
 * Desenha os pontos de uma linha. `aoClicar(ponto)` é chamado quando o
 * usuário toca em um deles, para abrir o painel daquele ponto.
 */
export function mostrarTrajeto(pontos, aoClicar) {
  camadas.trajeto.clearLayers();
  for (const ponto of pontos) {
    L.circleMarker([ponto.py, ponto.px], { radius: 5, className: 'marcador-parada' })
      .bindTooltip(escaparHtml(ponto.np))
      .on('click', () => aoClicar(ponto))
      .addTo(camadas.trajeto);
  }
}

/** Desenha (ou redesenha) os ônibus de uma linha. */
export function mostrarOnibus(veiculos, letreiro) {
  camadas.onibus.clearLayers();
  for (const v of veiculos) {
    const classe = v.a ? 'icone-onibus acessivel' : 'icone-onibus';
    L.marker([v.py, v.px], {
      icon: L.divIcon({ className: classe, html: '🚌', iconSize: [30, 30] }),
      zIndexOffset: 1000,
    })
      .bindPopup(
        `<strong>${escaparHtml(letreiro)}</strong><br>Veículo ${escaparHtml(v.p)}` +
          (v.a ? '<br>♿ Acessível' : '')
      )
      .addTo(camadas.onibus);
  }
}

/** Enquadra no mapa todos os ônibus e pontos da linha que estão visíveis. */
export function enquadrarLinha() {
  const grupo = L.featureGroup([
    ...camadas.trajeto.getLayers(),
    ...camadas.onibus.getLayers(),
    ...camadas.ponto.getLayers(),
  ]);
  if (grupo.getLayers().length) {
    mapa.fitBounds(grupo.getBounds(), { padding: [30, 30], maxZoom: 15 });
  }
}

export function limparLinha() {
  camadas.trajeto.clearLayers();
  camadas.onibus.clearLayers();
}
