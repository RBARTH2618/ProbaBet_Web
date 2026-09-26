const EventEmitter = require('events');
const MercadoOdd = require('../models/MercadoOdd');

/**
 * MOTOR DE CÁLCULO E TRANSMISSÃO DINÂMICA DE ODDS (RF-02)
 * Atualiza periodicamente (a cada 2 a 3 segundos) as cotações dos mercados de apostas.
 */
class OddsEngineService extends EventEmitter {
  constructor() {
    super();
    // Armazena as odds atuais indexadas por partida e mercado: Map<partidaId, Map<mercadoNome, object>>
    this.currentOdds = new Map();
    this._initializeDefaultOdds();
  }

  /**
   * Carga inicial dos mercados em memória
   * @private
   */
  _initializeDefaultOdds() {
    // Partida 1: Flamengo x Palmeiras
    this.currentOdds.set(1, {
      '1X2': {
        CASA: { odd: 2.10, previous: 2.10, direction: 'STABLE', id_mercado: 1 },
        EMPATE: { odd: 3.25, previous: 3.25, direction: 'STABLE', id_mercado: 2 },
        FORA: { odd: 3.40, previous: 3.40, direction: 'STABLE', id_mercado: 3 }
      },
      'PROXIMO_GOL': {
        CASA: { odd: 1.85, previous: 1.85, direction: 'STABLE', id_mercado: 4 },
        FORA: { odd: 2.20, previous: 2.20, direction: 'STABLE', id_mercado: 5 }
      }
    });

    // Partida 2: Real Madrid x Barcelona
    this.currentOdds.set(2, {
      '1X2': {
        CASA: { odd: 2.45, previous: 2.45, direction: 'STABLE', id_mercado: 7 },
        EMPATE: { odd: 2.90, previous: 2.90, direction: 'STABLE', id_mercado: 8 },
        FORA: { odd: 2.80, previous: 2.80, direction: 'STABLE', id_mercado: 9 }
      },
      'PROXIMO_GOL': {
        CASA: { odd: 1.90, previous: 1.90, direction: 'STABLE', id_mercado: 10 },
        FORA: { odd: 1.90, previous: 1.90, direction: 'STABLE', id_mercado: 11 }
      }
    });

    // Partida 3: LA Lakers x Boston Celtics (Basquete)
    this.currentOdds.set(3, {
      '1X2': {
        CASA: { odd: 2.15, previous: 2.15, direction: 'STABLE', id_mercado: 12 },
        FORA: { odd: 1.70, previous: 1.70, direction: 'STABLE', id_mercado: 13 }
      }
    });
  }

  /**
   * Conecta o motor de odds ao simulador de partidas (da Etapa 8)
   * @param {import('./matchSimulatorService')} matchSimulator 
   */
  bindToSimulator(matchSimulator) {
    // A cada ciclo de avanço da partida (2 a 3 segundos), recalcula e transmite as odds
    matchSimulator.on('match_tick', (match) => {
      this.recalculateAndBroadcast(match);
    });

    // Quando ocorre um gol, força recálculo imediato de odds
    matchSimulator.on('goal', ({ match }) => {
      this.recalculateAndBroadcast(match, true);
    });

    console.log('[Odds Engine] Motor de Odds conectado aos eventos do simulador.');
  }

