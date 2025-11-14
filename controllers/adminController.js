const { validarCPF } = require('../utils/validarCPF');
const bcrypt = require('bcryptjs');

const getPool = () => {
  if (global.pool) return global.pool;
  const { pool } = require('../server');
  return pool;
};

const adminController = {
  // CRUD de Usuários
  async criarUsuario(req, res) {
    const pool = getPool();
    
    try {
      const { cpf, nome, senha, tipo, municipio_id } = req.body;

      const cpfLimpo = cpf.replace(/\D/g, '');

      if (!validarCPF(cpfLimpo)) {
        return res.status(400).json({ 
          success: false, 
          message: 'CPF inválido' 
        });
      }

      if (!nome || !tipo) {
        return res.status(400).json({ 
          success: false, 
          message: 'Nome e tipo são obrigatórios' 
        });
      }

      if (tipo === 'ADMIN' && !senha) {
        return res.status(400).json({ 
          success: false, 
          message: 'Senha é obrigatória para administradores' 
        });
      }

      if (tipo !== 'ADMIN' && !municipio_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Município é obrigatório para prefeitos e representantes' 
        });
      }

      const [usuariosExistentes] = await pool.query(
        'SELECT id FROM usuarios WHERE cpf = ?',
        [cpfLimpo]
      );

      if (usuariosExistentes.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'CPF já cadastrado' 
        });
      }

      let senhaHash = null;
      if (tipo === 'ADMIN') {
        senhaHash = await bcrypt.hash(senha, 10);
      }

      const [resultado] = await pool.query(
        'INSERT INTO usuarios (cpf, nome, senha, tipo, municipio_id, ativo) VALUES (?, ?, ?, ?, ?, 1)',
        [cpfLimpo, nome, senhaHash, tipo, municipio_id || null]
      );

      return res.json({
        success: true,
        message: tipo === 'ADMIN' 
          ? 'Usuário criado com sucesso' 
          : 'Usuário criado com sucesso. Login apenas com CPF (sem senha).',
        usuario: {
          id: resultado.insertId,
          cpf: cpfLimpo,
          nome,
          tipo
        }
      });

    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao criar usuário: ' + error.message 
      });
    }
  },

  async listarUsuarios(req, res) {
    const pool = getPool();
    
    try {
      const [usuarios] = await pool.query(
        `SELECT u.id, u.cpf, u.nome, u.tipo, u.ativo, 
                m.nome as municipio_nome, m.id as municipio_id, m.peso
         FROM usuarios u 
         LEFT JOIN municipios m ON u.municipio_id = m.id
         ORDER BY u.nome`
      );

      return res.json({
        success: true,
        usuarios
      });

    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao listar usuários: ' + error.message 
      });
    }
  },

  async atualizarUsuario(req, res) {
    const pool = getPool();
    
    try {
      const { id } = req.params;
      const { nome, senha, tipo, municipio_id, ativo } = req.body;

      const [usuariosExistentes] = await pool.query(
        'SELECT id, tipo FROM usuarios WHERE id = ?',
        [id]
      );

      if (usuariosExistentes.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Usuário não encontrado' 
        });
      }

      let query = 'UPDATE usuarios SET ';
      const params = [];
      const updates = [];

      if (nome) {
        updates.push('nome = ?');
        params.push(nome);
      }

      if (senha && (tipo === 'ADMIN' || usuariosExistentes[0].tipo === 'ADMIN')) {
        const senhaHash = await bcrypt.hash(senha, 10);
        updates.push('senha = ?');
        params.push(senhaHash);
      }

      if (tipo) {
        updates.push('tipo = ?');
        params.push(tipo);
        
        if (tipo !== 'ADMIN') {
          updates.push('senha = NULL');
        }
      }

      if (municipio_id !== undefined) {
        updates.push('municipio_id = ?');
        params.push(municipio_id || null);
      }

      if (ativo !== undefined) {
        updates.push('ativo = ?');
        params.push(ativo ? 1 : 0);
      }

      if (updates.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Nenhum campo para atualizar' 
        });
      }

      query += updates.join(', ') + ' WHERE id = ?';
      params.push(id);

      await pool.query(query, params);

      return res.json({
        success: true,
        message: 'Usuário atualizado com sucesso'
      });

    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao atualizar usuário: ' + error.message 
      });
    }
  },

  // MUDANÇA: Permitir deletar mesmo se votou
  async deletarUsuario(req, res) {
    const pool = getPool();
    
    try {
      const { id } = req.params;

      // Verificar se usuário existe
      const [usuarios] = await pool.query(
        'SELECT nome FROM usuarios WHERE id = ?',
        [id]
      );

      if (usuarios.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Usuário não encontrado' 
        });
      }

      // Verificar se votou
      const [votos] = await pool.query(
        'SELECT COUNT(*) as total FROM votos WHERE usuario_id = ?',
        [id]
      );

      const jaVotou = votos[0].total > 0;

      // Deletar usuário (CASCADE vai deletar votos associados)
      await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);

      return res.json({
        success: true,
        message: jaVotou 
          ? `Usuário "${usuarios[0].nome}" deletado com sucesso. Seus ${votos[0].total} voto(s) também foram removidos.`
          : `Usuário "${usuarios[0].nome}" deletado com sucesso.`,
        votosRemovidos: votos[0].total
      });

    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao deletar usuário: ' + error.message 
      });
    }
  },

  // CRUD de Municípios (mantém o mesmo)
  async criarMunicipio(req, res) {
    const pool = getPool();
    
    try {
      const { nome, peso } = req.body;

      if (!nome || !peso) {
        return res.status(400).json({ 
          success: false, 
          message: 'Nome e peso são obrigatórios' 
        });
      }

      const [resultado] = await pool.query(
        'INSERT INTO municipios (nome, peso) VALUES (?, ?)',
        [nome, peso]
      );

      return res.json({
        success: true,
        message: 'Município criado com sucesso',
        municipio: {
          id: resultado.insertId,
          nome,
          peso
        }
      });

    } catch (error) {
      console.error('Erro ao criar município:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao criar município: ' + error.message 
      });
    }
  },

  async listarMunicipios(req, res) {
    const pool = getPool();
    
    try {
      const [municipios] = await pool.query(
        'SELECT * FROM municipios ORDER BY nome'
      );

      return res.json({
        success: true,
        municipios
      });

    } catch (error) {
      console.error('Erro ao listar municípios:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao listar municípios: ' + error.message 
      });
    }
  },

  async atualizarMunicipio(req, res) {
    const pool = getPool();
    
    try {
      const { id } = req.params;
      const { nome, peso } = req.body;

      const updates = [];
      const params = [];

      if (nome) {
        updates.push('nome = ?');
        params.push(nome);
      }

      if (peso !== undefined) {
        updates.push('peso = ?');
        params.push(peso);
      }

      if (updates.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Nenhum campo para atualizar' 
        });
      }

      params.push(id);
      await pool.query(
        `UPDATE municipios SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      return res.json({
        success: true,
        message: 'Município atualizado com sucesso'
      });

    } catch (error) {
      console.error('Erro ao atualizar município:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao atualizar município: ' + error.message 
      });
    }
  },

  async deletarMunicipio(req, res) {
    const pool = getPool();
    
    try {
      const { id } = req.params;

      const [usuarios] = await pool.query(
        'SELECT id FROM usuarios WHERE municipio_id = ?',
        [id]
      );

      if (usuarios.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Não é possível deletar município com usuários vinculados' 
        });
      }

      await pool.query('DELETE FROM municipios WHERE id = ?', [id]);

      return res.json({
        success: true,
        message: 'Município deletado com sucesso'
      });

    } catch (error) {
      console.error('Erro ao deletar município:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao deletar município: ' + error.message 
      });
    }
  }
};

module.exports = adminController;