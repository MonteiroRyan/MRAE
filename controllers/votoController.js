const getPool = () => {
  if (global.pool) return global.pool;
  const { pool } = require('../server');
  return pool;
};

function parseOpcoesSeguro(opcoes, tipoVotacao) {
  try {
    if (typeof opcoes === 'string') {
      if (opcoes.trim().startsWith('[') || opcoes.trim().startsWith('{')) {
        return JSON.parse(opcoes);
      } else {
        const lista = opcoes.split(',').map(s => s.trim()).filter(s => s);
        return lista;
      }
    }
    if (Array.isArray(opcoes)) {
      return opcoes;
    }
    return getOpcoesPadrao(tipoVotacao);
  } catch (error) {
    console.error('Erro ao fazer parse de opções:', error);
    return getOpcoesPadrao(tipoVotacao);
  }
}

function getOpcoesPadrao(tipoVotacao) {
  switch(tipoVotacao) {
    case 'BINARIO':
      return ['Sim', 'Não'];
    case 'APROVACAO':
      return ['Aprovar', 'Reprovar', 'Abstenção'];
    case 'SIM_NAO':
      return ['SIM', 'NÃO', 'ABSTENÇÃO', 'AUSENTE'];
    case 'ALTERNATIVAS':
      return ['Voto em Branco', 'Nenhuma das alternativas'];
    default:
      return [];
  }
}

