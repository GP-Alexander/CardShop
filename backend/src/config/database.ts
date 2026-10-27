import sql from "mssql";
import { env } from "./env";
import { logger } from "../shared/logger";

const sqlConfig: sql.config = {
  server: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getDbPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  try {
    pool = await new sql.ConnectionPool(sqlConfig).connect();

    pool.on("error", (err) => {
      logger.error({ err }, "Error inesperado en el pool de SQL Server");
    });

    return pool;
  } catch (error) {
    logger.error({ error }, "Error al conectar con SQL Server");
    throw error;
  }
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    logger.info("Pool de SQL Server cerrado.");
  }
}
