import { Request, Response, NextFunction } from "express";
import { CuponesService } from "./cupones.service";
import { ListarCuponesQuery, CrearCuponInput } from "@shopcart/contracts";

export class CuponesController {
  constructor(private readonly cuponesService: CuponesService = new CuponesService()) {}

  listar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filtros = req.query as unknown as ListarCuponesQuery;
      const resultado = await this.cuponesService.listarPaginado(filtros);
      res.json({
        exito: true,
        ...resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  crear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as CrearCuponInput;
      const idUsuarioAdmin = req.usuario!.idUsuario;
      const ip = req.ip || req.socket.remoteAddress;

      const resultado = await this.cuponesService.crear(input, idUsuarioAdmin, ip);
      res.status(201).json({
        exito: true,
        mensaje: "Cupón de descuento creado exitosamente",
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };
}
