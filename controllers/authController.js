const { validarCPF } = require('../utils/validarCPF');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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

      if (!cpf) {
        return res.status(400).json({ 
          success: false, 
          message: 'CPF é obrigatório' 
        });
      }

      const cpfLimpo = cpf.replace(/\D/g, '');

      if (!validarCPF(cpfLimpo)) {
        return res.status(400).json({ 
          success: false, 
          message: 'CPF inválido' 
        });
      }

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

      // NOVO: Confirmar presença automaticamente em todos os eventos ativos/aguardando
      let eventosComPresenca = [];
      if (usuario.tipo !== 'ADMIN') {
        const [eventosParticipante] = await pool.query(
          `SELECT ep.evento_id, e.titulo, ep.presente
           FROM evento_participantes ep
           INNER JOIN eventos_votacao e ON ep.evento_id = e.id
           WHERE ep.usuario_id = ? AND e.status IN ('RASCUNHO', 'AGUARDANDO_INICIO', 'ATIVO')`,
          [usuario.id]
        );

        for (const evento of eventosParticipante) {
          if (!evento.presente) {
            // Confirmar presença automaticamente
            await pool.query(
              `UPDATE evento_participantes 
               SET presente = 1, data_presenca = NOW() 
               WHERE evento_id = ? AND usuario_id = ?`,
              [evento.evento_id, usuario.id]
            );
            
            eventosComPresenca.push({
              id: evento.evento_id,
              titulo: evento.titulo,
              presencaConfirmada: true,
              automatica: true
            });
          } else {
            eventosComPresenca.push({
              id: evento.evento_id,
              titulo: evento.titulo,
              presencaConfirmada: true,
              automatica: false
            });
          }
        }
      }

      const sessionId = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
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
          municipio_id: usuario.municipio_id,
          peso: usuario.peso
        },
        eventosComPresenca: eventosComPresenca
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

  async limparSessoesExpiradas() {
    const pool = getPool();
    
    try {
      const [tables] = await pool.query(
        `SELECT COUNT(*) as count FROM information_schema.tables 
         WHERE table_schema = ? AND table_name = 'sessoes'`,
        [process.env.DB_NAME || 'sistema_votacao']
      );

      if (tables[0].count === 0) {
        return;
      }

      const [result] = await pool.query('DELETE FROM sessoes WHERE expires_at < NOW()');
      
      if (result.affectedRows > 0) {
        console.log(`🧹 ${result.affectedRows} sessão(ões) expirada(s) removida(s)`);
      }
    } catch (error) {
      console.error('⚠️  Erro ao limpar sessões:', error.message);
    }
  }
};

module.exports = authController;