/* =========================================================================
   ShopCart - SPs de Catálogos de Sistema (Roles y Permisos)
   ========================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =========================================================================
   1. SP_Catalogos_ListarRoles
   Retorna los roles del sistema con estadísticas de asignación.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogos_ListarRoles
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        r.IDRol,
        r.Nombre,
        r.Descripcion,
        r.EstaActivo,
        r.FechaCreacion,
        COUNT(u.IDUsuario) AS TotalUsuarios
    FROM dbo.Rol r
    LEFT JOIN dbo.Usuario u ON r.IDRol = u.IDRol
    GROUP BY r.IDRol, r.Nombre, r.Descripcion, r.EstaActivo, r.FechaCreacion
    ORDER BY r.IDRol ASC;
END;
GO

/* =========================================================================
   2. SP_Catalogos_ListarPermisos
   Retorna todos los permisos del sistema organizados por módulo.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogos_ListarPermisos
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        p.IDPermiso,
        p.Codigo,
        p.Modulo,
        p.Accion,
        p.Descripcion
    FROM dbo.Permiso p
    ORDER BY p.Modulo ASC, p.Codigo ASC;
END;
GO
