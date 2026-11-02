import { Router } from "express";
import { CuponesController } from "./cupones.controller";
import { autenticar } from "../../shared/middlewares/autenticar";
import { autorizarRoles } from "../../shared/middlewares/autorizar";
import { validar } from "../../shared/middlewares/validar";
import { ListarCuponesQuerySchema, CrearCuponSchema } from "@shopcart/contracts";

const router = Router();
const controller = new CuponesController();

router.use(autenticar);

// 1. Listar cupones (Exclusivo Administrador según RF-01)
router.get(
  "/",
  autorizarRoles("Administrador"),
  validar(ListarCuponesQuerySchema, "query"),
  controller.listar
);

// 2. Crear cupón (Exclusivo Administrador según RF-01)
router.post(
  "/",
  autorizarRoles("Administrador"),
  validar(CrearCuponSchema, "body"),
  controller.crear
);

export default router;
