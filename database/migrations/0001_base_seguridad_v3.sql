/*
    ShopCart v3 - 0001 Base, seguridad, usuarios y bitacora
    Motor: SQL Server 2019+
    Este archivo reemplaza al 0001 de la v2. No ejecutar ambos.

    Cambios frente a v2:
      - Direccion tiene llave unica (IDDireccion, IDUsuario) para que Pedido pueda
        garantizar que la direccion pertenece al usuario (FK compuesta en 0005).
      - RegistroBitacora permite IDUsuario NULL para eventos automaticos.
      - El usuario del sistema se crea aqui, porque el kardex, el historial de estados
        y la bitacora lo necesitan desde la primera ejecucion (antes estaba en la semilla).
      - Permisos del Operador ajustados al enunciado.

    Convenciones:
      - Objetos y columnas en PascalCase; llaves IDNombre IDENTITY.
      - Montos DECIMAL; fechas DATETIME2(3) en UTC.
      - Cada archivo se ejecuta en una transaccion desde el runner. GO separa lotes.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ---------- Roles ---------- */
CREATE TABLE dbo.Rol (
    IDRol INT IDENTITY(1,1) CONSTRAINT PK_Rol PRIMARY KEY,
    Nombre NVARCHAR(50) NOT NULL,
    Descripcion NVARCHAR(250) NULL,
    EstaActivo BIT NOT NULL CONSTRAINT DF_Rol_EstaActivo DEFAULT (1),
    FechaCreacion DATETIME2(3) NOT NULL CONSTRAINT DF_Rol_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Rol_Nombre UNIQUE (Nombre)
);
GO

/* ---------- Permisos ---------- */
CREATE TABLE dbo.Permiso (
    IDPermiso INT IDENTITY(1,1) CONSTRAINT PK_Permiso PRIMARY KEY,
    Codigo VARCHAR(100) NOT NULL,
    Modulo VARCHAR(50) NOT NULL,
    Accion VARCHAR(50) NOT NULL,
    Descripcion NVARCHAR(250) NULL,
    CONSTRAINT UQ_Permiso_Codigo UNIQUE (Codigo),
    CONSTRAINT UQ_Permiso_ModuloAccion UNIQUE (Modulo, Accion)
);
GO

CREATE TABLE dbo.RolPermiso (
    IDRol INT NOT NULL,
    IDPermiso INT NOT NULL,
    CONSTRAINT PK_RolPermiso PRIMARY KEY (IDRol, IDPermiso),
    CONSTRAINT FK_RolPermiso_Rol FOREIGN KEY (IDRol) REFERENCES dbo.Rol(IDRol),
    CONSTRAINT FK_RolPermiso_Permiso FOREIGN KEY (IDPermiso) REFERENCES dbo.Permiso(IDPermiso)
);
GO
CREATE INDEX IX_RolPermiso_Permiso ON dbo.RolPermiso(IDPermiso);
GO

/* ---------- Usuarios ---------- */
CREATE TABLE dbo.Usuario (
    IDUsuario INT IDENTITY(1,1) CONSTRAINT PK_Usuario PRIMARY KEY,
    IDRol INT NOT NULL,
    Nombres NVARCHAR(100) NOT NULL,
    Apellidos NVARCHAR(100) NOT NULL,
    Correo NVARCHAR(254) NOT NULL,
    Telefono NVARCHAR(30) NULL,
    HashContrasena NVARCHAR(255) NOT NULL,       -- Argon2id generado en el backend
    EstaActivo BIT NOT NULL CONSTRAINT DF_Usuario_EstaActivo DEFAULT (1),
    FechaCreacion DATETIME2(3) NOT NULL CONSTRAINT DF_Usuario_Fecha DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3) NOT NULL CONSTRAINT DF_Usuario_FechaAct DEFAULT SYSUTCDATETIME(),
    UltimoAcceso DATETIME2(3) NULL,
    CONSTRAINT FK_Usuario_Rol FOREIGN KEY (IDRol) REFERENCES dbo.Rol(IDRol),
    CONSTRAINT UQ_Usuario_Correo UNIQUE (Correo),
    CONSTRAINT CK_Usuario_Correo CHECK (Correo LIKE N'_%@_%._%')
);
GO
CREATE INDEX IX_Usuario_RolActivo ON dbo.Usuario(IDRol, EstaActivo);
GO

/* ---------- Direcciones ----------
   La llave unica (IDDireccion, IDUsuario) permite que Pedido referencie
   la pareja y garantice que la direccion es del mismo usuario. */
