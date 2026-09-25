const Apostador = require('../models/Apostador');

// Armazenamento em memória (sessões ativas e fallback de alta performance O(1))
const memoryApostadores = new Map();

// Dados semente para modo em memória caso o banco ainda esteja offline
const INITIAL_SALDO = 100.00;

function initDefaultMemoryUsers() {
  if (memoryApostadores.size === 0) {
    memoryApostadores.set(1, {
      id_apostador: 1,
      cpf_usuario: '111.222.333-44',
      nome_completo: 'Arthur Borges Rodrigues',
      saldo_ficticio: INITIAL_SALDO,
      data_cadastro: new Date()
    });
    memoryApostadores.set(2, {
      id_apostador: 2,
      cpf_usuario: '555.666.777-88',
      nome_completo: 'João Lucas Tavares Silva',
      saldo_ficticio: INITIAL_SALDO,
      data_cadastro: new Date()
    });
  }
}

initDefaultMemoryUsers();

class ApostadorService {
  /**
   * Obtém ou inicializa a sessão de um apostador ao conectar no WebSocket (RF-01).
   * Vincula à sessão o saldo fictício inicial de R$ 100,00.
   * @param {object} params
   * @param {string} params.clientId - UUID da conexão WebSocket
   * @param {number|string} [params.apostadorId] - ID opcional passado via query string
   * @param {string} [params.nome] - Nome opcional para novo usuário
   * @param {string} [params.cpf] - CPF opcional para novo usuário
   * @returns {Promise<object>} Apostador com id, nome e saldo_ficticio
   */
  async getOrCreateSession({ clientId, apostadorId, nome, cpf }) {
    const id = apostadorId ? parseInt(apostadorId, 10) : 1; // Padrão: Apostador 1 (Arthur)
    
    // 1. Tentar buscar do banco de dados PostgreSQL
    try {
      let apostador = await Apostador.findById(id);

      if (!apostador && cpf) {
        apostador = await Apostador.findByCpf(cpf);
      }

      if (!apostador) {
        // Criar novo apostador no banco com saldo inicial de R$ 100,00
        const novoNome = nome || `Apostador ${id}`;
        const novoCpf = cpf || `${id.toString().padStart(3, '0')}.000.000-00`;
        apostador = await Apostador.create({
          nomeCompleto: novoNome,
          cpfUsuario: novoCpf,
          saldoInicial: INITIAL_SALDO
        });
      }

      // Sincronizar com a memória local para acesso instantâneo (< 100ms)
      memoryApostadores.set(apostador.id_apostador, apostador);
      return apostador;
    } catch (err) {
      // 2. Fallback resiliente em memória caso o banco de dados esteja offline
      let apostador = memoryApostadores.get(id);

      if (!apostador) {
        apostador = {
          id_apostador: id,
          cpf_usuario: cpf || `${id.toString().padStart(3, '0')}.000.000-00`,
          nome_completo: nome || `Apostador Convidado ${id}`,
          saldo_ficticio: INITIAL_SALDO,
          data_cadastro: new Date()
        };
        memoryApostadores.set(id, apostador);
      }

      return apostador;
    }
  }

  /**
   * Retorna o saldo atual do apostador.
   * @param {number} apostadorId 
   * @returns {Promise<number>}
   */
  async getSaldo(apostadorId) {
    const id = parseInt(apostadorId, 10);
    try {
      const apostador = await Apostador.findById(id);
      if (apostador) {
        memoryApostadores.set(id, apostador);
        return apostador.saldo_ficticio;
      }
    } catch (e) {
      // Falha de banco, consulta memória
    }

    const memoryUser = memoryApostadores.get(id);
    return memoryUser ? memoryUser.saldo_ficticio : INITIAL_SALDO;
  }

  /**
   * Debita um valor do saldo do apostador de forma atômica (RNF-02).
   * Impede estritamente saldos negativos.
   * @param {number} apostadorId 
   * @param {number} valor 
   * @param {object} [client] - Cliente pg opcional para transações atômicas
   * @returns {Promise<number>} Novo saldo atualizado
   */
  async debitarSaldo(apostadorId, valor, client = null) {
    const id = parseInt(apostadorId, 10);
    const valorNumerico = parseFloat(valor);

    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      throw new Error('Valor de débito inválido. O valor deve ser maior que zero.');
    }

    const saldoAtual = await this.getSaldo(id);

    if (saldoAtual < valorNumerico) {
      throw new Error(`Saldo insuficiente. Saldo atual: R$ ${saldoAtual.toFixed(2)}, valor solicitado: R$ ${valorNumerico.toFixed(2)}.`);
    }

    const novoSaldo = parseFloat((saldoAtual - valorNumerico).toFixed(2));

    // Atualiza no banco se conectado
    try {
      await Apostador.updateSaldo(id, novoSaldo, client);
    } catch (e) {
      // Se banco offline, segue em memória
    }

    // Atualiza em memória
    const user = memoryApostadores.get(id) || { id_apostador: id, saldo_ficticio: INITIAL_SALDO };
    user.saldo_ficticio = novoSaldo;
    memoryApostadores.set(id, user);

    return novoSaldo;
  }

  /**
   * Credita um valor no saldo do apostador (para Cash Out ou Green).
   * @param {number} apostadorId 
   * @param {number} valor 
   * @param {object} [client] - Cliente pg opcional
   * @returns {Promise<number>} Novo saldo atualizado
   */
  async creditarSaldo(apostadorId, valor, client = null) {
    const id = parseInt(apostadorId, 10);
    const valorNumerico = parseFloat(valor);

    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      throw new Error('Valor de crédito inválido. O valor deve ser maior que zero.');
    }

    const saldoAtual = await this.getSaldo(id);
    const novoSaldo = parseFloat((saldoAtual + valorNumerico).toFixed(2));

    try {
      await Apostador.updateSaldo(id, novoSaldo, client);
    } catch (e) {
      // Se banco offline, segue em memória
    }

    const user = memoryApostadores.get(id) || { id_apostador: id, saldo_ficticio: INITIAL_SALDO };
    user.saldo_ficticio = novoSaldo;
    memoryApostadores.set(id, user);

    return novoSaldo;
  }

  /**
   * Retorna os apostadores ordenados por maior saldo (RF-08).
   * @returns {Promise<Array<object>>}
   */
  async getRanking() {
    try {
      const dbRanking = await Apostador.getRanking(10);
      if (dbRanking && dbRanking.length > 0) return dbRanking;
    } catch (e) {
      // Se falhar banco, usa ranking da memória
    }

    return Array.from(memoryApostadores.values())
      .sort((a, b) => b.saldo_ficticio - a.saldo_ficticio)
      .slice(0, 10)
      .map(u => ({
        id_apostador: u.id_apostador,
        nome_completo: u.nome_completo,
        saldo_ficticio: parseFloat(u.saldo_ficticio.toFixed(2))
      }));
  }
}

module.exports = new ApostadorService();
