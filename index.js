const express = require('express');
const { Pool } = require('pg');
const app = express();

app.use(express.json());

// CONFIGURAÇÃO DO BANCO DE DADOS (Substitua pelos dados da sua hospedagem)
const poolConexao = new Pool({
    user: 'seu_usuario',
    host: 'seu_host_postgresql',
    database: 'seu_banco_de_dados',
    password: 'sua_senha',
    port: 5432,
    ssl: { rejectUnauthorized: false } // Geralmente necessário para serviços em nuvem (Render, Supabase, ElephantSQL)
});

// Banco de dados de requisições do jogo (Dividido em blocos para renovação)
const todasPerguntas = {
    blocoA: [
        { method: 'GET', route: '/items', action: 'LIST' },
        { method: 'POST', route: '/create', action: 'SAVE' },
        { method: 'PUT', route: '/update', action: 'UPDATE' },
        { method: 'GET', route: '/historico-antigo', action: '404' },
        { method: 'POST', route: '/deletar-banco', action: '404' }
    ],
    blocoB: [
        { method: 'GET', route: '/usuarios', action: 'LIST' },
        { method: 'POST', route: '/usuarios/novo', action: 'SAVE' },
        { method: 'PUT', route: '/usuarios/editar', action: 'UPDATE' },
        { method: 'POST', route: '/login-antigo', action: '404' },
        { method: 'GET', route: '/arquivo-morto', action: '404' }
    ]
};

// ROTAS DA API DO RANKING (Conversam com o PostgreSQL)

// Buscar o TOP 5 do ranking
app.get('/api/ranking', async (req, res) => {
    try {
        const resultado = await poolConexao.query('SELECT nome, pontos FROM ranking ORDER BY pontos DESC, criado_em ASC LIMIT 5');
        res.status(200).json(resultado.rows);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar ranking no banco de dados' });
    }
});

