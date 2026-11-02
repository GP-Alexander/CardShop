/*
    ShopCart - 0005 Pedidos, reservas, cupones, pagos, devoluciones y reembolsos
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ---------- Estados del pedido y transiciones permitidas ---------- */
CREATE TABLE dbo.EstadoPedido (
    IDEstadoPedido INT IDENTITY(1,1) CONSTRAINT PK_EstadoPedido PRIMARY KEY,
    Codigo VARCHAR(30) NOT NULL,
    Nombre NVARCHAR(60) NOT NULL,
    PermiteCancelacion BIT NOT NULL CONSTRAINT DF_EstadoPedido_Cancelable DEFAULT (0),
    EsFinal BIT NOT NULL CONSTRAINT DF_EstadoPedido_Final DEFAULT (0),
    CONSTRAINT UQ_EstadoPedido_Codigo UNIQUE (Codigo),
    CONSTRAINT UQ_EstadoPedido_Nombre UNIQUE (Nombre)
);
GO

CREATE TABLE dbo.TransicionEstadoPedido (
    IDEstadoOrigen INT NOT NULL,
    IDEstadoDestino INT NOT NULL,
    Descripcion NVARCHAR(200) NULL,
    CONSTRAINT PK_TransicionEstadoPedido PRIMARY KEY (IDEstadoOrigen, IDEstadoDestino),
    CONSTRAINT FK_Transicion_Origen FOREIGN KEY (IDEstadoOrigen) REFERENCES dbo.EstadoPedido(IDEstadoPedido),
    CONSTRAINT FK_Transicion_Destino FOREIGN KEY (IDEstadoDestino) REFERENCES dbo.EstadoPedido(IDEstadoPedido),
    CONSTRAINT CK_Transicion_Distinta CHECK (IDEstadoOrigen <> IDEstadoDestino)
);
GO

INSERT dbo.EstadoPedido (Codigo, Nombre, PermiteCancelacion, EsFinal)
VALUES
('PENDIENTE_PAGO',     N'Pendiente de pago',       1, 0),
('PAGADO',             N'Pagado',                  1, 0),
('PREPARANDO',         N'Preparando',              1, 0),
('DESPACHADO',         N'Despachado',              0, 0),
('ENTREGADO',          N'Entregado',               0, 0),
('CANCELADO',          N'Cancelado',               0, 1),
('DEVOLUCION_PARCIAL', N'Devolucion parcial',      0, 0),
('DEVOLUCION_TOTAL',   N'Devolucion total',        0, 1);
GO

-- Cancelar solo antes de DESPACHADO. Devolver solo desde ENTREGADO.
INSERT dbo.TransicionEstadoPedido (IDEstadoOrigen, IDEstadoDestino, Descripcion)
SELECT o.IDEstadoPedido, d.IDEstadoPedido, v.Descripcion
FROM (VALUES
    ('PENDIENTE_PAGO',     'PAGADO',             N'Pago confirmado'),
    ('PENDIENTE_PAGO',     'CANCELADO',          N'Reserva vencida o cancelacion antes de pagar'),
    ('PAGADO',             'PREPARANDO',         N'Operador inicia preparacion'),
    ('PAGADO',             'CANCELADO',          N'Cancelacion antes de despacho; reintegra kardex'),
    ('PREPARANDO',         'DESPACHADO',         N'Operador despacha el pedido'),
    ('PREPARANDO',         'CANCELADO',          N'Cancelacion durante preparacion; reintegra kardex'),
    ('DESPACHADO',         'ENTREGADO',          N'Entrega confirmada'),
    ('ENTREGADO',          'DEVOLUCION_PARCIAL', N'Devolucion parcial de lineas'),
    ('ENTREGADO',          'DEVOLUCION_TOTAL',   N'Devolucion total del pedido'),
    ('DEVOLUCION_PARCIAL', 'DEVOLUCION_TOTAL',   N'Devolucion del resto de unidades')
) AS v (CodigoOrigen, CodigoDestino, Descripcion)
JOIN dbo.EstadoPedido AS o ON o.Codigo = v.CodigoOrigen
JOIN dbo.EstadoPedido AS d ON d.Codigo = v.CodigoDestino;
GO

