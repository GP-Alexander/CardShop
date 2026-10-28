import { Request, Response, NextFunction } from "express";
import { BitacoraService } from "./bitacora.service";
import { ListarBitacoraQuery } from "@shopcart/contracts";

export class BitacoraController {
  constructor(private readonly bitacoraService: BitacoraService = new BitacoraService()) {}

  listar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filtros = req.query as unknown as ListarBitacoraQuery;
      const resultado = await this.bitacoraService.listarPaginado(filtros);

      res.status(200).json({
        exito: true,
        ...resultado,
      });
    } catch (err) {
      next(err);
    }
  };
}
