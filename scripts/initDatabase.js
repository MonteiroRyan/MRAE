const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function initDatabase() {
    let connection;

    try {
        // Conectar sem selecionar banco
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });

        console.log('✅ Conectado ao MySQL');

        // Criar banco de dados
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'sistema_votacao'}`);
        console.log('✅ Banco de dados criado/verificado');

        // Usar o banco
        await connection.query(`USE ${process.env.DB_NAME || 'sistema_votacao'}`);

        // Criar tabela de municípios
        await connection.query(`
            CREATE TABLE IF NOT EXISTS municipios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(100) NOT NULL UNIQUE,
                peso DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_nome (nome)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Tabela municipios criada');

        // Criar tabela de usuários
        await connection.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cpf VARCHAR(11) NOT NULL UNIQUE,
                nome VARCHAR(100) NOT NULL,
                senha VARCHAR(255) NOT NULL,
                tipo ENUM('ADMIN', 'PREFEITO', 'REPRESENTANTE') NOT NULL,
                municipio_id INT NULL,
                ativo BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (municipio_id) REFERENCES municipios(id) ON DELETE RESTRICT,
                INDEX idx_cpf (cpf),
                INDEX idx_tipo (tipo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Tabela usuarios criada');

        // Criar tabela de votos
        await connection.query(`
            CREATE TABLE IF NOT EXISTS votos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                municipio_id INT NOT NULL,
                voto ENUM('SIM', 'NAO', 'ABSTENCAO', 'AUSENTE') NOT NULL,
                peso DECIMAL(10, 2) NOT NULL,
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
                FOREIGN KEY (municipio_id) REFERENCES municipios(id) ON DELETE RESTRICT,
                UNIQUE KEY unique_voto_usuario (usuario_id),
                INDEX idx_voto (voto),
                INDEX idx_data (data_hora)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Tabela votos criada');

        // Inserir municípios de exemplo
        const municipiosExemplo = [
            ['São Paulo', 10.00],
            ['Rio de Janeiro', 8.00],
            ['Belo Horizonte', 6.00],
            ['Brasília', 7.00],
            ['Salvador', 5.00],
            ['Fortaleza', 4.50],
            ['Curitiba', 5.50],
            ['Recife', 4.00],
            ['Porto Alegre', 5.00],
            ['Manaus', 3.50]
        ];

        for (const [nome, peso] of municipiosExemplo) {
            await connection.query(
                'INSERT IGNORE INTO municipios (nome, peso) VALUES (?, ?)',
                [nome, peso]
            );
        }
        console.log('✅ Municípios de exemplo inseridos');

        // Criar usuário administrador padrão
        const senhaAdmin = await bcrypt.hash('admin123', 10);
        await connection.query(
            'INSERT IGNORE INTO usuarios (cpf, nome, senha, tipo, ativo) VALUES (?, ?, ?, ?, ?)',
            ['00000000191', 'Administrador', senhaAdmin, 'ADMIN', 1]
        );
        console.log('✅ Usuário administrador criado');
        console.log('   CPF: 000.000.001-91');
        console.log('   Senha: admin123');

        console.log('\n🎉 Banco de dados inicializado com sucesso!');
        console.log('\nPróximos passos:');
        console.log('1. Ajuste o arquivo .env com suas credenciais');
        console.log('2. Execute: npm start');
        console.log('3. Acesse: http://localhost:3000');

    } catch (error) {
        console.error('❌ Erro ao inicializar banco de dados:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

initDatabase();