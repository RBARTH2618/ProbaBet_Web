const EventEmitter = require('events');
const db = require('../database');
const TransacaoCashout = require('../models/TransacaoCashout');
const BilheteAposta = require('../models/BilheteAposta');
const betService = require('./betService');
const apostadorService = require('./apostadorService');
const oddsEngineService = require('./oddsEngineService');
const matchSimulatorService = require('./matchSimulatorService');

// Trava atômica em memória para prevenção de concorrência simultânea (RNF-01)
const activeLocks = new Set();

// Cache em memória de ofertas de Cash Out ativas
const activeOffers = new Map(); // Map<betId, number>

class CashoutService extends EventEmitter {
  constructor() {
    super();
    this.houseMargin = 0.95; // Margem da casa de 5% no encerramento antecipado
  }

  /**
   * Conecta o motor de Cash Out aos eventos de atualização de Odds e Partidas
   */
  bindEvents() {
    // A cada atualização de cotação das odds, recalcula o Cash Out das apostas ativas (RF-04)
    oddsEngineService.on('odds_updated', async ({ matchId }) => {
      await this.recalculateCashoutsForMatch(matchId);
    });

    // Quando uma nova aposta for submetida, calcula imediatamente a oferta de Cash Out
    betService.on('bet_placed', async (bet) => {
      const matchId = bet.matchId || bet.id_partida;
      if (matchId) {
        await this.recalculateCashoutsForMatch(matchId);
      }
    });

    console.log('[Cash Out] Motor de Cash Out conectado aos eventos de Odds e Apostas.');
  }

  /**
   * Calcula a oferta instantânea de Cash Out para um bilhete de aposta (RF-04)
   * Fórmula: Cash Out = (Retorno Potencial / Odd Atual) * Margem da Casa
   * @param {object} bet 
   * @returns {number} Valor de resgate em reais
   */
  calculateOffer(bet) {
    const matchId = bet.matchId || bet.id_partida;
    const mercado = bet.mercado || bet.nome_mercado || '1X2';
    const selecao = bet.selecao || bet.opcao_selecao || 'CASA';
    const oddMomento = bet.oddMomento || bet.odd_momento;
    const oddAtual = oddsEngineService.getSpecificOdd(matchId, mercado, selecao) || oddMomento;

    const retornoPotencial = bet.retornoPotencial || bet.retorno_potencial || ((bet.valorApostado || bet.valor_apostado) * oddMomento);
    const valorApostado = bet.valorApostado || bet.valor_apostado;

    // Se a odd atual caiu muito (time vencendo), o valor de resgate é alto (lucro antecipado)
    // Se a odd atual subiu (time perdendo), o valor de resgate é baixo (resgate parcial de perda)
    let rawValue = (retornoPotencial / Math.max(1.01, oddAtual)) * this.houseMargin;

    // Limites de segurança
    const maxVal = retornoPotencial * 0.98;
    const minVal = valorApostado * 0.05;

    const finalValue = Math.min(maxVal, Math.max(minVal, rawValue));
    return parseFloat(finalValue.toFixed(2));
  }

