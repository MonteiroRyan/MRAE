// Configuração da API
const API_URL = 'http://localhost:3000/api';

// Gerenciamento de sessão
function getSessionId() {
    return localStorage.getItem('sessionId');
}

function setSessionId(sessionId) {
    localStorage.setItem('sessionId', sessionId);
}

function clearSession() {
    localStorage.removeItem('sessionId');
    localStorage.removeItem('usuario');
}

function getUsuario() {
    const usuario = localStorage.getItem('usuario');
    return usuario ? JSON.parse(usuario) : null;
}

function setUsuario(usuario) {
    localStorage.setItem('usuario', JSON.stringify(usuario));
}

// Requisições HTTP
async function request(endpoint, options = {}) {
    const sessionId = getSessionId();
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(sessionId && { 'X-Session-ID': sessionId }),
            ...options.headers
        },
        ...options
    };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erro na requisição');
        }

        return data;
    } catch (error) {
        console.error('Erro na requisição:', error);
        throw error;
    }
}

// Formatação de CPF
function formatarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
    cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
    cpf = cpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return cpf;
}

// Remover formatação de CPF
function limparCPF(cpf) {
    return cpf.replace(/\D/g, '');
}

// Logout
async function logout() {
    try {
        const sessionId = getSessionId();
        if (sessionId) {
            await request('/auth/logout', {
                method: 'POST',
                body: JSON.stringify({ sessionId })
            });
        }
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    } finally {
        clearSession();
        window.location.href = '/index.html';
    }
}

// Verificar autenticação
async function verificarAutenticacao(tipoRequerido = null) {
    const sessionId = getSessionId();
    
    if (!sessionId) {
        window.location.href = '/index.html';
        return null;
    }

    try {
        const response = await request('/auth/verify', {
            method: 'POST',
            body: JSON.stringify({ sessionId })
        });

        if (response.success) {
            setUsuario(response.usuario);
            
            // Verificar tipo de usuário
            if (tipoRequerido && response.usuario.tipo !== tipoRequerido) {
                alert('Acesso negado');
                logout();
                return null;
            }
            
            return response.usuario;
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        clearSession();
        window.location.href = '/index.html';
        return null;
    }
}

// Mostrar mensagem
function mostrarMensagem(elementoId, mensagem, tipo = 'success') {
    const elemento = document.getElementById(elementoId);
    if (elemento) {
        elemento.textContent = mensagem;
        elemento.className = `mensagem ${tipo}`;
        elemento.style.display = 'block';
        
        setTimeout(() => {
            elemento.style.display = 'none';
        }, 5000);
    }
}

// Formatação de data
function formatarData(data) {
    return new Date(data).toLocaleString('pt-BR');
}

// Aplicar máscara de CPF em input
function aplicarMascaraCPF(input) {
    input.addEventListener('input', function(e) {
        e.target.value = formatarCPF(e.target.value);
    });
}