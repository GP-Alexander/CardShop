import { createApp } from "./app";
import { env } from "./config/env";
import { getDbPool, closeDbPool } from "./config/database";
import { logger } from "./shared/logger";

async function bootstrap() {
  try {
    logger.info("Iniciando ShopCart Backend API...");

    // Conectar a la base de datos
    await getDbPool();

    const app = createApp();
    const server = app.listen(env.PORT, "0.0.0.0", () => {
      logger.info(`🚀 Servidor ejecutándose en http://localhost:${env.PORT}${env.API_PREFIX}`);
    });

    // Cierre ordenado
    const shutdown = async (signal: string) => {
      logger.info(`Señal ${signal} recibida. Cerrando servidor de forma segura...`);
      server.close(async () => {
        await closeDbPool();
        logger.info("Servidor detenido completamente.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error({ error }, "Error fatal al iniciar la aplicación");
    process.exit(1);
  }
}

bootstrap();
