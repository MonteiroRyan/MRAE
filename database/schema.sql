-- Criar banco de dados
CREATE DATABASE IF NOT EXISTS sistema_votacao;
USE sistema_votacao;

-- Tabela de municípios
CREATE TABLE IF NOT EXISTS municipios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  peso DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de usuários
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de eventos de votação (COM TIPOS DE VOTAÇÃO)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de participantes do evento
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de votos (1 VOTO POR MUNICÍPIO)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de sessões
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Usuário administrador padrão
-- Senha: admin123 (hash bcrypt)
INSERT INTO usuarios (cpf, nome, senha, tipo, municipio_id, ativo) VALUES
('00000000000', 'Administrador', '$2a$10$YVQxZ9Z8QmZ9Z8QmZ9Z8QeJ5YnJ5YnJ5YnJ5YnJ5YnJ5YnJ5YnJ5Y', 'ADMIN', NULL, 1);

-- Nota: O hash acima é apenas um exemplo. Você deve gerar um hash real usando bcrypt
-- Para gerar um hash real, use: const bcrypt = require('bcryptjs'); bcrypt.hashSync('admin123', 10);