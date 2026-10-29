import { Request, Response, NextFunction } from "express";
import { PedidosService } from "./pedidos.service";
import { UnauthorizedError } from "../../shared/errors/AppError";
import { FiltroPedidosQuery } from "@shopcart/contracts";

export class PedidosController {
  constructor(private readonly service: PedidosService = new PedidosService()) {}

  listarMisPedidos = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.usuario) {
        throw new UnauthorizedError("Usuario no autenticado");
      }

      const pagina = req.query.pagina ? parseInt(String(req.query.pagina), 10) : 1;
      const limite = req.query.limite ? parseInt(String(req.query.limite), 10) : 10;

      const resultado = await this.service.listarMisPedidos(req.usuario.idUsuario, pagina, limite);
      res.status(200).json({
        mensaje: "Pedidos obtenidos exitosamente",
        datos: resultado.pedidos,
        paginacion: {
          total: resultado.total,
          pagina: resultado.pagina,
          totalPaginas: resultado.totalPaginas,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  obtenerDetalle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idPedido = parseInt(String(req.params.id), 10);
      const resultado = await this.service.obtenerDetalle(
        idPedido,
        req.usuario?.idUsuario,
        req.usuario?.rol
      );

      res.status(200).json({
        mensaje: "Detalle de pedido obtenido exitosamente",
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  listarAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as FiltroPedidosQuery;
      const resultado = await this.service.listarAdmin(query);
      res.status(200).json({
        mensaje: "Listado de pedidos obtenido",
        datos: resultado.pedidos,
        paginacion: {
          total: resultado.total,
          pagina: resultado.pagina,
          totalPaginas: resultado.totalPaginas,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  cambiarEstado = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.usuario) {
        throw new UnauthorizedError("Usuario no autenticado");
      }

      const idPedido = parseInt(String(req.params.id), 10);
      const resultado = await this.service.cambiarEstado(
        idPedido,
        req.body,
        req.usuario.idUsuario
      );

      res.status(200).json({
        mensaje: "Estado del pedido actualizado exitosamente",
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };
}
