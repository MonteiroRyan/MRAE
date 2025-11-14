let eventoAtual = null;
let votosSelecionados = [];

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await verificarAutenticacao();
    if (!usuario) return;

    if (usuario.tipo === 'ADMIN') {
        await alertCustom('Administradores não podem votar', 'Acesso Negado', 'error');
        window.location.href = '/admin.html';
        return;
    }

    document.getElementById('nomeUsuario').textContent = usuario.nome;
    document.getElementById('infoNome').textContent = usuario.nome;
    document.getElementById('infoCpf').textContent = formatarCPF(usuario.cpf);
    document.getElementById('infoMunicipio').textContent = usuario.municipio_nome || 'N/A';
    document.getElementById('infoPeso').textContent = usuario.peso || 'N/A';

    const urlParams = new URLSearchParams(window.location.search);
    const eventoId = urlParams.get('evento');

    if (!eventoId) {
        await alertCustom('Evento não especificado', 'Erro', 'error');
        window.location.href = '/eventos.html';
        return;
    }

    await carregarEvento(eventoId);
    await verificarSeJaVotou(eventoId);
});

async function carregarEvento(eventoId) {
    try {
        console.log('Carregando evento:', eventoId);
        const response = await request(`/eventos/${eventoId}`);
        console.log('Resposta do evento:', response);
        
        if (!response.success || !response.evento) {
            throw new Error('Resposta inválida do servidor');
        }
        
        eventoAtual = response.evento;
        
        document.getElementById('infoEvento').textContent = eventoAtual.titulo;

        // Verificar período
        if (eventoAtual.periodo_status === 'ANTES_PERIODO') {
            await alertCustom(
                `Este evento ainda não iniciou.\n\nData de início: ${new Date(eventoAtual.data_inicio).toLocaleString('pt-BR')}`,
                'Evento Não Iniciado',
                'warning'
            );
            window.location.href = '/eventos.html';
            return;
        }

        if (eventoAtual.periodo_status === 'APOS_PERIODO') {
            await alertCustom(
                `Este evento já encerrou.\n\nData de fim: ${new Date(eventoAtual.data_fim).toLocaleString('pt-BR')}`,
                'Evento Encerrado',
                'warning'
            );
            window.location.href = '/eventos.html';
            return;
        }

        // Verificar se evento está ativo
        console.log('Status do evento:', eventoAtual.status);
        if (eventoAtual.status !== 'ATIVO') {
            await alertCustom(
                'A votação ainda não foi liberada pelo administrador.\n\nAguarde a liberação para votar.',
                'Votação Não Liberada',
                'warning'
            );
            window.location.href = `/eventos.html`;
            return;
        }

        const usuario = getUsuario();
        console.log('Usuário atual:', usuario);
        
        const participante = eventoAtual.participantes.find(p => p.usuario_id === usuario.id);
        console.log('Participante encontrado:', participante);
        
        if (!participante) {
            await alertCustom(
                'Você não está cadastrado neste evento',
                'Acesso Negado',
                'error'
            );
            window.location.href = `/eventos.html`;
            return;
        }
        
        if (!participante.presente) {
            await alertCustom(
                'Sua presença não foi confirmada automaticamente.\n\nContate o administrador.',
                'Presença Necessária',
                'warning'
            );
            window.location.href = `/eventos.html`;
            return;
        }

        console.log('Opções de votação:', eventoAtual.opcoes_votacao);
        console.log('Tipo de votação:', eventoAtual.tipo_votacao);
        console.log('Votação múltipla:', eventoAtual.votacao_multipla);
        console.log('Votos máximos:', eventoAtual.votos_maximos);
        
        if (!eventoAtual.opcoes_votacao || eventoAtual.opcoes_votacao.length === 0) {
            console.error('Opções de votação não disponíveis');
            
            switch(eventoAtual.tipo_votacao) {
                case 'BINARIO':
                    eventoAtual.opcoes_votacao = ['Sim', 'Não'];
                    break;
                case 'APROVACAO':
                    eventoAtual.opcoes_votacao = ['Aprovar', 'Reprovar', 'Abstenção'];
                    break;
                case 'SIM_NAO':
                    eventoAtual.opcoes_votacao = ['SIM', 'NÃO', 'ABSTENÇÃO', 'AUSENTE'];
                    break;
                case 'ALTERNATIVAS':
                    eventoAtual.opcoes_votacao = ['Voto em Branco', 'Nenhuma das alternativas'];
                    break;
                default:
                    eventoAtual.opcoes_votacao = [];
            }
            
            console.log('Opções padrão definidas:', eventoAtual.opcoes_votacao);
        }

        renderizarOpcoesVoto();

    } catch (error) {
        console.error('Erro ao carregar evento:', error);
        await alertCustom(
            'Erro ao carregar evento:\n\n' + error.message,
            'Erro',
            'error'
        );
        window.location.href = '/eventos.html';
    }
}

