import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

dotenv.config();

export const PostgresOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  entities: [
    __dirname + '/entities/*.entity.ts',
    __dirname + '/../modules/*/entities/*.entity.ts',
  ],
  migrations: [__dirname + '/migrations/*.ts'],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
};

const PostgresDataSource = new DataSource(PostgresOptions);
export default PostgresDataSource;