  /**
   * Recalcula dinamicamente as cotações com base no andamento do jogo e transmite via WebSocket
   * @param {object} match - Estado atual da partida
   * @param {boolean} [isGoalEvent=false] - Indica se o recálculo foi provocado por um gol
   */
  recalculateAndBroadcast(match, isGoalEvent = false) {
    const { broadcast } = require('../websocket');
    const matchOdds = this.currentOdds.get(match.id_partida);
    if (!matchOdds || match.status_partida !== 'AO_VIVO') return;

    const diff = match.placar_casa - match.placar_fora;
    const progress = Math.min(1.0, match.minuto_jogo / (match.tempo_maximo || 90));

    // Flutuação natural aleatória de mercado (+/- 0.03)
    const jitter = () => (Math.random() - 0.5) * 0.06;

    // --- RECALCULO MERCADO 1X2 ---
    const mercado1X2 = matchOdds['1X2'];
    if (mercado1X2) {
      let novaCasa = mercado1X2.CASA.odd;
      let novaEmpate = mercado1X2.EMPATE ? mercado1X2.EMPATE.odd : null;
      let novaFora = mercado1X2.FORA.odd;

      if (diff > 0) {
        // Time da casa vencendo: a probabilidade de vitória aumenta com o tempo decorrido
        novaCasa = Math.max(1.08, 1.90 - (progress * 0.7) - (diff * 0.25) + jitter());
        novaFora = Math.min(15.00, 3.20 + (progress * 4.0) + (diff * 1.5) + jitter());
        if (novaEmpate) {
          novaEmpate = Math.min(10.00, 3.00 + (progress * 2.5) + (diff * 0.8) + jitter());
        }
      } else if (diff < 0) {
        // Time de fora vencendo
        const absDiff = Math.abs(diff);
        novaFora = Math.max(1.08, 1.90 - (progress * 0.7) - (absDiff * 0.25) + jitter());
        novaCasa = Math.min(15.00, 3.20 + (progress * 4.0) + (absDiff * 1.5) + jitter());
        if (novaEmpate) {
          novaEmpate = Math.min(10.00, 3.00 + (progress * 2.5) + (absDiff * 0.8) + jitter());
        }
      } else {
        // Jogo empatado (diff === 0)
        // Conforme o jogo se aproxima do final empatado, a odd do empate cai
        if (novaEmpate) {
          novaEmpate = Math.max(1.40, 3.20 - (progress * 1.2) + jitter());
          novaCasa = Math.min(6.00, 2.30 + (progress * 0.8) + jitter());
          novaFora = Math.min(6.00, 2.50 + (progress * 0.8) + jitter());
        } else {
          // Basquete (sem empate)
          novaCasa = Math.max(1.10, 1.90 + jitter());
          novaFora = Math.max(1.10, 1.90 - jitter());
        }
      }

      // Aplica atualização das odds com detecção de direção (UP, DOWN, STABLE)
      this._updateSelectionOdd(mercado1X2.CASA, novaCasa);
      this._updateSelectionOdd(mercado1X2.FORA, novaFora);
      if (mercado1X2.EMPATE && novaEmpate) {
        this._updateSelectionOdd(mercado1X2.EMPATE, novaEmpate);
      }

      // Prepara payload de broadcast padronizado conforme especificação RF-02
      const oddsPayload = {
        CASA: mercado1X2.CASA.odd,
        FORA: mercado1X2.FORA.odd
      };
      const directionsPayload = {
        CASA: mercado1X2.CASA.direction,
        FORA: mercado1X2.FORA.direction
      };

      if (mercado1X2.EMPATE) {
        oddsPayload.EMPATE = mercado1X2.EMPATE.odd;
        directionsPayload.EMPATE = mercado1X2.EMPATE.direction;
      }

      // [RF-02] Transmissão Broadcast ODDS_UPDATE via WebSocket em JSON
      broadcast('ODDS_UPDATE', {
        matchId: match.id_partida,
        nomeMercado: '1X2',
        odds: oddsPayload,
        directions: directionsPayload,
        isGoalEvent,
        timestamp: new Date().toISOString()
      });

      this.emit('odds_updated', {
        matchId: match.id_partida,
        mercado: '1X2',
        odds: oddsPayload,
        directions: directionsPayload
      });
    }
  }

  /**
   * Atualiza uma cotação individual e determina se subiu ('UP') ou desceu ('DOWN')
   * @private
   */
  _updateSelectionOdd(item, rawOdd) {
    const formatted = parseFloat(Math.max(1.05, rawOdd).toFixed(2));
    item.previous = item.odd;
    item.odd = formatted;

    if (item.odd > item.previous) {
      item.direction = 'UP';
    } else if (item.odd < item.previous) {
      item.direction = 'DOWN';
    } else {
      item.direction = 'STABLE';
    }
  }

  /**
   * Retorna todas as odds atuais de uma partida
   * @param {number} matchId 
   * @returns {object|null}
   */
  getOddsByMatch(matchId) {
    const matchOdds = this.currentOdds.get(parseInt(matchId, 10));
    if (!matchOdds) return null;

    const formatted = {};
    for (const [marketName, selections] of Object.entries(matchOdds)) {
      formatted[marketName] = {};
      for (const [option, data] of Object.entries(selections)) {
        formatted[marketName][option] = {
          odd: data.odd,
          direction: data.direction,
          id_mercado: data.id_mercado
        };
      }
    }
    return formatted;
  }

  /**
   * Retorna a cotação de uma seleção específica
   * @param {number} matchId 
   * @param {string} mercado 
   * @param {string} selecao 
   * @returns {number|null}
   */
  getSpecificOdd(matchId, mercado = '1X2', selecao = 'CASA') {
    const matchOdds = this.currentOdds.get(parseInt(matchId, 10));
    if (!matchOdds || !matchOdds[mercado] || !matchOdds[mercado][selecao]) {
      return null;
    }
    return matchOdds[mercado][selecao].odd;
  }
}

module.exports = new OddsEngineService();
