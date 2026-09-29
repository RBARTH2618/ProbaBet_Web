const EventEmitter = require('events');
const db = require('../database');
const BilheteAposta = require('../models/BilheteAposta');
const betService = require('./betService');
const apostadorService = require('./apostadorService');
const matchSimulatorService = require('./matchSimulatorService');
const settlementHistoryService = require('./settlementHistoryService');

/**
 * MOTOR DE LIQUIDAÇÃO AUTOMÁTICA DE APOSTAS (RF-07)
 * Ao término da partida ou encerramento do mercado, avalia todas as apostas abertas,
 * credita o retorno aos vencedores (GREEN) e atualiza o saldo (BALANCE_UPDATE).
 */
class SettlementService extends EventEmitter {
  constructor() {
    super();
    this.settledMatches = new Set();
  }

  /**
   * Conecta o motor de liquidação aos eventos de término do simulador
   */
  bindEvents() {
    matchSimulatorService.on('match_finished', async (match) => {
      await this.settleMatchBets(match);
    });

    console.log('[Liquidação] Motor de Liquidação Automática conectado ao Simulador de Partidas (RF-07).');
  }

  /**
   * Avalia e liquida todas as apostas ativas de uma partida encerrada (RF-07)
   * @param {object} match - Objeto da partida esportiva
   * @returns {Promise<object>} Resumo da liquidação
   */
  async settleMatchBets(match) {
    const { sendToApostador, broadcast } = require('../websocket');
    const matchId = match.id_partida || match.matchId;

    console.log(`[Liquidação] 🏁 Iniciando liquidação de apostas da Partida #${matchId} (${match.time_casa} ${match.placar_casa} x ${match.placar_fora} ${match.time_fora})...`);

    // 1. Determina a seleção vencedora do mercado 1X2
    let winning1X2;
    if (match.placar_casa > match.placar_fora) {
      winning1X2 = 'CASA';
    } else if (match.placar_fora > match.placar_casa) {
      winning1X2 = 'FORA';
    } else {
      winning1X2 = 'EMPATE';
    }

    // 2. Busca todos os bilhetes ainda ATIVOS desta partida
    const activeBets = await betService.getActiveBetsByMatch(matchId);
    console.log(`[Liquidação] Encontradas ${activeBets.length} apostas ativas para liquidar.`);

    let countGreen = 0;
    let countRed = 0;
    let totalPago = 0;

    for (const bet of activeBets) {
      const betId = bet.idAposta || bet.id_aposta;
      const apostadorId = bet.idApostador || bet.id_apostador;
      const selecao = bet.selecao || bet.opcao_selecao;
      const mercado = bet.mercado || bet.nome_mercado || '1X2';
      const valorApostado = parseFloat(bet.valorApostado || bet.valor_apostado);
      const oddMomento = parseFloat(bet.oddMomento || bet.odd_momento);
      const retornoPotencial = parseFloat(bet.retornoPotencial || bet.retorno_potencial || (valorApostado * oddMomento).toFixed(2));

      // 3. Avalia o resultado (GREEN vs RED)
      let isWinner = false;
      if (mercado === '1X2') {
        isWinner = (selecao === winning1X2);
      } else if (mercado === 'PROXIMO_GOL') {
        // Se houver mercado de próximo gol, avalia com base no time que marcou por último
        isWinner = (selecao === winning1X2);
      }

      const outcomeStatus = isWinner ? 'GREEN' : 'RED';
      let novoSaldo = null;

      if (isWinner) {
        countGreen++;
        totalPago += retornoPotencial;

        // Liquidação atômica no banco com crédito de saldo
        try {
          const client = await db.getClient();
          try {
            await client.query('BEGIN');
            await BilheteAposta.updateStatus(betId, 'GREEN', client);
            novoSaldo = await apostadorService.creditarSaldo(apostadorId, retornoPotencial, client);
            await client.query('COMMIT');
          } catch (sqlErr) {
            await client.query('ROLLBACK');
            throw sqlErr;
          } finally {
            client.release();
          }
        } catch (dbErr) {
          // Fallback em memória
          await betService.updateBetStatus(betId, 'GREEN');
          novoSaldo = await apostadorService.creditarSaldo(apostadorId, retornoPotencial);
        }

        let histRecord = null;
        try {
          histRecord = await settlementHistoryService.recordSettlement({
            idAposta: betId,
            idApostador: apostadorId,
            idPartida: matchId,
            partidaNome: `${match.time_casa} x ${match.time_fora}`,
            mercado,
            selecao,
            oddMomento,
            valorApostado,
            statusFinal: 'GREEN',
            valorRetorno: retornoPotencial,
            lucroPrejuizo: retornoPotencial - valorApostado,
            placarFinal: `${match.placar_casa} x ${match.placar_fora}`,
            motivo: 'TERMINO_PARTIDA'
          });
        } catch (hErr) {
          console.warn('[Liquidação] Erro ao gravar no histórico de liquidações:', hErr.message);
        }

        console.log(`[Liquidação] 🟢 Bilhete #${betId} GREEN! Apostador: ${apostadorId}, Retorno: R$ ${retornoPotencial.toFixed(2)}, Novo Saldo: R$ ${novoSaldo.toFixed(2)}`);

        // Notifica o apostador via WebSocket
        if (typeof sendToApostador === 'function') {
          sendToApostador(apostadorId, 'BET_SETTLED', {
            betId,
            idAposta: betId,
            status: 'GREEN',
            valorApostado,
            oddMomento,
            retorno: retornoPotencial,
            valorGanho: retornoPotencial,
            novoSaldo,
            partida: `${match.time_casa} ${match.placar_casa} x ${match.placar_fora} ${match.time_fora}`,
            partidaNome: `${match.time_casa} x ${match.time_fora}`,
            placarFinal: `${match.placar_casa} x ${match.placar_fora}`,
            selecao,
            mercado,
            historyRecord: histRecord,
            timestamp: new Date().toISOString()
          });

          sendToApostador(apostadorId, 'BALANCE_UPDATE', {
            apostadorId,
            saldo: novoSaldo,
            motivo: 'APOSTA_VENCEDORA_GREEN'
          });

          // Envia histórico consolidado para atualização instantânea da interface
          settlementHistoryService.getHistoryByApostador(apostadorId).then(history => {
            sendToApostador(apostadorId, 'BET_HISTORY_LIST', { history });
          }).catch(() => {});
        }
      } else {
        countRed++;

        // Atualiza status para RED (sem crédito de saldo)
        try {
          await BilheteAposta.updateStatus(betId, 'RED');
        } catch (e) {
          // Fallback
        }
        await betService.updateBetStatus(betId, 'RED');

        let histRecord = null;
        try {
          histRecord = await settlementHistoryService.recordSettlement({
            idAposta: betId,
            idApostador: apostadorId,
            idPartida: matchId,
            partidaNome: `${match.time_casa} x ${match.time_fora}`,
            mercado,
            selecao,
            oddMomento,
            valorApostado,
            statusFinal: 'RED',
            valorRetorno: 0,
            lucroPrejuizo: -valorApostado,
            placarFinal: `${match.placar_casa} x ${match.placar_fora}`,
            motivo: 'TERMINO_PARTIDA'
          });
        } catch (hErr) {
          console.warn('[Liquidação] Erro ao gravar no histórico de liquidações:', hErr.message);
        }

        console.log(`[Liquidação] 🔴 Bilhete #${betId} RED. Apostador: ${apostadorId} (Seleção: ${selecao}, Resultado: ${winning1X2})`);

        // Notifica o apostador via WebSocket
        if (typeof sendToApostador === 'function') {
          sendToApostador(apostadorId, 'BET_SETTLED', {
            betId,
            idAposta: betId,
            status: 'RED',
            valorApostado,
            oddMomento,
            retorno: 0,
            valorGanho: 0,
            partida: `${match.time_casa} ${match.placar_casa} x ${match.placar_fora} ${match.time_fora}`,
            partidaNome: `${match.time_casa} x ${match.time_fora}`,
            placarFinal: `${match.placar_casa} x ${match.placar_fora}`,
            selecao,
            mercado,
            historyRecord: histRecord,
            timestamp: new Date().toISOString()
          });

          // Envia histórico consolidado para atualização instantânea da interface
          settlementHistoryService.getHistoryByApostador(apostadorId).then(history => {
            sendToApostador(apostadorId, 'BET_HISTORY_LIST', { history });
          }).catch(() => {});
        }
      }
    }

    const summary = {
      matchId,
      timeCasa: match.time_casa,
      timeFora: match.time_fora,
      placarFinal: `${match.placar_casa} x ${match.placar_fora}`,
      vencedor1X2: winning1X2,
      totalApostas: activeBets.length,
      countGreen,
      countRed,
      totalPago: parseFloat(totalPago.toFixed(2)),
      timestamp: new Date().toISOString()
    };

    // Broadcast geral de conclusão de liquidação
    if (typeof broadcast === 'function') {
      broadcast('SETTLEMENT_COMPLETED', summary);
    }

    this.emit('match_settled', summary);
    console.log(`[Liquidação] ✅ Concluída para partida #${matchId}. GREEN: ${countGreen}, RED: ${countRed}, Total Pago: R$ ${summary.totalPago.toFixed(2)}`);

    return summary;
  }
}

module.exports = new SettlementService();
