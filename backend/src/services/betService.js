const EventEmitter = require('events');
const db = require('../database');
const BilheteAposta = require('../models/BilheteAposta');
const apostadorService = require('./apostadorService');
const matchSimulatorService = require('./matchSimulatorService');
const oddsEngineService = require('./oddsEngineService');

// Armazenamento em memória para modo offline resiliente
const memoryBets = new Map();
let nextBetId = 1001;

class BetService extends EventEmitter {
  /**
   * Submete e valida uma aposta esportiva (RF-03).
   * Executa validações de saldo, mercado ativo e débito atômico (RNF-02).
   * @param {object} dados
   * @param {number} dados.apostadorId - ID do apostador
   * @param {number} dados.matchId - ID da partida
   * @param {string} [dados.mercadoId='1X2'] - Nome do mercado ('1X2', 'PROXIMO_GOL', etc.)
   * @param {string} dados.selecao - Opção selecionada ('CASA', 'EMPATE', 'FORA')
   * @param {number} dados.odd - Cotação aceita no momento da aposta
   * @param {number} dados.valor - Valor em reais da aposta
   * @returns {Promise<{ bet: object, novoSaldo: number }>}
   */
  async placeBet({ apostadorId, matchId, mercadoId = '1X2', selecao, odd, valor }) {
    const idApostador = parseInt(apostadorId, 10);
    const idPartida = parseInt(matchId, 10);
    const valorApostado = parseFloat(valor);
    const oddMomento = parseFloat(odd);

    // 1. Validação de dados básicos
    if (isNaN(valorApostado) || valorApostado <= 0) {
      const err = new Error('Valor da aposta inválido. O valor deve ser maior que zero.');
      err.code = 'INVALID_AMOUNT';
      throw err;
    }

    if (isNaN(oddMomento) || oddMomento < 1.01) {
      const err = new Error('Cotação (Odd) inválida. O valor deve ser maior ou igual a 1.01.');
      err.code = 'INVALID_ODD';
      throw err;
    }

    if (!selecao) {
      const err = new Error('Opção de seleção (CASA, EMPATE, FORA) é obrigatória.');
      err.code = 'MISSING_SELECTION';
      throw err;
    }

    // 2. Validação da Partida (deve estar AO_VIVO)
    const match = matchSimulatorService.getMatchById(idPartida);
    if (!match) {
      const err = new Error(`Partida com ID ${idPartida} não encontrada.`);
      err.code = 'MATCH_NOT_FOUND';
      throw err;
    }

    if (match.status_partida === 'ENCERRADA') {
      const err = new Error('Não é possível apostar em uma partida já encerrada.');
      err.code = 'MATCH_CLOSED';
      throw err;
    }

    if (match.status_partida === 'SUSPENSA') {
      const err = new Error('Mercado temporariamente suspenso devido a evento decisivo no jogo (RF-06).');
      err.code = 'MARKET_SUSPENDED';
      throw err;
    }

    // 3. Validação de Saldo Suficiente (RNF-02)
    const saldoAtual = await apostadorService.getSaldo(idApostador);
    if (saldoAtual < valorApostado) {
      const err = new Error(`Saldo insuficiente para realizar a aposta. Saldo atual: R$ ${saldoAtual.toFixed(2)}, valor solicitado: R$ ${valorApostado.toFixed(2)}.`);
      err.code = 'INSUFFICIENT_FUNDS';
      err.saldoAtual = saldoAtual;
      throw err;
    }

    // 4. Cálculo do Retorno Potencial: valor x odd
    const retornoPotencial = parseFloat((valorApostado * oddMomento).toFixed(2));

    // Determina o id_mercado correto
    const currentMarketOdds = oddsEngineService.getOddsByMatch(idPartida);
    let idMercadoRef = 1;
    if (currentMarketOdds && currentMarketOdds[mercadoId] && currentMarketOdds[mercadoId][selecao]) {
      idMercadoRef = currentMarketOdds[mercadoId][selecao].id_mercado || 1;
    }

    // 5. Débito Atômico e Registro do Bilhete
    let novoSaldo;
    let betRecord;

    // Tentar executar via transação ACID no PostgreSQL se disponível
    try {
      const client = await db.getClient();
      try {
        await client.query('BEGIN');

        // Débito atômico garantindo não-negatividade (RNF-02)
        novoSaldo = await apostadorService.debitarSaldo(idApostador, valorApostado, client);

        // Inserção do bilhete no banco
        betRecord = await BilheteAposta.create({
          idApostador,
          idMercado: idMercadoRef,
          valorApostado,
          oddMomento,
          retornoPotencial,
          statusAposta: 'ATIVA'
        }, client);

        await client.query('COMMIT');
      } catch (sqlErr) {
        await client.query('ROLLBACK');
        throw sqlErr;
      } finally {
        client.release();
      }
    } catch (dbErr) {
      // Fallback em memória caso o banco de dados esteja offline
      novoSaldo = await apostadorService.debitarSaldo(idApostador, valorApostado);
      
      const betId = nextBetId++;
      betRecord = {
        id_aposta: betId,
        id_apostador: idApostador,
        id_mercado: idMercadoRef,
        valor_apostado: valorApostado,
        odd_momento: oddMomento,
        retorno_potencial: retornoPotencial,
        status_aposta: 'ATIVA',
        data_hora_aposta: new Date()
      };
      memoryBets.set(betId, betRecord);
    }

    // Complementa dados descritivos para resposta
    const formattedBet = {
      idAposta: betRecord.id_aposta,
      idApostador,
      matchId: idPartida,
      partidaNome: `${match.time_casa} x ${match.time_fora}`,
      mercado: mercadoId,
      selecao,
      valorApostado,
      oddMomento,
      retornoPotencial,
      status: betRecord.status_aposta,
      dataHora: betRecord.data_hora_aposta || new Date().toISOString()
    };

    // Emite evento interno de aposta realizada (para o módulo de Cash Out na Etapa 11)
    this.emit('bet_placed', formattedBet);

    console.log(`[Apostas] ✅ Bilhete #${formattedBet.idAposta} confirmado para Apostador ${idApostador}: R$ ${valorApostado.toFixed(2)} @ ${oddMomento} (${selecao}). Novo saldo: R$ ${novoSaldo.toFixed(2)}`);

    return {
      bet: formattedBet,
      novoSaldo
    };
  }

