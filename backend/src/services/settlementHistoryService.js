const EventEmitter = require('events');
const HistoricoLiquidacao = require('../models/HistoricoLiquidacao');

// Cache em memória para garantir persistência mesmo em caso de indisponibilidade temporária do banco
const memoryHistory = [];
let nextHistoryId = 1;

class SettlementHistoryService extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Grava o registro de liquidação de uma aposta (RF-07)
   * @param {object} dados
   * @param {number} dados.idAposta - ID do bilhete
   * @param {number} dados.idApostador - ID do apostador
   * @param {number} [dados.idPartida] - ID da partida
   * @param {string} [dados.partidaNome] - Nome do confronto
   * @param {string} [dados.mercado='1X2'] - Mercado da aposta
   * @param {string} dados.selecao - Seleção feita (CASA, EMPATE, FORA, etc.)
   * @param {number} dados.oddMomento - Cotação contratada
   * @param {number} dados.valorApostado - Valor apostado em reais
   * @param {string} dados.statusFinal - 'GREEN', 'RED' ou 'CASH_OUT'
   * @param {number} [dados.valorRetorno=0] - Valor creditado na carteira
   * @param {number} [dados.lucroPrejuizo] - Lucro líquido (retorno - apostado)
   * @param {string} [dados.placarFinal] - Placar final (ex: '2 x 1')
   * @param {string} [dados.motivo='TERMINO_PARTIDA'] - 'TERMINO_PARTIDA', 'LIQUIDACAO_MANUAL', 'CASH_OUT'
   * @param {object} [client] - Conexão dedicada para transação ACID
   * @returns {Promise<object>} Registro consolidado
   */
  async recordSettlement(dados, client = null) {
    const idAposta = parseInt(dados.idAposta || dados.id_aposta, 10);
    const idApostador = parseInt(dados.idApostador || dados.id_apostador, 10);
    const idPartida = dados.idPartida || dados.id_partida || dados.matchId || null;
    const partidaNome = dados.partidaNome || dados.partida_nome || `Partida #${idPartida}`;
    const mercado = dados.mercado || dados.nome_mercado || '1X2';
    const selecao = dados.selecao || dados.opcao_selecao || 'CASA';
    const oddMomento = parseFloat(dados.oddMomento || dados.odd_momento || 2.0);
    const valorApostado = parseFloat(dados.valorApostado || dados.valor_apostado || 0);
    const statusFinal = dados.statusFinal || dados.status_final || dados.status || 'RED';
    
    let valorRetorno = parseFloat(dados.valorRetorno !== undefined ? dados.valorRetorno : (dados.retorno !== undefined ? dados.retorno : (statusFinal === 'GREEN' ? (valorApostado * oddMomento) : 0)));
    if (isNaN(valorRetorno)) valorRetorno = 0;

    let lucroPrejuizo = dados.lucroPrejuizo !== undefined ? parseFloat(dados.lucroPrejuizo) : (valorRetorno - valorApostado);
    if (isNaN(lucroPrejuizo)) lucroPrejuizo = valorRetorno - valorApostado;

    const placarFinal = dados.placarFinal || dados.placar_final || null;
    const motivoLiquidacao = dados.motivo || dados.motivoLiquidacao || dados.motivo_liquidacao || 'TERMINO_PARTIDA';

    let dbRecord = null;
    try {
      dbRecord = await HistoricoLiquidacao.create({
        idAposta,
        idApostador,
        idPartida,
        partidaNome,
        mercado,
        selecao,
        oddMomento,
        valorApostado,
        statusFinal,
        valorRetorno,
        lucroPrejuizo,
        placarFinal,
        motivoLiquidacao
      }, client);
    } catch (e) {
      console.warn(`[Histórico] Aviso: Falha ao gravar no PostgreSQL, utilizando persistência em memória: ${e.message}`);
    }

    const memoryItem = {
      id_historico: dbRecord ? dbRecord.id_historico : nextHistoryId++,
      id_aposta: idAposta,
      idAposta,
      id_apostador: idApostador,
      idApostador,
      id_partida: idPartida,
      matchId: idPartida,
      partida_nome: partidaNome,
      partidaNome,
      mercado,
      selecao,
      opcao_selecionada: selecao,
      odd_momento: oddMomento,
      oddMomento,
      valor_apostado: valorApostado,
      valorApostado,
      status_final: statusFinal,
      status: statusFinal,
      valor_retorno: valorRetorno,
      valorGanho: valorRetorno,
      lucro_prejuizo: lucroPrejuizo,
      lucroPrejuizo,
      placar_final: placarFinal,
      placarFinal,
      motivo_liquidacao: motivoLiquidacao,
      data_liquidacao: new Date().toISOString(),
      dataHora: new Date().toISOString()
    };

    // Remove duplicidade se já houver registro da mesma aposta
    const existingIdx = memoryHistory.findIndex(h => (h.idAposta === idAposta || h.id_aposta === idAposta));
    if (existingIdx !== -1) {
      memoryHistory[existingIdx] = memoryItem;
    } else {
      memoryHistory.unshift(memoryItem);
    }

    console.log(`[Histórico] 📜 Registrada liquidação para Bilhete #${idAposta} (${statusFinal}): Retorno R$ ${valorRetorno.toFixed(2)}, Lucro R$ ${lucroPrejuizo.toFixed(2)}. Partida: ${partidaNome}`);

    this.emit('settlement_recorded', memoryItem);
    return memoryItem;
  }

  /**
   * Retorna todo o histórico de liquidações de um apostador
   * @param {number} apostadorId 
   * @returns {Promise<Array<object>>}
   */
  async getHistoryByApostador(apostadorId) {
    const id = parseInt(apostadorId, 10);
    let dbHistory = [];
    try {
      dbHistory = await HistoricoLiquidacao.findByApostador(id);
    } catch (e) {
      // Ignora erro se banco indisponível
    }

    const memHistory = memoryHistory.filter(h => (h.idApostador === id || h.id_apostador === id));

    // Combina garantindo unicidade por idAposta
    const combined = [...(dbHistory || [])];
    for (const mh of memHistory) {
      const betId = mh.idAposta || mh.id_aposta;
      if (!combined.some(h => (h.idAposta || h.id_aposta) === betId)) {
        combined.push(mh);
      }
    }

    // Ordena do mais recente para o mais antigo
    combined.sort((a, b) => new Date(b.data_liquidacao || b.dataHora) - new Date(a.data_liquidacao || a.dataHora));
    return combined;
  }

  /**
   * Retorna todas as liquidações registradas
   * @returns {Array<object>}
   */
  getAll() {
    return [...memoryHistory];
  }

  /**
   * Limpa o histórico em memória (para testes)
   */
  clear() {
    memoryHistory.length = 0;
  }
}

module.exports = new SettlementHistoryService();
