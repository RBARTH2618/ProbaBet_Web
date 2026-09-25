# ProbaBet_Web — Plataforma de Apostas em Tempo Real (WebSocket)

Projeto desenvolvido para a disciplina de **Desenvolvimento de Software para Web** (6º Período).  
**Professor:** Me. Sergio Souza Novak  
**Integrantes:** Arthur Borges Rodrigues e João Lucas Tavares Silva

---

## 🎯 Objetivo
Construir um ecossistema de apostas esportivas ao vivo com comunicação bidirecional em tempo real via **WebSocket**, garantindo baixa latência (< 100ms), recálculo contínuo de odds e Cash Out dinâmico, além de mecanismos de concorrência contra Race Conditions e integridade de saldo.

---

## 🛠️ Tecnologias Utilizadas
- **Backend:** Node.js, WebSocket (`ws`), Express (para servir estáticos do frontend e endpoints auxiliares)
- **Banco de Dados:** PostgreSQL (`pg`)
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla ES6+)
- **Controle de Versão:** Git & GitHub

---

## 📂 Estrutura do Projeto
```text
BETs/
├── backend/            # Servidor Node.js, WebSocket e regras de negócio
│   └── src/
│       ├── database/   # Conexão e pool com PostgreSQL
│       ├── models/     # Modelos e mapeamento das entidades
│       ├── services/   # Motores de simulação, odds, apostas, cash out
│       ├── websocket/  # Handlers de conexão e eventos WS
│       └── utils/      # Funções utilitárias e travas de concorrência
├── frontend/           # Interfaces web (Lobby, Bet Slip, Carteira)
│   ├── css/            # Estilos visuais
│   └── js/             # Lógica cliente WebSocket e DOM
├── database/           # Scripts SQL (criação de tabelas, constraints e seeds)
├── docs/               # Documentação, diagramas e relatório da apresentação
├── .env.example        # Exemplo de configuração das variáveis de ambiente
└── .gitignore          # Arquivos ignorados pelo Git
```

---

## 🚀 Como Executar o Projeto (Em breve)
Instruções detalhadas serão adicionadas conforme o avanço das etapas.
