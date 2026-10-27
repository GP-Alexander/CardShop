import { z } from "zod";

export const DetalleErrorSchema = z.object({
  campo: z.string().optional(),
  mensaje: z.string(),
});

export const RespuestaErrorApiSchema = z.object({
  exito: z.literal(false),
  codigoHttp: z.number().int(),
  mensaje: z.string(),
  codigoInterno: z.string().optional(),
  errores: z.array(DetalleErrorSchema).optional(),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

export type DetalleError = z.infer<typeof DetalleErrorSchema>;
export type RespuestaErrorApi = z.infer<typeof RespuestaErrorApiSchema>;
