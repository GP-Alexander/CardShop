import { Router } from "express";
import { PedidosController } from "./pedidos.controller";
import { autenticar } from "../../shared/middlewares/autenticar";
import { autorizarRoles } from "../../shared/middlewares/autorizar";
import { validar } from "../../shared/middlewares/validar";
import {
  FiltroPedidosQuerySchema,
  TransicionEstadoPedidoSchema,
} from "@shopcart/contracts";

const pedidosRouter = Router();
const controller = new PedidosController();

// Todas las rutas de pedidos requieren autenticación
pedidosRouter.use(autenticar);

// 1. Clientes: mis pedidos
pedidosRouter.get("/mis-pedidos", controller.listarMisPedidos);

// 2. Operador/Admin: gestión completa de pedidos
pedidosRouter.get(
  "/admin",
  autorizarRoles("Operador", "Administrador"),
  validar(FiltroPedidosQuerySchema, "query"),
  controller.listarAdmin
);

// 3. Operador/Admin: transición de estados
pedidosRouter.post(
  "/:id/cambiar-estado",
  autorizarRoles("Operador", "Administrador"),
  validar(TransicionEstadoPedidoSchema, "body"),
  controller.cambiarEstado
);

// 4. Detalle de pedido (cliente o admin, protegido por IDOR en service/SP)
pedidosRouter.get("/:id", controller.obtenerDetalle);

export { pedidosRouter };
