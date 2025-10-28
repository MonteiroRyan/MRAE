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
    message: 'Erro interno do servidor' 
  });
});

// Limpar sessões expiradas a cada 30 minutos
const authController = require('./controllers/authController');
setInterval(() => {
  authController.limparSessoesExpiradas();
}, 30 * 60 * 1000);

// Inicialização do servidor
app.listen(PORT, async () => {
  // Testar conexão com banco de dados
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conectado ao banco de dados MySQL');
    connection.release();
    
    // Limpar sessões expiradas ao iniciar
    authController.limparSessoesExpiradas();
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados:', error.message);
  }
});

// Exportar para uso nos controllers
module.exports = { pool };