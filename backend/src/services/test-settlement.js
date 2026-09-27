/**
 * Teste Automatizado de Liquidação Automática de Apostas (RF-07)
 * Executa: node src/services/test-settlement.js
 */

const matchSimulatorService = require('./matchSimulatorService');
const oddsEngineService = require('./oddsEngineService');
const betService = require('./betService');
const cashoutService = require('./cashoutService');
const settlementService = require('./settlementService');
const apostadorService = require('./apostadorService');

async function runSettlementTests() {
  console.log('====================================================');
  console.log('  INICIANDO TESTES DE LIQUIDAÇÃO DE APOSTAS (ETAPA 13)');
  console.log('====================================================');

  try {
    // 1. Inicializa o simulador e serviços
    await matchSimulatorService.loadMatchesFromDatabase();
    oddsEngineService.bindToSimulator(matchSimulatorService);
    cashoutService.bindEvents();
    settlementService.bindEvents();

    const apostadorId = 1;
    const matchId = 2; // Real Madrid x Barcelona

    // Recarrega saldo para teste
    await apostadorService.creditarSaldo(apostadorId, 100.00);
    const saldoAntesApostas = await apostadorService.getSaldo(apostadorId);
    console.log(`[TEST 1] Saldo disponível para o teste: R$ ${saldoAntesApostas.toFixed(2)}`);

    // 2. Coloca 2 apostas em seleções opostas na mesma partida
    console.log('\n[TEST 2] Submetendo bilhete 1: R$ 20.00 no Real Madrid (CASA @ 2.50)...');
    const bet1 = (await betService.placeBet({
      apostadorId,
      matchId,
      mercadoId: '1X2',
      selecao: 'CASA',
      odd: 2.50,
      valor: 20.00
    })).bet;
    console.log(`[TEST 2] ✅ Bilhete 1 (#${bet1.idAposta}) confirmado! Retorno Potencial: R$ ${bet1.retornoPotencial}`);

    console.log('\n[TEST 3] Submetendo bilhete 2: R$ 15.00 no Barcelona (FORA @ 3.00)...');
    const bet2 = (await betService.placeBet({
      apostadorId,
      matchId,
      mercadoId: '1X2',
      selecao: 'FORA',
      odd: 3.00,
      valor: 15.00
    })).bet;
    console.log(`[TEST 3] ✅ Bilhete 2 (#${bet2.idAposta}) confirmado! Retorno Potencial: R$ ${bet2.retornoPotencial}`);

    const saldoAposApostas = await apostadorService.getSaldo(apostadorId);
    console.log(`[TEST 3] ✅ Saldo após ambas as apostas: R$ ${saldoAposApostas.toFixed(2)}`);

    // 3. Simula o término da partida com vitória do time da CASA (Real Madrid 2 x 1 Barcelona)
    console.log('\n[TEST 4] Simulando encerramento da partida 2 com placar 2 x 1 (Vitória CASA)...');
    const finishedMatch = {
      id_partida: matchId,
      time_casa: 'Real Madrid',
      time_fora: 'Barcelona',
      placar_casa: 2,
      placar_fora: 1,
      status_partida: 'ENCERRADA'
    };

    // 4. Executa liquidação
    const summary = await settlementService.settleMatchBets(finishedMatch);
    console.log(`[TEST 4] ✅ Liquidação finalizada! Resumo: Green: ${summary.countGreen}, Red: ${summary.countRed}, Total Pago: R$ ${summary.totalPago}`);

    if (summary.countGreen !== 1 || summary.countRed !== 1) {
      throw new Error(`Contagem incorreta na liquidação! Esperado: 1 Green e 1 Red. Obtido: ${summary.countGreen} Green, ${summary.countRed} Red.`);
    }

    if (summary.totalPago !== bet1.retornoPotencial) {
      throw new Error(`Total pago incorreto! Esperado: R$ ${bet1.retornoPotencial}, Pago: R$ ${summary.totalPago}`);
    }

    // 5. Valida status individuais dos bilhetes
    console.log('\n[TEST 5] Validando status finais dos bilhetes...');
    const b1After = await betService.getBetById(bet1.idAposta);
    const b2After = await betService.getBetById(bet2.idAposta);

    const s1 = b1After.status || b1After.status_aposta;
    const s2 = b2After.status || b2After.status_aposta;

    console.log(`[TEST 5] Status Bilhete 1 (CASA): ${s1}`);
    console.log(`[TEST 5] Status Bilhete 2 (FORA): ${s2}`);

    if (s1 !== 'GREEN') {
      throw new Error(`Bilhete 1 deveria ser GREEN, mas está como: ${s1}`);
    }
    if (s2 !== 'RED') {
      throw new Error(`Bilhete 2 deveria ser RED, mas está como: ${s2}`);
    }

    // 6. Valida se o saldo foi devidamente creditado com o valor de retorno
    console.log('\n[TEST 6] Validando crédito exato do prêmio na carteira do apostador...');
    const saldoFinal = await apostadorService.getSaldo(apostadorId);
    const saldoEsperado = parseFloat((saldoAposApostas + bet1.retornoPotencial).toFixed(2));
    console.log(`[TEST 6] Saldo após liquidação: R$ ${saldoFinal.toFixed(2)} (Esperado: R$ ${saldoEsperado.toFixed(2)})`);

    if (Math.abs(saldoFinal - saldoEsperado) > 0.01) {
      throw new Error(`Saldo divergente após liquidação! Esperado: ${saldoEsperado}, Obtido: ${saldoFinal}`);
    }
    console.log(`[TEST 6] ✅ Prêmio de R$ ${bet1.retornoPotencial.toFixed(2)} creditado com exatidão matemática!`);

    // 7. Valida se a aposta liquidada não permite Cash Out posterior (RNF-01)
    console.log('\n[TEST 7] Testando rejeição de Cash Out em aposta já liquidada...');
    let cashoutRejected = false;
    try {
      await cashoutService.processCashOut({
        betId: bet1.idAposta,
        apostadorId
      });
    } catch (err) {
      console.log(`[TEST 7] ✅ Cash Out rejeitado corretamente: ${err.message} (Código: ${err.code})`);
      cashoutRejected = true;
    }

    if (!cashoutRejected) {
      throw new Error('FALHA DE INTEGRIDADE: O sistema permitiu Cash Out em aposta já liquidada como GREEN!');
    }

    console.log('\n====================================================');
    console.log('  TODOS OS TESTES DE LIQUIDAÇÃO PASSARAM COM SUCESSO! ');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ ERRO NA EXECUÇÃO DOS TESTES DE LIQUIDAÇÃO:', err);
    process.exit(1);
  }
}

runSettlementTests();
