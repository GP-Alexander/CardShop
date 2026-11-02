/* =========================================================================
   ShopCart - Reportes y Dashboard Operativo 
     - Vistas: VW_Modulo_Proceso
     - Stored Procedures: SP_Modulo_Proceso
   ========================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =========================================================================
   1. VISTA: dbo.VW_Dashboard_VentasPorCategoria
   Muestra ventas netas y unidades vendidas agregadas por categoría,
   excluyendo cancelados y descontando devoluciones registradas.
   ========================================================================= */
CREATE OR ALTER VIEW dbo.VW_Dashboard_VentasPorCategoria
AS
SELECT 
    c.IDCategoria,
    c.Slug AS SlugCategoria,
    c.Nombre AS NombreCategoria,
    ISNULL(SUM(pd.Cantidad - pd.CantidadDevuelta), 0) AS UnidadesVendidasNetas,
    ISNULL(SUM(
        CASE 
            WHEN pd.Cantidad > 0 
            THEN CAST((pd.TotalLinea * (pd.Cantidad - pd.CantidadDevuelta) / CAST(pd.Cantidad AS DECIMAL(14,4))) AS DECIMAL(14,2))
            ELSE 0 
        END
    ), 0) AS TotalVentasNetas
FROM dbo.Categoria c
LEFT JOIN dbo.Producto p ON p.IDCategoria = c.IDCategoria
LEFT JOIN dbo.VarianteProducto vp ON vp.IDProducto = p.IDProducto
LEFT JOIN dbo.PedidoDetalle pd ON pd.IDVariante = vp.IDVariante
LEFT JOIN dbo.Pedido ped ON ped.IDPedido = pd.IDPedido
    AND ped.IDEstadoPedido IN (
        SELECT ep.IDEstadoPedido 
        FROM dbo.EstadoPedido ep 
        WHERE ep.Codigo IN ('PAGADO', 'PREPARANDO', 'DESPACHADO', 'ENTREGADO', 'DEVOLUCION_PARCIAL')
    )
GROUP BY c.IDCategoria, c.Slug, c.Nombre;
GO

