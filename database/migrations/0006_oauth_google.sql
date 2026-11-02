/*
    ShopCart - 0006 Soporte para Autenticación OAuth (Google)
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

-- 1. Agregar columnas de proveedor OAuth a dbo.Usuario si no existen
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.Usuario') AND name = N'ProveedorOAuth'
)
BEGIN
    ALTER TABLE dbo.Usuario ADD ProveedorOAuth VARCHAR(30) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.Usuario') AND name = N'IdProveedorOAuth'
)
BEGIN
    ALTER TABLE dbo.Usuario ADD IdProveedorOAuth NVARCHAR(100) NULL;
END;
GO

-- 2. Crear índice filtrado para búsquedas rápidas por IdProveedorOAuth
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE object_id = OBJECT_ID(N'dbo.Usuario') AND name = N'IX_Usuario_ProveedorOAuth'
)
BEGIN
    CREATE INDEX IX_Usuario_ProveedorOAuth ON dbo.Usuario(ProveedorOAuth, IdProveedorOAuth) 
    WHERE ProveedorOAuth IS NOT NULL AND IdProveedorOAuth IS NOT NULL;
END;
GO

