/**
 * PROBABET - CLIENTE WEBSOCKET EM TEMPO REAL
 * Responsável pela comunicação bidirecional com o backend Node.js
 */

const WS_PORT = window.location.port || '3000';
const WS_HOST = window.location.hostname || 'localhost';
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${WS_HOST}:${WS_PORT}?apostadorId=1`;

let socket = null;
let reconnectTimer = null;
let currentApostador = null;

// Elementos da Interface
const wsStatusDot = document.getElementById('wsStatusDot');
const wsStatusText = document.getElementById('wsStatusText');
const walletAmountEl = document.getElementById('walletAmount');
const userNameEl = document.getElementById('userName');
const consoleBodyEl = document.getElementById('consoleBody');

/**
 * Adiciona uma mensagem ao feed de eventos em tempo real
 */
function logEvent(tag, message, colorClass = 'ev-blue') {
  if (!consoleBodyEl) return;
  const time = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.className = 'console-line';
  line.innerHTML = `<span class="time">[${time}]</span> <span class="${colorClass}">[${tag}]</span> ${message}`;
  consoleBodyEl.prepend(line);
}

/**
 * Atualiza o saldo exibido no topo da tela com microanimação
 */
function updateBalanceUI(novoSaldo) {
  if (!walletAmountEl) return;
  const formatado = Number(novoSaldo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  walletAmountEl.textContent = `R$ ${formatado}`;
  walletAmountEl.classList.add('updated');
  setTimeout(() => walletAmountEl.classList.remove('updated'), 600);
}

/**
 * Conecta e gerencia o ciclo de vida do WebSocket
 */
function initWebSocket() {
  logEvent('CONEXAO', `Iniciando conexão com ${WS_URL}...`, 'ev-blue');

  try {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      if (wsStatusDot) wsStatusDot.classList.add('connected');
      if (wsStatusText) wsStatusText.textContent = 'WS Conectado (3000)';
      logEvent('WEBSOCKET', 'Canal Full-Duplex persistente aberto!', 'ev-green');
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerEvent(data);
      } catch (err) {
        console.error('Erro ao analisar mensagem JSON:', err);
      }
    };

    socket.onclose = (e) => {
      if (wsStatusDot) wsStatusDot.classList.remove('connected');
      if (wsStatusText) wsStatusText.textContent = 'WS Desconectado';
      logEvent('AVISO', `Conexão fechada. Reconectando em 3s...`, 'ev-red');
      
      // Auto-reconexão
      reconnectTimer = setTimeout(initWebSocket, 3000);
    };

    socket.onerror = (err) => {
      console.error('[WebSocket Error]:', err);
    };

  } catch (error) {
    console.error('Falha ao abrir socket:', error);
  }
}

/**
 * Trata os eventos padronizados recebidos do servidor
 */
function handleServerEvent(payload) {
  const eventName = payload.event || payload.type;

  switch (eventName) {
    case 'CONNECTION_ESTABLISHED':
      logEvent('HANDSHAKE', `Conectado! Apostador: ${payload.apostador?.nome} (R$ ${payload.saldo?.toFixed(2)})`, 'ev-green');
      if (payload.apostador) {
        currentApostador = payload.apostador;
        if (userNameEl) userNameEl.textContent = payload.apostador.nome;
      }
      if (payload.saldo !== undefined) {
        updateBalanceUI(payload.saldo);
      }
      // Sincroniza o estado atual das partidas imediatamente no handshake
      if (Array.isArray(payload.matches)) {
        payload.matches.forEach(m => updateMatchUI(m));
      }
      break;

    case 'BALANCE_UPDATE':
      logEvent('SALDO', `Atualização de Carteira [${payload.motivo}]: R$ ${payload.saldo?.toFixed(2)}`, 'ev-green');
      updateBalanceUI(payload.saldo);
      break;

    case 'MATCH_UPDATE':
      updateMatchUI(payload);
      break;

    case 'MATCHES_LIST':
      if (Array.isArray(payload.matches)) {
        payload.matches.forEach(m => updateMatchUI(m));
      }
      break;

    case 'MATCH_FINISHED':
      logEvent('FIM', `Partida ${payload.matchId} Encerrada! Placar: ${payload.placarCasa} x ${payload.placarFora}`, 'ev-red');
      updateMatchUI(payload);
      break;

    case 'ODDS_UPDATE':
      updateOddsUI(payload);
      const casasInfo = payload.odds?.CASA ? `CASA @ ${payload.odds.CASA}` : '';
      const empateInfo = payload.odds?.EMPATE ? ` | EMPATE @ ${payload.odds.EMPATE}` : '';
      const foraInfo = payload.odds?.FORA ? ` | FORA @ ${payload.odds.FORA}` : '';
      logEvent('ODDS', `Jogo ${payload.matchId}: ${casasInfo}${empateInfo}${foraInfo}`, 'ev-blue');
      break;

    case 'GOAL':
      logEvent('GOL', `⚽ GOOOL na partida ${payload.matchId}! ${payload.timeAutor} marcou! (${payload.placarCasa} x ${payload.placarFora})`, 'ev-green');
      updateMatchUI(payload);
      // Efeito visual no card da partida
      const cardGoal = document.querySelector(`.match-card[data-match-id="${payload.matchId}"]`);
      if (cardGoal) {
        cardGoal.style.boxShadow = '0 0 25px rgba(0, 230, 118, 0.6)';
        setTimeout(() => { cardGoal.style.boxShadow = ''; }, 2500);
      }
      break;

    case 'BET_CONFIRMED':
      logEvent('APOSTA', `✅ Bilhete #${payload.bet?.idAposta} Confirmado: R$ ${payload.bet?.valorApostado?.toFixed(2)} (@ ${payload.bet?.oddMomento}) -> Retorno: R$ ${payload.bet?.retornoPotencial?.toFixed(2)}`, 'ev-green');
      if (typeof window.onBetConfirmed === 'function') {
        window.onBetConfirmed(payload);
      }
      break;

    case 'BET_REJECTED':
      logEvent('REJEITADA', `❌ ${payload.message}`, 'ev-red');
      if (typeof window.onBetRejected === 'function') {
        window.onBetRejected(payload);
      }
      break;

    case 'PONG':
      logEvent('PONG', 'Heartbeat confirmado pelo servidor', 'ev-blue');
      break;

    default:
      logEvent('EVENTO', `${eventName}: ${JSON.stringify(payload)}`, 'ev-blue');
      break;
  }
}

