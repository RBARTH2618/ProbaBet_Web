const fs = require('fs');
const path = require('path');
const { Client, Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'bets_db'
};

async function ensureDatabaseExists() {
  console.log(`[Setup DB] Verificando existência do banco de dados "${dbConfig.database}"...`);
  
  // Conecta ao banco de manutenção padrão do PostgreSQL ('postgres')
  const client = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: 'postgres'
  });

  try {
    await client.connect();
    const res = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbConfig.database]
    );

    if (res.rowCount === 0) {
      console.log(`[Setup DB] Banco "${dbConfig.database}" não encontrado. Criando...`);
      await client.query(`CREATE DATABASE "${dbConfig.database}"`);
      console.log(`[Setup DB]  Banco "${dbConfig.database}" criado com sucesso!`);
    } else {
      console.log(`[Setup DB]  Banco "${dbConfig.database}" já existe.`);
    }
  } catch (err) {
    console.error(`[Setup DB] Erro ao verificar/criar banco no PostgreSQL:`, err.message);
    throw err;
  } finally {
    await client.end();
  }
}

async function runSqlFile(pool, relativeFilePath) {
  const absolutePath = path.join(__dirname, '../../../database', relativeFilePath);
  console.log(`[Setup DB] Executando script: ${relativeFilePath}...`);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Arquivo não encontrado: ${absolutePath}`);
  }

  const sqlContent = fs.readFileSync(absolutePath, 'utf-8');
  await pool.query(sqlContent);
  console.log(`[Setup DB]  Sucesso ao executar ${relativeFilePath}`);
}

async function run() {
  console.log('====================================================');
  console.log('  ProbaBet - Inicializador Automático do Banco');
  console.log('====================================================');

  try {
    // 1. Garantir que o banco de dados 'bets_db' existe
    await ensureDatabaseExists();

    // 2. Conectar diretamente ao banco 'bets_db'
    const targetPool = new Pool(dbConfig);

    // 3. Executar scripts em sequência
    await runSqlFile(targetPool, '02_create_tables.sql');
    await runSqlFile(targetPool, '03_constraints.sql');
    await runSqlFile(targetPool, '04_seed.sql');

    // 4. Conferência dos dados criados
    const countApostadores = await targetPool.query('SELECT count(*) FROM apostador');
    const countPartidas = await targetPool.query('SELECT count(*) FROM partida_esportiva');
    const countMercados = await targetPool.query('SELECT count(*) FROM mercado_odd');

    console.log('----------------------------------------------------');
    console.log(' Estrutura e Dados Verificados:');
    console.log(` - Apostadores cadastrados: ${countApostadores.rows[0].count}`);
    console.log(` - Partidas esportivas:     ${countPartidas.rows[0].count}`);
    console.log(` - Mercados de odds ativos: ${countMercados.rows[0].count}`);
    console.log('====================================================');
    console.log(' BANCO DE DADOS CONFIGURADO E PRONTO COM SUCESSO!');
    console.log('====================================================');

    await targetPool.end();
    process.exit(0);
  } catch (error) {
    console.error('----------------------------------------------------');
    console.error(' Erro durante o setup do banco de dados:');
    console.error(error.message);
    console.log('----------------------------------------------------');
    console.log('Dica: Certifique-se de que o serviço do PostgreSQL está');
    console.log('iniciado e que a senha no arquivo .env corresponde ao');
    console.log('usuário postgres da sua máquina.');
    console.log('====================================================');
    process.exit(1);
  }
}

run();
