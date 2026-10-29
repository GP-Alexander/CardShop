import sql from "mssql";
import { ejecutarSp } from "../../shared/db/ejecutarSp";
import {
  VentasPeriodoDTO,
  VentasPorCategoriaDTO,
  TopProductoDTO,
  CarritoAbandonadoDTO,
  CarritosAbandonadosPaginadosDTO,
} from "@shopcart/contracts";

interface ResumenKpiRow {
  ventasHoy: number;
  pedidosHoy: number;
  ticketPromedioMes: number;
  carritosAbandonadosPeriodo: number;
}

interface VentasPeriodoRow {
  periodo: string;
  totalVentas: number;
  totalPedidos: number;
  ticketPromedio: number;
}

interface VentasPorCategoriaRow {
  idCategoria: number;
  nombreCategoria: string;
  totalVentas: number;
  unidadesVendidas: number;
}

interface TopProductoRow {
  idProducto: number;
  nombreProducto: string;
  skuVariante: string;
  unidadesVendidas: number;
  totalGenerado: number;
}

interface CarritoAbandonadoRow {
  idCarrito: number;
  idUsuario: number | null;
  nombreUsuario: string;
  email: string | null;
  totalArticulos: number;
  montoEstimado: number;
  fechaCreacion: Date;
  fechaUltimaActividad: Date;
  horasInactivo: number;
  totalRegistros: number;
}

export class ReportesDal {
  async obtenerKpisResumen(horasInactividad = 24): Promise<ResumenKpiRow> {
    const res = await ejecutarSp<ResumenKpiRow>("dbo.SP_Reportes_DashboardResumen", [
      { nombre: "HorasInactividad", tipo: sql.Int, valor: horasInactividad },
    ]);

    const row = res.recordset?.[0] || {
      ventasHoy: 0,
      pedidosHoy: 0,
      ticketPromedioMes: 0,
      carritosAbandonadosPeriodo: 0,
    };

    return {
      ventasHoy: Number(row.ventasHoy),
      pedidosHoy: Number(row.pedidosHoy),
      ticketPromedioMes: Number(row.ticketPromedioMes),
      carritosAbandonadosPeriodo: Number(row.carritosAbandonadosPeriodo),
    };
  }

  async obtenerVentasPeriodo(
    fechaInicio?: string,
    fechaFin?: string,
    agrupacion: "dia" | "semana" | "mes" = "dia"
  ): Promise<VentasPeriodoDTO[]> {
    const res = await ejecutarSp<VentasPeriodoRow>("dbo.SP_Reportes_VentasPeriodo", [
      { nombre: "FechaInicio", tipo: sql.DateTime2, valor: fechaInicio ? new Date(fechaInicio) : null },
      { nombre: "FechaFin", tipo: sql.DateTime2, valor: fechaFin ? new Date(fechaFin) : null },
      { nombre: "Agrupacion", tipo: sql.VarChar, valor: agrupacion.toUpperCase() },
    ]);

    return (res.recordset || []).map((r) => ({
      periodo: r.periodo,
      totalVentas: Number(r.totalVentas),
      totalPedidos: Number(r.totalPedidos),
      ticketPromedio: Number(r.ticketPromedio),
    }));
  }

  async obtenerVentasPorCategoria(
    fechaInicio?: string,
    fechaFin?: string
  ): Promise<VentasPorCategoriaDTO[]> {
    const res = await ejecutarSp<VentasPorCategoriaRow>("dbo.SP_Reportes_VentasPorCategoria", [
      { nombre: "FechaInicio", tipo: sql.DateTime2, valor: fechaInicio ? new Date(fechaInicio) : null },
      { nombre: "FechaFin", tipo: sql.DateTime2, valor: fechaFin ? new Date(fechaFin) : null },
    ]);

    return (res.recordset || []).map((r) => ({
      idCategoria: r.idCategoria,
      nombreCategoria: r.nombreCategoria,
      totalVentas: Number(r.totalVentas),
      unidadesVendidas: Number(r.unidadesVendidas),
    }));
  }

  async obtenerTopProductos(
    fechaInicio?: string,
    fechaFin?: string,
    limite = 10
  ): Promise<TopProductoDTO[]> {
    const res = await ejecutarSp<TopProductoRow>("dbo.SP_Reportes_TopProductos", [
      { nombre: "FechaInicio", tipo: sql.DateTime2, valor: fechaInicio ? new Date(fechaInicio) : null },
      { nombre: "FechaFin", tipo: sql.DateTime2, valor: fechaFin ? new Date(fechaFin) : null },
      { nombre: "Limite", tipo: sql.Int, valor: limite },
    ]);

    return (res.recordset || []).map((r) => ({
      idProducto: r.idProducto,
      nombreProducto: r.nombreProducto,
      skuVariante: r.skuVariante,
      unidadesVendidas: Number(r.unidadesVendidas),
      totalGenerado: Number(r.totalGenerado),
    }));
  }

  async obtenerCarritosAbandonados(
    horasInactividad = 24,
    pagina = 1,
    tamanoPagina = 20
  ): Promise<CarritosAbandonadosPaginadosDTO> {
    const res = await ejecutarSp<CarritoAbandonadoRow>("dbo.SP_Reportes_CarritosAbandonados", [
      { nombre: "HorasInactividad", tipo: sql.Int, valor: horasInactividad },
      { nombre: "Pagina", tipo: sql.Int, valor: pagina },
      { nombre: "TamanoPagina", tipo: sql.Int, valor: tamanoPagina },
    ]);

    const totalRegistros = res.recordset?.[0]?.totalRegistros ?? 0;

    const items: CarritoAbandonadoDTO[] = (res.recordset || []).map((r) => ({
      idCarrito: r.idCarrito,
      idUsuario: r.idUsuario,
      nombreUsuario: r.nombreUsuario,
      email: r.email,
      totalArticulos: Number(r.totalArticulos),
      montoEstimado: Number(r.montoEstimado),
      fechaCreacion: new Date(r.fechaCreacion).toISOString(),
      fechaUltimaActividad: new Date(r.fechaUltimaActividad).toISOString(),
      horasInactivo: Number(r.horasInactivo),
    }));

    return {
      items,
      total: totalRegistros,
      pagina,
      tamanoPagina,
      totalPaginas: Math.ceil(totalRegistros / tamanoPagina) || 0,
    };
  }
}
