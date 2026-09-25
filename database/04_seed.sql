-- ============================================================
-- SCRIPT 04: Carga Inicial de Dados (Seed Data)
-- Projeto: ProbaBet - Plataforma de Apostas em Tempo Real
-- Disciplina: Desenvolvimento de Software para Web
-- Integrantes: Arthur Borges Rodrigues e João Lucas Tavares Silva
-- Professor: Me. Sergio Souza Novak
-- ============================================================

-- Conecte-se ao banco 'bets_db' antes de executar este script.

-- ------------------------------------------------------------
-- 1. APOSTADORES INICIAIS (Saldo Fictício de R$ 100,00 - RF-01)
-- ------------------------------------------------------------
INSERT INTO apostador (id_apostador, cpf_usuario, nome_completo, saldo_ficticio)
VALUES
    (1, '111.222.333-44', 'Arthur Borges Rodrigues', 100.00),
    (2, '555.666.777-88', 'João Lucas Tavares Silva', 100.00),
    (3, '999.888.777-66', 'Apostador Convidado', 100.00)
ON CONFLICT (id_apostador) DO UPDATE 
    SET saldo_ficticio = EXCLUDED.saldo_ficticio,
        nome_completo = EXCLUDED.nome_completo;

-- ------------------------------------------------------------
-- 2. PARTIDAS ESPORTIVAS PARA SIMULAÇÃO AO VIVO
-- ------------------------------------------------------------
INSERT INTO partida_esportiva (id_partida, modalidade_esportiva, time_casa, time_fora, placar_casa, placar_fora, minuto_jogo, status_partida)
VALUES
    (1, 'Futebol', 'Flamengo', 'Palmeiras', 0, 0, 18, 'AO_VIVO'),
    (2, 'Futebol', 'Real Madrid', 'Barcelona', 1, 1, 42, 'AO_VIVO'),
    (3, 'Basquete', 'LA Lakers', 'Boston Celtics', 85, 82, 32, 'AO_VIVO')
ON CONFLICT (id_partida) DO UPDATE 
    SET placar_casa = EXCLUDED.placar_casa,
        placar_fora = EXCLUDED.placar_fora,
        minuto_jogo = EXCLUDED.minuto_jogo,
        status_partida = EXCLUDED.status_partida;

-- ------------------------------------------------------------
-- 3. MERCADOS DE ODDS (1X2, Próximo Gol, Total de Gols - RF-02)
-- ------------------------------------------------------------
-- Partida 1: Flamengo x Palmeiras
INSERT INTO mercado_odd (id_mercado, id_partida, nome_mercado, opcao_selecao, cotacao_odd_atual, ativo)
VALUES
    (1,  1, '1X2', 'CASA', 2.10, true),
    (2,  1, '1X2', 'EMPATE', 3.25, true),
    (3,  1, '1X2', 'FORA', 3.40, true),
    (4,  1, 'PROXIMO_GOL', 'CASA', 1.85, true),
    (5,  1, 'PROXIMO_GOL', 'FORA', 2.20, true),
    (6,  1, 'TOTAL_GOLS', 'MAIS_2.5', 1.95, true),

-- Partida 2: Real Madrid x Barcelona
    (7,  2, '1X2', 'CASA', 2.45, true),
    (8,  2, '1X2', 'EMPATE', 2.90, true),
    (9,  2, '1X2', 'FORA', 2.80, true),
    (10, 2, 'PROXIMO_GOL', 'CASA', 1.90, true),
    (11, 2, 'PROXIMO_GOL', 'FORA', 1.90, true),

-- Partida 3: LA Lakers x Boston Celtics
    (12, 3, '1X2', 'CASA', 2.15, true),
    (13, 3, '1X2', 'FORA', 1.70, true)
ON CONFLICT (id_mercado) DO UPDATE 
    SET cotacao_odd_atual = EXCLUDED.cotacao_odd_atual,
        ativo = EXCLUDED.ativo;

-- ------------------------------------------------------------
-- 4. AJUSTE DAS SEQUÊNCIAS DO POSTGRESQL (SERIAL IDs)
-- ------------------------------------------------------------
SELECT setval('apostador_id_apostador_seq', (SELECT COALESCE(MAX(id_apostador), 1) FROM apostador));
SELECT setval('partida_esportiva_id_partida_seq', (SELECT COALESCE(MAX(id_partida), 1) FROM partida_esportiva));
SELECT setval('mercado_odd_id_mercado_seq', (SELECT COALESCE(MAX(id_mercado), 1) FROM mercado_odd));
