import { InventarioDal } from "./inventario.dal";
import {
  ListarInventarioQuery,
  RespuestaPaginadaInventarioDTO,
  InventarioItemDTO,
  RegistrarEntradaInventarioInput,
  RegistrarAjusteInventarioInput,
  ActualizarPuntoReordenInput,
  ListarKardexQuery,
  RespuestaPaginadaKardexDTO,
} from "@shopcart/contracts";
import { NotFoundError } from "../../shared/errors/AppError";

export class InventarioService {
  constructor(private readonly inventarioDal: InventarioDal = new InventarioDal()) {}

  async listarExistencias(
    filtros: ListarInventarioQuery
  ): Promise<RespuestaPaginadaInventarioDTO> {
    const { items, totalRegistros } = await this.inventarioDal.listarExistencias(filtros);
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

  async obtenerPorVariante(
    idVariante: number,
    codigoAlmacen = "PRINCIPAL"
  ): Promise<InventarioItemDTO> {
    const item = await this.inventarioDal.obtenerPorVariante(idVariante, codigoAlmacen);
    if (!item) {
      throw new NotFoundError(
        `No se encontró información de inventario para la variante con ID ${idVariante}.`,
        "VARIANTE_NO_ENCONTRADA"
      );
    }
    return item;
  }

  async registrarEntrada(
    input: RegistrarEntradaInventarioInput,
    idUsuario: number,
    direccionIp?: string
  ): Promise<InventarioItemDTO> {
    return this.inventarioDal.registrarEntrada(
      input.idVariante,
      input.cantidad,
      input.motivo,
      idUsuario,
      input.codigoAlmacen || "PRINCIPAL",
      direccionIp
    );
  }

  async registrarAjuste(
    input: RegistrarAjusteInventarioInput,
    idUsuario: number,
    direccionIp?: string
  ): Promise<InventarioItemDTO> {
    return this.inventarioDal.registrarAjuste(
      input.idVariante,
      input.cantidad,
      input.motivo,
      idUsuario,
      input.codigoAlmacen || "PRINCIPAL",
      direccionIp
    );
  }

  async actualizarPuntoReorden(
    input: ActualizarPuntoReordenInput,
    idUsuario: number,
    direccionIp?: string
  ): Promise<InventarioItemDTO> {
    return this.inventarioDal.actualizarPuntoReorden(
      input.idVariante,
      input.puntoReorden,
      idUsuario,
      input.codigoAlmacen || "PRINCIPAL",
      direccionIp
    );
  }

  async listarKardex(
    filtros: ListarKardexQuery
  ): Promise<RespuestaPaginadaKardexDTO> {
    const { items, totalRegistros } = await this.inventarioDal.listarKardex(filtros);
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
