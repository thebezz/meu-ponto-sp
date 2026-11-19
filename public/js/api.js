/**
 * Funções de acesso à API Olho Vivo.
 * Todas passam pela nossa função serverless em /api/olhovivo, que cuida do
 * token e do cookie de sessão da SPTrans.
 */

async function chamar(rota, parametros = {}) {
  const consulta = new URLSearchParams({ rota, ...parametros });
  const resposta = await fetch(`/api/olhovivo?${consulta}`);
  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    throw new Error(dados?.erro || `Erro ${resposta.status} ao consultar a SPTrans.`);
  }
  return dados;
}

/** Linhas pelo número ou nome. Ex.: "8000" ou "Lapa". */
export async function buscarLinhas(termo) {
  return (await chamar('/Linha/Buscar', { termosBusca: termo })) ?? [];
}

/** Pontos de parada pelo nome ou endereço. Ex.: "Paulista". */
export async function buscarPontos(termo) {
  return (await chamar('/Parada/Buscar', { termosBusca: termo })) ?? [];
}

/** Todos os pontos atendidos por uma linha (código numérico "cl"). */
export async function buscarPontosDaLinha(codigoLinha) {
  return (await chamar('/Parada/BuscarParadasPorLinha', { codigoLinha })) ?? [];
}

/** Posição atual dos ônibus de uma linha: { hr, vs: [...] }. */
export async function buscarPosicoes(codigoLinha) {
  const dados = await chamar('/Posicao/Linha', { codigoLinha });
  return { hora: dados?.hr ?? null, veiculos: dados?.vs ?? [] };
}

/** Previsão de chegada de todas as linhas em um ponto. */
export async function buscarPrevisoes(codigoParada) {
  const dados = await chamar('/Previsao/Parada', { codigoParada });
  return { hora: dados?.hr ?? null, linhas: dados?.p?.l ?? [] };
}
