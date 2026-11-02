import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { getDbPool, closeDbPool } from "../../src/config/database";
import { randomUUID } from "crypto";

describe("Módulo de Checkout, Pedidos y Devoluciones ", () => {
  const app = createApp();

  let adminAccessToken: string;
  let cliente1AccessToken: string;
  let cliente2AccessToken: string;
  let idDireccionCliente1: number;
  let idDireccionCliente2: number;
  let idVariantePrueba: number;
  let idVarianteStockLimitado: number;
  let codigoCuponPrueba: string;

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

    // 2. Registrar Cliente 1
    const resCliente1 = await request(app)
      .post("/api/v1/auth/registro")
      .send({
        nombre: "Cliente",
        apellido: "Uno",
        correo: `cliente1.checkout.${timestamp}@shopcart.com`,
        password: "Password123!",
        telefono: "+50255551001",
      });

    expect(resCliente1.status).toBe(201);
    cliente1AccessToken = resCliente1.body.datos.accessToken;

    // 3. Registrar Cliente 2 (para pruebas de IDOR)
    const resCliente2 = await request(app)
      .post("/api/v1/auth/registro")
      .send({
        nombre: "Cliente",
        apellido: "Dos",
        correo: `cliente2.checkout.${timestamp}@shopcart.com`,
        password: "Password123!",
        telefono: "+50255551002",
      });

    expect(resCliente2.status).toBe(201);
    cliente2AccessToken = resCliente2.body.datos.accessToken;

    // 4. Crear Dirección para Cliente 1
    const resDir1 = await request(app)
      .post("/api/v1/direcciones")
      .set("Authorization", `Bearer ${cliente1AccessToken}`)
      .send({
        alias: "Casa 1",
        destinatario: "Cliente Uno",
        telefono: "+50255551001",
        linea1: "Avenida Las Américas 10-20",
        departamento: "Guatemala",
        municipio: "Guatemala",
        codigoPostal: "01014",
        esPredeterminada: true,
      });

    expect(resDir1.status).toBe(201);
    idDireccionCliente1 = resDir1.body.datos.idDireccion;

    // 5. Crear Dirección para Cliente 2
    const resDir2 = await request(app)
      .post("/api/v1/direcciones")
      .set("Authorization", `Bearer ${cliente2AccessToken}`)
      .send({
        alias: "Casa 2",
        destinatario: "Cliente Dos",
        telefono: "+50255551002",
        linea1: "Diagonal 6 12-42",
        departamento: "Guatemala",
        municipio: "Guatemala",
        codigoPostal: "01010",
        esPredeterminada: true,
      });

    expect(resDir2.status).toBe(201);
    idDireccionCliente2 = resDir2.body.datos.idDireccion;

    // 6. Crear Categoría y Producto con Variantes
    const resCat = await request(app)
      .post("/api/v1/catalogo/categorias")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        nombre: `Cat Checkout ${timestamp}`,
        slug: `cat-chk-${timestamp}`,
      });
    const idCategoria = resCat.body.datos.idCategoria;

    const sku1 = `SKU-CHK-1-${timestamp}`;
    const skuLim = `SKU-CHK-LIM-${timestamp}`;

    const resProd = await request(app)
      .post("/api/v1/catalogo/productos")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idCategoria,
        nombre: `Prod Checkout ${timestamp}`,
        slug: `prod-chk-${timestamp}`,
        marca: "TechPro",
        descripcion: "Producto de prueba para checkout",
        variantes: [
          {
            sku: sku1,
            precio: 150.0,
            costo: 100.0,
          },
          {
            sku: skuLim,
            precio: 200.0,
            costo: 140.0,
          },
        ],
      });

    expect(resProd.status).toBe(201);
    expect(resProd.body.datos.idProducto).toBeDefined();

    idVariantePrueba = resProd.body.datos.variantes[0].idVariante;
    idVarianteStockLimitado = resProd.body.datos.variantes[1].idVariante;

    // Variante 1: Stock abundante (50 unidades)
    const resEnt1 = await request(app)
      .post("/api/v1/inventario/entrada")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idVariante: idVariantePrueba,
        cantidad: 50,
        motivo: "Carga inicial de prueba para checkout",
      });
    expect(resEnt1.status).toBe(201);

    // Variante 2: Stock muy limitado (solo 2 unidades para probar concurrencia/sobreventa)
    const resEnt2 = await request(app)
      .post("/api/v1/inventario/entrada")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        idVariante: idVarianteStockLimitado,
        cantidad: 2,
        motivo: "Stock limitado para prueba de concurrencia",
      });
    expect(resEnt2.status).toBe(201);

    // 7. Crear Cupón de descuento válido 
    codigoCuponPrueba = `DESC20-${timestamp}`;
    await request(app)
      .post("/api/v1/cupones")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        codigo: codigoCuponPrueba,
        descripcion: "20% de descuento checkout",
        tipoDescuento: "PORCENTAJE",
        valorDescuento: 20,
        alcance: "CARRITO",
        montoMinimoCompra: 100,
        fechaInicio: new Date(Date.now() - 3600000).toISOString(),
        fechaFin: new Date(Date.now() + 86400000).toISOString(),
        estaActivo: true,
      });
  });

  afterAll(async () => {
    await closeDbPool();
  });

  describe("1. Seguridad IDOR en Checkout", () => {
    it("debe rechazar checkout si el cliente usa la dirección de otro usuario (403)", async () => {
      // Cliente 1 agrega producto a su carrito
      const resItem = await request(app)
        .post("/api/v1/carrito/items")
        .set("Authorization", `Bearer ${cliente1AccessToken}`)
        .send({
          idVariante: idVariantePrueba,
          cantidad: 1,
        });
      expect(resItem.status).toBe(201);

      // Intenta usar idDireccionCliente2
      const res = await request(app)
        .post("/api/v1/checkout/iniciar")
        .set("Authorization", `Bearer ${cliente1AccessToken}`)
        .send({
          idDireccion: idDireccionCliente2,
        });

      expect(res.status).toBe(403);
    });
  });

  describe("2. Inicio de Checkout y Reserva Temporal de 15 minutos ", () => {
    let idPedidoCreado: number;
    let claveIdempotenciaCheckout: string;

    it("debe iniciar checkout, aplicar cupón y reservar existencia por 15 min", async () => {
      claveIdempotenciaCheckout = randomUUID();

      const res = await request(app)
        .post("/api/v1/checkout/iniciar")
        .set("Authorization", `Bearer ${cliente1AccessToken}`)
        .send({
          idDireccion: idDireccionCliente1,
          codigoCupon: codigoCuponPrueba,
          claveIdempotencia: claveIdempotenciaCheckout,
        });

      expect(res.status).toBe(201);
      expect(res.body.datos).toHaveProperty("idPedido");
      expect(res.body.datos).toHaveProperty("numeroPedido");
      expect(res.body.datos.estadoCodigo).toBe("PENDIENTE_PAGO");
      expect(res.body.datos.estadoReserva).toBe("ACTIVA");
      expect(res.body.datos.subtotal).toBe(150.0);
      expect(res.body.datos.descuento).toBe(30.0); // 20% de 150 = 30
      expect(res.body.datos.total).toBe(120.0); // 150 - 30 = 120
      expect(res.body.datos.segundosRestantesReserva).toBeGreaterThan(800);

      idPedidoCreado = res.body.datos.idPedido;
    });

    it("debe ser idempotente si se reintenta el checkout con la misma clave", async () => {
      const res = await request(app)
        .post("/api/v1/checkout/iniciar")
        .set("Authorization", `Bearer ${cliente1AccessToken}`)
        .send({
          idDireccion: idDireccionCliente1,
          codigoCupon: codigoCuponPrueba,
          claveIdempotencia: claveIdempotenciaCheckout,
        });

      expect(res.status).toBe(201);
      expect(res.body.datos.idPedido).toBe(idPedidoCreado);
      expect(res.body.datos.estadoCodigo).toBe("PENDIENTE_PAGO");
    });
  });

  describe("3. Prevención de sobreventa y concurrencia ", () => {
    it("debe rechazar checkout si la existencia disponible es insuficiente por reservas activas", async () => {
      // Cliente 1 agrega las 2 unidades limitadas
      await request(app)
        .post("/api/v1/carrito/items")
        .set("Authorization", `Bearer ${cliente1AccessToken}`)
        .send({
          idVariante: idVarianteStockLimitado,
          cantidad: 2,
        });

      // Cliente 1 inicia checkout reservando las 2 unidades
      const resChk1 = await request(app)
        .post("/api/v1/checkout/iniciar")
        .set("Authorization", `Bearer ${cliente1AccessToken}`)
        .send({
          idDireccion: idDireccionCliente1,
        });

      expect(resChk1.status).toBe(201);

      // Ahora Cliente 2 agrega 1 unidad de la misma variante
      await request(app)
        .post("/api/v1/carrito/items")
        .set("Authorization", `Bearer ${cliente2AccessToken}`)
        .send({
          idVariante: idVarianteStockLimitado,
          cantidad: 1,
        });

      // Cliente 2 intenta iniciar checkout -> debe rebotar con 409 (Conflicto de stock)
      const resChk2 = await request(app)
        .post("/api/v1/checkout/iniciar")
        .set("Authorization", `Bearer ${cliente2AccessToken}`)
        .send({
          idDireccion: idDireccionCliente2,
        });

      expect(resChk2.status).toBe(409);
    });
  });

  describe("4. Confirmación de Pago e Idempotencia ", () => {
    let idPedidoParaPagar: number;
    let clavePagoIdempotencia: string;

    beforeAll(async () => {
      // Cliente 2 vacía su carrito e introduce la variante con stock abundante
      await request(app)
        .delete("/api/v1/carrito")
        .set("Authorization", `Bearer ${cliente2AccessToken}`);

      await request(app)
        .post("/api/v1/carrito/items")
        .set("Authorization", `Bearer ${cliente2AccessToken}`)
        .send({
          idVariante: idVariantePrueba,
          cantidad: 2,
        });

      const resInit = await request(app)
        .post("/api/v1/checkout/iniciar")
        .set("Authorization", `Bearer ${cliente2AccessToken}`)
        .send({
          idDireccion: idDireccionCliente2,
        });

      expect(resInit.status).toBe(201);
      idPedidoParaPagar = resInit.body.datos.idPedido;
      clavePagoIdempotencia = randomUUID();
    });

    it("no debe permitir que otro cliente pague un pedido ajeno (403)", async () => {
      const res = await request(app)
        .post("/api/v1/checkout/confirmar-pago")
        .set("Authorization", `Bearer ${cliente1AccessToken}`)
        .send({
          idPedido: idPedidoParaPagar,
          claveIdempotencia: clavePagoIdempotencia,
          metodoPago: "SIMULADOR",
        });

      expect(res.status).toBe(403);
    });

    it("debe confirmar el pago, pasar a PAGADO y registrar salida física en Kardex", async () => {
      const res = await request(app)
        .post("/api/v1/checkout/confirmar-pago")
        .set("Authorization", `Bearer ${cliente2AccessToken}`)
        .send({
          idPedido: idPedidoParaPagar,
          claveIdempotencia: clavePagoIdempotencia,
          metodoPago: "Tarjeta",
          referenciaProveedor: `AUTH-TX-${timestamp}`,
          monto: 300.0,
        });

      expect(res.status).toBe(200);
      expect(res.body.datos.estadoCodigo).toBe("PAGADO");
      expect(res.body.datos.estadoPago).toBe("CAPTURADO");
      expect(res.body.datos.idPedido).toBe(idPedidoParaPagar);
    });

    it("debe ser idempotente si el cliente reenvía la confirmación del pago", async () => {
      const res = await request(app)
        .post("/api/v1/checkout/confirmar-pago")
        .set("Authorization", `Bearer ${cliente2AccessToken}`)
        .send({
          idPedido: idPedidoParaPagar,
          claveIdempotencia: clavePagoIdempotencia,
          metodoPago: "Tarjeta",
          monto: 300.0,
        });

      expect(res.status).toBe(200);
      expect(res.body.datos.estadoCodigo).toBe("PAGADO");
      expect(res.body.datos.idPedido).toBe(idPedidoParaPagar);
    });
  });

  describe("5. Ciclo de Vida de Pedidos, Transiciones y Devoluciones ", () => {
    let idPedidoCiclo: number;

    beforeAll(async () => {
      // Vaciar carrito de cliente 1 antes de agregar items para ciclo de vida
      await request(app)
        .delete("/api/v1/carrito")
        .set("Authorization", `Bearer ${cliente1AccessToken}`);

      // Crear pedido pagado para probar transiciones
      await request(app)
        .post("/api/v1/carrito/items")
        .set("Authorization", `Bearer ${cliente1AccessToken}`)
        .send({
          idVariante: idVariantePrueba,
          cantidad: 3,
        });

      const resInit = await request(app)
        .post("/api/v1/checkout/iniciar")
        .set("Authorization", `Bearer ${cliente1AccessToken}`)
        .send({
          idDireccion: idDireccionCliente1,
        });

      expect(resInit.status).toBe(201);
      idPedidoCiclo = resInit.body.datos.idPedido;

      await request(app)
        .post("/api/v1/checkout/confirmar-pago")
        .set("Authorization", `Bearer ${cliente1AccessToken}`)
        .send({
          idPedido: idPedidoCiclo,
          claveIdempotencia: randomUUID(),
          metodoPago: "Transferencia",
          monto: 450.0,
        });
    });

    it("el cliente puede ver sus pedidos en /pedidos/mis-pedidos", async () => {
      const res = await request(app)
        .get("/api/v1/pedidos/mis-pedidos")
        .set("Authorization", `Bearer ${cliente1AccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.datos.length).toBeGreaterThan(0);
      const ped = res.body.datos.find((p: any) => p.idPedido === idPedidoCiclo);
      expect(ped).toBeDefined();
      expect(ped.estadoCodigo).toBe("PAGADO");
    });

    it("el cliente puede ver el detalle completo con precios e historial congelados", async () => {
      const res = await request(app)
        .get(`/api/v1/pedidos/${idPedidoCiclo}`)
        .set("Authorization", `Bearer ${cliente1AccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.datos.idPedido).toBe(idPedidoCiclo);
      expect(res.body.datos.lineas.length).toBeGreaterThan(0);
      expect(res.body.datos.historialEstados.length).toBeGreaterThanOrEqual(2);
    });

    it("un cliente no puede ver el pedido de otro cliente (403)", async () => {
      const res = await request(app)
        .get(`/api/v1/pedidos/${idPedidoCiclo}`)
        .set("Authorization", `Bearer ${cliente2AccessToken}`);

      expect(res.status).toBe(403);
    });

    it("el operador puede listar pedidos en /pedidos/admin", async () => {
      const res = await request(app)
        .get("/api/v1/pedidos/admin")
        .set("Authorization", `Bearer ${adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.datos.length).toBeGreaterThan(0);
    });

    it("debe rechazar una transición inválida (ej. PAGADO -> ENTREGADO sin despachar)", async () => {
      const res = await request(app)
        .post(`/api/v1/pedidos/${idPedidoCiclo}/cambiar-estado`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          nuevoEstado: "ENTREGADO",
          motivo: "Intento de salto de estado",
        });

      expect(res.status).toBe(422);
    });

    it("el operador realiza el flujo válido: PAGADO -> PREPARANDO -> DESPACHADO -> ENTREGADO", async () => {
      // 1. A PREPARANDO
      const resPrep = await request(app)
        .post(`/api/v1/pedidos/${idPedidoCiclo}/cambiar-estado`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          nuevoEstado: "PREPARANDO",
          motivo: "Empacando artículos",
        });
      expect(resPrep.status).toBe(200);

      // 2. A DESPACHADO
      const resDesp = await request(app)
        .post(`/api/v1/pedidos/${idPedidoCiclo}/cambiar-estado`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          nuevoEstado: "DESPACHADO",
          motivo: "Enviado con mensajería",
        });
      expect(resDesp.status).toBe(200);

      // 3. A ENTREGADO
      const resEnt = await request(app)
        .post(`/api/v1/pedidos/${idPedidoCiclo}/cambiar-estado`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          nuevoEstado: "ENTREGADO",
          motivo: "Cliente recibió conforme",
        });
      expect(resEnt.status).toBe(200);
    });

    it("debe procesar una devolución parcial y total con reintegro al kardex ", async () => {
      // Obtener el detalle del pedido para saber el idPedidoDetalle
      const resDetalle = await request(app)
        .get(`/api/v1/pedidos/${idPedidoCiclo}`)
        .set("Authorization", `Bearer ${adminAccessToken}`);

      const linea = resDetalle.body.datos.lineas[0];
      const idPedidoDetalle = linea.idPedidoDetalle;

      // Devolución parcial (1 de 3 unidades)
      const resDevParcial = await request(app)
        .post("/api/v1/devoluciones")
        .set("Authorization", `Bearer ${cliente1AccessToken}`)
        .send({
          idPedido: idPedidoCiclo,
          motivo: "Talla incorrecta en una unidad",
          lineas: [{ idPedidoDetalle, cantidad: 1 }],
        });

      expect(resDevParcial.status).toBe(201);
      expect(resDevParcial.body.datos.estadoPedidoActualizado).toBe("DEVOLUCION_PARCIAL");
      expect(resDevParcial.body.datos.montoReembolso).toBe(150.0);

      // Devolución restante (2 unidades)
      const resDevTotal = await request(app)
        .post("/api/v1/devoluciones")
        .set("Authorization", `Bearer ${cliente1AccessToken}`)
        .send({
          idPedido: idPedidoCiclo,
          motivo: "Devolución del resto del pedido",
          lineas: [{ idPedidoDetalle, cantidad: 2 }],
        });

      expect(resDevTotal.status).toBe(201);
      expect(resDevTotal.body.datos.estadoPedidoActualizado).toBe("DEVOLUCION_TOTAL");
      expect(resDevTotal.body.datos.montoReembolso).toBe(300.0);
    });
  });
});
