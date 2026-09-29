-- ============================================================
-- SCRIPT 05: Tabela de Histórico de Liquidações de Apostas
-- Projeto: ProbaBet - Plataforma de Apostas em Tempo Real
-- Disciplina: Desenvolvimento de Software para Web
-- ============================================================

CREATE TABLE IF NOT EXISTS historico_liquidacao (
    id_historico SERIAL PRIMARY KEY,
    id_aposta INT NOT NULL,
    id_apostador INT NOT NULL,
    id_partida INT,
    partida_nome VARCHAR(120),
    mercado VARCHAR(50) NOT NULL DEFAULT '1X2',
    selecao VARCHAR(40) NOT NULL,
    odd_momento DECIMAL(6,2) NOT NULL,
    valor_apostado DECIMAL(10,2) NOT NULL,
    status_final VARCHAR(20) NOT NULL, -- 'GREEN', 'RED', 'CASH_OUT'
    valor_retorno DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    lucro_prejuizo DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    placar_final VARCHAR(30),
    motivo_liquidacao VARCHAR(40) DEFAULT 'TERMINO_PARTIDA',
    data_liquidacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hist_apostador ON historico_liquidacao(id_apostador);
CREATE INDEX IF NOT EXISTS idx_hist_aposta ON historico_liquidacao(id_aposta);
