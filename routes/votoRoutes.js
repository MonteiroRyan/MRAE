const express = require('express');
const router = express.Router();
const votoController = require('../controllers/votoController');
const { verificarAutenticacao } = require('../middleware/authMiddleware');

// Rota para registrar voto
router.post('/', verificarAutenticacao, votoController.registrarVoto);

// Rota para verificar se usuário já votou
router.get('/verificar/:cpf', verificarAutenticacao, votoController.verificarVoto);

// Rota para obter resultados
router.get('/resultados', votoController.obterResultados);

// Rota para obter resultados em tempo real (Server-Sent Events)
router.get('/resultados/stream', votoController.streamResultados);

module.exports = router;