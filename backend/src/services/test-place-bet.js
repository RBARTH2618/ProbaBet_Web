const betService = require('./betService');
const apostadorService = require('./apostadorService');

async function runTests() {
  console.log('====================================================');
  console.log('  ProbaBet - Teste de Submissão de Apostas (RF-03)');
  console.log('====================================================');

  const apostadorId = 1;
  const saldoInicial = await apostadorService.getSaldo(apostadorId);
  console.log(`Saldo inicial do Apostador ${apostadorId}: R$ ${saldoInicial.toFixed(2)}`);

  // TESTE 1: Submissão de Aposta Válida
  console.log('\n--- TESTE 1: Aposta Válida (R$ 25,00 no Flamengo @ 2.10) ---');
  try {
    const res = await betService.placeBet({
      apostadorId,
      matchId: 1,
      mercadoId: '1X2',
      selecao: 'CASA',
      odd: 2.10,
      valor: 25.00
    });

    console.log(' [SUCESSO] Aposta confirmada!');
    console.log(`- ID do Bilhete:     #${res.bet.idAposta}`);
    console.log(`- Partida:           ${res.bet.partidaNome}`);
    console.log(`- Seleção:           ${res.bet.selecao} (@ ${res.bet.oddMomento})`);
    console.log(`- Valor Apostado:    R$ ${res.bet.valorApostado.toFixed(2)}`);
    console.log(`- Retorno Potencial: R$ ${res.bet.retornoPotencial.toFixed(2)}`);
    console.log(`- Novo Saldo:        R$ ${res.novoSaldo.toFixed(2)}`);

    if (res.novoSaldo !== parseFloat((saldoInicial - 25.00).toFixed(2))) {
      throw new Error(`Saldo incorreto após débito. Esperado: R$ ${(saldoInicial - 25.00).toFixed(2)}, Obtido: R$ ${res.novoSaldo}`);
    }
  } catch (err) {
    console.error(' [FALHA no Teste 1]:', err.message);
    process.exit(1);
  }

  // TESTE 2: Aposta Rejeitada por Saldo Insuficiente (RNF-02)
  console.log('\n--- TESTE 2: Validação de Saldo Insuficiente (R$ 200,00) ---');
  try {
    await betService.placeBet({
      apostadorId,
      matchId: 1,
      mercadoId: '1X2',
      selecao: 'EMPATE',
      odd: 3.25,
      valor: 200.00
    });
    console.error(' [FALHA]: Aposta deveria ter sido rejeitada por falta de saldo!');
    process.exit(1);
  } catch (err) {
    if (err.code === 'INSUFFICIENT_FUNDS') {
      console.log(' [SUCESSO] Operação rejeitada corretamente (RNF-02): Saldo insuficiente.');
      console.log(`- Mensagem do sistema: "${err.message}"`);
    } else {
      console.error(' [FALHA]: Código de erro inesperado:', err.code);
      process.exit(1);
    }
  }

  // TESTE 3: Aposta Rejeitada por Valor Inválido
  console.log('\n--- TESTE 3: Validação de Valor Negativo / Zero ---');
  try {
    await betService.placeBet({
      apostadorId,
      matchId: 1,
      mercadoId: '1X2',
      selecao: 'FORA',
      odd: 3.40,
      valor: -10.00
    });
    console.error(' [FALHA]: Aposta com valor negativo deveria ter sido rejeitada!');
    process.exit(1);
  } catch (err) {
    if (err.code === 'INVALID_AMOUNT') {
      console.log(' [SUCESSO] Operação rejeitada corretamente: Valor inválido.');
    } else {
      console.error(' [FALHA]: Código inesperado:', err.code);
      process.exit(1);
    }
  }

  // TESTE 4: Consulta de Apostas Ativas
  console.log('\n--- TESTE 4: Listagem de Apostas Ativas do Apostador ---');
  const activeBets = await betService.getActiveBets(apostadorId);
  console.log(`Apostas ativas encontradas: ${activeBets.length}`);
  if (activeBets.length > 0) {
    console.log(' [SUCESSO] Bilhete ativo recuperado com sucesso para carteira/cashout.');
  }

  console.log('\n====================================================');
  console.log(' ETAPA 10 CONCLUÍDA COM TOTAL SUCESSO! [PLACE_BET]');
  console.log('====================================================');
  process.exit(0);
}

runTests();
