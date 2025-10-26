let chartQuantidade, chartPeso;
let eventSource;

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await verificarAutenticacao();
    if (!usuario) return;

    document.getElementById('nomeUsuario').textContent = usuario.nome;

    iniciarStreamResultados();
});

function iniciarStreamResultados() {
    eventSource = new EventSource(`${API_URL}/votos/resultados/stream`);

    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        atualizarResultados(data);
    };

    eventSource.onerror = (error) => {
        console.error('Erro no stream:', error);
        eventSource.close();
        // Tentar reconectar após 5 segundos
        setTimeout(iniciarStreamResultados, 5000);
    };
}

function atualizarResultados(data) {
    // Atualizar estatísticas
    document.getElementById('totalVotos').textContent = data.totais.votosRegistrados;
    document.getElementById('pesoTotal').textContent = data.totais.pesoTotal.toFixed(2);
    document.getElementById('participacao').textContent = data.totais.percentualParticipacao + '%';
    document.getElementById('usuariosCadastrados').textContent = data.totais.usuariosCadastrados;

    // Atualizar tabela
    atualizarTabelaResultados(data.resultados);

    // Atualizar gráficos
    atualizarGraficos(data.resultados);
}

function atualizarTabelaResultados(resultados) {
    const tbody = document.getElementById('tabelaResultados');
    
    const opcoes = {
        'SIM': '✅ SIM',
        'NAO': '❌ NÃO',
        'ABSTENCAO': '⚪ ABSTENÇÃO',
        'AUSENTE': '🚫 AUSENTE'
    };

    tbody.innerHTML = Object.entries(resultados).map(([opcao, dados]) => `
        <tr>
            <td><strong>${opcoes[opcao]}</strong></td>
            <td>${dados.quantidade}</td>
            <td>${dados.percentualQuantidade}%</td>
            <td>${dados.peso.toFixed(2)}</td>
            <td>${dados.percentualPeso}%</td>
        </tr>
    `).join('');
}

function atualizarGraficos(resultados) {
    const labels = ['SIM', 'NÃO', 'ABSTENÇÃO', 'AUSENTE'];
    const quantidades = [
        resultados.SIM.quantidade,
        resultados.NAO.quantidade,
        resultados.ABSTENCAO.quantidade,
        resultados.AUSENTE.quantidade
    ];
    const pesos = [
        resultados.SIM.peso,
        resultados.NAO.peso,
        resultados.ABSTENCAO.peso,
        resultados.AUSENTE.peso
    ];

    const cores = [
        'rgba(16, 185, 129, 0.8)', // Verde
        'rgba(239, 68, 68, 0.8)',  // Vermelho
        'rgba(245, 158, 11, 0.8)', // Amarelo
        'rgba(100, 116, 139, 0.8)' // Cinza
    ];

    // Gráfico de Quantidade
    if (chartQuantidade) {
        chartQuantidade.data.datasets[0].data = quantidades;
        chartQuantidade.update();
    } else {
        const ctx1 = document.getElementById('chartQuantidade').getContext('2d');
        chartQuantidade = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: quantidades,
                    backgroundColor: cores,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + ' votos';
                            }
                        }
                    }
                }
            }
        });
    }

    // Gráfico de Peso
    if (chartPeso) {
        chartPeso.data.datasets[0].data = pesos;
        chartPeso.update();
    } else {
        const ctx2 = document.getElementById('chartPeso').getContext('2d');
        chartPeso = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Peso Total',
                    data: pesos,
                    backgroundColor: cores,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Peso: ' + context.parsed.y.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// Limpar ao sair da página
window.addEventListener('beforeunload', () => {
    if (eventSource) {
        eventSource.close();
    }
});