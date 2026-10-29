import { Router } from "express";
import { ReportesController } from "./reportes.controller";
import { autenticar } from "../../shared/middlewares/autenticar";
import { autorizarPermiso } from "../../shared/middlewares/autorizar";
import { validar } from "../../shared/middlewares/validar";
import {
  FiltroVentasPeriodoQuerySchema,
  FiltroTopProductosQuerySchema,
  FiltroVentasPorCategoriaQuerySchema,
  FiltroCarritosAbandonadosQuerySchema,
} from "@shopcart/contracts";

const router = Router();
const controller = new ReportesController();

// Acceso exclusivo a usuarios con permiso 'reports.read' (Administrador)
router.use(autenticar, autorizarPermiso("reports.read"));

router.get("/dashboard", controller.obtenerDashboard);
router.get(
  "/ventas-periodo",
  validar(FiltroVentasPeriodoQuerySchema, "query"),
  controller.obtenerVentasPeriodo
);
router.get(
  "/top-productos",
  validar(FiltroTopProductosQuerySchema, "query"),
  controller.obtenerTopProductos
);
router.get(
  "/ventas-categoria",
  validar(FiltroVentasPorCategoriaQuerySchema, "query"),
  controller.obtenerVentasPorCategoria
);
router.get(
  "/carritos-abandonados",
  validar(FiltroCarritosAbandonadosQuerySchema, "query"),
  controller.obtenerCarritosAbandonados
);

export { router as reportesRouter };