/* =========================================================================
   2. SP_Reportes_VentasPorCategoria
   Ventas netas y unidades vendidas por categoría con filtro por rango de fechas.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Reportes_VentasPorCategoria
    @FechaInicio DATETIME2(3) = NULL,
    @FechaFin DATETIME2(3) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        c.IDCategoria AS idCategoria,
        c.Nombre AS nombreCategoria,
        ISNULL(SUM(
            CASE 
                WHEN pd.Cantidad > 0 
                THEN CAST((pd.TotalLinea * (pd.Cantidad - pd.CantidadDevuelta) / CAST(pd.Cantidad AS DECIMAL(14,4))) AS DECIMAL(14,2))
                ELSE 0 
            END
        ), 0) AS totalVentas,
        ISNULL(SUM(pd.Cantidad - pd.CantidadDevuelta), 0) AS unidadesVendidas
    FROM dbo.Categoria c
    LEFT JOIN dbo.Producto p ON p.IDCategoria = c.IDCategoria
    LEFT JOIN dbo.VarianteProducto vp ON vp.IDProducto = p.IDProducto
    LEFT JOIN dbo.PedidoDetalle pd ON pd.IDVariante = vp.IDVariante
    LEFT JOIN dbo.Pedido ped ON ped.IDPedido = pd.IDPedido
        AND ped.IDEstadoPedido IN (
            SELECT ep.IDEstadoPedido 
            FROM dbo.EstadoPedido ep 
            WHERE ep.Codigo IN ('PAGADO', 'PREPARANDO', 'DESPACHADO', 'ENTREGADO', 'DEVOLUCION_PARCIAL')
        )
        AND (@FechaInicio IS NULL OR ped.FechaPago >= @FechaInicio)
        AND (@FechaFin IS NULL OR ped.FechaPago <= @FechaFin)
    GROUP BY c.IDCategoria, c.Nombre
    ORDER BY totalVentas DESC, unidadesVendidas DESC;
END;
GO

/* =========================================================================
   3. SP_Reportes_TopProductos
   Top N productos/variantes más vendidos en un rango de fechas.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Reportes_TopProductos
    @FechaInicio DATETIME2(3) = NULL,
    @FechaFin DATETIME2(3) = NULL,
    @Limite INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    IF @Limite IS NULL OR @Limite <= 0 SET @Limite = 10;

    SELECT TOP (@Limite)
        p.IDProducto AS idProducto,
        pd.NombreProductoSnapshot AS nombreProducto,
        pd.SKUSnapshot AS skuVariante,
        SUM(pd.Cantidad - pd.CantidadDevuelta) AS unidadesVendidas,
        ISNULL(SUM(
            CASE 
                WHEN pd.Cantidad > 0 
                THEN CAST((pd.TotalLinea * (pd.Cantidad - pd.CantidadDevuelta) / CAST(pd.Cantidad AS DECIMAL(14,4))) AS DECIMAL(14,2))
                ELSE 0 
            END
        ), 0) AS totalGenerado
    FROM dbo.PedidoDetalle pd
    JOIN dbo.Pedido ped ON ped.IDPedido = pd.IDPedido
    JOIN dbo.VarianteProducto vp ON vp.IDVariante = pd.IDVariante
    JOIN dbo.Producto p ON p.IDProducto = vp.IDProducto
    JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = ped.IDEstadoPedido
    WHERE ep.Codigo IN ('PAGADO', 'PREPARANDO', 'DESPACHADO', 'ENTREGADO', 'DEVOLUCION_PARCIAL')
      AND (@FechaInicio IS NULL OR ped.FechaPago >= @FechaInicio)
      AND (@FechaFin IS NULL OR ped.FechaPago <= @FechaFin)
    GROUP BY p.IDProducto, pd.NombreProductoSnapshot, pd.SKUSnapshot
    HAVING SUM(pd.Cantidad - pd.CantidadDevuelta) > 0
    ORDER BY unidadesVendidas DESC, totalGenerado DESC;
END;
GO

/* =========================================================================
   4. SP_Reportes_VentasPeriodo
   Ventas netas, cantidad de pedidos y ticket promedio agrupados por
   'DIA', 'SEMANA' o 'MES'.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Reportes_VentasPeriodo
    @FechaInicio DATETIME2(3) = NULL,
    @FechaFin DATETIME2(3) = NULL,
    @Agrupacion VARCHAR(10) = 'DIA'
AS
BEGIN
    SET NOCOUNT ON;

    SET @Agrupacion = UPPER(ISNULL(@Agrupacion, 'DIA'));
    IF @Agrupacion NOT IN ('DIA', 'SEMANA', 'MES') SET @Agrupacion = 'DIA';

    WITH ReembolsosPorPedido AS (
        SELECT IDPedido, SUM(Monto) AS TotalReembolsado
        FROM dbo.Reembolso
        WHERE Estado = 'COMPLETADO'
        GROUP BY IDPedido
    ),
    PedidosValidos AS (
        SELECT 
            ped.IDPedido,
            ped.FechaPago,
            ped.Total,
            ISNULL(r.TotalReembolsado, 0) AS TotalReembolsado,
            ped.Total - ISNULL(r.TotalReembolsado, 0) AS TotalNeto,
            CASE @Agrupacion
                WHEN 'DIA' THEN CONVERT(VARCHAR(10), ped.FechaPago, 120)
                WHEN 'SEMANA' THEN CONCAT(DATEPART(YEAR, ped.FechaPago), '-W', RIGHT('0' + CAST(DATEPART(ISO_WEEK, ped.FechaPago) AS VARCHAR(2)), 2))
                WHEN 'MES' THEN LEFT(CONVERT(VARCHAR(10), ped.FechaPago, 120), 7)
            END AS Periodo
        FROM dbo.Pedido ped
        JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = ped.IDEstadoPedido
        LEFT JOIN ReembolsosPorPedido r ON r.IDPedido = ped.IDPedido
        WHERE ep.Codigo IN ('PAGADO', 'PREPARANDO', 'DESPACHADO', 'ENTREGADO', 'DEVOLUCION_PARCIAL')
          AND ped.FechaPago IS NOT NULL
          AND (@FechaInicio IS NULL OR ped.FechaPago >= @FechaInicio)
          AND (@FechaFin IS NULL OR ped.FechaPago <= @FechaFin)
    )
    SELECT 
        pv.Periodo AS periodo,
        CAST(ISNULL(SUM(pv.TotalNeto), 0) AS DECIMAL(14,2)) AS totalVentas,
        COUNT(pv.IDPedido) AS totalPedidos,
        CAST(ROUND(
            CASE 
                WHEN COUNT(pv.IDPedido) > 0 
                THEN SUM(pv.TotalNeto) / CAST(COUNT(pv.IDPedido) AS DECIMAL(14,4))
                ELSE 0 
            END, 2) AS DECIMAL(14,2)) AS ticketPromedio
    FROM PedidosValidos pv
    GROUP BY pv.Periodo
    ORDER BY pv.Periodo ASC;
END;
GO

/* =========================================================================
   5. SP_Reportes_CarritosAbandonados
   Listado paginado de carritos activos con artículos cuya última actividad
   supera las horas indicadas.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Reportes_CarritosAbandonados
    @HorasInactividad INT = 24,
    @Pagina INT = 1,
    @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @HorasInactividad IS NULL OR @HorasInactividad <= 0 SET @HorasInactividad = 24;
    IF @Pagina IS NULL OR @Pagina <= 0 SET @Pagina = 1;
    IF @TamanoPagina IS NULL OR @TamanoPagina <= 0 SET @TamanoPagina = 20;

    DECLARE @Offset INT = (@Pagina - 1) * @TamanoPagina;
    DECLARE @FechaCorte DATETIME2(3) = DATEADD(HOUR, -@HorasInactividad, SYSUTCDATETIME());

    WITH CarritosBase AS (
        SELECT 
            c.IDCarrito,
            c.IDUsuario,
            ISNULL(u.Nombres + ' ' + u.Apellidos, N'Invitado') AS NombreUsuario,
            u.Correo AS Email,
            ISNULL(SUM(cd.Cantidad), 0) AS TotalArticulos,
            ISNULL(SUM(cd.Cantidad * vp.Precio), 0) AS MontoEstimado,
            c.FechaCreacion,
            c.FechaUltimaActividad,
            DATEDIFF(HOUR, c.FechaUltimaActividad, SYSUTCDATETIME()) AS HorasInactivo
        FROM dbo.Carrito c
        LEFT JOIN dbo.Usuario u ON u.IDUsuario = c.IDUsuario
        JOIN dbo.CarritoDetalle cd ON cd.IDCarrito = c.IDCarrito
        JOIN dbo.VarianteProducto vp ON vp.IDVariante = cd.IDVariante
        WHERE c.Estado = 'ACTIVO'
          AND c.FechaUltimaActividad < @FechaCorte
        GROUP BY 
            c.IDCarrito, 
            c.IDUsuario, 
            u.Nombres, 
            u.Apellidos, 
            u.Correo, 
            c.FechaCreacion, 
            c.FechaUltimaActividad
    )
    SELECT 
        cb.IDCarrito AS idCarrito,
        cb.IDUsuario AS idUsuario,
        cb.NombreUsuario AS nombreUsuario,
        cb.Email AS email,
        cb.TotalArticulos AS totalArticulos,
        CAST(cb.MontoEstimado AS DECIMAL(14,2)) AS montoEstimado,
        cb.FechaCreacion AS fechaCreacion,
        cb.FechaUltimaActividad AS fechaUltimaActividad,
        cb.HorasInactivo AS horasInactivo,
        COUNT(1) OVER () AS totalRegistros
    FROM CarritosBase cb
    ORDER BY cb.FechaUltimaActividad DESC
    OFFSET @Offset ROWS
    FETCH NEXT @TamanoPagina ROWS ONLY;
END;
GO

/* =========================================================================
   6. SP_Reportes_DashboardResumen
   Retorna los 4 KPIs ejecutivos principales del dashboard administrativo.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Reportes_DashboardResumen
    @HorasInactividad INT = 24
AS
BEGIN
    SET NOCOUNT ON;

    IF @HorasInactividad IS NULL OR @HorasInactividad <= 0 SET @HorasInactividad = 24;

    DECLARE @HoyInicio DATETIME2(3) = CAST(CAST(SYSUTCDATETIME() AS DATE) AS DATETIME2(3));
    DECLARE @MesInicio DATETIME2(3) = DATEFROMPARTS(YEAR(SYSUTCDATETIME()), MONTH(SYSUTCDATETIME()), 1);
    DECLARE @FechaCorteCarritos DATETIME2(3) = DATEADD(HOUR, -@HorasInactividad, SYSUTCDATETIME());

    DECLARE @VentasHoy DECIMAL(14,2) = 0;
    DECLARE @PedidosHoy INT = 0;
    DECLARE @TicketPromedioMes DECIMAL(14,2) = 0;
    DECLARE @VentasMes DECIMAL(14,2) = 0;
    DECLARE @PedidosMes INT = 0;

    WITH ReembolsosPorPedido AS (
        SELECT IDPedido, SUM(Monto) AS TotalReembolsado
        FROM dbo.Reembolso
        WHERE Estado = 'COMPLETADO'
        GROUP BY IDPedido
    ),
    PedidosValidos AS (
        SELECT 
            ped.IDPedido,
            ped.FechaPago,
            ped.Total - ISNULL(r.TotalReembolsado, 0) AS TotalNeto
        FROM dbo.Pedido ped
        JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = ped.IDEstadoPedido
        LEFT JOIN ReembolsosPorPedido r ON r.IDPedido = ped.IDPedido
        WHERE ep.Codigo IN ('PAGADO', 'PREPARANDO', 'DESPACHADO', 'ENTREGADO', 'DEVOLUCION_PARCIAL')
          AND ped.FechaPago IS NOT NULL
    )
    SELECT 
        @PedidosHoy = COUNT(CASE WHEN pv.FechaPago >= @HoyInicio THEN pv.IDPedido END),
        @VentasHoy = CAST(ISNULL(SUM(CASE WHEN pv.FechaPago >= @HoyInicio THEN pv.TotalNeto END), 0) AS DECIMAL(14,2)),
        @PedidosMes = COUNT(CASE WHEN pv.FechaPago >= @MesInicio THEN pv.IDPedido END),
        @VentasMes = ISNULL(SUM(CASE WHEN pv.FechaPago >= @MesInicio THEN pv.TotalNeto END), 0)
    FROM PedidosValidos pv;

    IF @PedidosMes > 0
    BEGIN
        SET @TicketPromedioMes = CAST(ROUND(@VentasMes / CAST(@PedidosMes AS DECIMAL(14,4)), 2) AS DECIMAL(14,2));
    END

    -- Carritos abandonados
    DECLARE @CarritosAbandonados INT = 0;

    SELECT @CarritosAbandonados = COUNT(DISTINCT c.IDCarrito)
    FROM dbo.Carrito c
    JOIN dbo.CarritoDetalle cd ON cd.IDCarrito = c.IDCarrito
    WHERE c.Estado = 'ACTIVO'
      AND c.FechaUltimaActividad < @FechaCorteCarritos;

    SELECT 
        @VentasHoy AS ventasHoy,
        @PedidosHoy AS pedidosHoy,
        @TicketPromedioMes AS ticketPromedioMes,
        @CarritosAbandonados AS carritosAbandonadosPeriodo;
END;
GO