/* ---------- Pedido ---------- */
CREATE TABLE dbo.Pedido (
    IDPedido BIGINT IDENTITY(1,1) CONSTRAINT PK_Pedido PRIMARY KEY,
    NumeroPedido VARCHAR(30) NOT NULL,
    IDUsuario INT NOT NULL,
    IDCarrito BIGINT NULL,
    IDEstadoPedido INT NOT NULL,
    ClaveIdempotencia VARCHAR(100) NOT NULL,
    IDDireccionEnvio INT NOT NULL,
    IDCupon INT NULL,
    DestinatarioSnapshot NVARCHAR(150) NOT NULL,
    TelefonoSnapshot NVARCHAR(30) NOT NULL,
    DireccionSnapshot NVARCHAR(500) NOT NULL,
    Subtotal DECIMAL(14,2) NOT NULL,                 -- suma de ImporteBruto (antes de descuentos)
    Descuento DECIMAL(14,2) NOT NULL CONSTRAINT DF_Pedido_Descuento DEFAULT (0),   -- suma de DescuentoLinea
    CostoEnvio DECIMAL(14,2) NOT NULL CONSTRAINT DF_Pedido_Envio DEFAULT (0),
    Total DECIMAL(14,2) NOT NULL,                    -- Subtotal - Descuento + CostoEnvio
    IVAIncluido DECIMAL(14,2) NOT NULL,              -- informativo 
    PorcentajeIVA DECIMAL(5,2) NOT NULL CONSTRAINT DF_Pedido_PorcIVA DEFAULT (12.00),
    Moneda CHAR(3) NOT NULL CONSTRAINT DF_Pedido_Moneda DEFAULT ('GTQ'),
    FechaCreacion DATETIME2(3) NOT NULL CONSTRAINT DF_Pedido_Fecha DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3) NOT NULL CONSTRAINT DF_Pedido_FechaAct DEFAULT SYSUTCDATETIME(),
    FechaPago DATETIME2(3) NULL,                     -- fecha de reconocimiento de la venta (3.7)
    FechaEntrega DATETIME2(3) NULL,
    FechaCancelacion DATETIME2(3) NULL,
    CONSTRAINT UQ_Pedido_Numero UNIQUE (NumeroPedido),
    CONSTRAINT UQ_Pedido_Idempotencia UNIQUE (IDUsuario, ClaveIdempotencia),
    CONSTRAINT FK_Pedido_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario(IDUsuario),
    CONSTRAINT FK_Pedido_Carrito FOREIGN KEY (IDCarrito) REFERENCES dbo.Carrito(IDCarrito),
    CONSTRAINT FK_Pedido_Estado FOREIGN KEY (IDEstadoPedido) REFERENCES dbo.EstadoPedido(IDEstadoPedido),
    CONSTRAINT FK_Pedido_Direccion_Usuario FOREIGN KEY (IDDireccionEnvio, IDUsuario)
        REFERENCES dbo.Direccion(IDDireccion, IDUsuario),
    CONSTRAINT FK_Pedido_Cupon FOREIGN KEY (IDCupon) REFERENCES dbo.Cupon(IDCupon),
    CONSTRAINT CK_Pedido_Moneda CHECK (Moneda = 'GTQ'),
    CONSTRAINT CK_Pedido_PorcIVA CHECK (PorcentajeIVA >= 0 AND PorcentajeIVA <= 100),
    CONSTRAINT CK_Pedido_Subtotal CHECK (Subtotal >= 0),
    -- Un descuento nunca supera el subtotal, asi el total nunca queda negativo 
    CONSTRAINT CK_Pedido_Descuento CHECK (Descuento >= 0 AND Descuento <= Subtotal),
    CONSTRAINT CK_Pedido_Envio CHECK (CostoEnvio >= 0),
    CONSTRAINT CK_Pedido_Total CHECK (Total >= 0 AND Total = Subtotal - Descuento + CostoEnvio),
    CONSTRAINT CK_Pedido_IVA CHECK (IVAIncluido >= 0 AND IVAIncluido <= Total)
);
GO
CREATE INDEX IX_Pedido_UsuarioFecha ON dbo.Pedido(IDUsuario, FechaCreacion DESC) INCLUDE (Total, IDEstadoPedido);
CREATE INDEX IX_Pedido_EstadoFecha ON dbo.Pedido(IDEstadoPedido, FechaCreacion) INCLUDE (Subtotal, Descuento, Total);
CREATE INDEX IX_Pedido_PagoFecha ON dbo.Pedido(FechaPago) WHERE FechaPago IS NOT NULL;
CREATE INDEX IX_Pedido_Cupon ON dbo.Pedido(IDCupon) WHERE IDCupon IS NOT NULL;
CREATE INDEX IX_Pedido_Carrito ON dbo.Pedido(IDCarrito) WHERE IDCarrito IS NOT NULL;
GO

