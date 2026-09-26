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
const activeBetsMap = new Map(); // Map<betId, bet>

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
      // Solicita a lista de apostas ativas da sessão
      window.sendWs('GET_ACTIVE_BETS');
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
      showGoalBanner(payload);
      updateMatchUI({ ...payload, status: 'SUSPENSA' });
      break;

    case 'MARKET_SUSPENDED':
      logEvent('SUSPENSÃO', `⚠️ Partida #${payload.matchId}: Mercado temporariamente suspenso!`, 'ev-red');
      updateMatchUI({ matchId: payload.matchId, status: 'SUSPENSA' });
      break;

    case 'MARKET_REOPENED':
      logEvent('MERCADO', `🔓 Partida #${payload.matchId}: Mercado reaberto com novas cotações!`, 'ev-green');
      updateMatchUI({ matchId: payload.matchId, status: 'AO_VIVO' });
      break;

    case 'BET_CONFIRMED':
      logEvent('APOSTA', `✅ Bilhete #${payload.bet?.idAposta} Confirmado: R$ ${payload.bet?.valorApostado?.toFixed(2)} (@ ${payload.bet?.oddMomento}) -> Retorno: R$ ${payload.bet?.retornoPotencial?.toFixed(2)}`, 'ev-green');
      if (payload.bet) {
        const id = payload.bet.idAposta || payload.bet.id_aposta;
        activeBetsMap.set(id, payload.bet);
        renderActiveBets();
      }
      if (typeof window.onBetConfirmed === 'function') {
        window.onBetConfirmed(payload);
      }
      break;

    case 'ACTIVE_BETS_LIST':
      if (Array.isArray(payload.bets)) {
        activeBetsMap.clear();
        payload.bets.forEach(b => {
          const id = b.idAposta || b.id_aposta;
          activeBetsMap.set(id, b);
        });
        renderActiveBets();
      }
      break;

    case 'CASHOUT_UPDATE':
      const cBet = activeBetsMap.get(payload.betId);
      if (cBet) {
        cBet.cashoutValue = payload.cashoutValue;
        updateCashoutButton(payload.betId, payload.cashoutValue);
      }
      break;

    case 'CASH_OUT_CONFIRMED':
      logEvent('CASHOUT', `💰 Cash Out #${payload.betId} Confirmado: R$ ${payload.valorResgatado?.toFixed(2)} creditados!`, 'ev-green');
      const cashedBet = activeBetsMap.get(payload.betId);
      if (cashedBet) {
        cashedBet.status = 'CASH_OUT';
        cashedBet.status_aposta = 'CASH_OUT';
        cashedBet.cashoutFinal = payload.valorResgatado;
        renderActiveBets();
      }
      break;

    case 'CASH_OUT_REJECTED':
      logEvent('CASHOUT_RECUSADO', `❌ Aposta #${payload.betId}: ${payload.message}`, 'ev-red');
      const btnRej = document.getElementById(`cashoutBtn-${payload.betId}`);
      if (btnRej) {
        btnRej.disabled = false;
        const currentOffer = activeBetsMap.get(payload.betId)?.cashoutValue || 0;
        btnRej.innerHTML = `<span>Encerrar Aposta</span> <span class="cashout-offer-val">R$ ${currentOffer.toFixed(2)}</span>`;
      }
      alert(`❌ CASH OUT REJEITADO:\n${payload.message}`);
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
 * Sintetizador nativo Web Audio API para alerta sonoro esportivo de Gol (RF-06)
 */
function playGoalSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // Sequência de acordes comemorativos (C5, E5, G5, C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);

      gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.35);
    });
  } catch (e) {
    console.warn('[Audio] Não foi possível reproduzir som de gol:', e);
  }
}

/**
 * Exibe o banner pop-up de Gol e suspensão de mercado com animação (RF-06)
 */
