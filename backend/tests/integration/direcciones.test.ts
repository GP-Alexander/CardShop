import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { getDbPool, closeDbPool } from "../../src/config/database";

describe("Módulo de Direcciones de Cliente y Protección Anti-IDOR (RF-01, Regla Crítica #3)", () => {
  const app = createApp();

  let clienteAToken: string;
  let clienteBToken: string;
  let direccionA1Id: number;
  let direccionA2Id: number;

  beforeAll(async () => {
    await getDbPool();

    // 1. Registrar Cliente A
    const resClienteA = await request(app)
      .post("/api/v1/auth/registro")
      .send({
        nombre: "Cliente",
        apellido: "Alpha",
        correo: `cliente.alpha.${Date.now()}@shopcart.com`,
        password: "Password123!",
        telefono: "+50211112222",
      });
    expect(resClienteA.status).toBe(201);
    clienteAToken = resClienteA.body.datos.accessToken;

    // 2. Registrar Cliente B
    const resClienteB = await request(app)
      .post("/api/v1/auth/registro")
      .send({
        nombre: "Cliente",
        apellido: "Beta",
        correo: `cliente.beta.${Date.now()}@shopcart.com`,
        password: "Password123!",
        telefono: "+50233334444",
      });
    expect(resClienteB.status).toBe(201);
    clienteBToken = resClienteB.body.datos.accessToken;
  });

  afterAll(async () => {
    await closeDbPool();
  });

  it("1. Debe rechazar cualquier operación sin token de autenticación (401)", async () => {
    const res = await request(app).get("/api/v1/direcciones");
    expect(res.status).toBe(401);
    expect(res.body.exito).toBe(false);
  });

  it("2. Debe permitir a Cliente A crear su primera dirección y asignarla como predeterminada (201)", async () => {
    const res = await request(app)
      .post("/api/v1/direcciones")
      .set("Authorization", `Bearer ${clienteAToken}`)
      .send({
        alias: "Casa",
        destinatario: "Alpha Destinatario",
        telefono: "+50211112222",
        linea1: "7ma Avenida 12-34 Zona 9",
        departamento: "Guatemala",
        municipio: "Guatemala",
        codigoPostal: "01009",
        referencia: "Frente al parque",
        esPredeterminada: false, // La primera siempre debe forzarse como default
      });

    expect(res.status).toBe(201);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.idDireccion).toBeGreaterThan(0);
    expect(res.body.datos.alias).toBe("Casa");
    expect(res.body.datos.esPredeterminada).toBe(true);

    direccionA1Id = res.body.datos.idDireccion;
  });

  it("3. Debe permitir a Cliente A crear una segunda dirección no predeterminada (201)", async () => {
    const res = await request(app)
      .post("/api/v1/direcciones")
      .set("Authorization", `Bearer ${clienteAToken}`)
      .send({
        alias: "Oficina",
        destinatario: "Alpha Trabajo",
        telefono: "+50211113333",
        linea1: "15 Calle 3-45 Zona 10",
        departamento: "Guatemala",
        municipio: "Guatemala",
        codigoPostal: "01010",
        esPredeterminada: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.alias).toBe("Oficina");
    expect(res.body.datos.esPredeterminada).toBe(false);

    direccionA2Id = res.body.datos.idDireccion;
  });

  it("4. Debe permitir a Cliente A listar sus propias direcciones (200)", async () => {
    const res = await request(app)
      .get("/api/v1/direcciones")
      .set("Authorization", `Bearer ${clienteAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(Array.isArray(res.body.datos)).toBe(true);
    expect(res.body.datos.length).toBe(2);
  });

  it("5. Debe permitir a Cliente A consultar el detalle de su propia dirección (200)", async () => {
    const res = await request(app)
      .get(`/api/v1/direcciones/${direccionA1Id}`)
      .set("Authorization", `Bearer ${clienteAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.idDireccion).toBe(direccionA1Id);
    expect(res.body.datos.destinatario).toBe("Alpha Destinatario");
  });

  // ==========================================
  // PRUEBAS DE SEGURIDAD ESTRICTA ANTI-IDOR (403)
  // ==========================================

  it("6. ANTI-IDOR: Cliente B NO debe poder consultar la dirección de Cliente A (403)", async () => {
    const res = await request(app)
      .get(`/api/v1/direcciones/${direccionA1Id}`)
      .set("Authorization", `Bearer ${clienteBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.exito).toBe(false);
  });

  it("7. ANTI-IDOR: Cliente B NO debe poder actualizar la dirección de Cliente A (403)", async () => {
    const res = await request(app)
      .put(`/api/v1/direcciones/${direccionA1Id}`)
      .set("Authorization", `Bearer ${clienteBToken}`)
      .send({
        destinatario: "Hack Intento",
        telefono: "+50299998888",
        linea1: "Calle Falsa 123",
        departamento: "Guatemala",
        municipio: "Guatemala",
      });

    expect(res.status).toBe(403);
    expect(res.body.exito).toBe(false);
  });

  it("8. ANTI-IDOR: Cliente B NO debe poder eliminar la dirección de Cliente A (403)", async () => {
    const res = await request(app)
      .delete(`/api/v1/direcciones/${direccionA1Id}`)
      .set("Authorization", `Bearer ${clienteBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.exito).toBe(false);
  });

  it("9. ANTI-IDOR: Cliente B NO debe poder establecer como predeterminada la dirección de Cliente A (403)", async () => {
    const res = await request(app)
      .patch(`/api/v1/direcciones/${direccionA1Id}/predeterminada`)
      .set("Authorization", `Bearer ${clienteBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.exito).toBe(false);
  });

  // ==========================================
  // OPERACIONES NORMALES DE CLIENTE A
  // ==========================================

  it("10. Debe permitir a Cliente A cambiar la dirección predeterminada (200)", async () => {
    const res = await request(app)
      .patch(`/api/v1/direcciones/${direccionA2Id}/predeterminada`)
      .set("Authorization", `Bearer ${clienteAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.idDireccion).toBe(direccionA2Id);
    expect(res.body.datos.esPredeterminada).toBe(true);

    // Verificar que la dirección A1 ya no sea predeterminada
    const resA1 = await request(app)
      .get(`/api/v1/direcciones/${direccionA1Id}`)
      .set("Authorization", `Bearer ${clienteAToken}`);
    expect(resA1.body.datos.esPredeterminada).toBe(false);
  });

  it("11. Debe permitir a Cliente A actualizar su propia dirección (200)", async () => {
    const res = await request(app)
      .put(`/api/v1/direcciones/${direccionA2Id}`)
      .set("Authorization", `Bearer ${clienteAToken}`)
      .send({
        alias: "Oficina Central",
        destinatario: "Alpha Trabajo Modificado",
        telefono: "+50211119999",
        linea1: "15 Calle 3-45 Edificio Reforma Zona 10",
        departamento: "Guatemala",
        municipio: "Guatemala",
      });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.alias).toBe("Oficina Central");
    expect(res.body.datos.destinatario).toBe("Alpha Trabajo Modificado");
  });

  it("12. Debe permitir a Cliente A eliminar una dirección (borrado lógico) (200)", async () => {
    const res = await request(app)
      .delete(`/api/v1/direcciones/${direccionA2Id}`)
      .set("Authorization", `Bearer ${clienteAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.idDireccion).toBe(direccionA2Id);

    // Al eliminarse la que era predeterminada, la otra activa pasa a ser predeterminada
    const resA1 = await request(app)
      .get(`/api/v1/direcciones/${direccionA1Id}`)
      .set("Authorization", `Bearer ${clienteAToken}`);
    expect(resA1.body.datos.esPredeterminada).toBe(true);
  });

  it("13. Debe devolver 404 al consultar una dirección inexistente", async () => {
    const res = await request(app)
      .get("/api/v1/direcciones/999999")
      .set("Authorization", `Bearer ${clienteAToken}`);

    expect(res.status).toBe(404);
    expect(res.body.exito).toBe(false);
  });
});
