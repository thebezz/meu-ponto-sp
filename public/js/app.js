/**
 * Ponto de entrada do app: guarda o estado, liga os eventos da página e
 * coordena os outros módulos (api, mapa, telas, armazenamento).
 */
import * as api from './api.js';
import * as mapa from './mapa.js';
import * as telas from './telas.js';
import * as armazenamento from './armazenamento.js';
import { descreverLinha, distanciaMetros, minutosAte } from './utils.js';

const INTERVALO_ATUALIZACAO_S = 30; // a SPTrans atualiza as posições a cada ~30 s
const MINUTOS_PARA_ALERTA = 5;

const estado = {
  aba: 'pontos',            // 'pontos' ou 'linhas'
  resultados: [],           // último resultado de busca
  ponto: null,              // ponto aberto no painel
  previsoes: { hora: null, linhas: [] },
  linha: null,              // linha acompanhada no mapa: { cl, letreiro, detalhe }
  posicaoUsuario: null,     // { lat, lon }
  alertas: new Map(),       // cl → letreiro das linhas com aviso ligado
  avisosJaEnviados: new Set(),
  segundosParaAtualizar: INTERVALO_ATUALIZACAO_S,
  preferencias: armazenamento.lerPreferencias(),
};

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Avisos na tela
// ---------------------------------------------------------------------------

let temporizadorAviso;
function avisar(texto) {
  const aviso = $('aviso');
  aviso.textContent = texto;
  aviso.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => (aviso.hidden = true), 5000);
}

function mostrar(id, visivel) {
  $(id).hidden = !visivel;
}

// ---------------------------------------------------------------------------
// Acessibilidade
// ---------------------------------------------------------------------------

function aplicarPreferencias() {
  const { fonteGrande, altoContraste, soAcessiveis } = estado.preferencias;
  document.documentElement.classList.toggle('fonte-grande', fonteGrande);
  document.body.classList.toggle('alto-contraste', altoContraste);
  $('btn-fonte').setAttribute('aria-pressed', fonteGrande);
  $('btn-contraste').setAttribute('aria-pressed', altoContraste);
  $('filtro-acessivel').checked = soAcessiveis;
  mapa.ajustarTamanho();
}

function alternarPreferencia(nome) {
  estado.preferencias[nome] = !estado.preferencias[nome];
  armazenamento.salvarPreferencia(nome, estado.preferencias[nome]);
  aplicarPreferencias();
}

// ---------------------------------------------------------------------------
// Busca de pontos e linhas
// ---------------------------------------------------------------------------

function trocarAba(aba) {
  estado.aba = aba;
  document.querySelectorAll('.aba').forEach((botao) => {
    const ativa = botao.dataset.aba === aba;
    botao.classList.toggle('ativa', ativa);
    botao.setAttribute('aria-selected', ativa);
  });
  $('campo-busca').placeholder =
    aba === 'pontos'
      ? 'Nome da rua ou do ponto (ex.: Paulista)'
      : 'Número ou nome da linha (ex.: 8000 ou Lapa)';
  $('btn-localizacao').hidden = aba !== 'pontos';
  $('campo-busca').focus();
}

/** Acrescenta a distância até o usuário e ordena do mais perto ao mais longe. */
function ordenarPorDistancia(pontos) {
  const usuario = estado.posicaoUsuario;
  if (!usuario) return pontos;
  return pontos
    .map((p) => ({ ...p, distancia: distanciaMetros(usuario.lat, usuario.lon, p.py, p.px) }))
    .sort((a, b) => a.distancia - b.distancia);
}

function mostrarResultados() {
  const ehPonto = estado.aba === 'pontos';
  const quantidade = estado.resultados.length;
  $('titulo-resultados').textContent = ehPonto
    ? `${quantidade} ponto(s) encontrado(s)`
    : `${quantidade} linha(s) encontrada(s)`;
  $('lista-resultados').innerHTML = ehPonto
    ? telas.listaPontos(estado.resultados)
    : telas.listaLinhas(estado.resultados);
  mostrar('resultados', true);
}

async function buscar(termo) {
  const botao = document.querySelector('#form-busca button[type="submit"]');
  botao.disabled = true;
  botao.textContent = 'Buscando…';
  try {
    if (estado.aba === 'pontos') {
      estado.resultados = ordenarPorDistancia(await api.buscarPontos(termo));
    } else {
      estado.resultados = await api.buscarLinhas(termo);
    }
    mostrarResultados();
  } catch (erro) {
    avisar(erro.message);
  } finally {
    botao.disabled = false;
    botao.textContent = 'Buscar';
  }
}