CREATE TABLE dbo.Direccion (
    IDDireccion INT IDENTITY(1,1) CONSTRAINT PK_Direccion PRIMARY KEY,
    IDUsuario INT NOT NULL,
    Alias NVARCHAR(50) NULL,
    Destinatario NVARCHAR(150) NOT NULL,
    Telefono NVARCHAR(30) NOT NULL,
    Linea1 NVARCHAR(200) NOT NULL,
    Linea2 NVARCHAR(200) NULL,
    Departamento NVARCHAR(100) NOT NULL,
    Municipio NVARCHAR(100) NOT NULL,
    CodigoPostal NVARCHAR(20) NULL,
    Referencia NVARCHAR(250) NULL,
    EsPredeterminada BIT NOT NULL CONSTRAINT DF_Direccion_Predeterminada DEFAULT (0),
    EstaActiva BIT NOT NULL CONSTRAINT DF_Direccion_Activa DEFAULT (1),
    FechaCreacion DATETIME2(3) NOT NULL CONSTRAINT DF_Direccion_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Direccion_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario(IDUsuario),
    CONSTRAINT UQ_Direccion_Usuario UNIQUE (IDDireccion, IDUsuario)
);
GO
CREATE INDEX IX_Direccion_Usuario ON dbo.Direccion(IDUsuario, EstaActiva);
-- Una sola direccion predeterminada activa por usuario
CREATE UNIQUE INDEX UX_Direccion_PredeterminadaUsuario ON dbo.Direccion(IDUsuario)
    WHERE EsPredeterminada = 1 AND EstaActiva = 1;
GO

/* ---------- Sesiones con rotacion de refresh token ----------
   Solo se guarda el hash SHA-256 (CHAR(64)) del token.
   IDFamilia agrupa la cadena de rotaciones; si se detecta reuso, se revoca la familia. */
CREATE TABLE dbo.TokenSesion (
    IDTokenSesion BIGINT IDENTITY(1,1) CONSTRAINT PK_TokenSesion PRIMARY KEY,
    IDUsuario INT NOT NULL,
    IDFamilia UNIQUEIDENTIFIER NOT NULL,
    HashToken CHAR(64) NOT NULL,
    FechaCreacion DATETIME2(3) NOT NULL CONSTRAINT DF_TokenSesion_Fecha DEFAULT SYSUTCDATETIME(),
    FechaExpiracion DATETIME2(3) NOT NULL,
    FechaUso DATETIME2(3) NULL,
    FechaRevocacion DATETIME2(3) NULL,
    IDTokenReemplazo BIGINT NULL,
    DireccionIP VARCHAR(45) NULL,
    CONSTRAINT FK_TokenSesion_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario(IDUsuario),
    CONSTRAINT FK_TokenSesion_Reemplazo FOREIGN KEY (IDTokenReemplazo) REFERENCES dbo.TokenSesion(IDTokenSesion),
    CONSTRAINT UQ_TokenSesion_Hash UNIQUE (HashToken),
    CONSTRAINT CK_TokenSesion_Fechas CHECK (FechaExpiracion > FechaCreacion)
);
GO
CREATE INDEX IX_TokenSesion_Usuario ON dbo.TokenSesion(IDUsuario, FechaExpiracion);
CREATE INDEX IX_TokenSesion_Familia ON dbo.TokenSesion(IDFamilia);
CREATE INDEX IX_TokenSesion_Reemplazo ON dbo.TokenSesion(IDTokenReemplazo) WHERE IDTokenReemplazo IS NOT NULL;
GO

/* ---------- Bitacora (RF-09) ----------
   IDUsuario NULL para eventos automaticos (jobs, reservas vencidas). */
CREATE TABLE dbo.RegistroBitacora (
    IDBitacora BIGINT IDENTITY(1,1) CONSTRAINT PK_RegistroBitacora PRIMARY KEY,
    FechaEvento DATETIME2(3) NOT NULL CONSTRAINT DF_Bitacora_Fecha DEFAULT SYSUTCDATETIME(),
    IDUsuario INT NULL,
    Modulo VARCHAR(40) NOT NULL,
    Entidad VARCHAR(60) NOT NULL,
    IDRegistro NVARCHAR(100) NOT NULL,
    Accion VARCHAR(40) NOT NULL,
    ValorAnterior NVARCHAR(MAX) NULL,
    ValorNuevo NVARCHAR(MAX) NULL,
    DireccionIP VARCHAR(45) NULL,
    CorrelationId UNIQUEIDENTIFIER NULL,
    CONSTRAINT FK_Bitacora_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario(IDUsuario),
    CONSTRAINT CK_Bitacora_Anterior CHECK (ValorAnterior IS NULL OR ISJSON(ValorAnterior) = 1),
    CONSTRAINT CK_Bitacora_Nuevo CHECK (ValorNuevo IS NULL OR ISJSON(ValorNuevo) = 1)
);
GO
CREATE INDEX IX_Bitacora_Modulo ON dbo.RegistroBitacora(Modulo, Entidad, IDRegistro, FechaEvento);
CREATE INDEX IX_Bitacora_Usuario ON dbo.RegistroBitacora(IDUsuario) WHERE IDUsuario IS NOT NULL;
GO

