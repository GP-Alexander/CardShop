import { BitacoraDal } from "./bitacora.dal";
import { ListarBitacoraQuery, RespuestaPaginadaBitacoraDTO } from "@shopcart/contracts";

export class BitacoraService {
  constructor(private readonly bitacoraDal: BitacoraDal = new BitacoraDal()) {}

  async listarPaginado(filtros: ListarBitacoraQuery): Promise<RespuestaPaginadaBitacoraDTO> {
    const { items, totalRegistros } = await this.bitacoraDal.listarPaginado(filtros);

    const totalPaginas = Math.ceil(totalRegistros / filtros.limite) || 1;

    return {
      datos: items,
      paginacion: {
        paginaActual: filtros.pagina,
        limite: filtros.limite,
        totalRegistros,
        totalPaginas,
      },
    };
  }
}
