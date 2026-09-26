const db = require('../database');

/**
 * Modelo de Acesso a Dados da Entidade BILHETE_APOSTA
 * Tabela: bilhete_aposta
 */
class BilheteAposta {
  /**
   * Cria um novo bilhete de aposta no banco de dados.
   * Suporta cliente de transação (client) para operações atômicas ACID.
   * @param {object} dados
   * @param {number} dados.idApostador
   * @param {number} dados.idMercado
   * @param {number} dados.valorApostado
   * @param {number} dados.oddMomento
   * @param {number} dados.retornoPotencial
   * @param {string} [dados.statusAposta='ATIVA']
   * @param {object} [client] - Conexão dedicada do pg para transação atômica
   * @returns {Promise<object>}
   */
  static async create(dados, client = null) {
    const {
      idApostador,
      idMercado,
      valorApostado,
      oddMomento,
      retornoPotencial,
      statusAposta = 'ATIVA'
    } = dados;

    const queryRunner = client ? client.query.bind(client) : db.query.bind(db);

    const res = await queryRunner(
      `INSERT INTO bilhete_aposta 
        (id_apostador, id_mercado, valor_apostado, odd_momento, retorno_potencial, status_aposta, data_hora_aposta)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id_aposta, id_apostador, id_mercado, valor_apostado, odd_momento, retorno_potencial, status_aposta, data_hora_aposta`,
      [idApostador, idMercado, valorApostado, oddMomento, retornoPotencial, statusAposta]
    );

    return this._formatRow(res.rows[0]);
  }

  /**
   * Busca um bilhete de aposta pelo ID.
   * @param {number} idAposta 
   * @returns {Promise<object|null>}
   */
  static async findById(idAposta) {
    const res = await db.query(
      `SELECT b.id_aposta, b.id_apostador, b.id_mercado, b.valor_apostado, b.odd_momento, 
              b.retorno_potencial, b.status_aposta, b.data_hora_aposta,
              m.nome_mercado, m.opcao_selecao, m.id_partida,
              p.time_casa, p.time_fora, p.status_partida
       FROM bilhete_aposta b
       JOIN mercado_odd m ON b.id_mercado = m.id_mercado
       JOIN partida_esportiva p ON m.id_partida = p.id_partida
       WHERE b.id_aposta = $1`,
      [idAposta]
    );

    if (res.rows.length === 0) return null;
    return this._formatRow(res.rows[0]);
  }

  /**
   * Retorna todas as apostas ativas de um apostador.
   * @param {number} idApostador 
   * @returns {Promise<Array<object>>}
   */
  static async findActiveByApostador(idApostador) {
    const res = await db.query(
      `SELECT b.id_aposta, b.id_apostador, b.id_mercado, b.valor_apostado, b.odd_momento, 
              b.retorno_potencial, b.status_aposta, b.data_hora_aposta,
              m.nome_mercado, m.opcao_selecao, m.id_partida,
              p.time_casa, p.time_fora, p.placar_casa, p.placar_fora, p.minuto_jogo, p.status_partida
       FROM bilhete_aposta b
       JOIN mercado_odd m ON b.id_mercado = m.id_mercado
       JOIN partida_esportiva p ON m.id_partida = p.id_partida
       WHERE b.id_apostador = $1 AND b.status_aposta = 'ATIVA'
       ORDER BY b.data_hora_aposta DESC`,
      [idApostador]
    );

    return res.rows.map(row => this._formatRow(row));
  }

  /**
   * Retorna todas as apostas ativas vinculadas a uma partida específica (para liquidação RF-07).
   * @param {number} idPartida 
   * @returns {Promise<Array<object>>}
   */
  static async findActiveByPartida(idPartida) {
    const res = await db.query(
      `SELECT b.id_aposta, b.id_apostador, b.id_mercado, b.valor_apostado, b.odd_momento, 
              b.retorno_potencial, b.status_aposta, b.data_hora_aposta,
              m.nome_mercado, m.opcao_selecao, m.id_partida
       FROM bilhete_aposta b
       JOIN mercado_odd m ON b.id_mercado = m.id_mercado
       WHERE m.id_partida = $1 AND b.status_aposta = 'ATIVA'`,
      [idPartida]
    );

    return res.rows.map(row => this._formatRow(row));
  }

  /**
   * Atualiza o status de um bilhete de aposta ('ATIVA', 'GREEN', 'RED', 'CASH_OUT').
   * @param {number} idAposta 
   * @param {string} novoStatus 
   * @param {object} [client]
   * @returns {Promise<object>}
   */
  static async updateStatus(idAposta, novoStatus, client = null) {
    const queryRunner = client ? client.query.bind(client) : db.query.bind(db);

    const res = await queryRunner(
      `UPDATE bilhete_aposta 
       SET status_aposta = $1 
       WHERE id_aposta = $2 
       RETURNING id_aposta, id_apostador, id_mercado, valor_apostado, odd_momento, retorno_potencial, status_aposta, data_hora_aposta`,
      [novoStatus, idAposta]
    );

    if (res.rows.length === 0) {
      throw new Error(`Bilhete de aposta ${idAposta} não encontrado.`);
    }

    return this._formatRow(res.rows[0]);
  }

  /**
   * Formata os campos retornados da query
   * @private
   */
  static _formatRow(row) {
    if (!row) return null;
    return {
      id_aposta: row.id_aposta,
      id_apostador: row.id_apostador,
      id_mercado: row.id_mercado,
      valor_apostado: parseFloat(row.valor_apostado),
      odd_momento: parseFloat(row.odd_momento),
      retorno_potencial: parseFloat(row.retorno_potencial),
      status_aposta: row.status_aposta,
      data_hora_aposta: row.data_hora_aposta,
      // Dados opcionais do JOIN
      nome_mercado: row.nome_mercado,
      opcao_selecao: row.opcao_selecao,
      id_partida: row.id_partida,
      time_casa: row.time_casa,
      time_fora: row.time_fora,
      placar_casa: row.placar_casa,
      placar_fora: row.placar_fora,
      minuto_jogo: row.minuto_jogo,
      status_partida: row.status_partida
    };
  }
}

module.exports = BilheteAposta;