function renderizarOpcoesVoto() {
    const container = document.getElementById('opcoesVoto');
    
    if (!eventoAtual || !eventoAtual.opcoes_votacao) {
        container.innerHTML = '<p class="error">Erro: Opções de votação não disponíveis</p>';
        return;
    }

    let opcoes;
    
    if (Array.isArray(eventoAtual.opcoes_votacao)) {
        opcoes = eventoAtual.opcoes_votacao;
    } else if (typeof eventoAtual.opcoes_votacao === 'string') {
        try {
            opcoes = JSON.parse(eventoAtual.opcoes_votacao);
        } catch (e) {
            console.error('Erro ao fazer parse das opções:', e);
            opcoes = eventoAtual.opcoes_votacao.split(',').map(s => s.trim()).filter(s => s);
        }
    } else {
        console.error('Tipo de opções inválido:', typeof eventoAtual.opcoes_votacao);
        opcoes = [];
    }

    console.log('Opções a renderizar:', opcoes);
    
    if (opcoes.length === 0) {
        container.innerHTML = '<p class="error">Erro: Nenhuma opção de votação disponível</p>';
        return;
    }

    const isMultipla = eventoAtual.votacao_multipla === 1 || eventoAtual.votacao_multipla === true;
    const maxVotos = eventoAtual.votos_maximos || 1;

    // Atualizar instruções
    if (isMultipla) {
        document.getElementById('instrucaoVoto').innerHTML = `
            <i class="fas fa-info-circle"></i> <strong>Votação Múltipla:</strong> 
            Você pode selecionar até <strong>${maxVotos}</strong> opção(ões).
            <br>
            <i class="fas fa-exclamation-triangle"></i> <strong>ATENÇÃO:</strong> Apenas 1 voto por município.
        `;
    }
    
    // Renderizar como checkboxes (votação múltipla) ou radio buttons (única)
    if (isMultipla && eventoAtual.tipo_votacao === 'ALTERNATIVAS') {
        container.innerHTML = `
            <div class="opcoes-checkbox-list">
                ${opcoes.map((opcao, index) => `
                    <label class="opcao-checkbox-item">
                        <input type="checkbox" name="voto" value="${opcao}" onchange="atualizarSelecao('${opcao}', ${maxVotos})">
                        <span class="checkbox-custom"></span>
                        <span class="opcao-texto">${opcao}</span>
                    </label>
                `).join('')}
            </div>
            <div style="margin-top: 2rem; text-align: center;">
                <button onclick="confirmarVotosMultiplos()" class="btn btn-success" style="font-size: 1.2rem; padding: 1rem 3rem;">
                    <i class="fas fa-check"></i> Confirmar Voto
                </button>
            </div>
            <p id="contadorVotos" style="text-align: center; margin-top: 1rem; color: var(--gray-dark);">
                <i class="fas fa-vote-yea"></i> 0 de ${maxVotos} opções selecionadas
            </p>
        `;
    } else {
        // Votação única (botões tradicionais)
        const emojiMap = {
            'Sim': '✅',
            'Não': '❌',
            'SIM': '✅',
            'NÃO': '❌',
            'ABSTENÇÃO': '⚪',
            'AUSENTE': '🚫',
            'Aprovar': '👍',
            'Reprovar': '👎',
            'Abstenção': '⚪',
            'Voto em Branco': '⬜',
            'Nenhuma das alternativas': '🚫'
        };

        const classeMap = {
            'Sim': 'btn-sim',
            'Não': 'btn-nao',
            'SIM': 'btn-sim',
            'NÃO': 'btn-nao',
            'ABSTENÇÃO': 'btn-abstencao',
            'AUSENTE': 'btn-ausente',
            'Aprovar': 'btn-sim',
            'Reprovar': 'btn-nao',
            'Abstenção': 'btn-abstencao',
            'Voto em Branco': 'btn-abstencao',
            'Nenhuma das alternativas': 'btn-ausente'
        };

        container.innerHTML = opcoes.map(opcao => {
            const emoji = emojiMap[opcao] || '📋';
            const classe = classeMap[opcao] || 'btn-voto';
            
            return `
                <button onclick="votar(['${opcao.replace(/'/g, "\\\'")}''])" class="btn-voto ${classe}">
                    <span class="emoji">${emoji}</span>
                    <span>${opcao}</span>
                </button>
            `;
        }).join('');
    }
}

