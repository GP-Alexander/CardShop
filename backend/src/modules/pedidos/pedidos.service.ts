import { PedidosDal } from "./pedidos.dal";
import {
  PedidoResumenDTO,
  PedidoDetalleDTO,
  FiltroPedidosQuery,
  TransicionEstadoPedidoInput,
} from "@shopcart/contracts";
import { NotFoundError, ForbiddenError } from "../../shared/errors/AppError";

export class PedidosService {
  constructor(private readonly dal: PedidosDal = new PedidosDal()) {}

  async listarMisPedidos(
    idUsuario: number,
    pagina = 1,
    limite = 10
  ): Promise<{ pedidos: PedidoResumenDTO[]; total: number; pagina: number; totalPaginas: number }> {
    const { pedidos, total } = await this.dal.listarPropios(idUsuario, pagina, limite);
    return {
      pedidos,
      total,
      pagina,
      totalPaginas: Math.ceil(total / limite) || 1,
    };
  }

  async obtenerDetalle(
    idPedido: number,
    idUsuario?: number,
    rol?: string
  ): Promise<PedidoDetalleDTO> {
    const esOperador = rol === "Operador" || rol === "Administrador";
    const pedido = await this.dal.obtenerDetalle(idPedido, idUsuario, esOperador);

    if (!pedido) {
      throw new NotFoundError("El pedido solicitado no fue encontrado.");
    }

    if (!esOperador && pedido.idUsuario !== idUsuario) {
      throw new ForbiddenError("No tiene permiso para ver este pedido.");
    }

    return pedido;
  }

  async listarAdmin(
    filtro: FiltroPedidosQuery
  ): Promise<{ pedidos: PedidoResumenDTO[]; total: number; pagina: number; totalPaginas: number }> {
    const { pedidos, total } = await this.dal.listarAdmin(filtro);
    const limite = filtro.limite || 20;
    const pagina = filtro.pagina || 1;
    return {
      pedidos,
      total,
      pagina,
      totalPaginas: Math.ceil(total / limite) || 1,
    };
  }

  async cambiarEstado(
    idPedido: number,
    input: TransicionEstadoPedidoInput,
    idOperador: number
  ): Promise<{ idPedido: number; numeroPedido: string; estadoAnterior: string; estadoNuevo: string }> {
    return this.dal.cambiarEstado(idPedido, input.nuevoEstado, idOperador, input.motivo);
  }
}
