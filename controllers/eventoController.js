const getPool = () => {
  if (global.pool) return global.pool;
  const { pool } = require('../server');
  return pool;
};

const eventoController = {
  // Criar evento com votação múltipla
  async criarEvento(req, res) {
    const pool = getPool();
    
    try {
      const { 
        titulo, 
        descricao, 
        tipo_votacao,
        votacao_multipla,
        votos_maximos,
        opcoes_votacao,
        data_inicio, 
        data_fim, 
        peso_minimo_quorum, 
        participantes 
      } = req.body;
      const usuario = req.usuario;

      if (!titulo || !data_inicio || !data_fim || !tipo_votacao) {
        return res.status(400).json({ 
          success: false, 
          message: 'Título, datas e tipo de votação são obrigatórios' 
        });
      }

      const tiposValidos = ['BINARIO', 'APROVACAO', 'ALTERNATIVAS', 'SIM_NAO'];
      if (!tiposValidos.includes(tipo_votacao)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Tipo de votação inválido' 
        });
      }

      if (tipo_votacao === 'ALTERNATIVAS') {
        if (!opcoes_votacao || !Array.isArray(opcoes_votacao) || opcoes_votacao.length < 2) {
          return res.status(400).json({ 
            success: false, 
            message: 'Para votação por alternativas, forneça pelo menos 2 opções' 
          });
        }
      }

      if (new Date(data_inicio) >= new Date(data_fim)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Data de fim deve ser posterior à data de início' 
        });
      }

      // Preparar opções de votação
      let opcoesJSON = null;
      const isVotacaoMultipla = votacao_multipla === true || votacao_multipla === 1;
      const maxVotos = votos_maximos || 1;
      
      switch(tipo_votacao) {
        case 'BINARIO':
          opcoesJSON = JSON.stringify(['Sim', 'Não']);
          break;
        case 'APROVACAO':
          opcoesJSON = JSON.stringify(['Aprovar', 'Reprovar', 'Abstenção']);
          break;
        case 'SIM_NAO':
          opcoesJSON = JSON.stringify(['SIM', 'NÃO', 'ABSTENÇÃO', 'AUSENTE']);
          break;
        case 'ALTERNATIVAS':
          // Adicionar "Voto em Branco" e "Nenhuma das alternativas"
          const opcoesCompletas = [...opcoes_votacao, 'Voto em Branco', 'Nenhuma das alternativas'];
          opcoesJSON = JSON.stringify(opcoesCompletas);
          break;
      }

      console.log('Salvando opções JSON:', opcoesJSON);

      // Criar evento
      const [resultado] = await pool.query(
        `INSERT INTO eventos_votacao 
         (titulo, descricao, tipo_votacao, votacao_multipla, votos_maximos, opcoes_votacao, 
          data_inicio, data_fim, peso_minimo_quorum, status, criado_por) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'RASCUNHO', ?)`,
        [titulo, descricao, tipo_votacao, isVotacaoMultipla ? 1 : 0, maxVotos, opcoesJSON, 
         data_inicio, data_fim, peso_minimo_quorum || 60.00, usuario.id]
      );

      const eventoId = resultado.insertId;

      // Adicionar participantes
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
          tipo_votacao,
          votacao_multipla: isVotacaoMultipla,
          votos_maximos: maxVotos,
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

  // Listar eventos (verificando período de datas)
  async listarEventos(req, res) {
    const pool = getPool();
    
    try {
      const [eventos] = await pool.query(`
        SELECT e.*, u.nome as criador_nome,
               (SELECT COUNT(*) FROM evento_participantes WHERE evento_id = e.id) as total_participantes,
               (SELECT COUNT(*) FROM evento_participantes WHERE evento_id = e.id AND presente = 1) as total_presentes,
               (SELECT SUM(m.peso) FROM evento_participantes ep 
                INNER JOIN usuarios us ON ep.usuario_id = us.id 
                INNER JOIN municipios m ON us.municipio_id = m.id 
                WHERE ep.evento_id = e.id AND ep.presente = 1) as peso_presentes,
               (SELECT COUNT(DISTINCT municipio_id) FROM votos WHERE evento_id = e.id) as total_votos,
               CASE 
                 WHEN NOW() < e.data_inicio THEN 'ANTES_PERIODO'
                 WHEN NOW() > e.data_fim THEN 'APOS_PERIODO'
                 ELSE 'DENTRO_PERIODO'
               END as periodo_status
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
        SELECT e.*, u.nome as criador_nome,
               CASE 
                 WHEN NOW() < e.data_inicio THEN 'ANTES_PERIODO'
                 WHEN NOW() > e.data_fim THEN 'APOS_PERIODO'
                 ELSE 'DENTRO_PERIODO'
               END as periodo_status
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

      const evento = eventos[0];

      // Parse seguro de JSON
      if (evento.opcoes_votacao) {
        try {
          if (typeof evento.opcoes_votacao === 'string') {
            if (evento.opcoes_votacao.trim().startsWith('[') || evento.opcoes_votacao.trim().startsWith('{')) {
              evento.opcoes_votacao = JSON.parse(evento.opcoes_votacao);
            } else {
              evento.opcoes_votacao = evento.opcoes_votacao.split(',').map(s => s.trim()).filter(s => s);
            }
          }
        } catch (parseError) {
          console.error('Erro ao fazer parse de opcoes_votacao:', parseError);
          switch(evento.tipo_votacao) {
            case 'BINARIO':
              evento.opcoes_votacao = ['Sim', 'Não'];
              break;
            case 'APROVACAO':
              evento.opcoes_votacao = ['Aprovar', 'Reprovar', 'Abstenção'];
              break;
            case 'SIM_NAO':
              evento.opcoes_votacao = ['SIM', 'NÃO', 'ABSTENÇÃO', 'AUSENTE'];
              break;
            default:
              evento.opcoes_votacao = [];
          }
        }
      } else {
        switch(evento.tipo_votacao) {
          case 'BINARIO':
            evento.opcoes_votacao = ['Sim', 'Não'];
            break;
          case 'APROVACAO':
            evento.opcoes_votacao = ['Aprovar', 'Reprovar', 'Abstenção'];
            break;
          case 'SIM_NAO':
            evento.opcoes_votacao = ['SIM', 'NÃO', 'ABSTENÇÃO', 'AUSENTE'];
            break;
          default:
            evento.opcoes_votacao = [];
        }
      }

      // Buscar participantes
      const [participantes] = await pool.query(`
        SELECT ep.*, u.nome, u.cpf, u.tipo, m.nome as municipio_nome, m.peso
        FROM evento_participantes ep
        INNER JOIN usuarios u ON ep.usuario_id = u.id
        LEFT JOIN municipios m ON u.municipio_id = m.id
        WHERE ep.evento_id = ?
        ORDER BY ep.presente DESC, u.nome
      `, [id]);

      return res.json({
        success: true,
        evento: {
          ...evento,
          participantes
        }
      });

    } catch (error) {
      console.error('Erro ao obter evento:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao obter evento: ' + error.message 
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

      const [eventos] = await pool.query('SELECT id FROM eventos_votacao WHERE id = ?', [id]);
      if (eventos.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Evento não encontrado' 
        });
      }

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

  // Marcar presença (não é mais necessário, mas manter para compatibilidade)
  async marcarPresenca(req, res) {
    const pool = getPool();
    
    try {
      const { id } = req.params;
      const usuario = req.usuario;

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

      const [pesoPresentes] = await pool.query(`
        SELECT SUM(m.peso) as peso_total
        FROM evento_participantes ep
        INNER JOIN usuarios u ON ep.usuario_id = u.id
        INNER JOIN municipios m ON u.municipio_id = m.id
        WHERE ep.evento_id = ? AND ep.presente = 1
      `, [id]);

      const [pesoTotal] = await pool.query(`
        SELECT SUM(m.peso) as peso_total
        FROM evento_participantes ep
        INNER JOIN usuarios u ON ep.usuario_id = u.id
        INNER JOIN municipios m ON u.municipio_id = m.id
        WHERE ep.evento_id = ?
      `, [id]);

      const pesoAtual = parseFloat(pesoPresentes[0].peso_total || 0);
      const pesoTotalEvento = parseFloat(pesoTotal[0].peso_total || 0);
      const percentualPeso = pesoTotalEvento > 0 ? (pesoAtual / pesoTotalEvento * 100) : 0;

      const [evento] = await pool.query(
        'SELECT peso_minimo_quorum FROM eventos_votacao WHERE id = ?',
        [id]
      );

      const quorumAtingido = percentualPeso >= evento[0].peso_minimo_quorum;

      return res.json({
        success: true,
        message: 'Presença confirmada',
        pesoPresente: pesoAtual,
        pesoTotal: pesoTotalEvento,
        percentualPeso: percentualPeso.toFixed(2),
        quorumMinimo: evento[0].peso_minimo_quorum,
        quorumAtingido
      });

    } catch (error) {
      console.error('Erro ao marcar presença:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao marcar presença' 
      });
    }
  },

  // Iniciar evento (mudança de status para AGUARDANDO_INICIO)
  async iniciarEvento(req, res) {
    const pool = getPool();
    
    try {
      const { id } = req.params;

      // Verificar se está dentro do período
      const [evento] = await pool.query(
        `SELECT *, 
         CASE 
           WHEN NOW() < data_inicio THEN 'ANTES_PERIODO'
           WHEN NOW() > data_fim THEN 'APOS_PERIODO'
           ELSE 'DENTRO_PERIODO'
         END as periodo_status
         FROM eventos_votacao WHERE id = ?`,
        [id]
      );

      if (evento.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Evento não encontrado' 
        });
      }

      if (evento[0].periodo_status === 'ANTES_PERIODO') {
        return res.status(400).json({ 
          success: false, 
          message: 'Evento ainda não iniciou. Data de início: ' + new Date(evento[0].data_inicio).toLocaleString('pt-BR')
        });
      }

      if (evento[0].periodo_status === 'APOS_PERIODO') {
        return res.status(400).json({ 
          success: false, 
          message: 'Evento já encerrou. Data de fim: ' + new Date(evento[0].data_fim).toLocaleString('pt-BR')
        });
      }

      await pool.query(
        "UPDATE eventos_votacao SET status = 'AGUARDANDO_INICIO' WHERE id = ? AND status = 'RASCUNHO'",
        [id]
      );

      return res.json({
        success: true,
        message: 'Evento iniciado. Aguardando liberação para votação.'
      });

    } catch (error) {
      console.error('Erro ao iniciar evento:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao iniciar evento' 
      });
    }
  },

  // NOVO: Liberar votação (status ATIVO)
  async liberarVotacao(req, res) {
    const pool = getPool();
    
    try {
      const { id } = req.params;

      // Verificar se está dentro do período
      const [evento] = await pool.query(
        `SELECT *, 
         CASE 
           WHEN NOW() < data_inicio THEN 'ANTES_PERIODO'
           WHEN NOW() > data_fim THEN 'APOS_PERIODO'
           ELSE 'DENTRO_PERIODO'
         END as periodo_status
         FROM eventos_votacao WHERE id = ?`,
        [id]
      );

      if (evento.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Evento não encontrado' 
        });
      }

      if (evento[0].periodo_status !== 'DENTRO_PERIODO') {
        return res.status(400).json({ 
          success: false, 
          message: 'Evento fora do período permitido para votação'
        });
      }

      if (evento[0].status !== 'AGUARDANDO_INICIO') {
        return res.status(400).json({ 
          success: false, 
          message: 'Evento deve estar em status "Aguardando Início" para liberar votação'
        });
      }

      await pool.query(
        "UPDATE eventos_votacao SET status = 'ATIVO' WHERE id = ?",
        [id]
      );

      return res.json({
        success: true,
        message: 'Votação liberada! Participantes presentes podem votar agora.'
      });

    } catch (error) {
      console.error('Erro ao liberar votação:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao liberar votação' 
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
  },

  // Exportar CSV (mantém igual)
  async exportarCSV(req, res) {
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

      const evento = eventos[0];

      const [votos] = await pool.query(`
        SELECT v.*, u.nome as usuario_nome, u.cpf, m.nome as municipio_nome
        FROM votos v
        INNER JOIN usuarios u ON v.usuario_id = u.id
        INNER JOIN municipios m ON v.municipio_id = m.id
        WHERE v.evento_id = ?
        ORDER BY v.data_hora
      `, [id]);

      const [participantes] = await pool.query(`
        SELECT u.nome, u.cpf, m.nome as municipio_nome, ep.presente, ep.data_presenca
        FROM evento_participantes ep
        INNER JOIN usuarios u ON ep.usuario_id = u.id
        LEFT JOIN municipios m ON u.municipio_id = m.id
        WHERE ep.evento_id = ?
        ORDER BY u.nome
      `, [id]);

      let csv = '\uFEFF';
      
      csv += `RELATÓRIO DE VOTAÇÃO\n\n`;
      csv += `Título;${evento.titulo}\n`;
      csv += `Descrição;${evento.descricao || 'N/A'}\n`;
      csv += `Tipo de Votação;${evento.tipo_votacao}\n`;
      csv += `Votação Múltipla;${evento.votacao_multipla ? 'Sim (Máx: ' + evento.votos_maximos + ')' : 'Não'}\n`;
      csv += `Status;${evento.status}\n`;
      csv += `Data Início;${new Date(evento.data_inicio).toLocaleString('pt-BR')}\n`;
      csv += `Data Fim;${new Date(evento.data_fim).toLocaleString('pt-BR')}\n`;
      csv += `Criado por;${evento.criador_nome}\n`;
      csv += `Data de Geração;${new Date().toLocaleString('pt-BR')}\n\n`;

      csv += `PARTICIPANTES\n`;
      csv += `Nome;CPF;Município;Presente;Data Presença\n`;
      participantes.forEach(p => {
        csv += `${p.nome};${p.cpf};${p.municipio_nome || 'N/A'};${p.presente ? 'Sim' : 'Não'};${p.data_presenca ? new Date(p.data_presenca).toLocaleString('pt-BR') : 'N/A'}\n`;
      });

      csv += `\n`;

      csv += `VOTOS REGISTRADOS\n`;
      csv += `Município;Votante;CPF;Voto;Peso;Data/Hora\n`;
      votos.forEach(v => {
        csv += `${v.municipio_nome};${v.usuario_nome};${v.cpf};${v.voto};${v.peso};${new Date(v.data_hora).toLocaleString('pt-BR')}\n`;
      });

      csv += `\n`;

      const totalVotos = votos.length;
      const totalParticipantes = participantes.length;
      const totalPresentes = participantes.filter(p => p.presente).length;
      const pesoTotal = votos.reduce((sum, v) => sum + parseFloat(v.peso), 0);

      csv += `RESUMO\n`;
      csv += `Total de Participantes;${totalParticipantes}\n`;
      csv += `Total de Presentes;${totalPresentes}\n`;
      csv += `Total de Votos;${totalVotos}\n`;
      csv += `Peso Total dos Votos;${pesoTotal.toFixed(2)}\n`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="votacao_${id}_${Date.now()}.csv"`);
      res.send(csv);

    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao exportar CSV' 
      });
    }
  }
};

module.exports = eventoController;