-- Ningun pedido se elimina fisicamente
CREATE OR ALTER TRIGGER dbo.TR_Pedido_NoEliminar
ON dbo.Pedido
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50021, N'Los pedidos no se eliminan; use cancelacion.', 1;
END;
GO

-- Cada cambio de estado debe estar permitido en TransicionEstadoPedido 
CREATE OR ALTER TRIGGER dbo.TR_Pedido_ValidarTransicion
ON dbo.Pedido
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(IDEstadoPedido) RETURN;

    IF EXISTS (
        SELECT 1
        FROM inserted AS i
        JOIN deleted AS d ON d.IDPedido = i.IDPedido
        WHERE i.IDEstadoPedido <> d.IDEstadoPedido
          AND NOT EXISTS (
              SELECT 1
              FROM dbo.TransicionEstadoPedido AS t
              WHERE t.IDEstadoOrigen = d.IDEstadoPedido
                AND t.IDEstadoDestino = i.IDEstadoPedido))
    BEGIN
        THROW 50020, N'Transicion de estado de pedido no permitida.', 1;
    END
END;
GO

/* ---------- Detalle del pedido (precio y datos congelados) ---------- */
CREATE TABLE dbo.PedidoDetalle (
    IDPedidoDetalle BIGINT IDENTITY(1,1) CONSTRAINT PK_PedidoDetalle PRIMARY KEY,
    IDPedido BIGINT NOT NULL,
    IDVariante INT NOT NULL,
    SKUSnapshot VARCHAR(80) NOT NULL,
    NombreProductoSnapshot NVARCHAR(180) NOT NULL,
    DescripcionVarianteSnapshot NVARCHAR(300) NOT NULL,
    PrecioUnitario DECIMAL(12,2) NOT NULL,           -- IVA incluido, congelado al comprar
    Cantidad INT NOT NULL,
    ImporteBruto DECIMAL(14,2) NOT NULL,             -- Cantidad * PrecioUnitario
    CantidadDevuelta INT NOT NULL CONSTRAINT DF_PedidoDet_Devuelta DEFAULT (0),
    DescuentoLinea DECIMAL(12,2) NOT NULL CONSTRAINT DF_PedidoDet_Descuento DEFAULT (0),
    TotalLinea DECIMAL(14,2) NOT NULL,               -- ImporteBruto - DescuentoLinea
    IVALinea DECIMAL(12,2) NOT NULL,                 -- ROUND(TotalLinea * 12 / 112, 2)
    CONSTRAINT UQ_PedidoDetalle_Linea UNIQUE (IDPedido, IDVariante),
    -- Llave para que DevolucionDetalle garantice que la linea pertenece al mismo pedido (3.3)
    CONSTRAINT UQ_PedidoDetalle_Pedido UNIQUE (IDPedidoDetalle, IDPedido),
    CONSTRAINT FK_PedidoDet_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido(IDPedido),
    CONSTRAINT FK_PedidoDet_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.VarianteProducto(IDVariante),
    CONSTRAINT CK_PedidoDet_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_PedidoDet_Precio CHECK (PrecioUnitario > 0),
    CONSTRAINT CK_PedidoDet_Bruto CHECK (ImporteBruto = Cantidad * PrecioUnitario),
    CONSTRAINT CK_PedidoDet_Devuelta CHECK (CantidadDevuelta >= 0 AND CantidadDevuelta <= Cantidad),
    CONSTRAINT CK_PedidoDet_Descuento CHECK (DescuentoLinea >= 0 AND DescuentoLinea <= ImporteBruto),
    CONSTRAINT CK_PedidoDet_Total CHECK (TotalLinea = ImporteBruto - DescuentoLinea),
    CONSTRAINT CK_PedidoDet_IVA CHECK (IVALinea >= 0 AND IVALinea <= TotalLinea)
);
GO
CREATE INDEX IX_PedidoDet_Variante ON dbo.PedidoDetalle(IDVariante);
GO

