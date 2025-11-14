const mysql = require("mysql2/promise");
require("dotenv").config();

async function migrateDatabase() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "sistema_votacao",
    });

    console.log("✅ Conectado ao MySQL");

    // Verificar se eventos_votacao existe
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'eventos_votacao'"
    );

    if (tables.length === 0) {
      console.log("📋 Criando tabela eventos_votacao...");
      await connection.query(`
                CREATE TABLE eventos_votacao (
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
      console.log("✅ Tabela eventos_votacao criada");
    }

    // Verificar se evento_participantes existe
    const [tables2] = await connection.query(
      "SHOW TABLES LIKE 'evento_participantes'"
    );

    if (tables2.length === 0) {
      console.log("📋 Criando tabela evento_participantes...");
      await connection.query(`
                CREATE TABLE evento_participantes (
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
      console.log("✅ Tabela evento_participantes criada");
    }

    // Verificar se sessoes existe
    const [tables3] = await connection.query("SHOW TABLES LIKE 'sessoes'");

    if (tables3.length === 0) {
      console.log("📋 Criando tabela sessoes...");
      await connection.query(`
                CREATE TABLE sessoes (
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
      console.log("✅ Tabela sessoes criada");
    }

    // Verificar se coluna evento_id existe na tabela votos
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM votos LIKE 'evento_id'"
    );

    if (columns.length === 0) {
      console.log("📋 Migrando tabela votos...");

      // Adicionar coluna evento_id
      await connection.query(`
                ALTER TABLE votos ADD COLUMN evento_id INT NOT NULL AFTER id
            `);
      console.log("✅ Coluna evento_id adicionada");

      // Criar evento padrão para votos existentes
      const [usuariosAdmin] = await connection.query(
        "SELECT id FROM usuarios WHERE tipo = 'ADMIN' LIMIT 1"
      );

      if (usuariosAdmin.length > 0) {
        const [eventoExistente] = await connection.query(
          "SELECT id FROM eventos_votacao LIMIT 1"
        );

        let eventoId;
        if (eventoExistente.length === 0) {
          const [resultado] = await connection.query(
            `
                        INSERT INTO eventos_votacao 
                        (titulo, descricao, data_inicio, data_fim, quorum_minimo, status, criado_por) 
                        VALUES 
                        ('Votação Migrada', 'Votos existentes antes da migração', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 1, 'ENCERRADO', ?)
                    `,
            [usuariosAdmin[0].id]
          );

          eventoId = resultado.insertId;
          console.log("✅ Evento padrão criado para migração");
        } else {
          eventoId = eventoExistente[0].id;
        }

        // Atualizar votos existentes
        await connection.query(
          "UPDATE votos SET evento_id = ? WHERE evento_id = 0",
          [eventoId]
        );
        console.log("✅ Votos existentes migrados");
      }

      // Remover constraint antiga se existir
      try {
        await connection.query(`
                    ALTER TABLE votos DROP INDEX unique_voto_usuario
                `);
        console.log("✅ Constraint antiga removida");
      } catch (error) {
        // Constraint pode não existir
      }

      // Adicionar foreign key
      await connection.query(`
                ALTER TABLE votos ADD CONSTRAINT fk_votos_evento 
                FOREIGN KEY (evento_id) REFERENCES eventos_votacao(id) ON DELETE CASCADE
            `);
      console.log("✅ Foreign key adicionada");

      // Adicionar nova constraint
      await connection.query(`
                ALTER TABLE votos ADD UNIQUE KEY unique_voto_evento_usuario (evento_id, usuario_id)
            `);
      console.log("✅ Nova constraint de unicidade adicionada");

      // Adicionar índice
      await connection.query(`
                ALTER TABLE votos ADD INDEX idx_evento (evento_id)
            `);
      console.log("✅ Índice adicionado");
    }

    // Atualizar coluna senha para aceitar NULL (para prefeitos/representantes)
    const [senhaColumn] = await connection.query(
      "SHOW COLUMNS FROM usuarios WHERE Field = 'senha'"
    );

    if (senhaColumn.length > 0 && senhaColumn[0].Null === "NO") {
      console.log("📋 Atualizando coluna senha para aceitar NULL...");
      await connection.query(`
                ALTER TABLE usuarios MODIFY senha VARCHAR(255) NULL
            `);
      console.log("✅ Coluna senha atualizada");
    }

    console.log("\n🎉 Migração concluída com sucesso!");
    console.log("\n📝 Resumo:");
    console.log("   ✅ Tabelas de eventos criadas");
    console.log("   ✅ Tabela de sessões criada");
    console.log("   ✅ Tabela votos migrada");
    console.log("   ✅ Coluna senha aceita NULL");
    console.log("\n💡 Próximos passos:");
    console.log("   1. Reinicie o servidor: npm start");
    console.log("   2. Faça login no painel admin");
    console.log("   3. Crie um novo evento de votação");
  } catch (error) {
    console.error("❌ Erro na migração:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrateDatabase();
