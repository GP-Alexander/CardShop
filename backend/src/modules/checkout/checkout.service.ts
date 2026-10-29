import { randomUUID } from "crypto";
import { CheckoutDal } from "./checkout.dal";
import {
  IniciarCheckoutInput,
  ConfirmarPagoInput,
  CheckoutIniciadoDTO,
  PagoConfirmadoDTO,
} from "@shopcart/contracts";
import { BadRequestError } from "../../shared/errors/AppError";

export class CheckoutService {
  constructor(private readonly dal: CheckoutDal = new CheckoutDal()) {}

  async iniciarCheckout(
    idUsuario: number,
    input: IniciarCheckoutInput
  ): Promise<CheckoutIniciadoDTO> {
    const claveIdempotencia = input.claveIdempotencia || randomUUID();
    return this.dal.iniciar(
      idUsuario,
      input.idDireccion,
      claveIdempotencia,
      input.codigoCupon
    );
  }

  async confirmarPago(
    idUsuario: number,
    input: ConfirmarPagoInput
  ): Promise<PagoConfirmadoDTO> {
    const idPedido = input.idPedido || input.idReserva;
    if (!idPedido) {
      throw new BadRequestError(
        "Debe especificar el idPedido para confirmar el pago",
        "ID_PEDIDO_REQUERIDO"
      );
    }

    return this.dal.confirmarPago(
      idPedido,
      idUsuario,
      input.claveIdempotencia,
      input.metodoPago,
      input.referenciaProveedor,
      input.monto
    );
  }
}
