const db = require('../database');

/**
 * Modelo de Acesso a Dados da Entidade MERCADO_ODD
 * Tabela: mercado_odd
 */
class MercadoOdd {
  /**
   * Retorna todos os mercados de uma partida esportiva.
   * @param {number} idPartida 
   * @returns {Promise<Array<object>>}
   */
  static async findByPartida(idPartida) {
    const res = await db.query(
      `SELECT id_mercado, id_partida, nome_mercado, opcao_selecao, cotacao_odd_atual, ativo 
       FROM mercado_odd 
       WHERE id_partida = $1 
       ORDER BY id_mercado ASC`,
      [idPartida]
    );
    return res.rows.map(row => this._formatRow(row));
  }

  /**
   * Retorna apenas os mercados ativos de uma partida esportiva.
   * @param {number} idPartida 
   * @returns {Promise<Array<object>>}
   */
  static async findActiveByPartida(idPartida) {
    const res = await db.query(
      `SELECT id_mercado, id_partida, nome_mercado, opcao_selecao, cotacao_odd_atual, ativo 
       FROM mercado_odd 
       WHERE id_partida = $1 AND ativo = true
       ORDER BY id_mercado ASC`,
      [idPartida]
    );
    return res.rows.map(row => this._formatRow(row));
  }

  /**
   * Busca um mercado específico pelo ID.
   * @param {number} idMercado 
   * @returns {Promise<object|null>}
   */
  static async findById(idMercado) {
    const res = await db.query(
      `SELECT id_mercado, id_partida, nome_mercado, opcao_selecao, cotacao_odd_atual, ativo 
       FROM mercado_odd 
       WHERE id_mercado = $1`,
      [idMercado]
    );
    if (res.rows.length === 0) return null;
    return this._formatRow(res.rows[0]);
  }

  /**
   * Atualiza a cotação de uma odd respeitando a regra de valor mínimo (>= 1.01).
   * @param {number} idMercado 
   * @param {number} novaOdd 
   * @returns {Promise<object>}
   */
  static async updateOdd(idMercado, novaOdd) {
    const cotacao = parseFloat(novaOdd);
    if (cotacao < 1.01) {
      throw new Error('Cotação da odd não pode ser inferior a 1.01.');
    }

    const res = await db.query(
      `UPDATE mercado_odd 
       SET cotacao_odd_atual = $1 
       WHERE id_mercado = $2 
       RETURNING id_mercado, id_partida, nome_mercado, opcao_selecao, cotacao_odd_atual, ativo`,
      [cotacao, idMercado]
    );

    if (res.rows.length === 0) {
      throw new Error(`Mercado com ID ${idMercado} não encontrado.`);
    }

    return this._formatRow(res.rows[0]);
  }

  /**
   * Suspende ou reativa um mercado específico.
   * @param {number} idMercado 
   * @param {boolean} ativo 
   * @returns {Promise<object>}
   */
  static async setAtivo(idMercado, ativo) {
    const res = await db.query(
      `UPDATE mercado_odd 
       SET ativo = $1 
       WHERE id_mercado = $2 
       RETURNING id_mercado, id_partida, nome_mercado, opcao_selecao, cotacao_odd_atual, ativo`,
      [Boolean(ativo), idMercado]
    );
    if (res.rows.length === 0) {
      throw new Error(`Mercado com ID ${idMercado} não encontrado.`);
    }
    return this._formatRow(res.rows[0]);
  }

  /**
   * Suspende todos os mercados de uma partida (usado durante GOAL - RF-06)
   * @param {number} idPartida 
   * @param {boolean} ativo 
   * @returns {Promise<number>}
   */
  static async setAtivoPorPartida(idPartida, ativo) {
    const res = await db.query(
      `UPDATE mercado_odd 
       SET ativo = $1 
       WHERE id_partida = $2`,
      [Boolean(ativo), idPartida]
    );
    return res.rowCount;
  }

  /**
   * Converte valores do PostgreSQL para tipos primitivos JS
   * @private
   */
  static _formatRow(row) {
    if (!row) return null;
    return {
      id_mercado: row.id_mercado,
      id_partida: row.id_partida,
      nome_mercado: row.nome_mercado,
      opcao_selecao: row.opcao_selecao,
      cotacao_odd_atual: parseFloat(row.cotacao_odd_atual),
      ativo: Boolean(row.ativo)
    };
  }
}

module.exports = MercadoOdd;
