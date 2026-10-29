import { CuponesDal } from "./cupones.dal";
import {
  ListarCuponesQuery,
  RespuestaPaginadaCuponesDTO,
  CrearCuponInput,
} from "@shopcart/contracts";

export class CuponesService {
  constructor(private readonly cuponesDal: CuponesDal = new CuponesDal()) {}

  async listarPaginado(
    filtros: ListarCuponesQuery
  ): Promise<RespuestaPaginadaCuponesDTO> {
    const { items, totalRegistros } = await this.cuponesDal.listarPaginado(filtros);
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

  async crear(
    input: CrearCuponInput,
    idUsuarioAdmin: number,
    direccionIp?: string
  ): Promise<{ idCupon: number }> {
    const idCupon = await this.cuponesDal.crear(input, idUsuarioAdmin, direccionIp);
    return { idCupon };
  }
}
