import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { env } from "../../config/env";

export class AuthController {
  constructor(private readonly authService: AuthService = new AuthService()) {}

  private establecerCookieRefresh(res: Response, refreshToken: string): void {
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: env.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
    });
  }

  private limpiarCookieRefresh(res: Response): void {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }

  registro = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const direccionIp = req.ip || req.socket.remoteAddress;
      const resultado = await this.authService.registrar(req.body, direccionIp);

      this.establecerCookieRefresh(res, resultado.refreshToken);

      res.status(201).json({
        exito: true,
        mensaje: "Cliente registrado exitosamente.",
        datos: {
          usuario: resultado.usuario,
          accessToken: resultado.accessToken,
          refreshToken: resultado.refreshToken,
          expiraEnSegundos: resultado.expiraEnSegundos,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const direccionIp = req.ip || req.socket.remoteAddress;
      const resultado = await this.authService.login(req.body, direccionIp);

      this.establecerCookieRefresh(res, resultado.refreshToken);

      res.status(200).json({
        exito: true,
        mensaje: "Inicio de sesión exitoso.",
        datos: {
          usuario: resultado.usuario,
          accessToken: resultado.accessToken,
          refreshToken: resultado.refreshToken,
          expiraEnSegundos: resultado.expiraEnSegundos,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  google = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const direccionIp = req.ip || req.socket.remoteAddress;
      const { idToken } = req.body;
      const resultado = await this.authService.autenticarGoogle(idToken, direccionIp);

      this.establecerCookieRefresh(res, resultado.refreshToken);

      res.status(200).json({
        exito: true,
        mensaje: "Autenticación con Google exitosa.",
        datos: {
          usuario: resultado.usuario,
          accessToken: resultado.accessToken,
          refreshToken: resultado.refreshToken,
          expiraEnSegundos: resultado.expiraEnSegundos,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tokenActual = req.body?.refreshToken || req.cookies?.refreshToken;
      const direccionIp = req.ip || req.socket.remoteAddress;

      const resultado = await this.authService.refrescarSesion(tokenActual, direccionIp);

      this.establecerCookieRefresh(res, resultado.nuevoRefreshToken);

      res.status(200).json({
        exito: true,
        mensaje: "Sesión renovada exitosamente.",
        datos: {
          accessToken: resultado.accessToken,
          refreshToken: resultado.nuevoRefreshToken,
          usuario: resultado.usuario,
        },
      });
    } catch (error) {
      this.limpiarCookieRefresh(res);
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.cookies?.refreshToken || req.body?.refreshToken;
      await this.authService.logout(token);

      this.limpiarCookieRefresh(res);

      res.status(200).json({
        exito: true,
        mensaje: "Sesión cerrada correctamente.",
      });
    } catch (error) {
      next(error);
    }
  };

  yo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idUsuario = req.usuario!.idUsuario;
      const perfil = await this.authService.obtenerPerfil(idUsuario);

      res.status(200).json({
        exito: true,
        datos: perfil,
      });
    } catch (error) {
      next(error);
    }
  };
}
