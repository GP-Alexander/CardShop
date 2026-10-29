import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { getDbPool, closeDbPool } from "../../src/config/database";
import { randomUUID } from "crypto";

describe("Módulo de Dashboard y Reportes Operativos (RF-08)", () => {
  const app = createApp();

  let adminAccessToken: string;
  let clienteAccessToken: string;
  let idProductoPrueba: number;
  let idVariantePrueba: number;
  let idPedidoPrueba: number;

  const timestamp = Date.now();

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

    // 2. Registrar un Cliente
    const resCliente = await request(app)
      .post("/api/v1/auth/registro")
      .send({
        nombre: "Cliente",
        apellido: "Reportes",
        correo: `cliente.reportes.${timestamp}@shopcart.com`,
        password: "Password123!",
        telefono: "+50255559001",
      });

    expect(resCliente.status).toBe(201);
    clienteAccessToken = resCliente.body.datos.accessToken;

    // 3. Crear Producto y Variante para asegurar datos de prueba
    const pool = await getDbPool();
    const catRes = await pool.request().query("SELECT TOP 1 IDCategoria FROM dbo.Categoria WHERE EstaActiva = 1");
    const idCategoria = catRes.recordset[0].IDCategoria;

    const resProd = await request(app)
      .post("/api/v1/catalogo/productos")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idCategoria,
        nombre: `Producto Reportes ${timestamp}`,
        slug: `producto-reportes-${timestamp}`,
        descripcion: "Producto para verificación de reportes",
        marca: "ShopCart Brand",
        variantes: [
          {
            sku: `REP-${timestamp}-01`,
            precio: 150.0,
            pesoKg: 0.5,
          },
        ],
      });

    expect(resProd.status).toBe(201);
    idProductoPrueba = resProd.body.datos.idProducto;
    idVariantePrueba = resProd.body.datos.variantes[0].idVariante;

    // Ingresar inventario
    const almRes = await pool.request().query("SELECT TOP 1 IDAlmacen FROM dbo.Almacen WHERE EstaActivo = 1");
    const idAlmacen = almRes.recordset[0].IDAlmacen;

    await request(app)
      .post("/api/v1/inventario/entrada")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idVariante: idVariantePrueba,
        idAlmacen,
        cantidad: 50,
        motivo: "Stock inicial para pruebas de reportes",
      });

    // 4. Crear Dirección para el Cliente
    const resDir = await request(app)
      .post("/api/v1/direcciones")
      .set("Authorization", `Bearer ${clienteAccessToken}`)
      .send({
        alias: "Casa Reportes",
        destinatario: "Cliente Reportes",
        telefono: "+50255559001",
        linea1: "Calle de Reportes 1-23",
        departamento: "Guatemala",
        municipio: "Guatemala",
        codigoPostal: "01001",
        esPredeterminada: true,
      });

    const idDireccion = resDir.body.datos.idDireccion;

    // 5. Agregar al carrito y hacer checkout completo
    await request(app)
      .post("/api/v1/carrito/items")
      .set("Authorization", `Bearer ${clienteAccessToken}`)
      .send({
        idVariante: idVariantePrueba,
        cantidad: 2,
      });

    const resCheckout = await request(app)
      .post("/api/v1/checkout/iniciar")
      .set("Authorization", `Bearer ${clienteAccessToken}`)
      .send({
        idDireccion,
        claveIdempotencia: `IDEMP-REP-CHK-${timestamp}`,
      });

    expect(resCheckout.status).toBe(201);
    idPedidoPrueba = resCheckout.body.datos.idPedido;

    // Confirmar pago del pedido
    const resPago = await request(app)
      .post("/api/v1/checkout/confirmar-pago")
      .set("Authorization", `Bearer ${clienteAccessToken}`)
      .send({
        idPedido: idPedidoPrueba,
        metodoPago: "CYBERSOURCE",
        referenciaProveedor: `AUTH-REP-${timestamp}`,
        claveIdempotencia: `IDEMP-REP-PAY-${timestamp}`,
      });

    expect(resPago.status).toBe(200);
  });

  afterAll(async () => {
    await closeDbPool();
  });

  describe("1. Control de Acceso y RBAC", () => {
    it("debe rechazar solicitudes anónimas con 401 Unauthorized", async () => {
      const res = await request(app).get("/api/v1/reportes/dashboard");
      expect(res.status).toBe(401);
    });

    it("debe rechazar a usuarios con rol Cliente con 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/reportes/dashboard")
        .set("Authorization", `Bearer ${clienteAccessToken}`);

      expect(res.status).toBe(403);
    });

    it("debe permitir acceso a usuarios con rol Administrador", async () => {
      const res = await request(app)
        .get("/api/v1/reportes/dashboard")
        .set("Authorization", `Bearer ${adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.exito).toBe(true);
    });
  });

  describe("2. Dashboard Resumen Ejecutivo", () => {
    it("debe retornar los KPIs principales del día, mes y carritos abandonados", async () => {
      const res = await request(app)
        .get("/api/v1/reportes/dashboard")
        .set("Authorization", `Bearer ${adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.exito).toBe(true);

      const { datos } = res.body;
      expect(datos).toHaveProperty("ventasHoy");
      expect(datos).toHaveProperty("pedidosHoy");
      expect(datos).toHaveProperty("ticketPromedioMes");
      expect(datos).toHaveProperty("carritosAbandonadosPeriodo");

      expect(typeof datos.ventasHoy).toBe("number");
      expect(typeof datos.pedidosHoy).toBe("number");
      expect(typeof datos.ticketPromedioMes).toBe("number");
      expect(typeof datos.carritosAbandonadosPeriodo).toBe("number");

      // Verificamos que al menos nuestro pedido de hoy esté contabilizado
      expect(datos.pedidosHoy).toBeGreaterThanOrEqual(1);
      expect(datos.ventasHoy).toBeGreaterThan(0);

      // Verificamos que incluya los arreglos auxiliares
      expect(Array.isArray(datos.ventasPorPeriodo)).toBe(true);
      expect(Array.isArray(datos.ventasPorCategoria)).toBe(true);
      expect(Array.isArray(datos.topProductos)).toBe(true);
    });
  });

  describe("3. Reporte de Ventas por Período y Ticket Promedio", () => {
    it("debe agrupar ventas por día y calcular el ticket promedio correctamente", async () => {
      const res = await request(app)
        .get("/api/v1/reportes/ventas-periodo?agrupacion=dia")
        .set("Authorization", `Bearer ${adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.exito).toBe(true);
      expect(Array.isArray(res.body.datos)).toBe(true);

      const items = res.body.datos;
      expect(items.length).toBeGreaterThan(0);

      for (const item of items) {
        expect(item).toHaveProperty("periodo");
        expect(item).toHaveProperty("totalVentas");
        expect(item).toHaveProperty("totalPedidos");
        expect(item).toHaveProperty("ticketPromedio");

        if (item.totalPedidos > 0) {
          const esperadoTicket = Math.round((item.totalVentas / item.totalPedidos) * 100) / 100;
          expect(Math.abs(item.ticketPromedio - esperadoTicket)).toBeLessThanOrEqual(0.02);
        }
      }
    });

    it("debe soportar agrupación por mes", async () => {
      const res = await request(app)
        .get("/api/v1/reportes/ventas-periodo?agrupacion=mes")
        .set("Authorization", `Bearer ${adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.exito).toBe(true);
      expect(Array.isArray(res.body.datos)).toBe(true);

      const mesActual = new Date().toISOString().substring(0, 7);
      const registroMes = res.body.datos.find((d: any) => d.periodo === mesActual);
      expect(registroMes).toBeDefined();
      expect(registroMes.totalPedidos).toBeGreaterThanOrEqual(1);
    });
  });

  describe("4. Regla de Negocio: Exclusión de Cancelados y Deducción de Reembolsos", () => {
    it("no debe contabilizar pedidos cancelados en el reporte de ventas", async () => {
      const pool = await getDbPool();

      // Consultar ventas antes de insertar pedido cancelado
      const resAntes = await request(app)
        .get("/api/v1/reportes/dashboard")
        .set("Authorization", `Bearer ${adminAccessToken}`);

      const ventasAntes = resAntes.body.datos.ventasHoy;
      const pedidosAntes = resAntes.body.datos.pedidosHoy;

      // Insertar un pedido directamente en estado CANCELADO (o con FechaPago NULL)
      const canceladoRes = await pool.request().query(`
        DECLARE @IDCancelado BIGINT;
        DECLARE @IDEstCancelado INT = (SELECT IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = 'CANCELADO');
        DECLARE @IDDir INT = (SELECT TOP 1 IDDireccion FROM dbo.Direccion);
        DECLARE @IDUsr INT = (SELECT IDUsuario FROM dbo.Direccion WHERE IDDireccion = @IDDir);

        INSERT INTO dbo.Pedido (
          NumeroPedido, IDUsuario, IDEstadoPedido, ClaveIdempotencia, IDDireccionEnvio,
          DestinatarioSnapshot, TelefonoSnapshot, DireccionSnapshot,
          Subtotal, Descuento, CostoEnvio, Total, IVAIncluido, PorcentajeIVA, Moneda,
          FechaPago, FechaCancelacion
        )
        VALUES (
          'PED-CANCEL-${timestamp}', @IDUsr, @IDEstCancelado, 'IDEMP-CANC-${timestamp}', @IDDir,
          'Test', '123', 'Test',
          500.00, 0, 0, 500.00, 53.57, 12.00, 'GTQ',
          SYSUTCDATETIME(), SYSUTCDATETIME()
        );
      `);

      // Consultar ventas después
      const resDespues = await request(app)
        .get("/api/v1/reportes/dashboard")
        .set("Authorization", `Bearer ${adminAccessToken}`);

      const ventasDespues = resDespues.body.datos.ventasHoy;
      const pedidosDespues = resDespues.body.datos.pedidosHoy;

      // Los pedidos CANCELADO no deben alterar ventasHoy ni pedidosHoy
      expect(ventasDespues).toBe(ventasAntes);
      expect(pedidosDespues).toBe(pedidosAntes);
    });

    it("debe descontar reembolsos completados del total de ventas netas", async () => {
      const pool = await getDbPool();

      // Consultar ventas actuales
      const resAntes = await request(app)
        .get("/api/v1/reportes/dashboard")
        .set("Authorization", `Bearer ${adminAccessToken}`);

      const ventasAntes = resAntes.body.datos.ventasHoy;

      // Simular un reembolso completado para el pedido de prueba
      const montoReembolso = 50.0;
      await pool.request().query(`
        DECLARE @IDPago BIGINT = (SELECT TOP 1 IDPago FROM dbo.Pago WHERE IDPedido = ${idPedidoPrueba} AND Estado = 'CAPTURADO');
        DECLARE @IDUsr INT = (SELECT IDUsuario FROM dbo.Pedido WHERE IDPedido = ${idPedidoPrueba});

        INSERT INTO dbo.Reembolso (
          IDPago, IDPedido, IDUsuarioSolicitante, ClaveIdempotencia, Estado, Monto, Motivo, FechaSolicitud, FechaResolucion
        )
        VALUES (
          @IDPago, ${idPedidoPrueba}, @IDUsr, 'IDEMP-REF-TEST-${timestamp}', 'COMPLETADO', ${montoReembolso}, 'Reembolso de prueba', SYSUTCDATETIME(), SYSUTCDATETIME()
        );
      `);

      // Consultar ventas después del reembolso completado
      const resDespues = await request(app)
        .get("/api/v1/reportes/dashboard")
        .set("Authorization", `Bearer ${adminAccessToken}`);

      const ventasDespues = resDespues.body.datos.ventasHoy;

      // Las ventas netas deben haberse reducido exactamente por el monto del reembolso
      expect(ventasDespues).toBe(ventasAntes - montoReembolso);
    });
  });

  describe("5. Top 10 Productos Más Vendidos", () => {
    it("debe retornar los productos ordenados descendentemente por unidades vendidas", async () => {
      const res = await request(app)
        .get("/api/v1/reportes/top-productos?limite=5")
        .set("Authorization", `Bearer ${adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.exito).toBe(true);
      expect(Array.isArray(res.body.datos)).toBe(true);

      const items = res.body.datos;
      expect(items.length).toBeLessThanOrEqual(5);

      if (items.length > 0) {
        const primero = items[0];
        expect(primero).toHaveProperty("idProducto");
        expect(primero).toHaveProperty("nombreProducto");
        expect(primero).toHaveProperty("skuVariante");
        expect(primero).toHaveProperty("unidadesVendidas");
        expect(primero).toHaveProperty("totalGenerado");
        expect(primero.unidadesVendidas).toBeGreaterThan(0);
      }
    });
  });

  describe("6. Ventas por Categoría (Vista y SP)", () => {
    it("debe listar ventas netas y unidades agregadas por categoría", async () => {
      const res = await request(app)
        .get("/api/v1/reportes/ventas-categoria")
        .set("Authorization", `Bearer ${adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.exito).toBe(true);
      expect(Array.isArray(res.body.datos)).toBe(true);

      const categorias = res.body.datos;
      expect(categorias.length).toBeGreaterThan(0);

      const catConVentas = categorias.find((c: any) => c.unidadesVendidas > 0);
      expect(catConVentas).toBeDefined();
      expect(catConVentas.totalVentas).toBeGreaterThan(0);
    });
  });

  describe("7. Reporte de Carritos Abandonados", () => {
    it("debe listar carritos activos con artículos inactivos por más de N horas", async () => {
      const pool = await getDbPool();

      // Crear un carrito para el cliente y agregarle un producto
      await request(app)
        .post("/api/v1/carrito/items")
        .set("Authorization", `Bearer ${clienteAccessToken}`)
        .send({
          idVariante: idVariantePrueba,
          cantidad: 3,
        });

      // Modificar directamente FechaUltimaActividad del carrito a hace 30 horas
      await pool.request().query(`
        UPDATE dbo.Carrito 
        SET FechaUltimaActividad = DATEADD(HOUR, -30, SYSUTCDATETIME())
        WHERE IDUsuario = (SELECT IDUsuario FROM dbo.Usuario WHERE Correo = 'cliente.reportes.${timestamp}@shopcart.com')
          AND Estado = 'ACTIVO';
      `);

      // Consultar carritos abandonados con umbral de 24 horas
      const res = await request(app)
        .get("/api/v1/reportes/carritos-abandonados?horasInactividad=24&pagina=1&tamanoPagina=10")
        .set("Authorization", `Bearer ${adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.exito).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.items)).toBe(true);

      const carritoAbandonado = res.body.items.find(
        (c: any) => c.email === `cliente.reportes.${timestamp}@shopcart.com`
      );

      expect(carritoAbandonado).toBeDefined();
      expect(carritoAbandonado.totalArticulos).toBe(3);
      expect(carritoAbandonado.horasInactivo).toBeGreaterThanOrEqual(24);
      expect(carritoAbandonado.montoEstimado).toBeGreaterThan(0);
    });
  });
});
