import { z } from "zod";

export const CrearDireccionSchema = z.object({
  alias: z.string().trim().max(50, "El alias no puede exceder 50 caracteres").optional().nullable(),
  destinatario: z.string().trim().min(2, "El nombre del destinatario es obligatorio").max(150),
  telefono: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, "Número de teléfono inválido (debe tener entre 8 y 15 dígitos)"),
  linea1: z.string().trim().min(5, "La dirección (Línea 1) debe tener al menos 5 caracteres").max(200),
  linea2: z.string().trim().max(200).optional().nullable(),
  departamento: z.string().trim().min(2, "El departamento es obligatorio").max(100),
  municipio: z.string().trim().min(2, "El municipio es obligatorio").max(100),
  codigoPostal: z.string().trim().max(20).optional().nullable(),
  referencia: z.string().trim().max(250).optional().nullable(),
  esPredeterminada: z.boolean().optional().default(false),
});

export type CrearDireccionInput = z.infer<typeof CrearDireccionSchema>;

export const ActualizarDireccionSchema = CrearDireccionSchema;
export type ActualizarDireccionInput = z.infer<typeof ActualizarDireccionSchema>;

export interface DireccionDTO {
  idDireccion: number;
  idUsuario: number;
  alias: string | null;
  destinatario: string;
  telefono: string;
  linea1: string;
  linea2: string | null;
  departamento: string;
  municipio: string;
  codigoPostal: string | null;
  referencia: string | null;
  esPredeterminada: boolean;
  estaActiva: boolean;
  fechaCreacion: string;
}
