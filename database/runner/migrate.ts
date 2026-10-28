import fs from "fs";
import path from "path";
import crypto from "crypto";
import sql from "mssql";
import dotenv from "dotenv";
import { splitBatches } from "./splitBatches";

// Cargar variables de entorno
const envPath = path.resolve(__dirname, "../../.env");
const envExamplePath = path.resolve(__dirname, "../../.env.example");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(envExamplePath)) {
  dotenv.config({ path: envExamplePath });
} else {
  dotenv.config();
}

const dbConfig: sql.config = {
  server: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "1433", 10),
  user: process.env.DB_USER || "sa",
  password: process.env.SA_PASSWORD || process.env.DB_PASSWORD || "ShopCart2026!StrongPwd",
  database: process.env.DB_NAME || "ShopCart",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

const masterConfig: sql.config = {
  ...dbConfig,
  database: "master",
};

async function ensureDatabaseExists() {
  const isReset = process.argv.includes("--reset");
  console.log(`[Runner] Verificando base de datos '${dbConfig.database}' en SQL Server...`);
  const pool = await new sql.ConnectionPool(masterConfig).connect();
  try {
    const dbName = dbConfig.database;
    if (isReset) {
      console.log(`[Runner] Modo --reset: eliminando base de datos previa '${dbName}'...`);
      await pool.request().query(`
        IF EXISTS (SELECT name FROM sys.databases WHERE name = '${dbName}')
        BEGIN
          ALTER DATABASE [${dbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
          DROP DATABASE [${dbName}];
          PRINT 'Base de datos previa eliminada.';
        END
      `);
    }

    await pool.request().query(`
      IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '${dbName}')
      BEGIN
        CREATE DATABASE [${dbName}];
        PRINT 'Base de datos [${dbName}] creada exitosamente.';
      END
    `);
  } finally {
    await pool.close();
  }
}

