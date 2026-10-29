import sql from "mssql";
import { ejecutarSp } from "../../shared/db/ejecutarSp";
import { DevolucionDTO } from "@shopcart/contracts";

interface DevolucionRow {
  IDDevolucion: number;
  IDPedido: number;
  NumeroPedido: string;
  MontoReembolso: number;
  EstadoPedidoActualizado: string;
  FechaResolucion: Date;
}

export class DevolucionesDal {
  async crear(
    idPedido: number,
    idUsuarioSolicitante: number,
    motivo: string,
    lineasJson: string
  ): Promise<DevolucionDTO> {
    const res = await ejecutarSp<DevolucionRow>("dbo.SP_Devoluciones_Crear", [
      { nombre: "IDPedido", tipo: sql.BigInt, valor: idPedido },
      { nombre: "IDUsuarioSolicitante", tipo: sql.Int, valor: idUsuarioSolicitante },
      { nombre: "Motivo", tipo: sql.NVarChar(500), valor: motivo },
      { nombre: "LineasJson", tipo: sql.NVarChar(sql.MAX), valor: lineasJson },
    ]);

    const row = res.recordset[0];
    if (!row) {
      throw new Error("No se obtuvieron datos tras registrar la devolución.");
    }

    return {
      idDevolucion: row.IDDevolucion,
      idPedido: row.IDPedido,
      numeroPedido: row.NumeroPedido,
      montoReembolso: Number(row.MontoReembolso),
      estadoPedidoActualizado: row.EstadoPedidoActualizado,
      fechaResolucion: new Date(row.FechaResolucion).toISOString(),
    };
  }
}
