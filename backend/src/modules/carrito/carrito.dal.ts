import sql from "mssql";
import { ejecutarSp } from "../../shared/db/ejecutarSp";
import {
  CarritoDTO,
  ItemCarritoDTO,
  AtributoVarianteResumen,
} from "@shopcart/contracts";

interface CarritoDetalleDbRow {
  IDVariante: number;
  SKU: string;
  IDProducto: number;
  ProductoNombre: string;
  ProductoMarca: string | null;
  IDCategoria: number;
  CategoriaNombre: string;
  PrecioUnitario: number;
  Cantidad: number;
  SubtotalLinea: number;
  ExistenciaDisponible: number;
  StockDisponibleSuficiente: number;
  AtributosJson: string | null;
}

interface CarritoCabeceraDbRow {
  IDCarrito: number;
  IDUsuario: number | null;
  TokenInvitadoHash: string | null;
  Estado: string;
  FechaUltimaActividad: Date;
  Subtotal: number;
  Descuento: number;
  Total: number;
  IDCupon: number | null;
  CodigoCupon: string | null;
  TipoDescuentoCupon: string | null;
  ValorDescuentoCupon: number | null;
  AlcanceCupon: string | null;
}

export class CarritoDal {
  private procesarResultadoCarrito(
    recordsets: unknown[][]
  ): CarritoDTO {
    const itemsRows = (recordsets[0] || []) as CarritoDetalleDbRow[];
    const cabeceraRows = (recordsets[1] || []) as CarritoCabeceraDbRow[];

    const cabecera = cabeceraRows[0] || {
      IDCarrito: 0,
      IDUsuario: null,
      TokenInvitadoHash: null,
      Estado: "ACTIVO",
      FechaUltimaActividad: new Date(),
      Subtotal: 0,
      Descuento: 0,
      Total: 0,
      IDCupon: null,
      CodigoCupon: null,
      TipoDescuentoCupon: null,
      ValorDescuentoCupon: null,
      AlcanceCupon: null,
    };

    const items: ItemCarritoDTO[] = itemsRows.map((r) => {
      let atributos: AtributoVarianteResumen[] = [];
      if (r.AtributosJson) {
        try {
          atributos = JSON.parse(r.AtributosJson);
        } catch {
          atributos = [];
        }
      }

      return {
        idVariante: r.IDVariante,
        sku: r.SKU,
        idProducto: r.IDProducto,
        productoNombre: r.ProductoNombre,
        productoMarca: r.ProductoMarca,
        idCategoria: r.IDCategoria,
        categoriaNombre: r.CategoriaNombre,
        precioUnitario: Number(r.PrecioUnitario),
        cantidad: r.Cantidad,
        subtotalLinea: Number(r.SubtotalLinea),
        existenciaDisponible: r.ExistenciaDisponible,
        stockDisponibleSuficiente: Boolean(r.StockDisponibleSuficiente),
        atributos,
      };
    });

    return {
      idCarrito: cabecera.IDCarrito,
      idUsuario: cabecera.IDUsuario,
      tokenInvitadoHash: cabecera.TokenInvitadoHash,
      estado: cabecera.Estado,
      fechaUltimaActividad: cabecera.FechaUltimaActividad
        ? new Date(cabecera.FechaUltimaActividad).toISOString()
        : new Date().toISOString(),
      subtotal: Number(cabecera.Subtotal),
      descuento: Number(cabecera.Descuento),
      total: Number(cabecera.Total),
      idCupon: cabecera.IDCupon,
      codigoCupon: cabecera.CodigoCupon,
      tipoDescuentoCupon: cabecera.TipoDescuentoCupon,
      valorDescuentoCupon: cabecera.ValorDescuentoCupon !== null ? Number(cabecera.ValorDescuentoCupon) : null,
      alcanceCupon: cabecera.AlcanceCupon,
      items,
    };
  }

