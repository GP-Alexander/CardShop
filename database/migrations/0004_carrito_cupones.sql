/*
    ShopCart - 0004 Carrito de compras, cupones y promociones
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ---------- Cupones ---------- */
CREATE TABLE dbo.Cupon (
    IDCupon INT IDENTITY(1,1) CONSTRAINT PK_Cupon PRIMARY KEY,
    Codigo VARCHAR(50) NOT NULL,
    Descripcion NVARCHAR(250) NULL,
    TipoDescuento VARCHAR(15) NOT NULL,              -- PORCENTAJE | MONTO
    ValorDescuento DECIMAL(12,2) NOT NULL,
    Alcance VARCHAR(15) NOT NULL CONSTRAINT DF_Cupon_Alcance DEFAULT ('CARRITO'),   -- CARRITO | CATEGORIA
    IDCategoria INT NULL,
    MontoMinimoCompra DECIMAL(12,2) NOT NULL CONSTRAINT DF_Cupon_Minimo DEFAULT (0),
    DescuentoMaximo DECIMAL(12,2) NULL,              -- tope para descuentos por porcentaje
    LimiteUsosTotal INT NULL,                        -- NULL = sin limite
    UsosActuales INT NOT NULL CONSTRAINT DF_Cupon_UsosActuales DEFAULT (0),
    LimiteUsosPorCliente INT NOT NULL CONSTRAINT DF_Cupon_UsosCliente DEFAULT (1),
    FechaInicio DATETIME2(3) NOT NULL,
    FechaFin DATETIME2(3) NOT NULL,
    EstaActivo BIT NOT NULL CONSTRAINT DF_Cupon_Activo DEFAULT (1),
    CreadoPor INT NULL,
    FechaCreacion DATETIME2(3) NOT NULL CONSTRAINT DF_Cupon_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Cupon_Codigo UNIQUE (Codigo),
    CONSTRAINT FK_Cupon_Categoria FOREIGN KEY (IDCategoria) REFERENCES dbo.Categoria(IDCategoria),
    CONSTRAINT FK_Cupon_Creador FOREIGN KEY (CreadoPor) REFERENCES dbo.Usuario(IDUsuario),
    CONSTRAINT CK_Cupon_Tipo CHECK (TipoDescuento IN ('PORCENTAJE', 'MONTO')),
    CONSTRAINT CK_Cupon_Alcance CHECK (Alcance IN ('CARRITO', 'CATEGORIA')),
    -- Un cupon de categoria necesita categoria; uno de carrito no puede tenerla
    CONSTRAINT CK_Cupon_AlcanceCategoria CHECK (
        (Alcance = 'CARRITO' AND IDCategoria IS NULL)
        OR (Alcance = 'CATEGORIA' AND IDCategoria IS NOT NULL)),
    CONSTRAINT CK_Cupon_Valor CHECK (
        ValorDescuento > 0
        AND (TipoDescuento <> 'PORCENTAJE' OR ValorDescuento <= 100)),
    CONSTRAINT CK_Cupon_Minimo CHECK (MontoMinimoCompra >= 0),
    CONSTRAINT CK_Cupon_DescuentoMaximo CHECK (DescuentoMaximo IS NULL OR DescuentoMaximo > 0),
    -- Ultima defensa contra exceso de usos: el SP incrementa con UPDATE condicional
    CONSTRAINT CK_Cupon_Usos CHECK (
        UsosActuales >= 0
        AND (LimiteUsosTotal IS NULL OR (LimiteUsosTotal > 0 AND UsosActuales <= LimiteUsosTotal))),
    CONSTRAINT CK_Cupon_UsosCliente CHECK (LimiteUsosPorCliente > 0),
    CONSTRAINT CK_Cupon_Fechas CHECK (FechaFin > FechaInicio)
);
GO
CREATE INDEX IX_Cupon_Categoria ON dbo.Cupon(IDCategoria) WHERE IDCategoria IS NOT NULL;
CREATE INDEX IX_Cupon_Creador ON dbo.Cupon(CreadoPor) WHERE CreadoPor IS NOT NULL;
GO

/* ---------- Carrito ----------
   Dueno unico: IDUsuario o TokenInvitadoHash, nunca ambos ni ninguno.
   Un solo carrito ACTIVO por usuario y por token de invitado. */
CREATE TABLE dbo.Carrito (
    IDCarrito BIGINT IDENTITY(1,1) CONSTRAINT PK_Carrito PRIMARY KEY,
    IDUsuario INT NULL,
    TokenInvitadoHash CHAR(64) NULL,                 -- SHA-256 del token de la cookie
    IDCupon INT NULL,
    Estado VARCHAR(20) NOT NULL CONSTRAINT DF_Carrito_Estado DEFAULT ('ACTIVO'),
    FechaCreacion DATETIME2(3) NOT NULL CONSTRAINT DF_Carrito_Fecha DEFAULT SYSUTCDATETIME(),
    FechaUltimaActividad DATETIME2(3) NOT NULL CONSTRAINT DF_Carrito_FechaAct DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Carrito_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario(IDUsuario),
    CONSTRAINT FK_Carrito_Cupon FOREIGN KEY (IDCupon) REFERENCES dbo.Cupon(IDCupon),
    CONSTRAINT CK_Carrito_Propietario CHECK (
        (IDUsuario IS NOT NULL AND TokenInvitadoHash IS NULL)
        OR (IDUsuario IS NULL AND TokenInvitadoHash IS NOT NULL)),
    CONSTRAINT CK_Carrito_Estado CHECK (Estado IN ('ACTIVO', 'CONVERTIDO', 'ABANDONADO'))
);
GO
CREATE UNIQUE INDEX UX_Carrito_ActivoUsuario ON dbo.Carrito(IDUsuario)
    WHERE Estado = 'ACTIVO' AND IDUsuario IS NOT NULL;
