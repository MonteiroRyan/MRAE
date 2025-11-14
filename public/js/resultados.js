let chartBarras;
let eventSource;
let eventoId;

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await verificarAutenticacao();
    if (!usuario) return;

    document.getElementById('nomeUsuario').textContent = usuario.nome;

    const urlParams = new URLSearchParams(window.location.search);
    eventoId = urlParams.get('evento');

    if (!eventoId) {
        await alertCustom('Evento não especificado', 'Erro', 'error');
        window.location.href = '/eventos.html';
        return;
    }

    await carregarTituloEvento();
    iniciarStreamResultados();
});

async function carregarTituloEvento() {
    try {
        const response = await request(`/eventos/${eventoId}`);
        document.getElementById('eventoTitulo').textContent = response.evento.titulo;
        
        const tiposVotacao = {
            'BINARIO': 'Votação Binária',
            'APROVACAO': 'Votação por Aprovação',
            'ALTERNATIVAS': 'Votação por Alternativas',
            'SIM_NAO': 'Votação Sim/Não/Abstenção/Ausente'
        };
        
        let infoExtra = tiposVotacao[response.evento.tipo_votacao] || response.evento.tipo_votacao;
        
        if (response.evento.votacao_multipla) {
            infoExtra += ` (Múltipla escolha - Máx: ${response.evento.votos_maximos})`;
        }
        
        const infoTipo = document.createElement('p');
        infoTipo.className = 'atualizacao';
        infoTipo.style.marginTop = '0.5rem';
        infoTipo.innerHTML = `<i class="fas fa-vote-yea"></i> ${infoExtra}`;
        document.querySelector('.resultados-header').appendChild(infoTipo);
        
    } catch (error) {
        console.error('Erro ao carregar evento:', error);
    }
}

function iniciarStreamResultados() {
    eventSource = new EventSource(`${API_URL}/votos/resultados/${eventoId}/stream`);

    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        atualizarResultados(data);
    };

    eventSource.onerror = (error) => {
        console.error('Erro no stream:', error);
        eventSource.close();
        setTimeout(iniciarStreamResultados, 5000);
    };
}

function atualizarResultados(data) {
    // Atualizar estatísticas
    document.getElementById('totalVotos').textContent = data.totais.votosRegistrados;
    document.getElementById('pesoTotal').textContent = data.totais.pesoTotal.toFixed(2);
    document.getElementById('participacao').textContent = data.totais.percentualParticipacao + '%';
    document.getElementById('totalParticipantes').textContent = data.totais.municipiosParticipantes;

    // Atualizar tabela
    atualizarTabelaResultados(data.resultados, data.opcoes);

    // Atualizar gráfico de barras empilhadas
    atualizarGraficoBarras(data.resultados, data.opcoes);
}

function atualizarTabelaResultados(resultados, opcoes) {
    const tbody = document.getElementById('tabelaResultados');
    
    if (!opcoes || opcoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">Nenhuma opção disponível</td></tr>';
        return;
    }
    
    tbody.innerHTML = opcoes.map(opcao => {
        const dados = resultados[opcao] || { quantidade: 0, peso: 0, percentualQuantidade: 0, percentualPeso: 0 };
        return `
            <tr>
                <td><strong>${opcao}</strong></td>
                <td>${dados.quantidade}</td>
                <td>${dados.percentualQuantidade}%</td>
                <td>${dados.peso.toFixed(2)}</td>
                <td>${dados.percentualPeso}%</td>
            </tr>
        `;
    }).join('');
}

function atualizarGraficoBarras(resultados, opcoes) {
    if (!opcoes || opcoes.length === 0) {
        console.warn('Nenhuma opção disponível para gráfico');
        return;
    }

    // Preparar dados para gráfico de barras empilhadas
    const percentuaisPeso = opcoes.map(opcao => parseFloat(resultados[opcao]?.percentualPeso || 0));
    
    // Cores dinâmicas
    const coresPredefinidas = [
        'rgba(16, 185, 129, 0.8)',   // Verde
        'rgba(239, 68, 68, 0.8)',    // Vermelho
        'rgba(245, 158, 11, 0.8)',   // Amarelo
        'rgba(240, 155, 190, 0.8)',  // Rosa
        'rgba(0, 150, 225, 0.8)',    // Azul
        'rgba(139, 92, 246, 0.8)',   // Roxo
        'rgba(34, 197, 94, 0.8)',    // Verde claro
        'rgba(251, 146, 60, 0.8)',   // Laranja
        'rgba(14, 165, 233, 0.8)',   // Azul claro
        'rgba(168, 85, 247, 0.8)'    // Lilás
    ];

    const datasets = opcoes.map((opcao, index) => ({
        label: opcao,
        data: [percentuaisPeso[index]],
        backgroundColor: coresPredefinidas[index % coresPredefinidas.length],
        borderWidth: 2,
        borderColor: '#fff'
    }));

    if (chartBarras) {
        chartBarras.data.datasets = datasets;
        chartBarras.update();
    } else {
        const ctx = document.getElementById('chartBarras');
        if (!ctx) {
            console.error('Canvas chartBarras não encontrado');
            return;
        }
        
        chartBarras = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Percentual de Peso'],
                datasets: datasets
            },
            options: {
                indexAxis: 'y', // Barra horizontal
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.x.toFixed(2) + '%';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        min: 0,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        title: {
                            display: true,
                            text: 'Percentual (0-100%)'
                        }
                    },
                    y: {
                        stacked: true,
                        display: false
                    }
                }
            }
        });
    }
}

window.addEventListener('beforeunload', () => {
    if (eventSource) {
        eventSource.close();
    }
    if (chartBarras) {
        chartBarras.destroy();
    }
});