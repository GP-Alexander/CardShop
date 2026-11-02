/*
    ShopCart - 0003 Control de inventario, almacenes y kardex
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ---------- Almacenes ---------- */
CREATE TABLE dbo.Almacen (
    IDAlmacen INT IDENTITY(1,1) CONSTRAINT PK_Almacen PRIMARY KEY,
    Codigo VARCHAR(30) NOT NULL,
    Nombre NVARCHAR(120) NOT NULL,
    Direccion NVARCHAR(300) NULL,
    EstaActivo BIT NOT NULL CONSTRAINT DF_Almacen_Activo DEFAULT (1),
    CONSTRAINT UQ_Almacen_Codigo UNIQUE (Codigo),
    CONSTRAINT UQ_Almacen_Nombre UNIQUE (Nombre)
);
GO

-- Almacen obligatorio: los procedimientos de reserva y venta lo buscan por este codigo
INSERT dbo.Almacen (Codigo, Nombre, Direccion)
VALUES ('PRINCIPAL', N'Almacen principal', N'Bodega central');
GO

/* ---------- Inventario (saldo por variante y almacen) ----------
   CHECK (CantidadReservada <= Existencia) es la ultima defensa contra sobreventa:
   aunque un procedimiento falle, la base no acepta reservar mas de lo disponible.
   UQ_Inventario_VarianteAlmacen permite que ReservaInventarioDetalle (0005) lo referencie. */
CREATE TABLE dbo.Inventario (
    IDInventario BIGINT IDENTITY(1,1) CONSTRAINT PK_Inventario PRIMARY KEY,
    IDVariante INT NOT NULL,
    IDAlmacen INT NOT NULL,
    Existencia INT NOT NULL CONSTRAINT DF_Inventario_Existencia DEFAULT (0),
    CantidadReservada INT NOT NULL CONSTRAINT DF_Inventario_Reservada DEFAULT (0),
    PuntoReorden INT NOT NULL CONSTRAINT DF_Inventario_Reorden DEFAULT (0),
    FechaActualizacion DATETIME2(3) NOT NULL CONSTRAINT DF_Inventario_Fecha DEFAULT SYSUTCDATETIME(),
    VersionFila ROWVERSION,
    CONSTRAINT FK_Inventario_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.VarianteProducto(IDVariante),
    CONSTRAINT FK_Inventario_Almacen FOREIGN KEY (IDAlmacen) REFERENCES dbo.Almacen(IDAlmacen),
    CONSTRAINT UQ_Inventario_VarianteAlmacen UNIQUE (IDVariante, IDAlmacen),
    CONSTRAINT CK_Inventario_Existencia CHECK (Existencia >= 0),
    CONSTRAINT CK_Inventario_Reservada CHECK (CantidadReservada >= 0 AND CantidadReservada <= Existencia),
    CONSTRAINT CK_Inventario_Reorden CHECK (PuntoReorden >= 0)
);
GO
CREATE INDEX IX_Inventario_Alerta ON dbo.Inventario(IDAlmacen, Existencia, PuntoReorden);
GO

/* ---------- Kardex (MovimientoInventario) ----------
   Registra solo movimientos fisicos: entradas, salidas por venta, ajustes, devoluciones y cancelaciones.
   - La cantidad lleva signo: positiva entra, negativa sale.
   - El tipo de movimiento define el signo (CHECK).
   - ExistenciaPosterior = ExistenciaAnterior + Cantidad (CHECK).
   - Toda salida, devolucion o cancelacion apunta a un pedido (CHECK).
   - IDUsuario y Motivo son obligatorios.
   - Es inmutable: un error se corrige con un movimiento nuevo. */
CREATE TABLE dbo.MovimientoInventario (
    IDMovimiento BIGINT IDENTITY(1,1) CONSTRAINT PK_MovimientoInventario PRIMARY KEY,
    IDVariante INT NOT NULL,
    IDAlmacen INT NOT NULL,
    TipoMovimiento VARCHAR(25) NOT NULL,
    Cantidad INT NOT NULL,
    ExistenciaAnterior INT NOT NULL,
    ExistenciaPosterior INT NOT NULL,
    IDPedido BIGINT NULL,                    -- FK hacia Pedido se agrega en 0005
    IDUsuario INT NOT NULL,
    Motivo NVARCHAR(300) NOT NULL,
    FechaMovimiento DATETIME2(3) NOT NULL CONSTRAINT DF_MovInv_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_MovInv_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.VarianteProducto(IDVariante),
    CONSTRAINT FK_MovInv_Almacen FOREIGN KEY (IDAlmacen) REFERENCES dbo.Almacen(IDAlmacen),
    CONSTRAINT FK_MovInv_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario(IDUsuario),
    CONSTRAINT CK_MovInv_Tipo CHECK (TipoMovimiento IN
        ('ENTRADA_COMPRA', 'SALIDA_VENTA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'DEVOLUCION', 'CANCELACION')),
    CONSTRAINT CK_MovInv_Signo CHECK (
        (TipoMovimiento IN ('ENTRADA_COMPRA', 'AJUSTE_POSITIVO', 'DEVOLUCION', 'CANCELACION') AND Cantidad > 0)
        OR (TipoMovimiento IN ('SALIDA_VENTA', 'AJUSTE_NEGATIVO') AND Cantidad < 0)),
    CONSTRAINT CK_MovInv_Saldos CHECK (
        ExistenciaAnterior >= 0
        AND ExistenciaPosterior >= 0
        AND ExistenciaPosterior = ExistenciaAnterior + Cantidad),
    CONSTRAINT CK_MovInv_Motivo CHECK (LEN(LTRIM(RTRIM(Motivo))) > 0),
    CONSTRAINT CK_MovInv_Pedido CHECK (
        IDPedido IS NOT NULL
        OR TipoMovimiento IN ('ENTRADA_COMPRA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'))
);
GO
CREATE INDEX IX_MovInv_VarianteAlmacenFecha ON dbo.MovimientoInventario(IDVariante, IDAlmacen, FechaMovimiento);
CREATE INDEX IX_MovInv_Pedido ON dbo.MovimientoInventario(IDPedido) WHERE IDPedido IS NOT NULL;
CREATE INDEX IX_MovInv_Usuario ON dbo.MovimientoInventario(IDUsuario);
GO

-- El kardex no se modifica ni elimina, ni siquiera con permisos elevados 
CREATE OR ALTER TRIGGER dbo.TR_MovimientoInventario_Inmutable
ON dbo.MovimientoInventario
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50011, N'El kardex es inmutable: corrija con un movimiento nuevo.', 1;
END;
GO