async function ensureVersionTable(pool: sql.ConnectionPool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VersionEsquema')
    BEGIN
      CREATE TABLE dbo.VersionEsquema (
        IDVersion INT IDENTITY(1,1) CONSTRAINT PK_VersionEsquema PRIMARY KEY,
        NombreArchivo NVARCHAR(255) NOT NULL CONSTRAINT UQ_VersionEsquema_Nombre UNIQUE,
        HashMD5 VARCHAR(32) NOT NULL,
        FechaAplicacion DATETIME2(3) NOT NULL CONSTRAINT DF_VersionEsquema_Fecha DEFAULT SYSUTCDATETIME()
      );
      PRINT 'Tabla VersionEsquema inicializada.';
    END
  `);
}

async function runMigrationsWithTransaction(pool: sql.ConnectionPool, migrationsDir: string) {
  if (!fs.existsSync(migrationsDir)) {
    console.log(`[Runner] Directorio de migraciones no existe: ${migrationsDir}`);
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const checkRes = await pool
      .request()
      .input("nombre", sql.NVarChar, file)
      .query("SELECT IDVersion FROM dbo.VersionEsquema WHERE NombreArchivo = @nombre");

    if (checkRes.recordset.length > 0) {
      console.log(`[Runner] Omitiendo migración ya aplicada: ${file}`);
      continue;
    }

    const fullPath = path.join(migrationsDir, file);
    const content = fs.readFileSync(fullPath, "utf-8");
    const hash = crypto.createHash("md5").update(content).digest("hex");
    const batches = splitBatches(content);

    console.log(`[Runner] Aplicando migración en transacción: ${file} (${batches.length} lotes)...`);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const batch of batches) {
        if (batch.trim().length === 0) continue;
        const request = new sql.Request(transaction);
        await request.query(batch);
      }

      const recReq = new sql.Request(transaction);
      recReq.input("nombre", sql.NVarChar, file);
      recReq.input("hash", sql.VarChar, hash);
      await recReq.query(
        "INSERT INTO dbo.VersionEsquema (NombreArchivo, HashMD5) VALUES (@nombre, @hash)"
      );

      await transaction.commit();
      console.log(`[Runner] OK (COMMITTED) -> ${file}`);
    } catch (err) {
      console.error(`[Runner] Error en migración ${file}. Ejecutando ROLLBACK...`);
      await transaction.rollback();
      throw err;
    }
  }
}

async function runProgrammable(pool: sql.ConnectionPool, programmableDir: string) {
  if (!fs.existsSync(programmableDir)) return;

  const files = fs
    .readdirSync(programmableDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("[Runner] No hay objetos programables pendientes.");
    return;
  }

  for (const file of files) {
    const fullPath = path.join(programmableDir, file);
    const content = fs.readFileSync(fullPath, "utf-8");
    const batches = splitBatches(content);

    console.log(`[Runner] Recreando objeto programable: ${file}...`);
    for (const batch of batches) {
      if (batch.trim().length === 0) continue;
      const request = pool.request();
      await request.query(batch);
    }
    console.log(`[Runner] OK -> ${file}`);
  }
}

async function verifyCounts(pool: sql.ConnectionPool) {
  console.log("\n--- VERIFICACIÓN DE CONTEOS BASE DE SEGURIDAD (0001) ---");
  const qRol = await pool.request().query("SELECT COUNT(*) AS total FROM dbo.Rol");
  const qPermiso = await pool.request().query("SELECT COUNT(*) AS total FROM dbo.Permiso");
  const qRolPermiso = await pool.request().query("SELECT COUNT(*) AS total FROM dbo.RolPermiso");
  const qUsuario = await pool.request().query("SELECT COUNT(*) AS total FROM dbo.Usuario");

  const totalRol = qRol.recordset[0].total;
  const totalPermiso = qPermiso.recordset[0].total;
  const totalRolPermiso = qRolPermiso.recordset[0].total;
  const totalUsuario = qUsuario.recordset[0].total;

  console.log(`dbo.Rol:         ${totalRol} (Esperado: 3)   -> ${totalRol === 3 ? "PASS" : "FAIL"}`);
  console.log(`dbo.Permiso:     ${totalPermiso} (Esperado: 15)  -> ${totalPermiso === 15 ? "PASS" : "FAIL"}`);
  console.log(`dbo.RolPermiso:  ${totalRolPermiso} (Esperado: 25)  -> ${totalRolPermiso === 25 ? "PASS" : "FAIL"}`);
  console.log(`dbo.Usuario:     ${totalUsuario} (Esperado: >= 1)   -> ${totalUsuario >= 1 ? "PASS" : "FAIL"}`);

  if (totalRol !== 3 || totalPermiso !== 15 || totalRolPermiso !== 25 || totalUsuario < 1) {
    throw new Error("Los conteos de la base de seguridad no coinciden con los requerimientos.");
  }
}

async function runSeeds(pool: sql.ConnectionPool, seedsDir: string) {
  if (!fs.existsSync(seedsDir)) return;

  const files = fs
    .readdirSync(seedsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("[Runner] No hay archivos de semillas pendientes.");
    return;
  }

  for (const file of files) {
    const fullPath = path.join(seedsDir, file);
    const content = fs.readFileSync(fullPath, "utf-8");
    const batches = splitBatches(content);

    console.log(`[Runner] Aplicando datos semilla: ${file}...`);
    for (const batch of batches) {
      if (batch.trim().length === 0) continue;
      const request = pool.request();
      await request.query(batch);
    }
    console.log(`[Runner] OK -> ${file}`);
  }
}

async function main() {
  try {
    await ensureDatabaseExists();

    const pool = await new sql.ConnectionPool(dbConfig).connect();
    console.log(`[Runner] Conectado exitosamente a la base de datos '${dbConfig.database}'.`);

    await ensureVersionTable(pool);

    const basePath = path.resolve(__dirname, "..");
    const migrationsDir = path.join(basePath, "migrations");
    const programmableDir = path.join(basePath, "programmable");
    const seedsDir = path.join(basePath, "seeds");

    const isSeedsOnly = process.argv.includes("--seeds-only");
    if (isSeedsOnly) {
      console.log("\n--- APLICANDO DATOS SEMILLA (--seeds-only) ---");
      await runSeeds(pool, seedsDir);
      await pool.close();
      console.log("\n[Runner] ¡Semillas aplicadas con éxito!");
      process.exit(0);
    }

    console.log("\n--- 1. APLICANDO MIGRACIONES ---");
    await runMigrationsWithTransaction(pool, migrationsDir);

    console.log("\n--- 2. APLICANDO OBJETOS PROGRAMABLES ---");
    await runProgrammable(pool, programmableDir);

    await verifyCounts(pool);

    console.log("\n--- 3. APLICANDO DATOS SEMILLA ---");
    await runSeeds(pool, seedsDir);

    await pool.close();
    console.log("\n[Runner] ¡Migración, verificación y semillas finalizadas con éxito total!");
    process.exit(0);
  } catch (err) {
    console.error("\n[Runner] ERROR FATAL EN MIGRACIÓN:", err);
    process.exit(1);
  }
}

main();

