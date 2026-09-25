# Atividade Prática — Ws2 (UML Completo)
**Prof.: Me. Sergio Souza Novak**  
**Disciplina: Desenvolvimento de Software para Web**

---

## 1. Introdução e Contextualização do Sistema

O mercado de apostas esportivas (*iGaming* e *Sportsbooks*) demanda infraestruturas de altíssimo desempenho e baixíssima latência. Durante partidas ao vivo, ocorrências como gols, cartões vermelhos ou alterações súbitas na probabilidade de vitória exigem reavaliações instantâneas das cotações (*Odds*). Modelos tradicionais baseados em requisições HTTP REST convencionais falham nesse cenário devido ao custo de abertura de conexões TCP e overhead de cabeçalhos HTTP para cada atualização.

A adoção do protocolo **WebSocket** provê um canal Full-Duplex persistente sobre uma única conexão TCP. Isso permite que o servidor envie atualizações contínuas de cotações em tempo real para milhares de clientes simultâneos sem necessidade de *polling*, além de viabilizar a recepção imediata dos cupons de aposta submetidos pelos usuários e a recalculação em tempo real do valor de encerramento antecipado (**Cash Out**).

Esta atividade prática orienta a construção de um ecossistema completo de apostas em tempo real, integrando painéis dinâmicos de cotações, transmissão de estatísticas de jogo e mecanismo de apostas bidirecional.

### Visão Geral do Projeto
> As plataformas modernas de apostas esportivas ao vivo baseiam-se em fluxos bidirecionais contínuos de altíssima velocidade para atualizar cotações (*Odds*) à medida que o jogo se desenrola. O objetivo desta atividade é implementar uma aplicação Web simulação de apostas ao vivo utilizando o protocolo **WebSocket**. Cada participante receberá um saldo fictício inicial de R$ 100,00, poderá submeter apostas em mercados dinâmicos, acompanhar flutuações de cotações, receber notificações de gols e utilizar o recurso avançado de **Cash Out** pré-jogo/em-jogo.

---

## 2. Especificação Completa de Requisitos

### 2.1 Requisitos Funcionais

- **[RF-01] Atribuição de Saldo Fictício Inicial:**  
  Ao estabelecer com sucesso a conexão bidirecional via WebSocket, o servidor deve vincular à sessão do apostador um saldo fictício inicial no valor exato de R$ 100,00, transmitindo a confirmação da carteira no evento inicial de handshake.  
  *Prioridade: Crítica*

- **[RF-02] Transmissão Dinâmica de Odds (`ODDS_UPDATE`):**  
  O servidor backend deve simular o andamento da partida ao vivo e atualizar periodicamente (a cada 2 a 3 segundos) as cotações dos mercados de aposta (1X2, Próximo Gol, Total de Gols), transmitindo o broadcast do evento `ODDS_UPDATE` em JSON para todos os clientes conectados.  
  *Prioridade: Crítica*

- **[RF-03] Submissão e Validação de Apostas (`PLACE_BET`):**  
  O cliente deve permitir a montagem e envio do bilhete de aposta contendo o ID da partida, mercado escolhido, opção selecionada, odd aceita e valor em Reais. O servidor deve verificar a disponibilidade de saldo em memória, debitar o valor da aposta atomicamente e emitir o comprovante `BET_CONFIRMED`.  
  *Prioridade: Crítica*

- **[RF-04] Cálculo e Atualização de Cash Out em Tempo Real:**  
  Durante a realização da partida ao vivo, o servidor deve recalcular continuamente o valor de resgate antecipado (*Cash Out*) para cada aposta ativa com base na probabilidade instantânea do evento, transmitindo os novos valores de encerramento para o painel do usuário.  
  *Prioridade: Alta*

- **[RF-05] Processamento e Encerramento Antecipado (`CASH_OUT`):**  
  Ao acionar o botão de Cash Out no painel, o navegador deve enviar o evento `CASH_OUT` com o ID do bilhete. O servidor deve encerrar imediatamente a aposta ativa, creditar o valor acordado no saldo do apostador e responder com a mensagem `CASH_OUT_CONFIRMED`.  
  *Prioridade: Alta*

