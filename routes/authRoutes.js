const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Rota de login
router.post('/login', authController.login);

// Rota para verificar sessão
router.post('/verify', authController.verifySession);

// Rota de logout
router.post('/logout', authController.logout);

module.exports = router;