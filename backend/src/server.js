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

// Inicialização do servidor
server.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`  ProbaBet - Servidor de Apostas em Tempo Real`);
  console.log(`  HTTP Server:      http://localhost:${PORT}`);
  console.log(`  WebSocket Server: ws://localhost:${PORT}`);
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
});

