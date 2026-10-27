import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../../config/env";
import { UnauthorizedError } from "../errors/AppError";

export interface PayloadUsuarioToken {
  idUsuario: number;
  correo: string;
  rol: "Cliente" | "Operador" | "Administrador";
  permisos: string[];
}

export function emitirAccessToken(payload: PayloadUsuarioToken): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRATION as jwt.SignOptions["expiresIn"],
    jwtid: crypto.randomUUID(),
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verificarAccessToken(token: string): PayloadUsuarioToken {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload & PayloadUsuarioToken;
    return {
      idUsuario: decoded.idUsuario,
      correo: decoded.correo,
      rol: decoded.rol,
      permisos: decoded.permisos || [],
    };
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("El token de acceso ha expirado", "TOKEN_EXPIRADO");
    }
    throw new UnauthorizedError("Token de acceso inválido o manipulado", "TOKEN_INVALIDO");
  }
}

export function generarRefreshTokenPlano(): string {
  return crypto.randomBytes(40).toString("hex");
}

export function hashearTokenSha256(tokenPlano: string): string {
  return crypto.createHash("sha256").update(tokenPlano).digest("hex");
}

export function generarFamiliaSesion(): string {
  return crypto.randomUUID();
}
