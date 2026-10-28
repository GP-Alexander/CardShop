import { Router } from "express";
import { BitacoraController } from "./bitacora.controller";
import { autenticar } from "../../shared/middlewares/autenticar";
import { autorizarPermiso } from "../../shared/middlewares/autorizar";
import { validar } from "../../shared/middlewares/validar";
import { ListarBitacoraQuerySchema } from "@shopcart/contracts";

const router = Router();
const controller = new BitacoraController();

// Consulta de bitácora restringida a usuarios con permiso 'audit.read' (Administrador / Auditor)
router.use(autenticar, autorizarPermiso("audit.read"));

router.get("/", validar(ListarBitacoraQuerySchema, "query"), controller.listar);

export default router;
