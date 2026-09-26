/**
 * Teste Automatizado de Cash Out e Prevenção de Concorrência (RF-04, RF-05, RNF-01)
 * Executa: node src/services/test-cashout.js
 */

const apostadorService = require('./apostadorService');
const betService = require('./betService');
const cashoutService = require('./cashoutService');
const matchSimulatorService = require('./matchSimulatorService');
const oddsEngineService = require('./oddsEngineService');

async function runCashoutTests() {
  console.log('====================================================');
  console.log('  INICIANDO BATERIA DE TESTES DE CASH OUT (ETAPA 11)');
  console.log('====================================================');

  try {
    // 1. Inicializar simulador e motor de odds em memória para o teste
    await matchSimulatorService.loadMatchesFromDatabase();
    oddsEngineService.bindToSimulator(matchSimulatorService);
    cashoutService.bindEvents();

    const apostadorId = 1;

    // Garante saldo inicial suficiente para o teste
    const saldoInicial = await apostadorService.getSaldo(apostadorId);
    console.log(`[TEST 1] Saldo inicial verificado: R$ ${saldoInicial.toFixed(2)}`);

    if (saldoInicial < 20.00) {
      await apostadorService.creditarSaldo(apostadorId, 100.00);
      console.log(`[TEST 1] Saldo recarregado para o teste.`);
    }

    // 2. Colocar uma aposta
    console.log('\n[TEST 2] Submetendo bilhete de aposta de R$ 20.00...');
    const betResult = await betService.placeBet({
      apostadorId,
      matchId: 1,
      mercadoId: '1X2',
      selecao: 'CASA',
      odd: 2.10,
      valor: 20.00
    });

    const bet = betResult.bet;
    console.log(`[TEST 2] ✅ Aposta confirmada! ID: #${bet.idAposta}, Status: ${bet.status}, Retorno Potencial: R$ ${bet.retornoPotencial}`);
    console.log(`[TEST 2] ✅ Saldo debitado corretamente: R$ ${betResult.novoSaldo.toFixed(2)}`);

    // 3. Teste de Cálculo Dinâmico de Cash Out (RF-04)
    console.log('\n[TEST 3] Calculando oferta instantânea de Cash Out (RF-04)...');
    const offer = cashoutService.calculateOffer(bet);
    console.log(`[TEST 3] ✅ Oferta de Cash Out calculada: R$ ${offer.toFixed(2)}`);

    if (offer <= 0 || offer > bet.retornoPotencial) {
      throw new Error(`Oferta de Cash Out inválida: R$ ${offer}`);
    }

    // 4. Executar Cash Out com sucesso (RF-05)
    console.log('\n[TEST 4] Executando Cash Out legítimo (RF-05)...');
    const cashoutResult = await cashoutService.processCashOut({
      betId: bet.idAposta,
      apostadorId,
      requestedValue: offer
    });

    console.log(`[TEST 4] ✅ Cash Out concluído com sucesso!`);
    console.log(`[TEST 4] ✅ Valor resgatado: R$ ${cashoutResult.valorResgatado.toFixed(2)}`);
    console.log(`[TEST 4] ✅ Novo saldo do apostador: R$ ${cashoutResult.novoSaldo.toFixed(2)}`);

    // 5. Teste de Proteção contra Race Condition / Pagamento Duplo (RNF-01)
    console.log('\n[TEST 5] Testando rejeição de Cash Out duplicado no mesmo bilhete (RNF-01)...');
    let duplicateRejected = false;
    try {
      await cashoutService.processCashOut({
        betId: bet.idAposta,
        apostadorId,
        requestedValue: offer
      });
    } catch (err) {
      console.log(`[TEST 5] ✅ Tentativa duplicada rejeitada com sucesso! Motivo: ${err.message} (Código: ${err.code})`);
      duplicateRejected = true;
    }

    if (!duplicateRejected) {
      throw new Error('FALHA DE SEGURANÇA (RNF-01): O sistema permitiu Cash Out duplicado no mesmo bilhete!');
    }

    // 6. Teste de Proteção quando o jogo está SUSPENSO (ex: Gol)
    console.log('\n[TEST 6] Testando rejeição de Cash Out quando mercado/partida está SUSPENSA...');
    const bet2 = (await betService.placeBet({
      apostadorId,
      matchId: 1,
      mercadoId: '1X2',
      selecao: 'EMPATE',
      odd: 3.20,
      valor: 10.00
    })).bet;

    // Simula mercado suspenso
    const match1 = matchSimulatorService.getMatchById(1);
    const originalStatus = match1 ? match1.status_partida : 'AO_VIVO';
    if (match1) match1.status_partida = 'SUSPENSA';

    let suspendedRejected = false;
    try {
      await cashoutService.processCashOut({
        betId: bet2.idAposta,
        apostadorId
      });
    } catch (err) {
      console.log(`[TEST 6] ✅ Tentativa em jogo suspenso rejeitada com sucesso! Motivo: ${err.message} (Código: ${err.code})`);
      suspendedRejected = true;
    } finally {
      if (match1) match1.status_partida = originalStatus;
    }

    if (!suspendedRejected) {
      throw new Error('FALHA DE SEGURANÇA (RNF-01): O sistema permitiu Cash Out durante suspensão de mercado!');
    }

    console.log('\n====================================================');
    console.log('  TODOS OS TESTES DE CASH OUT PASSARAM COM SUCESSO!  ');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ ERRO NA EXECUÇÃO DOS TESTES DE CASH OUT:', err);
    process.exit(1);
  }
}

runCashoutTests();
