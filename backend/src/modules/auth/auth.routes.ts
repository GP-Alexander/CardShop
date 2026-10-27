import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validar } from "../../shared/middlewares/validar";
import { autenticar } from "../../shared/middlewares/autenticar";
import { RegistroClienteSchema, LoginSchema } from "@shopcart/contracts";

const router = Router();
const controller = new AuthController();

router.post("/registro", validar(RegistroClienteSchema, "body"), controller.registro);
router.post("/login", validar(LoginSchema, "body"), controller.login);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.get("/yo", autenticar, controller.yo);

export const authRouter = router;
