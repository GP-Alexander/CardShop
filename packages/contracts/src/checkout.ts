import { z } from "zod";

export const DireccionEntregaSchema = z.object({
  idDireccion: z.number().int().positive().optional(),
  destinatario: z.string().trim().min(2, "Nombre de destinatario requerido"),
  direccionLinea1: z.string().trim().min(5, "Dirección requerida"),
  direccionLinea2: z.string().trim().optional(),
  departamento: z.string().trim().min(2, "Departamento requerido"),
  municipio: z.string().trim().min(2, "Municipio requerido"),
  codigoPostal: z.string().trim().optional(),
  telefonoContacto: z.string().trim().min(8, "Teléfono de contacto requerido"),
  esPredeterminada: z.boolean().default(false),
});
export type DireccionEntregaInput = z.infer<typeof DireccionEntregaSchema>;

export const IniciarCheckoutSchema = z.object({
  idDireccion: z.number().int().positive("Dirección requerida"),
  codigoCupon: z.string().trim().optional(),
});
export type IniciarCheckoutInput = z.infer<typeof IniciarCheckoutSchema>;

export const ConfirmarPagoSchema = z.object({
  idReserva: z.number().int().positive("Reserva requerida"),
  claveIdempotencia: z.string().uuid("Clave de idempotencia requerida (UUID)"),
  metodoPago: z.enum(["Tarjeta", "Transferencia", "EfectivoContraEntrega"]),
});
export type ConfirmarPagoInput = z.infer<typeof ConfirmarPagoSchema>;

export interface ReservaCheckoutDTO {
  idReserva: number;
  expiraEn: string;
  totalPagar: number;
  items: Array<{
    idVariante: number;
    cantidad: number;
    precioUnitario: number;
  }>;
}
