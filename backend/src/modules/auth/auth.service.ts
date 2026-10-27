import { AuthDal } from "./auth.dal";
import { hashPassword, verifyPassword } from "../../shared/security/hash";
import {
  emitirAccessToken,
  generarRefreshTokenPlano,
  hashearTokenSha256,
  generarFamiliaSesion,
} from "../../shared/security/tokens";
import { UnauthorizedError, NotFoundError } from "../../shared/errors/AppError";
import { env } from "../../config/env";
import {
  RegistroClienteInput,
  LoginInput,
  RespuestaAuthDTO,
  UsuarioAutenticadoDTO,
} from "@shopcart/contracts";

export class AuthService {
  constructor(private readonly authDal: AuthDal = new AuthDal()) {}

  async registrar(datos: RegistroClienteInput, direccionIp?: string): Promise<RespuestaAuthDTO> {
    const hash = await hashPassword(datos.password);

    const usuarioDb = await this.authDal.registrarCliente({
      nombres: datos.nombre,
      apellidos: datos.apellido,
      correo: datos.correo,
      telefono: datos.telefono,
      hashContrasena: hash,
      direccionIp,
    });

    const familiaId = generarFamiliaSesion();
    const refreshTokenPlano = generarRefreshTokenPlano();
    const hashRefresh = hashearTokenSha256(refreshTokenPlano);

    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(fechaExpiracion.getDate() + env.JWT_REFRESH_EXPIRATION_DAYS);

    await this.authDal.crearSesion({
      idUsuario: usuarioDb.IDUsuario,
      idFamilia: familiaId,
      hashToken: hashRefresh,
      fechaExpiracion,
      direccionIp,
    });

    const permisos = ["catalog.read", "coupons.read", "cart.manage", "checkout.create", "orders.read.own"];
    const accessToken = emitirAccessToken({
      idUsuario: usuarioDb.IDUsuario,
      correo: usuarioDb.Correo,
      rol: "Cliente",
      permisos,
    });

    const usuarioDTO: UsuarioAutenticadoDTO = {
      idUsuario: usuarioDb.IDUsuario,
      correo: usuarioDb.Correo,
      nombre: usuarioDb.Nombres,
      apellido: usuarioDb.Apellidos,
      rol: "Cliente",
      estaActivo: usuarioDb.EstaActivo,
    };

    return {
      usuario: usuarioDTO,
      accessToken,
      refreshToken: refreshTokenPlano,
      expiraEnSegundos: 15 * 60,
    };
  }

  async login(credenciales: LoginInput, direccionIp?: string): Promise<RespuestaAuthDTO> {
    const { usuario, permisos } = await this.authDal.obtenerUsuarioPorCorreo(credenciales.correo);

    if (!usuario || !usuario.EstaActivo || !usuario.HashContrasena) {
      throw new UnauthorizedError("Credenciales inválidas o cuenta deshabilitada.", "CREDENCIALES_INVALIDAS");
    }

    const passwordValida = await verifyPassword(credenciales.password, usuario.HashContrasena);
    if (!passwordValida) {
      throw new UnauthorizedError("Credenciales inválidas.", "CREDENCIALES_INVALIDAS");
    }

    const familiaId = generarFamiliaSesion();
    const refreshTokenPlano = generarRefreshTokenPlano();
    const hashRefresh = hashearTokenSha256(refreshTokenPlano);

    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(fechaExpiracion.getDate() + env.JWT_REFRESH_EXPIRATION_DAYS);

    await this.authDal.crearSesion({
      idUsuario: usuario.IDUsuario,
      idFamilia: familiaId,
      hashToken: hashRefresh,
      fechaExpiracion,
      direccionIp,
    });

    const accessToken = emitirAccessToken({
      idUsuario: usuario.IDUsuario,
      correo: usuario.Correo,
      rol: usuario.NombreRol,
      permisos,
    });

    const usuarioDTO: UsuarioAutenticadoDTO = {
      idUsuario: usuario.IDUsuario,
      correo: usuario.Correo,
      nombre: usuario.Nombres,
      apellido: usuario.Apellidos,
      rol: usuario.NombreRol,
      estaActivo: usuario.EstaActivo,
    };

    return {
      usuario: usuarioDTO,
      accessToken,
      refreshToken: refreshTokenPlano,
      expiraEnSegundos: 15 * 60,
    };
  }

  async refrescarSesion(
    refreshTokenActualPlano: string,
    direccionIp?: string
  ): Promise<{ accessToken: string; nuevoRefreshToken: string; usuario: UsuarioAutenticadoDTO }> {
    if (!refreshTokenActualPlano) {
      throw new UnauthorizedError("Refresh token requerido para refrescar sesión.", "TOKEN_REQUERIDO");
    }

    const hashActual = hashearTokenSha256(refreshTokenActualPlano);
    const nuevoRefreshTokenPlano = generarRefreshTokenPlano();
    const nuevoHash = hashearTokenSha256(nuevoRefreshTokenPlano);

    const nuevaExpiracion = new Date();
    nuevaExpiracion.setDate(nuevaExpiracion.getDate() + env.JWT_REFRESH_EXPIRATION_DAYS);

    // Si hubo reuso, la BD lanza 50202 y revoca toda la familia
    const resRotacion = await this.authDal.rotarSesion({
      hashTokenActual: hashActual,
      nuevoHashToken: nuevoHash,
      nuevaFechaExpiracion: nuevaExpiracion,
      direccionIp,
    });

    const { permisos } = await this.authDal.obtenerUsuarioPorID(resRotacion.IDUsuario);

    const nuevoAccessToken = emitirAccessToken({
      idUsuario: resRotacion.IDUsuario,
      correo: resRotacion.Correo,
      rol: resRotacion.NombreRol,
      permisos,
    });

    const usuarioDTO: UsuarioAutenticadoDTO = {
      idUsuario: resRotacion.IDUsuario,
      correo: resRotacion.Correo,
      nombre: resRotacion.Nombres,
      apellido: resRotacion.Apellidos,
      rol: resRotacion.NombreRol,
      estaActivo: resRotacion.EstaActivo,
    };

    return {
      accessToken: nuevoAccessToken,
      nuevoRefreshToken: nuevoRefreshTokenPlano,
      usuario: usuarioDTO,
    };
  }

  async logout(refreshTokenPlano?: string): Promise<void> {
    if (refreshTokenPlano) {
      const hash = hashearTokenSha256(refreshTokenPlano);
      await this.authDal.revocarSesion({ hashToken: hash });
    }
  }

  async obtenerPerfil(idUsuario: number): Promise<UsuarioAutenticadoDTO> {
    const { usuario } = await this.authDal.obtenerUsuarioPorID(idUsuario);
    if (!usuario) {
      throw new NotFoundError("Usuario no encontrado.", "USUARIO_NO_ENCONTRADO");
    }

    return {
      idUsuario: usuario.IDUsuario,
      correo: usuario.Correo,
      nombre: usuario.Nombres,
      apellido: usuario.Apellidos,
      rol: usuario.NombreRol,
      estaActivo: usuario.EstaActivo,
    };
  }
}
