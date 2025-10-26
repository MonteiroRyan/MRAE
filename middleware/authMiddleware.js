const authController = require('../controllers/authController');

const verificarAutenticacao = (req, res, next) => {
  const sessionId = req.headers['x-session-id'];

  if (!sessionId) {
    return res.status(401).json({ 
      success: false, 
      message: 'Sessão não fornecida' 
    });
  }

  const usuario = authController.getSessao(sessionId);

  if (!usuario) {
    return res.status(401).json({ 
      success: false, 
      message: 'Sessão inválida ou expirada' 
    });
  }

  req.usuario = usuario;
  next();
};

const verificarAdmin = (req, res, next) => {
  verificarAutenticacao(req, res, () => {
    if (req.usuario.tipo !== 'ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado. Apenas administradores' 
      });
    }
    next();
  });
};

module.exports = {
  verificarAutenticacao,
  verificarAdmin
};