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
  claveIdempotencia: z.string().trim().min(5).optional(),
});
export type IniciarCheckoutInput = z.infer<typeof IniciarCheckoutSchema>;

export const ConfirmarPagoSchema = z.object({
  idPedido: z.coerce.number().int().positive("Pedido requerido").optional(),
  idReserva: z.coerce.number().int().positive().optional(),
  claveIdempotencia: z.string().trim().min(5, "Clave de idempotencia requerida"),
  metodoPago: z.string().trim().default("SIMULADOR"),
  referenciaProveedor: z.string().trim().optional(),
  monto: z.coerce.number().positive().optional(),
});
export type ConfirmarPagoInput = z.infer<typeof ConfirmarPagoSchema>;

export interface CheckoutIniciadoDTO {
  idPedido: number;
  numeroPedido: string;
  total: number;
  subtotal: number;
  descuento: number;
  costoEnvio: number;
  ivaIncluido: number;
  moneda: string;
  estadoCodigo: string;
  estadoNombre: string;
  idReserva: number;
  estadoReserva: string;
  fechaExpiracionReserva: string;
  segundosRestantesReserva: number;
}

export interface PagoConfirmadoDTO {
  idPedido: number;
  numeroPedido: string;
  total: number;
  moneda: string;
  estadoCodigo: string;
  estadoNombre: string;
  idPago: number;
  estadoPago: string;
  proveedor: string;
  referenciaProveedor?: string | null;
  fechaConfirmacion: string;
}
