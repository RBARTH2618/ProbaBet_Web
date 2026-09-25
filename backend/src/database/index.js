const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Configuração do Pool de Conexões com o PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'bets_db',
  max: 20, // Máximo de conexões simultâneas no pool
  idleTimeoutMillis: 30000, // Tempo máximo que uma conexão pode ficar ociosa
  connectionTimeoutMillis: 5000 // Tempo limite para obter uma conexão do pool (5 segundos)
});

// Listener de eventos do pool para monitoramento
pool.on('connect', () => {
  // Conexão criada no pool
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error] Erro inesperado em conexão ociosa:', err.message);
});

/**
 * Executa uma consulta SQL direta usando o pool.
 * @param {string} text - Comando SQL
 * @param {Array} [params] - Parâmetros da consulta
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // Opcional: log em ambiente de desenvolvimento se durar muito
  if (process.env.NODE_ENV === 'development' && duration > 100) {
    console.warn(`[PostgreSQL Slow Query] (${duration}ms): ${text}`);
  }
  return res;
}

/**
 * Obtém um cliente dedicado do pool para operações com transações (BEGIN, COMMIT, ROLLBACK).
 * O chamador deve sempre executar client.release() ao finalizar.
 * @returns {Promise<import('pg').PoolClient>}
 */
async function getClient() {
  const client = await pool.connect();
  return client;
}

/**
 * Testa a conexão ativa com o banco de dados.
 * @returns {Promise<{ success: boolean, database?: string, timestamp?: string, version?: string, error?: string }>}
 */
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() as timestamp, current_database() as database, version() as version');
    const row = result.rows[0];
    return {
      success: true,
      database: row.database,
      timestamp: row.timestamp,
      version: row.version
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    };
  }
}

/**
 * Encerra o pool de conexões de forma segura (útil para encerramento gracioso do servidor).
 */
async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
  closePool
};
