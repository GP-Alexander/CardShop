import { DireccionesDal } from "./direcciones.dal";
import {
  CrearDireccionInput,
  ActualizarDireccionInput,
  DireccionDTO,
} from "@shopcart/contracts";

export class DireccionesService {
  constructor(private readonly direccionesDal: DireccionesDal = new DireccionesDal()) {}

  async crear(idUsuario: number, datos: CrearDireccionInput): Promise<DireccionDTO> {
    return this.direccionesDal.crear(idUsuario, datos);
  }

  async listarPropias(idUsuario: number): Promise<DireccionDTO[]> {
    return this.direccionesDal.listarPropias(idUsuario);
  }

  async obtenerPorID(idDireccion: number, idUsuario: number): Promise<DireccionDTO> {
    return this.direccionesDal.obtenerPorID(idDireccion, idUsuario);
  }

  async actualizar(
    idDireccion: number,
    idUsuario: number,
    datos: ActualizarDireccionInput
  ): Promise<DireccionDTO> {
    return this.direccionesDal.actualizar(idDireccion, idUsuario, datos);
  }

  async eliminar(idDireccion: number, idUsuario: number): Promise<{ idDireccion: number }> {
    const idEliminado = await this.direccionesDal.eliminar(idDireccion, idUsuario);
    return { idDireccion: idEliminado };
  }

  async establecerPredeterminada(idDireccion: number, idUsuario: number): Promise<DireccionDTO> {
    return this.direccionesDal.establecerPredeterminada(idDireccion, idUsuario);
  }
}
