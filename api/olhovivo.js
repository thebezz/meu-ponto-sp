/**
 * Função serverless (Vercel) que funciona como "ponte" entre o navegador e a
 * API Olho Vivo da SPTrans.
 *
 * Por que ela existe?
 *  1. A API Olho Vivo não libera CORS, então o navegador não consegue chamá-la
 *     diretamente a partir do nosso domínio.
 *  2. A autenticação gera um cookie de sessão que precisa ser reenviado em
 *     todas as chamadas.
 *  3. O token da SPTrans não pode ficar exposto no JavaScript do navegador.
 *
 * Uso pelo front-end:  GET /api/olhovivo?rota=/Previsao/Parada&codigoParada=123
 */

const BASE_URL =
  process.env.OLHOVIVO_BASE_URL || 'https://api.olhovivo.sptrans.com.br/v2.1';

// A sessão da SPTrans expira; renovamos de forma preventiva a cada 10 minutos.
const DURACAO_SESSAO_MS = 10 * 60 * 1000;

// Somente estas rotas (e estes parâmetros) podem ser consultadas pelo app.
const ROTAS_PERMITIDAS = {
  '/Linha/Buscar': ['termosBusca'],
  '/Parada/Buscar': ['termosBusca'],
  '/Parada/BuscarParadasPorLinha': ['codigoLinha'],
  '/Posicao/Linha': ['codigoLinha'],
  '/Previsao/Parada': ['codigoParada'],
  '/Previsao': ['codigoParada', 'codigoLinha'],
  '/Corredor': [],
};

// Tempo (em segundos) que a CDN da Vercel pode guardar cada resposta.
// Buscas mudam pouco; posição e previsão mudam a todo momento.
const CACHE_SEGUNDOS = {
  '/Linha/Buscar': 3600,
  '/Parada/Buscar': 3600,
  '/Parada/BuscarParadasPorLinha': 3600,
  '/Corredor': 86400,
  '/Posicao/Linha': 10,
  '/Previsao/Parada': 10,
  '/Previsao': 10,
};

// Guardada em memória enquanto a função estiver "quente" na Vercel.
let sessao = { cookie: null, criadaEm: 0 };

class ErroApi extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

/** Faz POST /Login/Autenticar e guarda o cookie de sessão devolvido. */
async function autenticar() {
  const token = process.env.SPTRANS_TOKEN;
  if (!token) {
    throw new ErroApi(500, 'Token da SPTrans não configurado (variável SPTRANS_TOKEN).');
  }

  const resposta = await fetch(
    `${BASE_URL}/Login/Autenticar?token=${encodeURIComponent(token)}`,
    { method: 'POST' }
  );
  const autenticado = await resposta.json().catch(() => false);

  if (!resposta.ok || autenticado !== true) {
    throw new ErroApi(502, 'Falha ao autenticar na API Olho Vivo. Confira o token.');
  }

  const cookies =
    typeof resposta.headers.getSetCookie === 'function'
      ? resposta.headers.getSetCookie()
      : [resposta.headers.get('set-cookie')].filter(Boolean);

  // Mantém só "nome=valor" de cada cookie (descarta path, expires etc.).
  sessao = {
    cookie: cookies.map((c) => c.split(';')[0]).join('; '),
    criadaEm: Date.now(),
  };
}

function sessaoValida() {
  return sessao.cookie && Date.now() - sessao.criadaEm < DURACAO_SESSAO_MS;
}

/** Consulta uma rota da API, autenticando antes se necessário. */
async function consultar(rota, parametros, tentativa = 1) {
  if (!sessaoValida()) await autenticar();

  const url = `${BASE_URL}${rota}?${new URLSearchParams(parametros)}`;
  const resposta = await fetch(url, { headers: { Cookie: sessao.cookie } });

  // Sessão expirou antes do previsto: autentica de novo e tenta uma vez mais.
  if (resposta.status === 401 && tentativa === 1) {
    sessao = { cookie: null, criadaEm: 0 };
    return consultar(rota, parametros, 2);
  }
  if (!resposta.ok) {
    throw new ErroApi(502, `A API Olho Vivo respondeu com erro ${resposta.status}.`);
  }
  return resposta.json();
}

/** Lê a rota e os parâmetros da URL e valida contra a lista de permitidos. */
function lerRequisicao(req) {
  const url = new URL(req.url, 'http://localhost');
  const rota = url.searchParams.get('rota');

  if (!Object.hasOwn(ROTAS_PERMITIDAS, rota)) {
    throw new ErroApi(400, 'Rota não permitida.');
  }

  const parametros = {};
  for (const nome of ROTAS_PERMITIDAS[rota]) {
    const valor = (url.searchParams.get(nome) || '').trim();
    if (!valor) throw new ErroApi(400, `Parâmetro obrigatório ausente: ${nome}.`);
    parametros[nome] = valor;
  }
  return { rota, parametros };
}

function enviarJson(res, status, corpo, cacheSegundos = 0) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    cacheSegundos ? `public, s-maxage=${cacheSegundos}` : 'no-store'
  );
  res.end(JSON.stringify(corpo));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return enviarJson(res, 405, { erro: 'Use o método GET.' });
  }
  try {
    const { rota, parametros } = lerRequisicao(req);
    const dados = await consultar(rota, parametros);
    enviarJson(res, 200, dados, CACHE_SEGUNDOS[rota]);
  } catch (erro) {
    const status = erro instanceof ErroApi ? erro.status : 500;
    if (status >= 500) console.error('[olhovivo]', erro);
    enviarJson(res, status, {
      erro: erro instanceof ErroApi ? erro.message : 'Erro inesperado no servidor.',
    });
  }
}
