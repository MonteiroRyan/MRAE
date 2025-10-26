function validarCPF(cpf) {
 // Remove caracteres não numéricos
 cpf = cpf.replace(/[^\d]/g, '');

 // Verifica se tem 11 dígitos
 if (cpf.length !== 11) return false;

 // Verifica se todos os dígitos são iguais
 if (/^(\d)\1{10}$/.test(cpf)) return false;

 // Validação do primeiro dígito verificador
 let soma = 0;
 for (let i = 0; i < 9; i++) {
   soma += parseInt(cpf.charAt(i)) * (10 - i);
 }
 let resto = (soma * 10) % 11;
 if (resto === 10 || resto === 11) resto = 0;
 if (resto !== parseInt(cpf.charAt(9))) return false;

 // Validação do segundo dígito verificador
 soma = 0;
 for (let i = 0; i < 10; i++) {
   soma += parseInt(cpf.charAt(i)) * (11 - i);
 }
 resto = (soma * 10) % 11;
 if (resto === 10 || resto === 11) resto = 0;
 if (resto !== parseInt(cpf.charAt(10))) return false;

 return true;
}

module.exports = { validarCPF };