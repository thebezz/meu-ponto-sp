/**
 * Servidor para rodar o projeto no computador, sem precisar da Vercel.
 * Serve os arquivos da pasta public/ e encaminha /api/olhovivo para a mesma
 * função usada em produção.
 *
 * Uso:  SPTRANS_TOKEN=seu_token npm run dev   →  http://localhost:3000
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from './api/olhovivo.js';

const PORTA = process.env.PORT || 3000;
const PASTA_PUBLICA = join(fileURLToPath(new URL('.', import.meta.url)), 'public');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

async function servirArquivo(req, res) {
  const caminho = new URL(req.url, 'http://localhost').pathname;
  const relativo = normalize(caminho === '/' ? '/index.html' : caminho);
  const arquivo = join(PASTA_PUBLICA, relativo);

  // Impede acessar arquivos fora da pasta public/ (ex.: /../server.js).
  if (!arquivo.startsWith(PASTA_PUBLICA)) {
    res.statusCode = 403;
    return res.end('Proibido');
  }
  try {
    const conteudo = await readFile(arquivo);
    res.setHeader('Content-Type', TIPOS[extname(arquivo)] || 'application/octet-stream');
    res.end(conteudo);
  } catch {
    res.statusCode = 404;
    res.end('Não encontrado');
  }
}

createServer((req, res) => {
  if (req.url.startsWith('/api/olhovivo')) return handler(req, res);
  return servirArquivo(req, res);
}).listen(PORTA, () => {
  console.log(`Meu Ponto SP rodando em http://localhost:${PORTA}`);
  if (!process.env.SPTRANS_TOKEN) {
    console.warn('Atenção: variável SPTRANS_TOKEN não definida — a API vai responder erro.');
  }
});