/* ---------- Historial de estados del pedido ---------- */
CREATE TABLE dbo.HistorialEstadoPedido (
    IDHistorialEstado BIGINT IDENTITY(1,1) CONSTRAINT PK_HistorialEstadoPedido PRIMARY KEY,
    IDPedido BIGINT NOT NULL,
    IDEstadoAnterior INT NULL,
    IDEstadoNuevo INT NOT NULL,
    IDUsuario INT NOT NULL,                          -- usuario del sistema en cambios automaticos
    MotivoComentario NVARCHAR(500) NULL,
    FechaCambio DATETIME2(3) NOT NULL CONSTRAINT DF_HistEstado_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_HistEstado_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido(IDPedido),
    CONSTRAINT FK_HistEstado_Anterior FOREIGN KEY (IDEstadoAnterior) REFERENCES dbo.EstadoPedido(IDEstadoPedido),
    CONSTRAINT FK_HistEstado_Nuevo FOREIGN KEY (IDEstadoNuevo) REFERENCES dbo.EstadoPedido(IDEstadoPedido),
    CONSTRAINT FK_HistEstado_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario(IDUsuario),
    CONSTRAINT CK_HistEstado_Cambio CHECK (IDEstadoAnterior IS NULL OR IDEstadoAnterior <> IDEstadoNuevo)
);
GO
CREATE INDEX IX_HistEstado_PedidoFecha ON dbo.HistorialEstadoPedido(IDPedido, FechaCambio DESC);
CREATE INDEX IX_HistEstado_Usuario ON dbo.HistorialEstadoPedido(IDUsuario);
GO

CREATE OR ALTER TRIGGER dbo.TR_HistorialEstadoPedido_Inmutable
ON dbo.HistorialEstadoPedido
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50022, N'El historial de estados es inmutable.', 1;
END;
GO

/* ---------- Reserva de existencia ---------- */
CREATE TABLE dbo.ReservaInventario (
    IDReserva BIGINT IDENTITY(1,1) CONSTRAINT PK_ReservaInventario PRIMARY KEY,
    IDPedido BIGINT NOT NULL,
    Estado VARCHAR(20) NOT NULL CONSTRAINT DF_Reserva_Estado DEFAULT ('ACTIVA'),
    FechaCreacion DATETIME2(3) NOT NULL CONSTRAINT DF_Reserva_Fecha DEFAULT SYSUTCDATETIME(),
    FechaExpiracion DATETIME2(3) NOT NULL,           -- FechaCreacion + 15 minutos
    FechaCierre DATETIME2(3) NULL,
    CONSTRAINT UQ_Reserva_Pedido UNIQUE (IDPedido),
    CONSTRAINT FK_Reserva_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido(IDPedido),
    CONSTRAINT CK_Reserva_Estado CHECK (Estado IN ('ACTIVA', 'CONSUMIDA', 'EXPIRADA', 'CANCELADA')),
    CONSTRAINT CK_Reserva_Fechas CHECK (FechaExpiracion > FechaCreacion),
    CONSTRAINT CK_Reserva_Cierre CHECK (
        (Estado = 'ACTIVA' AND FechaCierre IS NULL)
        OR (Estado <> 'ACTIVA' AND FechaCierre IS NOT NULL))
);
GO
-- Para el job de liberacion de reservas vencidas
CREATE INDEX IX_Reserva_Vencimiento ON dbo.ReservaInventario(FechaExpiracion) WHERE Estado = 'ACTIVA';
GO

