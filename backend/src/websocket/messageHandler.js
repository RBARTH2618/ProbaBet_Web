/**
 * Gerenciador e Roteador de Mensagens do WebSocket
 * Responsável por validar os payloads JSON recebidos e rotear para o serviço correto.
 */

const handlers = new Map();

/**
 * Registra uma função tratadora para um tipo de evento específico.
 * @param {string} eventType - Nome do tipo de evento (ex: 'PLACE_BET', 'CASH_OUT', 'PING')
 * @param {Function} handlerFn - Função assíncrona (ws, payload, clientInfo) => Promise<void>
 */
function registerHandler(eventType, handlerFn) {
  handlers.set(eventType, handlerFn);
}

/**
 * Remove um tratador registrado.
 * @param {string} eventType 
 */
function unregisterHandler(eventType) {
  handlers.delete(eventType);
}

// Tratador padrão para PING (Keep-Alive da aplicação)
registerHandler('PING', async (ws, payload, clientInfo) => {
  const { sendToClient } = require('./index');
  sendToClient(ws, 'PONG', {
    message: 'Pong recebido pelo servidor ProbaBet',
    clientTimestamp: payload.timestamp || null,
    serverTimestamp: new Date().toISOString()
  });
});

/**
 * Processa uma mensagem recebida de um cliente WebSocket.
 * @param {WebSocket} ws - Instância do socket do cliente
 * @param {Buffer|string} rawData - Dados brutos recebidos
 * @param {object} clientInfo - Metadados da conexão (id, ip, apostadorId, etc.)
 */
async function handleMessage(ws, rawData, clientInfo) {
  const { sendToClient } = require('./index');

  let message;
  try {
    message = JSON.parse(rawData.toString());
  } catch (err) {
    console.error(`[WebSocket] Erro ao analisar JSON do cliente ${clientInfo.id}:`, err.message);
    sendToClient(ws, 'ERROR', {
      code: 'INVALID_JSON',
      message: 'O payload enviado deve ser um JSON válido.'
    });
    return;
  }

  // O tipo do evento pode vir como message.type ou message.event
  const eventType = message.type || message.event;

  if (!eventType) {
    sendToClient(ws, 'ERROR', {
      code: 'MISSING_EVENT_TYPE',
      message: 'Mensagem sem campo "type" ou "event" obrigatório.'
    });
    return;
  }

  const handler = handlers.get(eventType);

  if (!handler) {
    console.warn(`[WebSocket] Evento não suportado recebido de ${clientInfo.id}: ${eventType}`);
    sendToClient(ws, 'ERROR', {
      code: 'UNKNOWN_EVENT',
      message: `Tipo de evento não suportado: ${eventType}`,
      receivedEvent: eventType
    });
    return;
  }

  try {
    // Executa o handler específico para este evento
    await handler(ws, message, clientInfo);
  } catch (error) {
    console.error(`[WebSocket] Erro no processamento do evento ${eventType}:`, error);
    sendToClient(ws, 'ERROR', {
      code: 'INTERNAL_ERROR',
      message: 'Erro interno ao processar solicitação no servidor.',
      details: error.message
    });
  }
}

module.exports = {
  registerHandler,
  unregisterHandler,
  handleMessage
};
