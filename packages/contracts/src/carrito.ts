import { z } from "zod";

// --- Validaciones de Entrada (Zod) ---

export const AgregarItemCarritoSchema = z.object({
  idVariante: z.number().int().positive("El ID de la variante debe ser un entero positivo"),
  cantidad: z.number().int().min(1, "La cantidad mínima a agregar es 1").max(99, "La cantidad máxima por producto es 99").default(1),
});

export type AgregarItemCarritoInput = z.infer<typeof AgregarItemCarritoSchema>;

export const ModificarCantidadCarritoSchema = z.object({
  cantidad: z.number().int().min(0, "La cantidad no puede ser negativa").max(99, "La cantidad máxima es 99"),
});

export type ModificarCantidadCarritoInput = z.infer<typeof ModificarCantidadCarritoSchema>;

export const AplicarCuponCarritoSchema = z.object({
  codigo: z.string().trim().min(1, "Debe ingresar el código de cupón").max(50),
});

export type AplicarCuponCarritoInput = z.infer<typeof AplicarCuponCarritoSchema>;

export const MigrarCarritoInvitadoSchema = z.object({
  tokenInvitado: z.string().trim().min(8, "Token de invitado inválido"),
});

export type MigrarCarritoInvitadoInput = z.infer<typeof MigrarCarritoInvitadoSchema>;

import { AtributoVarianteResumen } from "./inventario";

export interface ItemCarritoDTO {
  idVariante: number;
  sku: string;
  idProducto: number;
  productoNombre: string;
  productoMarca: string | null;
  idCategoria: number;
  categoriaNombre: string;
  precioUnitario: number;
  cantidad: number;
  subtotalLinea: number;
  existenciaDisponible: number;
  stockDisponibleSuficiente: boolean;
  atributos: AtributoVarianteResumen[];
}

export interface CarritoDTO {
  idCarrito: number;
  idUsuario: number | null;
  tokenInvitadoHash: string | null;
  estado: string;
  fechaUltimaActividad: string;
  subtotal: number;
  descuento: number;
  total: number;
  idCupon: number | null;
  codigoCupon: string | null;
  tipoDescuentoCupon: string | null;
  valorDescuentoCupon: number | null;
  alcanceCupon: string | null;
  items: ItemCarritoDTO[];
}
