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

async function handleLogin(e) {
 e.preventDefault();

 const cpf = limparCPF(document.getElementById('cpf').value);
 const senha = document.getElementById('senha').value;

 if (!cpf || !senha) {
     mostrarMensagem('mensagem', 'Por favor, preencha todos os campos', 'error');
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
     mostrarMensagem('mensagem', error.message, 'error');
 }
}

function redirecionarPorTipo(tipo) {
 if (tipo === 'ADMIN') {
     window.location.href = '/admin.html';
 } else {
     window.location.href = '/votacao.html';
 }
}