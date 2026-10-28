import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { getDbPool, closeDbPool } from "../../src/config/database";

describe("Módulos de Auditoría (Bitácora RF-09) y Catálogos del Sistema", () => {
  const app = createApp();

  let adminAccessToken: string;
  let clienteAccessToken: string;

  beforeAll(async () => {
    await getDbPool();

    // 1. Iniciar sesión como Administrador
    const resAdmin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        correo: "admin@shopcart.com",
        password: "Admin1234!",
      });

    expect(resAdmin.status).toBe(200);
    adminAccessToken = resAdmin.body.datos.accessToken;

    // 2. Registrar un Cliente para pruebas de autorización
    const resCliente = await request(app)
      .post("/api/v1/auth/registro")
      .send({
        nombre: "Audit",
        apellido: "Test",
        correo: `audit.test.${Date.now()}@shopcart.com`,
        password: "Password123!",
        telefono: "+50255556666",
      });

    expect(resCliente.status).toBe(201);
    clienteAccessToken = resCliente.body.datos.accessToken;
  });

  afterAll(async () => {
    await closeDbPool();
  });

  // ==========================================
  // CATÁLOGOS DE ROLES Y PERMISOS
  // ==========================================

  it("1. Catálogos: Debe rechazar la consulta sin token (401)", async () => {
    const res = await request(app).get("/api/v1/catalogos/roles");
    expect(res.status).toBe(401);
  });

  it("2. Catálogos: Debe denegar el acceso a un Cliente (403)", async () => {
    const res = await request(app)
      .get("/api/v1/catalogos/roles")
      .set("Authorization", `Bearer ${clienteAccessToken}`);
    expect(res.status).toBe(403);
  });

  it("3. Catálogos: Administrador debe listar los roles del sistema (200)", async () => {
    const res = await request(app)
      .get("/api/v1/catalogos/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(Array.isArray(res.body.datos)).toBe(true);
    expect(res.body.datos.length).toBe(3);

    const nombresRoles = res.body.datos.map((r: { nombre: string }) => r.nombre);
    expect(nombresRoles).toContain("Cliente");
    expect(nombresRoles).toContain("Operador");
    expect(nombresRoles).toContain("Administrador");
  });

  it("4. Catálogos: Administrador debe listar los permisos del sistema (200)", async () => {
    const res = await request(app)
      .get("/api/v1/catalogos/permisos")
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(Array.isArray(res.body.datos)).toBe(true);
    expect(res.body.datos.length).toBe(15);

    const codigos = res.body.datos.map((p: { codigo: string }) => p.codigo);
    expect(codigos).toContain("audit.read");
    expect(codigos).toContain("users.manage");
    expect(codigos).toContain("checkout.create");
  });

  // ==========================================
  // BITÁCORA INMUTABLE (RF-09)
  // ==========================================

  it("5. Bitácora: Debe rechazar la consulta sin token (401)", async () => {
    const res = await request(app).get("/api/v1/bitacora");
    expect(res.status).toBe(401);
  });

  it("6. Bitácora: Debe denegar el acceso a un Cliente (403)", async () => {
    const res = await request(app)
      .get("/api/v1/bitacora")
      .set("Authorization", `Bearer ${clienteAccessToken}`);
    expect(res.status).toBe(403);
  });

  it("7. Bitácora: Administrador debe listar eventos con paginación del servidor (200)", async () => {
    const res = await request(app)
      .get("/api/v1/bitacora?pagina=1&limite=10")
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(Array.isArray(res.body.datos)).toBe(true);
    expect(res.body.paginacion).toBeDefined();
    expect(res.body.paginacion.paginaActual).toBe(1);
    expect(res.body.paginacion.limite).toBe(10);
    expect(typeof res.body.paginacion.totalRegistros).toBe("number");
  });

  it("8. Bitácora: Debe permitir filtrar por módulo y texto (200)", async () => {
    const res = await request(app)
      .get("/api/v1/bitacora?modulo=SEGURIDAD")
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(Array.isArray(res.body.datos)).toBe(true);
  });
});
