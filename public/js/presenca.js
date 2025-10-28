let eventoAtual = null;
let intervalAtualizacao = null;

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await verificarAutenticacao();
    if (!usuario) return;

    document.getElementById('nomeUsuario').textContent = usuario.nome;

    // Obter ID do evento da URL
    const urlParams = new URLSearchParams(window.location.search);
    const eventoId = urlParams.get('evento');

    if (!eventoId) {
        alert('Evento não especificado');
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

        atualizarListaPresenca();
    } catch (error) {
        console.error('Erro ao carregar evento:', error);
        alert('Erro ao carregar evento');
        window.location.href = '/eventos.html';
    }
}

async function verificarPresenca(eventoId) {
    const usuario = getUsuario();
    
    // Verificar se já confirmou presença
    const participante = eventoAtual.participantes.find(p => p.usuario_id === usuario.id);
    
    if (participante && participante.presente) {
        document.getElementById('botaoPresencaContainer').style.display = 'none';
        document.getElementById('presencaConfirmada').style.display = 'block';
        
        // Verificar se quórum foi atingido
        if (eventoAtual.status === 'ATIVO') {
            document.getElementById('mensagemAguardo').textContent = 'O quórum foi atingido. Você pode votar agora!';
            document.getElementById('botaoVotacao').style.display = 'block';
        } else {
            document.getElementById('mensagemAguardo').textContent = 'Aguardando outros participantes confirmarem presença...';
        }
    }
}

function atualizarListaPresenca() {
    const presentes = eventoAtual.participantes.filter(p => p.presente).length;
    const total = eventoAtual.participantes.length;
    const quorum = eventoAtual.quorum_minimo;

    document.getElementById('contadorPresentes').textContent = presentes;
    document.getElementById('contadorTotal').textContent = total;
    document.getElementById('textoQuorum').textContent = `${presentes} de ${quorum} pessoas presentes`;

    // Atualizar alerta de quórum
    if (presentes >= quorum) {
        document.getElementById('alertaQuorum').style.display = 'none';
        document.getElementById('quorumAtingido').style.display = 'block';
        
        // Se já confirmou presença, mostrar botão de votação
        const usuario = getUsuario();
        const participante = eventoAtual.participantes.find(p => p.usuario_id === usuario.id);
        if (participante && participante.presente) {
            document.getElementById('mensagemAguardo').textContent = 'O quórum foi atingido. Você pode votar agora!';
            document.getElementById('botaoVotacao').style.display = 'block';
        }
    } else {
        document.getElementById('alertaQuorum').style.display = 'block';
        document.getElementById('quorumAtingido').style.display = 'none';
    }

    // Renderizar grid de participantes
    const grid = document.getElementById('participantesGrid');
    grid.innerHTML = eventoAtual.participantes.map(p => `
        <div class="participante-card ${p.presente ? 'presente' : ''}">
            <i class="fas ${p.presente ? 'fa-user-check' : 'fa-user'}"></i>
            <div class="participante-info">
                <strong>${p.nome}</strong>
                <small>${p.municipio_nome || 'Admin'}</small>
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
            // Recarregar evento
            await carregarEvento(eventoId);
            
            document.getElementById('botaoPresencaContainer').style.display = 'none';
            document.getElementById('presencaConfirmada').style.display = 'block';

            if (response.quorumAtingido) {
                document.getElementById('mensagemAguardo').textContent = 'O quórum foi atingido. Você pode votar agora!';
                document.getElementById('botaoVotacao').style.display = 'block';
            } else {
                document.getElementById('mensagemAguardo').textContent = `Aguardando outros participantes... (${response.totalPresentes}/${response.quorumMinimo})`;
            }
        }
    } catch (error) {
        alert(error.message);
    }
}

function iniciarAtualizacaoAutomatica(eventoId) {
    // Atualizar a cada 5 segundos
    intervalAtualizacao = setInterval(async () => {
        await carregarEvento(eventoId);
    }, 5000);
}

function irParaVotacao() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventoId = urlParams.get('evento');
    window.location.href = `/votacao.html?evento=${eventoId}`;
}

// Limpar intervalo ao sair da página
window.addEventListener('beforeunload', () => {
    if (intervalAtualizacao) {
        clearInterval(intervalAtualizacao);
    }
});