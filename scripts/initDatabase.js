const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function initDatabase() {
  let connection;

  try {
    // Conectar sem selecionar banco
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
    });

    console.log("Conectado ao MySQL");

    // Criar banco de dados
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${
        process.env.DB_NAME || "sistema_votacao"
      }`
    );
    console.log("Banco de dados criado/verificado");

    // Usar o banco
    await connection.query(`USE ${process.env.DB_NAME || "sistema_votacao"}`);

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
    console.log("Tabela municipios criada");

    // Criar tabela de usuários (SENHA APENAS PARA ADMIN)
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
                INDEX idx_tipo (tipo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    console.log("Tabela usuarios criada");

    // Criar tabela de eventos de votação
    await connection.query(`
            CREATE TABLE IF NOT EXISTS eventos_votacao (
                id INT AUTO_INCREMENT PRIMARY KEY,
                titulo VARCHAR(200) NOT NULL,
                descricao TEXT,
                data_inicio DATETIME NOT NULL,
                data_fim DATETIME NOT NULL,
                quorum_minimo INT NOT NULL DEFAULT 10,
                status ENUM('RASCUNHO', 'AGUARDANDO_QUORUM', 'ATIVO', 'ENCERRADO') DEFAULT 'RASCUNHO',
                criado_por INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (criado_por) REFERENCES usuarios(id),
                INDEX idx_status (status),
                INDEX idx_data_inicio (data_inicio)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    console.log("Tabela eventos_votacao criada");

    // Criar tabela de participantes do evento
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
    console.log("Tabela evento_participantes criada");

    // Criar tabela de votos
    await connection.query(`
            CREATE TABLE IF NOT EXISTS votos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                evento_id INT NOT NULL,
                usuario_id INT NOT NULL,
                municipio_id INT NOT NULL,
                voto ENUM('SIM', 'NAO', 'ABSTENCAO', 'AUSENTE') NOT NULL,
                peso DECIMAL(10, 2) NOT NULL,
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (evento_id) REFERENCES eventos_votacao(id) ON DELETE CASCADE,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
                FOREIGN KEY (municipio_id) REFERENCES municipios(id) ON DELETE RESTRICT,
                UNIQUE KEY unique_voto_evento_usuario (evento_id, usuario_id),
                INDEX idx_evento (evento_id),
                INDEX idx_voto (voto),
                INDEX idx_data (data_hora)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    console.log("Tabela votos criada");

    // Criar tabela de sessões
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
    console.log("Tabela sessoes criada");

    const municipios = [
      ["Afonso Cláudio", 0],
      ["Água Doce do Norte", 0],
      ["Águia Branca", 0],
      ["Alegre", 0],
      ["Alfredo Chaves", 0],
      ["Alto Rio Novo", 0],
      ["Anchieta", 0],
      ["Apiacá", 0],
      ["Aracruz", 0],
      ["Atilio Vivacqua", 0],
      ["Baixo Guandu", 0],
      ["Barra de São Francisco", 0],
      ["Boa Esperança", 0],
      ["Bom Jesus do Norte", 0],
      ["Brejetuba", 0],
      ["Cachoeiro de Itapemirim", 0],
      ["Cariacica", 0],
      ["Castelo", 0],
      ["Colatina", 0],
      ["Conceição da Barra", 0],
      ["Conceição do Castelo", 0],
      ["Divino de São Lourenço", 0],
      ["Domingos Martins", 0],
      ["Dores do Rio Preto", 0],
      ["Ecoporanga", 0],
      ["Fundão", 0],
      ["Governador Lindenberg", 0],
      ["Guaçuí", 0],
      ["Guarapari", 0],
      ["Ibatiba", 0],
      ["Ibiraçu", 0],
      ["Ibitirama", 0],
      ["Iconha", 0],
      ["Irupi", 0],
      ["Itaguaçu", 0],
      ["Itapemirim", 0],
      ["Itarana", 0],
      ["Iúna", 0],
      ["Jaguaré", 0],
      ["Jerônimo Monteiro", 0],
      ["João Neiva", 0],
      ["Laranja da Terra", 0],
      ["Linhares", 0],
      ["Mantenópolis", 0],
      ["Marataízes", 0],
      ["Marechal Floriano", 0],
      ["Marilândia", 0],
      ["Mimoso do Sul", 0],
      ["Montanha", 0],
      ["Mucurici", 0],
      ["Muniz Freire", 0],
      ["Muqui", 0],
      ["Nova Venécia", 0],
      ["Pancas", 0],
      ["Pedro Canário", 0],
      ["Pinheiros", 0],
      ["Piúma", 0],
      ["Ponto Belo", 0],
      ["Presidente Kennedy", 0],
      ["Rio Bananal", 0],
      ["Rio Novo do Sul", 0],
      ["Santa Leopoldina", 0],
      ["Santa Maria de Jetibá", 0],
      ["Santa Teresa", 0],
      ["São Domingos do Norte", 0],
      ["São Gabriel da Palha", 0],
      ["São José do Calçado", 0],
      ["São Mateus", 0],
      ["São Roque do Canaã", 0],
      ["Serra", 0],
      ["Sooretama", 0],
      ["Vargem Alta", 0],
      ["Venda Nova do Imigrante", 0],
      ["Viana", 0],
      ["Vila Pavão", 0],
      ["Vila Valério", 0],
      ["Vila Velha", 0],
      ["Vitória", 0],
    ];

    for (const [nome, peso] of municipios) {
      await connection.query(
        "INSERT IGNORE INTO municipios (nome, peso) VALUES (?, ?)",
        [nome, peso]
      );
    }

    // Criar usuário administrador padrão (COM SENHA)
    const senhaAdmin = await bcrypt.hash("admin123", 10);
    await connection.query(
      "INSERT IGNORE INTO usuarios (cpf, nome, senha, tipo, ativo) VALUES (?, ?, ?, ?, ?)",
      ["00000000191", "Administrador", senhaAdmin, "ADMIN", 1]
    );
  } catch (error) {
    console.error("Erro ao inicializar banco de dados:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDatabase();
