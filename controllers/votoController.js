const getPool = () => {
  if (global.pool) return global.pool;
  const { pool } = require('../server');
  return pool;
};

const votoController = {
  async registrarVoto(req, res) {
    const pool = getPool();
    
    try {
      const { voto, evento_id } = req.body;
      const usuario = req.usuario;

      // Validar voto
      if (!['SIM', 'NAO', 'ABSTENCAO', 'AUSENTE'].includes(voto)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Opção de voto inválida' 
        });
      }

      if (!evento_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID do evento é obrigatório' 
        });
      }

      // Verificar se evento está ativo
      const [eventos] = await pool.query(
        'SELECT status, quorum_minimo FROM eventos_votacao WHERE id = ?',
        [evento_id]
      );

      if (eventos.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Evento não encontrado' 
        });
      }

      if (eventos[0].status !== 'ATIVO') {
        return res.status(400).json({ 
          success: false, 
          message: 'Evento não está ativo para votação' 
        });
      }

      // Verificar se usuário é participante
      const [participante] = await pool.query(
        'SELECT presente FROM evento_participantes WHERE evento_id = ? AND usuario_id = ?',
        [evento_id, usuario.id]
      );

      if (participante.length === 0) {
        return res.status(403).json({ 
          success: false, 
          message: 'Você não está cadastrado neste evento' 
        });
      }

      if (!participante[0].presente) {
        return res.status(403).json({ 
          success: false, 
          message: 'Você precisa confirmar presença antes de votar' 
        });
      }

      // Verificar se já votou neste evento
      const [votosExistentes] = await pool.query(
        'SELECT id FROM votos WHERE evento_id = ? AND usuario_id = ?',
        [evento_id, usuario.id]
      );

      if (votosExistentes.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Você já votou neste evento' 
        });
      }

      // Registrar voto
      await pool.query(
        'INSERT INTO votos (evento_id, usuario_id, municipio_id, voto, peso, data_hora) VALUES (?, ?, ?, ?, ?, NOW())',
        [evento_id, usuario.id, usuario.municipio_id, voto, usuario.peso]
      );

      return res.json({
        success: true,
        message: 'Voto registrado com sucesso'
      });

    } catch (error) {
      console.error('Erro ao registrar voto:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao registrar voto: ' + error.message 
      });
    }
  },

  async verificarVoto(req, res) {
    const pool = getPool();
    
    try {
      const { evento_id } = req.params;
      const usuario = req.usuario;

      const [votos] = await pool.query(
        'SELECT id FROM votos WHERE evento_id = ? AND usuario_id = ?',
        [evento_id, usuario.id]
      );

      return res.json({
        success: true,
        jaVotou: votos.length > 0
      });

    } catch (error) {
      console.error('Erro ao verificar voto:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao verificar voto: ' + error.message 
      });
    }
  },

  async obterResultados(req, res) {
    const pool = getPool();
    
    try {
      const { evento_id } = req.params;

      // Obter contagem de votos com peso
      const [resultados] = await pool.query(`
        SELECT 
          voto,
          COUNT(*) as quantidade,
          SUM(peso) as peso_total
        FROM votos
        WHERE evento_id = ?
        GROUP BY voto
      `, [evento_id]);

      // Calcular totais
      let totalVotos = 0;
      let pesoTotal = 0;
      const resultadosMap = {};

      resultados.forEach(r => {
        totalVotos += r.quantidade;
        pesoTotal += parseFloat(r.peso_total);
        resultadosMap[r.voto] = {
          quantidade: r.quantidade,
          peso: parseFloat(r.peso_total)
        };
      });

      // Calcular percentuais
      const percentuais = {};
      ['SIM', 'NAO', 'ABSTENCAO', 'AUSENTE'].forEach(opcao => {
        const dados = resultadosMap[opcao] || { quantidade: 0, peso: 0 };
        percentuais[opcao] = {
          quantidade: dados.quantidade,
          peso: dados.peso,
          percentualQuantidade: totalVotos > 0 ? (dados.quantidade / totalVotos * 100).toFixed(2) : 0,
          percentualPeso: pesoTotal > 0 ? (dados.peso / pesoTotal * 100).toFixed(2) : 0
        };
      });

      // Total de participantes do evento
      const [totalParticipantes] = await pool.query(
        'SELECT COUNT(*) as total FROM evento_participantes WHERE evento_id = ?',
        [evento_id]
      );

      return res.json({
        success: true,
        resultados: percentuais,
        totais: {
          votosRegistrados: totalVotos,
          pesoTotal: pesoTotal,
          participantesEvento: totalParticipantes[0].total,
          percentualParticipacao: totalParticipantes[0].total > 0 
            ? ((totalVotos / totalParticipantes[0].total) * 100).toFixed(2) 
            : 0
        }
      });

    } catch (error) {
      console.error('Erro ao obter resultados:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao obter resultados: ' + error.message 
      });
    }
  },

  // Server-Sent Events para resultados em tempo real
  async streamResultados(req, res) {
    const pool = getPool();
    const { evento_id } = req.params;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const enviarResultados = async () => {
      try {
        const [resultados] = await pool.query(`
          SELECT 
            voto,
            COUNT(*) as quantidade,
            SUM(peso) as peso_total
          FROM votos
          WHERE evento_id = ?
          GROUP BY voto
        `, [evento_id]);

        let totalVotos = 0;
        let pesoTotal = 0;
        const resultadosMap = {};

        resultados.forEach(r => {
          totalVotos += r.quantidade;
          pesoTotal += parseFloat(r.peso_total);
          resultadosMap[r.voto] = {
            quantidade: r.quantidade,
            peso: parseFloat(r.peso_total)
          };
        });

        const percentuais = {};
        ['SIM', 'NAO', 'ABSTENCAO', 'AUSENTE'].forEach(opcao => {
          const dados = resultadosMap[opcao] || { quantidade: 0, peso: 0 };
          percentuais[opcao] = {
            quantidade: dados.quantidade,
            peso: dados.peso,
            percentualQuantidade: totalVotos > 0 ? (dados.quantidade / totalVotos * 100).toFixed(2) : 0,
            percentualPeso: pesoTotal > 0 ? (dados.peso / pesoTotal * 100).toFixed(2) : 0
          };
        });

        const [totalParticipantes] = await pool.query(
          'SELECT COUNT(*) as total FROM evento_participantes WHERE evento_id = ?',
          [evento_id]
        );

        res.write(`data: ${JSON.stringify({
          resultados: percentuais,
          totais: {
            votosRegistrados: totalVotos,
            pesoTotal: pesoTotal,
            participantesEvento: totalParticipantes[0].total,
            percentualParticipacao: totalParticipantes[0].total > 0 
              ? ((totalVotos / totalParticipantes[0].total) * 100).toFixed(2) 
              : 0
          }
        })}\n\n`);

      } catch (error) {
        console.error('Erro ao enviar resultados:', error);
      }
    };

    // Enviar resultados a cada 3 segundos
    const interval = setInterval(enviarResultados, 3000);
    enviarResultados(); // Enviar imediatamente

    req.on('close', () => {
      clearInterval(interval);
    });
  }
};

module.exports = votoController;