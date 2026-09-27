/**
 * Teste Automatizado de Ranking da Sessão em Tempo Real (RF-08)
 * Executa: node src/services/test-ranking.js
 */

const assert = require('assert');
const apostadorService = require('./apostadorService');

async function runRankingTests() {
  console.log('====================================================');
  console.log('  INICIANDO TESTES DO RANKING DA SESSÃO (ETAPA 14 - RF-08)');
  console.log('====================================================');

  try {
    // 1. Obter ranking inicial
    console.log('\n[TEST 1] Consultando ranking da sessão inicial...');
    const initialRanking = await apostadorService.getRanking();
    assert(Array.isArray(initialRanking), 'O ranking retornado deve ser um Array.');
    assert(initialRanking.length >= 3, 'Deve haver ao menos 3 apostadores no ranking da sessão.');
    console.log(`[TEST 1] ✅ Ranking obtido com sucesso contendo ${initialRanking.length} apostadores:`);
    initialRanking.forEach((u, i) => {
      console.log(`   #${i + 1} - ${u.nome_completo}: R$ ${u.saldo_ficticio.toFixed(2)}`);
    });

    // 2. Verificar ordenação estritamente decrescente
    console.log('\n[TEST 2] Validando ordenação decrescente por saldo...');
    for (let i = 0; i < initialRanking.length - 1; i++) {
      assert(
        initialRanking[i].saldo_ficticio >= initialRanking[i + 1].saldo_ficticio,
        `Posição #${i + 1} (${initialRanking[i].saldo_ficticio}) deve ter saldo maior ou igual à posição #${i + 2} (${initialRanking[i + 1].saldo_ficticio})`
      );
    }
    console.log('[TEST 2] ✅ Ordenação decrescente por saldo confirmada com sucesso.');

    // 3. Atualizar saldo do Apostador 1 (Arthur) com um prêmio (GREEN ou Cash Out)
    console.log('\n[TEST 3] Simulando vitória de aposta (prêmio de R$ 50.00 para Arthur)...');
    const saldoAnterior = await apostadorService.getSaldo(1);
    await apostadorService.creditarSaldo(1, 50.00);
    const novoSaldo = await apostadorService.getSaldo(1);
    assert.strictEqual(novoSaldo, parseFloat((saldoAnterior + 50.00).toFixed(2)), 'Saldo deve ter aumentado exatamente em R$ 50.00');

    // 4. Verificar se Arthur subiu no ranking
    console.log('\n[TEST 4] Verificando atualização em tempo real do ranking após crédito...');
    const updatedRanking = await apostadorService.getRanking();
    console.log('[TEST 4] Ranking atualizado:');
    updatedRanking.forEach((u, i) => {
      console.log(`   #${i + 1} - ${u.nome_completo}: R$ ${u.saldo_ficticio.toFixed(2)}`);
    });

    const arthur = updatedRanking.find(u => u.id_apostador === 1);
    assert(arthur, 'Arthur deve estar presente no ranking');
    assert.strictEqual(arthur.saldo_ficticio, novoSaldo, 'Saldo de Arthur no ranking deve refletir o saldo creditado');
    assert.strictEqual(updatedRanking[0].id_apostador, 1, 'Arthur deve agora liderar a classificação em 1º lugar com seu prêmio');
    console.log(`[TEST 4] ✅ Arthur lidera o ranking com saldo de R$ ${arthur.saldo_ficticio.toFixed(2)}!`);

    // 5. Testar débito de aposta e impacto no ranking
    console.log('\n[TEST 5] Submetendo nova aposta de R$ 70.00 para Arthur...');
    await apostadorService.debitarSaldo(1, 70.00);
    const rankingAposDebito = await apostadorService.getRanking();
    const arthurAposDebito = rankingAposDebito.find(u => u.id_apostador === 1);
    console.log(`[TEST 5] Novo saldo de Arthur: R$ ${arthurAposDebito.saldo_ficticio.toFixed(2)}`);
    console.log('[TEST 5] Nova classificação:');
    rankingAposDebito.forEach((u, i) => {
      console.log(`   #${i + 1} - ${u.nome_completo}: R$ ${u.saldo_ficticio.toFixed(2)}`);
    });

    // 6. Verificar integridade das posições após rebaixamento na tabela
    for (let i = 0; i < rankingAposDebito.length - 1; i++) {
      assert(
        rankingAposDebito[i].saldo_ficticio >= rankingAposDebito[i + 1].saldo_ficticio,
        'Ordenação deve permanecer estritamente decrescente'
      );
    }
    console.log('[TEST 6] ✅ Integridade das posições preservada após rebaixamento por aposta.');

    console.log('\n====================================================');
    console.log('  TODOS OS TESTES DO RANKING (RF-08) FORAM APROVADOS! 🏆');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ FALHA NOS TESTES DO RANKING:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runRankingTests();
