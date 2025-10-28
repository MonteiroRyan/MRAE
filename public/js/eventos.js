let eventosDisponiveis = [];

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await verificarAutenticacao();
    if (!usuario) return;

    if (usuario.tipo === 'ADMIN') {
        window.location.href = '/admin.html';
        return;
    }

    document.getElementById('nomeUsuario').textContent = usuario.nome;
    carregarEventos();
});

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
    
    // Filtrar apenas eventos disponíveis para o usuário
    const eventosAtivos = eventosDisponiveis.filter(e => 
        e.status === 'AGUARDANDO_QUORUM' || e.status === 'ATIVO'
    );

    if (eventosAtivos.length === 0) {
        container.innerHTML = `
            <div class="mensagem info">
                <i class="fas fa-info-circle"></i>
                Não há eventos de votação disponíveis no momento.
            </div>
        `;
        return;
    }

    container.innerHTML = eventosAtivos.map(evento => {
        const dataInicio = new Date(evento.data_inicio).toLocaleString('pt-BR');
        const dataFim = new Date(evento.data_fim).toLocaleString('pt-BR');
        
        let badgeStatus = '';
        let textoAcao = '';
        
        if (evento.status === 'AGUARDANDO_QUORUM') {
            badgeStatus = '<span class="badge badge-warning">Aguardando Quórum</span>';
            textoAcao = 'Confirmar Presença';
        } else if (evento.status === 'ATIVO') {
            badgeStatus = '<span class="badge badge-success">Votação Ativa</span>';
            textoAcao = 'Votar Agora';
        }

        return `
            <div class="evento-card">
                <div class="evento-header">
                    <h3>${evento.titulo}</h3>
                    ${badgeStatus}
                </div>
                <div class="evento-body">
                    <p><i class="fas fa-align-left"></i> ${evento.descricao || 'Sem descrição'}</p>
                    <p><i class="fas fa-calendar"></i> <strong>Início:</strong> ${dataInicio}</p>
                    <p><i class="fas fa-calendar"></i> <strong>Término:</strong> ${dataFim}</p>
                    <p><i class="fas fa-users"></i> <strong>Participantes:</strong> ${evento.total_participantes}</p>
                    <p><i class="fas fa-user-check"></i> <strong>Presentes:</strong> ${evento.total_presentes} / ${evento.quorum_minimo} (quórum)</p>
                    ${evento.total_votos > 0 ? `<p><i class="fas fa-vote-yea"></i> <strong>Votos:</strong> ${evento.total_votos}</p>` : ''}
                </div>
                <div class="evento-footer">
                    ${evento.status === 'AGUARDANDO_QUORUM' 
                        ? `<button onclick="irParaPresenca(${evento.id})" class="btn btn-primary">
                            <i class="fas fa-hand-paper"></i> ${textoAcao}
                           </button>`
                        : `<button onclick="irParaVotacao(${evento.id})" class="btn btn-success">
                            <i class="fas fa-vote-yea"></i> ${textoAcao}
                           </button>`
                    }
                    <button onclick="verResultados(${evento.id})" class="btn btn-secondary">
                        <i class="fas fa-chart-bar"></i> Ver Resultados
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function irParaPresenca(eventoId) {
    window.location.href = `/presenca.html?evento=${eventoId}`;
}

function irParaVotacao(eventoId) {
    window.location.href = `/votacao.html?evento=${eventoId}`;
}

function verResultados(eventoId) {
    window.location.href = `/resultados.html?evento=${eventoId}`;
}