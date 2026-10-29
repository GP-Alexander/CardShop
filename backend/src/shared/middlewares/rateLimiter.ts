import { Request, Response, NextFunction } from "express";
import { TooManyRequestsError } from "../errors/AppError";

interface OpcionesRateLimiter {
  ventanaMs: number;
  maxIntentos: number;
  mensaje?: string;
}

interface RegistroIntento {
  contador: number;
  primerIntento: number;
}

const registroPorIp = new Map<string, RegistroIntento>();

/**
 * Middleware generador de Rate Limiting con ventana fija en memoria.
 * Cumple con el extra opcional de ciberseguridad (Pág. 14 del PDF) sin dependencias pesadas.
 */
export function crearRateLimiter(opciones: OpcionesRateLimiter) {
  const {
    ventanaMs,
    maxIntentos,
    mensaje = `Demasiadas peticiones. Por favor, intenta de nuevo en ${Math.ceil(ventanaMs / 60000)} minutos.`,
  } = opciones;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Permitir bypass explícito solo en suite de pruebas si se solicita
    if (process.env.NODE_ENV === "test" && req.headers["x-bypass-rate-limit"] === "true") {
      return next();
    }

    const ip = (req.ip || req.socket.remoteAddress || "127.0.0.1").replace(/^.*:/, "");
    const clave = `${req.baseUrl}${req.path}:${ip}`;
    const ahora = Date.now();

    const actual = registroPorIp.get(clave);

    if (!actual || ahora - actual.primerIntento > ventanaMs) {
      // Ventana expirada o nueva IP: inicializar
      registroPorIp.set(clave, { contador: 1, primerIntento: ahora });
      res.setHeader("X-RateLimit-Limit", maxIntentos);
      res.setHeader("X-RateLimit-Remaining", maxIntentos - 1);
      res.setHeader("X-RateLimit-Reset", Math.ceil((ahora + ventanaMs) / 1000));
      return next();
    }

    // Ventana activa: incrementar contador
    actual.contador++;

    const restanteSegundos = Math.max(1, Math.ceil((actual.primerIntento + ventanaMs - ahora) / 1000));
    res.setHeader("X-RateLimit-Limit", maxIntentos);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxIntentos - actual.contador));
    res.setHeader("X-RateLimit-Reset", Math.ceil((actual.primerIntento + ventanaMs) / 1000));

    if (actual.contador > maxIntentos) {
      res.setHeader("Retry-After", restanteSegundos);
      throw new TooManyRequestsError(
        `${mensaje} Por favor espera ${restanteSegundos} segundos antes de volver a intentarlo.`,
        "RATE_LIMIT_EXCEDIDO"
      );
    }

    next();
  };
}

/**
 * Función auxiliar para reiniciar los registros de intentos (utilizada en pruebas automatizadas).
 */
export function limpiarRegistrosRateLimit(): void {
  registroPorIp.clear();
}

/**
 * Limitador estricto para autenticación: máximo 5 intentos cada 15 minutos por IP (Pág. 14 del PDF).
 */
export const rateLimitLogin = crearRateLimiter({
  ventanaMs: 15 * 60 * 1000, // 15 minutos
  maxIntentos: 5,
  mensaje: "Demasiados intentos de inicio de sesión.",
});

/**
 * Limitador para registro de clientes: máximo 5 registros por hora por IP.
 */
export const rateLimitRegistro = crearRateLimiter({
  ventanaMs: 60 * 60 * 1000, // 1 hora
  maxIntentos: 5,
  mensaje: "Límite de registros alcanzado desde esta dirección IP.",
});
