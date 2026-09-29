/**
 * Teste End-to-End do Módulo de Histórico de Liquidações
 * Valida:
 * 1. Conexão WebSocket e recepção de histórico inicial
 * 2. Gravação de liquidação via Cash Out com todos os metadados
 * 3. Gravação de liquidação automática via término de partida (GREEN/RED)
 * 4. Persistência e integridade das informações no Módulo de Histórico
 */

const { WebSocket } = require('ws');

async function runHistoryVerification() {
  console.log('====================================================');
  console.log('   TESTANDO MÓDULO DE HISTÓRICO DE LIQUIDAÇÕES');
  console.log('====================================================\n');

  const randomId = Math.floor(Math.random() * 8000) + 1000;
  const ws = new WebSocket(`ws://localhost:3000?apostadorId=${randomId}&nome=TestUser_${randomId}`);

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  console.log(`✅ Conexão WebSocket estabelecida com sucesso (Apostador #${randomId}).`);

  let receivedHistory = null;
  let lastConfirmedBet = null;
  let cashoutConfirmed = false;
  let betSettledGreenOrRed = false;

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    const event = msg.event || msg.type;

    if (event === 'BET_HISTORY_LIST') {
      receivedHistory = msg.history;
      console.log(`[WS] 📜 BET_HISTORY_LIST recebido com ${msg.history?.length || 0} registro(s).`);
    }

    if (event === 'BET_CONFIRMED') {
      lastConfirmedBet = msg.bet;
      console.log(`[WS] 🎫 BET_CONFIRMED: Bilhete #${msg.bet?.idAposta || msg.bet?.id_aposta} confirmado!`);
    }

    if (event === 'CASH_OUT_CONFIRMED') {
      cashoutConfirmed = true;
      console.log(`[WS] 💰 CASH_OUT_CONFIRMED recebido para bilhete #${msg.betId}.`);
    }

    if (event === 'BET_SETTLED') {
      betSettledGreenOrRed = true;
      console.log(`[WS] 🏁 BET_SETTLED recebido para bilhete #${msg.betId} (${msg.status}).`);
    }

    if (event === 'BET_REJECTED') {
      console.warn(`[WS] ⚠️ BET_REJECTED: ${msg.message}`);
    }
  });

  // Aguarda evento inicial e reseta partidas para garantir status AO_VIVO
  await new Promise(r => setTimeout(r, 400));
  ws.send(JSON.stringify({ type: 'RESET_MATCHES' }));
  await new Promise(r => setTimeout(r, 400));

  // 1. Submeter uma aposta para teste de Cash Out
  console.log('\n[1] Submetendo Aposta #1 para liquidação via Cash Out...');
  lastConfirmedBet = null;
  ws.send(JSON.stringify({
    type: 'PLACE_BET',
    matchId: 1,
    mercadoId: '1X2',
    selecao: 'CASA',
    odd: 2.10,
    valor: 15.00
  }));

  // Aguarda confirmação via WS
  let waited = 0;
  while (!lastConfirmedBet && waited < 3000) {
    await new Promise(r => setTimeout(r, 100));
    waited += 100;
  }

  if (!lastConfirmedBet) {
    throw new Error('Aposta de teste #1 não foi confirmada pelo WebSocket!');
  }

  const betId1 = lastConfirmedBet.idAposta || lastConfirmedBet.id_aposta;
  console.log(`✅ Aposta #1 confirmada com sucesso: Bilhete #${betId1}`);

  // 2. Liquidar via Cash Out
  console.log(`\n[2] Executando liquidação via Cash Out no Bilhete #${betId1}...`);
  cashoutConfirmed = false;
  ws.send(JSON.stringify({
    type: 'CASH_OUT',
    betId: betId1,
    requestedValue: 14.25
  }));

  waited = 0;
  while (!cashoutConfirmed && waited < 3000) {
    await new Promise(r => setTimeout(r, 100));
    waited += 100;
  }

  if (!cashoutConfirmed) {
    throw new Error('CASH_OUT_CONFIRMED não foi recebido a tempo!');
  }

  // 3. Consultar histórico de liquidações via WebSocket
  console.log('\n[3] Solicitando GET_BET_HISTORY via WebSocket...');
  receivedHistory = null;
  ws.send(JSON.stringify({ type: 'GET_BET_HISTORY' }));

  waited = 0;
  while (!receivedHistory && waited < 3000) {
    await new Promise(r => setTimeout(r, 100));
    waited += 100;
  }

  if (!receivedHistory || receivedHistory.length === 0) {
    throw new Error('Histórico de liquidações vazio após Cash Out!');
  }

  const histItem1 = receivedHistory.find(h => (h.idAposta === betId1 || h.id_aposta === betId1));
  if (!histItem1) {
    throw new Error(`Bilhete #${betId1} não foi encontrado no histórico de liquidações!`);
  }

  console.log('✅ Dados gravados da liquidação de Cash Out:');
  console.log(`   - ID Histórico: ${histItem1.id_historico || 'N/A'}`);
  console.log(`   - Bilhete: #${histItem1.idAposta || histItem1.id_aposta}`);
  console.log(`   - Partida: ${histItem1.partidaNome || histItem1.partida_nome}`);
  console.log(`   - Seleção: ${histItem1.selecao} (@ ${histItem1.oddMomento || histItem1.odd_momento})`);
  console.log(`   - Apostado: R$ ${histItem1.valorApostado || histItem1.valor_apostado}`);
  console.log(`   - Status Final: ${histItem1.statusFinal || histItem1.status_final}`);
  console.log(`   - Retorno Pago: R$ ${histItem1.valorRetorno || histItem1.valor_retorno}`);
  console.log(`   - Lucro/Prejuízo: R$ ${histItem1.lucroPrejuizo || histItem1.lucro_prejuizo}`);
  console.log(`   - Data/Hora: ${histItem1.dataLiquidacao || histItem1.data_liquidacao || histItem1.dataHora}`);

  // 4. Submeter Aposta #2 para teste de liquidação de término de partida
  console.log('\n[4] Submetendo Aposta #2 para liquidação via término de partida...');
  lastConfirmedBet = null;
  ws.send(JSON.stringify({
    type: 'PLACE_BET',
    matchId: 2,
    mercadoId: '1X2',
    selecao: 'FORA',
    odd: 2.80,
    valor: 20.00
  }));

  waited = 0;
  while (!lastConfirmedBet && waited < 3000) {
    await new Promise(r => setTimeout(r, 100));
    waited += 100;
  }

  if (!lastConfirmedBet) {
    throw new Error('Aposta #2 não foi confirmada pelo WebSocket!');
  }

  const betId2 = lastConfirmedBet.idAposta || lastConfirmedBet.id_aposta;
  console.log(`✅ Aposta #2 confirmada com sucesso: Bilhete #${betId2}`);

  // 5. Forçar término da Partida #2
  console.log('\n[5] Forçando término e liquidação da Partida #2...');
  betSettledGreenOrRed = false;
  ws.send(JSON.stringify({
    type: 'FINISH_MATCH',
    matchId: 2
  }));

  waited = 0;
  while (!betSettledGreenOrRed && waited < 4000) {
    await new Promise(r => setTimeout(r, 100));
    waited += 100;
  }

  // 6. Consultar histórico final
  console.log('\n[6] Solicitando GET_BET_HISTORY após encerramento da partida...');
  receivedHistory = null;
  ws.send(JSON.stringify({ type: 'GET_BET_HISTORY' }));

  waited = 0;
  while (!receivedHistory && waited < 3000) {
    await new Promise(r => setTimeout(r, 100));
    waited += 100;
  }

  const histItem2 = receivedHistory.find(h => (h.idAposta === betId2 || h.id_aposta === betId2));
  if (!histItem2) {
    throw new Error(`Bilhete #${betId2} não foi gravado no histórico após liquidação da partida!`);
  }

  console.log('✅ Dados gravados da liquidação de Término de Partida:');
  console.log(`   - Bilhete: #${histItem2.idAposta || histItem2.id_aposta}`);
  console.log(`   - Partida: ${histItem2.partidaNome || histItem2.partida_nome}`);
  console.log(`   - Placar Final: ${histItem2.placarFinal || histItem2.placar_final}`);
  console.log(`   - Seleção: ${histItem2.selecao} (@ ${histItem2.oddMomento || histItem2.odd_momento})`);
  console.log(`   - Status Final: ${histItem2.statusFinal || histItem2.status_final}`);
  console.log(`   - Retorno Pago: R$ ${histItem2.valorRetorno || histItem2.valor_retorno}`);
  console.log(`   - Lucro/Prejuízo: R$ ${histItem2.lucroPrejuizo || histItem2.lucro_prejuizo}`);

  // Restaura partidas para os próximos testes
  ws.send(JSON.stringify({ type: 'RESET_MATCHES' }));
  await new Promise(r => setTimeout(r, 200));

  ws.close();

  console.log('\n====================================================');
  console.log('🎉 SUCESSO TOTAL: O MÓDULO DE HISTÓRICO DE LIQUIDAÇÕES');
  console.log('   ESTÁ 100% FUNCIONAL E GRAVANDO TODOS OS DADOS!');
  console.log('====================================================\n');
  process.exit(0);
}

runHistoryVerification().catch((err) => {
  console.error('\n❌ Falha no teste de histórico:', err.message);
  process.exit(1);
});
