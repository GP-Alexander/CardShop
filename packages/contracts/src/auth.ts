import { z } from "zod";

export const RolUsuarioEnum = z.enum(["Cliente", "Operador", "Administrador"]);
export type RolUsuario = z.infer<typeof RolUsuarioEnum>;

export const RegistroClienteSchema = z.object({
  correo: z.string().trim().email("Formato de correo electrónico inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula")
    .regex(/[0-9]/, "Debe contener al menos un número"),
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
  apellido: z.string().trim().min(2, "El apellido debe tener al menos 2 caracteres"),
  telefono: z.string().trim().regex(/^\+?[0-9]{8,15}$/, "Número de teléfono inválido").optional(),
});
export type RegistroClienteInput = z.infer<typeof RegistroClienteSchema>;

export const LoginSchema = z.object({
  correo: z.string().trim().email("Formato de correo inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const GoogleAuthSchema = z.object({
  idToken: z.string().min(10, "El token de autenticación de Google es requerido"),
});
export type GoogleAuthInput = z.infer<typeof GoogleAuthSchema>;

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token requerido"),
});
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

export interface UsuarioAutenticadoDTO {
  idUsuario: number;
  correo: string;
  nombre: string;
  apellido: string;
  rol: RolUsuario;
  estaActivo: boolean;
}

export interface RespuestaAuthDTO {
  usuario: UsuarioAutenticadoDTO;
  accessToken: string;
  refreshToken: string;
  expiraEnSegundos: number;
}
