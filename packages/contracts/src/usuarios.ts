import { z } from "zod";
import { PaginacionQuerySchema, RespuestaPaginada } from "./paginacion";

export const ListarUsuariosQuerySchema = PaginacionQuerySchema.extend({
  rol: z.enum(["Cliente", "Operador", "Administrador", "todos"]).optional(),
  estaActivo: z
    .enum(["true", "false", "todos"])
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
  columnaOrden: z
    .enum(["fechacreacion", "nombres", "apellidos", "correo", "ultimoacceso"])
    .optional()
    .default("fechacreacion"),
});

export type ListarUsuariosQuery = z.infer<typeof ListarUsuariosQuerySchema>;

export const ActualizarUsuarioAdminSchema = z.object({
  nombres: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
  apellidos: z.string().trim().min(2, "El apellido debe tener al menos 2 caracteres"),
  idRol: z.number().int().positive("Debe seleccionar un rol válido"),
  telefono: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val))
    .refine(
      (val) => val === null || val === undefined || /^\+?[0-9\s\-]{7,20}$/.test(val),
      "El teléfono debe contener entre 7 y 15 dígitos numéricos (ej: +502 1234 5678)"
    ),
});

export type ActualizarUsuarioAdminInput = z.infer<typeof ActualizarUsuarioAdminSchema>;

export const CambiarEstadoUsuarioSchema = z.object({
  estaActivo: z.boolean({ required_error: "El estado activo es obligatorio" }),
});

export type CambiarEstadoUsuarioInput = z.infer<typeof CambiarEstadoUsuarioSchema>;

export const CrearUsuarioInternoSchema = z.object({
  nombres: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  apellidos: z.string().trim().min(2, "El apellido debe tener al menos 2 caracteres").max(100),
  correo: z.string().trim().email("Formato de correo electrónico inválido").max(254),
  nombreRol: z.enum(["Operador", "Administrador"], {
    errorMap: () => ({ message: "El rol asignado debe ser Operador o Administrador" }),
  }),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "La contraseña debe contener al menos una letra mayúscula")
    .regex(/[0-9]/, "La contraseña debe contener al menos un número"),
  telefono: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val))
    .refine(
      (val) => val === null || val === undefined || /^\+?[0-9\s\-]{7,20}$/.test(val),
      "El teléfono debe contener entre 7 y 15 dígitos numéricos (ej: +502 1234 5678)"
    ),
});

export type CrearUsuarioInternoInput = z.infer<typeof CrearUsuarioInternoSchema>;



export interface UsuarioItemDTO {
  idUsuario: number;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  nombreRol: string;
  estaActivo: boolean;
  fechaCreacion: string;
  ultimoAcceso: string | null;
}

export interface DireccionUsuarioDTO {
  idDireccion: number;
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

export interface UsuarioDetalleDTO {
  idUsuario: number;
  idRol: number;
  nombreRol: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  estaActivo: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
  ultimoAcceso: string | null;
  direcciones: DireccionUsuarioDTO[];
}

export type RespuestaPaginadaUsuariosDTO = RespuestaPaginada<UsuarioItemDTO>;