  async obtenerOCrearCarrito(
    idUsuario?: number,
    tokenInvitadoHash?: string
  ): Promise<number> {
    const res = await ejecutarSp<{ IDCarrito: number }>("dbo.SP_Carrito_ObtenerOCrear", [
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario || null },
      { nombre: "TokenInvitadoHash", tipo: sql.Char(64), valor: tokenInvitadoHash || null },
    ]);

    return res.recordset[0].IDCarrito;
  }

  async obtenerDetalle(idCarrito: number): Promise<CarritoDTO> {
    const res = await ejecutarSp("dbo.SP_Carrito_ObtenerDetalle", [
      { nombre: "IDCarrito", tipo: sql.BigInt, valor: idCarrito },
    ]);

    return this.procesarResultadoCarrito(res.recordsets);
  }

  async agregarItem(
    idCarrito: number,
    idVariante: number,
    cantidad: number
  ): Promise<CarritoDTO> {
    const res = await ejecutarSp("dbo.SP_Carrito_AgregarItem", [
      { nombre: "IDCarrito", tipo: sql.BigInt, valor: idCarrito },
      { nombre: "IDVariante", tipo: sql.Int, valor: idVariante },
      { nombre: "Cantidad", tipo: sql.Int, valor: cantidad },
    ]);

    return this.procesarResultadoCarrito(res.recordsets);
  }

  async modificarCantidad(
    idCarrito: number,
    idVariante: number,
    nuevaCantidad: number
  ): Promise<CarritoDTO> {
    const res = await ejecutarSp("dbo.SP_Carrito_ModificarCantidad", [
      { nombre: "IDCarrito", tipo: sql.BigInt, valor: idCarrito },
      { nombre: "IDVariante", tipo: sql.Int, valor: idVariante },
      { nombre: "NuevaCantidad", tipo: sql.Int, valor: nuevaCantidad },
    ]);

    return this.procesarResultadoCarrito(res.recordsets);
  }

  async eliminarItem(idCarrito: number, idVariante: number): Promise<CarritoDTO> {
    const res = await ejecutarSp("dbo.SP_Carrito_EliminarItem", [
      { nombre: "IDCarrito", tipo: sql.BigInt, valor: idCarrito },
      { nombre: "IDVariante", tipo: sql.Int, valor: idVariante },
    ]);

    return this.procesarResultadoCarrito(res.recordsets);
  }

  async vaciar(idCarrito: number): Promise<CarritoDTO> {
    const res = await ejecutarSp("dbo.SP_Carrito_Vaciar", [
      { nombre: "IDCarrito", tipo: sql.BigInt, valor: idCarrito },
    ]);

    return this.procesarResultadoCarrito(res.recordsets);
  }

  async migrarInvitadoAUsuario(
    tokenInvitadoHash: string,
    idUsuario: number
  ): Promise<number> {
    const res = await ejecutarSp<{ IDCarrito: number }>("dbo.SP_Carrito_MigrarInvitadoAUsuario", [
      { nombre: "TokenInvitadoHash", tipo: sql.Char(64), valor: tokenInvitadoHash },
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario },
    ]);

    return res.recordset && res.recordset.length > 0 ? res.recordset[0].IDCarrito : 0;
  }

  async aplicarCupon(
    idCarrito: number,
    codigo: string,
    idUsuario?: number
  ): Promise<CarritoDTO> {
    const res = await ejecutarSp("dbo.SP_Cupon_AplicarACarrito", [
      { nombre: "IDCarrito", tipo: sql.BigInt, valor: idCarrito },
      { nombre: "Codigo", tipo: sql.VarChar(50), valor: codigo },
      { nombre: "IDUsuario", tipo: sql.Int, valor: idUsuario || null },
    ]);

    return this.procesarResultadoCarrito(res.recordsets);
  }

  async removerCupon(idCarrito: number): Promise<CarritoDTO> {
    const res = await ejecutarSp("dbo.SP_Cupon_RemoverDeCarrito", [
      { nombre: "IDCarrito", tipo: sql.BigInt, valor: idCarrito },
    ]);

    return this.procesarResultadoCarrito(res.recordsets);
  }
}