/**
 * Atualiza placares e relógio do card da partida dinamicamente
 */
function updateMatchUI(m) {
  const matchId = m.matchId || m.id_partida;
  const card = document.querySelector(`.match-card[data-match-id="${matchId}"]`);
  if (!card) return;

  const scoreCasaEl = document.getElementById(`scoreCasa-${matchId}`);
  const scoreForaEl = document.getElementById(`scoreFora-${matchId}`);
  const timeEl = card.querySelector('.match-time');

  const placarCasa = m.placarCasa !== undefined ? m.placarCasa : m.placar_casa;
  const placarFora = m.placarFora !== undefined ? m.placarFora : m.placar_fora;
  const minuto = m.minuto !== undefined ? m.minuto : m.minuto_jogo;

  const status = m.status || m.status_partida || 'AO_VIVO';

  if (scoreCasaEl && placarCasa !== undefined) scoreCasaEl.textContent = placarCasa;
  if (scoreForaEl && placarFora !== undefined) scoreForaEl.textContent = placarFora;
  if (timeEl && minuto !== undefined) {
    if (status === 'ENCERRADA') {
      timeEl.innerHTML = `<span style="color: #ef4444; font-weight: bold;">⏱️ ENCERRADA</span>`;
    } else if (status === 'SUSPENSA') {
      timeEl.innerHTML = `<span style="color: #f59e0b; font-weight: bold;">⚠️ SUSPENSA</span>`;
    } else {
      timeEl.textContent = `⏱️ ${minuto}' AO VIVO`;
    }
  }

  // Desativa os botões de aposta caso o jogo esteja ENCERRADO ou SUSPENSO
  const oddButtons = card.querySelectorAll('.odd-btn');
  if (status === 'ENCERRADA' || status === 'SUSPENSA') {
    oddButtons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.35';
      btn.style.cursor = 'not-allowed';
      btn.setAttribute('title', `Mercado não disponível: Partida ${status}`);
    });
  } else {
    oddButtons.forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.removeAttribute('title');
    });
  }
}

/**
 * Atualiza cotações das odds com feedback visual de subida (verde) e descida (vermelho) (RF-02)
 */
function updateOddsUI(payload) {
  const matchId = payload.matchId;
  const odds = payload.odds;
  const directions = payload.directions || {};

  if (!odds) return;

  for (const [selecao, oddVal] of Object.entries(odds)) {
    const oddEl = document.getElementById(`odd-${matchId}-${selecao}`);
    if (!oddEl) continue;

    const formattedOdd = typeof oddVal === 'number' ? oddVal.toFixed(2) : (oddVal.odd ? oddVal.odd.toFixed(2) : oddVal);
    oddEl.textContent = formattedOdd;

    const direction = directions[selecao] || (oddVal.direction);
    if (direction === 'UP') {
      oddEl.classList.remove('down');
      oddEl.classList.add('up');
      setTimeout(() => oddEl.classList.remove('up'), 1500);
    } else if (direction === 'DOWN') {
      oddEl.classList.remove('up');
      oddEl.classList.add('down');
      setTimeout(() => oddEl.classList.remove('down'), 1500);
    }

    // Se o usuário estiver com essa odd selecionada na Caderneta (Bet Slip), atualiza dinamicamente!
    if (window.currentSelection && 
        window.currentSelection.matchId === matchId && 
        window.currentSelection.option === selecao) {
      window.currentSelection.odd = parseFloat(formattedOdd);
      const betslipOddEl = document.getElementById('betslipOdd');
      if (betslipOddEl) {
        betslipOddEl.textContent = `@ ${formattedOdd}`;
      }
      if (typeof window.calculateReturn === 'function') {
        window.calculateReturn();
      }
    }
  }
}

/**
 * Função global para envio de mensagens
 */
window.sendWs = function(type, payload = {}) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, ...payload }));
  } else {
    console.warn('WebSocket não está aberto para envio.');
  }
};

// Inicialização imediata ao carregar a página
window.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
});
