/* =========================================================================
   ShopCart - SPs de Checkout, Pedidos, Pagos y Devoluciones 
   ========================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

-- Secuencia para números de pedido consecutivos
IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name = 'Seq_NumeroPedido')
BEGIN
    CREATE SEQUENCE dbo.Seq_NumeroPedido
        START WITH 1001
        INCREMENT BY 1;
END;
GO

/* =========================================================================
   1. SP_Checkout_Iniciar
   Inicia el proceso de checkout para un usuario autenticado.
   - Valida la dirección del usuario (protección IDOR).
   - Valida el carrito activo y sus ítems.
   - Aplica cupón de descuento si corresponde .
   - Realiza la reserva temporal de existencia por 15 minutos .
   - Soporta idempotencia: ante la misma ClaveIdempotencia retorna el pedido existente.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_Iniciar
    @IDUsuario INT,
    @IDDireccion INT,
    @ClaveIdempotencia VARCHAR(100),
    @CodigoCupon VARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Validaciones de entrada
    IF @IDUsuario IS NULL
    BEGIN
        THROW 50001, N'El IDUsuario es obligatorio.', 1;
    END

    IF @IDDireccion IS NULL
    BEGIN
        THROW 50001, N'La dirección de entrega es obligatoria.', 1;
    END

    IF @ClaveIdempotencia IS NULL OR LEN(LTRIM(RTRIM(@ClaveIdempotencia))) = 0
    BEGIN
        THROW 50001, N'La clave de idempotencia es obligatoria para el checkout.', 1;
    END

    -- 1. Soporte de idempotencia: si ya existe el pedido con esta clave para este usuario
    DECLARE @IDPedidoExistente BIGINT;
    DECLARE @EstadoPedidoExistente VARCHAR(30);

    SELECT 
        @IDPedidoExistente = p.IDPedido,
        @EstadoPedidoExistente = ep.Codigo
    FROM dbo.Pedido p WITH (NOLOCK)
    INNER JOIN dbo.EstadoPedido ep ON p.IDEstadoPedido = ep.IDEstadoPedido
    WHERE p.IDUsuario = @IDUsuario AND p.ClaveIdempotencia = @ClaveIdempotencia;

    IF @IDPedidoExistente IS NOT NULL
    BEGIN
        -- Obtener datos de la reserva si aún está activa
        DECLARE @FechaExpExistente DATETIME2(3);
        DECLARE @EstadoReservaExistente VARCHAR(20);

        SELECT 
            @FechaExpExistente = FechaExpiracion,
            @EstadoReservaExistente = Estado
        FROM dbo.ReservaInventario WITH (NOLOCK)
        WHERE IDPedido = @IDPedidoExistente;

        SELECT 
            p.IDPedido,
            p.NumeroPedido,
            p.Total,
            p.Subtotal,
            p.Descuento,
            p.CostoEnvio,
            p.IVAIncluido,
            p.Moneda,
            ep.Codigo AS EstadoCodigo,
            ep.Nombre AS EstadoNombre,
            @EstadoReservaExistente AS EstadoReserva,
            @FechaExpExistente AS FechaExpiracionReserva,
            CASE 
                WHEN @FechaExpExistente IS NOT NULL AND @FechaExpExistente > SYSUTCDATETIME() 
                THEN DATEDIFF(SECOND, SYSUTCDATETIME(), @FechaExpExistente)
                ELSE 0
            END AS SegundosRestantesReserva
        FROM dbo.Pedido p
        INNER JOIN dbo.EstadoPedido ep ON p.IDEstadoPedido = ep.IDEstadoPedido
        WHERE p.IDPedido = @IDPedidoExistente;

        RETURN;
    END

    -- 2. Validar dirección y verificar propiedad (IDOR)
    DECLARE @DestinatarioSnapshot NVARCHAR(150);
    DECLARE @TelefonoSnapshot NVARCHAR(30);
    DECLARE @DireccionSnapshot NVARCHAR(500);

    SELECT 
        @DestinatarioSnapshot = Destinatario,
        @TelefonoSnapshot = Telefono,
        @DireccionSnapshot = Linea1 + 
            CASE WHEN Linea2 IS NOT NULL AND LEN(Linea2) > 0 THEN ', ' + Linea2 ELSE '' END +
            ', ' + Municipio + ', ' + Departamento +
            CASE WHEN CodigoPostal IS NOT NULL AND LEN(CodigoPostal) > 0 THEN ' (' + CodigoPostal + ')' ELSE '' END
    FROM dbo.Direccion WITH (NOLOCK)
    WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario AND EstaActiva = 1;

    IF @DestinatarioSnapshot IS NULL
    BEGIN
        THROW 50403, N'La dirección especificada no existe o no pertenece al usuario autenticado.', 1;
    END

    -- 3. Iniciar transacción atómica para reserva y creación de pedido
    BEGIN TRANSACTION;
    BEGIN TRY
        -- Obtener carrito activo del usuario
        DECLARE @IDCarrito BIGINT;
        DECLARE @IDCuponCarrito INT;

        SELECT @IDCarrito = IDCarrito, @IDCuponCarrito = IDCupon
        FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
        WHERE IDUsuario = @IDUsuario AND Estado = 'ACTIVO';

        IF @IDCarrito IS NULL
        BEGIN
            THROW 50504, N'El usuario no tiene un carrito activo para realizar checkout.', 1;
        END

        -- Tabla temporal para ítems del carrito
        DECLARE @ItemsCarrito TABLE (
            IDVariante INT NOT NULL,
            SKU VARCHAR(80) NOT NULL,
            NombreProducto NVARCHAR(180) NOT NULL,
            DescripcionVariante NVARCHAR(300) NOT NULL,
            PrecioUnitario DECIMAL(12,2) NOT NULL,
            Cantidad INT NOT NULL,
            ImporteBruto DECIMAL(14,2) NOT NULL
        );

        INSERT INTO @ItemsCarrito (IDVariante, SKU, NombreProducto, DescripcionVariante, PrecioUnitario, Cantidad, ImporteBruto)
        SELECT 
            cd.IDVariante,
            v.SKU,
            p.Nombre,
            ISNULL(
                (SELECT STRING_AGG(a.Nombre + ': ' + va.Valor, ', ')
                 FROM dbo.VarianteAtributo vattr
                 JOIN dbo.ValorAtributo va ON vattr.IDValorAtributo = va.IDValorAtributo
                 JOIN dbo.Atributo a ON va.IDAtributo = a.IDAtributo
                 WHERE vattr.IDVariante = v.IDVariante),
                v.SKU
            ),
            v.Precio,
            cd.Cantidad,
            CAST(cd.Cantidad * v.Precio AS DECIMAL(14,2))
        FROM dbo.CarritoDetalle cd WITH (UPDLOCK)
        INNER JOIN dbo.VarianteProducto v ON cd.IDVariante = v.IDVariante
        INNER JOIN dbo.Producto p ON v.IDProducto = p.IDProducto
        WHERE cd.IDCarrito = @IDCarrito;

        IF NOT EXISTS (SELECT 1 FROM @ItemsCarrito)
        BEGIN
            THROW 50505, N'El carrito está vacío. Agregue productos antes de realizar checkout.', 1;
        END

        -- 4. Almacén principal
        DECLARE @IDAlmacen INT;
        SELECT TOP 1 @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = 'PRINCIPAL' AND EstaActivo = 1;
        IF @IDAlmacen IS NULL
            SELECT TOP 1 @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE EstaActivo = 1;

        -- 5. Validar disponibilidad y reservar stock por cada ítem (: Concurrencia y sobreventa)
        DECLARE @IDVarianteCur INT;
        DECLARE @CantidadCur INT;
        DECLARE @SKUCUR VARCHAR(80);
        DECLARE @ExistenciaCur INT;
        DECLARE @ReservadaCur INT;

        DECLARE curItems CURSOR LOCAL FAST_FORWARD FOR
            SELECT IDVariante, Cantidad, SKU FROM @ItemsCarrito;

        OPEN curItems;
        FETCH NEXT FROM curItems INTO @IDVarianteCur, @CantidadCur, @SKUCUR;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            -- Bloquear fila de inventario para evitar condición de carrera
            SELECT 
                @ExistenciaCur = Existencia,
                @ReservadaCur = CantidadReservada
            FROM dbo.Inventario WITH (UPDLOCK, ROWLOCK)
            WHERE IDVariante = @IDVarianteCur AND IDAlmacen = @IDAlmacen;

            IF @ExistenciaCur IS NULL OR (@ExistenciaCur - @ReservadaCur) < @CantidadCur
            BEGIN
                CLOSE curItems;
                DEALLOCATE curItems;
                DECLARE @MsgError NVARCHAR(200) = N'Existencia insuficiente para el producto con SKU: ' + @SKUCUR + N'. No es posible completar la reserva.';
                THROW 50305, @MsgError, 1;
            END

            -- Incrementar cantidad reservada
            UPDATE dbo.Inventario
            SET CantidadReservada = CantidadReservada + @CantidadCur,
                FechaActualizacion = SYSUTCDATETIME()
            WHERE IDVariante = @IDVarianteCur AND IDAlmacen = @IDAlmacen;

            FETCH NEXT FROM curItems INTO @IDVarianteCur, @CantidadCur, @SKUCUR;
        END

        CLOSE curItems;
        DEALLOCATE curItems;

        -- 6. Cálculo de subtotales
        DECLARE @Subtotal DECIMAL(14,2);
        SELECT @Subtotal = SUM(ImporteBruto) FROM @ItemsCarrito;

        -- 7. Evaluación de Cupón 
        DECLARE @IDCuponAplicar INT = NULL;
        DECLARE @Descuento DECIMAL(14,2) = 0.00;

        IF @CodigoCupon IS NOT NULL AND LEN(LTRIM(RTRIM(@CodigoCupon))) > 0
        BEGIN
            SELECT @IDCuponAplicar = IDCupon FROM dbo.Cupon WHERE Codigo = LTRIM(RTRIM(@CodigoCupon));
        END
        ELSE IF @IDCuponCarrito IS NOT NULL
        BEGIN
            SET @IDCuponAplicar = @IDCuponCarrito;
        END

        IF @IDCuponAplicar IS NOT NULL
        BEGIN
            DECLARE @CupActivo BIT;
            DECLARE @CupFechaInicio DATETIME2(3);
            DECLARE @CupFechaFin DATETIME2(3);
            DECLARE @CupUsosActuales INT;
            DECLARE @CupUsosMaximos INT;
            DECLARE @CupUsosPorClienteMax INT;
            DECLARE @CupMontoMinimo DECIMAL(12,2);
            DECLARE @CupTipoDescuento VARCHAR(15);
            DECLARE @CupValorDescuento DECIMAL(12,2);
            DECLARE @CupDescuentoMaximo DECIMAL(12,2);

            SELECT 
                @CupActivo = EstaActivo,
                @CupFechaInicio = FechaInicio,
                @CupFechaFin = FechaFin,
                @CupUsosActuales = UsosActuales,
                @CupUsosMaximos = LimiteUsosTotal,
                @CupUsosPorClienteMax = LimiteUsosPorCliente,
                @CupMontoMinimo = MontoMinimoCompra,
                @CupTipoDescuento = TipoDescuento,
                @CupValorDescuento = ValorDescuento,
                @CupDescuentoMaximo = DescuentoMaximo
            FROM dbo.Cupon WITH (UPDLOCK)
            WHERE IDCupon = @IDCuponAplicar;

            DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();

            -- Validar vigencia y restricciones
            IF @CupActivo = 1 
               AND @Ahora BETWEEN @CupFechaInicio AND @CupFechaFin
               AND (@CupUsosMaximos IS NULL OR @CupUsosActuales < @CupUsosMaximos)
               AND (@CupMontoMinimo IS NULL OR @Subtotal >= @CupMontoMinimo)
            BEGIN
                -- Validar usos por este cliente
                DECLARE @UsosPreviosCliente INT = 0;
                SELECT @UsosPreviosCliente = COUNT(1) 
                FROM dbo.UsoCupon WITH (NOLOCK)
                WHERE IDCupon = @IDCuponAplicar AND IDUsuario = @IDUsuario AND EsVigente = 1;

                IF @CupUsosPorClienteMax IS NULL OR @UsosPreviosCliente < @CupUsosPorClienteMax
                BEGIN
                    IF @CupTipoDescuento = 'PORCENTAJE'
                    BEGIN
                        SET @Descuento = ROUND(@Subtotal * (@CupValorDescuento / 100.0), 2);
                        IF @CupDescuentoMaximo IS NOT NULL AND @Descuento > @CupDescuentoMaximo
                            SET @Descuento = @CupDescuentoMaximo;
                    END
                    ELSE
                    BEGIN
                        SET @Descuento = @CupValorDescuento;
                    END

                    -- El descuento no puede superar el subtotal
                    IF @Descuento > @Subtotal SET @Descuento = @Subtotal;
                END
                ELSE
                BEGIN
                    SET @IDCuponAplicar = NULL;
                    SET @Descuento = 0.00;
                END
            END
            ELSE
            BEGIN
                SET @IDCuponAplicar = NULL;
                SET @Descuento = 0.00;
            END
        END

        -- 8. Totales finales del pedido
        DECLARE @CostoEnvio DECIMAL(14,2) = 0.00;
        DECLARE @Total DECIMAL(14,2) = @Subtotal - @Descuento + @CostoEnvio;
        DECLARE @IVAIncluido DECIMAL(14,2) = ROUND(@Total * 12.0 / 112.0, 2);

        -- 9. Generar número de pedido único consecutivo
        DECLARE @SeqVal BIGINT = NEXT VALUE FOR dbo.Seq_NumeroPedido;
        DECLARE @NumeroPedido VARCHAR(30) = 'PED-' + CONVERT(VARCHAR(8), SYSUTCDATETIME(), 112) + '-' + CAST(@SeqVal AS VARCHAR(10));

        -- 10. Obtener estado inicial 'PENDIENTE_PAGO'
        DECLARE @IDEstadoPendiente INT;
        SELECT @IDEstadoPendiente = IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = 'PENDIENTE_PAGO';

        -- 11. Insertar Cabecera de Pedido
        DECLARE @IDPedido BIGINT;

        INSERT INTO dbo.Pedido (
            NumeroPedido,
            IDUsuario,
            IDCarrito,
            IDEstadoPedido,
            ClaveIdempotencia,
            IDDireccionEnvio,
            IDCupon,
            DestinatarioSnapshot,
            TelefonoSnapshot,
            DireccionSnapshot,
            Subtotal,
            Descuento,
            CostoEnvio,
            Total,
            IVAIncluido,
            PorcentajeIVA,
            Moneda,
            FechaCreacion,
            FechaActualizacion
        ) VALUES (
            @NumeroPedido,
            @IDUsuario,
            @IDCarrito,
            @IDEstadoPendiente,
            @ClaveIdempotencia,
            @IDDireccion,
            @IDCuponAplicar,
            @DestinatarioSnapshot,
            @TelefonoSnapshot,
            @DireccionSnapshot,
            @Subtotal,
            @Descuento,
            @CostoEnvio,
            @Total,
            @IVAIncluido,
            12.00,
            'GTQ',
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
        );

        SET @IDPedido = SCOPE_IDENTITY();

        -- 12. Insertar Detalle de Pedido con prorrateo de descuentos para exactitud
        DECLARE @LineasConDescuento TABLE (
            IDVariante INT,
            SKU VARCHAR(80),
            NombreProducto NVARCHAR(180),
            DescripcionVariante NVARCHAR(300),
            PrecioUnitario DECIMAL(12,2),
            Cantidad INT,
            ImporteBruto DECIMAL(14,2),
            DescuentoLinea DECIMAL(12,2),
            TotalLinea DECIMAL(14,2),
            IVALinea DECIMAL(12,2)
        );

        IF @Descuento > 0 AND @Subtotal > 0
        BEGIN
            INSERT INTO @LineasConDescuento
            SELECT 
                IDVariante,
                SKU,
                NombreProducto,
                DescripcionVariante,
                PrecioUnitario,
                Cantidad,
                ImporteBruto,
                CAST(ROUND(@Descuento * (ImporteBruto / @Subtotal), 2) AS DECIMAL(12,2)),
                CAST(ImporteBruto - ROUND(@Descuento * (ImporteBruto / @Subtotal), 2) AS DECIMAL(14,2)),
                CAST(ROUND((ImporteBruto - ROUND(@Descuento * (ImporteBruto / @Subtotal), 2)) * 12.0 / 112.0, 2) AS DECIMAL(12,2))
            FROM @ItemsCarrito;

            -- Ajustar redondeo de 1 centavo en la última línea si fuese necesario
            DECLARE @SumaDescLineas DECIMAL(12,2);
            SELECT @SumaDescLineas = SUM(DescuentoLinea) FROM @LineasConDescuento;

            IF @SumaDescLineas <> @Descuento
            BEGIN
                DECLARE @Dif DECIMAL(12,2) = @Descuento - @SumaDescLineas;
                DECLARE @UltimaVariante INT;
                SELECT TOP 1 @UltimaVariante = IDVariante FROM @LineasConDescuento ORDER BY ImporteBruto DESC;

                UPDATE @LineasConDescuento
                SET DescuentoLinea = DescuentoLinea + @Dif,
                    TotalLinea = ImporteBruto - (DescuentoLinea + @Dif),
                    IVALinea = ROUND((ImporteBruto - (DescuentoLinea + @Dif)) * 12.0 / 112.0, 2)
                WHERE IDVariante = @UltimaVariante;
            END
        END
        ELSE
        BEGIN
            INSERT INTO @LineasConDescuento
            SELECT 
                IDVariante,
                SKU,
                NombreProducto,
                DescripcionVariante,
                PrecioUnitario,
                Cantidad,
                ImporteBruto,
                0.00,
                ImporteBruto,
                CAST(ROUND(ImporteBruto * 12.0 / 112.0, 2) AS DECIMAL(12,2))
            FROM @ItemsCarrito;
        END

        INSERT INTO dbo.PedidoDetalle (
            IDPedido,
            IDVariante,
            SKUSnapshot,
            NombreProductoSnapshot,
            DescripcionVarianteSnapshot,
            PrecioUnitario,
            Cantidad,
            ImporteBruto,
            CantidadDevuelta,
            DescuentoLinea,
            TotalLinea,
            IVALinea
        )
        SELECT 
            @IDPedido,
            IDVariante,
            SKU,
            NombreProducto,
            DescripcionVariante,
            PrecioUnitario,
            Cantidad,
            ImporteBruto,
            0,
            DescuentoLinea,
            TotalLinea,
            IVALinea
        FROM @LineasConDescuento;

        -- 13. Registrar Historial de Estados (Inmutable)
        INSERT INTO dbo.HistorialEstadoPedido (
            IDPedido,
            IDEstadoAnterior,
            IDEstadoNuevo,
            IDUsuario,
            MotivoComentario,
            FechaCambio
        ) VALUES (
            @IDPedido,
            NULL,
            @IDEstadoPendiente,
            @IDUsuario,
            N'Pedido iniciado en checkout, pendiente de confirmación de pago',
            SYSUTCDATETIME()
        );

        -- 14. Crear Reserva de Inventario de 15 minutos 
        DECLARE @FechaCreacionReserva DATETIME2(3) = SYSUTCDATETIME();
        DECLARE @FechaExpiracionReserva DATETIME2(3) = DATEADD(MINUTE, 15, @FechaCreacionReserva);
        DECLARE @IDReserva BIGINT;

        INSERT INTO dbo.ReservaInventario (
            IDPedido,
            Estado,
            FechaCreacion,
            FechaExpiracion,
            FechaCierre
        ) VALUES (
            @IDPedido,
            'ACTIVA',
            @FechaCreacionReserva,
            @FechaExpiracionReserva,
            NULL
        );

        SET @IDReserva = SCOPE_IDENTITY();

        -- Detalle de la reserva
        INSERT INTO dbo.ReservaInventarioDetalle (
            IDReserva,
            IDVariante,
            IDAlmacen,
            Cantidad
        )
        SELECT 
            @IDReserva,
            IDVariante,
            @IDAlmacen,
            Cantidad
        FROM @ItemsCarrito;

        COMMIT TRANSACTION;

        -- 15. Devolver resumen de checkout creado
        SELECT 
            p.IDPedido,
            p.NumeroPedido,
            p.Total,
            p.Subtotal,
            p.Descuento,
            p.CostoEnvio,
            p.IVAIncluido,
            p.Moneda,
            'PENDIENTE_PAGO' AS EstadoCodigo,
            N'Pendiente de pago' AS EstadoNombre,
            @IDReserva AS IDReserva,
            'ACTIVA' AS EstadoReserva,
            @FechaExpiracionReserva AS FechaExpiracionReserva,
            900 AS SegundosRestantesReserva
        FROM dbo.Pedido p
        WHERE p.IDPedido = @IDPedido;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* =========================================================================
   2. SP_Checkout_ConfirmarPago
   Procesa y confirma el pago de un pedido en checkout de forma atómica:
   - Valida idempotencia (no duplica pagos ni pedidos ante reintentos).
   - Valida tiempo de reserva de 15 minutos .
   - Registra el pago en dbo.Pago.
   - Consume la reserva y descuenta existencias físicas en Inventario y Kardex (SALIDA_VENTA).
   - Registra uso de cupón si aplica .
   - Transiciona el pedido a 'PAGADO'.
   - Convierte el carrito a 'CONVERTIDO'.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_ConfirmarPago
    @IDPedido BIGINT,
    @IDUsuario INT,
    @ClaveIdempotenciaPago VARCHAR(100),
    @Proveedor VARCHAR(60) = 'SIMULADOR',
    @ReferenciaProveedor NVARCHAR(150) = NULL,
    @Monto DECIMAL(14,2) = NULL,
    @RespuestaProveedor NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Validaciones de entrada
    IF @IDPedido IS NULL OR @IDUsuario IS NULL
    BEGIN
        THROW 50001, N'IDPedido e IDUsuario son obligatorios.', 1;
    END

    IF @ClaveIdempotenciaPago IS NULL OR LEN(LTRIM(RTRIM(@ClaveIdempotenciaPago))) = 0
    BEGIN
        THROW 50001, N'La ClaveIdempotenciaPago es obligatoria.', 1;
    END

    -- 1. Idempotencia a nivel de Pago: si este pago ya fue capturado con esta clave, retornar éxito
    DECLARE @IDPagoExistente BIGINT;
    DECLARE @EstadoPagoExistente VARCHAR(25);

    SELECT 
        @IDPagoExistente = IDPago,
        @EstadoPagoExistente = Estado
    FROM dbo.Pago WITH (NOLOCK)
    WHERE ClaveIdempotencia = @ClaveIdempotenciaPago;

    IF @IDPagoExistente IS NOT NULL AND @EstadoPagoExistente = 'CAPTURADO'
    BEGIN
        SELECT 
            p.IDPedido,
            p.NumeroPedido,
            p.Total,
            p.Moneda,
            ep.Codigo AS EstadoCodigo,
            ep.Nombre AS EstadoNombre,
            pa.IDPago,
            pa.Estado AS EstadoPago,
            pa.Proveedor,
            pa.ReferenciaProveedor,
            pa.FechaConfirmacion
        FROM dbo.Pedido p
        INNER JOIN dbo.EstadoPedido ep ON p.IDEstadoPedido = ep.IDEstadoPedido
        INNER JOIN dbo.Pago pa ON p.IDPedido = pa.IDPedido
        WHERE pa.IDPago = @IDPagoExistente;

        RETURN;
    END

    BEGIN TRANSACTION;
    BEGIN TRY
        -- 2. Bloquear pedido y verificar pertenencia (IDOR)
        DECLARE @PedidoUsuario INT;
        DECLARE @IDEstadoActual INT;
        DECLARE @EstadoCodigoActual VARCHAR(30);
        DECLARE @TotalPedido DECIMAL(14,2);
        DECLARE @IDCarrito BIGINT;
        DECLARE @IDCupon INT;
        DECLARE @DescuentoPedido DECIMAL(14,2);
        DECLARE @NumeroPedido VARCHAR(30);

        SELECT 
            @PedidoUsuario = p.IDUsuario,
            @IDEstadoActual = p.IDEstadoPedido,
            @EstadoCodigoActual = ep.Codigo,
            @TotalPedido = p.Total,
            @IDCarrito = p.IDCarrito,
            @IDCupon = p.IDCupon,
            @DescuentoPedido = p.Descuento,
            @NumeroPedido = p.NumeroPedido
        FROM dbo.Pedido p WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.EstadoPedido ep ON p.IDEstadoPedido = ep.IDEstadoPedido
        WHERE p.IDPedido = @IDPedido;

        IF @PedidoUsuario IS NULL
        BEGIN
            THROW 50404, N'El pedido especificado no existe.', 1;
        END

        IF @PedidoUsuario <> @IDUsuario
        BEGIN
            THROW 50403, N'No tiene autorización para operar sobre este pedido.', 1;
        END

        -- Si el pedido ya está pagado (ej. por otra confirmación previa)
        IF @EstadoCodigoActual <> 'PENDIENTE_PAGO'
        BEGIN
            IF @EstadoCodigoActual = 'PAGADO'
            BEGIN
                COMMIT TRANSACTION;
                SELECT 
                    p.IDPedido,
                    p.NumeroPedido,
                    p.Total,
                    p.Moneda,
                    ep.Codigo AS EstadoCodigo,
                    ep.Nombre AS EstadoNombre,
                    ISNULL(pa.IDPago, 0) AS IDPago,
                    ISNULL(pa.Estado, 'CAPTURADO') AS EstadoPago,
                    ISNULL(pa.Proveedor, @Proveedor) AS Proveedor,
                    pa.ReferenciaProveedor,
                    p.FechaPago AS FechaConfirmacion
                FROM dbo.Pedido p
                INNER JOIN dbo.EstadoPedido ep ON p.IDEstadoPedido = ep.IDEstadoPedido
                LEFT JOIN dbo.Pago pa ON p.IDPedido = pa.IDPedido AND pa.Estado = 'CAPTURADO'
                WHERE p.IDPedido = @IDPedido;
                RETURN;
            END
            ELSE
            BEGIN
                THROW 50502, N'El pedido no se encuentra en estado pendiente de pago.', 1;
            END
        END

        -- 3. Validar monto si fue provisto
        IF @Monto IS NOT NULL AND @Monto <> @TotalPedido
        BEGIN
            THROW 50503, N'El monto especificado no coincide con el total del pedido.', 1;
        END

        -- 4. Validar reserva de existencia (15 minutos)
        DECLARE @IDReserva BIGINT;
        DECLARE @EstadoReserva VARCHAR(20);
        DECLARE @FechaExpiracion DATETIME2(3);

        SELECT 
            @IDReserva = IDReserva,
            @EstadoReserva = Estado,
            @FechaExpiracion = FechaExpiracion
        FROM dbo.ReservaInventario WITH (UPDLOCK)
        WHERE IDPedido = @IDPedido;

        IF @IDReserva IS NULL OR @EstadoReserva <> 'ACTIVA'
        BEGIN
            THROW 50501, N'No existe una reserva activa para este pedido.', 1;
        END

        -- Verificar si la reserva ya venció
        IF @FechaExpiracion < SYSUTCDATETIME()
        BEGIN
            -- Liberar reserva vencida
            UPDATE dbo.Inventario
            SET CantidadReservada = CASE WHEN inv.CantidadReservada >= rd.Cantidad THEN inv.CantidadReservada - rd.Cantidad ELSE 0 END,
                FechaActualizacion = SYSUTCDATETIME()
            FROM dbo.Inventario inv
            INNER JOIN dbo.ReservaInventarioDetalle rd ON inv.IDVariante = rd.IDVariante AND inv.IDAlmacen = rd.IDAlmacen
            WHERE rd.IDReserva = @IDReserva;

            UPDATE dbo.ReservaInventario
            SET Estado = 'EXPIRADA',
                FechaCierre = SYSUTCDATETIME()
            WHERE IDReserva = @IDReserva;

            -- Cancelar pedido por expiración de reserva
            DECLARE @IDEstadoCancelado INT;
            SELECT @IDEstadoCancelado = IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = 'CANCELADO';

            UPDATE dbo.Pedido
            SET IDEstadoPedido = @IDEstadoCancelado,
                FechaCancelacion = SYSUTCDATETIME(),
                FechaActualizacion = SYSUTCDATETIME()
            WHERE IDPedido = @IDPedido;

            INSERT INTO dbo.HistorialEstadoPedido (
                IDPedido,
                IDEstadoAnterior,
                IDEstadoNuevo,
                IDUsuario,
                MotivoComentario,
                FechaCambio
            ) VALUES (
                @IDPedido,
                @IDEstadoActual,
                @IDEstadoCancelado,
                @IDUsuario,
                N'Reserva de 15 minutos vencida antes de confirmar el pago',
                SYSUTCDATETIME()
            );

            THROW 50501, N'La reserva de inventario de 15 minutos ha expirado. El pedido fue cancelado. Por favor inicie nuevamente.', 1;
        END

        -- 5. Registrar el Pago en dbo.Pago
        DECLARE @IDPago BIGINT;

        INSERT INTO dbo.Pago (
            IDPedido,
            Proveedor,
            ReferenciaProveedor,
            ClaveIdempotencia,
            Estado,
            Monto,
            Moneda,
            FechaCreacion,
            FechaActualizacion,
            FechaConfirmacion,
            RespuestaProveedor
        ) VALUES (
            @IDPedido,
            @Proveedor,
            @ReferenciaProveedor,
            @ClaveIdempotenciaPago,
            'CAPTURADO',
            @TotalPedido,
            'GTQ',
            SYSUTCDATETIME(),
            SYSUTCDATETIME(),
            SYSUTCDATETIME(),
            @RespuestaProveedor
        );

        SET @IDPago = SCOPE_IDENTITY();

        -- 6. Consumir la reserva y asentar salida física en Inventario y Kardex (SALIDA_VENTA)
        UPDATE dbo.ReservaInventario
        SET Estado = 'CONSUMIDA',
            FechaCierre = SYSUTCDATETIME()
        WHERE IDReserva = @IDReserva;

        DECLARE @IDVarianteItem INT;
        DECLARE @IDAlmacenItem INT;
        DECLARE @CantidadItem INT;
        DECLARE @ExistenciaActual INT;
        DECLARE @ExistenciaPosterior INT;

        DECLARE curReservaDet CURSOR LOCAL FAST_FORWARD FOR
            SELECT IDVariante, IDAlmacen, Cantidad
            FROM dbo.ReservaInventarioDetalle
            WHERE IDReserva = @IDReserva;

        OPEN curReservaDet;
        FETCH NEXT FROM curReservaDet INTO @IDVarianteItem, @IDAlmacenItem, @CantidadItem;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            -- Bloquear fila de inventario
            SELECT @ExistenciaActual = Existencia
            FROM dbo.Inventario WITH (UPDLOCK, ROWLOCK)
            WHERE IDVariante = @IDVarianteItem AND IDAlmacen = @IDAlmacenItem;

            SET @ExistenciaPosterior = @ExistenciaActual - @CantidadItem;

            -- Descontar existencia física y disminuir la reserva
            UPDATE dbo.Inventario
            SET Existencia = @ExistenciaPosterior,
                CantidadReservada = CASE WHEN CantidadReservada >= @CantidadItem THEN CantidadReservada - @CantidadItem ELSE 0 END,
                FechaActualizacion = SYSUTCDATETIME()
            WHERE IDVariante = @IDVarianteItem AND IDAlmacen = @IDAlmacenItem;

            -- Registrar movimiento inmutable en el Kardex (: SALIDA_VENTA requiere Cantidad < 0)
            INSERT INTO dbo.MovimientoInventario (
                IDVariante,
                IDAlmacen,
                TipoMovimiento,
                Cantidad,
                ExistenciaAnterior,
                ExistenciaPosterior,
                IDPedido,
                IDUsuario,
                Motivo,
                FechaMovimiento
            ) VALUES (
                @IDVarianteItem,
                @IDAlmacenItem,
                'SALIDA_VENTA',
                -@CantidadItem,
                @ExistenciaActual,
                @ExistenciaPosterior,
                @IDPedido,
                @IDUsuario,
                N'Venta confirmada pedido ' + @NumeroPedido + N' (Pago #' + CAST(@IDPago AS VARCHAR(20)) + N')',
                SYSUTCDATETIME()
            );

            FETCH NEXT FROM curReservaDet INTO @IDVarianteItem, @IDAlmacenItem, @CantidadItem;
        END

        CLOSE curReservaDet;
        DEALLOCATE curReservaDet;

        -- 7. Registrar uso de cupón si aplica 
        IF @IDCupon IS NOT NULL AND @DescuentoPedido > 0
        BEGIN
            INSERT INTO dbo.UsoCupon (
                IDCupon,
                IDUsuario,
                IDPedido,
                MontoDescuento,
                EsVigente,
                FechaUso
            ) VALUES (
                @IDCupon,
                @IDUsuario,
                @IDPedido,
                @DescuentoPedido,
                1,
                SYSUTCDATETIME()
            );

            UPDATE dbo.Cupon
            SET UsosActuales = UsosActuales + 1
            WHERE IDCupon = @IDCupon;
        END

        -- 8. Transicionar estado del pedido a 'PAGADO' 
        DECLARE @IDEstadoPagado INT;
        SELECT @IDEstadoPagado = IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = 'PAGADO';

        UPDATE dbo.Pedido
        SET IDEstadoPedido = @IDEstadoPagado,
            FechaPago = SYSUTCDATETIME(),
            FechaActualizacion = SYSUTCDATETIME()
        WHERE IDPedido = @IDPedido;

        INSERT INTO dbo.HistorialEstadoPedido (
            IDPedido,
            IDEstadoAnterior,
            IDEstadoNuevo,
            IDUsuario,
            MotivoComentario,
            FechaCambio
        ) VALUES (
            @IDPedido,
            @IDEstadoActual,
            @IDEstadoPagado,
            @IDUsuario,
            N'Pago capturado y confirmado satisfactoriamente',
            SYSUTCDATETIME()
        );

        -- 9. Marcar carrito como 'CONVERTIDO'
        IF @IDCarrito IS NOT NULL
        BEGIN
            UPDATE dbo.Carrito
            SET Estado = 'CONVERTIDO',
                FechaUltimaActividad = SYSUTCDATETIME()
            WHERE IDCarrito = @IDCarrito;
        END

        COMMIT TRANSACTION;

        -- 10. Devolver resumen de confirmación
        SELECT 
            p.IDPedido,
            p.NumeroPedido,
            p.Total,
            p.Moneda,
            'PAGADO' AS EstadoCodigo,
            N'Pagado' AS EstadoNombre,
            @IDPago AS IDPago,
            'CAPTURADO' AS EstadoPago,
            @Proveedor AS Proveedor,
            @ReferenciaProveedor AS ReferenciaProveedor,
            SYSUTCDATETIME() AS FechaConfirmacion
        FROM dbo.Pedido p
        WHERE p.IDPedido = @IDPedido;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* =========================================================================
   VISTA: dbo.VW_Pedidos_ResumenOperativo
   Consolida cabeceras de pedidos con datos del cliente, estado actual y
   conteo de líneas/artículos para consultas operativas y administrativas.
   ========================================================================= */
