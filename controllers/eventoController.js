const getPool = () => {
 if (global.pool) return global.pool;
 const { pool } = require('../server');
 return pool;
};

const eventoController = {
 // Criar evento
 async criarEvento(req, res) {
   const pool = getPool();
   
   try {
     const { titulo, descricao, data_inicio, data_fim, quorum_minimo, participantes } = req.body;
     const usuario = req.usuario;

     if (!titulo || !data_inicio || !data_fim) {
       return res.status(400).json({ 
         success: false, 
         message: 'Título, data de início e fim são obrigatórios' 
       });
     }

     // Validar datas
     if (new Date(data_inicio) >= new Date(data_fim)) {
       return res.status(400).json({ 
         success: false, 
         message: 'Data de fim deve ser posterior à data de início' 
       });
     }

     // Criar evento
     const [resultado] = await pool.query(
       `INSERT INTO eventos_votacao 
        (titulo, descricao, data_inicio, data_fim, quorum_minimo, status, criado_por) 
        VALUES (?, ?, ?, ?, ?, 'RASCUNHO', ?)`,
       [titulo, descricao, data_inicio, data_fim, quorum_minimo || 10, usuario.id]
     );

     const eventoId = resultado.insertId;

     // Adicionar participantes se fornecidos
     if (participantes && Array.isArray(participantes) && participantes.length > 0) {
       const values = participantes.map(userId => [eventoId, userId]);
       await pool.query(
         'INSERT INTO evento_participantes (evento_id, usuario_id) VALUES ?',
         [values]
       );
     }

     return res.json({
       success: true,
       message: 'Evento criado com sucesso',
       evento: {
         id: eventoId,
         titulo,
         status: 'RASCUNHO'
       }
     });

   } catch (error) {
     console.error('Erro ao criar evento:', error);
     return res.status(500).json({ 
       success: false, 
       message: 'Erro ao criar evento: ' + error.message 
     });
   }
 },

 // Listar eventos
 async listarEventos(req, res) {
   const pool = getPool();
   
   try {
     const [eventos] = await pool.query(`
       SELECT e.*, u.nome as criador_nome,
              (SELECT COUNT(*) FROM evento_participantes WHERE evento_id = e.id) as total_participantes,
              (SELECT COUNT(*) FROM evento_participantes WHERE evento_id = e.id AND presente = 1) as total_presentes,
              (SELECT COUNT(*) FROM votos WHERE evento_id = e.id) as total_votos
       FROM eventos_votacao e
       INNER JOIN usuarios u ON e.criado_por = u.id
       ORDER BY e.created_at DESC
     `);

     return res.json({
       success: true,
       eventos
     });

   } catch (error) {
     console.error('Erro ao listar eventos:', error);
     return res.status(500).json({ 
       success: false, 
       message: 'Erro ao listar eventos' 
     });
   }
 },

 // Obter detalhes do evento
 async obterEvento(req, res) {
   const pool = getPool();
   
   try {
     const { id } = req.params;

     const [eventos] = await pool.query(`
       SELECT e.*, u.nome as criador_nome
       FROM eventos_votacao e
       INNER JOIN usuarios u ON e.criado_por = u.id
       WHERE e.id = ?
     `, [id]);

     if (eventos.length === 0) {
       return res.status(404).json({ 
         success: false, 
         message: 'Evento não encontrado' 
       });
     }

     // Buscar participantes
     const [participantes] = await pool.query(`
       SELECT ep.*, u.nome, u.cpf, u.tipo, m.nome as municipio_nome
       FROM evento_participantes ep
       INNER JOIN usuarios u ON ep.usuario_id = u.id
       LEFT JOIN municipios m ON u.municipio_id = m.id
       WHERE ep.evento_id = ?
       ORDER BY ep.presente DESC, u.nome
     `, [id]);

     return res.json({
       success: true,
       evento: {
         ...eventos[0],
         participantes
       }
     });

   } catch (error) {
     console.error('Erro ao obter evento:', error);
     return res.status(500).json({ 
       success: false, 
       message: 'Erro ao obter evento' 
     });
   }
 },

 // Adicionar participantes ao evento
 async adicionarParticipantes(req, res) {
   const pool = getPool();
   
   try {
     const { id } = req.params;
     const { participantes } = req.body;

     if (!participantes || !Array.isArray(participantes) || participantes.length === 0) {
       return res.status(400).json({ 
         success: false, 
         message: 'Lista de participantes inválida' 
       });
     }

     // Verificar se evento existe
     const [eventos] = await pool.query('SELECT id FROM eventos_votacao WHERE id = ?', [id]);
     if (eventos.length === 0) {
       return res.status(404).json({ 
         success: false, 
         message: 'Evento não encontrado' 
       });
     }

     // Adicionar participantes
     const values = participantes.map(userId => [id, userId]);
     await pool.query(
       'INSERT IGNORE INTO evento_participantes (evento_id, usuario_id) VALUES ?',
       [values]
     );

     return res.json({
       success: true,
       message: 'Participantes adicionados com sucesso'
     });

   } catch (error) {
     console.error('Erro ao adicionar participantes:', error);
     return res.status(500).json({ 
       success: false, 
       message: 'Erro ao adicionar participantes' 
     });
   }
 },

 // Marcar presença
 async marcarPresenca(req, res) {
   const pool = getPool();
   
   try {
     const { id } = req.params;
     const usuario = req.usuario;

     // Marcar presença
     const [resultado] = await pool.query(
       `UPDATE evento_participantes 
        SET presente = 1, data_presenca = NOW() 
        WHERE evento_id = ? AND usuario_id = ?`,
       [id, usuario.id]
     );

     if (resultado.affectedRows === 0) {
       return res.status(404).json({ 
         success: false, 
         message: 'Você não está cadastrado neste evento' 
       });
     }

     // Verificar quórum
     const [evento] = await pool.query(
       'SELECT quorum_minimo, status FROM eventos_votacao WHERE id = ?',
       [id]
     );

     const [presentes] = await pool.query(
       'SELECT COUNT(*) as total FROM evento_participantes WHERE evento_id = ? AND presente = 1',
       [id]
     );

     const totalPresentes = presentes[0].total;
     const quorumMinimo = evento[0].quorum_minimo;

     // Atualizar status do evento se quórum atingido
     if (totalPresentes >= quorumMinimo && evento[0].status === 'AGUARDANDO_QUORUM') {
       await pool.query(
         "UPDATE eventos_votacao SET status = 'ATIVO' WHERE id = ?",
         [id]
       );
     }

     return res.json({
       success: true,
       message: 'Presença confirmada',
       totalPresentes,
       quorumMinimo,
       quorumAtingido: totalPresentes >= quorumMinimo
     });

   } catch (error) {
     console.error('Erro ao marcar presença:', error);
     return res.status(500).json({ 
       success: false, 
       message: 'Erro ao marcar presença' 
     });
   }
 },

 // Iniciar evento (mudar para aguardando quórum)
 async iniciarEvento(req, res) {
   const pool = getPool();
   
   try {
     const { id } = req.params;

     await pool.query(
       "UPDATE eventos_votacao SET status = 'AGUARDANDO_QUORUM' WHERE id = ? AND status = 'RASCUNHO'",
       [id]
     );

     return res.json({
       success: true,
       message: 'Evento iniciado. Aguardando quórum mínimo.'
     });

   } catch (error) {
     console.error('Erro ao iniciar evento:', error);
     return res.status(500).json({ 
       success: false, 
       message: 'Erro ao iniciar evento' 
     });
   }
 },

 // Encerrar evento
 async encerrarEvento(req, res) {
   const pool = getPool();
   
   try {
     const { id } = req.params;

     await pool.query(
       "UPDATE eventos_votacao SET status = 'ENCERRADO' WHERE id = ?",
       [id]
     );

     return res.json({
       success: true,
       message: 'Evento encerrado com sucesso'
     });

   } catch (error) {
     console.error('Erro ao encerrar evento:', error);
     return res.status(500).json({ 
       success: false, 
       message: 'Erro ao encerrar evento' 
     });
   }
 },

 // Deletar evento
 async deletarEvento(req, res) {
   const pool = getPool();
   
   try {
     const { id } = req.params;

     // Verificar se há votos
     const [votos] = await pool.query(
       'SELECT COUNT(*) as total FROM votos WHERE evento_id = ?',
       [id]
     );

     if (votos[0].total > 0) {
       return res.status(400).json({ 
         success: false, 
         message: 'Não é possível deletar evento com votos registrados' 
       });
     }

     await pool.query('DELETE FROM eventos_votacao WHERE id = ?', [id]);

     return res.json({
       success: true,
       message: 'Evento deletado com sucesso'
     });

   } catch (error) {
     console.error('Erro ao deletar evento:', error);
     return res.status(500).json({ 
       success: false, 
       message: 'Erro ao deletar evento' 
     });
   }
 }
};

module.exports = eventoController;