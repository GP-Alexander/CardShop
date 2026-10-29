import { Request, Response, NextFunction } from "express";
import { CheckoutService } from "./checkout.service";
import { UnauthorizedError } from "../../shared/errors/AppError";

export class CheckoutController {
  constructor(private readonly service: CheckoutService = new CheckoutService()) {}

  iniciar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.usuario) {
        throw new UnauthorizedError("Usuario no autenticado");
      }

      const resultado = await this.service.iniciarCheckout(req.usuario.idUsuario, req.body);
      res.status(201).json({
        mensaje: "Checkout iniciado y existencia reservada por 15 minutos",
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  confirmarPago = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.usuario) {
        throw new UnauthorizedError("Usuario no autenticado");
      }

      const resultado = await this.service.confirmarPago(req.usuario.idUsuario, req.body);
      res.status(200).json({
        mensaje: "Pago confirmado exitosamente y pedido generado",
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };
}