function atualizarSelecao(opcao, maxVotos) {
    const checkbox = document.querySelector(`input[value="${opcao}"]`);
    
    if (checkbox.checked) {
        if (votosSelecionados.length >= maxVotos) {
            checkbox.checked = false;
            alertCustom(
                `Você pode selecionar no máximo ${maxVotos} opção(ões)`,
                'Limite Atingido',
                'warning'
            );
            return;
        }
        votosSelecionados.push(opcao);
    } else {
        votosSelecionados = votosSelecionados.filter(v => v !== opcao);
    }

    // Atualizar contador
    document.getElementById('contadorVotos').innerHTML = `
        <i class="fas fa-vote-yea"></i> ${votosSelecionados.length} de ${maxVotos} opções selecionadas
    `;
}

async function confirmarVotosMultiplos() {
    if (votosSelecionados.length === 0) {
        await alertCustom(
            'Selecione pelo menos uma opção para votar',
            'Nenhuma Opção Selecionada',
            'warning'
        );
        return;
    }

    await votar(votosSelecionados);
}

async function verificarSeJaVotou(eventoId) {
    try {
        console.log('Verificando se já votou no evento:', eventoId);
        const response = await request(`/votos/verificar/${eventoId}`);
        console.log('Resposta verificação voto:', response);
        
        if (response.jaVotou) {
            document.getElementById('conteudoVotacao').style.display = 'none';
            document.getElementById('votoRegistrado').style.display = 'block';
            
            let mensagem = `Seu município já votou neste evento.<br><strong>Voto registrado por:</strong> ${response.votante}`;
            
            if (response.quantidadeVotos > 1) {
                mensagem += `<br><strong>Quantidade de votos:</strong> ${response.quantidadeVotos}`;
            }
            
            document.getElementById('votoRegistrado').querySelector('.success-message p').innerHTML = mensagem;
        }
    } catch (error) {
        console.error('Erro ao verificar voto:', error);
    }
}

async function votar(votosArray) {
    const urlParams = new URLSearchParams(window.location.search);
    const eventoId = urlParams.get('evento');

    console.log('Tentando votar:', votosArray, 'no evento:', eventoId);

    const mensagemConfirmacao = votosArray.length > 1
        ? `Confirma seus ${votosArray.length} votos?\n\n${votosArray.map((v, i) => `${i + 1}. ${v}`).join('\n')}\n\nATENÇÃO: Apenas 1 voto por município!\nEsta ação não pode ser desfeita!`
        : `Confirma seu voto: ${votosArray[0]}?\n\nATENÇÃO: Apenas 1 voto por município!\nEsta ação não pode ser desfeita!`;

    const confirmar = await confirmCustom(
        mensagemConfirmacao,
        'Confirmar Voto',
        'warning'
    );

    if (!confirmar) return;

    try {
        const response = await request('/votos', {
            method: 'POST',
            body: JSON.stringify({ 
                votos: votosArray,
                evento_id: eventoId
            })
        });

        console.log('Resposta do voto:', response);

        if (response.success) {
            document.getElementById('conteudoVotacao').style.display = 'none';
            document.getElementById('votoRegistrado').style.display = 'block';
            
            await alertCustom(
                response.message,
                'Voto Confirmado',
                'success'
            );
        }
    } catch (error) {
        console.error('Erro ao votar:', error);
        mostrarMensagem('mensagem', error.message, 'error');
        await alertCustom(error.message, 'Erro ao Votar', 'error');
    }
}

function verResultados() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventoId = urlParams.get('evento');
    window.location.href = `/resultados.html?evento=${eventoId}`;
}