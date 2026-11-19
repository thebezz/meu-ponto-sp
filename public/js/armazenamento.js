/**
 * Favoritos e preferências salvos no navegador (localStorage).
 * O try/catch evita erro em navegadores que bloqueiam o armazenamento
 * (ex.: aba anônima em alguns celulares).
 */

const CHAVE_FAVORITOS = 'meuPonto.favoritos';
const CHAVE_PREFERENCIAS = 'meuPonto.preferencias';

function ler(chave, padrao) {
  try {
    return JSON.parse(localStorage.getItem(chave)) ?? padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem armazenamento disponível: o app segue funcionando sem salvar */
  }
}

// ---------- Favoritos: lista de pontos { cp, np, ed, py, px } ----------

export function listarFavoritos() {
  return ler(CHAVE_FAVORITOS, []);
}

export function ehFavorito(codigoParada) {
  return listarFavoritos().some((p) => p.cp === codigoParada);
}

/** Adiciona ou remove o ponto. Devolve true se ele ficou nos favoritos. */
export function alternarFavorito(ponto) {
  const favoritos = listarFavoritos();
  const indice = favoritos.findIndex((p) => p.cp === ponto.cp);

  if (indice >= 0) {
    favoritos.splice(indice, 1);
  } else {
    const { cp, np, ed, py, px } = ponto;
    favoritos.push({ cp, np, ed, py, px });
  }
  gravar(CHAVE_FAVORITOS, favoritos);
  return indice < 0;
}

// ---------- Preferências de acessibilidade e filtro ----------

const PREFERENCIAS_PADRAO = { fonteGrande: false, altoContraste: false, soAcessiveis: false };

export function lerPreferencias() {
  return { ...PREFERENCIAS_PADRAO, ...ler(CHAVE_PREFERENCIAS, {}) };
}

export function salvarPreferencia(nome, valor) {
  gravar(CHAVE_PREFERENCIAS, { ...lerPreferencias(), [nome]: valor });
}