// Salvar uma nova pontuação
app.post('/api/ranking', async (req, res) => {
    const { nome, pontos } = req.body;
    try {
        await poolConexao.query('INSERT INTO ranking (nome, pontos) VALUES ($1, $2)', [nome, pontos]);
        res.status(201).json({ mensagem: 'Pontuação salva com sucesso!' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao salvar pontuação no banco de dados' });
    }
});

// Rota para fornecer o pool de perguntas baseado no bloco atual do jogador
app.get('/api/perguntas/:bloco', (req, res) => {
    const bloco = req.params.bloco;
    if (todasPerguntas[bloco]) {
        res.json(todasPerguntas[bloco]);
    } else {
        res.json(todasPerguntas.blocoA); // Fallback padrão
    }
});

// ROTA PRINCIPAL: Serve a interface visual do jogo
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Express JS: Route Rush Multiplayer</title>
    <style>
        :root {
            --bg-gradient: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            --panel-bg: rgba(255, 255, 255, 0.95);
            --express-color: #3182ce;
        }
        body {
            font-family: 'Segoe UI', sans-serif;
            background: var(--bg-gradient);
            margin: 0; padding: 20px;
            min-height: 100vh;
            display: flex; justify-content: center; align-items: center;
            color: #2d3748;
        }
        .game-container {
            width: 950px;
            background: var(--panel-bg);
            border-radius: 16px;
            padding: 25px;
            display: flex; flex-direction: column; gap: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; }
        h1 { margin: 0; color: #1a365d; }
        .stats-panel { display: flex; gap: 20px; font-size: 1.2rem; font-weight: bold; }
        .stat-box { background: #edf2f7; padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e0; }
        .board { display: grid; grid-template-columns: 260px 1fr 260px; gap: 20px; height: 320px; }
        .column { background: #f7fafc; border: 2px dashed #cbd5e0; border-radius: 12px; padding: 15px; display: flex; flex-direction: column; gap: 12px; justify-content: center; }
        .column-title { text-align: center; font-weight: bold; color: #4a5568; font-size: 0.9rem; text-transform: uppercase; }
        .center-engine { background: #edf2f7; border: 2px solid var(--express-color); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }
        .server-core { width: 100px; height: 100px; background: var(--express-color); color: white; border-radius: 50%; display: flex; flex-direction: column; justify-content: center; align-items: center; font-weight: bold; }
        .request-card { background: white; border: 3px solid #4a5568; border-radius: 10px; padding: 12px; width: 180px; text-align: center; margin-bottom: 15px; }
        .req-method { font-size: 1.4rem; font-weight: 900; }
        .req-method.GET { color: #3182ce; }
        .req-method.POST { color: #e53e3e; }
        .req-method.PUT { color: #dd6b20; }
        .req-route { font-family: monospace; background: #edf2f7; padding: 4px; border-radius: 4px; }
        .output-btn { background: white; border: 2px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 0.9rem; font-weight: bold; cursor: pointer; transition: all 0.2s; width: 100%; text-align: left; }
        .output-btn:hover { transform: scale(1.02); border-color: var(--express-color); background: #ebf8ff; }
        .timer-bar-container { width: 100%; height: 12px; background: #e2e8f0; border-radius: 6px; overflow: hidden; }
        .timer-bar { height: 100%; background: #48bb78; width: 100%; transition: width 0.05s linear; }
        
        /* POSICIONAMENTO DO RANKING NA PARTE INFERIOR */
        .bottom-ranking-zone {
            border-top: 2px solid #e2e8f0;
            padding-top: 20px;
            margin-top: 10px;
        }
        .ranking-table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; }
        .ranking-table th, .ranking-table td { padding: 10px; border: 1px solid #e2e8f0; text-align: center; }
        .ranking-table th { background: #edf2f7; color: #4a5568; }
        
        .overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(26, 32, 44, 0.95); display: flex; justify-content: center; align-items: center; z-index: 10; }
        .overlay-card { background: white; padding: 35px; border-radius: 16px; text-align: center; max-width: 450px; width: 100%; }
        .btn-main { background: var(--express-color); color: white; border: none; padding: 12px 30px; font-size: 1.1rem; font-weight: bold; border-radius: 8px; cursor: pointer; margin-top: 15px; }
        input[type="text"] { padding: 10px; width: 80%; font-size: 1rem; margin-top: 15px; border: 2px solid #cbd5e0; border-radius: 6px; text-align: center; }
        .hidden { display: none !important; }
    </style>
</head>
<body>

    <div id="start-overlay" class="overlay">
        <div class="overlay-card">
            <h2>Express JS: Route Rush 🚀</h2>
            <p>Seja o Servidor! Responda às requisições combinando rotas e verbos corretos.</p>
            <p><strong>Regra da Rodada:</strong> Acerte o máximo que puder em 15 requisições seguidas. Você tem 5 segundos para cada uma!</p>
            <button class="btn-main" onclick="startGame()">Iniciar Servidor</button>
        </div>
    </div>

    <div id="gameover-overlay" class="overlay hidden">
        <div class="overlay-card">
            <h2>Rodada Finalizada! 🎉</h2>
            <p>Você completou as 15 requisições do bloco.</p>
            <h3>Sua Pontuação: <span id="final-score">0</span></h3>
            <div id="save-score-zone">
                <input type="text" id="player-name" placeholder="Seu nome ou apelido" maxlength="15">
                <br>
                <button class="btn-main" onclick="saveScoreBackend()">Salvar no Ranking Global</button>
            </div>
            <div id="next-round-zone" class="hidden">
                <p style="color: #48bb78; font-weight: bold;">Salvo com sucesso! As perguntas mudaram para o próximo bloco.</p>
                <button class="btn-main" style="background: #48bb78;" onclick="restartGame()">Jogar Próximo Bloco</button>
            </div>
        </div>
    </div>

    <div class="game-container">
        <header>
            <h1>Express.js: Route Rush</h1>
            <div class="stats-panel">
                <div class="stat-box">Progresso: <span id="progress">0</span>/15</div>
                <div class="stat-box">Pontos: <span id="score">0</span></div>
                <div class="stat-box" style="color: #e53e3e;">Vidas: <span id="lives">3</span></div>
            </div>
        </header>

        <div class="timer-bar-container">
            <div id="timer-bar" class="timer-bar"></div>
        </div>

        <div class="board">
            <div class="column">
                <div class="column-title">Guia de Rotas da API</div>
                <div id="guia-rotas-texto" style="font-size: 0.8rem; background: white; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; line-height: 1.4;">
                    </div>
            </div>

            <div class="center-engine">
                <div id="request-box" class="request-card">
                    <div id="req-method" class="req-method">GET</div>
                    <div id="req-route" class="req-route">/items</div>
                </div>
                <div class="server-core"><span>EXPRESS</span><span style="font-size: 0.6rem; font-weight: normal;">SERVER</span></div>
            </div>

            <div class="column">
                <div class="column-title">Ações do Sistema</div>
                <button class="output-btn" onclick="processAction('LIST')">🟢 LISTAR DADOS (GET)</button>
                <button class="output-btn" onclick="processAction('SAVE')">🔵 SALVAR DADOS (POST)</button>
                <button class="output-btn" onclick="processAction('UPDATE')">🟠 ATUALIZAR DADOS (PUT)</button>
                <button class="output-btn" onclick="processAction('404')">⚪ ENVIAR ERRO 404</button>
            </div>
        </div>

        <div class="bottom-ranking-zone">
            <h3 style="margin: 0 0 10px 0; color: #1a365d;">🏆 TOP 5 RANKING DA TURMA (Simultâneo)</h3>
            <table class="ranking-table">
                <thead>
                    <tr><th>Posição</th><th>Desenvolvedor(a)</th><th>Pontuação</th></tr>
                </thead>
                <tbody id="ranking-body">
                    <tr><td colspan="3">Carregando posições em tempo real...</td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <script>
        let poolPerguntas = [];
        let score = 0;
        let lives = 3;
        let currentRequest = {};
        let timerInterval = null;
        let totalRespondidas = 0;
        let blocoAtual = 'blocoA'; // Alterna entre blocoA e blocoB para renovar perguntas
        
        const TOTAL_TIME = 5000;
        let timeRemaining = TOTAL_TIME;

        // Atualizar ranking vindo do PostgreSQL automaticamente ao carregar a página
        async function fetchRankingBackend() {
            try {
                const res = await fetch('/api/ranking');
                const dados = await res.json();
                const tbody = document.getElementById('ranking-body');
                tbody.innerHTML = "";
                
                if(dados.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="3">Nenhum recorde registrado. Seja o primeiro!</td></tr>';
                    return;
                }
                dados.forEach((player, idx) => {
                    tbody.innerHTML += '<tr><td><strong>' + (idx+1) + 'º</strong></td><td>' + player.name + '</td><td>' + player.pontos + ' pts</td></tr>';
                });
            } catch(e) { console.log("Erro ao atualizar ranking remoto."); }
        }

        async function carregarBlocoPerguntas() {
            const res = await fetch('/api/perguntas/' + blocoAtual);
            poolPerguntas = await res.json();
            
            // Atualiza dinamicamente o texto do card de ajuda na esquerda com base nas novas perguntas
            const rotaListar = poolPerguntas.find(p => p.action === 'LIST').route;
            const rotaSalvar = poolPerguntas.find(p => p.action === 'SAVE').route;
            const rotaUpdate = poolPerguntas.find(p => p.action === 'UPDATE').route;
            
            document.getElementById('guia-rotas-texto').innerHTML = 
                '• <strong>GET ' + rotaListar + '</strong> → Listar<br><br>' +
                '• <strong>POST ' + rotaSalvar + '</strong> → Salvar<br><br>' +
                '• <strong>PUT ' + rotaUpdate + '</strong> → Atualizar<br><br>' +
                '• <strong>Outras rotas</strong> → Erro 404';
        }

        async function startGame() {
            document.getElementById('start-overlay').classList.add('hidden');
            score = 0; lives = 3; totalRespondidas = 0;
            await carregarBlocoPerguntas();
            updateDOMStats();
            nextRequest();
        }

        function nextRequest() {
            clearInterval(timerInterval);
            
            if (totalRespondidas >= 15 || lives <= 0) {
                gameOver();
                return;
            }

            const randomIndex = Math.floor(Math.random() * poolPerguntas.length);
            currentRequest = poolPerguntas[randomIndex];

            const methodEl = document.getElementById('req-method');
            methodEl.innerText = currentRequest.method;
            methodEl.className = 'req-method ' + currentRequest.method;
            document.getElementById('req-route').innerText = currentRequest.route;

            timeRemaining = TOTAL_TIME;
            document.getElementById('timer-bar').style.width = '100%';
            
            timerInterval = setInterval(() => {
                timeRemaining -= 50;
                document.getElementById('timer-bar').style.width = (timeRemaining / TOTAL_TIME) * 100 + '%';
                if (timeRemaining <= 0) {
                    clearInterval(timerInterval);
                    failChoice();
                }
            }, 50);
        }

        function processAction(chosenAction) {
            totalRespondidas++;
            if (chosenAction === currentRequest.action) {
                score += 100;
                updateDOMStats();
                nextRequest();
            } else {
                failChoice();
            }
        }

        function failChoice() {
            lives--;
            updateDOMStats();
            if (lives <= 0) { gameOver(); } else { nextRequest(); }
        }

        function updateDOMStats() {
            document.getElementById('score').innerText = score;
            document.getElementById('lives').innerText = lives;
            document.getElementById('progress').innerText = totalRespondidas;
        }

        function gameOver() {
            clearInterval(timerInterval);
            document.getElementById('gameover-overlay').classList.remove('hidden');
            document.getElementById('final-score').innerText = score;
            document.getElementById('save-score-zone').classList.remove('hidden');
            document.getElementById('next-round-zone').classList.add('hidden');
        }

        async function saveScoreBackend() {
            const nome = document.getElementById('player-name').value.trim() || "Dev_Anonimo";
            
            // Envia via POST em tempo real para a nossa API salvar no Postgres
            await fetch('/api/ranking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: nome, pontos: score })
            });

            // Altera o bloco de perguntas para a próxima partida
            blocoAtual = (blocoAtual === 'blocoA') ? 'blocoB' : 'blocoA';

            document.getElementById('save-score-zone').classList.add('hidden');
            document.getElementById('next-round-zone').classList.remove('hidden');
            fetchRankingBackend(); // Atualiza a lista inferior instantaneamente para todos
        }

        function restartGame() {
            document.getElementById('gameover-overlay').classList.add('hidden');
            startGame();
        }

        // Busca o ranking inicial ao carregar
        fetchRankingBackend();
    </script>
</body>
</html>
    `);
});

// Inicializando o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando e pronto para receber a turma na porta ${PORT}`);
});