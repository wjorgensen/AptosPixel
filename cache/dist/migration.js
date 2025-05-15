"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("./models");
async function runMigrations() {
    try {
        // Test database connection
        await models_1.sequelize.authenticate();
        console.log('Connected to PostgreSQL database');
        // Create app_state table if it doesn't exist
        await models_1.sequelize.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
        console.log('Created app_state table if it did not exist');
        // Create the pixels table using sequelize sync
        await models_1.sequelize.sync();
        console.log('Synced database schema');
        console.log('Migrations completed successfully');
        process.exit(0);
    }
    catch (error) {
        console.error('Error running migrations:', error);
        process.exit(1);
    }
}
// Run migrations
runMigrations();
