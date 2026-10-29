import crypto from "crypto";
import { CarritoDal } from "./carrito.dal";
import {
  CarritoDTO,
  AgregarItemCarritoInput,
  ModificarCantidadCarritoInput,
} from "@shopcart/contracts";

export class CarritoService {
  constructor(private readonly carritoDal: CarritoDal = new CarritoDal()) {}

  hashTokenInvitado(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async resolverIDCarrito(
    idUsuario?: number,
    tokenInvitado?: string
  ): Promise<{ idCarrito: number; nuevoTokenInvitado?: string }> {
    let tokenHash: string | undefined = undefined;
    let nuevoTokenInvitado: string | undefined = undefined;

    if (!idUsuario) {
      if (!tokenInvitado) {
        nuevoTokenInvitado = crypto.randomUUID();
        tokenHash = this.hashTokenInvitado(nuevoTokenInvitado);
      } else {
        tokenHash = this.hashTokenInvitado(tokenInvitado);
      }
    }

    const idCarrito = await this.carritoDal.obtenerOCrearCarrito(idUsuario, tokenHash);
    return { idCarrito, nuevoTokenInvitado };
  }

  async obtenerCarrito(
    idUsuario?: number,
    tokenInvitado?: string
  ): Promise<{ carrito: CarritoDTO; nuevoTokenInvitado?: string }> {
    const { idCarrito, nuevoTokenInvitado } = await this.resolverIDCarrito(
      idUsuario,
      tokenInvitado
    );
    const carrito = await this.carritoDal.obtenerDetalle(idCarrito);
    return { carrito, nuevoTokenInvitado };
  }

  async agregarItem(
    input: AgregarItemCarritoInput,
    idUsuario?: number,
    tokenInvitado?: string
  ): Promise<{ carrito: CarritoDTO; nuevoTokenInvitado?: string }> {
    const { idCarrito, nuevoTokenInvitado } = await this.resolverIDCarrito(
      idUsuario,
      tokenInvitado
    );
    const carrito = await this.carritoDal.agregarItem(
      idCarrito,
      input.idVariante,
      input.cantidad
    );
    return { carrito, nuevoTokenInvitado };
  }

  async modificarCantidad(
    idVariante: number,
    input: ModificarCantidadCarritoInput,
    idUsuario?: number,
    tokenInvitado?: string
  ): Promise<{ carrito: CarritoDTO; nuevoTokenInvitado?: string }> {
    const { idCarrito, nuevoTokenInvitado } = await this.resolverIDCarrito(
      idUsuario,
      tokenInvitado
    );
    const carrito = await this.carritoDal.modificarCantidad(
      idCarrito,
      idVariante,
      input.cantidad
    );
    return { carrito, nuevoTokenInvitado };
  }

  async eliminarItem(
    idVariante: number,
    idUsuario?: number,
    tokenInvitado?: string
  ): Promise<{ carrito: CarritoDTO; nuevoTokenInvitado?: string }> {
    const { idCarrito, nuevoTokenInvitado } = await this.resolverIDCarrito(
      idUsuario,
      tokenInvitado
    );
    const carrito = await this.carritoDal.eliminarItem(idCarrito, idVariante);
    return { carrito, nuevoTokenInvitado };
  }

  async vaciarCarrito(
    idUsuario?: number,
    tokenInvitado?: string
  ): Promise<{ carrito: CarritoDTO; nuevoTokenInvitado?: string }> {
    const { idCarrito, nuevoTokenInvitado } = await this.resolverIDCarrito(
      idUsuario,
      tokenInvitado
    );
    const carrito = await this.carritoDal.vaciar(idCarrito);
    return { carrito, nuevoTokenInvitado };
  }

  async aplicarCupon(
    codigo: string,
    idUsuario?: number,
    tokenInvitado?: string
  ): Promise<{ carrito: CarritoDTO; nuevoTokenInvitado?: string }> {
    const { idCarrito, nuevoTokenInvitado } = await this.resolverIDCarrito(
      idUsuario,
      tokenInvitado
    );
    const carrito = await this.carritoDal.aplicarCupon(idCarrito, codigo, idUsuario);
    return { carrito, nuevoTokenInvitado };
  }

  async removerCupon(
    idUsuario?: number,
    tokenInvitado?: string
  ): Promise<{ carrito: CarritoDTO; nuevoTokenInvitado?: string }> {
    const { idCarrito, nuevoTokenInvitado } = await this.resolverIDCarrito(
      idUsuario,
      tokenInvitado
    );
    const carrito = await this.carritoDal.removerCupon(idCarrito);
    return { carrito, nuevoTokenInvitado };
  }

  async migrarCarritoInvitado(
    tokenInvitado: string,
    idUsuario: number
  ): Promise<CarritoDTO> {
    const tokenHash = this.hashTokenInvitado(tokenInvitado);
    const idCarrito = await this.carritoDal.migrarInvitadoAUsuario(tokenHash, idUsuario);
    return this.carritoDal.obtenerDetalle(idCarrito);
  }
}
