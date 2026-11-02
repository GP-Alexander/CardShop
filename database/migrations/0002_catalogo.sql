/*
    ShopCart - 0002 Catálogo de productos, variantes y categorías
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ---------- Categorias ---------- */
CREATE TABLE dbo.Categoria (
    IDCategoria INT IDENTITY(1,1) CONSTRAINT PK_Categoria PRIMARY KEY,
    IDCategoriaPadre INT NULL,
    Nombre NVARCHAR(120) NOT NULL,
    Slug VARCHAR(140) NOT NULL,
    Descripcion NVARCHAR(500) NULL,
    EstaActiva BIT NOT NULL CONSTRAINT DF_Categoria_Activa DEFAULT (1),
    OrdenVisual INT NOT NULL CONSTRAINT DF_Categoria_Orden DEFAULT (0),
    FechaCreacion DATETIME2(3) NOT NULL CONSTRAINT DF_Categoria_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Categoria_Padre FOREIGN KEY (IDCategoriaPadre) REFERENCES dbo.Categoria(IDCategoria),
    CONSTRAINT UQ_Categoria_Nombre UNIQUE (Nombre),
    CONSTRAINT UQ_Categoria_Slug UNIQUE (Slug),
    -- Impide que una categoria sea padre de si misma. Ciclos mas largos (A -> B -> A) se validan en el SP.
    CONSTRAINT CK_Categoria_NoAutopadre CHECK (IDCategoriaPadre IS NULL OR IDCategoriaPadre <> IDCategoria),
    CONSTRAINT CK_Categoria_Orden CHECK (OrdenVisual >= 0)
);
GO
CREATE INDEX IX_Categoria_Padre ON dbo.Categoria(IDCategoriaPadre) WHERE IDCategoriaPadre IS NOT NULL;
GO

/* ---------- Productos ---------- */
CREATE TABLE dbo.Producto (
    IDProducto INT IDENTITY(1,1) CONSTRAINT PK_Producto PRIMARY KEY,
    IDCategoria INT NOT NULL,
    Nombre NVARCHAR(180) NOT NULL,
    Slug VARCHAR(200) NOT NULL,
    Descripcion NVARCHAR(MAX) NULL,
    Marca NVARCHAR(100) NULL,
    EstaActivo BIT NOT NULL CONSTRAINT DF_Producto_Activo DEFAULT (1),
    FechaCreacion DATETIME2(3) NOT NULL CONSTRAINT DF_Producto_Fecha DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3) NOT NULL CONSTRAINT DF_Producto_FechaAct DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Producto_Categoria FOREIGN KEY (IDCategoria) REFERENCES dbo.Categoria(IDCategoria),
    CONSTRAINT UQ_Producto_Slug UNIQUE (Slug)
);
GO
CREATE INDEX IX_Producto_CategoriaActivo ON dbo.Producto(IDCategoria, EstaActivo) INCLUDE (Nombre);
CREATE INDEX IX_Producto_Nombre ON dbo.Producto(Nombre, IDProducto);
GO

/* ---------- Atributos (Talla, Color, ...) ---------- */
CREATE TABLE dbo.Atributo (
    IDAtributo INT IDENTITY(1,1) CONSTRAINT PK_Atributo PRIMARY KEY,
    Nombre NVARCHAR(60) NOT NULL,
    EstaActivo BIT NOT NULL CONSTRAINT DF_Atributo_Activo DEFAULT (1),
    CONSTRAINT UQ_Atributo_Nombre UNIQUE (Nombre)
);
GO

/* ---------- Valores de atributo (S, M, L, Rojo, ...) ----------
   UQ_ValorAtributo_Compuesta es necesaria para la FK compuesta de VarianteAtributo. */
CREATE TABLE dbo.ValorAtributo (
    IDValorAtributo INT IDENTITY(1,1) CONSTRAINT PK_ValorAtributo PRIMARY KEY,
    IDAtributo INT NOT NULL,
    Valor NVARCHAR(80) NOT NULL,
    OrdenVisual INT NOT NULL CONSTRAINT DF_ValorAtributo_Orden DEFAULT (0),
    CONSTRAINT FK_ValorAtributo_Atributo FOREIGN KEY (IDAtributo) REFERENCES dbo.Atributo(IDAtributo),
    CONSTRAINT UQ_ValorAtributo_Par UNIQUE (IDAtributo, Valor),
    CONSTRAINT UQ_ValorAtributo_Compuesta UNIQUE (IDValorAtributo, IDAtributo),
    CONSTRAINT CK_ValorAtributo_Orden CHECK (OrdenVisual >= 0)
);
GO