function usarLocalizacao() {
  if (!navigator.geolocation) {
    avisar('Seu navegador não permite usar a localização.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      estado.posicaoUsuario = { lat: coords.latitude, lon: coords.longitude };
      mapa.mostrarUsuario(coords.latitude, coords.longitude);
      if (estado.aba === 'pontos' && estado.resultados.length) {
        estado.resultados = ordenarPorDistancia(estado.resultados);
        mostrarResultados();
      }
      avisar('Localização ativada: os pontos agora aparecem do mais perto ao mais longe.');
    },
    () => avisar('Não foi possível obter a sua localização.'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// ---------------------------------------------------------------------------
// Painel do ponto (próximos ônibus)
// ---------------------------------------------------------------------------

function abrirPonto(ponto) {
  estado.ponto = ponto;
  estado.previsoes = { hora: null, linhas: [] };

  $('painel-nome').textContent = ponto.np || `Ponto ${ponto.cp}`;
  $('painel-endereco').textContent = ponto.ed || '';
  $('lista-previsoes').innerHTML = '<li class="vazio">Carregando previsões…</li>';
  atualizarBotaoFavorito();
  mostrar('painel', true);
  mostrar('boas-vindas', false);

  mapa.mostrarPonto(ponto);
  atualizarPrevisoes();
  $('painel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function atualizarPrevisoes() {
  if (!estado.ponto) return;
  const codigo = estado.ponto.cp;
  try {
    const previsoes = await api.buscarPrevisoes(codigo);
    if (estado.ponto?.cp !== codigo) return; // usuário já trocou de ponto
    estado.previsoes = previsoes;
    desenharPrevisoes();
    verificarAlertas();
  } catch (erro) {
    $('painel-status').textContent = 'Falha ao atualizar';
    avisar(erro.message);
  }
}

function desenharPrevisoes() {
  $('lista-previsoes').innerHTML = telas.listaPrevisoes(
    estado.previsoes.linhas,
    estado.previsoes.hora,
    { soAcessiveis: estado.preferencias.soAcessiveis, alertas: estado.alertas }
  );
  atualizarStatus();
}

function atualizarStatus() {
  if (!estado.previsoes.hora) return;
  $('painel-status').textContent =
    `Atualizado às ${estado.previsoes.hora} · próxima em ${estado.segundosParaAtualizar}s`;
}

// ---------------------------------------------------------------------------
// Favoritos
// ---------------------------------------------------------------------------

function atualizarBotaoFavorito() {
  const favorito = estado.ponto && armazenamento.ehFavorito(estado.ponto.cp);
  const botao = $('btn-favorito');
  botao.textContent = favorito ? '★' : '☆';
  botao.setAttribute('aria-pressed', Boolean(favorito));
  botao.title = favorito ? 'Remover dos favoritos' : 'Salvar nos favoritos';
}

function desenharFavoritos() {
  const favoritos = armazenamento.listarFavoritos();
  $('lista-favoritos').innerHTML = telas.listaFavoritos(favoritos);
  mostrar('favoritos', favoritos.length > 0);
}

function alternarFavorito() {
  const ficouFavorito = armazenamento.alternarFavorito(estado.ponto);
  atualizarBotaoFavorito();
  desenharFavoritos();
  avisar(ficouFavorito ? 'Ponto salvo nos favoritos.' : 'Ponto removido dos favoritos.');
}

// ---------------------------------------------------------------------------
// Linha acompanhada no mapa (ônibus em tempo real)
// ---------------------------------------------------------------------------

async function seguirLinha(linha) {
  estado.linha = linha;
  $('linha-nome').textContent = `🚌 ${linha.letreiro}`;
  $('linha-detalhe').textContent = `${linha.detalhe} · carregando ônibus…`;
  mostrar('linha-seguida', true);
  mostrar('boas-vindas', false);

  try {
    const [pontos] = await Promise.all([
      api.buscarPontosDaLinha(linha.cl),
      atualizarOnibus(),
    ]);
    if (estado.linha?.cl !== linha.cl) return;
    mapa.mostrarTrajeto(pontos, abrirPonto);
    mapa.enquadrarLinha();
  } catch (erro) {
    avisar(erro.message);
  }
  // No celular o mapa fica abaixo do painel: rola até ele.
  if (window.matchMedia('(max-width: 799px)').matches) {
    $('mapa').scrollIntoView({ behavior: 'smooth' });
  }
}

async function atualizarOnibus() {
  if (!estado.linha) return;
  const { cl, letreiro, detalhe } = estado.linha;
  try {
    const { hora, veiculos } = await api.buscarPosicoes(cl);
    if (estado.linha?.cl !== cl) return;
    mapa.mostrarOnibus(veiculos, letreiro);
    const acessiveis = veiculos.filter((v) => v.a).length;
    $('linha-detalhe').textContent =
      `${detalhe} · ${veiculos.length} ônibus em circulação, ${acessiveis} acessível(is)` +
      (hora ? ` · posição às ${hora}` : '');
  } catch (erro) {
    avisar(erro.message);
  }
}

function pararDeSeguirLinha() {
  estado.linha = null;
  mapa.limparLinha();
  mostrar('linha-seguida', false);
}

// ---------------------------------------------------------------------------
// Avisos de chegada ("me avise quando faltar 5 minutos")
// ---------------------------------------------------------------------------

function alternarAlerta(cl, letreiro) {
  if (estado.alertas.has(cl)) {
    estado.alertas.delete(cl);
    avisar(`Aviso da linha ${letreiro} cancelado.`);
  } else {
    estado.alertas.set(cl, letreiro);
    avisar(`Vamos avisar quando o ${letreiro} estiver a ${MINUTOS_PARA_ALERTA} min. Mantenha esta página aberta.`);
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
  desenharPrevisoes();
  verificarAlertas();
}

function verificarAlertas() {
  const { hora, linhas } = estado.previsoes;
  if (!hora) return;

  for (const linha of linhas) {
    if (!estado.alertas.has(linha.cl)) continue;
    for (const veiculo of linha.vs ?? []) {
      const minutos = minutosAte(veiculo.t, hora);
      const chave = `${linha.cl}-${veiculo.p}`; // um aviso por veículo
      if (minutos <= MINUTOS_PARA_ALERTA && !estado.avisosJaEnviados.has(chave)) {
        estado.avisosJaEnviados.add(chave);
        notificar(`🚌 ${linha.c} chega em ${minutos <= 1 ? 'instantes' : `${minutos} min`} no ponto ${estado.ponto.np}`);
      }
    }
  }
}

function notificar(texto) {
  avisar(texto);
  navigator.vibrate?.([200, 100, 200]);
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Meu Ponto SP', { body: texto, icon: 'img/icone.svg' });
  }
}

// ---------------------------------------------------------------------------
// Atualização automática
// ---------------------------------------------------------------------------

function iniciarRelogio() {
  setInterval(() => {
    // Economiza dados: não consulta a API com a aba em segundo plano.
    if (document.hidden || (!estado.ponto && !estado.linha)) return;

    estado.segundosParaAtualizar -= 1;
    if (estado.segundosParaAtualizar <= 0) {
      estado.segundosParaAtualizar = INTERVALO_ATUALIZACAO_S;
      atualizarPrevisoes();
      atualizarOnibus();
    }
    atualizarStatus();
  }, 1000);

  // Ao voltar para a aba, atualiza na hora.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) estado.segundosParaAtualizar = 1;
  });
}

// ---------------------------------------------------------------------------
// Eventos da página
// ---------------------------------------------------------------------------

function ligarEventos() {
  $('form-busca').addEventListener('submit', (evento) => {
    evento.preventDefault();
    const termo = $('campo-busca').value.trim();
    if (termo.length >= 2) buscar(termo);
  });

  document.querySelectorAll('.aba').forEach((botao) =>
    botao.addEventListener('click', () => trocarAba(botao.dataset.aba))
  );

  $('btn-localizacao').addEventListener('click', usarLocalizacao);
  $('btn-fonte').addEventListener('click', () => alternarPreferencia('fonteGrande'));
  $('btn-contraste').addEventListener('click', () => alternarPreferencia('altoContraste'));
  $('btn-favorito').addEventListener('click', alternarFavorito);
  $('btn-parar-linha').addEventListener('click', pararDeSeguirLinha);

  $('filtro-acessivel').addEventListener('change', (evento) => {
    estado.preferencias.soAcessiveis = evento.target.checked;
    armazenamento.salvarPreferencia('soAcessiveis', evento.target.checked);
    desenharPrevisoes();
  });

  // Um único "ouvinte" para todos os botões gerados dinamicamente (data-acao).
  document.addEventListener('click', (evento) => {
    const alvo = evento.target.closest('[data-acao], [data-fechar]');
    if (!alvo) return;
    const { acao, indice, cl, letreiro, terminais, cp, fechar } = alvo.dataset;

    if (fechar) return mostrar(fechar, false);

    switch (acao) {
      case 'abrir-ponto':
        abrirPonto(estado.resultados[indice]);
        break;
      case 'abrir-favorito':
        abrirPonto(armazenamento.listarFavoritos().find((p) => String(p.cp) === cp));
        break;
      case 'seguir-linha': {
        const linha = estado.resultados[indice];
        const { letreiro: nome, trajeto } = descreverLinha(linha);
        seguirLinha({ cl: linha.cl, letreiro: nome, detalhe: trajeto });
        break;
      }
      case 'seguir-previsao':
        seguirLinha({ cl: Number(cl), letreiro, detalhe: terminais });
        break;
      case 'alerta':
        alternarAlerta(Number(cl), letreiro);
        break;
    }
  });
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

mapa.iniciarMapa('mapa');
aplicarPreferencias();
desenharFavoritos();
ligarEventos();
iniciarRelogio();
