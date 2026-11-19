/**
 * Funções que montam o HTML das listas. Elas só recebem dados e devolvem
 * texto HTML; quem coloca na página e trata os cliques é o app.js.
 */
import {
  descreverLinha, escaparHtml, minutosAte, textoDistancia, textoEspera,
} from './utils.js';

const MAX_TEMPOS_POR_LINHA = 3;

function mensagem(texto) {
  return `<li class="vazio">${escaparHtml(texto)}</li>`;
}

/** Resultados de /Parada/Buscar. `pontos` pode trazer a propriedade `distancia`. */
export function listaPontos(pontos) {
  if (!pontos.length) return mensagem('Nenhum ponto encontrado. Tente outro nome de rua.');

  return pontos
    .map((p, indice) => `
      <li>
        <button type="button" class="item" data-acao="abrir-ponto" data-indice="${indice}">
          <span class="item-titulo">🚏 ${escaparHtml(p.np || 'Ponto sem nome')}</span>
          <span class="item-sub">${escaparHtml(p.ed || '')}</span>
          ${p.distancia != null ? `<span class="etiqueta">${textoDistancia(p.distancia)}</span>` : ''}
        </button>
      </li>`)
    .join('');
}

/** Resultados de /Linha/Buscar. */
export function listaLinhas(linhas) {
  if (!linhas.length) return mensagem('Nenhuma linha encontrada. Tente o número (ex.: 8000) ou um bairro.');

  return linhas
    .map((linha, indice) => {
      const { letreiro, trajeto } = descreverLinha(linha);
      return `
        <li>
          <button type="button" class="item" data-acao="seguir-linha" data-indice="${indice}">
            <span class="item-titulo"><span class="letreiro">${escaparHtml(letreiro)}</span></span>
            <span class="item-sub">${escaparHtml(trajeto)}</span>
          </button>
        </li>`;
    })
    .join('');
}

/**
 * Painel de próximos ônibus de um ponto.
 * Cada linha mostra os próximos horários, ordenada pela chegada mais próxima.
 */
export function listaPrevisoes(linhas, horaConsulta, { soAcessiveis, alertas }) {
  if (!horaConsulta) return mensagem('Não há previsão disponível para este ponto agora.');

  const linhasComTempos = linhas
    .map((linha) => {
      const todos = linha.vs ?? [];
      const veiculos = soAcessiveis ? todos.filter((v) => v.a) : todos;
      const chegadas = veiculos
        .map((v) => ({ minutos: minutosAte(v.t, horaConsulta), acessivel: v.a, hora: v.t }))
        .sort((a, b) => a.minutos - b.minutos);
      return { ...linha, chegadas };
    })
    .filter((linha) => linha.chegadas.length)
    .sort((a, b) => a.chegadas[0].minutos - b.chegadas[0].minutos);

  if (!linhasComTempos.length) {
    return mensagem(
      soAcessiveis
        ? 'Nenhum ônibus acessível previsto agora. Desmarque o filtro para ver todos.'
        : 'Nenhum ônibus previsto para este ponto agora.'
    );
  }

  return linhasComTempos.map((linha) => itemPrevisao(linha, alertas.has(linha.cl))).join('');
}

function itemPrevisao(linha, alertaAtivo) {
  const [primeira, ...demais] = linha.chegadas.slice(0, MAX_TEMPOS_POR_LINHA);
  const iconeAcessivel = (c) => (c.acessivel ? ' <span title="Veículo acessível">♿</span>' : '');
  const terminais = `${linha.lt0} ⇄ ${linha.lt1}`;

  const proximos = demais
    .map((c) => `<span>${textoEspera(c.minutos)}${iconeAcessivel(c)}</span>`)
    .join('');

  return `
    <li class="previsao ${primeira.minutos <= 1 ? 'chegando' : ''}">
      <button type="button" class="previsao-info" data-acao="seguir-previsao"
              data-cl="${linha.cl}" data-letreiro="${escaparHtml(linha.c)}"
              data-terminais="${escaparHtml(terminais)}"
              title="Ver os ônibus desta linha no mapa">
        <span class="letreiro">${escaparHtml(linha.c)}</span>
        <span class="item-sub">${escaparHtml(terminais)}</span>
        <span class="tempos">
          <strong class="tempo-principal">${textoEspera(primeira.minutos)}${iconeAcessivel(primeira)}</strong>
          ${proximos}
        </span>
        <span class="item-sub">Próximo previsto às ${escaparHtml(primeira.hora)}</span>
      </button>
      <button type="button" class="botao-icone sino" data-acao="alerta" data-cl="${linha.cl}"
              data-letreiro="${escaparHtml(linha.c)}" aria-pressed="${alertaAtivo}"
              title="${alertaAtivo ? 'Cancelar aviso' : 'Avisar quando faltar 5 minutos'}">
        🔔
      </button>
    </li>`;
}

/** Chips dos pontos favoritos. */
export function listaFavoritos(favoritos) {
  return favoritos
    .map((p) => `
      <li>
        <button type="button" class="chip" data-acao="abrir-favorito" data-cp="${p.cp}">
          ${escaparHtml(p.np || `Ponto ${p.cp}`)}
        </button>
      </li>`)
    .join('');
}
