import { Request, Response, NextFunction } from "express";
import { verificarAccessToken, PayloadUsuarioToken } from "../security/tokens";
import { UnauthorizedError } from "../errors/AppError";

declare global {
  namespace Express {
    interface Request {
      usuario?: PayloadUsuarioToken;
    }
  }
}

export function autenticar(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Cabecera Authorization con formato Bearer requerida", "TOKEN_REQUERIDO");
  }

  const token = authHeader.substring(7).trim();
  const usuario = verificarAccessToken(token);
  req.usuario = usuario;

  next();
}

/**
 * Middleware para identificar al usuario si viene con token Bearer válido,
 * pero permite continuar como invitado si no cuenta con token.
 */
export function autenticarOpcional(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7).trim();
      const usuario = verificarAccessToken(token);
      req.usuario = usuario;
    } catch {
      // Token expirado o inválido: continuar como invitado
    }
  }

  next();
}
