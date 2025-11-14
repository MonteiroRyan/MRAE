const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuração do banco de dados MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sistema_votacao',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Criar pool de conexões
const pool = mysql.createPool(dbConfig);

// Exportar pool ANTES de importar as rotas
global.pool = pool;

// Importar rotas (após exportar pool)
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const votoRoutes = require('./routes/votoRoutes');
const eventoRoutes = require('./routes/eventoRoutes');

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Usar rotas
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/votos', votoRoutes);
app.use('/api/eventos', eventoRoutes);

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(500).json({ 
    success: false, 
    message: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : err.message
  });
});

// Função para verificar se tabela existe
async function tabelaExiste(nomeTabela) {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = ? AND table_name = ?`,
      [process.env.DB_NAME || 'sistema_votacao', nomeTabela]
    );
    return rows[0].count > 0;
  } catch (error) {
    console.error(`Erro ao verificar tabela ${nomeTabela}:`, error.message);
    return false;
  }
}

// Limpar sessões expiradas a cada 30 minutos (apenas se tabela existir)
async function iniciarLimpezaSessoes() {
  const authController = require('./controllers/authController');
  
  // Verificar se tabela sessoes existe antes de limpar
  const sessoesExiste = await tabelaExiste('sessoes');
  
  if (sessoesExiste) {
    // Limpar imediatamente
    authController.limparSessoesExpiradas();
    
    // Depois limpar a cada 30 minutos
    setInterval(() => {
      authController.limparSessoesExpiradas();
    }, 30 * 60 * 1000);
    
    console.log('✅ Limpeza automática de sessões ativada');
  } else {
    console.log('⚠️  Tabela sessoes não existe. Limpeza de sessões desativada.');
    console.log('💡 Execute: npm run init-db');
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM recebido. Encerrando gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT recebido. Encerrando gracefully...');
  await pool.end();
  process.exit(0);
});

// Inicialização do servidor
app.listen(PORT, async () => {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   🗳️  SISTEMA DE VOTAÇÃO MUNICIPAL - ESPÍRITO SANTO    ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  
  // Testar conexão com banco de dados
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conectado ao banco de dados MySQL');
    connection.release();
    
    // Verificar tabelas essenciais
    const tabelasEssenciais = ['usuarios', 'municipios', 'eventos_votacao', 'votos', 'sessoes'];
    const tabelasFaltando = [];
    
    for (const tabela of tabelasEssenciais) {
      const existe = await tabelaExiste(tabela);
      if (!existe) {
        tabelasFaltando.push(tabela);
      }
    }
    
    if (tabelasFaltando.length > 0) {
      console.log('\n⚠️  ATENÇÃO: Tabelas faltando no banco de dados:');
      tabelasFaltando.forEach(t => console.log(`   ❌ ${t}`));
      console.log('\n💡 Execute o comando: npm run init-db\n');
    } else {
      console.log('✅ Todas as tabelas essenciais encontradas');
      
      // Contar registros
      try {
        const [municipios] = await pool.query('SELECT COUNT(*) as count FROM municipios');
        const [usuarios] = await pool.query('SELECT COUNT(*) as count FROM usuarios');
        const [eventos] = await pool.query('SELECT COUNT(*) as count FROM eventos_votacao');
        
        console.log(`📊 Estatísticas:`);
        console.log(`   - Municípios: ${municipios[0].count}`);
        console.log(`   - Usuários: ${usuarios[0].count}`);
        console.log(`   - Eventos: ${eventos[0].count}`);
      } catch (error) {
        // Ignorar erros de contagem
      }
      
      // Iniciar limpeza de sessões
      await iniciarLimpezaSessoes();
    }
    
  } catch (error) {
    console.error('\n❌ Erro ao conectar ao banco de dados:', error.message);
    console.error('\n💡 Verifique:');
    console.error('   1. MySQL está rodando');
    console.error('   2. Credenciais no arquivo .env estão corretas');
    console.error('   3. Banco de dados foi criado (execute: npm run init-db)\n');
    
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Encerrando servidor (produção)...\n');
      process.exit(1);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Sistema pronto! Aguardando requisições...');
  console.log('='.repeat(60) + '\n');
});

// Exportar para uso nos controllers
module.exports = { pool };