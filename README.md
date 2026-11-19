# 🚌 Meu Ponto SP

Aplicativo web que mostra **em quantos minutos cada ônibus chega no seu ponto** e
**onde os ônibus de uma linha estão agora**, usando os dados em tempo real da
[API Olho Vivo da SPTrans](https://www.sptrans.com.br/desenvolvedores/).

> Global Solution 2026.2 · Application Development · 2º ano de Ciência da Computação (FIAP)
> Área de desafio: *Citizen Intelligence & Predictive Analytics*

**App publicado:** https://meu-ponto-sp.vercel.app

---

## O problema

Quem pega ônibus em São Paulo perde tempo esperando no ponto sem saber se o
ônibus está a 2 ou a 20 minutos. O Meu Ponto SP mostra isso de forma direta,
no celular, e ainda avisa quando é hora de ir para o ponto.

## Funcionalidades

| Funcionalidade | Como funciona | Endpoint usado |
|---|---|---|
| Buscar ponto | Digite o nome da rua e escolha o ponto | `GET /Parada/Buscar` |
| Ponto mais perto | Com a localização ligada, os pontos são ordenados por distância | `GET /Parada/Buscar` + Geolocalização do navegador |
| Painel "próximos ônibus" | Cada linha com os 3 próximos horários, atualizado sozinho a cada 30 s | `GET /Previsao/Parada` |
| Ônibus no mapa, ao vivo | Toque em uma linha para ver os veículos e os pontos dela no mapa | `GET /Posicao/Linha` e `GET /Parada/BuscarParadasPorLinha` |
| Buscar linha | Pelo número (ex.: `8000`) ou bairro (ex.: `Lapa`) | `GET /Linha/Buscar` |
| Aviso de chegada 🔔 | Notifica (e vibra o celular) quando o ônibus estiver a 5 min | `GET /Previsao/Parada` |
| Pontos favoritos ⭐ | Salvos no próprio navegador, para abrir com um toque | — |
| Acessibilidade ♿ | Filtro "só veículos acessíveis", fonte grande (A+) e alto contraste | — |

## Como funciona (arquitetura)

```
Navegador (HTML/CSS/JS)  ──►  /api/olhovivo  (função serverless na Vercel)  ──►  API Olho Vivo
        ▲                           │  • guarda o token em variável de ambiente
        └──────── JSON ◄────────────┘  • faz o login e reaproveita o cookie de sessão
                                       • só permite as rotas que o app usa
```

O navegador **não** chama a SPTrans diretamente porque:

1. a API Olho Vivo não libera CORS (o navegador bloqueia a resposta);
2. o login devolve um cookie de sessão que precisa ir em todas as chamadas;
3. o token não pode ficar visível no código do site.

### Estrutura de pastas

```
├── api/
│   └── olhovivo.js        # função serverless: login, cookie e repasse das consultas
├── public/                # site estático servido pela Vercel
│   ├── index.html
│   ├── css/style.css      # layout mobile first, tema de alto contraste
│   ├── img/icone.svg
│   └── js/
│       ├── app.js         # estado do app, eventos e atualização automática
│       ├── api.js         # funções que chamam /api/olhovivo
│       ├── mapa.js        # mapa Leaflet (ponto, trajeto e ônibus)
│       ├── telas.js       # monta o HTML das listas
│       ├── armazenamento.js # favoritos e preferências (localStorage)
│       └── utils.js       # cálculo de minutos, distância, escape de HTML
├── server.js              # servidor para rodar no computador (sem Vercel)
├── package.json
└── INTEGRANTES.txt
```

Tecnologias: HTML, CSS e JavaScript puro (módulos ES), [Leaflet](https://leafletjs.com/)
para o mapa, OpenStreetMap para os mapas de fundo e uma função Node.js na Vercel.

## Como executar

### 1. Obter o token da SPTrans

1. Crie uma conta em https://www.sptrans.com.br/desenvolvedores/
2. Vá em **Meus Aplicativos → Adicionar novo aplicativo** e copie o token gerado.
   A liberação pode levar algum tempo.

### 2. Rodar no computador

Pré-requisito: [Node.js 20 ou mais novo](https://nodejs.org/).

```bash
git clone https://github.com/thebezz/meu-ponto-sp.git
cd meu-ponto-sp

# macOS / Linux
SPTRANS_TOKEN=seu_token_aqui npm run dev

# Windows (PowerShell)
$env:SPTRANS_TOKEN="seu_token_aqui"; npm run dev
```

Abra http://localhost:3000. Não há dependências para instalar.

### 3. Publicar na Vercel

1. Suba o projeto para um repositório no GitHub.
2. Em [vercel.com](https://vercel.com), faça **Sign Up com GitHub** → **Add New → Project** → importe o repositório.
3. Antes de clicar em **Deploy**, abra **Environment Variables** e crie:
   - **Name:** `SPTRANS_TOKEN`
   - **Value:** o seu token
4. Clique em **Deploy**. Não precisa mudar *Framework Preset* nem *Build Command*:
   a Vercel serve a pasta `public/` e transforma `api/olhovivo.js` em função automaticamente.

> Se fizer o deploy sem a variável, o app abre mas mostra "Token da SPTrans não
> configurado". Basta adicioná-la em **Settings → Environment Variables** e clicar
> em **Redeploy**.

## Créditos

- Dados de transporte: **SPTrans — API Olho Vivo** (crédito também exibido no rodapé do app).
- Mapas: © colaboradores do [OpenStreetMap](https://www.openstreetmap.org/copyright).
- Biblioteca de mapas: [Leaflet](https://leafletjs.com/).

As previsões de chegada são estimativas calculadas pela SPTrans e podem variar.
