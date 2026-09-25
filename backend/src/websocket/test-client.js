const path = require('path');
const { WebSocket } = require('ws');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const PORT = process.env.PORT || 3000;
const WS_URL = `ws://localhost:${PORT}`;

console.log('====================================================');
console.log('  ProbaBet - Teste de Conexão WebSocket');
console.log('====================================================');
console.log(`Conectando ao servidor: ${WS_URL}...`);

const ws = new WebSocket(WS_URL);
let pingStartTime = null;

const timeout = setTimeout(() => {
  console.error('[ERRO] Tempo limite de conexão atingido (5s).');
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
    console.log(`[Mensagem Recebida]:`, message.event || message.type);

    if (message.event === 'CONNECTION_ESTABLISHED') {
      console.log(`- Handshake confirmado! Client ID: ${message.clientId}`);
      console.log(`- Mensagem do servidor: "${message.message}"`);

      // Envia um teste de PING para medir latência (RNF-03 < 100ms)
      console.log('\nEnviando evento PING para aferição de latência...');
      pingStartTime = Date.now();
      ws.send(JSON.stringify({
        type: 'PING',
        timestamp: pingStartTime
      }));
    } else if (message.event === 'PONG') {
      const latency = Date.now() - pingStartTime;
      console.log(` PONG recebido!`);
      console.log(`- Latência de ida e volta (RTT): ${latency} ms`);
      
      if (latency < 100) {
        console.log(` [RNF-03 ATENDIDO] Latência inferior a 100 ms.`);
      } else {
        console.log(` Atenção: Latência de ${latency} ms.`);
      }

      console.log('====================================================');
      console.log(' TESTE WEBSOCKET CONCLUÍDO COM SUCESSO!');
      console.log('====================================================');
      clearTimeout(timeout);
      ws.close();
      process.exit(0);
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
