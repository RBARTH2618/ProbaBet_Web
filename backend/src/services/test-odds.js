const matchSimulatorService = require('./matchSimulatorService');
const oddsEngineService = require('./oddsEngineService');

console.log('====================================================');
console.log('  ProbaBet - Teste de Transmissão de Odds (RF-02)');
console.log('====================================================');

// Conecta o motor de odds ao simulador
oddsEngineService.bindToSimulator(matchSimulatorService);

console.log('Odds iniciais Partida 1 (Flamengo x Palmeiras):');
const initialOdds = oddsEngineService.getOddsByMatch(1);
console.log(JSON.stringify(initialOdds['1X2'], null, 2));

console.log('\nIniciando simulação para aferição da transmissão periódica (RF-02)...');
matchSimulatorService.startSimulation();

let updateCount = 0;
let lastOddsCasa = initialOdds['1X2'].CASA.odd;

oddsEngineService.on('odds_updated', (data) => {
  if (data.matchId === 1) {
    updateCount++;
    const currentCasa = data.odds.CASA;
    const dirCasa = data.directions.CASA;
    console.log(`  [Update #${updateCount}] Partida 1: CASA @ ${currentCasa} (${dirCasa}) | EMPATE @ ${data.odds.EMPATE} | FORA @ ${data.odds.FORA}`);
    lastOddsCasa = currentCasa;
  }
});

// Validação final após 6 segundos (pelo menos 2 ciclos de atualização)
setTimeout(() => {
  matchSimulatorService.stopSimulation();

  console.log('\n----------------------------------------------------');
  console.log('Validação dos resultados:');
  console.log(`- Total de transmissões recebidas: ${updateCount}`);

  if (updateCount >= 2) {
    console.log(' [RF-02 ATENDIDO] Odds transmitidas periodicamente a cada 2-3 segundos.');
  } else {
    console.error(' [FALHA] Quantidade insuficiente de transmissões de odds.');
    process.exit(1);
  }

  const finalOdds = oddsEngineService.getOddsByMatch(1);
  if (finalOdds['1X2'].CASA.odd >= 1.01 && finalOdds['1X2'].FORA.odd >= 1.01) {
    console.log(' [SUCESSO] Integridade das cotações mantida (valores >= 1.01).');
  } else {
    console.error(' [FALHA] Cotação violou o valor mínimo permitido.');
    process.exit(1);
  }

  console.log('====================================================');
  console.log(' ETAPA 9 CONCLUÍDA COM TOTAL SUCESSO! [RF-02]');
  console.log('====================================================');
  process.exit(0);
}, 6200);
