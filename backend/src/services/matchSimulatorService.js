const EventEmitter = require('events');
const PartidaEsportiva = require('../models/PartidaEsportiva');

/**
 * MOTOR DE SIMULAÇÃO DE PARTIDAS EM TEMPO REAL
 * Responsável por controlar o relógio dos jogos, placares e eventos da partida.
 */
class MatchSimulatorService extends EventEmitter {
  constructor() {
    super();
    this.matches = new Map();
    this.intervalId = null;
    this.isRunning = false;
    this.tickIntervalMs = 2500; // Atualizações a cada 2.5s (conforme RF-02: 2 a 3 segundos)

    this._initializeDefaultMatches();
  }

  /**
   * Inicializa o estado em memória das partidas (com dados semente)
   * @private
   */
  _initializeDefaultMatches() {
    const defaultData = [
      {
        id_partida: 1,
        modalidade_esportiva: 'Futebol',
        time_casa: 'Flamengo',
        time_fora: 'Palmeiras',
        placar_casa: 0,
        placar_fora: 0,
        minuto_jogo: 18,
        tempo_maximo: 90,
        status_partida: 'AO_VIVO',
        chance_evento_por_tick: 0.12 // 12% de chance de evento relevante
      },
      {
        id_partida: 2,
        modalidade_esportiva: 'Futebol',
        time_casa: 'Real Madrid',
        time_fora: 'Barcelona',
        placar_casa: 1,
        placar_fora: 1,
        minuto_jogo: 42,
        tempo_maximo: 90,
        status_partida: 'AO_VIVO',
        chance_evento_por_tick: 0.14
      },
      {
        id_partida: 3,
        modalidade_esportiva: 'Basquete',
        time_casa: 'LA Lakers',
        time_fora: 'Boston Celtics',
        placar_casa: 85,
        placar_fora: 82,
        minuto_jogo: 32,
        tempo_maximo: 48,
        status_partida: 'AO_VIVO',
        chance_evento_por_tick: 0.40 // Basquete pontua com frequência
      }
    ];

    defaultData.forEach(match => this.matches.set(match.id_partida, match));
  }

  /**
   * Sincroniza partidas do banco de dados (se o PostgreSQL estiver online)
   */
  async loadMatchesFromDatabase() {
    try {
      const dbMatches = await PartidaEsportiva.findAll();
      if (dbMatches && dbMatches.length > 0) {
        dbMatches.forEach(dbm => {
          const current = this.matches.get(dbm.id_partida) || {};
          this.matches.set(dbm.id_partida, {
            ...current,
            ...dbm,
            tempo_maximo: dbm.modalidade_esportiva === 'Basquete' ? 48 : 90,
            chance_evento_por_tick: dbm.modalidade_esportiva === 'Basquete' ? 0.40 : 0.12
          });
        });
        console.log(`[Simulador] ${dbMatches.length} partidas sincronizadas com o banco de dados.`);
      }
    } catch (e) {
      console.log('[Simulador] Banco de dados offline. Operando com partidas em memória.');
    }
  }

