import sql from "mssql";
import { ejecutarSp } from "../../shared/db/ejecutarSp";
import {
  PedidoResumenDTO,
  PedidoDetalleDTO,
  PedidoLineaDTO,
  HistorialEstadoDTO,
  FiltroPedidosQuery,
} from "@shopcart/contracts";

interface PedidoResumenRow {
  IDPedido: number;
  NumeroPedido: string;
  FechaCreacion: Date;
  FechaPago: Date | null;
  FechaEntrega: Date | null;
  FechaCancelacion: Date | null;
  Subtotal: number;
  Descuento: number;
  CostoEnvio: number;
  Total: number;
  Moneda: string;
  EstadoCodigo: string;
  EstadoNombre: string;
  PermiteCancelacion?: boolean;
  CantidadLineas: number;
  TotalArticulos: number;
  IDCliente?: number;
  ClienteNombre?: string;
  ClienteCorreo?: string;
}

interface PedidoCabeceraRow {
  IDPedido: number;
  NumeroPedido: string;
  IDUsuario: number;
  ClienteNombre: string;
  ClienteCorreo: string;
  IDEstadoPedido: number;
  EstadoCodigo: string;
  EstadoNombre: string;
  PermiteCancelacion: boolean;
  DestinatarioSnapshot: string;
  TelefonoSnapshot: string;
  DireccionSnapshot: string;
  Subtotal: number;
  Descuento: number;
  CostoEnvio: number;
  Total: number;
  IVAIncluido: number;
  PorcentajeIVA: number;
  Moneda: string;
  FechaCreacion: Date;
  FechaActualizacion: Date;
  FechaPago: Date | null;
  FechaEntrega: Date | null;
  FechaCancelacion: Date | null;
  IDCupon: number | null;
  CodigoCupon: string | null;
  IDPago: number | null;
  PagoProveedor: string | null;
  PagoReferencia: string | null;
  PagoEstado: string | null;
  PagoFecha: Date | null;
}

interface PedidoLineaRow {
  IDPedidoDetalle: number;
  IDPedido: number;
  IDVariante: number;
  SKU: string;
  NombreProducto: string;
  DescripcionVariante: string;
  PrecioUnitario: number;
  Cantidad: number;
  ImporteBruto: number;
  DescuentoLinea: number;
  TotalLinea: number;
  IVALinea: number;
  CantidadDevuelta: number;
  CantidadDisponibleParaDevolver: number;
}

interface HistorialEstadoRow {
  IDHistorialEstado: number;
  FechaCambio: Date;
  EstadoAnteriorCodigo: string | null;
  EstadoAnteriorNombre: string | null;
  EstadoNuevoCodigo: string;
  EstadoNuevoNombre: string;
  IDUsuario: number;
  UsuarioNombre: string;
  MotivoComentario: string | null;
}

export class PedidosDal {
  async listarPropios(
    idUsuario: number,
    pagina = 1,
    limite = 10
  ): Promise<{ pedidos: PedidoResumenDTO[]; total: number }> {
    const res = await ejecutarSp<PedidoResumenRow>("dbo.SP_Pedidos_ListarPropios", [
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario },
      { nombre: "Pagina", tipo: sql.Int, valor: pagina },
      { nombre: "Limite", tipo: sql.Int, valor: limite },
      { nombre: "TotalRegistros", tipo: sql.Int, valor: null, esSalida: true },
    ]);

    const pedidos: PedidoResumenDTO[] = (res.recordset || []).map((r) => ({
      idPedido: r.IDPedido,
      numeroPedido: r.NumeroPedido,
      fechaCreacion: new Date(r.FechaCreacion).toISOString(),
      fechaPago: r.FechaPago ? new Date(r.FechaPago).toISOString() : null,
      fechaEntrega: r.FechaEntrega ? new Date(r.FechaEntrega).toISOString() : null,
      fechaCancelacion: r.FechaCancelacion ? new Date(r.FechaCancelacion).toISOString() : null,
      subtotal: Number(r.Subtotal),
      descuento: Number(r.Descuento),
      costoEnvio: Number(r.CostoEnvio),
      total: Number(r.Total),
      moneda: r.Moneda,
      estadoCodigo: r.EstadoCodigo,
      estadoNombre: r.EstadoNombre,
      permiteCancelacion: Boolean(r.PermiteCancelacion),
      cantidadLineas: r.CantidadLineas,
      totalArticulos: r.TotalArticulos,
    }));

