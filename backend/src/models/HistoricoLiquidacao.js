const db = require('../database');

/**
 * Modelo de Acesso a Dados da Entidade HISTORICO_LIQUIDACAO
 * Tabela: historico_liquidacao
 */
class HistoricoLiquidacao {
  /**
   * Garante a criação da tabela no banco caso ainda não exista
   */
  static async ensureTable(client = null) {
    const queryRunner = client ? client.query.bind(client) : db.query.bind(db);
    try {
      await queryRunner(`
        CREATE TABLE IF NOT EXISTS historico_liquidacao (
            id_historico SERIAL PRIMARY KEY,
            id_aposta INT NOT NULL,
            id_apostador INT NOT NULL,
            id_partida INT,
            partida_nome VARCHAR(120),
            mercado VARCHAR(50) NOT NULL DEFAULT '1X2',
            selecao VARCHAR(40) NOT NULL,
            odd_momento DECIMAL(6,2) NOT NULL,
            valor_apostado DECIMAL(10,2) NOT NULL,
            status_final VARCHAR(20) NOT NULL,
            valor_retorno DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            lucro_prejuizo DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            placar_final VARCHAR(30),
            motivo_liquidacao VARCHAR(40) DEFAULT 'TERMINO_PARTIDA',
            data_liquidacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_hist_apostador ON historico_liquidacao(id_apostador);
        CREATE INDEX IF NOT EXISTS idx_hist_aposta ON historico_liquidacao(id_aposta);
      `);
    } catch (e) {
      // Ignora se banco offline
    }
  }

  /**
   * Registra uma nova linha no histórico de liquidações
   * @param {object} dados
   * @param {object} [client] - Conexão dedicada para transação
   * @returns {Promise<object>}
   */
  static async create(dados, client = null) {
    await this.ensureTable(client);

    const {
      idAposta,
      idApostador,
      idPartida = null,
      partidaNome = null,
      mercado = '1X2',
      selecao,
      oddMomento,
      valorApostado,
      statusFinal,
      valorRetorno = 0.00,
      lucroPrejuizo = 0.00,
      placarFinal = null,
      motivoLiquidacao = 'TERMINO_PARTIDA'
    } = dados;

    const queryRunner = client ? client.query.bind(client) : db.query.bind(db);

    const res = await queryRunner(
      `INSERT INTO historico_liquidacao 
        (id_aposta, id_apostador, id_partida, partida_nome, mercado, selecao, 
         odd_momento, valor_apostado, status_final, valor_retorno, lucro_prejuizo, 
         placar_final, motivo_liquidacao, data_liquidacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       RETURNING id_historico, id_aposta, id_apostador, id_partida, partida_nome, mercado, selecao, 
                 odd_momento, valor_apostado, status_final, valor_retorno, lucro_prejuizo, 
                 placar_final, motivo_liquidacao, data_liquidacao`,
      [
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
      ]
    );

    return this._formatRow(res.rows[0]);
  }

  /**
   * Retorna todo o histórico de liquidações de um apostador
   * @param {number} idApostador 
   * @returns {Promise<Array<object>>}
   */
  static async findByApostador(idApostador) {
    await this.ensureTable();

    const res = await db.query(
      `SELECT id_historico, id_aposta, id_apostador, id_partida, partida_nome, mercado, selecao, 
              odd_momento, valor_apostado, status_final, valor_retorno, lucro_prejuizo, 
              placar_final, motivo_liquidacao, data_liquidacao
       FROM historico_liquidacao
       WHERE id_apostador = $1
       ORDER BY data_liquidacao DESC, id_historico DESC`,
      [idApostador]
    );

    return res.rows.map(row => this._formatRow(row));
  }

  /**
   * Formata os campos retornados da query
   * @private
   */
  static _formatRow(row) {
    if (!row) return null;
    return {
      id_historico: row.id_historico,
      id_aposta: row.id_aposta,
      idAposta: row.id_aposta,
      id_apostador: row.id_apostador,
      idApostador: row.id_apostador,
      id_partida: row.id_partida,
      matchId: row.id_partida,
      partida_nome: row.partida_nome,
      partidaNome: row.partida_nome,
      mercado: row.mercado,
      selecao: row.selecao,
      opcao_selecionada: row.selecao,
      odd_momento: parseFloat(row.odd_momento),
      oddMomento: parseFloat(row.odd_momento),
      valor_apostado: parseFloat(row.valor_apostado),
      valorApostado: parseFloat(row.valor_apostado),
      status_final: row.status_final,
      status: row.status_final,
      valor_retorno: parseFloat(row.valor_retorno),
      valorGanho: parseFloat(row.valor_retorno),
      lucro_prejuizo: parseFloat(row.lucro_prejuizo),
      lucroPrejuizo: parseFloat(row.lucro_prejuizo),
      placar_final: row.placar_final,
      placarFinal: row.placar_final,
      motivo_liquidacao: row.motivo_liquidacao,
      data_liquidacao: row.data_liquidacao,
      dataHora: row.data_liquidacao
    };
  }
}

module.exports = HistoricoLiquidacao;
