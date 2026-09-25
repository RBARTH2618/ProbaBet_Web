-- ============================================================
-- SCRIPT 02: Criação das Tabelas Principais (5 Entidades)
-- Projeto: ProbaBet - Plataforma de Apostas em Tempo Real
-- Disciplina: Desenvolvimento de Software para Web
-- Integrantes: Arthur Borges Rodrigues e João Lucas Tavares Silva
-- Professor: Me. Sergio Souza Novak
-- ============================================================

-- Conecte-se ao banco 'bets_db' antes de executar este script.

-- 1. ENTIDADE: APOSTADOR
-- Representa o usuário participante da sessão de apostas
CREATE TABLE IF NOT EXISTS apostador (
    id_apostador SERIAL PRIMARY KEY,
    cpf_usuario VARCHAR(14) NOT NULL,
    nome_completo VARCHAR(100) NOT NULL,
    saldo_ficticio DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    data_cadastro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. ENTIDADE: PARTIDA_ESPORTIVA
-- Armazena os confrontos simulados ao vivo (ex: Futebol, Basquete)
CREATE TABLE IF NOT EXISTS partida_esportiva (
    id_partida SERIAL PRIMARY KEY,
    modalidade_esportiva VARCHAR(40) NOT NULL,
    time_casa VARCHAR(60) NOT NULL,
    time_fora VARCHAR(60) NOT NULL,
    placar_casa INT NOT NULL DEFAULT 0,
    placar_fora INT NOT NULL DEFAULT 0,
    minuto_jogo INT NOT NULL DEFAULT 0,
    status_partida VARCHAR(20) NOT NULL DEFAULT 'AO_VIVO'
);

-- 3. ENTIDADE: MERCADO_ODD
-- Mercados de apostas vinculados a uma partida (1X2, Próximo Gol, etc.)
CREATE TABLE IF NOT EXISTS mercado_odd (
    id_mercado SERIAL PRIMARY KEY,
    id_partida INT NOT NULL,
    nome_mercado VARCHAR(50) NOT NULL,
    opcao_selecao VARCHAR(30) NOT NULL,
    cotacao_odd_atual DECIMAL(6,2) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 4. ENTIDADE: BILHETE_APOSTA
-- Registra as apostas submetidas pelos apostadores via WebSocket
CREATE TABLE IF NOT EXISTS bilhete_aposta (
    id_aposta SERIAL PRIMARY KEY,
    id_apostador INT NOT NULL,
    id_mercado INT NOT NULL,
    valor_apostado DECIMAL(10,2) NOT NULL,
    odd_momento DECIMAL(6,2) NOT NULL,
    retorno_potencial DECIMAL(10,2) NOT NULL,
    status_aposta VARCHAR(20) NOT NULL DEFAULT 'ATIVA',
    data_hora_aposta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. ENTIDADE: TRANSACAO_CASHOUT
-- Registra o encerramento antecipado de um bilhete de aposta
CREATE TABLE IF NOT EXISTS transacao_cashout (
    id_cashout SERIAL PRIMARY KEY,
    id_aposta INT NOT NULL,
    valor_resgate_oferecido DECIMAL(10,2) NOT NULL,
    valor_resgatado DECIMAL(10,2) NOT NULL,
    timestamp_efetivacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
