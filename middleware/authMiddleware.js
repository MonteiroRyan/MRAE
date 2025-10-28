const getPool = () => {
  if (global.pool) return global.pool;
  const { pool } = require('../server');
  return pool;
};

const verificarAutenticacao = async (req, res, next) => {
  const pool = getPool();
  const sessionId = req.headers['x-session-id'];

  if (!sessionId) {
    return res.status(401).json({ 
      success: false, 
      message: 'Sessão não fornecida' 
    });
  }

  try {
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

    req.usuario = {
      id: sessao.id,
      cpf: sessao.cpf,
      nome: sessao.nome,
      tipo: sessao.tipo,
      municipio_id: sessao.municipio_id,
      municipio_nome: sessao.municipio_nome,
      peso: sessao.peso
    };

    next();
  } catch (error) {
    console.error('Erro ao verificar autenticação:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao verificar autenticação' 
    });
  }
};

const verificarAdmin = async (req, res, next) => {
  await verificarAutenticacao(req, res, () => {
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