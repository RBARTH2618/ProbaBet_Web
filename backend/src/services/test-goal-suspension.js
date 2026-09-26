/**
 * Teste Automatizado de Notificação de GOAL e Suspensão de Mercado (RF-06, RNF-01)
 * Executa: node src/services/test-goal-suspension.js
 */

const matchSimulatorService = require('./matchSimulatorService');
const oddsEngineService = require('./oddsEngineService');
const betService = require('./betService');
const cashoutService = require('./cashoutService');
const apostadorService = require('./apostadorService');

async function runGoalSuspensionTests() {
  console.log('====================================================');
  console.log('  INICIANDO BATERIA DE TESTES DE GOL E SUSPENSÃO (ETAPA 12)');
  console.log('====================================================');

  try {
    // 1. Inicializa o simulador e motor de odds em memória
    await matchSimulatorService.loadMatchesFromDatabase();
    oddsEngineService.bindToSimulator(matchSimulatorService);
    cashoutService.bindEvents();

    const matchId = 1;
    const match = matchSimulatorService.getMatchById(matchId);
    match.status_partida = 'AO_VIVO';
    const placarInicialCasa = match.placar_casa;
    console.log(`[TEST 1] Partida ${matchId} pronta: ${match.time_casa} ${match.placar_casa} x ${match.placar_fora} ${match.time_fora} (Status: ${match.status_partida})`);

    // Garante saldo para apostas
    await apostadorService.creditarSaldo(1, 100.00);

    // Cria um bilhete antes do gol para testar suspensão de Cash Out
    console.log('\n[TEST 2] Criando bilhete ativo antes do gol...');
    const betBeforeGoal = (await betService.placeBet({
      apostadorId: 1,
      matchId,
      mercadoId: '1X2',
      selecao: 'CASA',
      odd: 2.10,
      valor: 15.00
    })).bet;
    console.log(`[TEST 2] ✅ Bilhete #${betBeforeGoal.idAposta} criado com status ${betBeforeGoal.status}`);

    // 2. Dispara Gol Manual
    console.log('\n[TEST 3] Disparando Gol para o Flamengo (CASA)...');
    let goalReceived = false;
    matchSimulatorService.once('goal', (ev) => {
      goalReceived = true;
      console.log(`[TEST 3] ⚽ Evento interno de GOL capturado: ${ev.timeAutor} marcou! Placar: ${ev.placarCasa} x ${ev.placarFora}`);
    });

    const triggered = matchSimulatorService.triggerManualGoal(matchId, 'CASA');
    if (!triggered || !goalReceived) {
      throw new Error('Falha ao disparar ou capturar o evento de Gol.');
    }

    if (match.placar_casa !== placarInicialCasa + 1) {
      throw new Error(`Placar incorreto após o gol. Esperado: ${placarInicialCasa + 1}, Obtido: ${match.placar_casa}`);
    }

    // 3. Valida se o status mudou imediatamente para SUSPENSA (RF-06)
    console.log('\n[TEST 4] Validando congelamento/suspensão imediata do mercado (RF-06)...');
    if (match.status_partida !== 'SUSPENSA') {
      throw new Error(`A partida deveria estar SUSPENSA após o gol! Status atual: ${match.status_partida}`);
    }
    console.log(`[TEST 4] ✅ Partida congelada corretamente com status: ${match.status_partida}`);

    // 4. Valida se apostas novas são REJEITADAS durante a suspensão (RF-06 / RNF-01)
    console.log('\n[TEST 5] Testando rejeição de nova aposta durante mercado SUSPENSO...');
    let betBlocked = false;
    try {
      await betService.placeBet({
        apostadorId: 1,
        matchId,
        mercadoId: '1X2',
        selecao: 'FORA',
        odd: 3.50,
        valor: 10.00
      });
    } catch (err) {
      console.log(`[TEST 5] ✅ Aposta rejeitada com sucesso! Motivo: ${err.message} (Código: ${err.code})`);
      if (err.code === 'MARKET_SUSPENDED') betBlocked = true;
    }

    if (!betBlocked) {
      throw new Error('FALHA DE INTEGRIDADE: O sistema aceitou aposta em mercado suspenso!');
    }

    // 5. Valida se Cash Out é REJEITADO durante a suspensão (RNF-01)
    console.log('\n[TEST 6] Testando rejeição de Cash Out durante mercado SUSPENSO (RNF-01)...');
    let cashoutBlocked = false;
    try {
      await cashoutService.processCashOut({
        betId: betBeforeGoal.idAposta,
        apostadorId: 1
      });
    } catch (err) {
      console.log(`[TEST 6] ✅ Cash Out rejeitado com sucesso! Motivo: ${err.message} (Código: ${err.code})`);
      if (err.code === 'MARKET_SUSPENDED') cashoutBlocked = true;
    }

    if (!cashoutBlocked) {
      throw new Error('FALHA DE CONCORRÊNCIA (RNF-01): O sistema permitiu Cash Out com mercado suspenso!');
    }

    // 6. Aguarda reabertura automática do mercado (4 segundos)
    console.log('\n[TEST 7] Aguardando reabertura automática do mercado (4.2 segundos)...');
    await new Promise(resolve => setTimeout(resolve, 4200));

    if (match.status_partida !== 'AO_VIVO') {
      throw new Error(`A partida deveria ter reaberto para AO_VIVO! Status atual: ${match.status_partida}`);
    }
    console.log(`[TEST 7] ✅ Mercado reaberto automaticamente com status: ${match.status_partida}`);

    // 7. Valida se agora é possível apostar e fazer Cash Out normalmente
    console.log('\n[TEST 8] Validando retomada de operações pós-reabertura...');
    const postReopenBet = (await betService.placeBet({
      apostadorId: 1,
      matchId,
      mercadoId: '1X2',
      selecao: 'CASA',
      odd: 1.80,
      valor: 10.00
    })).bet;
    console.log(`[TEST 8] ✅ Nova aposta aceita com sucesso após reabertura! Bilhete #${postReopenBet.idAposta}`);

    const cashoutAfter = await cashoutService.processCashOut({
      betId: betBeforeGoal.idAposta,
      apostadorId: 1
    });
    console.log(`[TEST 8] ✅ Cash Out concluído com sucesso após reabertura! Resgate: R$ ${cashoutAfter.valorResgatado.toFixed(2)}`);

    console.log('\n====================================================');
    console.log('  TODOS OS TESTES DE GOL E SUSPENSÃO PASSARAM!       ');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ ERRO NA EXECUÇÃO DOS TESTES DE GOL E SUSPENSÃO:', err);
    process.exit(1);
  }
}

runGoalSuspensionTests();
