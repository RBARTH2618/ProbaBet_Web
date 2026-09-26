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

// Tratador para consulta de saldo do apostador
registerHandler('GET_BALANCE', async (ws, payload, clientInfo) => {
  const { sendToClient } = require('./index');
  const apostadorService = require('../services/apostadorService');
  const apostadorId = clientInfo.apostador?.id_apostador || 1;
  const saldo = await apostadorService.getSaldo(apostadorId);

  sendToClient(ws, 'BALANCE_UPDATE', {
    apostadorId,
    saldo,
    motivo: 'CONSULTA_SALDO'
  });
});

// Tratador para identificação / troca de usuário na sessão
registerHandler('IDENTIFY', async (ws, payload, clientInfo) => {
  const { sendToClient } = require('./index');
  const apostadorService = require('../services/apostadorService');

  const apostador = await apostadorService.getOrCreateSession({
    clientId: clientInfo.id,
    apostadorId: payload.apostadorId || payload.userId,
    nome: payload.nome,
    cpf: payload.cpf
  });

  clientInfo.apostador = apostador;
  ws.apostadorId = apostador.id_apostador;

  sendToClient(ws, 'BALANCE_UPDATE', {
    apostadorId: apostador.id_apostador,
    saldo: apostador.saldo_ficticio,
    motivo: 'IDENTIFICACAO_CONCLUIDA'
  });
});

// Tratador para consulta de ranking da sessão (RF-08)
registerHandler('GET_RANKING', async (ws, payload, clientInfo) => {
  const { sendToClient } = require('./index');
  const apostadorService = require('../services/apostadorService');
  const ranking = await apostadorService.getRanking();

  sendToClient(ws, 'RANKING_UPDATE', {
    ranking
  });
});

// Tratador para consulta da lista de partidas ao vivo (Etapa 8)
registerHandler('GET_MATCHES', async (ws, payload, clientInfo) => {
  const { sendToClient } = require('./index');
  const matchSimulatorService = require('../services/matchSimulatorService');
  sendToClient(ws, 'MATCHES_LIST', {
    matches: matchSimulatorService.getAllMatches()
  });
});

// Tratador para consulta de cotações das odds de uma partida (RF-02 / Etapa 9)
registerHandler('GET_ODDS', async (ws, payload, clientInfo) => {
  const { sendToClient } = require('./index');
  const oddsEngineService = require('../services/oddsEngineService');
  const matchId = payload.matchId || 1;
  const odds = oddsEngineService.getOddsByMatch(matchId);

  sendToClient(ws, 'ODDS_UPDATE', {
    matchId,
    nomeMercado: '1X2',
    odds: odds ? odds['1X2'] : null,
    timestamp: new Date().toISOString()
  });
});

// [RF-03] Tratador para submissão de aposta (PLACE_BET)
registerHandler('PLACE_BET', async (ws, payload, clientInfo) => {
  const { sendToClient } = require('./index');
  const betService = require('../services/betService');

  const apostadorId = clientInfo.apostador?.id_apostador || 1;

  try {
    const result = await betService.placeBet({
      apostadorId,
      matchId: payload.matchId || payload.idPartida,
      mercadoId: payload.mercadoId || payload.nomeMercado || '1X2',
      selecao: payload.selecao || payload.opcao,
      odd: payload.odd,
      valor: payload.valor
    });

    // Emite comprovante BET_CONFIRMED (RF-03)
    sendToClient(ws, 'BET_CONFIRMED', {
      bet: result.bet,
      novoSaldo: result.novoSaldo,
      message: 'Aposta confirmada com sucesso!'
    });

    // Emite atualização do saldo da carteira (RF-07)
    sendToClient(ws, 'BALANCE_UPDATE', {
      apostadorId,
      saldo: result.novoSaldo,
      motivo: 'APOSTA_REALIZADA'
    });
  } catch (err) {
    console.warn(`[WebSocket] Aposta rejeitada para cliente [${clientInfo.id}]: ${err.message}`);
    sendToClient(ws, 'BET_REJECTED', {
      code: err.code || 'BET_VALIDATION_ERROR',
      message: err.message,
      saldoAtual: err.saldoAtual
    });
  }
});

// Tratador para listar apostas ativas do apostador
registerHandler('GET_ACTIVE_BETS', async (ws, payload, clientInfo) => {
  const { sendToClient } = require('./index');
  const betService = require('../services/betService');
  const apostadorId = clientInfo.apostador?.id_apostador || 1;
  const bets = await betService.getActiveBets(apostadorId);

  sendToClient(ws, 'ACTIVE_BETS_LIST', {
    bets
  });
});

// Tratador para reiniciar as partidas ao vivo (para facilidade de testes)
registerHandler('RESET_MATCHES', async (ws, payload, clientInfo) => {
  const matchSimulatorService = require('../services/matchSimulatorService');
  matchSimulatorService.resetAllMatches();
});

// [RF-05 / RNF-01] Tratador para solicitação de encerramento antecipado (CASH_OUT)
registerHandler('CASH_OUT', async (ws, payload, clientInfo) => {
  const { sendToClient } = require('./index');
  const cashoutService = require('../services/cashoutService');

  const apostadorId = clientInfo.apostador?.id_apostador || ws.apostadorId || 1;
  const betId = payload.betId || payload.idAposta || payload.id_aposta;
  const requestedValue = payload.requestedValue || payload.valorResgate;

  try {
    const result = await cashoutService.processCashOut({
      betId,
      apostadorId,
      requestedValue
    });

    // Emite confirmação oficial de Cash Out (RF-05)
    sendToClient(ws, 'CASH_OUT_CONFIRMED', {
      betId: result.betId,
      valorResgatado: result.valorResgatado,
      novoSaldo: result.novoSaldo,
      timestamp: result.timestamp,
      message: 'Cash Out processado e creditado com sucesso!'
    });

    // Emite atualização do saldo da carteira (RF-07)
    sendToClient(ws, 'BALANCE_UPDATE', {
      apostadorId,
      saldo: result.novoSaldo,
      motivo: 'CASHOUT_REALIZADO'
    });
  } catch (err) {
    console.warn(`[WebSocket] Cash Out rejeitado para cliente [${clientInfo.id}]: ${err.message}`);
    sendToClient(ws, 'CASH_OUT_REJECTED', {
      betId,
      code: err.code || 'CASHOUT_ERROR',
      message: err.message
    });
  }
});

// Tratador para listar ofertas de Cash Out das apostas ativas
registerHandler('GET_CASHOUT_OFFERS', async (ws, payload, clientInfo) => {
  const { sendToClient } = require('./index');
  const betService = require('../services/betService');
  const cashoutService = require('../services/cashoutService');
  const apostadorId = clientInfo.apostador?.id_apostador || ws.apostadorId || 1;

  const bets = await betService.getActiveBets(apostadorId);
  const offers = bets.map(bet => {
    const betId = bet.id_aposta || bet.idAposta;
    return {
      betId,
      matchId: bet.id_partida || bet.matchId,
      cashoutValue: cashoutService.calculateOffer(bet)
    };
  });

  sendToClient(ws, 'CASHOUT_OFFERS_LIST', { offers });
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
