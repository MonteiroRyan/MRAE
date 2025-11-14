const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateSchema() {
    let connection;

    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'sistema_votacao'
        });

        console.log('✅ Conectado ao MySQL\n');

        // Verificar e adicionar colunas em eventos_votacao
        console.log('📋 Atualizando tabela eventos_votacao...');
        
        const [columns] = await connection.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'eventos_votacao' AND COLUMN_NAME IN ('votacao_multipla', 'votos_maximos')`,
            [process.env.DB_NAME || 'sistema_votacao']
        );

        const colunasExistentes = columns.map(c => c.COLUMN_NAME);

        if (!colunasExistentes.includes('votacao_multipla')) {
            await connection.query(
                `ALTER TABLE eventos_votacao 
                 ADD COLUMN votacao_multipla BOOLEAN DEFAULT 0 AFTER tipo_votacao`
            );
            console.log('✅ Coluna votacao_multipla adicionada');
        } else {
            console.log('⚠️  Coluna votacao_multipla já existe');
        }

        if (!colunasExistentes.includes('votos_maximos')) {
            await connection.query(
                `ALTER TABLE eventos_votacao 
                 ADD COLUMN votos_maximos INT DEFAULT 1 AFTER votacao_multipla`
            );
            console.log('✅ Coluna votos_maximos adicionada');
        } else {
            console.log('⚠️  Coluna votos_maximos já existe');
        }

        // Atualizar tabela votos
        console.log('\n📋 Atualizando tabela votos...');

        // Remover constraint antiga
        try {
            await connection.query(
                `ALTER TABLE votos DROP INDEX unique_voto_municipio_evento`
            );
            console.log('✅ Constraint antiga removida');
        } catch (error) {
            console.log('⚠️  Constraint antiga não existe');
        }

        // Adicionar coluna voto_numero se não existir
        const [votoCols] = await connection.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'votos' AND COLUMN_NAME = 'voto_numero'`,
            [process.env.DB_NAME || 'sistema_votacao']
        );

        if (votoCols.length === 0) {
            await connection.query(
                `ALTER TABLE votos ADD COLUMN voto_numero INT DEFAULT 1 AFTER voto`
            );
            console.log('✅ Coluna voto_numero adicionada');
        } else {
            console.log('⚠️  Coluna voto_numero já existe');
        }

        // Adicionar nova constraint
        try {
            await connection.query(
                `ALTER TABLE votos 
                 ADD UNIQUE KEY unique_voto_municipio_evento_numero (evento_id, municipio_id, voto_numero)`
            );
            console.log('✅ Nova constraint de unicidade adicionada');
        } catch (error) {
            console.log('⚠️  Constraint já existe');
        }

        console.log('\n🎉 Schema atualizado com sucesso!\n');

    } catch (error) {
        console.error('❌ Erro ao atualizar schema:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

updateSchema();