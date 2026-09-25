-- ============================================================
-- SCRIPT 03: Constraints (Chaves Estrangeiras, Checagens e Índices)
-- Projeto: ProbaBet - Plataforma de Apostas em Tempo Real
-- Disciplina: Desenvolvimento de Software para Web
-- Integrantes: Arthur Borges Rodrigues e João Lucas Tavares Silva
-- Professor: Me. Sergio Souza Novak
-- ============================================================

-- Conecte-se ao banco 'bets_db' antes de executar este script.

-- ------------------------------------------------------------
-- 1. REGRAS DA TABELA APOSTADOR
-- ------------------------------------------------------------
-- CPF deve ser único por apostador
ALTER TABLE apostador 
    DROP CONSTRAINT IF EXISTS uq_apostador_cpf;
ALTER TABLE apostador 
    ADD CONSTRAINT uq_apostador_cpf UNIQUE (cpf_usuario);

-- [RNF-02] Garantia de Integridade e Saldo Não Negativo
ALTER TABLE apostador 
    DROP CONSTRAINT IF EXISTS chk_apostador_saldo_nao_negativo;
ALTER TABLE apostador 
    ADD CONSTRAINT chk_apostador_saldo_nao_negativo CHECK (saldo_ficticio >= 0.00);


-- ------------------------------------------------------------
-- 2. REGRAS DA TABELA PARTIDA_ESPORTIVA
-- ------------------------------------------------------------
-- Status permitidos para a partida
ALTER TABLE partida_esportiva 
    DROP CONSTRAINT IF EXISTS chk_partida_status_valido;
ALTER TABLE partida_esportiva 
    ADD CONSTRAINT chk_partida_status_valido CHECK (status_partida IN ('AO_VIVO', 'ENCERRADA', 'SUSPENSA'));

-- Placares e minutos nunca podem ser negativos
ALTER TABLE partida_esportiva 
    DROP CONSTRAINT IF EXISTS chk_partida_placar_casa;
ALTER TABLE partida_esportiva 
    ADD CONSTRAINT chk_partida_placar_casa CHECK (placar_casa >= 0);

ALTER TABLE partida_esportiva 
    DROP CONSTRAINT IF EXISTS chk_partida_placar_fora;
ALTER TABLE partida_esportiva 
    ADD CONSTRAINT chk_partida_placar_fora CHECK (placar_fora >= 0);

ALTER TABLE partida_esportiva 
    DROP CONSTRAINT IF EXISTS chk_partida_minuto;
ALTER TABLE partida_esportiva 
    ADD CONSTRAINT chk_partida_minuto CHECK (minuto_jogo >= 0);


-- ------------------------------------------------------------
-- 3. REGRAS DA TABELA MERCADO_ODD
-- ------------------------------------------------------------
-- Relacionamento PARTIDA_ESPORTIVA 1:N MERCADO_ODD
ALTER TABLE mercado_odd 
    DROP CONSTRAINT IF EXISTS fk_mercado_partida;
ALTER TABLE mercado_odd 
    ADD CONSTRAINT fk_mercado_partida 
    FOREIGN KEY (id_partida) REFERENCES partida_esportiva (id_partida) 
    ON DELETE CASCADE;

-- Cotação da Odd mínima permitida (1.01)
ALTER TABLE mercado_odd 
    DROP CONSTRAINT IF EXISTS chk_mercado_odd_positiva;
ALTER TABLE mercado_odd 
    ADD CONSTRAINT chk_mercado_odd_positiva CHECK (cotacao_odd_atual >= 1.01);


-- ------------------------------------------------------------
-- 4. REGRAS DA TABELA BILHETE_APOSTA
-- ------------------------------------------------------------
-- Relacionamento APOSTADOR 1:N BILHETE_APOSTA
ALTER TABLE bilhete_aposta 
    DROP CONSTRAINT IF EXISTS fk_bilhete_apostador;
ALTER TABLE bilhete_aposta 
    ADD CONSTRAINT fk_bilhete_apostador 
    FOREIGN KEY (id_apostador) REFERENCES apostador (id_apostador) 
    ON DELETE RESTRICT;

-- Relacionamento MERCADO_ODD 1:N BILHETE_APOSTA
ALTER TABLE bilhete_aposta 
    DROP CONSTRAINT IF EXISTS fk_bilhete_mercado;
ALTER TABLE bilhete_aposta 
    ADD CONSTRAINT fk_bilhete_mercado 
    FOREIGN KEY (id_mercado) REFERENCES mercado_odd (id_mercado) 
    ON DELETE RESTRICT;

-- Valor apostado deve ser maior que zero
ALTER TABLE bilhete_aposta 
    DROP CONSTRAINT IF EXISTS chk_bilhete_valor_positivo;
ALTER TABLE bilhete_aposta 
    ADD CONSTRAINT chk_bilhete_valor_positivo CHECK (valor_apostado > 0.00);

-- Odd aceita deve ser maior ou igual a 1.01
ALTER TABLE bilhete_aposta 
    DROP CONSTRAINT IF EXISTS chk_bilhete_odd_valida;
ALTER TABLE bilhete_aposta 
    ADD CONSTRAINT chk_bilhete_odd_valida CHECK (odd_momento >= 1.01);

-- Status válidos para o bilhete de aposta
ALTER TABLE bilhete_aposta 
    DROP CONSTRAINT IF EXISTS chk_bilhete_status_valido;
ALTER TABLE bilhete_aposta 
    ADD CONSTRAINT chk_bilhete_status_valido CHECK (status_aposta IN ('ATIVA', 'GREEN', 'RED', 'CASH_OUT'));


-- ------------------------------------------------------------
-- 5. REGRAS DA TABELA TRANSACAO_CASHOUT
-- ------------------------------------------------------------
-- Relacionamento BILHETE_APOSTA 1:1 TRANSACAO_CASHOUT
-- A restrição UNIQUE garante que cada aposta só possa sofrer Cash Out uma única vez (RNF-01)
ALTER TABLE transacao_cashout 
    DROP CONSTRAINT IF EXISTS uq_cashout_aposta;
ALTER TABLE transacao_cashout 
    ADD CONSTRAINT uq_cashout_aposta UNIQUE (id_aposta);

ALTER TABLE transacao_cashout 
    DROP CONSTRAINT IF EXISTS fk_cashout_bilhete;
ALTER TABLE transacao_cashout 
    ADD CONSTRAINT fk_cashout_bilhete 
    FOREIGN KEY (id_aposta) REFERENCES bilhete_aposta (id_aposta) 
    ON DELETE RESTRICT;

-- Valor resgatado deve ser maior que zero
ALTER TABLE transacao_cashout 
    DROP CONSTRAINT IF EXISTS chk_cashout_resgate_positivo;
ALTER TABLE transacao_cashout 
    ADD CONSTRAINT chk_cashout_resgate_positivo CHECK (valor_resgatado > 0.00);


-- ------------------------------------------------------------
-- 6. ÍNDICES DE PERFORMANCE PARA BAIXA LATÊNCIA (RNF-03)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_mercado_partida_ativo 
    ON mercado_odd (id_partida, ativo);

CREATE INDEX IF NOT EXISTS idx_bilhete_apostador_status 
    ON bilhete_aposta (id_apostador, status_aposta);

CREATE INDEX IF NOT EXISTS idx_partida_status 
    ON partida_esportiva (status_partida);
