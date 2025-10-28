document.addEventListener('DOMContentLoaded', () => {
    // Aplicar máscara de CPF
    const cpfInput = document.getElementById('cpf');
    aplicarMascaraCPF(cpfInput);

    // Verificar se já está logado
    const sessionId = getSessionId();
    if (sessionId) {
        verificarSessaoExistente();
    }

    // Form de login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Mostrar/ocultar campo de senha baseado no tipo de usuário
    cpfInput.addEventListener('blur', verificarTipoUsuario);
});

async function verificarSessaoExistente() {
    try {
        const response = await request('/auth/verify', {
            method: 'POST',
            body: JSON.stringify({ sessionId: getSessionId() })
        });

        if (response.success) {
            redirecionarPorTipo(response.usuario.tipo);
        }
    } catch (error) {
        clearSession();
    }
}

async function verificarTipoUsuario() {
    const cpf = limparCPF(document.getElementById('cpf').value);
    
    if (!cpf || cpf.length !== 11) {
        return;
    }

    // Por padrão, ocultar senha (será usado para prefeitos/representantes)
    document.getElementById('senhaGroup').style.display = 'none';
    document.getElementById('senha').required = false;
}

async function handleLogin(e) {
    e.preventDefault();

    const cpf = limparCPF(document.getElementById('cpf').value);
    const senha = document.getElementById('senha').value;

    if (!cpf) {
        mostrarMensagem('mensagem', 'Por favor, preencha o CPF', 'error');
        return;
    }

    try {
        const response = await request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ cpf, senha })
        });

        if (response.success) {
            setSessionId(response.sessionId);
            setUsuario(response.usuario);
            mostrarMensagem('mensagem', 'Login realizado com sucesso!', 'success');
            
            setTimeout(() => {
                redirecionarPorTipo(response.usuario.tipo);
            }, 1000);
        }
    } catch (error) {
        // Se erro menciona senha, mostrar campo de senha
        if (error.message.includes('Senha') || error.message.includes('senha')) {
            document.getElementById('senhaGroup').style.display = 'block';
            document.getElementById('senha').required = true;
        }
        mostrarMensagem('mensagem', error.message, 'error');
    }
}

function redirecionarPorTipo(tipo) {
    if (tipo === 'ADMIN') {
        window.location.href = '/admin.html';
    } else {
        // Redirecionar para lista de eventos disponíveis
        window.location.href = '/eventos.html';
    }
}