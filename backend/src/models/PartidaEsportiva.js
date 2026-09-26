const db = require('../database');

/**
 * Modelo de Acesso a Dados da Entidade PARTIDA_ESPORTIVA
 * Tabela: partida_esportiva
 */
class PartidaEsportiva {
  /**
   * Retorna todas as partidas cadastradas.
   * @returns {Promise<Array<object>>}
   */
  static async findAll() {
    const res = await db.query(
      `SELECT id_partida, modalidade_esportiva, time_casa, time_fora, placar_casa, placar_fora, minuto_jogo, status_partida 
       FROM partida_esportiva 
       ORDER BY id_partida ASC`
    );
    return res.rows.map(row => this._formatRow(row));
  }

  /**
   * Retorna todas as partidas ao vivo ativas.
   * @returns {Promise<Array<object>>}
   */
  static async findLiveMatches() {
    const res = await db.query(
      `SELECT id_partida, modalidade_esportiva, time_casa, time_fora, placar_casa, placar_fora, minuto_jogo, status_partida 
       FROM partida_esportiva 
       WHERE status_partida = 'AO_VIVO'
       ORDER BY id_partida ASC`
    );
    return res.rows.map(row => this._formatRow(row));
  }

  /**
   * Busca uma partida pelo ID.
   * @param {number} idPartida 
   * @returns {Promise<object|null>}
   */
  static async findById(idPartida) {
    const res = await db.query(
      `SELECT id_partida, modalidade_esportiva, time_casa, time_fora, placar_casa, placar_fora, minuto_jogo, status_partida 
       FROM partida_esportiva 
       WHERE id_partida = $1`,
      [idPartida]
    );
    if (res.rows.length === 0) return null;
    return this._formatRow(res.rows[0]);
  }

  /**
   * Atualiza o estado da partida (minuto, placar e status).
   * @param {number} idPartida 
   * @param {object} dados 
   * @returns {Promise<object>}
   */
  static async updateState(idPartida, { minuto_jogo, placar_casa, placar_fora, status_partida }) {
    const res = await db.query(
      `UPDATE partida_esportiva 
       SET minuto_jogo = COALESCE($1, minuto_jogo),
           placar_casa = COALESCE($2, placar_casa),
           placar_fora = COALESCE($3, placar_fora),
           status_partida = COALESCE($4, status_partida)
       WHERE id_partida = $5
       RETURNING id_partida, modalidade_esportiva, time_casa, time_fora, placar_casa, placar_fora, minuto_jogo, status_partida`,
      [minuto_jogo, placar_casa, placar_fora, status_partida, idPartida]
    );
    if (res.rows.length === 0) {
      throw new Error(`Partida ${idPartida} não encontrada.`);
    }
    return this._formatRow(res.rows[0]);
  }

  /**
   * Atualiza apenas o status da partida ('AO_VIVO', 'SUSPENSA', 'ENCERRADA').
   * @param {number} idPartida 
   * @param {string} novoStatus 
   * @returns {Promise<object>}
   */
  static async updateStatus(idPartida, novoStatus) {
    const res = await db.query(
      `UPDATE partida_esportiva 
       SET status_partida = $1 
       WHERE id_partida = $2 
       RETURNING id_partida, modalidade_esportiva, time_casa, time_fora, placar_casa, placar_fora, minuto_jogo, status_partida`,
      [novoStatus, idPartida]
    );
    if (res.rows.length === 0) {
      throw new Error(`Partida ${idPartida} não encontrada.`);
    }
    return this._formatRow(res.rows[0]);
  }

  /**
   * Formatação das colunas para os tipos corretos em JS
   * @private
   */
  static _formatRow(row) {
    if (!row) return null;
    return {
      id_partida: row.id_partida,
      modalidade_esportiva: row.modalidade_esportiva,
      time_casa: row.time_casa,
      time_fora: row.time_fora,
      placar_casa: parseInt(row.placar_casa, 10),
      placar_fora: parseInt(row.placar_fora, 10),
      minuto_jogo: parseInt(row.minuto_jogo, 10),
      status_partida: row.status_partida
    };
  }
}

module.exports = PartidaEsportiva;
