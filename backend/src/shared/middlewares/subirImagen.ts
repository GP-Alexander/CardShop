import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { BadRequestError } from "../errors/AppError";

// Extender Express.Request para incluir fileUrl
declare global {
  namespace Express {
    interface Request {
      fileUrl?: string;
    }
  }
}

// 1. Configurar almacenamiento en memoria para procesar con Sharp antes de escribir en disco
const storage = multer.memoryStorage();

export const uploadImagenProducto = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB máximo
  },
  fileFilter: (_req, file, cb) => {
    const tiposPermitidos = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (tiposPermitidos.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new BadRequestError("Solo se permiten imágenes en formato JPG, PNG o WebP."));
    }
  },
});

// 2. Middleware para optimizar con Sharp, convertir a WebP y guardar en disco
export async function optimizarYGuardarImagen(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.file) {
    return next(new BadRequestError("No se ha enviado ningún archivo de imagen."));
  }

  try {
    const carpetaDestino = path.resolve(process.cwd(), "uploads", "productos");

    // Asegurar directorio destino
    if (!fs.existsSync(carpetaDestino)) {
      fs.mkdirSync(carpetaDestino, { recursive: true });
    }

    const nombreArchivo = `${crypto.randomUUID()}.webp`;
    const rutaArchivo = path.join(carpetaDestino, nombreArchivo);

    // Redimensionar y convertir a WebP
    await sharp(req.file.buffer)
      .resize({
        width: 1200,
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(rutaArchivo);

    req.fileUrl = `/uploads/productos/${nombreArchivo}`;

    next();
  } catch (error) {
    next(new BadRequestError(`Error al procesar y optimizar la imagen: ${error instanceof Error ? error.message : "formato inválido"}`));
  }
}
