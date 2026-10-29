import { DevolucionesDal } from "./devoluciones.dal";
import { CrearDevolucionInput, DevolucionDTO } from "@shopcart/contracts";
import { PedidosDal } from "../pedidos/pedidos.dal";
import { ForbiddenError, NotFoundError } from "../../shared/errors/AppError";

export class DevolucionesService {
  constructor(
    private readonly dal: DevolucionesDal = new DevolucionesDal(),
    private readonly pedidosDal: PedidosDal = new PedidosDal()
  ) {}

  async crear(
    idUsuario: number,
    rol: string,
    input: CrearDevolucionInput
  ): Promise<DevolucionDTO> {
    const esOperador = rol === "Operador" || rol === "Administrador";

    // Validar propiedad del pedido si no es operador (protección IDOR)
    const pedido = await this.pedidosDal.obtenerDetalle(input.idPedido, idUsuario, esOperador);
    if (!pedido) {
      throw new NotFoundError("El pedido no existe.");
    }

    if (!esOperador && pedido.idUsuario !== idUsuario) {
      throw new ForbiddenError("No tiene permiso para solicitar devoluciones sobre este pedido.");
    }

    // Normalizar líneas a formato { idPedidoDetalle, cantidad }
    const lineasNormalizadas = input.lineas.map((l) => ({
      idPedidoDetalle: l.idPedidoDetalle ?? l.idDetallePedido,
      cantidad: l.cantidad,
    }));

    const lineasJson = JSON.stringify(lineasNormalizadas);

    return this.dal.crear(input.idPedido, idUsuario, input.motivo, lineasJson);
  }
}
