const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');
const { handleMessage, registerHandler } = require('./messageHandler');

let wss = null;
const clients = new Map(); // Map<string, { ws, id, ip, connectedAt, apostadorId }>
let heartbeatInterval = null;

/**
 * Envia uma mensagem formatada em JSON para um cliente WebSocket específico.
 * @param {WebSocket} ws 
 * @param {string} event 
 * @param {object} payload 
 */
function sendToClient(ws, event, payload = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  const message = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    ...payload
  });

  ws.send(message);
  return true;
}

/**
 * Transmite uma mensagem em broadcast para todos os clientes conectados.
 * @param {string} event - Nome do evento (ex: 'ODDS_UPDATE', 'GOAL')
 * @param {object} payload - Dados a serem enviados
 * @returns {number} Quantidade de clientes que receberam a transmissão
 */
function broadcast(event, payload = {}) {
  if (!wss) return 0;

  const message = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    ...payload
  });

  let sentCount = 0;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    }
  }

  return sentCount;
}

/**
 * Retorna a quantidade atual de clientes conectados ao WebSocket.
 * @returns {number}
 */
function getConnectedClientsCount() {
  return clients.size;
}

/**
 * Inicializa o servidor WebSocket acoplado ao servidor HTTP existente.
 * @param {import('http').Server} httpServer 
 * @returns {WebSocketServer}
 */
function initWebSocketServer(httpServer) {
  wss = new WebSocketServer({ server: httpServer });

  console.log('[WebSocket] Servidor WebSocket inicializado e ouvindo conexões.');

  wss.on('connection', (ws, req) => {
    const clientId = crypto.randomUUID();
    const clientIp = req.socket.remoteAddress || 'unknown';

    // Metadados do cliente
    ws.id = clientId;
    ws.isAlive = true;
    
    // Resposta ao pong do heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    const clientInfo = {
      id: clientId,
      ip: clientIp,
      connectedAt: new Date(),
      ws
    };

    clients.set(clientId, clientInfo);
    console.log(`[WebSocket] Cliente conectado [${clientId}] de ${clientIp}. Total ativos: ${clients.size}`);

    // [RF-01] Mensagem inicial de handshake ao conectar
    sendToClient(ws, 'CONNECTION_ESTABLISHED', {
      clientId,
      message: 'Conexão WebSocket com ProbaBet estabelecida com sucesso!'
    });

    // Recepção e roteamento de mensagens
    ws.on('message', async (data) => {
      await handleMessage(ws, data, clientInfo);
    });

    // Encerramento da conexão
    ws.on('close', (code, reason) => {
      clients.delete(clientId);
      console.log(`[WebSocket] Cliente desconectado [${clientId}]. Código: ${code}. Total ativos: ${clients.size}`);
    });

    // Tratamento de erros do socket
    ws.on('error', (err) => {
      console.error(`[WebSocket] Erro na conexão do cliente [${clientId}]:`, err.message);
    });
  });

  // Intervalo de Heartbeat (Ping/Pong) a cada 30 segundos para evitar conexões mortas (zombies)
  heartbeatInterval = setInterval(() => {
    if (!wss) return;

    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        console.warn(`[WebSocket] Encerrando conexão inativa de cliente: ${ws.id}`);
        clients.delete(ws.id);
        ws.terminate();
        continue;
      }

      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}

module.exports = {
  initWebSocketServer,
  sendToClient,
  broadcast,
  getConnectedClientsCount,
  registerHandler
};
