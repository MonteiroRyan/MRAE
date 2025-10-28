const { validarCPF } = require('../utils/validarCPF');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Obter pool do global ou importar
const getPool = () => {
  if (global.pool) return global.pool;
  const { pool } = require('../server');
  return pool;
};

const authController = {
  async login(req, res) {
    const pool = getPool();
    
    try {
      const { cpf, senha } = req.body;

      // Validar entrada
      if (!cpf) {
        return res.status(400).json({ 
          success: false, 
          message: 'CPF é obrigatório' 
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

      // Verificar senha (APENAS PARA ADMIN)
      if (usuario.tipo === 'ADMIN') {
        if (!senha) {
          return res.status(400).json({ 
            success: false, 
            message: 'Senha é obrigatória para administradores' 
          });
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) {
          return res.status(401).json({ 
            success: false, 
            message: 'Senha incorreta' 
          });
        }
      }
      // Prefeitos e Representantes não precisam de senha

      // Criar sessão no banco de dados
      const sessionId = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await pool.query(
        'INSERT INTO sessoes (session_id, usuario_id, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)',
        [sessionId, usuario.id, ipAddress, userAgent, expiresAt]
      );

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
    const pool = getPool();
    
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Sessão não fornecida' 
        });
      }

      // Buscar sessão no banco de dados
      const [sessoes] = await pool.query(
        `SELECT s.*, u.id, u.cpf, u.nome, u.tipo, u.municipio_id, 
                m.nome as municipio_nome, m.peso
         FROM sessoes s
         INNER JOIN usuarios u ON s.usuario_id = u.id
         LEFT JOIN municipios m ON u.municipio_id = m.id
         WHERE s.session_id = ? AND s.expires_at > NOW() AND u.ativo = 1`,
        [sessionId]
      );

      if (sessoes.length === 0) {
        return res.status(401).json({ 
          success: false, 
          message: 'Sessão inválida ou expirada' 
        });
      }

      const sessao = sessoes[0];

      return res.json({ 
        success: true, 
        usuario: {
          id: sessao.id,
          cpf: sessao.cpf,
          nome: sessao.nome,
          tipo: sessao.tipo,
          municipio_id: sessao.municipio_id,
          municipio_nome: sessao.municipio_nome,
          peso: sessao.peso
        }
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
    const pool = getPool();
    
    try {
      const { sessionId } = req.body;
      
      if (sessionId) {
        // Remover sessão do banco de dados
        await pool.query('DELETE FROM sessoes WHERE session_id = ?', [sessionId]);
      }
      
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

  // Limpar sessões expiradas (executar periodicamente)
  async limparSessoesExpiradas() {
    const pool = getPool();
    
    try {
      await pool.query('DELETE FROM sessoes WHERE expires_at < NOW()');
      console.log('🧹 Sessões expiradas limpas');
    } catch (error) {
      console.error('Erro ao limpar sessões:', error);
    }
  }
};

module.exports = authController;