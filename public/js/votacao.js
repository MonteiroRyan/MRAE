let eventoAtual = null;

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await verificarAutenticacao();
    if (!usuario) return;

    if (usuario.tipo === 'ADMIN') {
        alert('Administradores não podem votar');
        window.location.href = '/admin.html';
        return;
    }

    document.getElementById('nomeUsuario').textContent = usuario.nome;
    document.getElementById('infoNome').textContent = usuario.nome;
    document.getElementById('infoCpf').textContent = formatarCPF(usuario.cpf);
    document.getElementById('infoMunicipio').textContent = usuario.municipio_nome || 'N/A';
    document.getElementById('infoPeso').textContent = usuario.peso || 'N/A';

    // Obter ID do evento da URL
    const urlParams = new URLSearchParams(window.location.search);
    const eventoId = urlParams.get('evento');

    if (!eventoId) {
        alert('Evento não especificado');
        window.location.href = '/eventos.html';
        return;
    }

    await carregarEvento(eventoId);
    await verificarSeJaVotou(eventoId);
});

async function carregarEvento(eventoId) {
    try {
        const response = await request(`/eventos/${eventoId}`);
        eventoAtual = response.evento;
        
        document.getElementById('infoEvento').textContent = eventoAtual.titulo;

        // Verificar se evento está ativo
        if (eventoAtual.status !== 'ATIVO') {
            alert('Este evento não está ativo para votação');
            window.location.href = '/eventos.html';
            return;
        }

        // Verificar se usuário confirmou presença
        const usuario = getUsuario();
        const participante = eventoAtual.participantes.find(p => p.usuario_id === usuario.id);
        
        if (!participante || !participante.presente) {
            alert('Você precisa confirmar presença antes de votar');
            window.location.href = `/presenca.html?evento=${eventoId}`;
            return;
        }

    } catch (error) {
        console.error('Erro ao carregar evento:', error);
        alert('Erro ao carregar evento');
        window.location.href = '/eventos.html';
    }
}

async function verificarSeJaVotou(eventoId) {
    try {
        const response = await request(`/votos/verificar/${eventoId}`);
        
        if (response.jaVotou) {
            document.getElementById('conteudoVotacao').style.display = 'none';
            document.getElementById('votoRegistrado').style.display = 'block';
        }
    } catch (error) {
        console.error('Erro ao verificar voto:', error);
    }
}

async function votar(opcao) {
    const urlParams = new URLSearchParams(window.location.search);
    const eventoId = urlParams.get('evento');

    if (!confirm(`Confirma seu voto: ${opcao}?\n\nEsta ação não pode ser desfeita!`)) {
        return;
    }

    try {
        const response = await request('/votos', {
            method: 'POST',
            body: JSON.stringify({ 
                voto: opcao,
                evento_id: eventoId
            })
        });

        if (response.success) {
            document.getElementById('conteudoVotacao').style.display = 'none';
            document.getElementById('votoRegistrado').style.display = 'block';
        }
    } catch (error) {
        mostrarMensagem('mensagem', error.message, 'error');
    }
}

function verResultados() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventoId = urlParams.get('evento');
    window.location.href = `/resultados.html?evento=${eventoId}`;
}