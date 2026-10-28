import { Request, Response, NextFunction } from "express";
import { CatalogosService } from "./catalogos.service";

export class CatalogosController {
  constructor(private readonly catalogosService: CatalogosService = new CatalogosService()) {}

  listarRoles = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roles = await this.catalogosService.listarRoles();
      res.status(200).json({
        exito: true,
        datos: roles,
      });
    } catch (err) {
      next(err);
    }
  };

  listarPermisos = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const permisos = await this.catalogosService.listarPermisos();
      res.status(200).json({
        exito: true,
        datos: permisos,
      });
    } catch (err) {
      next(err);
    }
  };
}
