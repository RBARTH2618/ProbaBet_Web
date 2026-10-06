const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('./database');
const { initWebSocketServer, getConnectedClientsCount } = require('./websocket');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares básicos
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do Frontend (HTML, CSS, JS)
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// Rota raiz garantindo carregamento de tela1-odds.html
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'tela1-odds.html'));
});

// Evitar erro 404 de favicon no navegador
app.get('/favicon.ico', (req, res) => res.status(204).end());

const matchSimulatorService = require('./services/matchSimulatorService');

// Rota de verificação de integridade (Healthcheck)
app.get('/api/health', async (req, res) => {
  const dbStatus = await db.testConnection();
  res.json({
    status: 'OK',
    message: 'Servidor ProbaBet Backend ativo',
    timestamp: new Date().toISOString(),
    websocket: {
      status: 'active',
      connectedClients: getConnectedClientsCount()
    },
    simulator: {
      status: matchSimulatorService.isRunning ? 'running' : 'stopped',
      activeMatches: matchSimulatorService.getAllMatches().length
    },
    database: {
      status: dbStatus.success ? 'connected' : 'disconnected',
      details: dbStatus.success ? { database: dbStatus.database } : { error: dbStatus.error }
    }
  });
});

// Criação do servidor HTTP unificado
const server = http.createServer(app);

// Inicialização do Servidor WebSocket modular acoplado ao servidor HTTP
const wss = initWebSocketServer(server);

// Inicialização do servidor com binding em 0.0.0.0 para compatibilidade em nuvem (Render)
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`====================================================`);
  console.log(`  ProbaBet - Servidor de Apostas em Tempo Real`);
  console.log(`  HTTP Server:      http://0.0.0.0:${PORT}`);
  console.log(`  WebSocket Server: ws://0.0.0.0:${PORT}`);
  console.log(`====================================================`);

  // Verificação de conectividade com PostgreSQL no startup
  const dbStatus = await db.testConnection();
  if (dbStatus.success) {
    console.log(`[PostgreSQL] Conectado ao banco "${dbStatus.database}" com sucesso.`);
  } else {
    console.warn(`[PostgreSQL] Aviso: Conexão pendente ou banco offline (${dbStatus.error}).`);
    console.warn(`[PostgreSQL] O servidor HTTP/WebSocket continua ativo.`);
  }

  // [ETAPA 8] Inicialização do Motor de Simulação da Partida
  await matchSimulatorService.loadMatchesFromDatabase();
  matchSimulatorService.startSimulation();

  // [ETAPA 9] Conectar o Motor de Odds ao Simulador para transmissão dinâmica de ODDS_UPDATE
  const oddsEngineService = require('./services/oddsEngineService');
  oddsEngineService.bindToSimulator(matchSimulatorService);

  // [ETAPA 11] Conectar o Motor de Cash Out aos eventos de Odds e Apostas
  const cashoutService = require('./services/cashoutService');
  cashoutService.bindEvents();

  // [ETAPA 13] Conectar o Motor de Liquidação Automática de Apostas (RF-07)
  const settlementService = require('./services/settlementService');
  settlementService.bindEvents();
});

