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
      break;

    case 'BALANCE_UPDATE':
      logEvent('SALDO', `Atualização de Carteira [${payload.motivo}]: R$ ${payload.saldo?.toFixed(2)}`, 'ev-green');
      updateBalanceUI(payload.saldo);
      break;

    case 'ODDS_UPDATE':
      logEvent('ODDS', `Cotações atualizadas para o jogo ${payload.matchId}`, 'ev-blue');
      break;

    case 'GOAL':
      logEvent('GOL', `GOL na partida ${payload.matchId}! Placar: ${payload.placarCasa} x ${payload.placarFora}`, 'ev-green');
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
