-- Criar banco de dados
CREATE DATABASE IF NOT EXISTS sistema_votacao;
USE sistema_votacao;

-- Tabela de municípios
CREATE TABLE IF NOT EXISTS municipios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  peso DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cpf VARCHAR(11) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL,
  senha VARCHAR(255) NOT NULL,
  tipo ENUM('ADMIN', 'PREFEITO', 'REPRESENTANTE') NOT NULL,
  municipio_id INT NULL,
  ativo BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (municipio_id) REFERENCES municipios(id) ON DELETE RESTRICT
);

-- Tabela de votos
CREATE TABLE IF NOT EXISTS votos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  municipio_id INT NOT NULL,
  voto ENUM('SIM', 'NAO', 'ABSTENCAO', 'AUSENTE') NOT NULL,
  peso DECIMAL(10, 2) NOT NULL,
  data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  FOREIGN KEY (municipio_id) REFERENCES municipios(id) ON DELETE RESTRICT,
  UNIQUE KEY unique_voto_usuario (usuario_id)
);

-- Índices para performance
CREATE INDEX idx_usuarios_cpf ON usuarios(cpf);
CREATE INDEX idx_votos_usuario ON votos(usuario_id);
CREATE INDEX idx_votos_municipio ON votos(municipio_id);

-- Inserir dados iniciais
-- Municípios de exemplo
INSERT INTO municipios (nome, peso) VALUES
('São Paulo', 10.00),
('Rio de Janeiro', 8.00),
('Belo Horizonte', 6.00),
('Brasília', 7.00),
('Salvador', 5.00);

-- Usuário administrador padrão
-- Senha: admin123 (hash bcrypt)
INSERT INTO usuarios (cpf, nome, senha, tipo, municipio_id, ativo) VALUES
('00000000000', 'Administrador', '$2a$10$YVQxZ9Z8QmZ9Z8QmZ9Z8QeJ5YnJ5YnJ5YnJ5YnJ5YnJ5YnJ5YnJ5Y', 'ADMIN', NULL, 1);

-- Nota: O hash acima é apenas um exemplo. Você deve gerar um hash real usando bcrypt
-- Para gerar um hash real, use: const bcrypt = require('bcryptjs'); bcrypt.hashSync('admin123', 10);