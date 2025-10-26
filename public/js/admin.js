let municipios = [];
let usuarios = [];

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await verificarAutenticacao('ADMIN');
    if (!usuario) return;

    document.getElementById('nomeUsuario').textContent = usuario.nome;

    carregarMunicipios();
    carregarUsuarios();
    
    // Event listeners dos formulários
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

    // Carregar dados se necessário
    if (tab === 'resultados') {
        carregarResultados();
    }
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
    document.getElementById('tituloModalUsuario').textContent = 'Novo Usuário';
    document.getElementById('formUsuario').reset();
    document.getElementById('usuarioId').value = '';
    document.getElementById('usuarioAtivo').checked = true;
    
    carregarMunicipiosSelect();
    toggleMunicipio();
    
    document.getElementById('modalUsuario').classList.add('show');
}

function fecharModalUsuario() {
    document.getElementById('modalUsuario').classList.remove('show');
    document.getElementById('mensagemUsuario').style.display = 'none';
}

function toggleMunicipio() {
    const tipo = document.getElementById('usuarioTipo').value;
    const grupoMunicipio = document.getElementById('grupoMunicipio');
    const selectMunicipio = document.getElementById('usuarioMunicipio');
    
    if (tipo === 'ADMIN') {
        grupoMunicipio.style.display = 'none';
        selectMunicipio.required = false;
    } else {
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

    document.getElementById('tituloModalUsuario').textContent = 'Editar Usuário';
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
    
    toggleMunicipio();
    
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
            if (senha) dados.senha = senha;
            
            response = await request(`/admin/usuarios/${id}`, {
                method: 'PUT',
                body: JSON.stringify(dados)
            });
        } else {
            // Criar
            if (!senha) {
                mostrarMensagem('mensagemUsuario', 'Senha é obrigatória', 'error');
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
    document.getElementById('tituloModalMunicipio').textContent = 'Novo Município';
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

    document.getElementById('tituloModalMunicipio').textContent = 'Editar Município';
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

// === RESULTADOS ===

async function carregarResultados() {
    const container = document.getElementById('resultadosContainer');
    container.innerHTML = '<p class="loading">Carregando resultados...</p>';

    try {
        const response = await request('/votos/resultados');
        renderizarResultadosAdmin(response);
    } catch (error) {
        container.innerHTML = '<p class="error">Erro ao carregar resultados</p>';
    }
}

function renderizarResultadosAdmin(data) {
    const container = document.getElementById('resultadosContainer');
    
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total de Votos</h3>
                <p class="stat-value">${data.totais.votosRegistrados}</p>
            </div>
            <div class="stat-card">
                <h3>Peso Total</h3>
                <p class="stat-value">${data.totais.pesoTotal.toFixed(2)}</p>
            </div>
            <div class="stat-card">
                <h3>Participação</h3>
                <p class="stat-value">${data.totais.percentualParticipacao}%</p>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Opção</th>
                    <th>Quantidade</th>
                    <th>% Quantidade</th>
                    <th>Peso Total</th>
                    <th>% Peso</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(data.resultados).map(([opcao, dados]) => `
                    <tr>
                        <td><strong>${opcao}</strong></td>
                        <td>${dados.quantidade}</td>
                        <td>${dados.percentualQuantidade}%</td>
                        <td>${dados.peso.toFixed(2)}</td>
                        <td>${dados.percentualPeso}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}