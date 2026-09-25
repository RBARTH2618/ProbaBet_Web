const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');
const { handleMessage, registerHandler } = require('./messageHandler');
const apostadorService = require('../services/apostadorService');

let wss = null;
const clients = new Map(); // Map<string, { ws, id, ip, connectedAt, apostador }>
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
 * Envia uma mensagem para todas as conexões ativas de um apostador específico.
 * @param {number} apostadorId 
 * @param {string} event 
 * @param {object} payload 
 * @returns {number}
 */
function sendToApostador(apostadorId, event, payload = {}) {
  const targetId = parseInt(apostadorId, 10);
  let sentCount = 0;

  for (const clientInfo of clients.values()) {
    if (clientInfo.apostador?.id_apostador === targetId) {
      if (sendToClient(clientInfo.ws, event, payload)) {
        sentCount++;
      }
    }
  }

  return sentCount;
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

  wss.on('connection', async (ws, req) => {
    const clientId = crypto.randomUUID();
    const clientIp = req.socket.remoteAddress || 'unknown';

    // Parse da query string da URL para vincular o apostador (RF-01)
    let apostadorId = null;
    let nome = null;
    let cpf = null;
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      apostadorId = url.searchParams.get('apostadorId') || url.searchParams.get('userId');
      nome = url.searchParams.get('nome');
      cpf = url.searchParams.get('cpf');
    } catch (e) {
      // Ignora erro de parsing na URL
    }

    // [RF-01] Vincular à sessão do apostador o saldo fictício inicial de R$ 100,00
    const apostador = await apostadorService.getOrCreateSession({
      clientId,
      apostadorId,
      nome,
      cpf
    });

    // Metadados do cliente
    ws.id = clientId;
    ws.apostadorId = apostador.id_apostador;
    ws.isAlive = true;
    
    // Resposta ao pong do heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    const clientInfo = {
      id: clientId,
      ip: clientIp,
      apostador,
      connectedAt: new Date(),
      ws
    };

    clients.set(clientId, clientInfo);
    console.log(`[WebSocket] Cliente conectado [${clientId}] - Apostador: ${apostador.nome_completo} (ID: ${apostador.id_apostador}, Saldo: R$ ${apostador.saldo_ficticio.toFixed(2)}). Total ativos: ${clients.size}`);

    // [RF-01] Atribuição de Saldo Fictício Inicial e confirmação da carteira no handshake
    sendToClient(ws, 'CONNECTION_ESTABLISHED', {
      clientId,
      message: 'Conexão WebSocket com ProbaBet estabelecida com sucesso!',
      apostador: {
        id: apostador.id_apostador,
        nome: apostador.nome_completo,
        cpf: apostador.cpf_usuario,
        saldo: apostador.saldo_ficticio
      },
      saldo: apostador.saldo_ficticio
    });

    // [RF-01] Transmitir evento inicial de confirmação de saldo da carteira
    sendToClient(ws, 'BALANCE_UPDATE', {
      apostadorId: apostador.id_apostador,
      saldo: apostador.saldo_ficticio,
      motivo: 'SALDO_INICIAL'
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