CREATE TABLE dbo.ReservaInventarioDetalle (
    IDReserva BIGINT NOT NULL,
    IDVariante INT NOT NULL,
    IDAlmacen INT NOT NULL,
    Cantidad INT NOT NULL,
    CONSTRAINT PK_ReservaInventarioDetalle PRIMARY KEY (IDReserva, IDVariante, IDAlmacen),
    CONSTRAINT FK_ReservaDet_Reserva FOREIGN KEY (IDReserva) REFERENCES dbo.ReservaInventario(IDReserva),
    CONSTRAINT FK_ReservaDet_Inventario FOREIGN KEY (IDVariante, IDAlmacen)
        REFERENCES dbo.Inventario(IDVariante, IDAlmacen),
    CONSTRAINT CK_ReservaDet_Cantidad CHECK (Cantidad > 0)
);
GO

/* Ahora que existe Pedido, el kardex puede referenciarlo (creado en 0003) */
ALTER TABLE dbo.MovimientoInventario
    ADD CONSTRAINT FK_MovInv_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido(IDPedido);
GO

/* ---------- Uso de cupones ---------- */
CREATE TABLE dbo.UsoCupon (
    IDUsoCupon BIGINT IDENTITY(1,1) CONSTRAINT PK_UsoCupon PRIMARY KEY,
    IDCupon INT NOT NULL,
    IDUsuario INT NOT NULL,
    IDPedido BIGINT NOT NULL,
    MontoDescuento DECIMAL(12,2) NOT NULL,
    EsVigente BIT NOT NULL CONSTRAINT DF_UsoCupon_Vigente DEFAULT (1),
    FechaUso DATETIME2(3) NOT NULL CONSTRAINT DF_UsoCupon_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_UsoCupon_Pedido UNIQUE (IDPedido),
    CONSTRAINT FK_UsoCupon_Cupon FOREIGN KEY (IDCupon) REFERENCES dbo.Cupon(IDCupon),
    CONSTRAINT FK_UsoCupon_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario(IDUsuario),
    CONSTRAINT FK_UsoCupon_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido(IDPedido),
    CONSTRAINT CK_UsoCupon_Monto CHECK (MontoDescuento > 0)
);
GO
-- Para contar usos por cliente y por cupon (solo los vigentes)
CREATE INDEX IX_UsoCupon_CuponUsuario ON dbo.UsoCupon(IDCupon, IDUsuario) WHERE EsVigente = 1;
GO

