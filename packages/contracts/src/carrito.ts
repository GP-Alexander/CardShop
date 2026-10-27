import { z } from "zod";

export const ItemCarritoInputSchema = z.object({
  idVariante: z.number().int().positive("Variante requerida"),
  cantidad: z.number().int().positive("La cantidad debe ser mayor a 0"),
});
export type ItemCarritoInput = z.infer<typeof ItemCarritoInputSchema>;

export const ModificarCantidadCarritoSchema = z.object({
  cantidad: z.number().int().positive("La cantidad debe ser mayor a 0"),
});
export type ModificarCantidadCarritoInput = z.infer<typeof ModificarCantidadCarritoSchema>;

export interface ItemCarritoDTO {
  idItemCarrito: number;
  idVariante: number;
  sku: string;
  nombreProducto: string;
  atributos: Record<string, string>;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
  disponible: boolean;
  existenciaDisponible: number;
}

export interface CarritoDTO {
  idCarrito: number;
  tokenInvitado?: string;
  idUsuario?: number;
  items: ItemCarritoDTO[];
  subtotal: number;
  descuento: number;
  total: number;
  codigoCupon?: string;
}
