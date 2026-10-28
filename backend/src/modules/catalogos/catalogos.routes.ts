import { Router } from "express";
import { CatalogosController } from "./catalogos.controller";
import { autenticar } from "../../shared/middlewares/autenticar";
import { autorizarPermiso } from "../../shared/middlewares/autorizar";

const router = Router();
const controller = new CatalogosController();

// Consulta de catálogos protegida con autenticación y permisos de administración
router.use(autenticar, autorizarPermiso("users.manage"));

router.get("/roles", controller.listarRoles);
router.get("/permisos", controller.listarPermisos);

export default router;
