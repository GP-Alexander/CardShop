import { Request, Response, NextFunction } from "express";
import { CarritoService } from "./carrito.service";
import {
  AgregarItemCarritoInput,
  ModificarCantidadCarritoInput,
  AplicarCuponCarritoInput,
  MigrarCarritoInvitadoInput,
} from "@shopcart/contracts";

const COOKIE_CARRITO_INVITADO = "shopcart_cart_token";

export class CarritoController {
  constructor(private readonly carritoService: CarritoService = new CarritoService()) {}

  private extraerIdentificadores(req: Request): {
    idUsuario?: number;
    tokenInvitado?: string;
  } {
    const idUsuario = req.usuario?.idUsuario;
    const tokenInvitado =
      req.cookies?.[COOKIE_CARRITO_INVITADO] ||
      (req.headers["x-cart-token"] as string) ||
      undefined;

    return { idUsuario, tokenInvitado };
  }

  private sincronizarCookieInvitado(
    res: Response,
    nuevoTokenInvitado?: string
  ): void {
    if (nuevoTokenInvitado) {
      res.cookie(COOKIE_CARRITO_INVITADO, nuevoTokenInvitado, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
      });
      res.setHeader("x-cart-token", nuevoTokenInvitado);
    }
  }

  obtener = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { idUsuario, tokenInvitado } = this.extraerIdentificadores(req);
      const { carrito, nuevoTokenInvitado } = await this.carritoService.obtenerCarrito(
        idUsuario,
        tokenInvitado
      );

      this.sincronizarCookieInvitado(res, nuevoTokenInvitado);
      res.json({
        exito: true,
        datos: carrito,
      });
    } catch (error) {
      next(error);
    }
  };

  agregarItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as AgregarItemCarritoInput;
      const { idUsuario, tokenInvitado } = this.extraerIdentificadores(req);
      const { carrito, nuevoTokenInvitado } = await this.carritoService.agregarItem(
        input,
        idUsuario,
        tokenInvitado
      );

      this.sincronizarCookieInvitado(res, nuevoTokenInvitado);
      res.status(201).json({
        exito: true,
        mensaje: "Producto agregado al carrito con éxito",
        datos: carrito,
      });
    } catch (error) {
      next(error);
    }
  };

  modificarCantidad = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idVariante = parseInt(String(req.params.idVariante), 10);
      const input = req.body as ModificarCantidadCarritoInput;
      const { idUsuario, tokenInvitado } = this.extraerIdentificadores(req);

      const { carrito, nuevoTokenInvitado } = await this.carritoService.modificarCantidad(
        idVariante,
        input,
        idUsuario,
        tokenInvitado
      );

      this.sincronizarCookieInvitado(res, nuevoTokenInvitado);
      res.json({
        exito: true,
        mensaje: "Cantidad de producto modificada en el carrito",
        datos: carrito,
      });
    } catch (error) {
      next(error);
    }
  };

  eliminarItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idVariante = parseInt(String(req.params.idVariante), 10);
      const { idUsuario, tokenInvitado } = this.extraerIdentificadores(req);

      const { carrito, nuevoTokenInvitado } = await this.carritoService.eliminarItem(
        idVariante,
        idUsuario,
        tokenInvitado
      );

      this.sincronizarCookieInvitado(res, nuevoTokenInvitado);
      res.json({
        exito: true,
        mensaje: "Producto eliminado del carrito",
        datos: carrito,
      });
    } catch (error) {
      next(error);
    }
  };

  vaciar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { idUsuario, tokenInvitado } = this.extraerIdentificadores(req);
      const { carrito, nuevoTokenInvitado } = await this.carritoService.vaciarCarrito(
        idUsuario,
        tokenInvitado
      );

      this.sincronizarCookieInvitado(res, nuevoTokenInvitado);
      res.json({
        exito: true,
        mensaje: "Carrito vaciado exitosamente",
        datos: carrito,
      });
    } catch (error) {
      next(error);
    }
  };

  aplicarCupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { codigo } = req.body as AplicarCuponCarritoInput;
      const { idUsuario, tokenInvitado } = this.extraerIdentificadores(req);

      const { carrito, nuevoTokenInvitado } = await this.carritoService.aplicarCupon(
        codigo,
        idUsuario,
        tokenInvitado
      );

      this.sincronizarCookieInvitado(res, nuevoTokenInvitado);
      res.json({
        exito: true,
        mensaje: `Cupón '${codigo}' aplicado exitosamente al carrito`,
        datos: carrito,
      });
    } catch (error) {
      next(error);
    }
  };

  removerCupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { idUsuario, tokenInvitado } = this.extraerIdentificadores(req);
      const { carrito, nuevoTokenInvitado } = await this.carritoService.removerCupon(
        idUsuario,
        tokenInvitado
      );

      this.sincronizarCookieInvitado(res, nuevoTokenInvitado);
      res.json({
        exito: true,
        mensaje: "Cupón removido del carrito",
        datos: carrito,
      });
    } catch (error) {
      next(error);
    }
  };

  migrarInvitado = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tokenInvitado } = req.body as MigrarCarritoInvitadoInput;
      const idUsuario = req.usuario!.idUsuario;

      const carrito = await this.carritoService.migrarCarritoInvitado(tokenInvitado, idUsuario);
      res.clearCookie(COOKIE_CARRITO_INVITADO);
      res.json({
        exito: true,
        mensaje: "Carrito de invitado sincronizado exitosamente con la cuenta de usuario",
        datos: carrito,
      });
    } catch (error) {
      next(error);
    }
  };
}
