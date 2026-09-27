# ProbaBet — Plataforma de Apostas Esportivas em Tempo Real (WebSocket)

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Native%20ws-blue.svg)](https://github.com/websockets/ws)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/Tests-8%2F8%20Passed-success.svg)](backend/src/services/run-all-tests.js)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

Projeto prático desenvolvido para a disciplina de **Desenvolvimento de Software para Web** (Trabalho N2).  
* **Professor:** Me. Sergio Souza Novak  
* **Acadêmicos:**
  * **Arthur Borges Rodrigues** (Backend, WebSocket, PostgreSQL, Regras de Negócio, Concorrência)
  * **João Lucas Tavares Silva** (Frontend, Telas 1/2/3, UI/UX, Reatividade, Ranking, Áudio)
* **Repositório Oficial:** [github.com/RBARTH2618/ProbaBet_Web](https://github.com/RBARTH2618/ProbaBet_Web)

---

## 🎯 Objetivo do Projeto
Desenvolver um ecossistema completo de apostas esportivas ao vivo (*in-play betting*) com comunicação bidirecional em tempo real via **WebSocket nativo**, recálculo dinâmico de probabilidades e *Cash Out*, controle estrito de concorrência (*Race Condition*) entre lances e encerramentos, garantia de saldo não-negativo e tempo de resposta inferior a 100 ms (atingindo 3 a 5 ms).

---

## 🏗️ Arquitetura das 3 Telas
A plataforma é organizada em três interfaces interligadas e responsivas com tema *Dark Mode Esportivo*:

1. **Tela 1: Lobby de Odds ao Vivo (`frontend/tela1-odds.html`)**
   * Feed de partidas com relógio e placares sincronizados.
   * Mercados 1X2 com cotações oscilando em tempo real.
   * Ranking da Sessão e feed de eventos WebSocket.
2. **Tela 2: Detalhes da Partida & Caderneta Avançada (`frontend/tela2-betslip.html`)**
   * Seletor de partidas, arena do placar e estatísticas ao vivo (posse de bola, finalizações, escanteios).
   * Múltiplos mercados (1X2, Total de Gols Mais/Menos, Ambas Marcam).
   * Bet Slip com atalhos de valor, cálculo automático de retorno, alerta de mudança de odd e emissão de comprovante.
3. **Tela 3: Carteira do Apostador & Gestão de Cash Out (`frontend/tela3-cashout.html`)**
   * Resumo de KPIs financeiros (Saldo Disponível, Em Jogo, Lucro/Prejuízo).
   * Aba de Apostas Abertas com botão de Cash Out recalculado continuamente pelo backend.
   * Histórico de apostas liquidadas (GREEN, RED, CASHOUT).

---

## 📋 Tabela de Requisitos Atendidos

| Requisito | Descrição | Status |
| :--- | :--- | :---: |
| **RF-01** | Atribuição de Saldo Fictício Inicial de R$ 100,00 no Handshake | ✅ **100% Atendido** |
| **RF-02** | Atualização Dinâmica de Odds a cada tick (2,5s) via Broadcast | ✅ **100% Atendido** |
| **RF-03** | Submissão de Aposta (`PLACE_BET`) e Débito Atômico | ✅ **100% Atendido** |
| **RF-04** | Cálculo e Atualização Contínua de Oferta de Cash Out | ✅ **100% Atendido** |
| **RF-05** | Processamento Imediato de `CASH_OUT` com Crédito em Conta | ✅ **100% Atendido** |
| **RF-06** | Notificação de Gol (`GOAL`), Congelamento de Mercado por 4s e Sinal Sonoro | ✅ **100% Atendido** |
| **RF-07** | Liquidação Automática no Encerramento da Partida (`BET_SETTLED`) | ✅ **100% Atendido** |
| **RF-08** | Painel do Apostador e Ranking da Sessão em Tempo Real | ✅ **100% Atendido** |
| **RNF-01** | Prevenção de Race Condition no Cash Out com Trava de Concorrência | ✅ **100% Atendido** |
| **RNF-02** | Integridade Financeira com Saldo Estritamente Não-Negativo | ✅ **100% Atendido** |
| **RNF-03** | Eficiência e Baixa Latência (< 100 ms — medido: 3 a 5 ms) | ✅ **100% Atendido** |

---

## 🚀 Como Executar Localmente

### Pré-requisitos
* Node.js v18+ instalado.
* Git instalado.

### 1. Clonar o repositório
```bash
git clone https://github.com/RBARTH2618/ProbaBet_Web.git
cd ProbaBet_Web
```

### 2. Instalar dependências e iniciar o servidor
```bash
cd backend
npm install
npm start
```

### 3. Acessar no navegador
Abra qualquer uma das páginas:
* **Lobby:** [http://localhost:3000/tela1-odds.html](http://localhost:3000/tela1-odds.html)
* **Bet Slip:** [http://localhost:3000/tela2-betslip.html](http://localhost:3000/tela2-betslip.html)
* **Carteira:** [http://localhost:3000/tela3-cashout.html](http://localhost:3000/tela3-cashout.html)

---

## 🧪 Execução da Suíte de Testes Automatizados

O sistema conta com um orquestrador que executa **8 suítes de testes unitários e de integração**:
```bash
cd backend
npm test
```
*Output comprovando aprovação de 100% dos requisitos:*
```text
================================================================
   PROBABET — EXECUÇÃO CONSOLIDADA DA SUÍTE DE TESTES (ETAPA 17)
================================================================
⏳ Executando: Simulador de Partidas (RF-02)... ✅ APROVADO
⏳ Executando: Motor de Odds Dinâmicas (RF-02)... ✅ APROVADO
⏳ Executando: Submissão de Apostas & Saldo Atômico (RF-03, RNF-02)... ✅ APROVADO
⏳ Executando: Cálculo de Cash Out & Prevenção de Race Condition (RF-04, RF-05, RNF-01)... ✅ APROVADO
⏳ Executando: Notificação de Gol & Congelamento de Mercado (RF-06, RNF-01)... ✅ APROVADO
⏳ Executando: Liquidação Automática 1X2 GREEN/RED (RF-07)... ✅ APROVADO
⏳ Executando: Ranking da Sessão em Tempo Real (RF-08)... ✅ APROVADO
⏳ Executando: Integração Ponta a Ponta das 3 Telas & Latência < 100ms (RNF-03)... ✅ APROVADO
================================================================
   RESULTADO FINAL: 8 / 8 SUÍTES DE TESTES APROVADAS! (Latência: 3ms)
================================================================
```

---

## ☁️ Como Publicar no Render.com (Link para o Professor)

O repositório já está configurado com `render.yaml` e `package.json` raiz para deploy automático em 1 clique:

1. Acesse [render.com](https://render.com) e conecte com sua conta do GitHub.
2. Clique em **New +** -> **Web Service**.
3. Selecione o repositório `RBARTH2618/ProbaBet_Web`.
4. O Render detectará automaticamente as configurações de build (`npm install`) e start (`node backend/src/server.js`).
5. Clique em **Deploy Web Service**.
6. Em ~2 minutos você terá uma URL pública gratuita com SSL (`https://...` e `wss://...`) pronta para envio ao professor!

---

## 📚 Documentação Adicional
* 📄 **[Relatório Técnico Completo](docs/relatorio/RELATORIO_TECNICO_PROBABET.md)**: Arquitetura, modelagem de banco de dados, dicionário de dados, protocolo WebSocket detalhado e tabela de rastreabilidade.
* 🎤 **[Roteiro de Arguição e Apresentação](docs/apresentacao/ROTEIRO_ARGUICAO_PROFESSOR.md)**: Roteiro passo a passo da demonstração ao vivo, divisão de falas de Arthur e João Lucas e respostas técnicas para perguntas do professor Novak.
