const db = require('../database');

/**
 * Modelo de Acesso a Dados da Entidade TRANSACAO_CASHOUT
 * Tabela: transacao_cashout
 */
class TransacaoCashout {
  /**
   * Registra uma transação de Cash Out no banco de dados.
   * A chave única (uq_cashout_aposta) no PostgreSQL impede duplicidade a nível físico (RNF-01).
   * @param {object} dados
   * @param {number} dados.idAposta
   * @param {number} dados.valorResgateOferecido
   * @param {number} dados.valorResgatado
   * @param {object} [client] - Conexão dedicada para transação atômica ACID
   * @returns {Promise<object>}
   */
  static async create(dados, client = null) {
    const { idAposta, valorResgateOferecido, valorResgatado } = dados;
    const queryRunner = client ? client.query.bind(client) : db.query.bind(db);

    const res = await queryRunner(
      `INSERT INTO transacao_cashout 
        (id_aposta, valor_resgate_oferecido, valor_resgatado, timestamp_efetivacao)
       VALUES ($1, $2, $3, NOW())
       RETURNING id_cashout, id_aposta, valor_resgate_oferecido, valor_resgatado, timestamp_efetivacao`,
      [idAposta, valorResgateOferecido, valorResgatado]
    );

    return this._formatRow(res.rows[0]);
  }

  /**
   * Busca uma transação de Cash Out pelo ID da aposta.
   * @param {number} idAposta 
   * @returns {Promise<object|null>}
   */
  static async findByApostaId(idAposta) {
    const res = await db.query(
      `SELECT id_cashout, id_aposta, valor_resgate_oferecido, valor_resgatado, timestamp_efetivacao 
       FROM transacao_cashout 
       WHERE id_aposta = $1`,
      [idAposta]
    );
    if (res.rows.length === 0) return null;
    return this._formatRow(res.rows[0]);
  }

  /**
   * Formata os campos retornados da query
   * @private
   */
  static _formatRow(row) {
    if (!row) return null;
    return {
      id_cashout: row.id_cashout,
      id_aposta: row.id_aposta,
      valor_resgate_oferecido: parseFloat(row.valor_resgate_oferecido),
      valor_resgatado: parseFloat(row.valor_resgatado),
      timestamp_efetivacao: row.timestamp_efetivacao
    };
  }
}

module.exports = TransacaoCashout;
