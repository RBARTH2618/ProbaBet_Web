# GUIA E ROTEIRO DE ARGUIÇÃO ORAL COM O PROFESSOR
**Plataforma ProbaBet — Trabalho Prático N2**  
**Disciplina:** Desenvolvimento de Software para Web  
**Professor:** Prof. Novak  
**Integrantes:**
* **Arthur Borges Rodrigues** (Foco: Backend, WebSocket, Banco de Dados, Concorrência e Regras de Negócio)
* **João Lucas Tavares Silva** (Foco: Frontend, Telas 1/2/3, UI/UX, Reatividade, Ranking e Áudio)

---

## 1. DIVISÃO FORMAL DE PAPÉIS NA APRESENTAÇÃO

> [!NOTE]
> Embora cada integrante tenha seu foco de apresentação, **ambos devem dominar o fluxo completo**, pois o professor pode questionar qualquer um dos dois sobre qualquer parte do sistema.

### Arthur Borges Rodrigues (Backend & Arquitetura):
* Explicação da arquitetura de eventos orientada a mensagens e servidor WebSocket nativo (`ws`).
* Estrutura relacional do PostgreSQL, tabelas, chaves estrangeiras e integridade referencial.
* Como o saldo atômico é debitado no `PLACE_BET` e creditado no `CASH_OUT` / `BET_SETTLED`.
* Explicação profunda de **como foi resolvida a Race Condition (RNF-01)** no Cash Out e a garantia de saldo não-negativo (RNF-02).
* Apresentação da suíte de testes automatizados e medição de latência < 100 ms (RNF-03).

### João Lucas Tavares Silva (Frontend & Experiência do Usuário):
* Apresentação da identidade visual esportiva (*Dark Mode*, *Glassmorphism*, paleta de cores CSS).
* Explicação da estrutura e responsabilidade de cada uma das **3 Telas**:
  * **Tela 1 (`tela1-odds.html`):** Lobby de jogos ao vivo, placares e feed de eventos WS.
  * **Tela 2 (`tela2-betslip.html`):** Detalhes da partida, estatísticas ao vivo, múltiplos mercados e Caderneta avançada.
  * **Tela 3 (`tela3-cashout.html`):** Carteira financeira (KPIs), apostas abertas com Cash Out dinâmico e histórico.
* Demonstração do Ranking da Sessão em tempo real (RF-08) com pódio esportivo.
* Demonstração do alerta de gol com síntese programática da Web Audio API (RF-06).

---

## 2. ROTEIRO CRONOLÓGICO DA DEMONSTRAÇÃO PRÁTICA (5 a 7 MINUTOS)

### Minuto 1: Abertura e Conexão Inicial (Arthur & João)
* **Ação:** Abrir a **Tela 1 (Lobby)** no navegador (`http://localhost:3000/tela1-odds.html` ou pelo link do Render).
* **Falar (João):** *"Professor, aqui temos o Lobby ao vivo da ProbaBet. Ao carregar a página, uma conexão WebSocket Full-Duplex persistente é imediatamente negociada."*
* **Falar (Arthur):** *"Nesse instante, o servidor emite o evento `CONNECTION_ESTABLISHED` e vincula à sessão do apostador o saldo inicial de R$ 100,00 fictícios, cumprindo o **RF-01**."*
* **Mostrar:** Apontar para o badge de conexão verde `WS Conectado (3000)` e o saldo `R$ 100,00` no topo direito.

### Minuto 2: Odds Dinâmicas e Navegação para Tela 2 (João)
* **Ação:** Mostrar as odds oscilando no Lobby e clicar no botão `🔍 Detalhes` do Flamengo x Palmeiras.
* **Falar (João):** *"O motor de simulação no backend calcula probabilidades a cada 2,5 segundos e emite `ODDS_UPDATE` para todos os clientes sem necessidade de recarregar a página (**RF-02**). Ao clicar em Detalhes, somos levados para a **Tela 2**, onde temos as estatísticas em tempo real da partida e mercados expandidos."*

