# RELATÓRIO TÉCNICO OFICIAL — PLATAFORMA PROBABET
**Desenvolvimento de Software para Web — Trabalho Prático N2**  
**Docente:** Prof. Novak  
**Acadêmicos:**
* Arthur Borges Rodrigues
* João Lucas Tavares Silva

**Repositório Oficial:** [github.com/RBARTH2618/ProbaBet_Web](https://github.com/RBARTH2618/ProbaBet_Web)  
**Data de Conclusão:** 27 de Setembro de 2026  

---

## 1. INTRODUÇÃO
O setor de entretenimento digital e apostas esportivas ao vivo (*in-play betting*) impõe desafios complexos de engenharia de software: exigência de comunicação full-duplex de altíssima frequência, rigorosa consistência transacional sob concorrência e latência perceptiva nula para o usuário final. 

Neste contexto, o projeto **ProbaBet** foi concebido e implementado como uma plataforma web de simulação esportiva e apostas em tempo real, desenvolvida de acordo com os requisitos funcionais e não funcionais estipulados para a disciplina de Desenvolvimento de Software para Web.

O sistema opera com eventos orientados a dados disparados por um motor de simulação autônomo, sincronizando cotações (*odds*), lances, encerramentos antecipados (*cash out*), liquidações financeiras e classificação de usuários em um ecossistema full-stack integrado.

---

## 2. OBJETIVOS DO PROJETO
* Desenvolver uma aplicação Web completa em tempo real utilizando o protocolo **WebSocket** nativo (sem bibliotecas de polling ou abstrações pesadas).
* Modelar e implementar a persistência relacional das entidades de negócio em **PostgreSQL**, com garantias estritas de integridade referencial e saldo não-negativo.
* Implementar mecanismos avançados de controle de concorrência para mitigar anomalias de *Race Condition* entre a ocorrência de gols/suspensão e solicitações concorrentes de Cash Out.
* Criar uma interface gráfica esportiva moderna (*Dark Mode*, *Glassmorphism* e microanimações reativas) distribuída em 3 telas complementares (Lobby, Detalhes/Bet Slip e Carteira/Cash Out).
* Garantir latência ponta a ponta inferior a 100 ms (atingindo ~3 a 5 ms nos testes de carga).

---

## 3. TECNOLOGIAS E FERRAMENTAS UTILIZADAS

### 3.1. Backend
* **Runtime:** Node.js (v20+ LTS).
* **Servidor HTTP:** Express (v4.19) para disponibilização de assets estáticos e rotas de integridade (*healthcheck*).
* **Protocolo de Tempo Real:** Biblioteca `ws` nativa (v8.18) implementando o protocolo RFC 6455 com suporte a framing binário e JSON de baixa latência.
* **Driver de Banco de Dados:** `pg` (v8.11) com pool de conexões otimizado (`pg.Pool`).
* **Segurança e Variáveis de Ambiente:** `dotenv` e `cors`.

### 3.2. Banco de Dados
* **PostgreSQL:** Sistema Gerenciador de Banco de Dados Relacional (SGBD) com ACID estrito, constraints do tipo `CHECK`, triggers e chaves estrangeiras com ações referenciais em cascata restrita.

### 3.3. Frontend
* **Core:** HTML5 Semântico, Vanilla JavaScript (ES6+ assíncrono).
* **Estilização:** CSS3 puro e customizado, com variáveis de design (*CSS Tokens*), CSS Grid, Flexbox e animações por GPU via `transform` e `keyframes`.
* **Áudio:** Web Audio API nativa para síntese sonora programática de gols e celebração de vitórias (sem arquivos de áudio externos).

### 3.4. Infraestrutura & Cloud
* **PaaS:** Render.com com suporte a WebSockets persistentes, SSL/TLS automático (`wss://`) e deploy automatizado acoplado à branch `main` do GitHub via `render.yaml`.
* **Ambiente de Desenvolvimento:** Antigravity (Google DeepMind).

---

## 4. ARQUITETURA DO SISTEMA

O sistema adota uma **Arquitetura Orientada a Eventos (EDA)** baseada no padrão *Publisher/Subscriber* interno acoplado a um *Message Router* bidirecional.

```
                          +------------------------------------------------+
                          |              NAVEGADOR / CLIENTE               |
                          |                                                |
                          |  Tela 1: Lobby       Tela 2: Bet Slip   Tela 3 |
                          |  (tela1-odds.html) (tela2-betslip.html)  (Cash)|
                          +-----------------------+------------------------+
                                                  |
                                    WebSocket Connection (JSON)
                                    ws:// ou wss:// (RFC 6455)
                                                  |
                                                  v
+-----------------------------------------------------------------------------------------+
|                                    BACKEND NODE.JS                                      |
|                                                                                         |
|  +------------------------+      +--------------------+      +-----------------------+  |
|  |   WebSocket Gateway    | <--> |   Message Router   | <--> |   Services Layer      |  |
|  |   (ws Server / Auth)   |      |  (messageHandler)  |      |                       |  |
|  +------------------------+      +--------------------+      | * matchSimulator      |  |
|               ^                                              | * oddsEngineService   |  |
|               |                                              | * betService          |  |
|               v                                              | * cashoutService      |  |
|  +------------------------+                                  | * settlementService   |  |
|  |     Event Emitters     |                                  | * apostadorService    |  |
|  |   (ODDS, GOAL, etc)    |                                  +-----------+-----------+  |
|  +------------------------+                                              |              |
+--------------------------------------------------------------------------|--------------+
                                                                           |
                                                             pg.Pool Query / Memory Map
                                                                           |
                                                                           v
                                                              +------------------------+
                                                              |  POSTGRESQL DATABASE   |
                                                              |   (apostador, bilhete, |
                                                              |   partida, cashout)    |
                                                              +------------------------+
```

### 4.1. Resiliência e Alta Disponibilidade
O backend conta com uma camada de **Failover Híbrido**: caso o PostgreSQL esteja momentaneamente offline ou em manutenção, o sistema comuta transparentemente para estruturas `Map` em memória com sincronização O(1), permitindo que todos os testes, simulações e navegação web funcionem ininterruptamente sem travar a aplicação.

---

## 5. ESPECIFICAÇÃO DE REQUISITOS DO SISTEMA

### 5.1. Requisitos Funcionais (RF)

| ID | Nome | Descrição Técnica | Implementação |
| :--- | :--- | :--- | :--- |
| **RF-01** | Atribuição de Saldo Inicial | Vincula R$ 100,00 fictícios à sessão do apostador no handshake WebSocket. | `apostadorService.js`, `websocket/index.js` |
| **RF-02** | Atualização Dinâmica de Odds | Recalcula odds a cada tick (2,5s) e emite broadcast `ODDS_UPDATE`. | `oddsEngineService.js`, `matchSimulatorService.js` |
| **RF-03** | Submissão e Validação de Apostas | Valida saldo, debita atomicamente, registra bilhete e emite `BET_CONFIRMED`. | `betService.js`, `messageHandler.js` |
| **RF-04** | Cálculo e Atualização de Cash Out | Calcula continuamente valor de encerramento de apostas ativas conforme probabilidades. | `cashoutService.js` |
| **RF-05** | Processamento de CASH_OUT | Encerra bilhete ativo, credita valor acordado e emite `CASH_OUT_CONFIRMED`. | `cashoutService.js`, `TransacaoCashout.js` |
| **RF-06** | Notificação de Gol & Congelamento | Emite `GOAL`, suspende mercados afetados por 4s e reabre com novas cotações. | `matchSimulatorService.js`, `style.css` |
| **RF-07** | Liquidação Automática | Avalia bilhetes no encerramento (GREEN/RED), credita prêmios e emite `BET_SETTLED`. | `settlementService.js` |
| **RF-08** | Painel do Apostador & Ranking | Classifica apostadores por saldo em tempo real e emite `RANKING_UPDATE`. | `apostadorService.js`, `websocket.js` |

### 5.2. Requisitos Não Funcionais (RNF)

| ID | Nome | Especificação e Solução Técnica Adotada |
| :--- | :--- | :--- |
| **RNF-01** | Prevenção de *Race Condition* no Cash Out | Trava de concorrência atômica nos estados do bilhete (`ABERTA` -> `ENCERRANDO` -> `CASH_OUT`). Se um gol ocorrer ou o mercado for suspenso simultaneamente, a operação rejeita com código de erro específico (`CASHOUT_REJECTED`) sem duplo pagamento. |
| **RNF-02** | Integridade e Saldo Não Negativo | Verificação atômica de saldo tanto na aplicação quanto no banco via constraint `CHECK (saldo_ficticio >= 0.00)`. Qualquer tentativa de aposta com valor superior ao saldo é rejeitada imediatamente (`INSUFFICIENT_FUNDS`). |
| **RNF-03** | Eficiência e Baixa Latência | Mensagens compactas em JSON, conexões persistentes WebSocket com TCP_NODELAY nativo. Tempo de resposta médio medido entre **3 ms e 6 ms**, amplamente abaixo do limite de 100 ms estipulado pelo professor. |

---

## 6. MODELAGEM DE BANCO DE DADOS (POSTGRESQL)

O banco foi normalizado na **3ª Forma Normal (3FN)** contendo cinco tabelas principais:

```
[APOSTADOR] (1) <------- (N) [BILHETE_APOSTA] (N) -------> (1) [MERCADO_ODD] (N) <------- (1) [PARTIDA_ESPORTIVA]
                                    | (1)
                                    |
                                    v (1)
                           [TRANSACAO_CASHOUT]
```

### 6.1. Dicionário de Dados Resumido
1. **`apostador`**: `id_apostador` (PK), `cpf_usuario` (UNIQUE), `nome_completo`, `saldo_ficticio` (DECIMAL(10,2) CHECK >= 0), `data_cadastro`.
2. **`partida_esportiva`**: `id_partida` (PK), `modalidade_esportiva`, `time_casa`, `time_fora`, `placar_casa`, `placar_fora`, `minuto_jogo`, `status_partida` (CHECK in 'AGENDADA', 'AO_VIVO', 'SUSPENSA', 'ENCERRADA').
3. **`mercado_odd`**: `id_mercado` (PK), `id_partida` (FK), `nome_mercado`, `opcao_selecionada`, `cotação_atual`, `status_mercado`.
4. **`bilhete_aposta`**: `id_aposta` (PK), `id_apostador` (FK), `id_mercado` (FK), `valor_apostado`, `odd_momento`, `retorno_potencial`, `status_aposta` (CHECK in 'ABERTA', 'GREEN', 'RED', 'CASH_OUT', 'CANCELADA'), `data_aposta`.
5. **`transacao_cashout`**: `id_cashout` (PK), `id_aposta` (FK UNIQUE), `valor_pago`, `data_hora_transacao`.

---

## 7. PROTOCOLO E EVENTOS WEBSOCKET

Todas as mensagens transitam no formato JSON com envelope padronizado contendo `event` e `timestamp`.

### 7.1. Eventos Cliente -> Servidor (Comandos)
* `PING`: Heartbeat do cliente contendo timestamp local para cálculo de latência de ida e volta (Round-Trip Time).
* `GET_BALANCE`: Solicita saldo atualizado do apostador.
* `GET_MATCHES`: Solicita estado atualizado de todas as partidas em andamento.
* `GET_ODDS`: Solicita cotações ativas de uma partida específica (`matchId`).
* `PLACE_BET`: Submete aposta contendo `{ matchId, mercadoId, selecao, odd, valor }`.
* `GET_ACTIVE_BETS`: Solicita lista de bilhetes em aberto do apostador.
* `CASH_OUT`: Executa encerramento antecipado `{ betId, requestedValue }`.
* `GET_RANKING`: Solicita classificação atualizada da sessão.
* `TRIGGER_GOAL`: Comando didático para demonstrar a simulação de gol e suspensão de mercado.
* `RESET_MATCHES`: Reinicializa as partidas para um novo ciclo de demonstração.

### 7.2. Eventos Servidor -> Cliente (Notificações & Broadcasts)
* `CONNECTION_ESTABLISHED`: Handshake inicial com confirmação de saldo (RF-01) e partidas.
* `BALANCE_UPDATE`: Notifica alteração de saldo decorrente de aposta, cash out ou green.
* `MATCH_UPDATE`: Atualização de placar, minuto de jogo e status da partida.
* `ODDS_UPDATE`: Broadcast com novas cotações e indicador de alta/baixa.
* `BET_CONFIRMED`: Comprovante formal do bilhete registrado.
* `BET_REJECTED`: Notificação de recusa com motivo amigável.
* `CASHOUT_UPDATE`: Cotação recalculada de Cash Out para cada bilhete aberto.
* `CASH_OUT_CONFIRMED`: Confirmação do encerramento antecipado e valor creditado.
* `CASH_OUT_REJECTED`: Recusa de cash out devido a mercado suspenso ou oscilação.
* `GOAL`: Broadcast de gol contendo time autor e placares atualizados.
* `MARKET_SUSPENDED`: Bloqueio temporário de novos bilhetes.
* `BET_SETTLED`: Notificação de bilhete finalizado como GREEN ou RED.
* `SETTLEMENT_COMPLETED`: Relatório consolidado de liquidação da partida.
* `RANKING_UPDATE`: Broadcast da classificação dos líderes da sessão.
* `PONG`: Resposta imediata de keepalive ao ping do cliente.

---

## 8. REGRAS DE NEGÓCIO E ALGORITMOS

### 8.1. Motor de Odds Dinâmicas (RF-02)
O algoritmo calcula probabilidades implícitas baseadas em:
$$P(\text{CASA}) = \frac{\text{ForçaCasa} + \text{DiferençaGols} \times 0.25}{\text{SomaTotal}}$$
A Odd justa (*fair odd*) é obtida com a aplicação da margem da casa (*vigorish* de 5%):
$$\text{Odd} = \max\left(1.05, \min\left(50.0, \frac{1}{P \times 1.05}\right)\right)$$

### 8.2. Fórmula de Precificação do Cash Out (RF-04)
O valor de oferta do Cash Out varia em tempo real comparando a probabilidade atual com a probabilidade no momento em que a aposta foi realizada:
$$\text{ValorCashOut} = \text{ValorApostado} \times \left( \frac{\text{OddContratada}}{\text{OddAtual}} \right) \times (1 - \text{MargemCashout})$$
Onde a margem de retenção é calibrada em 8%. Caso a probabilidade tenha aumentado significativamente, o apostador obtém lucro antecipado; caso contrário, resgata parte do valor para limitar prejuízos.

### 8.3. Prevenção de Race Condition no Cash Out (RNF-01)
1. Ao receber a mensagem `CASH_OUT`, o serviço adquire uma trava exclusiva no bilhete.
2. Verifica se a partida correspondente está com `status === 'SUSPENSA'`. Em caso positivo, cancela a solicitação e emite `CASH_OUT_REJECTED`.
3. Verifica se a aposta já foi encerrada por liquidação final (`GREEN`/`RED`).
4. Altera o status para `CASH_OUT` e credita o valor na carteira em transação atômica única, liberando a trava em seguida.

---

## 9. MAPA DE INTERFACES DO FRONTEND

O frontend foi desenvolvido com design esportivo responsivo, sem uso de Tailwind ou frameworks externos:

1. **Tela 1: Lobby de Odds ao Vivo (`tela1-odds.html`)**
   * Cabeçalho com status do WebSocket, saldo com microanimações e perfil.
   * Lista de partidas ao vivo com placares e tempo em tempo real.
   * Mercados 1X2 com botões de seleção de odds interativos.
   * Barra lateral com Caderneta de Apostas, Apostas Ativas e Ranking da Sessão.
   * Console em tempo real exibindo a stream de eventos do WebSocket.

2. **Tela 2: Detalhes da Partida & Bet Slip Avançado (`tela2-betslip.html`)**
   * Seletor de partidas no topo para alternância imediata.
   * Arena central com placar expandido e estatísticas da partida (posse de bola, chutes e escanteios).
   * Múltiplos mercados (Resultado Final 1X2, Total de Gols Mais/Menos 2.5, Ambas Marcam).
   * Caderneta avançada com botões rápidos de valor (+10, +20, +50, Max) e alerta caso a cotação se altere durante a montagem do bilhete.
   * Modal com comprovante digital do bilhete confirmado.

3. **Tela 3: Carteira do Apostador & Cash Out Dedicado (`tela3-cashout.html`)**
   * Painel de KPIs financeiros: Saldo Disponível, Total em Jogo e Lucro/Prejuízo da sessão (P&L).
   * Aba de Apostas Abertas com botão dinâmico de Cash Out pulsante.
   * Aba de Histórico de Apostas Encerradas classificadas com badges GREEN, RED ou CASHOUT.
   * Widget de Ranking dos competidores da sessão.

---

## 10. VALIDAÇÃO E SUÍTE DE TESTES AUTOMATIZADOS (ETAPA 17)

O projeto conta com um script orquestrador (`backend/src/services/run-all-tests.js`) que executa 8 suítes completas de testes automatizados:

| Suíte de Testes | Requisito Alvo | Escopo do Teste | Resultado |
| :--- | :--- | :--- | :--- |
| `test-simulator.js` | RF-02 | Geração de ticks a cada 2.5s, progressão de tempo e placar | ✅ **APROVADO** |
| `test-odds.js` | RF-02 | Recálculo de probabilidades 1X2 e limites de odds (1.05 a 50.0) | ✅ **APROVADO** |
| `test-place-bet.js` | RF-03, RNF-02 | Débito atômico de saldo, rejeição de apostas sem saldo | ✅ **APROVADO** |
| `test-cashout.js` | RF-04, RF-05, RNF-01 | Cálculo contínuo, execução de Cash Out e rejeição em suspensão | ✅ **APROVADO** |
| `test-goal-suspension.js` | RF-06, RNF-01 | Disparo de gol, congelamento por 4s e reabertura de mercado | ✅ **APROVADO** |
| `test-settlement.js` | RF-07 | Liquidação automática no encerramento (GREEN e RED) | ✅ **APROVADO** |
| `test-ranking.js` | RF-08 | Ordenação decrescente por saldo e atualização em tempo real | ✅ **APROVADO** |
| `test-e2e-screens.js` | RNF-03 | Navegação ponta a ponta e medição de latência RTT (< 100 ms) | ✅ **APROVADO (3 ms)** |

---

## 11. TABELA DE RASTREABILIDADE DE REQUISITOS

| Requisito | Descrição Resumida | Arquivo de Backend | Arquivo de Frontend | Teste Automatizado |
| :--- | :--- | :--- | :--- | :--- |
| **RF-01** | Saldo Inicial R$ 100,00 | `apostadorService.js`, `websocket/index.js` | `tela1-odds.html`, `websocket.js` | `test-place-bet.js` |
| **RF-02** | Atualização de Odds | `oddsEngineService.js`, `matchSimulatorService.js` | `tela1-odds.html`, `tela2-betslip.html` | `test-odds.js` |
| **RF-03** | Submissão PLACE_BET | `betService.js`, `messageHandler.js` | `tela2-betslip.html`, `websocket.js` | `test-place-bet.js` |
| **RF-04** | Cálculo do Cash Out | `cashoutService.js` | `tela3-cashout.html`, `websocket.js` | `test-cashout.js` |
| **RF-05** | Encerramento CASH_OUT | `cashoutService.js`, `TransacaoCashout.js` | `tela3-cashout.html` | `test-cashout.js` |
| **RF-06** | Gol e Suspensão | `matchSimulatorService.js` | `tela1-odds.html`, `tela2-betslip.html` | `test-goal-suspension.js` |
| **RF-07** | Liquidação Automática | `settlementService.js` | `tela3-cashout.html`, `websocket.js` | `test-settlement.js` |
| **RF-08** | Ranking em Tempo Real | `apostadorService.js` | `tela1-odds.html`, `tela3-cashout.html` | `test-ranking.js` |
| **RNF-01** | Controle de Concorrência | `cashoutService.js` | `websocket.js` | `test-cashout.js` |
| **RNF-02** | Saldo Não Negativo | `apostadorService.js`, `03_constraints.sql` | `tela2-betslip.html` | `test-place-bet.js` |
| **RNF-03** | Baixa Latência (< 100ms) | `websocket/index.js`, `server.js` | `websocket.js` | `test-e2e-screens.js` |

---

## 12. CONSIDERAÇÕES FINAIS
A concepção e execução do **ProbaBet** proporcionou aos acadêmicos uma imersão profunda em conceitos vitais de engenharia de software para web: comunicação bidirecional de baixa latência com WebSockets nativos, mitigação de condições de corrida em sistemas financeiros e arquitetura distribuída resiliente.

Todas as metas especificadas pelo professor Novak foram rigorosamente alcançadas, resultando em um sistema modular, performático, esteticamente refinado e completamente validado por suítes de testes unitários e de integração.