CREATE OR ALTER VIEW dbo.VW_Pedidos_ResumenOperativo
AS
SELECT 
    p.IDPedido,
    p.NumeroPedido,
    p.FechaCreacion,
    p.FechaPago,
    p.FechaEntrega,
    p.FechaCancelacion,
    p.IDUsuario AS IDCliente,
    (u.Nombres + ' ' + u.Apellidos) AS ClienteNombre,
    u.Correo AS ClienteCorreo,
    p.IDEstadoPedido,
    ep.Codigo AS EstadoCodigo,
    ep.Nombre AS EstadoNombre,
    ep.PermiteCancelacion,
    p.Subtotal,
    p.Descuento,
    p.CostoEnvio,
    p.Total,
    p.Moneda,
    ISNULL(lineas.CantidadLineas, 0) AS CantidadLineas,
    ISNULL(lineas.TotalArticulos, 0) AS TotalArticulos
FROM dbo.Pedido p WITH (NOLOCK)
INNER JOIN dbo.Usuario u ON p.IDUsuario = u.IDUsuario
INNER JOIN dbo.EstadoPedido ep ON p.IDEstadoPedido = ep.IDEstadoPedido
OUTER APPLY (
    SELECT 
        COUNT(1) AS CantidadLineas,
        ISNULL(SUM(pd.Cantidad), 0) AS TotalArticulos
    FROM dbo.PedidoDetalle pd
    WHERE pd.IDPedido = p.IDPedido
) lineas;
GO

