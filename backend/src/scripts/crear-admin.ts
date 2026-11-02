import sql from "mssql";
import argon2 from "argon2";
import { getDbPool, closeDbPool } from "../config/database";

async function main() {
  console.log("Iniciando creación/verificación de usuarios de prueba mediante Stored Procedure...");
  const pool = await getDbPool();

  const hashAdmin = await argon2.hash("Admin1234!", { type: argon2.argon2id });
  const hashOperador = await argon2.hash("Operador1234!", { type: argon2.argon2id });

  // Administrador
  await pool
    .request()
    .input("Nombres", sql.NVarChar(100), "Admin")
    .input("Apellidos", sql.NVarChar(100), "Principal")
    .input("Correo", sql.NVarChar(254), "admin@shopcart.com")
    .input("NombreRol", sql.NVarChar(50), "Administrador")
    .input("HashContrasena", sql.NVarChar(255), hashAdmin)
    .execute("dbo.SP_Usuario_RegistrarInterno");

  // Operador
  await pool
    .request()
    .input("Nombres", sql.NVarChar(100), "Operador")
    .input("Apellidos", sql.NVarChar(100), "Almacen")
    .input("Correo", sql.NVarChar(254), "operador@shopcart.com")
    .input("NombreRol", sql.NVarChar(50), "Operador")
    .input("HashContrasena", sql.NVarChar(255), hashOperador)
    .execute("dbo.SP_Usuario_RegistrarInterno");

  console.log("✅ Usuarios verificados/creados exitosamente mediante Stored Procedure:");
  console.log("👉 Administrador: admin@shopcart.com / Admin1234!");
  console.log("👉 Operador:      operador@shopcart.com / Operador1234!");

  await closeDbPool();
}

main();