/* ---------- Variantes (combinacion vendible con SKU, precio y existencia propios) ----------
   Precio incluye IVA 12 % en GTQ.
   UQ_Variante_Producto permite que ImagenProducto garantice el producto de la variante. */
CREATE TABLE dbo.VarianteProducto (
    IDVariante INT IDENTITY(1,1) CONSTRAINT PK_VarianteProducto PRIMARY KEY,
    IDProducto INT NOT NULL,
    SKU VARCHAR(80) NOT NULL,
    Precio DECIMAL(12,2) NOT NULL,
    Costo DECIMAL(12,2) NULL,
    PesoGramos INT NULL,
    EstaActiva BIT NOT NULL CONSTRAINT DF_Variante_Activa DEFAULT (1),
    FechaCreacion DATETIME2(3) NOT NULL CONSTRAINT DF_Variante_Fecha DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3) NOT NULL CONSTRAINT DF_Variante_FechaAct DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Variante_Producto FOREIGN KEY (IDProducto) REFERENCES dbo.Producto(IDProducto),
    CONSTRAINT UQ_Variante_SKU UNIQUE (SKU),
    CONSTRAINT UQ_Variante_Producto UNIQUE (IDVariante, IDProducto),
    CONSTRAINT CK_Variante_Precio CHECK (Precio > 0),
    CONSTRAINT CK_Variante_Costo CHECK (Costo IS NULL OR Costo >= 0),
    CONSTRAINT CK_Variante_Peso CHECK (PesoGramos IS NULL OR PesoGramos > 0)
);
GO
CREATE INDEX IX_Variante_ProductoActiva ON dbo.VarianteProducto(IDProducto, EstaActiva) INCLUDE (Precio, SKU);
GO

/* ---------- Atributos de cada variante ----------
   La PK (IDVariante, IDAtributo) impide dos valores para el mismo atributo en una variante.
   La FK compuesta impide asociar un valor de Color a un atributo Talla. */
CREATE TABLE dbo.VarianteAtributo (
    IDVariante INT NOT NULL,
    IDAtributo INT NOT NULL,
    IDValorAtributo INT NOT NULL,
    CONSTRAINT PK_VarianteAtributo PRIMARY KEY (IDVariante, IDAtributo),
    CONSTRAINT FK_VarAtr_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.VarianteProducto(IDVariante),
    CONSTRAINT FK_VarAtr_Valor FOREIGN KEY (IDValorAtributo, IDAtributo)
        REFERENCES dbo.ValorAtributo(IDValorAtributo, IDAtributo)
);
GO
CREATE INDEX IX_VarAtr_Valor ON dbo.VarianteAtributo(IDValorAtributo);
GO

/* ---------- Imagenes ----------
   IDVariante NULL: imagen del producto. Con IDVariante: imagen de esa variante.
   La FK compuesta (IDVariante, IDProducto) impide asociar una imagen a una variante de otro producto. */
CREATE TABLE dbo.ImagenProducto (
    IDImagenProducto INT IDENTITY(1,1) CONSTRAINT PK_ImagenProducto PRIMARY KEY,
    IDProducto INT NOT NULL,
    IDVariante INT NULL,
    URL NVARCHAR(1000) NOT NULL,
    OrdenVisual INT NOT NULL CONSTRAINT DF_Imagen_Orden DEFAULT (0),
    EsPrincipal BIT NOT NULL CONSTRAINT DF_Imagen_Principal DEFAULT (0),
    CONSTRAINT FK_Imagen_Producto FOREIGN KEY (IDProducto) REFERENCES dbo.Producto(IDProducto),
    CONSTRAINT FK_Imagen_Variante_Producto FOREIGN KEY (IDVariante, IDProducto)
        REFERENCES dbo.VarianteProducto(IDVariante, IDProducto),
    CONSTRAINT CK_Imagen_Orden CHECK (OrdenVisual >= 0)
);
GO
CREATE INDEX IX_Imagen_Producto ON dbo.ImagenProducto(IDProducto, OrdenVisual);
CREATE INDEX IX_Imagen_Variante ON dbo.ImagenProducto(IDVariante) WHERE IDVariante IS NOT NULL;
-- Una sola imagen principal por producto (las imagenes de variante no cuentan)
CREATE UNIQUE INDEX UX_Imagen_PrincipalProducto ON dbo.ImagenProducto(IDProducto)
    WHERE EsPrincipal = 1 AND IDVariante IS NULL;
GO
