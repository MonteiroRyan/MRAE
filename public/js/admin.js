let municipios = [];
let usuarios = [];
let eventos = [];

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await verificarAutenticacao('ADMIN');
    if (!usuario) return;

    document.getElementById('nomeUsuario').textContent = usuario.nome;

    carregarEventos();
    carregarMunicipios();
    carregarUsuarios();
    
    // Event listeners dos formulários
    document.getElementById('formEvento').addEventListener('submit', salvarEvento);
    document.getElementById('formUsuario').addEventListener('submit', salvarUsuario);
    document.getElementById('formMunicipio').addEventListener('submit', salvarMunicipio);

    // Aplicar máscara de CPF
    const cpfInput = document.getElementById('usuarioCpf');
    aplicarMascaraCPF(cpfInput);
});

// Gerenciamento de Tabs
function mudarTab(tab) {
    // Remover active de todos
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Adicionar active ao selecionado
    event.target.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
}

// === EVENTOS ===

async function carregarEventos() {
    try {
        const response = await request('/eventos');
        eventos = response.eventos;
        renderizarEventos();
    } catch (error) {
        console.error('Erro ao carregar eventos:', error);
        document.getElementById('tabelaEventos').innerHTML = 
            '<tr><td colspan="9" class="error">Erro ao carregar eventos</td></tr>';
    }
}