  /**
   * Inicia o motor de simulação contínua
   */
  startSimulation() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`[Simulador] Motor de partidas iniciado (Ciclo: ${this.tickIntervalMs}ms).`);

    this.intervalId = setInterval(() => {
      this._simulationTick();
    }, this.tickIntervalMs);
  }

  /**
   * Para a simulação
   */
  stopSimulation() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[Simulador] Motor de partidas pausado.');
  }

  /**
   * Ciclo individual de simulação (Tick)
   * @private
   */
  _simulationTick() {
    const { broadcast } = require('../websocket');

    for (const match of this.matches.values()) {
      if (match.status_partida !== 'AO_VIVO') {
        continue;
      }

      // 1. Avança o cronômetro do jogo
      match.minuto_jogo += 1;

      // 2. Simulação de eventos (Gols ou Cestas)
      const sorteio = Math.random();

      if (sorteio < match.chance_evento_por_tick) {
        if (match.modalidade_esportiva === 'Basquete') {
          // No basquete, pontuações de 2 ou 3 pontos
          const pontuador = Math.random() > 0.5 ? 'CASA' : 'FORA';
          const pontos = Math.random() > 0.6 ? 3 : 2;
          if (pontuador === 'CASA') match.placar_casa += pontos;
          else match.placar_fora += pontos;
        } else {
          // No futebol, chance real de gol
          if (Math.random() < 0.15) { // 15% de chance de o evento ser gol
            const autorGol = Math.random() > 0.5 ? 'CASA' : 'FORA';
            if (autorGol === 'CASA') match.placar_casa += 1;
            else match.placar_fora += 1;

            // Dispara evento GOAL (RF-06)
            this._notifyGoal(match, autorGol);
          }
        }
      }

      // 3. Verifica término da partida
      if (match.minuto_jogo >= match.tempo_maximo) {
        match.status_partida = 'ENCERRADA';
        console.log(`[Simulador] Partida ${match.id_partida} (${match.time_casa} x ${match.time_fora}) ENCERRADA! Placar Final: ${match.placar_casa} x ${match.placar_fora}`);
        
        // Emite evento de partida finalizada (para Liquidação RF-07)
        this.emit('match_finished', match);

        broadcast('MATCH_FINISHED', {
          matchId: match.id_partida,
          placarCasa: match.placar_casa,
          placarFora: match.placar_fora,
          status: 'ENCERRADA'
        });
      }

      // 4. Emite evento interno de ciclo para outros módulos (ex: Motor de Odds da Etapa 9)
      this.emit('match_tick', match);

      // 5. Transmite broadcast via WebSocket para todos os clientes conectados
      broadcast('MATCH_UPDATE', {
        matchId: match.id_partida,
        minuto: match.minuto_jogo,
        placarCasa: match.placar_casa,
        placarFora: match.placar_fora,
        status: match.status_partida
      });
    }
  }

  /**
   * Notifica a ocorrência de um gol e dispara evento GOAL prioritário (RF-06)
   * @private
   */
  _notifyGoal(match, autor) {
    const { broadcast } = require('../websocket');
    const timeAutor = autor === 'CASA' ? match.time_casa : match.time_fora;

    console.log(`[Simulador] ⚽ GOOOL do ${timeAutor}! ${match.time_casa} ${match.placar_casa} x ${match.placar_fora} ${match.time_fora} (${match.minuto_jogo}')`);

    // Notifica ouvintes internos (ex: trava de concorrência RNF-01 e suspensão RF-06)
    this.emit('goal', {
      match,
      autor,
      timeAutor,
      placarCasa: match.placar_casa,
      placarFora: match.placar_fora,
      minuto: match.minuto_jogo
    });

    // Transmite broadcast prioritário GOAL
    broadcast('GOAL', {
      matchId: match.id_partida,
      timeAutor,
      placarCasa: match.placar_casa,
      placarFora: match.placar_fora,
      minuto: match.minuto_jogo
    });
  }

  /**
   * Permite disparar um gol manualmente (útil para testes ou demonstração ao professor)
   */
  triggerManualGoal(partidaId, autor = 'CASA') {
    const match = this.matches.get(partidaId);
    if (!match || match.status_partida !== 'AO_VIVO') return false;

    if (autor === 'CASA') match.placar_casa += 1;
    else match.placar_fora += 1;

    this._notifyGoal(match, autor);
    return true;
  }

  /**
   * Retorna lista de todas as partidas
   * @returns {Array<object>}
   */
  getAllMatches() {
    return Array.from(this.matches.values());
  }

  /**
   * Retorna uma partida específica pelo ID
   * @param {number} id 
   * @returns {object|null}
   */
  getMatchById(id) {
    return this.matches.get(parseInt(id, 10)) || null;
  }
}

// Instância única (Singleton) para todo o servidor
module.exports = new MatchSimulatorService();
