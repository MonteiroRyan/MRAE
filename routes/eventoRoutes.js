const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const { verificarAutenticacao, verificarAdmin } = require('../middleware/authMiddleware');

// Rotas protegidas por admin
router.post('/', verificarAdmin, eventoController.criarEvento);
router.post('/:id/iniciar', verificarAdmin, eventoController.iniciarEvento);
router.post('/:id/liberar', verificarAdmin, eventoController.liberarVotacao); // NOVA ROTA
router.post('/:id/encerrar', verificarAdmin, eventoController.encerrarEvento);
router.post('/:id/participantes', verificarAdmin, eventoController.adicionarParticipantes);
router.delete('/:id', verificarAdmin, eventoController.deletarEvento);
router.get('/:id/exportar-csv', verificarAdmin, eventoController.exportarCSV);

// Rotas protegidas por autenticação
router.get('/', verificarAutenticacao, eventoController.listarEventos);
router.get('/:id', verificarAutenticacao, eventoController.obterEvento);
router.post('/:id/presenca', verificarAutenticacao, eventoController.marcarPresenca);

module.exports = router;