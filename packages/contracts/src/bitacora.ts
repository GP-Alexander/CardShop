import { z } from "zod";

export const ListarBitacoraQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  modulo: z.string().trim().optional(),
  entidad: z.string().trim().optional(),
  accion: z.string().trim().optional(),
  idUsuario: z.coerce.number().int().positive().optional(),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  busqueda: z.string().trim().optional(),
});

export type ListarBitacoraQuery = z.infer<typeof ListarBitacoraQuerySchema>;

export interface BitacoraItemDTO {
  idBitacora: number;
  fechaEvento: string;
  idUsuario: number | null;
  correoUsuario: string | null;
  nombreCompletoUsuario: string | null;
  modulo: string;
  entidad: string;
  idRegistro: string;
  accion: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  direccionIp: string | null;
  correlationId: string | null;
}

export interface RespuestaPaginadaBitacoraDTO {
  datos: BitacoraItemDTO[];
  paginacion: {
    paginaActual: number;
    limite: number;
    totalRegistros: number;
    totalPaginas: number;
  };
}
