"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initPixelModel = void 0;
const sequelize_1 = require("sequelize");
class Pixel extends sequelize_1.Model {
}
const initPixelModel = (sequelize) => {
    Pixel.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        x: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
        },
        y: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
        },
        color: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            defaultValue: '#FFFFFF',
        },
        url: {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',
        },
        owner: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            defaultValue: '',
        },
    }, {
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
    });
    return Pixel;
};
exports.initPixelModel = initPixelModel;
exports.default = Pixel;
