import {
  DashboardResumenDTO,
  VentasPeriodoDTO,
  VentasPorCategoriaDTO,
  TopProductoDTO,
  CarritosAbandonadosPaginadosDTO,
  FiltroVentasPeriodoQuery,
  FiltroVentasPorCategoriaQuery,
  FiltroTopProductosQuery,
  FiltroCarritosAbandonadosQuery,
} from "@shopcart/contracts";
import { ReportesDal } from "./reportes.dal";

export class ReportesService {
  constructor(private readonly dal = new ReportesDal()) {}

  async obtenerDashboard(horasInactividad = 24): Promise<DashboardResumenDTO> {
    const kpis = await this.dal.obtenerKpisResumen(horasInactividad);

    // Ventas agrupadas por día para los últimos 30 días
    const hoy = new Date();
    const hace30Dias = new Date();
    hace30Dias.setDate(hoy.getDate() - 30);

    const [ventasPorPeriodo, ventasPorCategoria, topProductos] = await Promise.all([
      this.dal.obtenerVentasPeriodo(hace30Dias.toISOString(), hoy.toISOString(), "dia"),
      this.dal.obtenerVentasPorCategoria(),
      this.dal.obtenerTopProductos(undefined, undefined, 5),
    ]);

    return {
      ventasHoy: kpis.ventasHoy,
      pedidosHoy: kpis.pedidosHoy,
      ticketPromedioMes: kpis.ticketPromedioMes,
      carritosAbandonadosPeriodo: kpis.carritosAbandonadosPeriodo,
      ventasPorPeriodo,
      ventasPorCategoria,
      topProductos,
    };
  }

  async obtenerVentasPeriodo(query: FiltroVentasPeriodoQuery): Promise<VentasPeriodoDTO[]> {
    return this.dal.obtenerVentasPeriodo(query.fechaInicio, query.fechaFin, query.agrupacion);
  }

  async obtenerVentasPorCategoria(
    query: FiltroVentasPorCategoriaQuery
  ): Promise<VentasPorCategoriaDTO[]> {
    return this.dal.obtenerVentasPorCategoria(query.fechaInicio, query.fechaFin);
  }

  async obtenerTopProductos(query: FiltroTopProductosQuery): Promise<TopProductoDTO[]> {
    return this.dal.obtenerTopProductos(query.fechaInicio, query.fechaFin, query.limite);
  }

  async obtenerCarritosAbandonados(
    query: FiltroCarritosAbandonadosQuery
  ): Promise<CarritosAbandonadosPaginadosDTO> {
    return this.dal.obtenerCarritosAbandonados(
      query.horasInactividad,
      query.pagina,
      query.tamanoPagina
    );
  }
}