function renderizarEventos() {
    const tbody = document.getElementById('tabelaEventos');
    
    if (eventos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9">Nenhum evento cadastrado</td></tr>';
        return;
    }

    tbody.innerHTML = eventos.map(e => {
        const dataInicio = new Date(e.data_inicio).toLocaleString('pt-BR', { 
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
        const dataFim = new Date(e.data_fim).toLocaleString('pt-BR', { 
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
        
        let badgeStatus = '';
        let acoes = '';
        
        switch(e.status) {
            case 'RASCUNHO':
                badgeStatus = '<span class="badge badge-info">Rascunho</span>';
                acoes = `
                    <button onclick="iniciarEvento(${e.id})" class="btn btn-sm btn-success" title="Iniciar Evento">
                        <i class="fas fa-play"></i>
                    </button>
                `;
                break;
            case 'AGUARDANDO_QUORUM':
                badgeStatus = '<span class="badge badge-warning">Aguardando Quórum</span>';
                acoes = `
                    <button onclick="encerrarEvento(${e.id})" class="btn btn-sm btn-danger" title="Encerrar">
                        <i class="fas fa-stop"></i>
                    </button>
                `;
                break;
            case 'ATIVO':
                badgeStatus = '<span class="badge badge-success">Ativo</span>';
                acoes = `
                    <button onclick="encerrarEvento(${e.id})" class="btn btn-sm btn-danger" title="Encerrar">
                        <i class="fas fa-stop"></i>
                    </button>
                `;
                break;
            case 'ENCERRADO':
                badgeStatus = '<span class="badge badge-danger">Encerrado</span>';
                acoes = '';
                break;
        }

        return `
            <tr>
                <td>${e.id}</td>
                <td>${e.titulo}</td>
                <td>${dataInicio}</td>
                <td>${dataFim}</td>
                <td>${e.total_participantes || 0}</td>
                <td>${e.total_presentes || 0} / ${e.quorum_minimo}</td>
                <td>${e.total_votos || 0}</td>
                <td>${badgeStatus}</td>
                <td class="table-actions">
                    <button onclick="verDetalhesEvento(${e.id})" class="btn btn-sm btn-secondary" title="Ver Detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${acoes}
                    ${e.status === 'RASCUNHO' ? `
                        <button onclick="deletarEvento(${e.id})" class="btn btn-sm btn-danger" title="Deletar">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

function abrirModalEvento() {
    document.getElementById('tituloModalEvento').innerHTML = '<i class="fas fa-calendar-plus"></i> Novo Evento de Votação';
    document.getElementById('formEvento').reset();
    document.getElementById('eventoId').value = '';
    
    // Configurar data/hora padrão
    const agora = new Date();
    const dataInicio = new Date(agora.getTime() + 60 * 60 * 1000); // +1 hora
    const dataFim = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 dias
    
    document.getElementById('eventoDataInicio').value = dataInicio.toISOString().slice(0, 16);
    document.getElementById('eventoDataFim').value = dataFim.toISOString().slice(0, 16);
    
    carregarUsuariosParaEvento();
    document.getElementById('modalEvento').classList.add('show');
}

function fecharModalEvento() {
    document.getElementById('modalEvento').classList.remove('show');
    document.getElementById('mensagemEvento').style.display = 'none';
}

async function carregarUsuariosParaEvento() {
    const container = document.getElementById('listaParticipantes');
    
    if (usuarios.length === 0) {
        await carregarUsuarios();
    }
    
    const usuariosVotantes = usuarios.filter(u => u.tipo !== 'ADMIN' && u.ativo);
    
    if (usuariosVotantes.length === 0) {
        container.innerHTML = '<p class="info">Nenhum usuário disponível</p>';
        return;
    }
    
    container.innerHTML = usuariosVotantes.map(u => `
        <label style="display: block; margin-bottom: 0.5rem;">
            <input type="checkbox" name="participantes" value="${u.id}" checked>
            ${u.nome} - ${u.municipio_nome || 'N/A'}
        </label>
    `).join('');
}

async function salvarEvento(e) {
    e.preventDefault();

    const titulo = document.getElementById('eventoTitulo').value;
    const descricao = document.getElementById('eventoDescricao').value;
    const data_inicio = document.getElementById('eventoDataInicio').value;
    const data_fim = document.getElementById('eventoDataFim').value;
    const quorum_minimo = parseInt(document.getElementById('eventoQuorum').value);
    
    // Coletar participantes selecionados
    const checkboxes = document.querySelectorAll('input[name="participantes"]:checked');
    const participantes = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (participantes.length === 0) {
        mostrarMensagem('mensagemEvento', 'Selecione pelo menos um participante', 'error');
        return;
    }

    try {
        const response = await request('/eventos', {
            method: 'POST',
            body: JSON.stringify({ 
                titulo, 
                descricao, 
                data_inicio, 
                data_fim, 
                quorum_minimo,
                participantes 
            })
        });

        if (response.success) {
            mostrarMensagem('mensagemEvento', response.message, 'success');
            setTimeout(() => {
                fecharModalEvento();
                carregarEventos();
            }, 1500);
        }
    } catch (error) {
        mostrarMensagem('mensagemEvento', error.message, 'error');
    }
}

async function iniciarEvento(id) {
    if (!confirm('Deseja iniciar este evento? Participantes poderão confirmar presença.')) return;

    try {
        const response = await request(`/eventos/${id}/iniciar`, {
            method: 'POST'
        });

        if (response.success) {
            alert(response.message);
            carregarEventos();
        }
    } catch (error) {
        alert(error.message);
    }
}

async function encerrarEvento(id) {
    if (!confirm('Deseja encerrar este evento? Esta ação não pode ser desfeita.')) return;

    try {
        const response = await request(`/eventos/${id}/encerrar`, {
            method: 'POST'
        });

        if (response.success) {
            alert(response.message);
            carregarEventos();
        }
    } catch (error) {
        alert(error.message);
    }
}

async function deletarEvento(id) {
    if (!confirm('Tem certeza que deseja deletar este evento?')) return;

    try {
        const response = await request(`/eventos/${id}`, {
            method: 'DELETE'
        });

        if (response.success) {
            alert(response.message);
            carregarEventos();
        }
    } catch (error) {
        alert(error.message);
    }
}

async function verDetalhesEvento(id) {
    try {
        const response = await request(`/eventos/${id}`);
        const evento = response.evento;
        
        const dataInicio = new Date(evento.data_inicio).toLocaleString('pt-BR');
        const dataFim = new Date(evento.data_fim).toLocaleString('pt-BR');
        
        const presentes = evento.participantes.filter(p => p.presente);
        const ausentes = evento.participantes.filter(p => !p.presente);
        
        const conteudo = `
            <div style="margin-bottom: 1.5rem;">
                <h3 style="color: var(--primary-color); margin-bottom: 1rem;">${evento.titulo}</h3>
                <p><strong>Descrição:</strong> ${evento.descricao || 'Sem descrição'}</p>
                <p><strong>Status:</strong> ${evento.status}</p>
                <p><strong>Data Início:</strong> ${dataInicio}</p>
                <p><strong>Data Fim:</strong> ${dataFim}</p>
                <p><strong>Quórum Mínimo:</strong> ${evento.quorum_minimo}</p>
                <p><strong>Criado por:</strong> ${evento.criador_nome}</p>
            </div>

            <h4 style="color: var(--success-color); margin-bottom: 0.5rem;">
                <i class="fas fa-user-check"></i> Presentes (${presentes.length})
            </h4>
            <ul style="list-style: none; padding: 0; margin-bottom: 1.5rem;">
                ${presentes.length > 0 
                    ? presentes.map(p => `<li style="padding: 0.5rem; background: var(--success-light); margin-bottom: 0.25rem; border-radius: var(--radius);">
                        <i class="fas fa-check-circle" style="color: var(--success-color);"></i> ${p.nome} - ${p.municipio_nome || 'N/A'}
                    </li>`).join('')
                    : '<li>Nenhum participante presente ainda</li>'
                }
            </ul>

            <h4 style="color: var(--danger-color); margin-bottom: 0.5rem;">
                <i class="fas fa-user-times"></i> Ausentes (${ausentes.length})
            </h4>
            <ul style="list-style: none; padding: 0;">
                ${ausentes.length > 0 
                    ? ausentes.map(p => `<li style="padding: 0.5rem; background: var(--light); margin-bottom: 0.25rem; border-radius: var(--radius);">
                        <i class="fas fa-times-circle" style="color: var(--danger-color);"></i> ${p.nome} - ${p.municipio_nome || 'N/A'}
                    </li>`).join('')
                    : '<li>Todos confirmaram presença</li>'
                }
            </ul>
        `;
        
        document.getElementById('conteudoDetalhesEvento').innerHTML = conteudo;
        document.getElementById('modalDetalhesEvento').classList.add('show');
    } catch (error) {
        alert('Erro ao carregar detalhes do evento');
    }
}

function fecharModalDetalhesEvento() {
    document.getElementById('modalDetalhesEvento').classList.remove('show');
}

// === USUÁRIOS ===

async function carregarUsuarios() {
    try {
        const response = await request('/admin/usuarios');
        usuarios = response.usuarios;
        renderizarUsuarios();
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        document.getElementById('tabelaUsuarios').innerHTML = 
            '<tr><td colspan="7" class="error">Erro ao carregar usuários</td></tr>';
    }
}

function renderizarUsuarios() {
    const tbody = document.getElementById('tabelaUsuarios');
    
    if (usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">Nenhum usuário cadastrado</td></tr>';
        return;
    }

    tbody.innerHTML = usuarios.map(u => `
        <tr>
            <td>${formatarCPF(u.cpf)}</td>
            <td>${u.nome}</td>
            <td>${u.tipo}</td>
            <td>${u.municipio_nome || '-'}</td>
            <td>${u.peso || '-'}</td>
            <td>
                <span class="badge ${u.ativo ? 'badge-success' : 'badge-danger'}">
                    ${u.ativo ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td class="table-actions">
                <button onclick="editarUsuario(${u.id})" class="btn btn-sm btn-secondary">Editar</button>
                <button onclick="deletarUsuario(${u.id})" class="btn btn-sm btn-danger">Deletar</button>
            </td>
        </tr>
    `).join('');
}

function abrirModalUsuario() {
    document.getElementById('tituloModalUsuario').innerHTML = '<i class="fas fa-user-plus"></i> Novo Usuário';
    document.getElementById('formUsuario').reset();
    document.getElementById('usuarioId').value = '';
    document.getElementById('usuarioCpf').disabled = false;
    document.getElementById('usuarioAtivo').checked = true;
    document.getElementById('usuarioSenha').required = false;
    
    carregarMunicipiosSelect();
    toggleCamposUsuario();
    
    document.getElementById('modalUsuario').classList.add('show');
}

function fecharModalUsuario() {
    document.getElementById('modalUsuario').classList.remove('show');
    document.getElementById('mensagemUsuario').style.display = 'none';
}

function toggleCamposUsuario() {
    const tipo = document.getElementById('usuarioTipo').value;
    const grupoSenha = document.getElementById('grupoSenha');
    const grupoMunicipio = document.getElementById('grupoMunicipio');
    const inputSenha = document.getElementById('usuarioSenha');
    const selectMunicipio = document.getElementById('usuarioMunicipio');
    
    if (tipo === 'ADMIN') {
        grupoSenha.style.display = 'block';
        inputSenha.required = !document.getElementById('usuarioId').value; // Obrigatório apenas ao criar
        grupoMunicipio.style.display = 'none';
        selectMunicipio.required = false;
    } else {
        grupoSenha.style.display = 'none';
        inputSenha.required = false;
        grupoMunicipio.style.display = 'block';
        selectMunicipio.required = true;
    }
}

async function carregarMunicipiosSelect() {
    if (municipios.length === 0) {
        await carregarMunicipios();
    }
    
    const select = document.getElementById('usuarioMunicipio');
    select.innerHTML = '<option value="">Selecione...</option>' +
        municipios.map(m => `<option value="${m.id}">${m.nome} (Peso: ${m.peso})</option>`).join('');
}

function editarUsuario(id) {
    const usuario = usuarios.find(u => u.id === id);
    if (!usuario) return;

    document.getElementById('tituloModalUsuario').innerHTML = '<i class="fas fa-user-edit"></i> Editar Usuário';
    document.getElementById('usuarioId').value = usuario.id;
    document.getElementById('usuarioCpf').value = formatarCPF(usuario.cpf);
    document.getElementById('usuarioCpf').disabled = true;
    document.getElementById('usuarioNome').value = usuario.nome;
    document.getElementById('usuarioTipo').value = usuario.tipo;
    document.getElementById('usuarioAtivo').checked = usuario.ativo;
    
    carregarMunicipiosSelect().then(() => {
        if (usuario.municipio_id) {
            document.getElementById('usuarioMunicipio').value = usuario.municipio_id;
        }
    });
    
    toggleCamposUsuario();
    
    const senhaInput = document.getElementById('usuarioSenha');
    senhaInput.required = false;
    senhaInput.placeholder = 'Deixe em branco para manter';
    
    document.getElementById('modalUsuario').classList.add('show');
}

async function salvarUsuario(e) {
    e.preventDefault();

    const id = document.getElementById('usuarioId').value;
    const cpf = limparCPF(document.getElementById('usuarioCpf').value);
    const nome = document.getElementById('usuarioNome').value;
    const senha = document.getElementById('usuarioSenha').value;
    const tipo = document.getElementById('usuarioTipo').value;
    const municipio_id = document.getElementById('usuarioMunicipio').value || null;
    const ativo = document.getElementById('usuarioAtivo').checked;

    try {
        let response;
        
        if (id) {
            // Atualizar
            const dados = { nome, tipo, municipio_id, ativo };
            if (senha && tipo === 'ADMIN') dados.senha = senha;
            
            response = await request(`/admin/usuarios/${id}`, {
                method: 'PUT',
                body: JSON.stringify(dados)
            });
        } else {
            // Criar
            if (tipo === 'ADMIN' && !senha) {
                mostrarMensagem('mensagemUsuario', 'Senha é obrigatória para administradores', 'error');
                return;
            }
            
            response = await request('/admin/usuarios', {
                method: 'POST',
                body: JSON.stringify({ cpf, nome, senha, tipo, municipio_id })
            });
        }

        if (response.success) {
            mostrarMensagem('mensagemUsuario', response.message, 'success');
            setTimeout(() => {
                fecharModalUsuario();
                carregarUsuarios();
            }, 1500);
        }
    } catch (error) {
        mostrarMensagem('mensagemUsuario', error.message, 'error');
    }
}

async function deletarUsuario(id) {
    if (!confirm('Tem certeza que deseja deletar este usuário?')) return;

    try {
        const response = await request(`/admin/usuarios/${id}`, {
            method: 'DELETE'
        });

        if (response.success) {
            alert(response.message);
            carregarUsuarios();
        }
    } catch (error) {
        alert(error.message);
    }
}

// === MUNICÍPIOS ===

async function carregarMunicipios() {
    try {
        const response = await request('/admin/municipios');
        municipios = response.municipios;
        renderizarMunicipios();
    } catch (error) {
        console.error('Erro ao carregar municípios:', error);
        document.getElementById('tabelaMunicipios').innerHTML = 
            '<tr><td colspan="3" class="error">Erro ao carregar municípios</td></tr>';
    }
}

function renderizarMunicipios() {
    const tbody = document.getElementById('tabelaMunicipios');
    
    if (municipios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">Nenhum município cadastrado</td></tr>';
        return;
    }

    tbody.innerHTML = municipios.map(m => `
        <tr>
            <td>${m.nome}</td>
            <td>${m.peso}</td>
            <td class="table-actions">
                <button onclick="editarMunicipio(${m.id})" class="btn btn-sm btn-secondary">Editar</button>
                <button onclick="deletarMunicipio(${m.id})" class="btn btn-sm btn-danger">Deletar</button>
            </td>
        </tr>
    `).join('');
}

function abrirModalMunicipio() {
    document.getElementById('tituloModalMunicipio').innerHTML = '<i class="fas fa-city"></i> Novo Município';
    document.getElementById('formMunicipio').reset();
    document.getElementById('municipioId').value = '';
    document.getElementById('modalMunicipio').classList.add('show');
}

function fecharModalMunicipio() {
    document.getElementById('modalMunicipio').classList.remove('show');
    document.getElementById('mensagemMunicipio').style.display = 'none';
}

function editarMunicipio(id) {
    const municipio = municipios.find(m => m.id === id);
    if (!municipio) return;

    document.getElementById('tituloModalMunicipio').innerHTML = '<i class="fas fa-city"></i> Editar Município';
    document.getElementById('municipioId').value = municipio.id;
    document.getElementById('municipioNome').value = municipio.nome;
    document.getElementById('municipioPeso').value = municipio.peso;
    
    document.getElementById('modalMunicipio').classList.add('show');
}

async function salvarMunicipio(e) {
    e.preventDefault();

    const id = document.getElementById('municipioId').value;
    const nome = document.getElementById('municipioNome').value;
    const peso = parseFloat(document.getElementById('municipioPeso').value);

    try {
        let response;
        
        if (id) {
            response = await request(`/admin/municipios/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ nome, peso })
            });
        } else {
            response = await request('/admin/municipios', {
                method: 'POST',
                body: JSON.stringify({ nome, peso })
            });
        }

        if (response.success) {
            mostrarMensagem('mensagemMunicipio', response.message, 'success');
            setTimeout(() => {
                fecharModalMunicipio();
                carregarMunicipios();
            }, 1500);
        }
    } catch (error) {
        mostrarMensagem('mensagemMunicipio', error.message, 'error');
    }
}

async function deletarMunicipio(id) {
    if (!confirm('Tem certeza que deseja deletar este município?')) return;

    try {
        const response = await request(`/admin/municipios/${id}`, {
            method: 'DELETE'
        });

        if (response.success) {
            alert(response.message);
            carregarMunicipios();
        }
    } catch (error) {
        alert(error.message);
    }
}