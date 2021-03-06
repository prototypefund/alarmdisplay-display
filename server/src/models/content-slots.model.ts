import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/lib/hooks';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const ContentSlot = sequelizeClient.define('content_slot', {
    component: {
      type: DataTypes.STRING,
      allowNull: false
    },
    columnStart: {
      type: DataTypes.TINYINT,
      allowNull: false,
      validate: {
        min: 1
      }
    },
    columnEnd: {
      type: DataTypes.TINYINT,
      allowNull: false,
      validate: {
        min: 2
      }
    },
    rowStart: {
      type: DataTypes.TINYINT,
      allowNull: false,
      validate: {
        min: 1
      }
    },
    rowEnd: {
      type: DataTypes.TINYINT,
      allowNull: false,
      validate: {
        min: 2
      }
    },
  }, {
    hooks: {
      beforeCount(options: any): HookReturn {
        options.raw = true;
      }
    },
    tableName: [app.get('db_prefix'), 'content_slots'].join('_')
  });

  (ContentSlot as any).associate = function (models: any): void {
    models.content_slot.belongsTo(models.view, {
      as: 'view'
    });
    models.content_slot.hasMany(models.content_slot_options, {
      foreignKey: { allowNull: false },
      as: 'options'
    });
  };

  return ContentSlot;
}