### Minuto 3: Submissão de Aposta & Saldo Não-Negativo (Arthur & João)
* **Ação:** Na Tela 2, clicar na odd do Flamengo (`CASA @ 2.10`), preencher R$ 25,00 e clicar em `Confirmar Aposta`.
* **Falar (Arthur):** *"Quando o usuário submete a aposta, o comando `PLACE_BET` é enviado pelo WebSocket (**RF-03**). O servidor valida atomicamente se o valor é positivo e se o saldo atual é suficiente. Nenhuma aposta pode deixar o saldo negativo, garantindo o **RNF-02** tanto na camada de aplicação quanto no PostgreSQL via `CHECK (saldo_ficticio >= 0)`."*
* **Mostrar:** Exibir o modal de **Comprovante de Aposta** com o número do bilhete e o saldo debitado de R$ 100,00 para R$ 75,00.

### Minuto 4: Tela 3 - Carteira e Cálculo Contínuo de Cash Out (João & Arthur)
* **Ação:** Clicar no botão `Ver Carteira` ou na aba superior `Tela 3: Carteira & Cash Out`.
* **Falar (João):** *"Na **Tela 3**, temos o painel financeiro do apostador. Nosso bilhete recém-criado já aparece listado em 'Apostas Abertas'. Observe que o botão de Cash Out está recalculando continuamente o valor de oferta (**RF-04**), emitindo um pulso visual a cada nova cotação."*
* **Falar (Arthur):** *"A fórmula de Cash Out do backend compara a probabilidade no momento da aposta com a probabilidade instantânea do jogo, aplicando a margem matemática justa."*

### Minuto 5: Ocorrência de Gol, Suspensão e Prevenção de Race Condition (Arthur & João)
* **Ação:** Clicar no botão `⚽ Simular Gol`.
* **Observar:** Toca o acorde sonoro de comemoração, sobe o pop-up vermelho `⚽ GOOOOOL!`, e a faixa `🔒 Mercado Temporariamente Suspenso` é ativada.
* **Falar (João):** *"Quando ocorre um gol, o backend emite o broadcast prioritário `GOAL` e `MARKET_SUSPENDED` (**RF-06**). Imediatamente a interface bloqueia os botões e exibe o alerta visual e sonoro sintetizado nativamente pela Web Audio API."*
* **Falar (Arthur):** *"Este é o momento crucial do **RNF-01 (Prevenção de Race Condition)**. Se o apostador tentar clicar em Cash Out exatamente durante o gol, o servidor rejeita a transação com `CASH_OUT_REJECTED`, impedindo que ele resgate um valor defasado antes da atualização do placar. Não há hipótese de pagamento duplicado ou inconsistência."*

### Minuto 6: Execução de Cash Out, Liquidação e Ranking (Arthur & João)
* **Ação:** Aguardar os 4 segundos da reabertura de mercado e clicar em `Encerrar Aposta (Cash Out)`.
* **Falar (Arthur):** *"Agora que o mercado foi reaberto com a nova odd pós-gol, clicamos em Cash Out. O comando `CASH_OUT` é processado atomicamente (**RF-05**), encerrando o bilhete e creditando o valor no saldo."*
* **Falar (João):** *"E na barra lateral, temos o **Ranking da Sessão em Tempo Real (RF-08)**, onde todos os competidores são reordenados automaticamente pelo maior saldo a cada aposta ganha, perdida ou encerrada."*

### Minuto 7: Prova de Testes Automatizados e Baixa Latência (Arthur)
* **Ação:** No terminal, rodar: `npm test` na pasta `backend`.
* **Mostrar:** Execução das 8 suítes com 100% de aprovação em poucos segundos.
* **Falar (Arthur):** *"Para comprovar a robustez de toda a arquitetura, implementamos suítes de testes unitários e de integração automatizados. Nosso teste E2E comprovou tempo de resposta de apenas **3 a 5 ms**, superando amplamente o requisito de latência inferior a 100 ms (**RNF-03**)."*

---

## 3. PERGUNTAS PROVÁVEIS DO PROFESSOR NOVAK E RESPOSTAS TÉCNICAS

