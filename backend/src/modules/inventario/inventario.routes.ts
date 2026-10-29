import { Router } from "express";
import { InventarioController } from "./inventario.controller";
import { autenticar } from "../../shared/middlewares/autenticar";
import { autorizarPermiso } from "../../shared/middlewares/autorizar";
import { validar } from "../../shared/middlewares/validar";
import {
  ListarInventarioQuerySchema,
  RegistrarEntradaInventarioSchema,
  RegistrarAjusteInventarioSchema,
  ActualizarPuntoReordenSchema,
  ListarKardexQuerySchema,
} from "@shopcart/contracts";

const router = Router();
const controller = new InventarioController();

// Todas las rutas de inventario requieren autenticación activa
router.use(autenticar);

// 1. Consultar existencias de inventario
router.get(
  "/",
  autorizarPermiso("inventory.read"),
  validar(ListarInventarioQuerySchema, "query"),
  controller.listarExistencias
);

// 2. Consultar historial de Kardex (RF-03)
router.get(
  "/kardex",
  autorizarPermiso("inventory.read"),
  validar(ListarKardexQuerySchema, "query"),
  controller.listarKardex
);

// 3. Obtener detalle de stock de una variante
router.get(
  "/variante/:idVariante",
  autorizarPermiso("inventory.read"),
  controller.obtenerPorVariante
);

// 4. Registrar entrada de mercancía (compra o stock inicial)
router.post(
  "/entrada",
  autorizarPermiso("inventory.adjust"),
  validar(RegistrarEntradaInventarioSchema, "body"),
  controller.registrarEntrada
);

// 5. Registrar ajuste manual físico de existencia (RF-03)
router.post(
  "/ajuste",
  autorizarPermiso("inventory.adjust"),
  validar(RegistrarAjusteInventarioSchema, "body"),
  controller.registrarAjuste
);

// 6. Configurar umbral de punto de reorden
router.put(
  "/punto-reorden",
  autorizarPermiso("inventory.adjust"),
  validar(ActualizarPuntoReordenSchema, "body"),
  controller.actualizarPuntoReorden
);

export default router;
