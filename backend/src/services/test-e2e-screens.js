/**
 * Teste Automatizado de Integração Ponta a Ponta das 3 Telas (Etapa 16 & RNF-03)
 * Simula o fluxo do usuário navegando entre Tela 1 (Lobby), Tela 2 (Bet Slip) e Tela 3 (Carteira/Cash Out)
 * Executa: node src/services/test-e2e-screens.js
 */

const assert = require('assert');
const { WebSocket } = require('ws');

const WS_URL = 'ws://localhost:3000?apostadorId=1';

async function runE2ETest() {
  console.log('====================================================');
  console.log('  TESTE E2E: FLUXO COMPLETO DAS 3 TELAS & LATÊNCIA (RNF-03)');
  console.log('====================================================');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let betPlacedId = null;
    let initialBalance = null;
    let currentBalance = null;

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Timeout de 10s atingido no teste E2E.'));
    }, 10000);

    ws.on('open', () => {
      console.log('[E2E 1] ✅ Conexão WebSocket estabelecida com sucesso.');
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const event = msg.event || msg.type;

        // [TELA 1 - HANDSHAKE & CARTEIRA]
        if (event === 'CONNECTION_ESTABLISHED') {
          console.log(`[E2E 2] ✅ Handshake recebido! Apostador: ${msg.apostador?.nome} | Saldo: R$ ${msg.saldo?.toFixed(2)}`);
          assert(msg.saldo !== undefined, 'Deve conter saldo inicial');
          initialBalance = msg.saldo;
          currentBalance = msg.saldo;

          // Medição de Latência com PING (RNF-03)
          const pingStart = Date.now();
          ws.send(JSON.stringify({
            event: 'PING',
            timestamp: pingStart
          }));
        }

        // [RNF-03 - MEDIÇÃO DE LATÊNCIA]
        if (event === 'PONG') {
          const latency = Date.now() - msg.clientTimestamp;
          console.log(`[E2E 3] ⏱️ Latência WebSocket (Round-Trip): ${latency} ms (Requisito RNF-03: < 100 ms)`);
          assert(latency < 100, `Latência deve ser inferior a 100ms. Obtido: ${latency}ms`);
          console.log('[E2E 3] ✅ RNF-03 (Baixa Latência < 100ms) aprovado!');

          // Simula Tela 2: Submete Aposta (PLACE_BET)
          console.log('\n[E2E 4] Simula Tela 2 (Bet Slip): Submetendo aposta de R$ 25.00 no Flamengo (CASA @ 2.10)...');
          ws.send(JSON.stringify({
            event: 'PLACE_BET',
            matchId: 1,
            mercadoId: '1X2',
            selecao: 'CASA',
            odd: 2.10,
            valor: 25.00
          }));
        }

        // [TELA 2 - CONFIRMAÇÃO DE APOSTA]
        if (event === 'BET_CONFIRMED') {
          betPlacedId = msg.bet?.idAposta;
          console.log(`[E2E 5] ✅ Comprovante emitido! Bilhete #${betPlacedId} confirmado no Flamengo @ ${msg.bet?.oddMomento}`);
          assert(betPlacedId, 'Bilhete deve possuir um ID');
        }

        if (event === 'BALANCE_UPDATE' && msg.motivo === 'APOSTA_REALIZADA') {
          currentBalance = msg.saldo;
          console.log(`[E2E 6] ✅ Saldo debitado atomicamente: R$ ${currentBalance.toFixed(2)} (RNF-02)`);
          assert.strictEqual(currentBalance, parseFloat((initialBalance - 25.00).toFixed(2)), 'Saldo deve ter diminuído em R$ 25.00');

          // Solicita ofertas de Cash Out ativas
          console.log('\n[E2E 7] Simula Tela 3 (Carteira): Solicitando ofertas de Cash Out ativas...');
          ws.send(JSON.stringify({ event: 'GET_ACTIVE_BETS' }));
        }

        // [TELA 3 - CARTEIRA & OFERTA DE CASHOUT]
        if (event === 'ACTIVE_BETS_LIST') {
          console.log(`[E2E 8] ✅ Lista de apostas ativas recebida contendo ${msg.bets?.length} bilhetes.`);
          const myBet = msg.bets?.find(b => b.idAposta === betPlacedId || b.id_aposta === betPlacedId);
          if (myBet && betPlacedId) {
            const cashoutVal = myBet.cashoutValue || 23.50;
            console.log(`[E2E 9] Simula Tela 3: Executando Cash Out imediato para o bilhete #${betPlacedId} (Oferta: R$ ${cashoutVal.toFixed(2)})...`);
            ws.send(JSON.stringify({
              event: 'CASH_OUT',
              betId: betPlacedId,
              requestedValue: cashoutVal
            }));
          }
        }

        // [TELA 3 - CONFIRMAÇÃO DE CASHOUT]
        if (event === 'CASH_OUT_CONFIRMED') {
          const resgatado = msg.valorResgatado || msg.valorCreditado;
          console.log(`[E2E 10] ✅ Cash Out Concluído! Bilhete #${msg.betId} encerrado. Valor Creditado: R$ ${Number(resgatado)?.toFixed(2)}`);
          assert.strictEqual(msg.betId, betPlacedId, 'ID do bilhete de cashout deve coincidir');
          
          clearTimeout(timeout);
          ws.close();
          console.log('\n====================================================');
          console.log('  TESTE E2E DAS 3 TELAS CONCLUÍDO COM 100% DE SUCESSO! 🎉');
          console.log('====================================================');
          resolve();
        }

      } catch (err) {
        clearTimeout(timeout);
        ws.close();
        reject(err);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

runE2ETest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ FALHA NO TESTE E2E:', err.message);
    process.exit(1);
  });
