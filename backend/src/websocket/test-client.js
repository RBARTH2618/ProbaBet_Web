const path = require('path');
const { WebSocket } = require('ws');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const PORT = process.env.PORT || 3000;
const WS_URL = `ws://localhost:${PORT}?apostadorId=1`;

console.log('====================================================');
console.log('  ProbaBet - Teste de Conexão e Saldo Inicial (RF-01)');
console.log('====================================================');
console.log(`Conectando ao servidor: ${WS_URL}...`);

const ws = new WebSocket(WS_URL);
let pingStartTime = null;
let handshakeConfirmed = false;
let balanceConfirmed = false;

const timeout = setTimeout(() => {
  console.error('[ERRO] Tempo limite de execução atingido (5s).');
  console.error('Verifique se o servidor backend está rodando na porta ' + PORT);
  ws.terminate();
  process.exit(1);
}, 5000);

ws.on('open', () => {
  console.log(' Conexão de socket aberta com sucesso.');
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log(`[Mensagem Recebida]: ${message.event || message.type}`);

    // Validação RF-01: Handshake com dados do apostador e saldo de R$ 100,00
    if (message.event === 'CONNECTION_ESTABLISHED') {
      console.log(`  - Client ID:        ${message.clientId}`);
      console.log(`  - Apostador:        ${message.apostador?.nome}`);
      console.log(`  - Saldo no Handshake: R$ ${message.saldo?.toFixed(2)}`);

      if (message.saldo === 100.00) {
        console.log('  [RF-01 ATENDIDO] Saldo fictício inicial de R$ 100,00 confirmado no Handshake.');
        handshakeConfirmed = true;
      }
    } 
    
    // Validação RF-01: Confirmação da carteira via BALANCE_UPDATE
    else if (message.event === 'BALANCE_UPDATE') {
      console.log(`  - Motivo:           ${message.motivo}`);
      console.log(`  - Saldo Atual:      R$ ${message.saldo?.toFixed(2)}`);

      if (message.saldo === 100.00 && message.motivo === 'SALDO_INICIAL') {
        console.log('  [RF-01 ATENDIDO] Evento BALANCE_UPDATE de saldo inicial recebido.');
        balanceConfirmed = true;

        // Dispara teste de PING/PONG para validar latência < 100ms (RNF-03)
        console.log('\nEnviando evento PING para aferição de latência...');
        pingStartTime = Date.now();
        ws.send(JSON.stringify({
          type: 'PING',
          timestamp: pingStartTime
        }));
      }
    } 
    
    // Validação RNF-03: Latência baixa < 100ms
    else if (message.event === 'PONG') {
      const latency = Date.now() - pingStartTime;
      console.log(`   PONG recebido em ${latency} ms!`);
      
      if (latency < 100) {
        console.log(`  [RNF-03 ATENDIDO] Latência inferior a 100 ms.`);
      }

      // Dispara teste de consulta de ranking (RF-08)
      console.log('\nEnviando consulta de ranking (GET_RANKING)...');
      ws.send(JSON.stringify({ type: 'GET_RANKING' }));
    } 
    
    // Validação RF-08: Recepção do Ranking
    else if (message.event === 'RANKING_UPDATE') {
      console.log('   Ranking recebido:');
      message.ranking?.forEach((u, index) => {
        console.log(`     ${index + 1}º ${u.nome_completo.padEnd(25)} R$ ${u.saldo_ficticio.toFixed(2)}`);
      });

      if (handshakeConfirmed && balanceConfirmed) {
        console.log('====================================================');
        console.log(' ETAPA 7 CONCLUÍDA COM TOTAL SUCESSO! [RF-01]');
        console.log('====================================================');
        clearTimeout(timeout);
        ws.close();
        process.exit(0);
      }
    }
  } catch (err) {
    console.error('Erro ao processar mensagem do servidor:', err.message);
  }
});

ws.on('error', (err) => {
  clearTimeout(timeout);
  console.error(' Falha na conexão WebSocket:', err.message);
  console.error('Dica: Inicie o servidor com "node src/server.js" antes de rodar o teste.');
  process.exit(1);
});

ws.on('close', () => {
  clearTimeout(timeout);
});