/* ---------- Pagos ---------- */
CREATE TABLE dbo.Pago (
    IDPago BIGINT IDENTITY(1,1) CONSTRAINT PK_Pago PRIMARY KEY,
    IDPedido BIGINT NOT NULL,
    Proveedor VARCHAR(60) NOT NULL,
    ReferenciaProveedor NVARCHAR(150) NULL,
    ClaveIdempotencia VARCHAR(100) NOT NULL,
    Estado VARCHAR(25) NOT NULL,
    Monto DECIMAL(14,2) NOT NULL,
    Moneda CHAR(3) NOT NULL CONSTRAINT DF_Pago_Moneda DEFAULT ('GTQ'),
    FechaCreacion DATETIME2(3) NOT NULL CONSTRAINT DF_Pago_Fecha DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3) NOT NULL CONSTRAINT DF_Pago_FechaAct DEFAULT SYSUTCDATETIME(),
    FechaConfirmacion DATETIME2(3) NULL,
    RespuestaProveedor NVARCHAR(MAX) NULL,
    CONSTRAINT UQ_Pago_Idempotencia UNIQUE (ClaveIdempotencia),
    CONSTRAINT FK_Pago_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido(IDPedido),
    CONSTRAINT CK_Pago_Estado CHECK (Estado IN
        ('PENDIENTE', 'AUTORIZADO', 'CAPTURADO', 'RECHAZADO', 'REEMBOLSADO', 'PARCIALMENTE_REEMBOLSADO')),
    CONSTRAINT CK_Pago_Monto CHECK (Monto > 0),
    CONSTRAINT CK_Pago_Moneda CHECK (Moneda = 'GTQ'),
    CONSTRAINT CK_Pago_Respuesta CHECK (RespuestaProveedor IS NULL OR ISJSON(RespuestaProveedor) = 1)
);
GO
CREATE INDEX IX_Pago_Pedido ON dbo.Pago(IDPedido);
CREATE UNIQUE INDEX UX_Pago_PendientePedido ON dbo.Pago(IDPedido) WHERE Estado = 'PENDIENTE';
CREATE UNIQUE INDEX UX_Pago_AutorizadoPedido ON dbo.Pago(IDPedido) WHERE Estado = 'AUTORIZADO';
CREATE UNIQUE INDEX UX_Pago_CapturadoPedido ON dbo.Pago(IDPedido) WHERE Estado = 'CAPTURADO';
CREATE UNIQUE INDEX UX_Pago_ReferenciaProveedor ON dbo.Pago(Proveedor, ReferenciaProveedor)
    WHERE ReferenciaProveedor IS NOT NULL;
GO

/* ---------- Devoluciones ---------- */
CREATE TABLE dbo.Devolucion (
    IDDevolucion BIGINT IDENTITY(1,1) CONSTRAINT PK_Devolucion PRIMARY KEY,
    IDPedido BIGINT NOT NULL,
    IDUsuarioSolicitante INT NOT NULL,
    IDUsuarioRevisor INT NULL,
    Estado VARCHAR(20) NOT NULL CONSTRAINT DF_Devolucion_Estado DEFAULT ('SOLICITADA'),
    Motivo NVARCHAR(500) NOT NULL,
    MontoAprobado DECIMAL(14,2) NOT NULL CONSTRAINT DF_Devolucion_Monto DEFAULT (0),
    FechaSolicitud DATETIME2(3) NOT NULL CONSTRAINT DF_Devolucion_Fecha DEFAULT SYSUTCDATETIME(),
    FechaResolucion DATETIME2(3) NULL,
    ComentarioResolucion NVARCHAR(500) NULL,
    -- Llave para que Reembolso y DevolucionDetalle garanticen el mismo pedido (3.3)
    CONSTRAINT UQ_Devolucion_Pedido UNIQUE (IDDevolucion, IDPedido),
    CONSTRAINT FK_Devolucion_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido(IDPedido),
    CONSTRAINT FK_Devolucion_Solicitante FOREIGN KEY (IDUsuarioSolicitante) REFERENCES dbo.Usuario(IDUsuario),
    CONSTRAINT FK_Devolucion_Revisor FOREIGN KEY (IDUsuarioRevisor) REFERENCES dbo.Usuario(IDUsuario),
    CONSTRAINT CK_Devolucion_Estado CHECK (Estado IN
        ('SOLICITADA', 'APROBADA', 'RECHAZADA', 'COMPLETADA', 'CANCELADA')),
    CONSTRAINT CK_Devolucion_Monto CHECK (MontoAprobado >= 0)
);
GO
CREATE INDEX IX_Devolucion_Pedido ON dbo.Devolucion(IDPedido, FechaSolicitud DESC);
CREATE INDEX IX_Devolucion_Solicitante ON dbo.Devolucion(IDUsuarioSolicitante);
CREATE INDEX IX_Devolucion_Revisor ON dbo.Devolucion(IDUsuarioRevisor) WHERE IDUsuarioRevisor IS NOT NULL;
GO