const votoController = {
  async registrarVoto(req, res) {
    const pool = getPool();
    
    try {
      const { votos, evento_id } = req.body; // Agora aceita array de votos
      const usuario = req.usuario;

      if (!votos || !evento_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Votos e evento são obrigatórios' 
        });
      }

      // Validar se é array
      const votosArray = Array.isArray(votos) ? votos : [votos];

      // Buscar evento e validar
      const [eventos] = await pool.query(
        `SELECT status, tipo_votacao, opcoes_votacao, votacao_multipla, votos_maximos,
                data_inicio, data_fim,
                CASE 
                  WHEN NOW() < data_inicio THEN 'ANTES_PERIODO'
                  WHEN NOW() > data_fim THEN 'APOS_PERIODO'
                  ELSE 'DENTRO_PERIODO'
                END as periodo_status
         FROM eventos_votacao WHERE id = ?`,
        [evento_id]
      );

      if (eventos.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Evento não encontrado' 
        });
      }

      const evento = eventos[0];

      // Verificar período
      if (evento.periodo_status !== 'DENTRO_PERIODO') {
        return res.status(400).json({ 
          success: false, 
          message: 'Evento fora do período permitido para votação' 
        });
      }

      // Verificar se evento está ativo
      if (evento.status !== 'ATIVO') {
        return res.status(400).json({ 
          success: false, 
          message: 'Votação não foi liberada pelo administrador. Aguarde a liberação.' 
        });
      }

      // Parse seguro das opções
      const opcoesValidas = parseOpcoesSeguro(evento.opcoes_votacao, evento.tipo_votacao);
      
      // Validar votos
      for (const voto of votosArray) {
        if (!opcoesValidas.includes(voto)) {
          return res.status(400).json({ 
            success: false, 
            message: `Opção de voto inválida: "${voto}". Opções válidas: ${opcoesValidas.join(', ')}` 
          });
        }
      }

      // Verificar quantidade de votos
      const maxVotos = evento.votacao_multipla ? evento.votos_maximos : 1;
      if (votosArray.length > maxVotos) {
        return res.status(400).json({ 
          success: false, 
          message: `Você pode votar em no máximo ${maxVotos} opção(ões)` 
        });
      }

      // Verificar se usuário é participante e está presente
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

      // Verificar se município já votou
      const [votosExistentes] = await pool.query(
        'SELECT id, usuario_id FROM votos WHERE evento_id = ? AND municipio_id = ?',
        [evento_id, usuario.municipio_id]
      );

      if (votosExistentes.length > 0) {
        const [usuarioVotou] = await pool.query(
          'SELECT nome FROM usuarios WHERE id = ?',
          [votosExistentes[0].usuario_id]
        );
        
        return res.status(400).json({ 
          success: false, 
          message: `Seu município já votou neste evento. Voto registrado por: ${usuarioVotou[0].nome}` 
        });
      }

      // Registrar votos
      let votoNumero = 1;
      for (const voto of votosArray) {
        await pool.query(
          `INSERT INTO votos (evento_id, usuario_id, municipio_id, voto, voto_numero, peso, data_hora) 
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [evento_id, usuario.id, usuario.municipio_id, voto, votoNumero, usuario.peso]
        );
        votoNumero++;
      }

      return res.json({
        success: true,
        message: votosArray.length > 1 
          ? `${votosArray.length} votos registrados com sucesso para o município` 
          : 'Voto registrado com sucesso para o município'
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
        `SELECT v.*, u.nome as votante 
         FROM votos v 
         INNER JOIN usuarios u ON v.usuario_id = u.id 
         WHERE v.evento_id = ? AND v.municipio_id = ?`,
        [evento_id, usuario.municipio_id]
      );

      return res.json({
        success: true,
        jaVotou: votos.length > 0,
        votante: votos.length > 0 ? votos[0].votante : null,
        quantidadeVotos: votos.length
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

      const [eventos] = await pool.query(
        'SELECT tipo_votacao, opcoes_votacao, votacao_multipla, votos_maximos FROM eventos_votacao WHERE id = ?',
        [evento_id]
      );

      if (eventos.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Evento não encontrado' 
        });
      }

      const evento = eventos[0];
      const opcoes = parseOpcoesSeguro(evento.opcoes_votacao, evento.tipo_votacao);

      // Obter contagem de votos com peso
      const [resultados] = await pool.query(`
        SELECT 
          voto,
          COUNT(DISTINCT municipio_id) as quantidade_municipios,
          SUM(peso) as peso_total
        FROM votos
        WHERE evento_id = ?
        GROUP BY voto
      `, [evento_id]);

      let totalMunicipios = 0;
      let pesoTotal = 0;
      const resultadosMap = {};

      resultados.forEach(r => {
        totalMunicipios += r.quantidade_municipios;
        pesoTotal += parseFloat(r.peso_total);
        resultadosMap[r.voto] = {
          quantidade: r.quantidade_municipios,
          peso: parseFloat(r.peso_total)
        };
      });

      const percentuais = {};
      opcoes.forEach(opcao => {
        const dados = resultadosMap[opcao] || { quantidade: 0, peso: 0 };
        percentuais[opcao] = {
          quantidade: dados.quantidade,
          peso: dados.peso,
          percentualQuantidade: totalMunicipios > 0 ? (dados.quantidade / totalMunicipios * 100).toFixed(2) : 0,
          percentualPeso: pesoTotal > 0 ? (dados.peso / pesoTotal * 100).toFixed(2) : 0
        };
      });

      const [totalParticipantes] = await pool.query(
        'SELECT COUNT(DISTINCT municipio_id) as total FROM evento_participantes ep INNER JOIN usuarios u ON ep.usuario_id = u.id WHERE ep.evento_id = ?',
        [evento_id]
      );

      return res.json({
        success: true,
        tipo_votacao: evento.tipo_votacao,
        votacao_multipla: evento.votacao_multipla,
        votos_maximos: evento.votos_maximos,
        opcoes: opcoes,
        resultados: percentuais,
        totais: {
          votosRegistrados: totalMunicipios,
          pesoTotal: pesoTotal,
          municipiosParticipantes: totalParticipantes[0].total,
          percentualParticipacao: totalParticipantes[0].total > 0 
            ? ((totalMunicipios / totalParticipantes[0].total) * 100).toFixed(2) 
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

  async streamResultados(req, res) {
    const pool = getPool();
    const { evento_id } = req.params;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const enviarResultados = async () => {
      try {
        const [eventos] = await pool.query(
          'SELECT tipo_votacao, opcoes_votacao, votacao_multipla, votos_maximos FROM eventos_votacao WHERE id = ?',
          [evento_id]
        );

        if (eventos.length === 0) return;

        const evento = eventos[0];
        const opcoes = parseOpcoesSeguro(evento.opcoes_votacao, evento.tipo_votacao);

        const [resultados] = await pool.query(`
          SELECT 
            voto,
            COUNT(DISTINCT municipio_id) as quantidade_municipios,
            SUM(peso) as peso_total
          FROM votos
          WHERE evento_id = ?
          GROUP BY voto
        `, [evento_id]);

        let totalMunicipios = 0;
        let pesoTotal = 0;
        const resultadosMap = {};

        resultados.forEach(r => {
          totalMunicipios += r.quantidade_municipios;
          pesoTotal += parseFloat(r.peso_total);
          resultadosMap[r.voto] = {
            quantidade: r.quantidade_municipios,
            peso: parseFloat(r.peso_total)
          };
        });

        const percentuais = {};
        opcoes.forEach(opcao => {
          const dados = resultadosMap[opcao] || { quantidade: 0, peso: 0 };
          percentuais[opcao] = {
            quantidade: dados.quantidade,
            peso: dados.peso,
            percentualQuantidade: totalMunicipios > 0 ? (dados.quantidade / totalMunicipios * 100).toFixed(2) : 0,
            percentualPeso: pesoTotal > 0 ? (dados.peso / pesoTotal * 100).toFixed(2) : 0
          };
        });

        const [totalParticipantes] = await pool.query(
          'SELECT COUNT(DISTINCT municipio_id) as total FROM evento_participantes ep INNER JOIN usuarios u ON ep.usuario_id = u.id WHERE ep.evento_id = ?',
          [evento_id]
        );

        res.write(`data: ${JSON.stringify({
          tipo_votacao: evento.tipo_votacao,
          votacao_multipla: evento.votacao_multipla,
          votos_maximos: evento.votos_maximos,
          opcoes: opcoes,
          resultados: percentuais,
          totais: {
            votosRegistrados: totalMunicipios,
            pesoTotal: pesoTotal,
            municipiosParticipantes: totalParticipantes[0].total,
            percentualParticipacao: totalParticipantes[0].total > 0 
              ? ((totalMunicipios / totalParticipantes[0].total) * 100).toFixed(2) 
              : 0
          }
        })}\n\n`);

      } catch (error) {
        console.error('Erro ao enviar resultados:', error);
      }
    };

    const interval = setInterval(enviarResultados, 3000);
    enviarResultados();

    req.on('close', () => {
      clearInterval(interval);
    });
  }
};

module.exports = votoController;