- **[RF-06] Notificação Instantânea de Eventos do Jogo (`GOAL`):**  
  Quando ocorrer um evento decisivo na simulação da partida (ex: Gol ou Cartão Vermelho), o servidor deve emitir um broadcast prioritário congelando temporariamente as apostas nos mercados afetados e exibindo um banner pop-up com sinal sonoro na tela dos clientes.  
  *Prioridade: Alta*

- **[RF-07] Liquidação Automática de Apostas Vencedoras:**  
  Ao término da partida ou encerramento do mercado, o servidor deve avaliar todas as apostas abertas, calcular o retorno potencial (Valor Apostado × Odd) para as seleções vitoriosas, creditar os ganhos na carteira e emitir a atualização de saldo (`BALANCE_UPDATE`).  
  *Prioridade: Crítica*

- **[RF-08] Painel do Apostador e Ranking da Sessão:**  
  A interface front-end deve apresentar um painel consolidado exibindo o saldo atualizado, bilhetes de aposta ativos com botão de Cash Out dinâmico e uma tabela de ranking em tempo real destacando os apostadores com maiores saldos da sessão.  
  *Prioridade: Média*

### 2.2 Requisitos Não-Funcionais

- **[RNF-01] Prevenção de Race Condition no Cash Out:**  
  O servidor backend deve implementar mecanismos de concorrência e trava atômica. Se um evento de gol for registrado no exato milissegundo em que uma requisição de Cash Out for recebida, a solicitação de resgate deve ser rejeitada imediatamente para evitar liquidações inconsistentes.  
  *Prioridade: Crítica*

- **[RNF-02] Garantia de Integridade e Saldo Não Negativo:**  
  O sistema deve validar estritamente todas as operações de débito, rejeitando qualquer tentativa de aposta ou transação cujo valor exceda o saldo corrente do apostador, impedindo saldos negativos.  
  *Prioridade: Crítica*

- **[RNF-03] Altíssima Eficiência e Baixa Latência (< 100 ms):**  
  A entrega de cotações atualizadas e o processamento dos bilhetes de aposta devem ser trafegados em estruturas JSON compactas via WebSocket, com tempo de resposta inferior a 100 ms.  
  *Prioridade: Alta*

---

## 3. Modelo de Dados & Entidades

1. **APOSTADOR:** `id_apostador` (PK), `cpf_usuario`, `nome_completo`, `saldo_ficticio`, `data_cadastro`
2. **PARTIDA_ESPORTIVA:** `id_partida` (PK), `modalidade_esportiva`, `time_casa`, `time_fora`, `placar_casa`, `placar_fora`, `minuto_jogo`, `status_partida`
3. **MERCADO_ODD:** `id_mercado` (PK), `id_partida` (FK), `nome_mercado`, `opcao_selecao`, `cotacao_odd_atual`, `ativo`
4. **BILHETE_APOSTA:** `id_aposta` (PK), `id_apostador` (FK), `id_mercado` (FK), `valor_apostado`, `odd_momento`, `retorno_potencial`, `status_aposta`, `data_hora_aposta`
5. **TRANSACAO_CASHOUT:** `id_cashout` (PK), `id_aposta` (FK), `valor_resgate_oferecido`, `valor_resgatado`, `timestamp_efetivacao`

---

## 4. Telas do Sistema (Protótipos)

1. **Tela 1: Lobby de Apostas Ao Vivo (`tela1-odds.html`)**
   - Lista de jogos ao vivo (ex: Futebol, Basquete)
   - Cotações flutuantes (Odds 1X2, etc.) que sobem (verde) ou descem (vermelho) em tempo real via WebSocket.
2. **Tela 2: Detalhes da Partida e Bet Slip (`tela2-betslip.html`)**
   - Estatísticas do jogo (Posse de bola, Chutes a gol, Escanteios, Feed do jogo)
   - Caderneta de aposta lateral (Digitação do valor, cálculo do Retorno Potencial, botão "Confirmar Aposta").
3. **Tela 3: Carteira e Gestão de Cash Out (`tela3-cashout.html`)**
   - Minhas Apostas Ativas / Histórico
   - Oferta dinâmica de Cash Out com botão "Realizar Cash Out".

---

## 5. Arquivo PDF Original
O documento PDF original encontra-se em:  
`Especificação do professor/Documento do professor (BETs).pdf`
