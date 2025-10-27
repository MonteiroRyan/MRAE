const { validarCPF } = require('../utils/validarCPF');
const bcrypt = require('bcryptjs');

// Obter pool do global ou importar
const getPool = () => {
  if (global.pool) return global.pool;
  const { pool } = require('../server');
  return pool;
};

// Sessões ativas (em produção, use Redis ou similar)
const sessoes = new Map();

const authController = {
  async login(req, res) {
    const pool = getPool();
    
    try {
      const { cpf, senha } = req.body;

      // Validar entrada
      if (!cpf || !senha) {
        return res.status(400).json({ 
          success: false, 
          message: 'CPF e senha são obrigatórios' 
        });
      }

      // Limpar CPF
      const cpfLimpo = cpf.replace(/\D/g, '');

      // Validar CPF
      if (!validarCPF(cpfLimpo)) {
        return res.status(400).json({ 
          success: false, 
          message: 'CPF inválido' 
        });
      }

      // Buscar usuário no banco
      const [usuarios] = await pool.query(
        `SELECT u.*, m.nome as municipio_nome, m.peso 
         FROM usuarios u 
         LEFT JOIN municipios m ON u.municipio_id = m.id 
         WHERE u.cpf = ? AND u.ativo = 1`,
        [cpfLimpo]
      );

      if (usuarios.length === 0) {
        return res.status(401).json({ 
          success: false, 
          message: 'CPF não cadastrado ou usuário inativo' 
        });
      }

      const usuario = usuarios[0];

      // Verificar senha
      const senhaValida = await bcrypt.compare(senha, usuario.senha);
      if (!senhaValida) {
        return res.status(401).json({ 
          success: false, 
          message: 'Senha incorreta' 
        });
      }

      // Criar sessão
      const sessionId = require('crypto').randomBytes(32).toString('hex');
      sessoes.set(sessionId, {
        id: usuario.id,
        cpf: usuario.cpf,
        nome: usuario.nome,
        tipo: usuario.tipo,
        municipio_id: usuario.municipio_id,
        municipio_nome: usuario.municipio_nome,
        peso: usuario.peso
      });

      return res.json({
        success: true,
        sessionId,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          cpf: usuario.cpf,
          tipo: usuario.tipo,
          municipio: usuario.municipio_nome,
          peso: usuario.peso
        }
      });

    } catch (error) {
      console.error('Erro no login:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao realizar login: ' + error.message 
      });
    }
  },

  async verifySession(req, res) {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Sessão não fornecida' 
        });
      }

      if (!sessoes.has(sessionId)) {
        return res.status(401).json({ 
          success: false, 
          message: 'Sessão inválida' 
        });
      }

      const usuario = sessoes.get(sessionId);
      return res.json({ 
        success: true, 
        usuario 
      });

    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao verificar sessão' 
      });
    }
  },

  async logout(req, res) {
    try {
      const { sessionId } = req.body;
      sessoes.delete(sessionId);
      
      return res.json({ 
        success: true, 
        message: 'Logout realizado com sucesso' 
      });

    } catch (error) {
      console.error('Erro no logout:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao realizar logout' 
      });
    }
  },

  // Função auxiliar para obter sessão
  getSessao(sessionId) {
    return sessoes.get(sessionId);
  }
};

module.exports = authController;