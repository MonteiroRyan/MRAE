const { pool } = require('../server');

const votoController = {
  async registrarVoto(req, res) {
    try {
      const { voto, sessionId } = req.body;
      const usuario = req.usuario; // Vem do middleware

      // Validar voto
      if (!['SIM', 'NAO', 'ABSTENCAO', 'AUSENTE'].includes(voto)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Opção de voto inválida' 
        });
      }

      // Verificar se já votou
      const [votosExistentes] = await pool.query(
        'SELECT id FROM votos WHERE usuario_id = ?',
        [usuario.id]
      );

      if (votosExistentes.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Você já votou' 
        });
      }

      // Registrar voto
      await pool.query(
        'INSERT INTO votos (usuario_id, municipio_id, voto, peso, data_hora) VALUES (?, ?, ?, ?, NOW())',
        [usuario.id, usuario.municipio_id, voto, usuario.peso]
      );

      return res.json({
        success: true,
        message: 'Voto registrado com sucesso'
      });

    } catch (error) {
      console.error('Erro ao registrar voto:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao registrar voto' 
      });
    }
  },

  async verificarVoto(req, res) {
    try {
      const { cpf } = req.params;

      const [votos] = await pool.query(
        'SELECT v.* FROM votos v INNER JOIN usuarios u ON v.usuario_id = u.id WHERE u.cpf = ?',
        [cpf]
      );

      return res.json({
        success: true,
        jaVotou: votos.length > 0
      });

    } catch (error) {
      console.error('Erro ao verificar voto:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao verificar voto' 
      });
    }
  },

  async obterResultados(req, res) {
    try {
      // Obter contagem de votos com peso
      const [resultados] = await pool.query(`
        SELECT 
          voto,
          COUNT(*) as quantidade,
          SUM(peso) as peso_total
        FROM votos
        GROUP BY voto
      `);

      // Calcular totais
      let totalVotos = 0;
      let pesoTotal = 0;
      const resultadosMap = {};

      resultados.forEach(r => {
        totalVotos += r.quantidade;
        pesoTotal += r.peso_total;
        resultadosMap[r.voto] = {
          quantidade: r.quantidade,
          peso: r.peso_total
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

      // Total de usuários cadastrados
      const [totalUsuarios] = await pool.query(
        'SELECT COUNT(*) as total FROM usuarios WHERE tipo != "ADMIN" AND ativo = 1'
      );

      return res.json({
        success: true,
        resultados: percentuais,
        totais: {
          votosRegistrados: totalVotos,
          pesoTotal: pesoTotal,
          usuariosCadastrados: totalUsuarios[0].total,
          percentualParticipacao: ((totalVotos / totalUsuarios[0].total) * 100).toFixed(2)
        }
      });

    } catch (error) {
      console.error('Erro ao obter resultados:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao obter resultados' 
      });
    }
  },

  // Server-Sent Events para resultados em tempo real
  async streamResultados(req, res) {
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
          GROUP BY voto
        `);

        let totalVotos = 0;
        let pesoTotal = 0;
        const resultadosMap = {};

        resultados.forEach(r => {
          totalVotos += r.quantidade;
          pesoTotal += r.peso_total;
          resultadosMap[r.voto] = {
            quantidade: r.quantidade,
            peso: r.peso_total
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

        const [totalUsuarios] = await pool.query(
          'SELECT COUNT(*) as total FROM usuarios WHERE tipo != "ADMIN" AND ativo = 1'
        );

        res.write(`data: ${JSON.stringify({
          resultados: percentuais,
          totais: {
            votosRegistrados: totalVotos,
            pesoTotal: pesoTotal,
            usuariosCadastrados: totalUsuarios[0].total,
            percentualParticipacao: ((totalVotos / totalUsuarios[0].total) * 100).toFixed(2)
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