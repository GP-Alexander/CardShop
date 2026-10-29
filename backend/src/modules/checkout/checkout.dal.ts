import sql from "mssql";
import { ejecutarSp } from "../../shared/db/ejecutarSp";
import { CheckoutIniciadoDTO, PagoConfirmadoDTO } from "@shopcart/contracts";

interface CheckoutIniciadoRow {
  IDPedido: number;
  NumeroPedido: string;
  Total: number;
  Subtotal: number;
  Descuento: number;
  CostoEnvio: number;
  IVAIncluido: number;
  Moneda: string;
  EstadoCodigo: string;
  EstadoNombre: string;
  IDReserva: number;
  EstadoReserva: string;
  FechaExpiracionReserva: Date;
  SegundosRestantesReserva: number;
}

interface PagoConfirmadoRow {
  IDPedido: number;
  NumeroPedido: string;
  Total: number;
  Moneda: string;
  EstadoCodigo: string;
  EstadoNombre: string;
  IDPago: number;
  EstadoPago: string;
  Proveedor: string;
  ReferenciaProveedor: string | null;
  FechaConfirmacion: Date;
}

export class CheckoutDal {
  async iniciar(
    idUsuario: number,
    idDireccion: number,
    claveIdempotencia: string,
    codigoCupon?: string
  ): Promise<CheckoutIniciadoDTO> {
    const res = await ejecutarSp<CheckoutIniciadoRow>("dbo.SP_Checkout_Iniciar", [
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario },
      { nombre: "IDDireccion", tipo: sql.Int, valor: idDireccion },
      { nombre: "ClaveIdempotencia", tipo: sql.VarChar(100), valor: claveIdempotencia },
      { nombre: "CodigoCupon", tipo: sql.VarChar(50), valor: codigoCupon ?? null },
    ]);

    const row = res.recordset[0];
    if (!row) {
      throw new Error("No se obtuvieron datos al iniciar el checkout.");
    }

    return {
      idPedido: row.IDPedido,
      numeroPedido: row.NumeroPedido,
      total: Number(row.Total),
      subtotal: Number(row.Subtotal),
      descuento: Number(row.Descuento),
      costoEnvio: Number(row.CostoEnvio),
      ivaIncluido: Number(row.IVAIncluido),
      moneda: row.Moneda,
      estadoCodigo: row.EstadoCodigo,
      estadoNombre: row.EstadoNombre,
      idReserva: row.IDReserva,
      estadoReserva: row.EstadoReserva,
      fechaExpiracionReserva: new Date(row.FechaExpiracionReserva).toISOString(),
      segundosRestantesReserva: row.SegundosRestantesReserva,
    };
  }

  async confirmarPago(
    idPedido: number,
    idUsuario: number,
    claveIdempotenciaPago: string,
    proveedor = "SIMULADOR",
    referenciaProveedor?: string,
    monto?: number,
    respuestaProveedor?: string
  ): Promise<PagoConfirmadoDTO> {
    const res = await ejecutarSp<PagoConfirmadoRow>("dbo.SP_Checkout_ConfirmarPago", [
      { nombre: "IDPedido", tipo: sql.BigInt, valor: idPedido },
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario },
      { nombre: "ClaveIdempotenciaPago", tipo: sql.VarChar(100), valor: claveIdempotenciaPago },
      { nombre: "Proveedor", tipo: sql.VarChar(60), valor: proveedor },
      { nombre: "ReferenciaProveedor", tipo: sql.NVarChar(150), valor: referenciaProveedor ?? null },
      { nombre: "Monto", tipo: sql.Decimal(14, 2), valor: monto ?? null },
      { nombre: "RespuestaProveedor", tipo: sql.NVarChar(sql.MAX), valor: respuestaProveedor ?? null },
    ]);

    const row = res.recordset[0];
    if (!row) {
      throw new Error("No se obtuvieron datos al confirmar el pago.");
    }

    return {
      idPedido: row.IDPedido,
      numeroPedido: row.NumeroPedido,
      total: Number(row.Total),
      moneda: row.Moneda,
      estadoCodigo: row.EstadoCodigo,
      estadoNombre: row.EstadoNombre,
      idPago: row.IDPago,
      estadoPago: row.EstadoPago,
      proveedor: row.Proveedor,
      referenciaProveedor: row.ReferenciaProveedor,
      fechaConfirmacion: new Date(row.FechaConfirmacion).toISOString(),
    };
  }
}
