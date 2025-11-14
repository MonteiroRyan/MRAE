const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function initDatabase() {
    let connection;

    try {
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

        // ========== CRIAR TABELAS ==========

        // Tabela de municípios
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

        // Tabela de usuários
        await connection.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cpf VARCHAR(11) NOT NULL UNIQUE,
                nome VARCHAR(100) NOT NULL,
                senha VARCHAR(255) NULL,
                tipo ENUM('ADMIN', 'PREFEITO', 'REPRESENTANTE') NOT NULL,
                municipio_id INT NULL,
                ativo BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (municipio_id) REFERENCES municipios(id) ON DELETE RESTRICT,
                INDEX idx_cpf (cpf),
                INDEX idx_tipo (tipo),
                INDEX idx_municipio (municipio_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Tabela usuarios criada');

        // Tabela de eventos de votação
        await connection.query(`
            CREATE TABLE IF NOT EXISTS eventos_votacao (
                id INT AUTO_INCREMENT PRIMARY KEY,
                titulo VARCHAR(500) NOT NULL,
                descricao TEXT,
                tipo_votacao ENUM('BINARIO', 'APROVACAO', 'ALTERNATIVAS', 'SIM_NAO') NOT NULL DEFAULT 'SIM_NAO',
                opcoes_votacao JSON NULL,
                data_inicio DATETIME NOT NULL,
                data_fim DATETIME NOT NULL,
                peso_minimo_quorum DECIMAL(5, 2) NOT NULL DEFAULT 60.00,
                status ENUM('RASCUNHO', 'AGUARDANDO_INICIO', 'ATIVO', 'ENCERRADO') DEFAULT 'RASCUNHO',
                criado_por INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (criado_por) REFERENCES usuarios(id),
                INDEX idx_status (status),
                INDEX idx_data_inicio (data_inicio)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Tabela eventos_votacao criada');

        // Tabela de participantes do evento
        await connection.query(`
            CREATE TABLE IF NOT EXISTS evento_participantes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                evento_id INT NOT NULL,
                usuario_id INT NOT NULL,
                presente BOOLEAN DEFAULT 0,
                data_presenca DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (evento_id) REFERENCES eventos_votacao(id) ON DELETE CASCADE,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                UNIQUE KEY unique_evento_usuario (evento_id, usuario_id),
                INDEX idx_evento (evento_id),
                INDEX idx_presente (presente)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Tabela evento_participantes criada');

        // Tabela de votos (1 voto por município)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS votos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                evento_id INT NOT NULL,
                usuario_id INT NOT NULL,
                municipio_id INT NOT NULL,
                voto VARCHAR(500) NOT NULL,
                peso DECIMAL(10, 2) NOT NULL,
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (evento_id) REFERENCES eventos_votacao(id) ON DELETE CASCADE,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                FOREIGN KEY (municipio_id) REFERENCES municipios(id) ON DELETE RESTRICT,
                UNIQUE KEY unique_voto_municipio_evento (evento_id, municipio_id),
                INDEX idx_evento (evento_id),
                INDEX idx_municipio (municipio_id),
                INDEX idx_data (data_hora)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Tabela votos criada (1 voto por município)');

        // Tabela de sessões
        await connection.query(`
            CREATE TABLE IF NOT EXISTS sessoes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id VARCHAR(64) NOT NULL UNIQUE,
                usuario_id INT NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                expires_at DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                INDEX idx_session_id (session_id),
                INDEX idx_expires (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Tabela sessoes criada');

        // ========== INSERIR DADOS ==========

        console.log('\n📋 Inserindo municípios do Espírito Santo...');
        
        // 78 municípios do Espírito Santo com pesos
        const municipiosES = [
            ['Afonso Cláudio', 3.50],
            ['Água Doce do Norte', 2.00],
            ['Águia Branca', 2.50],
            ['Alegre', 4.50],
            ['Alfredo Chaves', 3.00],
            ['Alto Rio Novo', 2.00],
            ['Anchieta', 4.00],
            ['Apiacá', 2.00],
            ['Aracruz', 6.50],
            ['Atílio Vivácqua', 2.50],
            ['Baixo Guandu', 4.50],
            ['Barra de São Francisco', 5.00],
            ['Boa Esperança', 2.50],
            ['Bom Jesus do Norte', 2.50],
            ['Brejetuba', 2.00],
            ['Cachoeiro de Itapemirim', 9.00],
            ['Cariacica', 8.50],
            ['Castelo', 5.00],
            ['Colatina', 7.50],
            ['Conceição da Barra', 4.00],
            ['Conceição do Castelo', 2.50],
            ['Divino de São Lourenço', 2.00],
            ['Domingos Martins', 4.50],
            ['Dores do Rio Preto', 2.00],
            ['Ecoporanga', 3.50],
            ['Fundão', 4.00],
            ['Governador Lindenberg', 2.00],
            ['Guaçuí', 4.50],
            ['Guarapari', 7.50],
            ['Ibatiba', 3.50],
            ['Ibiraçu', 3.00],
            ['Ibitirama', 2.50],
            ['Iconha', 2.50],
            ['Irupi', 2.00],
            ['Itaguaçu', 2.50],
            ['Itapemirim', 5.00],
            ['Itarana', 2.50],
            ['Iúna', 4.00],
            ['Jaguaré', 4.00],
            ['Jerônimo Monteiro', 3.00],
            ['João Neiva', 3.50],
            ['Laranja da Terra', 2.00],
            ['Linhares', 8.00],
            ['Mantenópolis', 2.50],
            ['Marataízes', 5.50],
            ['Marechal Floriano', 2.50],
            ['Marilândia', 3.00],
            ['Mimoso do Sul', 4.00],
            ['Montanha', 3.00],
            ['Mucurici', 2.00],
            ['Muniz Freire', 3.50],
            ['Muqui', 2.50],
            ['Nova Venécia', 6.00],
            ['Pancas', 3.50],
            ['Pedro Canário', 4.00],
            ['Pinheiros', 4.00],
            ['Piúma', 3.50],
            ['Ponto Belo', 2.00],
            ['Presidente Kennedy', 3.00],
            ['Rio Bananal', 2.50],
            ['Rio Novo do Sul', 2.50],
            ['Santa Leopoldina', 3.00],
            ['Santa Maria de Jetibá', 5.00],
            ['Santa Teresa', 3.50],
            ['São Domingos do Norte', 2.00],
            ['São Gabriel da Palha', 5.00],
            ['São José do Calçado', 3.00],
            ['São Mateus', 7.50],
            ['São Roque do Canaã', 3.00],
            ['Serra', 9.50],
            ['Sooretama', 3.50],
            ['Vargem Alta', 3.00],
            ['Venda Nova do Imigrante', 3.50],
            ['Viana', 6.00],
            ['Vila Pavão', 2.00],
            ['Vila Valério', 2.50],
            ['Vila Velha', 9.00],
            ['Vitória', 10.00]
        ];

        let inseridos = 0;
        for (const [nome, peso] of municipiosES) {
            try {
                await connection.query(
                    'INSERT IGNORE INTO municipios (nome, peso) VALUES (?, ?)',
                    [nome, peso]
                );
                inseridos++;
            } catch (error) {
                console.error(`Erro ao inserir ${nome}:`, error.message);
            }
        }
        console.log(`✅ ${inseridos} municípios do Espírito Santo inseridos`);

        // Criar usuário administrador padrão
        console.log('\n👤 Criando usuário administrador...');
        const senhaAdmin = await bcrypt.hash('admin123', 10);
        
        try {
            await connection.query(
                'INSERT IGNORE INTO usuarios (cpf, nome, senha, tipo, ativo) VALUES (?, ?, ?, ?, ?)',
                ['00000000191', 'Administrador', senhaAdmin, 'ADMIN', 1]
            );
            console.log('✅ Usuário administrador criado');
            console.log('   📧 CPF: 000.000.001-91');
            console.log('   🔑 Senha: admin123');
        } catch (error) {
            console.log('⚠️  Usuário administrador já existe');
        }

        console.log('\n🎉 Banco de dados inicializado com sucesso!');
        console.log('\n📝 Resumo:');
        console.log(`   ✅ 6 tabelas criadas`);
        console.log(`   ✅ 78 municípios do Espírito Santo`);
        console.log(`   ✅ 1 usuário administrador`);
        console.log('\n✨ Funcionalidades:');
        console.log('   🗳️  Múltiplos tipos de votação');
        console.log('   🏛️  1 voto por município');
        console.log('   ⚖️  Quórum por peso (60%)');
        console.log('   📊 Exportação CSV');
        console.log('   🔔 Modais customizados');
        console.log('   🕐 Sessões de 1 hora');
        console.log('\n🚀 Próximos passos:');
        console.log('   1. Configure o arquivo .env (se necessário)');
        console.log('   2. Execute: npm start');
        console.log('   3. Acesse: http://localhost:3000');
        console.log('   4. Login: CPF 000.000.001-91 | Senha: admin123');

    } catch (error) {
        console.error('\n❌ Erro ao inicializar banco de dados:', error);
        console.error('\n💡 Dicas:');
        console.error('   - Verifique se o MySQL está rodando');
        console.error('   - Verifique as credenciais no arquivo .env');
        console.error('   - Verifique as permissões do usuário MySQL');
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Conexão encerrada');
        }
    }
}

initDatabase();