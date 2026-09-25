const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { testConnection, closePool } = require('./index');

async function run() {
  console.log('====================================================');
  console.log('  ProbaBet - Teste de Conexão com o PostgreSQL');
  console.log('====================================================');
  console.log('Parâmetros configurados:');
  console.log(`- Host:     ${process.env.DB_HOST || 'localhost'}`);
  console.log(`- Porta:    ${process.env.DB_PORT || 5432}`);
  console.log(`- Usuário:  ${process.env.DB_USER || 'postgres'}`);
  console.log(`- Banco:    ${process.env.DB_NAME || 'bets_db'}`);
  console.log('----------------------------------------------------');
  console.log('Tentando conectar...');

  const result = await testConnection();

  if (result.success) {
    console.log(' STATUS: CONECTADO COM SUCESSO!');
    console.log(`- Banco conectado:    ${result.database}`);
    console.log(`- Hora no servidor:   ${result.timestamp}`);
    console.log(`- Versão PostgreSQL:  ${result.version}`);
    console.log('====================================================');
    await closePool();
    process.exit(0);
  } else {
    console.error(' STATUS: FALHA NA CONEXÃO');
    console.error(`- Código do erro: ${result.code}`);
    console.error(`- Detalhes:       ${result.error}`);
    console.log('----------------------------------------------------');
    console.log('Dicas para resolução:');
    console.log('1. Verifique se o serviço do PostgreSQL está instalado e em execução.');
    console.log('2. Certifique-se de que a porta 5432 está acessível.');
    console.log('3. Verifique as credenciais no arquivo .env (DB_USER, DB_PASS, DB_NAME).');
    console.log('4. Certifique-se de que o banco "bets_db" foi criado (Etapa 5).');
    console.log('====================================================');
    await closePool();
    process.exit(1);
  }
}

run();
