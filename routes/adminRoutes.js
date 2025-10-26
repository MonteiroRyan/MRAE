const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verificarAdmin } = require('../middleware/authMiddleware');

// Rotas CRUD de usuários (protegidas por autenticação admin)
router.post('/usuarios', verificarAdmin, adminController.criarUsuario);
router.get('/usuarios', verificarAdmin, adminController.listarUsuarios);
router.put('/usuarios/:id', verificarAdmin, adminController.atualizarUsuario);
router.delete('/usuarios/:id', verificarAdmin, adminController.deletarUsuario);

// Rotas CRUD de municípios
router.post('/municipios', verificarAdmin, adminController.criarMunicipio);
router.get('/municipios', adminController.listarMunicipios);
router.put('/municipios/:id', verificarAdmin, adminController.atualizarMunicipio);
router.delete('/municipios/:id', verificarAdmin, adminController.deletarMunicipio);

module.exports = router;