  /**
   * Retorna as apostas ativas de um apostador
   * @param {number} apostadorId 
   * @returns {Promise<Array<object>>}
   */
  async getActiveBets(apostadorId) {
    const id = parseInt(apostadorId, 10);

    try {
      const dbBets = await BilheteAposta.findActiveByApostador(id);
      if (dbBets && dbBets.length > 0) return dbBets;
    } catch (e) {
      // Falha de banco, usa memória
    }

    return Array.from(memoryBets.values())
      .filter(b => b.id_apostador === id && b.status_aposta === 'ATIVA')
      .map(b => ({
        id_aposta: b.id_aposta,
        id_apostador: b.id_apostador,
        valor_apostado: b.valor_apostado,
        odd_momento: b.odd_momento,
        retorno_potencial: b.retorno_potencial,
        status_aposta: b.status_aposta,
        data_hora_aposta: b.data_hora_aposta
      }));
  }

  /**
   * Atualiza o status de uma aposta (ex: CASH_OUT, GREEN, RED)
   * @param {number} betId 
   * @param {string} status 
   */
  async updateBetStatus(betId, status) {
    try {
      await BilheteAposta.updateStatus(betId, status);
    } catch (e) {
      // Ignora erro se banco offline
    }

    const memBet = memoryBets.get(parseInt(betId, 10));
    if (memBet) {
      memBet.status_aposta = status;
    }
  }

  /**
   * Busca um bilhete de aposta por ID
   * @param {number} betId 
   * @returns {Promise<object|null>}
   */
  async getBetById(betId) {
    try {
      const dbBet = await BilheteAposta.findById(betId);
      if (dbBet) return dbBet;
    } catch (e) {
      // Fallback memória
    }
    return memoryBets.get(parseInt(betId, 10)) || null;
  }
}

module.exports = new BetService();
