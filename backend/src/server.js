const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares básicos
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do Frontend (HTML, CSS, JS)
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// Rota de verificação de integridade (Healthcheck)
app.get('/api/health', async (req, res) => {
  const dbStatus = await db.testConnection();
  res.json({
    status: 'OK',
    message: 'Servidor ProbaBet Backend ativo',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus.success ? 'connected' : 'disconnected',
      details: dbStatus.success ? { database: dbStatus.database } : { error: dbStatus.error }
    }
  });
});

// Criação do servidor HTTP unificado
const server = http.createServer(app);

// Inicialização do Servidor WebSocket acoplado ao servidor HTTP
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WebSocket] Novo cliente conectado: ${clientIp}`);

  // Enviar mensagem de boas-vindas / handshake básico
  ws.send(JSON.stringify({
    event: 'CONNECTION_ESTABLISHED',
    message: 'Conectado ao servidor ProbaBet WebSocket com sucesso!',
    timestamp: new Date().toISOString()
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('[WebSocket] Mensagem recebida:', message);
    } catch (err) {
      console.error('[WebSocket] Erro ao processar payload JSON:', err.message);
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket] Cliente desconectado: ${clientIp}`);
  });

  ws.on('error', (err) => {
    console.error(`[WebSocket] Erro na conexão com cliente: ${err.message}`);
  });
});

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
});

