const db = require('../database');

/**
 * Modelo de Acesso a Dados da Entidade APOSTADOR
 * Tabela: apostador
 */
class Apostador {
  /**
   * Busca um apostador pelo ID.
   * @param {number} id 
   * @returns {Promise<object|null>}
   */
  static async findById(id) {
    const res = await db.query(
      'SELECT id_apostador, cpf_usuario, nome_completo, saldo_ficticio, data_cadastro FROM apostador WHERE id_apostador = $1',
      [id]
    );
    if (res.rows.length === 0) return null;
    return this._formatRow(res.rows[0]);
  }

  /**
   * Busca um apostador pelo CPF.
   * @param {string} cpf 
   * @returns {Promise<object|null>}
   */
  static async findByCpf(cpf) {
    const res = await db.query(
      'SELECT id_apostador, cpf_usuario, nome_completo, saldo_ficticio, data_cadastro FROM apostador WHERE cpf_usuario = $1',
      [cpf]
    );
    if (res.rows.length === 0) return null;
    return this._formatRow(res.rows[0]);
  }

  /**
   * Cria um novo apostador com saldo inicial de R$ 100,00 (RF-01).
   * @param {object} dados
   * @param {string} dados.nomeCompleto
   * @param {string} dados.cpfUsuario
   * @param {number} [dados.saldoInicial=100.00]
   * @returns {Promise<object>}
   */
  static async create({ nomeCompleto, cpfUsuario, saldoInicial = 100.00 }) {
    const res = await db.query(
      `INSERT INTO apostador (cpf_usuario, nome_completo, saldo_ficticio)
       VALUES ($1, $2, $3)
       RETURNING id_apostador, cpf_usuario, nome_completo, saldo_ficticio, data_cadastro`,
      [cpfUsuario, nomeCompleto, saldoInicial]
    );
    return this._formatRow(res.rows[0]);
  }

  /**
   * Atualiza o saldo fictício de um apostador garantindo não-negatividade (RNF-02).
   * @param {number} idApostador 
   * @param {number} novoSaldo 
   * @param {object} [client] - Cliente pg opcional para transações atômicas
   * @returns {Promise<object>}
   */
  static async updateSaldo(idApostador, novoSaldo, client = null) {
    if (novoSaldo < 0) {
      throw new Error('Operação inválida: Saldo não pode ser negativo (RNF-02).');
    }

    const queryRunner = client ? client.query.bind(client) : db.query.bind(db);
    const res = await queryRunner(
      `UPDATE apostador 
       SET saldo_ficticio = $1 
       WHERE id_apostador = $2 
       RETURNING id_apostador, cpf_usuario, nome_completo, saldo_ficticio, data_cadastro`,
      [novoSaldo, idApostador]
    );

    if (res.rows.length === 0) {
      throw new Error(`Apostador com ID ${idApostador} não encontrado.`);
    }

    return this._formatRow(res.rows[0]);
  }

  /**
   * Retorna os apostadores ordenados pelo maior saldo (para o Ranking RF-08).
   * @param {number} [limit=10]
   * @returns {Promise<Array<object>>}
   */
  static async getRanking(limit = 10) {
    const res = await db.query(
      `SELECT id_apostador, nome_completo, saldo_ficticio 
       FROM apostador 
       ORDER BY saldo_ficticio DESC 
       LIMIT $1`,
      [limit]
    );
    return res.rows.map(row => this._formatRow(row));
  }

  /**
   * Converte valores numéricos do postgres para float em JavaScript.
   * @private
   */
  static _formatRow(row) {
    if (!row) return null;
    return {
      id_apostador: row.id_apostador,
      cpf_usuario: row.cpf_usuario,
      nome_completo: row.nome_completo,
      saldo_ficticio: parseFloat(row.saldo_ficticio),
      data_cadastro: row.data_cadastro
    };
  }
}

module.exports = Apostador;
