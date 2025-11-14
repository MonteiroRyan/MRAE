let eventosDisponiveis = [];

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await verificarAutenticacao();
    if (!usuario) return;

    if (usuario.tipo === 'ADMIN') {
        window.location.href = '/admin.html';
        return;
    }

    document.getElementById('nomeUsuario').textContent = usuario.nome;
    
    // Mostrar mensagem de presença confirmada (vem do localStorage após login)
    const eventosPresenca = localStorage.getItem('eventosPresenca');
    if (eventosPresenca) {
        const eventos = JSON.parse(eventosPresenca);
        if (eventos.length > 0) {
            const eventosNovos = eventos.filter(e => e.automatica);
            if (eventosNovos.length > 0) {
                mostrarMensagemPresenca(eventosNovos);
            }
        }
        localStorage.removeItem('eventosPresenca');
    }
    
    carregarEventos();
});

function mostrarMensagemPresenca(eventos) {
    const container = document.getElementById('listaEventos');
    const mensagem = document.createElement('div');
    mensagem.className = 'mensagem success';
    mensagem.style.marginBottom = '2rem';
    mensagem.innerHTML = `
        <h3><i class="fas fa-check-circle"></i> Presença Confirmada Automaticamente!</h3>
        <p>Sua presença foi confirmada nos seguintes eventos:</p>
        <ul style="margin-top: 1rem; margin-left: 2rem;">
            ${eventos.map(e => `<li>${e.titulo}</li>`).join('')}
        </ul>
        <p style="margin-top: 1rem;"><small>Aguarde o administrador liberar a votação.</small></p>
    `;
    container.insertBefore(mensagem, container.firstChild);
}

async function carregarEventos() {
    try {
        const response = await request('/eventos');
        eventosDisponiveis = response.eventos;
        renderizarEventos();
    } catch (error) {
        console.error('Erro ao carregar eventos:', error);
        document.getElementById('listaEventos').innerHTML = 
            '<p class="error">Erro ao carregar eventos</p>';
    }
}

function renderizarEventos() {
    const container = document.getElementById('listaEventos');
    
    // Filtrar eventos disponíveis para o usuário
    const eventosVisiveis = eventosDisponiveis.filter(e => 
        e.status !== 'ENCERRADO' && e.periodo_status === 'DENTRO_PERIODO'
    );

    if (eventosVisiveis.length === 0) {
        container.innerHTML = `
            <div class="mensagem info">
                <i class="fas fa-info-circle"></i>
                Não há eventos de votação disponíveis no momento.
            </div>
        `;
        return;
    }

    container.innerHTML = eventosVisiveis.map(evento => {
        const dataInicio = new Date(evento.data_inicio).toLocaleString('pt-BR');
        const dataFim = new Date(evento.data_fim).toLocaleString('pt-BR');
        
        let badgeStatus = '';
        let textoAcao = '';
        let botaoAcao = '';
        
        if (evento.status === 'RASCUNHO') {
            badgeStatus = '<span class="badge badge-info">Em Preparação</span>';
            textoAcao = 'Presença confirmada automaticamente. Aguardando início do evento.';
        } else if (evento.status === 'AGUARDANDO_INICIO') {
            badgeStatus = '<span class="badge badge-warning">Aguardando Liberação</span>';
            textoAcao = 'Presença confirmada. Aguardando administrador liberar a votação.';
        } else if (evento.status === 'ATIVO') {
            badgeStatus = '<span class="badge badge-success">Votação Liberada</span>';
            textoAcao = 'Votação liberada! Você pode votar agora.';
            botaoAcao = `
                <button onclick="irParaVotacao(${evento.id})" class="btn btn-success">
                    <i class="fas fa-vote-yea"></i> Votar Agora
                </button>
            `;
        }

        let tipoVotacao = '';
        if (evento.votacao_multipla) {
            tipoVotacao = `<p><i class="fas fa-check-double"></i> <strong>Votação Múltipla:</strong> Até ${evento.votos_maximos} opções</p>`;
        }

        return `
            <div class="evento-card">
                <div class="evento-header">
                    <h3>${evento.titulo}</h3>
                    ${badgeStatus}
                </div>
                <div class="evento-body">
                    <p><i class="fas fa-align-left"></i> ${evento.descricao || 'Sem descrição'}</p>
                    ${tipoVotacao}
                    <p><i class="fas fa-calendar"></i> <strong>Início:</strong> ${dataInicio}</p>
                    <p><i class="fas fa-calendar"></i> <strong>Término:</strong> ${dataFim}</p>
                    <p><i class="fas fa-users"></i> <strong>Participantes:</strong> ${evento.total_participantes}</p>
                    <p><i class="fas fa-user-check"></i> <strong>Presentes:</strong> ${evento.total_presentes}</p>
                    ${evento.total_votos > 0 ? `<p><i class="fas fa-vote-yea"></i> <strong>Votos:</strong> ${evento.total_votos}</p>` : ''}
                    <div class="info" style="margin-top: 1rem;">
                        <i class="fas fa-check-circle"></i> ${textoAcao}
                    </div>
                </div>
                <div class="evento-footer">
                    ${botaoAcao}
                    <button onclick="verResultados(${evento.id})" class="btn btn-secondary">
                        <i class="fas fa-chart-bar"></i> Ver Resultados
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function irParaVotacao(eventoId) {
    window.location.href = `/votacao.html?evento=${eventoId}`;
}

function verResultados(eventoId) {
    window.location.href = `/resultados.html?evento=${eventoId}`;
}