    const total = Number(res.output?.TotalRegistros || 0);

    return { pedidos, total };
  }

  async obtenerDetalle(
    idPedido: number,
    idUsuario?: number,
    esOperador = false
  ): Promise<PedidoDetalleDTO | null> {
    const res = await ejecutarSp("dbo.SP_Pedidos_ObtenerDetalle", [
      { nombre: "IDPedido", tipo: sql.BigInt, valor: idPedido },
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario ?? null },
      { nombre: "EsOperador", tipo: sql.Bit, valor: esOperador ? 1 : 0 },
    ]);

    const cabeceraRows = (res.recordsets[0] || []) as PedidoCabeceraRow[];
    const cabecera = cabeceraRows[0];
    if (!cabecera) {
      return null;
    }

    const lineasRows = (res.recordsets[1] || []) as PedidoLineaRow[];
    const historialRows = (res.recordsets[2] || []) as HistorialEstadoRow[];

    const lineas: PedidoLineaDTO[] = lineasRows.map((l) => ({
      idPedidoDetalle: l.IDPedidoDetalle,
      idPedido: l.IDPedido,
      idVariante: l.IDVariante,
      sku: l.SKU,
      nombreProducto: l.NombreProducto,
      descripcionVariante: l.DescripcionVariante,
      precioUnitario: Number(l.PrecioUnitario),
      cantidad: l.Cantidad,
      importeBruto: Number(l.ImporteBruto),
      descuentoLinea: Number(l.DescuentoLinea),
      totalLinea: Number(l.TotalLinea),
      ivaLinea: Number(l.IVALinea),
      cantidadDevuelta: l.CantidadDevuelta,
      cantidadDisponibleParaDevolver: l.CantidadDisponibleParaDevolver,
    }));

    const historialEstados: HistorialEstadoDTO[] = historialRows.map((h) => ({
      idHistorialEstado: h.IDHistorialEstado,
      fechaCambio: new Date(h.FechaCambio).toISOString(),
      estadoAnteriorCodigo: h.EstadoAnteriorCodigo,
      estadoAnteriorNombre: h.EstadoAnteriorNombre,
      estadoNuevoCodigo: h.EstadoNuevoCodigo,
      estadoNuevoNombre: h.EstadoNuevoNombre,
      idUsuario: h.IDUsuario,
      usuarioNombre: h.UsuarioNombre,
      motivoComentario: h.MotivoComentario,
    }));

    return {
      idPedido: cabecera.IDPedido,
      numeroPedido: cabecera.NumeroPedido,
      idUsuario: cabecera.IDUsuario,
      clienteNombre: cabecera.ClienteNombre,
      clienteCorreo: cabecera.ClienteCorreo,
      idEstadoPedido: cabecera.IDEstadoPedido,
      estadoCodigo: cabecera.EstadoCodigo,
      estadoNombre: cabecera.EstadoNombre,
      permiteCancelacion: Boolean(cabecera.PermiteCancelacion),
      destinatarioSnapshot: cabecera.DestinatarioSnapshot,
      telefonoSnapshot: cabecera.TelefonoSnapshot,
      direccionSnapshot: cabecera.DireccionSnapshot,
      subtotal: Number(cabecera.Subtotal),
      descuento: Number(cabecera.Descuento),
      costoEnvio: Number(cabecera.CostoEnvio),
      total: Number(cabecera.Total),
      ivaIncluido: Number(cabecera.IVAIncluido),
      porcentajeIVA: Number(cabecera.PorcentajeIVA),
      moneda: cabecera.Moneda,
      fechaCreacion: new Date(cabecera.FechaCreacion).toISOString(),
      fechaActualizacion: new Date(cabecera.FechaActualizacion).toISOString(),
      fechaPago: cabecera.FechaPago ? new Date(cabecera.FechaPago).toISOString() : null,
      fechaEntrega: cabecera.FechaEntrega ? new Date(cabecera.FechaEntrega).toISOString() : null,
      fechaCancelacion: cabecera.FechaCancelacion ? new Date(cabecera.FechaCancelacion).toISOString() : null,
      idCupon: cabecera.IDCupon,
      codigoCupon: cabecera.CodigoCupon,
      idPago: cabecera.IDPago,
      pagoProveedor: cabecera.PagoProveedor,
      pagoReferencia: cabecera.PagoReferencia,
      pagoEstado: cabecera.PagoEstado,
      pagoFecha: cabecera.PagoFecha ? new Date(cabecera.PagoFecha).toISOString() : null,
      lineas,
      historialEstados,
    };
  }

  async listarAdmin(
    filtro: FiltroPedidosQuery
  ): Promise<{ pedidos: PedidoResumenDTO[]; total: number }> {
    const res = await ejecutarSp<PedidoResumenRow>("dbo.SP_Pedidos_ListarAdmin", [
      { nombre: "Pagina", tipo: sql.Int, valor: filtro.pagina || 1 },
      { nombre: "Limite", tipo: sql.Int, valor: filtro.limite || 20 },
      { nombre: "CodigoEstado", tipo: sql.VarChar(30), valor: filtro.estado ?? null },
      { nombre: "IDCliente", tipo: sql.Int, valor: filtro.idCliente ?? null },
      { nombre: "Busqueda", tipo: sql.NVarChar(100), valor: filtro.busqueda ?? null },
      { nombre: "FechaInicio", tipo: sql.DateTime2(3), valor: filtro.fechaInicio ? new Date(filtro.fechaInicio) : null },
      { nombre: "FechaFin", tipo: sql.DateTime2(3), valor: filtro.fechaFin ? new Date(filtro.fechaFin) : null },
      { nombre: "TotalRegistros", tipo: sql.Int, valor: null, esSalida: true },
    ]);

    const pedidos: PedidoResumenDTO[] = (res.recordset || []).map((r) => ({
      idPedido: r.IDPedido,
      numeroPedido: r.NumeroPedido,
      fechaCreacion: new Date(r.FechaCreacion).toISOString(),
      fechaPago: r.FechaPago ? new Date(r.FechaPago).toISOString() : null,
      fechaEntrega: r.FechaEntrega ? new Date(r.FechaEntrega).toISOString() : null,
      fechaCancelacion: r.FechaCancelacion ? new Date(r.FechaCancelacion).toISOString() : null,
      subtotal: Number(r.Subtotal),
      descuento: Number(r.Descuento),
      costoEnvio: Number(r.CostoEnvio),
      total: Number(r.Total),
      moneda: r.Moneda,
      estadoCodigo: r.EstadoCodigo,
      estadoNombre: r.EstadoNombre,
      permiteCancelacion: Boolean(r.PermiteCancelacion),
      cantidadLineas: r.CantidadLineas,
      totalArticulos: r.TotalArticulos,
      idCliente: r.IDCliente,
      clienteNombre: r.ClienteNombre,
      clienteCorreo: r.ClienteCorreo,
    }));

    const total = Number(res.output?.TotalRegistros || 0);

    return { pedidos, total };
  }

  async cambiarEstado(
    idPedido: number,
    nuevoEstadoCodigo: string,
    idUsuarioOperador: number,
    motivo: string
  ): Promise<{ idPedido: number; numeroPedido: string; estadoAnterior: string; estadoNuevo: string }> {
    const res = await ejecutarSp<{
      IDPedido: number;
      NumeroPedido: string;
      EstadoAnterior: string;
      EstadoNuevo: string;
    }>("dbo.SP_Pedidos_CambiarEstado", [
      { nombre: "IDPedido", tipo: sql.BigInt, valor: idPedido },
      { nombre: "NuevoEstadoCodigo", tipo: sql.VarChar(30), valor: nuevoEstadoCodigo },
      { nombre: "IDUsuarioOperador", tipo: sql.Int, valor: idUsuarioOperador },
      { nombre: "Motivo", tipo: sql.NVarChar(500), valor: motivo },
    ]);

    const row = res.recordset[0];
    return {
      idPedido: row.IDPedido,
      numeroPedido: row.NumeroPedido,
      estadoAnterior: row.EstadoAnterior,
      estadoNuevo: row.EstadoNuevo,
    };
  }
}