  /**
   * Recalcula e transmite via WebSocket as novas ofertas de Cash Out para uma partida (RF-04)
   * @param {number} matchId 
   */
  async recalculateCashoutsForMatch(matchId) {
    const { sendToApostador } = require('../websocket');
    
    // Busca apostas ativas
    let activeBets = [];
    try {
      activeBets = await BilheteAposta.findActiveByPartida(matchId);
    } catch (e) {
      // Se banco offline, consulta memória do betService
    }

    // Complementa com apostas ativas em memória
    try {
      const memBets = await betService.getActiveBets(1);
      for (const mb of memBets) {
        const mId = mb.matchId || mb.id_partida;
        const bId = mb.id_aposta || mb.idAposta;
        if (mId === matchId && !activeBets.some(b => (b.id_aposta || b.idAposta) === bId)) {
          activeBets.push(mb);
        }
      }
    } catch (memErr) {}

    for (const bet of activeBets) {
      const betId = bet.idAposta || bet.id_aposta;
      const apostadorId = bet.idApostador || bet.id_apostador;
      const cashoutValue = this.calculateOffer(bet);

      activeOffers.set(betId, cashoutValue);

      // Transmite a nova cotação de resgate para o dono da aposta via WebSocket
      if (typeof sendToApostador === 'function') {
        sendToApostador(apostadorId, 'CASHOUT_UPDATE', {
          betId,
          matchId,
          cashoutValue,
          statusAposta: 'ATIVA',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Processa uma solicitação de CASH_OUT garantindo trava atômica contra Race Condition (RF-05 / RNF-01)
   * @param {object} params
   * @param {number} params.betId - ID do bilhete
   * @param {number} params.apostadorId - ID do apostador que solicitou
   * @param {number} [params.requestedValue] - Valor esperado pelo cliente
   * @returns {Promise<{ betId: number, valorResgatado: number, novoSaldo: number }>}
   */
  async processCashOut({ betId, apostadorId, requestedValue }) {
    const idAposta = parseInt(betId, 10);
    const idApostador = parseInt(apostadorId, 10);

    // [RNF-01] PREVENÇÃO DE CONCORRÊNCIA: Trava atômica por aposta
    if (activeLocks.has(idAposta)) {
      const err = new Error('Operação de Cash Out já em processamento para este bilhete (RNF-01).');
      err.code = 'CASHOUT_LOCKED';
      throw err;
    }

    // Adquire a trava atômica
    activeLocks.add(idAposta);

    try {
      // 1. Busca a aposta e valida se existe
      const bet = await betService.getBetById(idAposta);
      if (!bet) {
        const err = new Error(`Bilhete de aposta #${idAposta} não encontrado.`);
        err.code = 'BET_NOT_FOUND';
        throw err;
      }

      // Valida propriedade da aposta
      if ((bet.idApostador || bet.id_apostador) !== idApostador) {
        const err = new Error('Acesso negado: Este bilhete de aposta pertence a outro usuário.');
        err.code = 'FORBIDDEN';
        throw err;
      }

      // 2. Valida se a aposta ainda está ATIVA (impede pagamento duplicado - RNF-01)
      const statusAtual = bet.status || bet.status_aposta;
      if (statusAtual !== 'ATIVA') {
        const err = new Error(`Operação rejeitada: A aposta #${idAposta} não está mais ativa (Status: ${statusAtual}).`);
        err.code = 'ALREADY_SETTLED';
        throw err;
      }

      // 3. Valida situação da partida (Prevenção de Race Condition no momento do Gol - RNF-01)
      const matchId = bet.matchId || bet.id_partida;
      const match = matchSimulatorService.getMatchById(matchId);
      if (match) {
        if (match.status_partida === 'SUSPENSA') {
          const err = new Error('Cash Out temporariamente suspenso devido a evento decisivo (Gol) no jogo (RNF-01).');
          err.code = 'MARKET_SUSPENDED';
          throw err;
        }
        if (match.status_partida === 'ENCERRADA') {
          const err = new Error('A partida já foi encerrada. O bilhete será avaliado na liquidação final.');
          err.code = 'MATCH_CLOSED';
          throw err;
        }
      }

      // 4. Calcula o valor de resgate justo no exato instante
      const valorCalculado = this.calculateOffer(bet);
      const valorResgate = requestedValue ? parseFloat(requestedValue) : valorCalculado;

      let novoSaldo;

      // 5. Execução Atômica: Encerramento do bilhete + Registro de Cashout + Crédito do Saldo
      try {
        const client = await db.getClient();
        try {
          await client.query('BEGIN');

          // Atualiza status da aposta para CASH_OUT
          await BilheteAposta.updateStatus(idAposta, 'CASH_OUT', client);

          // Registra na tabela transacao_cashout (a restrição UNIQUE garante no banco a unicidade 1:1)
          await TransacaoCashout.create({
            idAposta,
            valorResgateOferecido: valorCalculado,
            valorResgatado: valorResgate
          }, client);

          // Credita o valor resgatado no saldo do apostador
          novoSaldo = await apostadorService.creditarSaldo(idApostador, valorResgate, client);

          await client.query('COMMIT');
        } catch (sqlErr) {
          await client.query('ROLLBACK');
          throw sqlErr;
        } finally {
          client.release();
        }
      } catch (dbErr) {
        // Fallback resiliente em memória caso o banco de dados esteja offline
        await betService.updateBetStatus(idAposta, 'CASH_OUT');
        novoSaldo = await apostadorService.creditarSaldo(idApostador, valorResgate);
      }

      // Remove da lista de ofertas ativas
      activeOffers.delete(idAposta);

      console.log(`[Cash Out] 💰 Cash Out confirmado para o bilhete #${idAposta}! Resgate: R$ ${valorResgate.toFixed(2)}. Novo saldo: R$ ${novoSaldo.toFixed(2)}`);

      const result = {
        betId: idAposta,
        valorResgatado: valorResgate,
        novoSaldo,
        timestamp: new Date().toISOString()
      };

      this.emit('cashout_executed', result);
      return result;
    } finally {
      // Libera a trava atômica
      activeLocks.delete(idAposta);
    }
  }

  /**
   * Retorna a oferta de Cash Out atual para um bilhete
   * @param {number} betId 
   * @returns {number|null}
   */
  getOffer(betId) {
    return activeOffers.get(parseInt(betId, 10)) || null;
  }
}

module.exports = new CashoutService();
