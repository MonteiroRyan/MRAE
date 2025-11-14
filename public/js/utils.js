const API_URL = window.location.origin + '/api';

// Incluir script de modais
(function() {
    const script = document.createElement('script');
    script.src = '/js/modal-confirm.js';
    document.head.appendChild(script);
})();

// Função para fazer requisições à API
async function request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        }
    };

    const sessionId = getSessionId();
    if (sessionId) {
        defaultOptions.headers['X-Session-ID'] = sessionId;
    }

    const config = { ...defaultOptions, ...options };

    console.log('Request:', url, config);

    try {
        const response = await fetch(url, config);
        
        console.log('Response status:', response.status);
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Resposta não-JSON:', text);
            throw new Error('Resposta inválida do servidor');
        }

        const data = await response.json();
        console.log('Response data:', data);

        if (!response.ok) {
            throw new Error(data.message || 'Erro na requisição');
        }

        return data;
    } catch (error) {
        console.error('Erro na requisição:', error);
        throw error;
    }
}

// Verificar autenticação
async function verificarAutenticacao(tipoRequerido = null) {
    const sessionId = getSessionId();
    
    if (!sessionId) {
        window.location.href = '/';
        return null;
    }

    try {
        const response = await request('/auth/verify', {
            method: 'POST',
            body: JSON.stringify({ sessionId })
        });

        if (!response.success) {
            clearSession();
            window.location.href = '/';
            return null;
        }

        if (tipoRequerido && response.usuario.tipo !== tipoRequerido) {
            await alertCustom('Acesso negado. Você não tem permissão para acessar esta página.', 'Acesso Negado', 'error');
            window.location.href = '/';
            return null;
        }

        return response.usuario;
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        clearSession();
        window.location.href = '/';
        return null;
    }
}

// Gerenciar sessão
function setSessionId(sessionId) {
    localStorage.setItem('sessionId', sessionId);
}

function getSessionId() {
    return localStorage.getItem('sessionId');
}

function setUsuario(usuario) {
    localStorage.setItem('usuario', JSON.stringify(usuario));
}

function getUsuario() {
    const usuario = localStorage.getItem('usuario');
    return usuario ? JSON.parse(usuario) : null;
}

function clearSession() {
    localStorage.removeItem('sessionId');
    localStorage.removeItem('usuario');
}

// Logout
async function logout() {
    const confirmar = await confirmCustom(
        'Deseja realmente sair do sistema?',
        'Confirmar Logout',
        'question'
    );

    if (!confirmar) return;

    const sessionId = getSessionId();
    
    try {
        await request('/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ sessionId })
        });
    } catch (error) {
        console.error('Erro no logout:', error);
    }
    
    clearSession();
    window.location.href = '/';
}

// Formatação de CPF
function formatarCPF(cpf) {
    if (!cpf) return '';
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function limparCPF(cpf) {
    return cpf.replace(/\D/g, '');
}

function aplicarMascaraCPF(input) {
    input.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.length > 11) {
            value = value.substring(0, 11);
        }
        
        if (value.length >= 10) {
            value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        } else if (value.length >= 7) {
            value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
        } else if (value.length >= 4) {
            value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
        }
        
        e.target.value = value;
    });
}

// Validação de CPF
function validarCPF(cpf) {
    const cleaned = cpf.replace(/\D/g, '');
    
    if (cleaned.length !== 11) return false;
    
    if (/^(\d)\1+$/.test(cleaned)) return false;
    
    let sum = 0;
    let remainder;
    
    for (let i = 1; i <= 9; i++) {
        sum += parseInt(cleaned.substring(i - 1, i)) * (11 - i);
    }
    
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleaned.substring(9, 10))) return false;
    
    sum = 0;
    for (let i = 1; i <= 10; i++) {
        sum += parseInt(cleaned.substring(i - 1, i)) * (12 - i);
    }
    
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleaned.substring(10, 11))) return false;
    
    return true;
}

// Mostrar mensagens
function mostrarMensagem(elementId, mensagem, tipo) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.className = `mensagem ${tipo}`;
    element.textContent = mensagem;
    element.style.display = 'block';
    
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}