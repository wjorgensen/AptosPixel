import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { initPixelModel } from './pixel';

dotenv.config();

// Database configuration
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'pixels',
  logging: process.env.NODE_ENV !== 'production',
  pool: {
    max: 20,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// Initialize models
const Pixel = initPixelModel(sequelize);

// Export models and sequelize connection
export {
  sequelize,
  Pixel,
}; 