### Pergunta 1: *"Por que vocês escolheram WebSocket nativo em vez de Socket.IO ou Server-Sent Events (SSE)?"*
* **Resposta Ideal (Arthur):**
  > *"Professor, o Socket.IO adiciona um overhead significativo de protocolo próprio, pacotes de heartbeat customizados e fallback para polling HTTP que degradam a latência. Com a biblioteca nativa `ws`, trabalhamos diretamente sobre a especificação RFC 6455. As mensagens trafegam como frames TCP diretos, reduzindo o tempo de resposta para menos de 5 ms, o que foi essencial para atingir o RNF-03 (< 100 ms). Já o SSE seria unidirecional (apenas servidor para cliente), exigindo requisições HTTP POST para cada aposta, perdendo a vantagem do canal Full-Duplex único."*

### Pergunta 2: *"Como exatamente vocês implementaram o controle de concorrência no Cash Out (RNF-01)?"*
* **Resposta Ideal (Arthur):**
  > *"Implementamos uma máquina de estados atômica e verificação de bloqueio em duas fases no `cashoutService.js`. Quando uma solicitação `CASH_OUT` chega, o serviço primeiro adquire uma trava exclusiva de bilhete e verifica se o mercado daquela partida está no estado `SUSPENSA`. Se houver um gol em andamento, a operação é rejeitada imediatamente com o evento `CASH_OUT_REJECTED`. Se o mercado estiver liberado, o status do bilhete é promovido de `ABERTA` para `CASH_OUT` e o crédito é lançado na carteira em transação atômica única, impedindo que o evento de encerramento da partida (`match_finished`) pague o bilhete uma segunda vez."*

### Pergunta 3: *"Como vocês garantem que o saldo do usuário nunca fique negativo (RNF-02)?"*
* **Resposta Ideal (Arthur):**
  > *"Aplicamos defesa em profundidade em três níveis:
  > 1. No frontend, a Caderneta valida o valor digitado contra o saldo em tempo real e desativa o botão de aposta se `valor > saldo`.
  > 2. No backend (`apostadorService.debitarSaldo`), antes de qualquer débito verificamos se `saldoAtual < valor`. Se for, lançamos uma exceção e emitimos `BET_REJECTED`.
  > 3. No banco de dados PostgreSQL (`database/03_constraints.sql`), criamos a constraint `CHECK (saldo_ficticio >= 0.00)`. Se qualquer bug tentasse gravar saldo negativo, o próprio SGBD abortaria a transação com Rollback."*

### Pergunta 4: *"Como o frontend reage às mudanças de cotação enquanto o usuário está montando a aposta?"*
* **Resposta Ideal (João):**
  > *"Na Tela 2 (`tela2-betslip.html`), ouvimos o evento `ODDS_UPDATE` via WebSocket. Se o usuário estiver com um bilhete em edição e a odd da seleção escolhida oscilar no backend, a interface exibe imediatamente um banner pulsante de alerta avisando: '⚡ A cotação mudou de @X.XX para @Y.YY! Retorno recalculado'. O retorno potencial é reajustado na hora, garantindo transparência para o apostador antes de ele clicar em confirmar."*

### Pergunta 5: *"Como funciona a comunicação entre as 3 telas sem que uma interfira na outra?"*
* **Resposta Ideal (João):**
  > *"O script `frontend/js/websocket.js` atua como um barramento de eventos compartilhado. Quando uma mensagem chega pelo socket, disparamos um `window.dispatchEvent(new CustomEvent('probabet:NOME_EVENTO', { detail }))`. Dessa forma, cada tela (Lobby, Bet Slip ou Carteira) adiciona ouvintes apenas para os dados que lhe interessam, mantendo o código modular, limpo e sem acoplamento direto entre as telas."*

### Pergunta 6: *"O que acontece se o banco de dados PostgreSQL cair durante a execução?"*
* **Resposta Ideal (Arthur):**
  > *"Criamos um mecanismo de resiliência e failover transparente: todas as operações do banco possuem blocos de fallback acoplados a instâncias em memória (`Map` de alta performance). Se o PostgreSQL estiver indisponível, o sistema detecta a falha de conexão e continua processando apostas, odds, gols e liquidações em memória sem travar ou derrubar a conexão WebSocket do usuário."*
