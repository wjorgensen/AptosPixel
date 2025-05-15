import { Model, DataTypes, Sequelize } from 'sequelize';

class Pixel extends Model {
  public id!: number;
  public x!: number;
  public y!: number;
  public color!: string;
  public url!: string;
  public owner!: string;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export const initPixelModel = (sequelize: Sequelize): typeof Pixel => {
  Pixel.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      x: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      y: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      color: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '#FFFFFF',
      },
      url: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      owner: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '',
      },
    },
    {
      sequelize,
      tableName: 'pixels',
      indexes: [
        {
          unique: true,
          fields: ['x', 'y'],
        },
        {
          fields: ['owner'],
        },
      ],
    }
  );

  return Pixel;
};

export default Pixel; 