import { Request, Response, NextFunction } from "express";
import { DevolucionesService } from "./devoluciones.service";
import { UnauthorizedError } from "../../shared/errors/AppError";

export class DevolucionesController {
  constructor(private readonly service: DevolucionesService = new DevolucionesService()) {}

  crear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.usuario) {
        throw new UnauthorizedError("Usuario no autenticado");
      }

      const resultado = await this.service.crear(
        req.usuario.idUsuario,
        req.usuario.rol,
        req.body
      );

      res.status(201).json({
        mensaje: "Devolución registrada exitosamente e inventario reintegrado al kardex",
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };
}
