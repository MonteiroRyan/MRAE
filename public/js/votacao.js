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
 document.getElementById('infoMunicipio').textContent = usuario.municipio_nome;
 document.getElementById('infoPeso').textContent = usuario.peso;

 await verificarSeJaVotou(usuario.cpf);
});

async function verificarSeJaVotou(cpf) {
 try {
     const response = await request(`/votos/verificar/${limparCPF(cpf)}`);
     
     if (response.jaVotou) {
         document.getElementById('conteudoVotacao').style.display = 'none';
         document.getElementById('votoRegistrado').style.display = 'block';
     }
 } catch (error) {
     console.error('Erro ao verificar voto:', error);
 }
}

async function votar(opcao) {
 if (!confirm(`Confirma seu voto: ${opcao}?\n\nEsta ação não pode ser desfeita!`)) {
     return;
 }

 try {
     const response = await request('/votos', {
         method: 'POST',
         body: JSON.stringify({ 
             voto: opcao,
             sessionId: getSessionId()
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