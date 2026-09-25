-- ============================================================
-- SCRIPT 01: Criação do Banco de Dados
-- Projeto: ProbaBet - Plataforma de Apostas em Tempo Real
-- Disciplina: Desenvolvimento de Software para Web
-- Integrantes: Arthur Borges Rodrigues e João Lucas Tavares Silva
-- Professor: Me. Sergio Souza Novak
-- ============================================================

-- IMPORTANTE:
-- Para executar este comando, conecte-se ao banco padrão 'postgres'
-- no psql, pgAdmin, DBeaver ou extensão de banco do editor.

CREATE DATABASE bets_db
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'C'
    LC_CTYPE = 'C'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

COMMENT ON DATABASE bets_db IS 'Banco de dados oficial da plataforma ProbaBet WebSocket';
