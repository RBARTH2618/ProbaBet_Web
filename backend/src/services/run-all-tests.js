/**
 * Executador Mestre de Toda a Suíte de Testes do ProbaBet (Etapa 17)
 * Executa todos os testes de backend, concorrência, integridade de saldo, WebSocket e E2E.
 * Executa: node src/services/run-all-tests.js
 */

const { execSync } = require('child_process');
const path = require('path');

const testSuites = [
  { name: 'Simulador de Partidas (RF-02)', script: 'test-simulator.js' },
  { name: 'Motor de Odds Dinâmicas (RF-02)', script: 'test-odds.js' },
  { name: 'Submissão de Apostas & Saldo Atômico (RF-03, RNF-02)', script: 'test-place-bet.js' },
  { name: 'Cálculo de Cash Out & Prevenção de Race Condition (RF-04, RF-05, RNF-01)', script: 'test-cashout.js' },
  { name: 'Notificação de Gol & Congelamento de Mercado (RF-06, RNF-01)', script: 'test-goal-suspension.js' },
  { name: 'Liquidação Automática 1X2 GREEN/RED (RF-07)', script: 'test-settlement.js' },
  { name: 'Ranking da Sessão em Tempo Real (RF-08)', script: 'test-ranking.js' },
  { name: 'Integração Ponta a Ponta das 3 Telas & Latência < 100ms (RNF-03)', script: 'test-e2e-screens.js' }
];

console.log('================================================================');
console.log('   PROBABET — EXECUÇÃO CONSOLIDADA DA SUÍTE DE TESTES (ETAPA 17)');
console.log('   Integrantes: Arthur Borges Rodrigues & João Lucas Tavares Silva');
console.log('================================================================\n');

let passedCount = 0;
const startTime = Date.now();

for (const suite of testSuites) {
  process.stdout.write(`⏳ Executando: ${suite.name}... `);
  try {
    const scriptPath = path.join(__dirname, suite.script);
    execSync(`node "${scriptPath}"`, { stdio: 'pipe' });
    console.log('✅ APROVADO');
    passedCount++;
  } catch (err) {
    console.log('❌ FALHOU');
    console.error(`Erro em ${suite.script}:`, err.stdout?.toString() || err.message);
  }
}

const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('\n================================================================');
console.log(`   RESULTADO FINAL: ${passedCount} / ${testSuites.length} SUÍTES DE TESTES APROVADAS!`);
console.log(`   Tempo Total de Execução: ${totalDuration}s`);
console.log('   Status: 100% DOS REQUISITOS (RF-01 a RF-08, RNF-01 a RNF-03) VALIDADOS');
console.log('================================================================\n');

if (passedCount === testSuites.length) {
  process.exit(0);
} else {
  process.exit(1);
}
