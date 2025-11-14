let eventoAtual = null;
let intervalAtualizacao = null;

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await verificarAutenticacao();
    if (!usuario) return;

    document.getElementById('nomeUsuario').textContent = usuario.nome;

    const urlParams = new URLSearchParams(window.location.search);
    const eventoId = urlParams.get('evento');

    if (!eventoId) {
        await alertCustom('Evento não especificado', 'Erro', 'error');
        window.location.href = '/eventos.html';
        return;
    }

    await carregarEvento(eventoId);
    await verificarPresenca(eventoId);
    iniciarAtualizacaoAutomatica(eventoId);
});

async function carregarEvento(eventoId) {
    try {
        const response = await request(`/eventos/${eventoId}`);
        eventoAtual = response.evento;
        
        document.getElementById('eventoTitulo').textContent = eventoAtual.titulo;
        document.getElementById('eventoDescricao').textContent = eventoAtual.descricao || 'Sem descrição';
        
        const dataInicio = new Date(eventoAtual.data_inicio).toLocaleString('pt-BR');
        const dataFim = new Date(eventoAtual.data_fim).toLocaleString('pt-BR');
        document.getElementById('eventoPeriodo').textContent = `${dataInicio} - ${dataFim}`;

        const tiposVotacao = {
            'BINARIO': 'Binário (Sim/Não)',
            'APROVACAO': 'Por Aprovação',
            'ALTERNATIVAS': 'Por Alternativas',
            'SIM_NAO': 'Sim/Não/Abstenção/Ausente'
        };
        document.getElementById('eventoTipo').textContent = tiposVotacao[eventoAtual.tipo_votacao] || eventoAtual.tipo_votacao;

        atualizarListaPresenca();
    } catch (error) {
        console.error('Erro ao carregar evento:', error);
        await alertCustom('Erro ao carregar evento', 'Erro', 'error');
        window.location.href = '/eventos.html';
    }
}

async function verificarPresenca(eventoId) {
    const usuario = getUsuario();
    
    const participante = eventoAtual.participantes.find(p => p.usuario_id === usuario.id);
    
    if (participante && participante.presente) {
        document.getElementById('botaoPresencaContainer').style.display = 'none';
        document.getElementById('presencaConfirmada').style.display = 'block';
        
        if (eventoAtual.status === 'ATIVO') {
            document.getElementById('mensagemAguardo').innerHTML = `
                <i class="fas fa-check-circle"></i> O administrador iniciou a votação. Você pode votar agora!
            `;
            document.getElementById('botaoVotacao').style.display = 'block';
        } else {
            document.getElementById('mensagemAguardo').innerHTML = `
                <i class="fas fa-clock"></i> Aguardando administrador iniciar a votação...
            `;
        }
    }
}

function atualizarListaPresenca() {
    const participantesPresentes = eventoAtual.participantes.filter(p => p.presente);
    const pesoPresente = participantesPresentes.reduce((sum, p) => sum + parseFloat(p.peso || 0), 0);
    
    const participantesTotal = eventoAtual.participantes;
    const pesoTotal = participantesTotal.reduce((sum, p) => sum + parseFloat(p.peso || 0), 0);
    
    const percentualPeso = pesoTotal > 0 ? (pesoPresente / pesoTotal * 100).toFixed(2) : 0;
    const quorumMinimo = eventoAtual.peso_minimo_quorum;

    document.getElementById('contadorPresentes').textContent = participantesPresentes.length;
    document.getElementById('contadorTotal').textContent = participantesTotal.length;
    document.getElementById('pesoPresente').textContent = pesoPresente.toFixed(2);
    document.getElementById('pesoTotal').textContent = pesoTotal.toFixed(2);
    document.getElementById('percentualPeso').textContent = percentualPeso;
    document.getElementById('quorumMinimo').textContent = quorumMinimo;

    document.getElementById('textoQuorum').innerHTML = `
        <strong>${percentualPeso}%</strong> de ${quorumMinimo}% necessário (Peso: ${pesoPresente.toFixed(2)} de ${pesoTotal.toFixed(2)})
    `;

    if (parseFloat(percentualPeso) >= quorumMinimo) {
        document.getElementById('alertaQuorum').style.display = 'none';
        document.getElementById('quorumAtingido').style.display = 'block';
        document.getElementById('quorumAtingido').innerHTML = `
            <i class="fas fa-check-circle"></i>
            <strong>Quórum de ${quorumMinimo}% atingido!</strong> (${percentualPeso}% presente)
            <br>
            <small>Aguardando administrador iniciar a votação...</small>
        `;
    } else {
        document.getElementById('alertaQuorum').style.display = 'block';
        document.getElementById('quorumAtingido').style.display = 'none';
    }

    if (eventoAtual.status === 'ATIVO') {
        const usuario = getUsuario();
        const participante = eventoAtual.participantes.find(p => p.usuario_id === usuario.id);
        if (participante && participante.presente) {
            document.getElementById('mensagemAguardo').innerHTML = `
                <i class="fas fa-check-circle"></i> O administrador iniciou a votação. Você pode votar agora!
            `;
            document.getElementById('botaoVotacao').style.display = 'block';
        }
    }

    const grid = document.getElementById('participantesGrid');
    grid.innerHTML = eventoAtual.participantes.map(p => `
        <div class="participante-card ${p.presente ? 'presente' : ''}">
            <i class="fas ${p.presente ? 'fa-user-check' : 'fa-user'}"></i>
            <div class="participante-info">
                <strong>${p.nome}</strong>
                <small>${p.municipio_nome || 'Admin'} ${p.peso ? `(Peso: ${p.peso})` : ''}</small>
            </div>
        </div>
    `).join('');
}

async function confirmarPresenca() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventoId = urlParams.get('evento');

    try {
        const response = await request(`/eventos/${eventoId}/presenca`, {
            method: 'POST'
        });

        if (response.success) {
            await carregarEvento(eventoId);
            
            document.getElementById('botaoPresencaContainer').style.display = 'none';
            document.getElementById('presencaConfirmada').style.display = 'block';

            document.getElementById('mensagemAguardo').innerHTML = `
                <i class="fas fa-check-circle"></i> Presença confirmada! 
                <br>
                <strong>Peso atual: ${response.percentualPeso}%</strong> de ${response.quorumMinimo}% necessário
                <br>
                <small>Aguardando administrador iniciar a votação...</small>
            `;

            await alertCustom(
                `Presença confirmada com sucesso!\n\nPeso do quórum: ${response.percentualPeso}% de ${response.quorumMinimo}%`,
                'Presença Confirmada',
                'success'
            );
        }
    } catch (error) {
        await alertCustom(error.message, 'Erro', 'error');
    }
}

function iniciarAtualizacaoAutomatica(eventoId) {
    intervalAtualizacao = setInterval(async () => {
        await carregarEvento(eventoId);
    }, 5000);
}

function irParaVotacao() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventoId = urlParams.get('evento');
    window.location.href = `/votacao.html?evento=${eventoId}`;
}

window.addEventListener('beforeunload', () => {
    if (intervalAtualizacao) {
        clearInterval(intervalAtualizacao);
    }
});