CREATE UNIQUE INDEX UX_Carrito_ActivoInvitado ON dbo.Carrito(TokenInvitadoHash)
    WHERE Estado = 'ACTIVO' AND TokenInvitadoHash IS NOT NULL;
-- Para el reporte de carritos abandonados 
CREATE INDEX IX_Carrito_Abandono ON dbo.Carrito(Estado, FechaUltimaActividad) WHERE Estado = 'ACTIVO';
CREATE INDEX IX_Carrito_Cupon ON dbo.Carrito(IDCupon) WHERE IDCupon IS NOT NULL;
GO

CREATE TABLE dbo.CarritoDetalle (
    IDCarrito BIGINT NOT NULL,
    IDVariante INT NOT NULL,
    Cantidad INT NOT NULL,
    FechaAgregado DATETIME2(3) NOT NULL CONSTRAINT DF_CarritoDet_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_CarritoDetalle PRIMARY KEY (IDCarrito, IDVariante),
    CONSTRAINT FK_CarritoDet_Carrito FOREIGN KEY (IDCarrito) REFERENCES dbo.Carrito(IDCarrito),
    CONSTRAINT FK_CarritoDet_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.VarianteProducto(IDVariante),
    CONSTRAINT CK_CarritoDet_Cantidad CHECK (Cantidad BETWEEN 1 AND 99)
);
GO
CREATE INDEX IX_CarritoDet_Variante ON dbo.CarritoDetalle(IDVariante);
GO

/* ---------- Promociones automaticas ----------
   Se aplican sin codigo. No se mezclan con cupones. */
CREATE TABLE dbo.Promocion (
    IDPromocion INT IDENTITY(1,1) CONSTRAINT PK_Promocion PRIMARY KEY,
    Nombre NVARCHAR(150) NOT NULL,
    Descripcion NVARCHAR(500) NULL,
    TipoDescuento VARCHAR(15) NOT NULL,              -- PORCENTAJE | MONTO
    ValorDescuento DECIMAL(12,2) NOT NULL,
    DescuentoMaximo DECIMAL(12,2) NULL,
    FechaInicio DATETIME2(3) NOT NULL,
    FechaFin DATETIME2(3) NOT NULL,
    Prioridad INT NOT NULL CONSTRAINT DF_Promocion_Prioridad DEFAULT (0),
    EsAcumulable BIT NOT NULL CONSTRAINT DF_Promocion_Acumulable DEFAULT (0),
    EstaActiva BIT NOT NULL CONSTRAINT DF_Promocion_Activa DEFAULT (1),
    CreadaPor INT NULL,
    FechaCreacion DATETIME2(3) NOT NULL CONSTRAINT DF_Promocion_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Promocion_Creador FOREIGN KEY (CreadaPor) REFERENCES dbo.Usuario(IDUsuario),
    CONSTRAINT CK_Promocion_Tipo CHECK (TipoDescuento IN ('PORCENTAJE', 'MONTO')),
    CONSTRAINT CK_Promocion_Valor CHECK (
        ValorDescuento > 0
        AND (TipoDescuento <> 'PORCENTAJE' OR ValorDescuento <= 100)),
    CONSTRAINT CK_Promocion_Maximo CHECK (DescuentoMaximo IS NULL OR DescuentoMaximo > 0),
    CONSTRAINT CK_Promocion_Fechas CHECK (FechaFin > FechaInicio),
    CONSTRAINT CK_Promocion_Prioridad CHECK (Prioridad >= 0)
);
GO
CREATE INDEX IX_Promocion_Vigencia ON dbo.Promocion(EstaActiva, FechaInicio, FechaFin, Prioridad);
CREATE INDEX IX_Promocion_Creador ON dbo.Promocion(CreadaPor) WHERE CreadaPor IS NOT NULL;
GO

CREATE TABLE dbo.PromocionProducto (
    IDPromocion INT NOT NULL,
    IDProducto INT NOT NULL,
    CONSTRAINT PK_PromocionProducto PRIMARY KEY (IDPromocion, IDProducto),
    CONSTRAINT FK_PromoProd_Promocion FOREIGN KEY (IDPromocion) REFERENCES dbo.Promocion(IDPromocion),
    CONSTRAINT FK_PromoProd_Producto FOREIGN KEY (IDProducto) REFERENCES dbo.Producto(IDProducto)
);
CREATE INDEX IX_PromoProd_Producto ON dbo.PromocionProducto(IDProducto);
GO

CREATE TABLE dbo.PromocionCategoria (
    IDPromocion INT NOT NULL,
    IDCategoria INT NOT NULL,
    CONSTRAINT PK_PromocionCategoria PRIMARY KEY (IDPromocion, IDCategoria),
    CONSTRAINT FK_PromoCat_Promocion FOREIGN KEY (IDPromocion) REFERENCES dbo.Promocion(IDPromocion),
    CONSTRAINT FK_PromoCat_Categoria FOREIGN KEY (IDCategoria) REFERENCES dbo.Categoria(IDCategoria)
);
CREATE INDEX IX_PromoCat_Categoria ON dbo.PromocionCategoria(IDCategoria);
GO