-- La bitacora no se modifica ni elimina, ni siquiera con permisos elevados
CREATE OR ALTER TRIGGER dbo.TR_RegistroBitacora_Inmutable
ON dbo.RegistroBitacora
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50010, N'La bitacora es inmutable: no se permiten UPDATE ni DELETE.', 1;
END;
GO

/* ---------- Datos base: roles y permisos ---------- */
INSERT dbo.Rol (Nombre, Descripcion)
VALUES
(N'Cliente',        N'Compra productos y administra su propia informacion.'),
(N'Operador',       N'Prepara, despacha y gestiona pedidos e inventario.'),
(N'Administrador',  N'Administra catalogo, precios, cupones, usuarios y reportes.');
GO

INSERT dbo.Permiso (Codigo, Modulo, Accion, Descripcion)
VALUES
('catalog.read',      'catalogo',    'leer',         N'Consultar catalogo.'),
('catalog.manage',    'catalogo',    'administrar',  N'Crear y modificar productos, variantes y precios.'),
('promotions.manage', 'promociones', 'administrar',  N'Administrar promociones automaticas.'),
('coupons.read',      'cupones',     'leer',         N'Consultar cupones.'),
('coupons.manage',    'cupones',     'administrar',  N'Crear y administrar cupones.'),
('inventory.read',    'inventario',  'leer',         N'Consultar existencias y kardex.'),
('inventory.adjust',  'inventario',  'ajustar',      N'Registrar entradas, salidas y ajustes.'),
('cart.manage',       'carrito',     'administrar',  N'Gestionar el carrito propio.'),
('checkout.create',   'checkout',    'crear',        N'Crear pedidos y solicitar pago.'),
('orders.read.own',   'pedidos',     'leer_propios', N'Consultar pedidos propios.'),
('orders.manage',     'pedidos',     'administrar',  N'Preparar, despachar y cambiar estado de pedidos.'),
('refunds.manage',    'reembolsos',  'administrar',  N'Gestionar devoluciones y reembolsos.'),
('reports.read',      'reportes',    'leer',         N'Consultar dashboard e informes.'),
('users.manage',      'usuarios',    'administrar',  N'Administrar usuarios, roles y desactivaciones.'),
('audit.read',        'bitacora',    'leer',         N'Consultar la bitacora.');
GO

/* Cliente: solo lo propio.
   Operador: pedidos e inventario (segun el enunciado).
   Administrador: todo. La autorizacion por dueno del recurso se valida tambien en cada SP. */
INSERT dbo.RolPermiso (IDRol, IDPermiso)
SELECT r.IDRol, p.IDPermiso
FROM dbo.Rol AS r
JOIN dbo.Permiso AS p
  ON p.Codigo IN ('catalog.read', 'cart.manage', 'coupons.read', 'checkout.create', 'orders.read.own')
WHERE r.Nombre = N'Cliente';
GO

INSERT dbo.RolPermiso (IDRol, IDPermiso)
SELECT r.IDRol, p.IDPermiso
FROM dbo.Rol AS r
JOIN dbo.Permiso AS p
  ON p.Codigo IN ('catalog.read', 'inventory.read', 'inventory.adjust', 'orders.manage', 'refunds.manage')
WHERE r.Nombre = N'Operador';
GO

INSERT dbo.RolPermiso (IDRol, IDPermiso)
SELECT r.IDRol, p.IDPermiso
FROM dbo.Rol AS r
CROSS JOIN dbo.Permiso AS p
WHERE r.Nombre = N'Administrador';
GO

/* ---------- Usuario del sistema ----------
   Lo usan procesos automaticos (liberacion de reservas, conciliacion, kardex).
   EstaActivo = 0 y hash no valido: no puede iniciar sesion. */
INSERT dbo.Usuario (IDRol, Nombres, Apellidos, Correo, Telefono, HashContrasena, EstaActivo)
SELECT r.IDRol, N'Sistema', N'ShopCart', N'sistema@shopcart.local', NULL, N'DESHABILITADO', 0
FROM dbo.Rol AS r
WHERE r.Nombre = N'Administrador';
GO