/* ---------- Detalle de Devolución ---------- */
CREATE TABLE dbo.DevolucionDetalle (
    IDDevolucionDetalle BIGINT IDENTITY(1,1) CONSTRAINT PK_DevolucionDetalle PRIMARY KEY,
    IDDevolucion BIGINT NOT NULL,
    IDPedido BIGINT NOT NULL,
    IDPedidoDetalle BIGINT NOT NULL,
    Cantidad INT NOT NULL,
    MontoAprobadoLinea DECIMAL(12,2) NOT NULL,
    CONSTRAINT UQ_DevDet_Linea UNIQUE (IDDevolucion, IDPedidoDetalle),
    CONSTRAINT FK_DevDet_Devolucion FOREIGN KEY (IDDevolucion, IDPedido)
        REFERENCES dbo.Devolucion(IDDevolucion, IDPedido),
    CONSTRAINT FK_DevDet_PedidoDetalle FOREIGN KEY (IDPedidoDetalle, IDPedido)
        REFERENCES dbo.PedidoDetalle(IDPedidoDetalle, IDPedido),
    CONSTRAINT CK_DevDet_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_DevDet_Monto CHECK (MontoAprobadoLinea >= 0)
);
GO
CREATE INDEX IX_DevDet_PedidoDetalle ON dbo.DevolucionDetalle(IDPedidoDetalle);
GO

/* ---------- Reembolsos ---------- */
CREATE TABLE dbo.Reembolso (
    IDReembolso BIGINT IDENTITY(1,1) CONSTRAINT PK_Reembolso PRIMARY KEY,
    IDPago BIGINT NOT NULL,
    IDPedido BIGINT NOT NULL,
    IDDevolucion BIGINT NULL,
    IDUsuarioSolicitante INT NOT NULL,
    ClaveIdempotencia VARCHAR(100) NOT NULL,
    ReferenciaProveedor NVARCHAR(150) NULL,
    Estado VARCHAR(20) NOT NULL CONSTRAINT DF_Reembolso_Estado DEFAULT ('SOLICITADO'),
    Monto DECIMAL(14,2) NOT NULL,
    Motivo NVARCHAR(500) NOT NULL,
    FechaSolicitud DATETIME2(3) NOT NULL CONSTRAINT DF_Reembolso_Fecha DEFAULT SYSUTCDATETIME(),
    FechaResolucion DATETIME2(3) NULL,
    CONSTRAINT UQ_Reembolso_Idempotencia UNIQUE (ClaveIdempotencia),
    CONSTRAINT FK_Reembolso_Pago FOREIGN KEY (IDPago) REFERENCES dbo.Pago(IDPago),
    CONSTRAINT FK_Reembolso_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido(IDPedido),
    -- Si hay devolucion, debe ser del mismo pedido (FK omitida cuando IDDevolucion es NULL)
    CONSTRAINT FK_Reembolso_Devolucion FOREIGN KEY (IDDevolucion, IDPedido)
        REFERENCES dbo.Devolucion(IDDevolucion, IDPedido),
    CONSTRAINT FK_Reembolso_Solicitante FOREIGN KEY (IDUsuarioSolicitante) REFERENCES dbo.Usuario(IDUsuario),
    CONSTRAINT CK_Reembolso_Estado CHECK (Estado IN
        ('SOLICITADO', 'PROCESANDO', 'COMPLETADO', 'FALLIDO', 'RECHAZADO')),
    CONSTRAINT CK_Reembolso_Monto CHECK (Monto > 0)
);
GO
CREATE INDEX IX_Reembolso_Pedido ON dbo.Reembolso(IDPedido, FechaSolicitud DESC);
CREATE INDEX IX_Reembolso_Pago ON dbo.Reembolso(IDPago);
CREATE INDEX IX_Reembolso_Devolucion ON dbo.Reembolso(IDDevolucion) WHERE IDDevolucion IS NOT NULL;
CREATE INDEX IX_Reembolso_Solicitante ON dbo.Reembolso(IDUsuarioSolicitante);
GO
