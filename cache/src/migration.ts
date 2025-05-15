import { sequelize } from './models';

async function runMigrations(): Promise<void> {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Connected to PostgreSQL database');
    
    // Create app_state table if it doesn't exist
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    console.log('Created app_state table if it did not exist');
    
    // Create the pixels table using sequelize sync
    await sequelize.sync();
    console.log('Synced database schema');
    
    console.log('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

// Run migrations
runMigrations(); 