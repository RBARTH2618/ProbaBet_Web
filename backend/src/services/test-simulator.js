const matchSimulatorService = require('./matchSimulatorService');

console.log('====================================================');
console.log('  ProbaBet - Teste do Simulador de Partidas (Etapa 8)');
console.log('====================================================');

const matches = matchSimulatorService.getAllMatches();
console.log(`Partidas carregadas no simulador: ${matches.length}`);
matches.forEach(m => {
  console.log(`- [${m.id_partida}] ${m.time_casa} ${m.placar_casa} x ${m.placar_fora} ${m.time_fora} (${m.minuto_jogo}') - ${m.status_partida}`);
});

if (matches.length !== 3) {
  console.error('[ERRO] Esperava-se 3 partidas iniciais.');
  process.exit(1);
}

const match1 = matchSimulatorService.getMatchById(1);
const minutoInicial = match1.minuto_jogo;
const placarCasaInicial = match1.placar_casa;

console.log('\nIniciando motor de simulação por 6 segundos...');
matchSimulatorService.startSimulation();

let tickCount = 0;
matchSimulatorService.on('match_tick', (m) => {
  if (m.id_partida === 1) {
    tickCount++;
    console.log(`  [Tick ${tickCount}] Partida 1: ${m.time_casa} ${m.placar_casa} x ${m.placar_fora} ${m.time_fora} | Minuto: ${m.minuto_jogo}'`);
  }
});

// Após 3 segundos, testar disparo manual de Gol (RF-06)
setTimeout(() => {
  console.log('\nDisparando gol manual para teste (Flamengo)...');
  matchSimulatorService.triggerManualGoal(1, 'CASA');
}, 3000);

// Validação final após 6 segundos
setTimeout(() => {
  matchSimulatorService.stopSimulation();

  console.log('\n----------------------------------------------------');
  console.log('Validação dos resultados:');
  console.log(`- Minuto inicial: ${minutoInicial}' -> Minuto atual: ${match1.minuto_jogo}'`);
  console.log(`- Placar casa:    ${placarCasaInicial} -> Placar atual: ${match1.placar_casa}`);

  if (match1.minuto_jogo > minutoInicial) {
    console.log(' [SUCESSO] Relógio da partida avançou com sucesso!');
  } else {
    console.error(' [FALHA] Relógio não avançou.');
    process.exit(1);
  }

  if (match1.placar_casa > placarCasaInicial) {
    console.log(' [SUCESSO] Placar de gol atualizado com sucesso!');
  } else {
    console.error(' [FALHA] Placar não foi atualizado.');
    process.exit(1);
  }

  console.log('====================================================');
  console.log(' ETAPA 8 CONCLUÍDA COM TOTAL SUCESSO! [MOTOR DA PARTIDA]');
  console.log('====================================================');
  process.exit(0);
}, 6200);
