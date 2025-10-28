const express = require('express');
const router = express.Router();
const votoController = require('../controllers/votoController');
const { verificarAutenticacao } = require('../middleware/authMiddleware');

// Rota para registrar voto
router.post('/', verificarAutenticacao, votoController.registrarVoto);

// Rota para verificar se usuário já votou em um evento
router.get('/verificar/:evento_id', verificarAutenticacao, votoController.verificarVoto);

// Rota para obter resultados de um evento
router.get('/resultados/:evento_id', votoController.obterResultados);

// Rota para obter resultados em tempo real (Server-Sent Events)
router.get('/resultados/:evento_id/stream', votoController.streamResultados);

module.exports = router;