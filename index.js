const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();

app.use(express.json());

// CONFIGURAÇÃO DO BANCO DE DADOS
const poolConexao = new Pool({
    user: 'seu_usuario',
    host: 'seu_host_postgresql',
    database: 'seu_banco_de_dados',
    password: 'sua_senha',
    port: 5432,
    ssl: { rejectUnauthorized: false } // Crucial para serviços em nuvem (Render, Supabase, ElephantSQL)
});

// Banco de dados de requisições do jogo
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

// Fornecer o bloco de perguntas atual
app.get('/api/perguntas/:bloco', (req, res) => {
    const bloco = req.params.bloco;
    if (todasPerguntas[bloco]) {
        res.json(todasPerguntas[bloco]);
    } else {
        res.json(todasPerguntas.blocoA);
    }
});

// Entrega a página do jogo que está na mesma pasta
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'jogo.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
