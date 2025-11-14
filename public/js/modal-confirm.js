// Sistema de Modal de Confirmação Customizado

class ModalConfirm {
 constructor() {
     this.createModalHTML();
     this.setupEventListeners();
 }

 createModalHTML() {
     // Criar estrutura do modal se não existir
     if (document.getElementById('modalConfirmCustom')) return;

     const modalHTML = `
         <div id="modalConfirmCustom" class="modal">
             <div class="modal-content" style="max-width: 500px;">
                 <div class="modal-confirm-header">
                     <i class="fas fa-question-circle" id="modalConfirmIcon"></i>
                     <h2 id="modalConfirmTitle">Confirmação</h2>
                 </div>
                 <div class="modal-confirm-body">
                     <p id="modalConfirmMessage"></p>
                 </div>
                 <div class="form-actions">
                     <button type="button" class="btn btn-secondary" id="modalConfirmCancel">
                         <i class="fas fa-times"></i> Cancelar
                     </button>
                     <button type="button" class="btn btn-primary" id="modalConfirmOk">
                         <i class="fas fa-check"></i> Confirmar
                     </button>
                 </div>
             </div>
         </div>
     `;

     document.body.insertAdjacentHTML('beforeend', modalHTML);

     // Adicionar estilos específicos
     const style = document.createElement('style');
     style.textContent = `
         .modal-confirm-header {
             text-align: center;
             margin-bottom: 1.5rem;
         }

         .modal-confirm-header i {
             font-size: 3rem;
             margin-bottom: 1rem;
             display: block;
         }

         .modal-confirm-header i.fa-question-circle {
             color: var(--warning-color);
         }

         .modal-confirm-header i.fa-exclamation-triangle {
             color: var(--danger-color);
         }

         .modal-confirm-header i.fa-info-circle {
             color: var(--info-color);
         }

         .modal-confirm-header h2 {
             margin: 0;
             font-size: 1.5rem;
             color: var(--dark);
         }

         .modal-confirm-body {
             text-align: center;
             margin-bottom: 1.5rem;
         }

         .modal-confirm-body p {
             font-size: 1.1rem;
             line-height: 1.6;
             color: var(--gray-dark);
             margin: 0;
             white-space: pre-wrap;
         }
     `;
     document.head.appendChild(style);
 }

 setupEventListeners() {
     const modal = document.getElementById('modalConfirmCustom');
     
     // Fechar ao clicar fora
     modal.addEventListener('click', (e) => {
         if (e.target === modal) {
             this.close(false);
         }
     });

     // Esc para fechar
     document.addEventListener('keydown', (e) => {
         if (e.key === 'Escape' && modal.classList.contains('show')) {
             this.close(false);
         }
     });
 }

 show(message, title = 'Confirmação', type = 'question') {
     return new Promise((resolve) => {
         const modal = document.getElementById('modalConfirmCustom');
         const messageEl = document.getElementById('modalConfirmMessage');
         const titleEl = document.getElementById('modalConfirmTitle');
         const iconEl = document.getElementById('modalConfirmIcon');
         const btnOk = document.getElementById('modalConfirmOk');
         const btnCancel = document.getElementById('modalConfirmCancel');

         // Configurar conteúdo
         messageEl.textContent = message;
         titleEl.textContent = title;

         // Configurar ícone e cor
         iconEl.className = 'fas';
         if (type === 'danger') {
             iconEl.classList.add('fa-exclamation-triangle');
             btnOk.className = 'btn btn-danger';
         } else if (type === 'warning') {
             iconEl.classList.add('fa-exclamation-circle');
             btnOk.className = 'btn btn-warning';
         } else if (type === 'info') {
             iconEl.classList.add('fa-info-circle');
             btnOk.className = 'btn btn-primary';
         } else {
             iconEl.classList.add('fa-question-circle');
             btnOk.className = 'btn btn-primary';
         }

         // Mostrar modal
         modal.classList.add('show');

         // Handlers
         const handleOk = () => {
             cleanup();
             resolve(true);
         };

         const handleCancel = () => {
             cleanup();
             resolve(false);
         };

         const cleanup = () => {
             btnOk.removeEventListener('click', handleOk);
             btnCancel.removeEventListener('click', handleCancel);
             modal.classList.remove('show');
         };

         btnOk.addEventListener('click', handleOk);
         btnCancel.addEventListener('click', handleCancel);

         // Focar no botão OK
         setTimeout(() => btnOk.focus(), 100);
     });
 }

 close(result = false) {
     const modal = document.getElementById('modalConfirmCustom');
     modal.classList.remove('show');
     return result;
 }
}

// Instância global
const modalConfirm = new ModalConfirm();

// Função auxiliar para substituir confirm()
async function confirmCustom(message, title = 'Confirmação', type = 'question') {
 return await modalConfirm.show(message, title, type);
}

// Substituir alert() por modal também
class ModalAlert {
 constructor() {
     this.createModalHTML();
 }

 createModalHTML() {
     if (document.getElementById('modalAlertCustom')) return;

     const modalHTML = `
         <div id="modalAlertCustom" class="modal">
             <div class="modal-content" style="max-width: 500px;">
                 <div class="modal-confirm-header">
                     <i class="fas fa-info-circle" id="modalAlertIcon"></i>
                     <h2 id="modalAlertTitle">Informação</h2>
                 </div>
                 <div class="modal-confirm-body">
                     <p id="modalAlertMessage"></p>
                 </div>
                 <div class="form-actions">
                     <button type="button" class="btn btn-primary" id="modalAlertOk" style="width: 100%;">
                         <i class="fas fa-check"></i> OK
                     </button>
                 </div>
             </div>
         </div>
     `;

     document.body.insertAdjacentHTML('beforeend', modalHTML);
 }

 show(message, title = 'Informação', type = 'info') {
     return new Promise((resolve) => {
         const modal = document.getElementById('modalAlertCustom');
         const messageEl = document.getElementById('modalAlertMessage');
         const titleEl = document.getElementById('modalAlertTitle');
         const iconEl = document.getElementById('modalAlertIcon');
         const btnOk = document.getElementById('modalAlertOk');

         messageEl.textContent = message;
         titleEl.textContent = title;

         // Configurar ícone
         iconEl.className = 'fas';
         if (type === 'success') {
             iconEl.classList.add('fa-check-circle');
             iconEl.style.color = 'var(--success-color)';
         } else if (type === 'error') {
             iconEl.classList.add('fa-times-circle');
             iconEl.style.color = 'var(--danger-color)';
         } else if (type === 'warning') {
             iconEl.classList.add('fa-exclamation-triangle');
             iconEl.style.color = 'var(--warning-color)';
         } else {
             iconEl.classList.add('fa-info-circle');
             iconEl.style.color = 'var(--info-color)';
         }

         modal.classList.add('show');

         const handleOk = () => {
             cleanup();
             resolve(true);
         };

         const cleanup = () => {
             btnOk.removeEventListener('click', handleOk);
             modal.classList.remove('show');
         };

         btnOk.addEventListener('click', handleOk);

         // Fechar com Esc
         const handleEsc = (e) => {
             if (e.key === 'Escape') {
                 handleOk();
                 document.removeEventListener('keydown', handleEsc);
             }
         };
         document.addEventListener('keydown', handleEsc);

         setTimeout(() => btnOk.focus(), 100);
     });
 }
}

const modalAlert = new ModalAlert();

async function alertCustom(message, title = 'Informação', type = 'info') {
 return await modalAlert.show(message, title, type);
}