/* =========================================================================
   3. SP_Pedidos_ListarPropios
   Lista pedidos del cliente autenticado con paginación usando la vista operativa.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ListarPropios
    @IDUsuario INT,
    @Pagina INT = 1,
    @Limite INT = 10,
    @TotalRegistros INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF @IDUsuario IS NULL
    BEGIN
        THROW 50001, N'El IDUsuario es obligatorio.', 1;
    END

    SET @Pagina = ISNULL(@Pagina, 1);
    SET @Limite = ISNULL(@Limite, 10);
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Limite < 1 SET @Limite = 10;
    IF @Limite > 50 SET @Limite = 50;

    DECLARE @Offset INT = (@Pagina - 1) * @Limite;

    -- Conteo total de pedidos del usuario usando la vista
    SELECT @TotalRegistros = COUNT(1)
    FROM dbo.VW_Pedidos_ResumenOperativo v
    WHERE v.IDCliente = @IDUsuario;

    -- Listado paginado usando la vista
    SELECT 
        v.IDPedido,
        v.NumeroPedido,
        v.FechaCreacion,
        v.FechaPago,
        v.FechaEntrega,
        v.FechaCancelacion,
        v.Subtotal,
        v.Descuento,
        v.CostoEnvio,
        v.Total,
        v.Moneda,
        v.EstadoCodigo,
        v.EstadoNombre,
        v.PermiteCancelacion,
        v.CantidadLineas,
        v.TotalArticulos
    FROM dbo.VW_Pedidos_ResumenOperativo v
    WHERE v.IDCliente = @IDUsuario
    ORDER BY v.FechaCreacion DESC
    OFFSET @Offset ROWS
    FETCH NEXT @Limite ROWS ONLY;
END;
GO

/* =========================================================================
   4. SP_Pedidos_ObtenerDetalle
   Retorna cabecera, líneas e historial de estados de un pedido.
   - Si @EsOperador = 0, valida estrictamente que pertenezca a @IDUsuario (IDOR).
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ObtenerDetalle
    @IDPedido BIGINT,
    @IDUsuario INT = NULL,
    @EsOperador BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF @IDPedido IS NULL
    BEGIN
        THROW 50001, N'El IDPedido es obligatorio.', 1;
    END

    -- 1. Verificar existencia y permisos IDOR
    DECLARE @PedidoUsuario INT;

    SELECT @PedidoUsuario = IDUsuario
    FROM dbo.Pedido WITH (NOLOCK)
    WHERE IDPedido = @IDPedido;

    IF @PedidoUsuario IS NULL
    BEGIN
        THROW 50404, N'El pedido especificado no existe.', 1;
    END

    IF @EsOperador = 0 AND (@IDUsuario IS NULL OR @PedidoUsuario <> @IDUsuario)
    BEGIN
        THROW 50403, N'No tiene autorización para visualizar los detalles de este pedido.', 1;
    END

    -- 2. Resultset 1: Cabecera del pedido
    SELECT 
        p.IDPedido,
        p.NumeroPedido,
        p.IDUsuario,
        (u.Nombres + ' ' + u.Apellidos) AS ClienteNombre,
        u.Correo AS ClienteCorreo,
        p.IDEstadoPedido,
        ep.Codigo AS EstadoCodigo,
        ep.Nombre AS EstadoNombre,
        ep.PermiteCancelacion,
        p.DestinatarioSnapshot,
        p.TelefonoSnapshot,
        p.DireccionSnapshot,
        p.Subtotal,
        p.Descuento,
        p.CostoEnvio,
        p.Total,
        p.IVAIncluido,
        p.PorcentajeIVA,
        p.Moneda,
        p.FechaCreacion,
        p.FechaActualizacion,
        p.FechaPago,
        p.FechaEntrega,
        p.FechaCancelacion,
        p.IDCupon,
        c.Codigo AS CodigoCupon,
        -- Datos del pago
        pa.IDPago,
        pa.Proveedor AS PagoProveedor,
        pa.ReferenciaProveedor AS PagoReferencia,
        pa.Estado AS PagoEstado,
        pa.FechaConfirmacion AS PagoFecha
    FROM dbo.Pedido p WITH (NOLOCK)
    INNER JOIN dbo.EstadoPedido ep ON p.IDEstadoPedido = ep.IDEstadoPedido
    INNER JOIN dbo.Usuario u ON p.IDUsuario = u.IDUsuario
    LEFT JOIN dbo.Cupon c ON p.IDCupon = c.IDCupon
    LEFT JOIN dbo.Pago pa ON p.IDPedido = pa.IDPedido AND pa.Estado = 'CAPTURADO'
    WHERE p.IDPedido = @IDPedido;

    -- 3. Resultset 2: Líneas del pedido
    SELECT 
        pd.IDPedidoDetalle,
        pd.IDPedido,
        pd.IDVariante,
        pd.SKUSnapshot AS SKU,
        pd.NombreProductoSnapshot AS NombreProducto,
        pd.DescripcionVarianteSnapshot AS DescripcionVariante,
        pd.PrecioUnitario,
        pd.Cantidad,
        pd.ImporteBruto,
        pd.DescuentoLinea,
        pd.TotalLinea,
        pd.IVALinea,
        pd.CantidadDevuelta,
        (pd.Cantidad - pd.CantidadDevuelta) AS CantidadDisponibleParaDevolver
    FROM dbo.PedidoDetalle pd WITH (NOLOCK)
    WHERE pd.IDPedido = @IDPedido
    ORDER BY pd.IDPedidoDetalle ASC;

    -- 4. Resultset 3: Historial de Estados (Inmutable)
    SELECT 
        h.IDHistorialEstado,
        h.FechaCambio,
        ea.Codigo AS EstadoAnteriorCodigo,
        ea.Nombre AS EstadoAnteriorNombre,
        en.Codigo AS EstadoNuevoCodigo,
        en.Nombre AS EstadoNuevoNombre,
        h.IDUsuario,
        (u.Nombres + ' ' + u.Apellidos) AS UsuarioNombre,
        h.MotivoComentario
    FROM dbo.HistorialEstadoPedido h WITH (NOLOCK)
    INNER JOIN dbo.EstadoPedido en ON h.IDEstadoNuevo = en.IDEstadoPedido
    LEFT JOIN dbo.EstadoPedido ea ON h.IDEstadoAnterior = ea.IDEstadoPedido
    LEFT JOIN dbo.Usuario u ON h.IDUsuario = u.IDUsuario
    WHERE h.IDPedido = @IDPedido
    ORDER BY h.FechaCambio ASC, h.IDHistorialEstado ASC;
END;
GO

/* =========================================================================
   5. SP_Pedidos_ListarAdmin
   Lista pedidos para Operador y Administrador con filtros y paginación
   usando la vista operativa.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ListarAdmin
    @Pagina INT = 1,
    @Limite INT = 20,
    @CodigoEstado VARCHAR(30) = NULL,
    @IDCliente INT = NULL,
    @Busqueda NVARCHAR(100) = NULL,
    @FechaInicio DATETIME2(3) = NULL,
    @FechaFin DATETIME2(3) = NULL,
    @TotalRegistros INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    SET @Pagina = ISNULL(@Pagina, 1);
    SET @Limite = ISNULL(@Limite, 20);
    IF @Pagina < 1 SET @Pagina = 1;
    IF @Limite < 1 SET @Limite = 20;
    IF @Limite > 100 SET @Limite = 100;

    DECLARE @Offset INT = (@Pagina - 1) * @Limite;

    DECLARE @IDEstadoFiltro INT = NULL;
    IF @CodigoEstado IS NOT NULL AND LEN(LTRIM(RTRIM(@CodigoEstado))) > 0
    BEGIN
        SELECT @IDEstadoFiltro = IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = @CodigoEstado;
    END

    -- Conteo total con filtros usando la vista
    SELECT @TotalRegistros = COUNT(1)
    FROM dbo.VW_Pedidos_ResumenOperativo v
    WHERE (@IDEstadoFiltro IS NULL OR v.IDEstadoPedido = @IDEstadoFiltro)
      AND (@IDCliente IS NULL OR v.IDCliente = @IDCliente)
      AND (@FechaInicio IS NULL OR v.FechaCreacion >= @FechaInicio)
      AND (@FechaFin IS NULL OR v.FechaCreacion <= @FechaFin)
      AND (@Busqueda IS NULL OR (
            v.NumeroPedido LIKE '%' + @Busqueda + '%'
            OR v.ClienteNombre LIKE '%' + @Busqueda + '%'
            OR v.ClienteCorreo LIKE '%' + @Busqueda + '%'
          ));

    -- Registros paginados usando la vista
    SELECT 
        v.IDPedido,
        v.NumeroPedido,
        v.FechaCreacion,
        v.FechaPago,
        v.FechaEntrega,
        v.FechaCancelacion,
        v.IDCliente,
        v.ClienteNombre,
        v.ClienteCorreo,
        v.EstadoCodigo,
        v.EstadoNombre,
        v.Subtotal,
        v.Descuento,
        v.CostoEnvio,
        v.Total,
        v.Moneda,
        v.CantidadLineas,
        v.TotalArticulos
    FROM dbo.VW_Pedidos_ResumenOperativo v
    WHERE (@IDEstadoFiltro IS NULL OR v.IDEstadoPedido = @IDEstadoFiltro)
      AND (@IDCliente IS NULL OR v.IDCliente = @IDCliente)
      AND (@FechaInicio IS NULL OR v.FechaCreacion >= @FechaInicio)
      AND (@FechaFin IS NULL OR v.FechaCreacion <= @FechaFin)
      AND (@Busqueda IS NULL OR (
            v.NumeroPedido LIKE '%' + @Busqueda + '%'
            OR v.ClienteNombre LIKE '%' + @Busqueda + '%'
            OR v.ClienteCorreo LIKE '%' + @Busqueda + '%'
          ))
    ORDER BY v.FechaCreacion DESC
    OFFSET @Offset ROWS
    FETCH NEXT @Limite ROWS ONLY;
END;
GO

/* =========================================================================
   6. SP_Pedidos_CambiarEstado
   Aplica una transición de estado a un pedido .
   - Valida la transición permitida según dbo.TransicionEstadoPedido.
   - Si se transiciona a CANCELADO:
     * Si estaba PAGADO o PREPARANDO: reintegra existencias al Kardex (CANCELACION).
     * Si estaba PENDIENTE_PAGO: libera la reserva en dbo.Inventario y ReservaInventario.
     * Si usó cupón: revoca vigencia en UsoCupon y descuenta UsosActuales en Cupon.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_CambiarEstado
    @IDPedido BIGINT,
    @NuevoEstadoCodigo VARCHAR(30),
    @IDUsuarioOperador INT,
    @Motivo NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @IDPedido IS NULL OR @NuevoEstadoCodigo IS NULL OR @IDUsuarioOperador IS NULL
    BEGIN
        THROW 50001, N'IDPedido, NuevoEstadoCodigo e IDUsuarioOperador son requeridos.', 1;
    END

    IF @Motivo IS NULL OR LEN(LTRIM(RTRIM(@Motivo))) = 0
    BEGIN
        THROW 50001, N'El motivo de la transición de estado es obligatorio.', 1;
    END

    -- 1. Validar estado destino
    DECLARE @IDEstadoDestino INT;
    SELECT @IDEstadoDestino = IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = @NuevoEstadoCodigo;

    IF @IDEstadoDestino IS NULL
    BEGIN
        THROW 50602, N'El estado de destino no existe en el catálogo.', 1;
    END

    BEGIN TRANSACTION;
    BEGIN TRY
        -- 2. Bloquear pedido y obtener estado actual
        DECLARE @IDEstadoOrigen INT;
        DECLARE @EstadoOrigenCodigo VARCHAR(30);
        DECLARE @NumeroPedido VARCHAR(30);
        DECLARE @IDCupon INT;

        SELECT 
            @IDEstadoOrigen = p.IDEstadoPedido,
            @EstadoOrigenCodigo = ep.Codigo,
            @NumeroPedido = p.NumeroPedido,
            @IDCupon = p.IDCupon
        FROM dbo.Pedido p WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.EstadoPedido ep ON p.IDEstadoPedido = ep.IDEstadoPedido
        WHERE p.IDPedido = @IDPedido;

        IF @IDEstadoOrigen IS NULL
        BEGIN
            THROW 50404, N'El pedido especificado no existe.', 1;
        END

        -- 3. Validar si la transición está permitida
        IF NOT EXISTS (
            SELECT 1 
            FROM dbo.TransicionEstadoPedido 
            WHERE IDEstadoOrigen = @IDEstadoOrigen AND IDEstadoDestino = @IDEstadoDestino
        )
        BEGIN
            DECLARE @ErrorMsg NVARCHAR(300) = N'Transición de estado no permitida: de ' + @EstadoOrigenCodigo + N' a ' + @NuevoEstadoCodigo + N'.';
            THROW 50020, @ErrorMsg, 1;
        END

        -- 4. Si la transición es a 'CANCELADO'
        IF @NuevoEstadoCodigo = 'CANCELADO'
        BEGIN
            -- Caso A: Estaba PAGADO o PREPARANDO (la mercancía ya fue descontada físicamente)
            IF @EstadoOrigenCodigo IN ('PAGADO', 'PREPARANDO')
            BEGIN
                DECLARE @IDAlmacen INT;
                SELECT TOP 1 @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = 'PRINCIPAL';

                DECLARE @IDVarianteLine INT;
                DECLARE @CantPedida INT;
                DECLARE @CantDevuelta INT;
                DECLARE @CantReintegrar INT;
                DECLARE @ExistenciaActual INT;

                DECLARE curDetallePed CURSOR LOCAL FAST_FORWARD FOR
                    SELECT IDVariante, Cantidad, CantidadDevuelta
                    FROM dbo.PedidoDetalle
                    WHERE IDPedido = @IDPedido;

                OPEN curDetallePed;
                FETCH NEXT FROM curDetallePed INTO @IDVarianteLine, @CantPedida, @CantDevuelta;

                WHILE @@FETCH_STATUS = 0
                BEGIN
                    SET @CantReintegrar = @CantPedida - @CantDevuelta;

                    IF @CantReintegrar > 0
                    BEGIN
                        -- Bloquear y actualizar inventario
                        SELECT @ExistenciaActual = Existencia
                        FROM dbo.Inventario WITH (UPDLOCK, ROWLOCK)
                        WHERE IDVariante = @IDVarianteLine AND IDAlmacen = @IDAlmacen;

                        UPDATE dbo.Inventario
                        SET Existencia = Existencia + @CantReintegrar,
                            FechaActualizacion = SYSUTCDATETIME()
                        WHERE IDVariante = @IDVarianteLine AND IDAlmacen = @IDAlmacen;

                        -- Asentar en Kardex (CANCELACION requiere Cantidad > 0 y apunta al pedido)
                        INSERT INTO dbo.MovimientoInventario (
                            IDVariante,
                            IDAlmacen,
                            TipoMovimiento,
                            Cantidad,
                            ExistenciaAnterior,
                            ExistenciaPosterior,
                            IDPedido,
                            IDUsuario,
                            Motivo,
                            FechaMovimiento
                        ) VALUES (
                            @IDVarianteLine,
                            @IDAlmacen,
                            'CANCELACION',
                            @CantReintegrar,
                            @ExistenciaActual,
                            @ExistenciaActual + @CantReintegrar,
                            @IDPedido,
                            @IDUsuarioOperador,
                            N'Reintegro por cancelación de pedido ' + @NumeroPedido + N': ' + @Motivo,
                            SYSUTCDATETIME()
                        );
                    END

                    FETCH NEXT FROM curDetallePed INTO @IDVarianteLine, @CantPedida, @CantDevuelta;
                END

                CLOSE curDetallePed;
                DEALLOCATE curDetallePed;
            END

            -- Caso B: Estaba PENDIENTE_PAGO (la mercancía solo estaba reservada, no descontada físicamente)
            IF @EstadoOrigenCodigo = 'PENDIENTE_PAGO'
            BEGIN
                DECLARE @IDReservaActiva BIGINT;
                SELECT @IDReservaActiva = IDReserva
                FROM dbo.ReservaInventario WITH (UPDLOCK)
                WHERE IDPedido = @IDPedido AND Estado = 'ACTIVA';

                IF @IDReservaActiva IS NOT NULL
                BEGIN
                    UPDATE dbo.Inventario
                    SET CantidadReservada = CASE WHEN inv.CantidadReservada >= rd.Cantidad THEN inv.CantidadReservada - rd.Cantidad ELSE 0 END,
                        FechaActualizacion = SYSUTCDATETIME()
                    FROM dbo.Inventario inv
                    INNER JOIN dbo.ReservaInventarioDetalle rd ON inv.IDVariante = rd.IDVariante AND inv.IDAlmacen = rd.IDAlmacen
                    WHERE rd.IDReserva = @IDReservaActiva;

                    UPDATE dbo.ReservaInventario
                    SET Estado = 'CANCELADA',
                        FechaCierre = SYSUTCDATETIME()
                    WHERE IDReserva = @IDReservaActiva;
                END
            END

            -- Si usó cupón, revocarlo
            IF @IDCupon IS NOT NULL
            BEGIN
                UPDATE dbo.UsoCupon
                SET EsVigente = 0
                WHERE IDPedido = @IDPedido;

                UPDATE dbo.Cupon
                SET UsosActuales = CASE WHEN UsosActuales > 0 THEN UsosActuales - 1 ELSE 0 END
                WHERE IDCupon = @IDCupon;
            END

            -- Establecer fecha de cancelación
            UPDATE dbo.Pedido
            SET FechaCancelacion = SYSUTCDATETIME()
            WHERE IDPedido = @IDPedido;
        END

        -- 5. Si la transición es a 'ENTREGADO'
        IF @NuevoEstadoCodigo = 'ENTREGADO'
        BEGIN
            UPDATE dbo.Pedido
            SET FechaEntrega = SYSUTCDATETIME()
            WHERE IDPedido = @IDPedido;
        END

        -- 6. Actualizar estado del pedido
        UPDATE dbo.Pedido
        SET IDEstadoPedido = @IDEstadoDestino,
            FechaActualizacion = SYSUTCDATETIME()
        WHERE IDPedido = @IDPedido;

        -- 7. Registrar en el historial de estados
        INSERT INTO dbo.HistorialEstadoPedido (
            IDPedido,
            IDEstadoAnterior,
            IDEstadoNuevo,
            IDUsuario,
            MotivoComentario,
            FechaCambio
        ) VALUES (
            @IDPedido,
            @IDEstadoOrigen,
            @IDEstadoDestino,
            @IDUsuarioOperador,
            @Motivo,
            SYSUTCDATETIME()
        );

        COMMIT TRANSACTION;

        SELECT 
            @IDPedido AS IDPedido,
            @NumeroPedido AS NumeroPedido,
            @EstadoOrigenCodigo AS EstadoAnterior,
            @NuevoEstadoCodigo AS EstadoNuevo,
            SYSUTCDATETIME() AS FechaActualizacion;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* =========================================================================
   7. SP_Devoluciones_Crear
   Procesa una devolución parcial o total de un pedido entregado .
   - Valida que el pedido esté en ENTREGADO o DEVOLUCION_PARCIAL.
   - Valida que la cantidad a devolver no supere (Cantidad - CantidadDevuelta).
   - Registra en dbo.Devolucion y dbo.DevolucionDetalle.
   - Reintegra existencias en Inventario y asienta en Kardex (DEVOLUCION).
   - Actualiza CantidadDevuelta en PedidoDetalle.
   - Transiciona el pedido a DEVOLUCION_PARCIAL o DEVOLUCION_TOTAL.
   - Registra el reembolso correspondiente en dbo.Reembolso.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Devoluciones_Crear
    @IDPedido BIGINT,
    @IDUsuarioSolicitante INT,
    @Motivo NVARCHAR(500),
    @LineasJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @IDPedido IS NULL OR @IDUsuarioSolicitante IS NULL
    BEGIN
        THROW 50001, N'IDPedido e IDUsuarioSolicitante son obligatorios.', 1;
    END

    IF @Motivo IS NULL OR LEN(LTRIM(RTRIM(@Motivo))) = 0
    BEGIN
        THROW 50001, N'El motivo de la devolución es obligatorio.', 1;
    END

    IF @LineasJson IS NULL OR ISJSON(@LineasJson) <> 1
    BEGIN
        THROW 50001, N'LineasJson debe ser un arreglo JSON válido.', 1;
    END

    BEGIN TRANSACTION;
    BEGIN TRY
        -- 1. Bloquear pedido y verificar estado
        DECLARE @IDEstadoActual INT;
        DECLARE @EstadoCodigoActual VARCHAR(30);
        DECLARE @NumeroPedido VARCHAR(30);
        DECLARE @IDPago BIGINT;
        DECLARE @IDCupon INT;

        SELECT 
            @IDEstadoActual = p.IDEstadoPedido,
            @EstadoCodigoActual = ep.Codigo,
            @NumeroPedido = p.NumeroPedido,
            @IDCupon = p.IDCupon
        FROM dbo.Pedido p WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.EstadoPedido ep ON p.IDEstadoPedido = ep.IDEstadoPedido
        WHERE p.IDPedido = @IDPedido;

        IF @IDEstadoActual IS NULL
        BEGIN
            THROW 50404, N'El pedido especificado no existe.', 1;
        END

        IF @EstadoCodigoActual NOT IN ('ENTREGADO', 'DEVOLUCION_PARCIAL')
        BEGIN
            THROW 50603, N'Solo se pueden realizar devoluciones sobre pedidos en estado ENTREGADO o DEVOLUCION_PARCIAL.', 1;
        END

        -- Obtener IDPago para el reembolso
        SELECT TOP 1 @IDPago = IDPago
        FROM dbo.Pago WITH (NOLOCK)
        WHERE IDPedido = @IDPedido AND Estado = 'CAPTURADO';

        -- 2. Parsear y validar líneas solicitadas
        DECLARE @LineasDevolver TABLE (
            IDPedidoDetalle BIGINT,
            CantidadDevolver INT
        );

        INSERT INTO @LineasDevolver (IDPedidoDetalle, CantidadDevolver)
        SELECT 
            JSON_VALUE(value, '$.idPedidoDetalle'),
            JSON_VALUE(value, '$.cantidad')
        FROM OPENJSON(@LineasJson);

        IF NOT EXISTS (SELECT 1 FROM @LineasDevolver)
        BEGIN
            THROW 50604, N'Debe especificar al menos una línea válida para devolver.', 1;
        END

        -- Validar que cada línea pertenezca al pedido y tenga cantidad suficiente para devolver
        DECLARE @MontoTotalDevolucion DECIMAL(14,2) = 0.00;
        DECLARE @IDAlmacen INT;
        SELECT TOP 1 @IDAlmacen = IDAlmacen FROM dbo.Almacen WHERE Codigo = 'PRINCIPAL';

        -- 3. Crear registro maestro de Devolución
        DECLARE @IDDevolucion BIGINT;

        INSERT INTO dbo.Devolucion (
            IDPedido,
            IDUsuarioSolicitante,
            IDUsuarioRevisor,
            Estado,
            Motivo,
            MontoAprobado,
            FechaSolicitud,
            FechaResolucion,
            ComentarioResolucion
        ) VALUES (
            @IDPedido,
            @IDUsuarioSolicitante,
            @IDUsuarioSolicitante,
            'COMPLETADA',
            @Motivo,
            0.00, -- Se actualizará tras sumar líneas
            SYSUTCDATETIME(),
            SYSUTCDATETIME(),
            N'Devolución aprobada y procesada'
        );

        SET @IDDevolucion = SCOPE_IDENTITY();

        -- 4. Iterar y procesar cada línea a devolver
        DECLARE @IDPedidoDetalleCur BIGINT;
        DECLARE @CantidadDevolverCur INT;
        DECLARE @IDVarianteCur INT;
        DECLARE @CantOriginal INT;
        DECLARE @CantYaDevuelta INT;
        DECLARE @TotalLineaOriginal DECIMAL(14,2);
        DECLARE @MontoLineaDevuelta DECIMAL(12,2);
        DECLARE @ExistenciaActual INT;

        DECLARE curDev CURSOR LOCAL FAST_FORWARD FOR
            SELECT IDPedidoDetalle, CantidadDevolver FROM @LineasDevolver;

        OPEN curDev;
        FETCH NEXT FROM curDev INTO @IDPedidoDetalleCur, @CantidadDevolverCur;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            IF @CantidadDevolverCur <= 0
            BEGIN
                CLOSE curDev;
                DEALLOCATE curDev;
                THROW 50605, N'La cantidad a devolver debe ser mayor a cero.', 1;
            END

            -- Bloquear línea de detalle
            SELECT 
                @IDVarianteCur = IDVariante,
                @CantOriginal = Cantidad,
                @CantYaDevuelta = CantidadDevuelta,
                @TotalLineaOriginal = TotalLinea
            FROM dbo.PedidoDetalle WITH (UPDLOCK, ROWLOCK)
            WHERE IDPedidoDetalle = @IDPedidoDetalleCur AND IDPedido = @IDPedido;

            IF @IDVarianteCur IS NULL
            BEGIN
                CLOSE curDev;
                DEALLOCATE curDev;
                THROW 50606, N'La línea de pedido especificada no pertenece a este pedido.', 1;
            END

            IF (@CantOriginal - @CantYaDevuelta) < @CantidadDevolverCur
            BEGIN
                CLOSE curDev;
                DEALLOCATE curDev;
                THROW 50607, N'La cantidad a devolver supera las unidades disponibles para devolución.', 1;
            END

            -- Cálculo del monto aprobado proporcional neto de la línea
            SET @MontoLineaDevuelta = CAST(ROUND((@TotalLineaOriginal / CAST(@CantOriginal AS DECIMAL(14,2))) * @CantidadDevolverCur, 2) AS DECIMAL(12,2));
            SET @MontoTotalDevolucion = @MontoTotalDevolucion + @MontoLineaDevuelta;

            -- Insertar detalle de devolución
            INSERT INTO dbo.DevolucionDetalle (
                IDDevolucion,
                IDPedido,
                IDPedidoDetalle,
                Cantidad,
                MontoAprobadoLinea
            ) VALUES (
                @IDDevolucion,
                @IDPedido,
                @IDPedidoDetalleCur,
                @CantidadDevolverCur,
                @MontoLineaDevuelta
            );

            -- Actualizar cantidad devuelta en PedidoDetalle
            UPDATE dbo.PedidoDetalle
            SET CantidadDevuelta = CantidadDevuelta + @CantidadDevolverCur
            WHERE IDPedidoDetalle = @IDPedidoDetalleCur;

            -- Reintegrar existencia física en Inventario y asentar en Kardex (DEVOLUCION: Cantidad > 0)
            SELECT @ExistenciaActual = Existencia
            FROM dbo.Inventario WITH (UPDLOCK, ROWLOCK)
            WHERE IDVariante = @IDVarianteCur AND IDAlmacen = @IDAlmacen;

            UPDATE dbo.Inventario
            SET Existencia = Existencia + @CantidadDevolverCur,
                FechaActualizacion = SYSUTCDATETIME()
            WHERE IDVariante = @IDVarianteCur AND IDAlmacen = @IDAlmacen;

            INSERT INTO dbo.MovimientoInventario (
                IDVariante,
                IDAlmacen,
                TipoMovimiento,
                Cantidad,
                ExistenciaAnterior,
                ExistenciaPosterior,
                IDPedido,
                IDUsuario,
                Motivo,
                FechaMovimiento
            ) VALUES (
                @IDVarianteCur,
                @IDAlmacen,
                'DEVOLUCION',
                @CantidadDevolverCur,
                @ExistenciaActual,
                @ExistenciaActual + @CantidadDevolverCur,
                @IDPedido,
                @IDUsuarioSolicitante,
                N'Devolución #' + CAST(@IDDevolucion AS VARCHAR(20)) + N' pedido ' + @NumeroPedido + N': ' + @Motivo,
                SYSUTCDATETIME()
            );

            FETCH NEXT FROM curDev INTO @IDPedidoDetalleCur, @CantidadDevolverCur;
        END

        CLOSE curDev;
        DEALLOCATE curDev;

        -- Actualizar MontoAprobado en Devolucion
        UPDATE dbo.Devolucion
        SET MontoAprobado = @MontoTotalDevolucion
        WHERE IDDevolucion = @IDDevolucion;

        -- 5. Determinar nuevo estado del pedido (DEVOLUCION_PARCIAL vs DEVOLUCION_TOTAL)
        DECLARE @TotalUnidadesPedidas INT;
        DECLARE @TotalUnidadesDevueltas INT;

        SELECT 
            @TotalUnidadesPedidas = SUM(Cantidad),
            @TotalUnidadesDevueltas = SUM(CantidadDevuelta)
        FROM dbo.PedidoDetalle
        WHERE IDPedido = @IDPedido;

        DECLARE @NuevoEstadoCodigo VARCHAR(30);
        DECLARE @IDNuevoEstado INT;

        IF @TotalUnidadesDevueltas >= @TotalUnidadesPedidas
        BEGIN
            SET @NuevoEstadoCodigo = 'DEVOLUCION_TOTAL';
            -- Si la devolución es total y usó cupón, revocar cupón
            IF @IDCupon IS NOT NULL
            BEGIN
                UPDATE dbo.UsoCupon SET EsVigente = 0 WHERE IDPedido = @IDPedido;
                UPDATE dbo.Cupon SET UsosActuales = CASE WHEN UsosActuales > 0 THEN UsosActuales - 1 ELSE 0 END WHERE IDCupon = @IDCupon;
            END
        END
        ELSE
        BEGIN
            SET @NuevoEstadoCodigo = 'DEVOLUCION_PARCIAL';
        END

        SELECT @IDNuevoEstado = IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = @NuevoEstadoCodigo;

        -- Actualizar estado del pedido si cambió
        IF @IDNuevoEstado <> @IDEstadoActual
        BEGIN
            UPDATE dbo.Pedido
            SET IDEstadoPedido = @IDNuevoEstado,
                FechaActualizacion = SYSUTCDATETIME()
            WHERE IDPedido = @IDPedido;

            INSERT INTO dbo.HistorialEstadoPedido (
                IDPedido,
                IDEstadoAnterior,
                IDEstadoNuevo,
                IDUsuario,
                MotivoComentario,
                FechaCambio
            ) VALUES (
                @IDPedido,
                @IDEstadoActual,
                @IDNuevoEstado,
                @IDUsuarioSolicitante,
                N'Transición por ' + @NuevoEstadoCodigo + N': ' + @Motivo,
                SYSUTCDATETIME()
            );
        END

        -- 6. Registrar Reembolso completado si hay pago asociado
        IF @IDPago IS NOT NULL AND @MontoTotalDevolucion > 0
        BEGIN
            DECLARE @ClaveReembolso VARCHAR(100) = 'REF-' + CAST(@IDDevolucion AS VARCHAR(20)) + '-' + CONVERT(VARCHAR(8), SYSUTCDATETIME(), 112);

            INSERT INTO dbo.Reembolso (
                IDPago,
                IDPedido,
                IDDevolucion,
                IDUsuarioSolicitante,
                ClaveIdempotencia,
                ReferenciaProveedor,
                Estado,
                Monto,
                Motivo,
                FechaSolicitud,
                FechaResolucion
            ) VALUES (
                @IDPago,
                @IDPedido,
                @IDDevolucion,
                @IDUsuarioSolicitante,
                @ClaveReembolso,
                N'REEMBOLSO_SIMULADO',
                'COMPLETADO',
                @MontoTotalDevolucion,
                @Motivo,
                SYSUTCDATETIME(),
                SYSUTCDATETIME()
            );
        END

        COMMIT TRANSACTION;

        SELECT 
            @IDDevolucion AS IDDevolucion,
            @IDPedido AS IDPedido,
            @NumeroPedido AS NumeroPedido,
            @MontoTotalDevolucion AS MontoReembolso,
            @NuevoEstadoCodigo AS EstadoPedidoActualizado,
            SYSUTCDATETIME() AS FechaResolucion;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* =========================================================================
   8. SP_Reservas_LiberarExpiradas
   Proceso en segundo plano para liberar reservas de 15 minutos vencidas .
   - Busca reservas en estado 'ACTIVA' con FechaExpiracion < SYSUTCDATETIME().
   - Restaura CantidadReservada en dbo.Inventario.
   - Pasa la reserva a 'EXPIRADA'.
   - Cancela el pedido asociado y asienta en HistorialEstadoPedido.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Reservas_LiberarExpiradas
    @BatchSize INT = 50
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @BatchSize = ISNULL(@BatchSize, 50);
    IF @BatchSize < 1 SET @BatchSize = 50;

    DECLARE @ReservasExpiradas TABLE (
        IDReserva BIGINT PRIMARY KEY,
        IDPedido BIGINT
    );

    -- Identificar reservas vencidas
    INSERT INTO @ReservasExpiradas (IDReserva, IDPedido)
    SELECT TOP (@BatchSize)
        r.IDReserva,
        r.IDPedido
    FROM dbo.ReservaInventario r WITH (UPDLOCK, READPAST)
    WHERE r.Estado = 'ACTIVA'
      AND r.FechaExpiracion < SYSUTCDATETIME()
    ORDER BY r.FechaExpiracion ASC;

    DECLARE @TotalLiberadas INT = 0;
    DECLARE @IDReservaCur BIGINT;
    DECLARE @IDPedidoCur BIGINT;

    DECLARE @IDEstadoCancelado INT;
    SELECT @IDEstadoCancelado = IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = 'CANCELADO';

    DECLARE @IDUsuarioSistema INT;
    SELECT TOP 1 @IDUsuarioSistema = u.IDUsuario 
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON u.IDRol = r.IDRol
    WHERE r.Nombre IN ('Administrador', 'Operador');

    IF @IDUsuarioSistema IS NULL SET @IDUsuarioSistema = 1;

    DECLARE curExp CURSOR LOCAL FAST_FORWARD FOR
        SELECT IDReserva, IDPedido FROM @ReservasExpiradas;

    OPEN curExp;
    FETCH NEXT FROM curExp INTO @IDReservaCur, @IDPedidoCur;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRANSACTION;
        BEGIN TRY
            -- 1. Restaurar CantidadReservada en Inventario
            UPDATE inv
            SET inv.CantidadReservada = CASE 
                    WHEN inv.CantidadReservada >= rd.Cantidad THEN inv.CantidadReservada - rd.Cantidad 
                    ELSE 0 
                END,
                inv.FechaActualizacion = SYSUTCDATETIME()
            FROM dbo.Inventario inv
            INNER JOIN dbo.ReservaInventarioDetalle rd ON inv.IDVariante = rd.IDVariante AND inv.IDAlmacen = rd.IDAlmacen
            WHERE rd.IDReserva = @IDReservaCur;

            -- 2. Marcar reserva como EXPIRADA
            UPDATE dbo.ReservaInventario
            SET Estado = 'EXPIRADA',
                FechaCierre = SYSUTCDATETIME()
            WHERE IDReserva = @IDReservaCur;

            -- 3. Cancelar pedido si sigue en PENDIENTE_PAGO
            DECLARE @EstadoActualPedido INT;
            SELECT @EstadoActualPedido = IDEstadoPedido
            FROM dbo.Pedido WITH (UPDLOCK)
            WHERE IDPedido = @IDPedidoCur;

            IF @EstadoActualPedido = (SELECT IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = 'PENDIENTE_PAGO')
            BEGIN
                UPDATE dbo.Pedido
                SET IDEstadoPedido = @IDEstadoCancelado,
                    FechaCancelacion = SYSUTCDATETIME(),
                    FechaActualizacion = SYSUTCDATETIME()
                WHERE IDPedido = @IDPedidoCur;

                INSERT INTO dbo.HistorialEstadoPedido (
                    IDPedido,
                    IDEstadoAnterior,
                    IDEstadoNuevo,
                    IDUsuario,
                    MotivoComentario,
                    FechaCambio
                ) VALUES (
                    @IDPedidoCur,
                    @EstadoActualPedido,
                    @IDEstadoCancelado,
                    @IDUsuarioSistema,
                    N'Reserva de 15 minutos vencida. Cancelación automática por sistema.',
                    SYSUTCDATETIME()
                );
            END

            COMMIT TRANSACTION;
            SET @TotalLiberadas = @TotalLiberadas + 1;
        END TRY
        BEGIN CATCH
            IF @@TRANCOUNT > 0
                ROLLBACK TRANSACTION;
        END CATCH;

        FETCH NEXT FROM curExp INTO @IDReservaCur, @IDPedidoCur;
    END

    CLOSE curExp;
    DEALLOCATE curExp;

    SELECT @TotalLiberadas AS ReservasLiberadas;
END;
GO
