import { Router } from "express";
import { CheckoutController } from "./checkout.controller";
import { autenticar } from "../../shared/middlewares/autenticar";
import { validar } from "../../shared/middlewares/validar";
import { IniciarCheckoutSchema, ConfirmarPagoSchema } from "@shopcart/contracts";

const checkoutRouter = Router();
const controller = new CheckoutController();

// Todas las rutas de checkout requieren cliente autenticado
checkoutRouter.use(autenticar);

checkoutRouter.post("/iniciar", validar(IniciarCheckoutSchema, "body"), controller.iniciar);
checkoutRouter.post("/confirmar-pago", validar(ConfirmarPagoSchema, "body"), controller.confirmarPago);

export { checkoutRouter };
