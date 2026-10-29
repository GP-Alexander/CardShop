import { Router } from "express";
import { CuponesController } from "./cupones.controller";
import { autenticar } from "../../shared/middlewares/autenticar";
import { autorizarPermiso } from "../../shared/middlewares/autorizar";
import { validar } from "../../shared/middlewares/validar";
import { ListarCuponesQuerySchema, CrearCuponSchema } from "@shopcart/contracts";

const router = Router();
const controller = new CuponesController();

router.use(autenticar);

// 1. Listar cupones (Administración)
router.get(
  "/",
  autorizarPermiso("coupons.read"),
  validar(ListarCuponesQuerySchema, "query"),
  controller.listar
);

// 2. Crear cupón (Administración)
router.post(
  "/",
  autorizarPermiso("coupons.manage"),
  validar(CrearCuponSchema, "body"),
  controller.crear
);

export default router;
