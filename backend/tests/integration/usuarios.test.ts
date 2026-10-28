import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { getDbPool, closeDbPool } from "../../src/config/database";

describe("Módulo de Administración de Usuarios (RF-01, RF-09)", () => {
  const app = createApp();

  let adminAccessToken: string;
  let adminId: number;
  let clienteAccessToken: string;
  let usuarioObjetivoId: number;

  beforeAll(async () => {
    await getDbPool();

    // 1. Obtener token de Administrador
    const resAdmin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        correo: "admin@shopcart.com",
        password: "Admin1234!",
      });

    expect(resAdmin.status).toBe(200);
    adminAccessToken = resAdmin.body.datos.accessToken;
    adminId = resAdmin.body.datos.usuario.idUsuario;

    // 2. Registrar cliente de prueba para tests de autorización y modificación
    const emailCliente = `usuario.test.${Date.now()}@shopcart.com`;
    const resCliente = await request(app)
      .post("/api/v1/auth/registro")
      .send({
        nombre: "Test",
        apellido: "Objetivo",
        correo: emailCliente,
        password: "Password123!",
        telefono: "+50212345678",
      });

    expect(resCliente.status).toBe(201);
    clienteAccessToken = resCliente.body.datos.accessToken;
    usuarioObjetivoId = resCliente.body.datos.usuario.idUsuario;
  });

  afterAll(async () => {
    await closeDbPool();
  });

  it("1. Debe rechazar la consulta de usuarios sin token (401)", async () => {
    const res = await request(app).get("/api/v1/usuarios");
    expect(res.status).toBe(401);
    expect(res.body.exito).toBe(false);
  });

  it("2. Debe denegar el acceso a un usuario con rol Cliente (403)", async () => {
    const res = await request(app)
      .get("/api/v1/usuarios")
      .set("Authorization", `Bearer ${clienteAccessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.exito).toBe(false);
  });

  it("3. Debe permitir al Administrador listar usuarios con paginación del servidor (200)", async () => {
    const res = await request(app)
      .get("/api/v1/usuarios?pagina=1&limite=5")
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(Array.isArray(res.body.datos)).toBe(true);
    expect(res.body.paginacion).toBeDefined();
    expect(res.body.paginacion.paginaActual).toBe(1);
    expect(res.body.paginacion.limite).toBe(5);
    expect(res.body.paginacion.totalRegistros).toBeGreaterThan(0);
  });

  it("4. Debe filtrar usuarios por rol y por búsqueda de texto (200)", async () => {
    const res = await request(app)
      .get("/api/v1/usuarios?rol=Administrador&busqueda=admin")
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.length).toBeGreaterThan(0);
    expect(res.body.datos[0].correo).toContain("admin");
  });

  it("5. Debe obtener el detalle de un usuario por su ID (200)", async () => {
    const res = await request(app)
      .get(`/api/v1/usuarios/${usuarioObjetivoId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.idUsuario).toBe(usuarioObjetivoId);
    expect(res.body.datos.nombreRol).toBe("Cliente");
    expect(Array.isArray(res.body.datos.direcciones)).toBe(true);
  });

  it("6. Debe permitir al Administrador actualizar los datos del usuario (200)", async () => {
    const res = await request(app)
      .put(`/api/v1/usuarios/${usuarioObjetivoId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        nombres: "Test Modificado",
        apellidos: "Apellido Modificado",
        idRol: 1, // Rol Cliente
        telefono: "+50299998888",
      });

    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.nombres).toBe("Test Modificado");
    expect(res.body.datos.telefono).toBe("+50299998888");
  });

  it("7. No debe permitir que un Administrador desactive su propia cuenta (400)", async () => {
    const res = await request(app)
      .patch(`/api/v1/usuarios/${adminId}/estado`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ estaActivo: false });

    expect([400, 422, 500]).toContain(res.status);
    expect(res.body.exito).toBe(false);
  });

  it("8. Debe permitir desactivar y reactivar al usuario objetivo sin borrado físico (200)", async () => {
    // Desactivar
    const resDesactivar = await request(app)
      .patch(`/api/v1/usuarios/${usuarioObjetivoId}/estado`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ estaActivo: false });

    expect(resDesactivar.status).toBe(200);
    expect(resDesactivar.body.exito).toBe(true);
    expect(resDesactivar.body.datos.estaActivo).toBe(false);

    // Reactivar
    const resActivar = await request(app)
      .patch(`/api/v1/usuarios/${usuarioObjetivoId}/estado`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ estaActivo: true });

    expect(resActivar.status).toBe(200);
    expect(resActivar.body.exito).toBe(true);
    expect(resActivar.body.datos.estaActivo).toBe(true);
  });

  it("9. (Opción A - SoD) Debe rechazar la promoción de un usuario con rol Cliente a Administrador (422)", async () => {
    const res = await request(app)
      .put(`/api/v1/usuarios/${usuarioObjetivoId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        nombres: "Test Modificado",
        apellidos: "Apellido Modificado",
        idRol: 3, // Rol Administrador
        telefono: "+50299998888",
      });

    expect([400, 422]).toContain(res.status);
    expect(res.body.exito).toBe(false);
    expect(res.body.mensaje).toMatch(/segregación de funciones|SoD|personal interno/i);
  });

  it("9b. (Opción A - SoD) Debe rechazar también la promoción de un usuario con rol Cliente a Operador (422)", async () => {
    const res = await request(app)
      .put(`/api/v1/usuarios/${usuarioObjetivoId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        nombres: "Test Modificado",
        apellidos: "Apellido Modificado",
        idRol: 2, // Rol Operador
        telefono: "+50299998888",
      });

    expect([400, 422]).toContain(res.status);
    expect(res.body.exito).toBe(false);
    expect(res.body.mensaje).toMatch(/segregación de funciones|SoD|personal interno/i);
  });


  it("10. No debe permitir que un Administrador degrade su propio rol de Administrador (422)", async () => {
    const res = await request(app)
      .put(`/api/v1/usuarios/${adminId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        nombres: "Admin",
        apellidos: "Principal",
        idRol: 2, // Intentar degradarse a Operador
        telefono: "+50212345678",
      });

    expect([400, 422]).toContain(res.status);
    expect(res.body.exito).toBe(false);
    expect(res.body.mensaje).toMatch(/No puedes quitarte el rol de Administrador/i);
  });

  it("11. Debe permitir al Administrador dar de alta un nuevo Operador de almacén (201)", async () => {
    const emailOperador = `operador.nuevo.${Date.now()}@shopcart.com`;
    const res = await request(app)
      .post("/api/v1/usuarios")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        nombres: "Carlos",
        apellidos: "Logística",
        correo: emailOperador,
        nombreRol: "Operador",
        password: "Password123!",
        telefono: "+50255551234",
      });

    expect(res.status).toBe(201);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.nombreRol).toBe("Operador");
    expect(res.body.datos.correo).toBe(emailOperador);
  });

  it("12. Debe permitir al Administrador dar de alta un nuevo Administrador corporativo (201)", async () => {
    const emailAdmin = `admin.nuevo.${Date.now()}@shopcart.com`;
    const res = await request(app)
      .post("/api/v1/usuarios")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        nombres: "Mariana",
        apellidos: "Gerencia",
        correo: emailAdmin,
        nombreRol: "Administrador",
        password: "AdminPassword123!",
        telefono: "+50255555678",
      });

    expect(res.status).toBe(201);
    expect(res.body.exito).toBe(true);
    expect(res.body.datos.nombreRol).toBe("Administrador");
    expect(res.body.datos.correo).toBe(emailAdmin);
  });

  it("13. No debe permitir crear un usuario con rol 'Cliente' en el endpoint administrativo (422)", async () => {
    const res = await request(app)
      .post("/api/v1/usuarios")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        nombres: "Falso",
        apellidos: "Cliente",
        correo: `cliente.intento.${Date.now()}@shopcart.com`,
        nombreRol: "Cliente",
        password: "Password123!",
      });

    expect(res.status).toBe(422);
    expect(res.body.exito).toBe(false);
  });

  it("14. Debe rechazar la creación si el correo ya existe en el sistema (409)", async () => {
    const res = await request(app)
      .post("/api/v1/usuarios")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        nombres: "Duplicado",
        apellidos: "Prueba",
        correo: "admin@shopcart.com", // Ya existente
        nombreRol: "Operador",
        password: "Password123!",
      });

    expect(res.status).toBe(409);
    expect(res.body.exito).toBe(false);
  });
});