function showGoalBanner(payload) {
  const overlay = document.getElementById('goalPopupOverlay');
  const titleEl = document.getElementById('goalPopupTitle');
  const scoreEl = document.getElementById('goalPopupScore');
  if (!overlay) return;

  const autor = payload.timeAutor || 'Time';
  const timeCasa = payload.timeCasa || 'Casa';
  const timeFora = payload.timeFora || 'Fora';
  const placarCasa = payload.placarCasa !== undefined ? payload.placarCasa : 0;
  const placarFora = payload.placarFora !== undefined ? payload.placarFora : 0;

  if (titleEl) titleEl.textContent = `⚽ Gol do ${autor}!`;
  if (scoreEl) scoreEl.textContent = `${timeCasa} ${placarCasa} x ${placarFora} ${timeFora}`;

  overlay.classList.add('active');
  playGoalSound();

  // O banner pop-up permanece ativo por 3.5 segundos
  setTimeout(() => {
    overlay.classList.remove('active');
  }, 3500);
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

  // Faixa de mercado suspenso
  let strip = card.querySelector('.market-suspended-strip');
  if (status === 'SUSPENSA') {
    card.classList.add('suspended');
    if (!strip) {
      strip = document.createElement('div');
      strip.className = 'market-suspended-strip';
      strip.innerHTML = `<span>🔒 MERCADO SUSPENSO (CONGELAMENTO DE ODDS)</span>`;
      card.appendChild(strip);
    }
  } else {
    card.classList.remove('suspended');
    if (strip) strip.remove();
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

/**
 * Renderiza os bilhetes de aposta ativos no painel lateral com ofertas dinâmicas de Cash Out
 */
function renderActiveBets() {
  const listEl = document.getElementById('activeBetsList');
  const countEl = document.getElementById('activeBetsCount');
  if (!listEl) return;

  const bets = Array.from(activeBetsMap.values());
  const activeCount = bets.filter(b => (b.status === 'ATIVA' || b.status_aposta === 'ATIVA')).length;
  if (countEl) countEl.textContent = activeCount;

  if (bets.length === 0) {
    listEl.innerHTML = `<div class="active-bets-empty">Nenhuma aposta ativa no momento.</div>`;
    return;
  }

  listEl.innerHTML = '';
  bets.slice().reverse().forEach(bet => {
    const id = bet.idAposta || bet.id_aposta;
    const matchName = bet.partidaNome || (bet.time_casa ? `${bet.time_casa} x ${bet.time_fora}` : `Partida #${bet.matchId || bet.id_partida}`);
    const mercado = bet.mercado || bet.nome_mercado || '1X2';
    const selecao = bet.selecao || bet.opcao_selecao || 'CASA';
    const odd = Number(bet.oddMomento || bet.odd_momento || 1).toFixed(2);
    const valorApostado = Number(bet.valorApostado || bet.valor_apostado || 0).toFixed(2);
    const retornoPotencial = Number(bet.retornoPotencial || bet.retorno_potencial || 0).toFixed(2);
    const status = bet.status || bet.status_aposta || 'ATIVA';
    
    // Oferta instantânea (se ainda não veio CASHOUT_UPDATE, usa 95% do valor apostado como estimativa inicial)
    const offerVal = bet.cashoutValue !== undefined ? Number(bet.cashoutValue).toFixed(2) : (Number(valorApostado) * 0.95).toFixed(2);

    const item = document.createElement('div');
    item.className = 'active-bet-item';
    item.id = `betCard-${id}`;

    let actionHtml = '';
    if (status === 'CASH_OUT') {
      const finalVal = bet.cashoutFinal ? Number(bet.cashoutFinal).toFixed(2) : offerVal;
      actionHtml = `<div class="badge-cashed-out">✓ CASH OUT REALIZADO: R$ ${finalVal}</div>`;
    } else {
      actionHtml = `
        <div class="cashout-control">
          <button class="btn-cashout" id="cashoutBtn-${id}" onclick="requestCashOut(${id}, ${offerVal}, this)" title="Encerrar bilhete antecipadamente com valor garantido (RF-05)">
            <span>⚡ Cash Out</span>
            <span class="cashout-offer-val" id="cashoutVal-${id}">R$ ${offerVal}</span>
          </button>
        </div>
      `;
    }

    item.innerHTML = `
      <div class="bet-item-header">
        <span class="bet-item-match">${matchName}</span>
        <span class="bet-item-id">#${id}</span>
      </div>
      <div class="bet-item-selection">
        <span>${mercado}: ${selecao}</span>
        <span>@ ${odd}</span>
      </div>
      <div class="bet-item-financials">
        <span>Apostado: <strong>R$ ${valorApostado}</strong></span>
        <span>Retorno: <strong style="color: var(--accent-gold);">R$ ${retornoPotencial}</strong></span>
      </div>
      ${actionHtml}
    `;

    listEl.appendChild(item);
  });
}

/**
 * Atualiza o botão de Cash Out de um bilhete específico com nova cotação e microanimação (RF-04)
 */
function updateCashoutButton(betId, newValue) {
  const valEl = document.getElementById(`cashoutVal-${betId}`);
  const btnEl = document.getElementById(`cashoutBtn-${betId}`);
  if (!valEl || !btnEl) return;

  const formatted = Number(newValue).toFixed(2);
  valEl.textContent = `R$ ${formatted}`;

  // Atualiza também o handler de clique com a nova cotação
  btnEl.onclick = () => requestCashOut(betId, parseFloat(formatted), btnEl);

  // Efeito de pulso para feedback de tempo real
  btnEl.classList.remove('cashout-pulse');
  void btnEl.offsetWidth; // Reflow
  btnEl.classList.add('cashout-pulse');
}

/**
 * Submete requisição de Cash Out via WebSocket com trava preventiva (RF-05 / RNF-01)
 */
window.requestCashOut = function(betId, offerVal, btnEl) {
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = `<span>⏳ Encerrando...</span>`;
  }

  logEvent('CASHOUT', `Solicitando Cash Out para bilhete #${betId} (Oferta: R$ ${Number(offerVal).toFixed(2)})...`, 'ev-blue');

  window.sendWs('CASH_OUT', {
    betId: parseInt(betId, 10),
    requestedValue: parseFloat(offerVal)
  });
};
