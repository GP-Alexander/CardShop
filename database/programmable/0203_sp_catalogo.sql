/*
    ShopCart v3 - 0203 Procedimientos Almacenados: Catálogo de Productos y Categorías 
    
    Procedimientos incluidos:
      -- Categorías --
      1.  SP_Categoria_Crear
      2.  SP_Categoria_Listar
      3.  SP_Categoria_ObtenerPorId
      4.  SP_Categoria_Actualizar
      5.  SP_Categoria_CambiarEstado
      
      -- Atributos y Valores (Talla, Color, etc.) --
      6.  SP_Atributo_ListarConValores
      7.  SP_Atributo_Crear
      8.  SP_ValorAtributo_Crear
      
      -- Productos y Variantes --
      9.  SP_Producto_CrearConVariantes
      10. SP_Producto_ListarCatalogo
      11. SP_Producto_ObtenerDetalle
      12. SP_Producto_Actualizar
      13. SP_Producto_CambiarEstado
      14. SP_Variante_Actualizar
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =========================================================================
   1. SP_Categoria_Crear
   Crea una categoría verificando unicidad de nombre y slug, y registra en Bitácora.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Categoria_Crear
    @IDUsuarioAdmin INT,
    @Nombre NVARCHAR(120),
    @Slug VARCHAR(140) = NULL,
    @Descripcion NVARCHAR(500) = NULL,
    @IDCategoriaPadre INT = NULL,
    @OrdenVisual INT = 0,
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Nombre IS NULL OR LTRIM(RTRIM(@Nombre)) = ''
        THROW 50001, N'El nombre de la categoría es obligatorio.', 1;

    SET @Nombre = LTRIM(RTRIM(@Nombre));

    -- Generar slug si no se proporciona
    IF @Slug IS NULL OR LTRIM(RTRIM(@Slug)) = ''
    BEGIN
        SET @Slug = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(@Nombre, ' ', '-'), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'));
        SET @Slug = REPLACE(REPLACE(@Slug, 'ú', 'u'), 'ñ', 'n');
    END
    ELSE
    BEGIN
        SET @Slug = LOWER(LTRIM(RTRIM(@Slug)));
    END

    -- Validar unicidad
    IF EXISTS (SELECT 1 FROM dbo.Categoria WHERE Nombre = @Nombre)
        THROW 50109, N'Ya existe una categoría con ese nombre.', 1;

    IF EXISTS (SELECT 1 FROM dbo.Categoria WHERE Slug = @Slug)
        THROW 50109, N'El slug generado para la categoría ya se encuentra en uso.', 1;

    -- Validar categoría padre si se especifica
    IF @IDCategoriaPadre IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoriaPadre AND EstaActiva = 1)
            THROW 50104, N'La categoría padre especificada no existe o no se encuentra activa.', 1;
    END

    DECLARE @NuevaIDCategoria INT;
    DECLARE @ValorNuevoJson NVARCHAR(MAX);

    BEGIN TRANSACTION;

        INSERT INTO dbo.Categoria (
            IDCategoriaPadre,
            Nombre,
            Slug,
            Descripcion,
            EstaActiva,
            OrdenVisual,
            FechaCreacion
        )
        VALUES (
            @IDCategoriaPadre,
            @Nombre,
            @Slug,
            NULLIF(LTRIM(RTRIM(@Descripcion)), ''),
            1,
            ISNULL(@OrdenVisual, 0),
            SYSUTCDATETIME()
        );

        SET @NuevaIDCategoria = SCOPE_IDENTITY();

        -- Auditoría en Bitácora 
        SET @ValorNuevoJson = (
            SELECT 
                @NuevaIDCategoria AS idCategoria,
                @Nombre AS nombre,
                @Slug AS slug,
                @IDCategoriaPadre AS idCategoriaPadre
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );

        INSERT INTO dbo.RegistroBitacora (
            FechaEvento,
            IDUsuario,
            Modulo,
            Entidad,
            IDRegistro,
            Accion,
            ValorAnterior,
            ValorNuevo,
            DireccionIP
        )
        VALUES (
            SYSUTCDATETIME(),
            @IDUsuarioAdmin,
            'catalogo',
            'Categoria',
            CAST(@NuevaIDCategoria AS NVARCHAR(100)),
            'crear_categoria',
            NULL,
            @ValorNuevoJson,
            @DireccionIP
        );

    COMMIT TRANSACTION;

    SELECT 
        c.IDCategoria,
        c.IDCategoriaPadre,
        p.Nombre AS NombreCategoriaPadre,
        c.Nombre,
        c.Slug,
        c.Descripcion,
        c.EstaActiva,
        c.OrdenVisual,
        c.FechaCreacion,
        0 AS TotalProductos
    FROM dbo.Categoria c
    LEFT JOIN dbo.Categoria p ON c.IDCategoriaPadre = p.IDCategoria
    WHERE c.IDCategoria = @NuevaIDCategoria;
END;
GO

/* =========================================================================
   2. SP_Categoria_Listar
   Lista categorías con jerarquía, estado y conteo de productos asociados.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Categoria_Listar
    @SoloActivas BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        c.IDCategoria,
        c.IDCategoriaPadre,
        p.Nombre AS NombreCategoriaPadre,
        c.Nombre,
        c.Slug,
        c.Descripcion,
        c.EstaActiva,
        c.OrdenVisual,
        c.FechaCreacion,
        COUNT(prod.IDProducto) AS TotalProductos
    FROM dbo.Categoria c
    LEFT JOIN dbo.Categoria p ON c.IDCategoriaPadre = p.IDCategoria
    LEFT JOIN dbo.Producto prod ON c.IDCategoria = prod.IDCategoria AND prod.EstaActivo = 1
    WHERE (@SoloActivas = 0 OR c.EstaActiva = 1)
    GROUP BY 
        c.IDCategoria,
        c.IDCategoriaPadre,
        p.Nombre,
        c.Nombre,
        c.Slug,
        c.Descripcion,
        c.EstaActiva,
        c.OrdenVisual,
        c.FechaCreacion
    ORDER BY c.OrdenVisual ASC, c.Nombre ASC;
END;
GO

/* =========================================================================
   3. SP_Categoria_ObtenerPorId
   Obtiene el detalle completo de una categoría.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Categoria_ObtenerPorId
    @IDCategoria INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria)
        THROW 50104, N'La categoría solicitada no existe.', 1;

    SELECT 
        c.IDCategoria,
        c.IDCategoriaPadre,
        p.Nombre AS NombreCategoriaPadre,
        c.Nombre,
        c.Slug,
        c.Descripcion,
        c.EstaActiva,
        c.OrdenVisual,
        c.FechaCreacion,
        (SELECT COUNT(1) FROM dbo.Producto prod WHERE prod.IDCategoria = c.IDCategoria AND prod.EstaActivo = 1) AS TotalProductos
    FROM dbo.Categoria c
    LEFT JOIN dbo.Categoria p ON c.IDCategoriaPadre = p.IDCategoria
    WHERE c.IDCategoria = @IDCategoria;
END;
GO

/* =========================================================================
   4. SP_Categoria_Actualizar
   Actualiza una categoría con validación de ciclos jerárquicos y auditoría.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Categoria_Actualizar
    @IDUsuarioAdmin INT,
    @IDCategoria INT,
    @Nombre NVARCHAR(120),
    @Slug VARCHAR(140),
    @Descripcion NVARCHAR(500) = NULL,
    @IDCategoriaPadre INT = NULL,
    @OrdenVisual INT = 0,
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria)
        THROW 50104, N'La categoría a actualizar no existe.', 1;

    IF @Nombre IS NULL OR LTRIM(RTRIM(@Nombre)) = ''
        THROW 50001, N'El nombre de la categoría es obligatorio.', 1;

    SET @Nombre = LTRIM(RTRIM(@Nombre));
    SET @Slug = LOWER(LTRIM(RTRIM(@Slug)));

    -- Validar que no sea padre de sí misma
    IF @IDCategoriaPadre IS NOT NULL AND @IDCategoriaPadre = @IDCategoria
        THROW 50110, N'Una categoría no puede tenerse a sí misma como categoría padre.', 1;

    -- Validar duplicidad de nombre en otra categoría
    IF EXISTS (SELECT 1 FROM dbo.Categoria WHERE Nombre = @Nombre AND IDCategoria <> @IDCategoria)
        THROW 50109, N'Ya existe otra categoría con ese nombre.', 1;

    -- Validar duplicidad de slug en otra categoría
    IF EXISTS (SELECT 1 FROM dbo.Categoria WHERE Slug = @Slug AND IDCategoria <> @IDCategoria)
        THROW 50109, N'El slug especificado ya se encuentra en uso por otra categoría.', 1;

    DECLARE @ValorAnteriorJson NVARCHAR(MAX);
    DECLARE @ValorNuevoJson NVARCHAR(MAX);

    SET @ValorAnteriorJson = (
        SELECT IDCategoria, Nombre, Slug, Descripcion, IDCategoriaPadre, OrdenVisual
        FROM dbo.Categoria
        WHERE IDCategoria = @IDCategoria
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    BEGIN TRANSACTION;

        UPDATE dbo.Categoria
        SET 
            Nombre = @Nombre,
            Slug = @Slug,
            Descripcion = NULLIF(LTRIM(RTRIM(@Descripcion)), ''),
            IDCategoriaPadre = @IDCategoriaPadre,
            OrdenVisual = ISNULL(@OrdenVisual, 0)
        WHERE IDCategoria = @IDCategoria;

        SET @ValorNuevoJson = (
            SELECT 
                @IDCategoria AS idCategoria,
                @Nombre AS nombre,
                @Slug AS slug,
                @IDCategoriaPadre AS idCategoriaPadre
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );

        INSERT INTO dbo.RegistroBitacora (
            FechaEvento,
            IDUsuario,
            Modulo,
            Entidad,
            IDRegistro,
            Accion,
            ValorAnterior,
            ValorNuevo,
            DireccionIP
        )
        VALUES (
            SYSUTCDATETIME(),
            @IDUsuarioAdmin,
            'catalogo',
            'Categoria',
            CAST(@IDCategoria AS NVARCHAR(100)),
            'actualizar_categoria',
            @ValorAnteriorJson,
            @ValorNuevoJson,
            @DireccionIP
        );

    COMMIT TRANSACTION;

    EXEC dbo.SP_Categoria_ObtenerPorId @IDCategoria = @IDCategoria;
END;
GO

/* =========================================================================
   5. SP_Categoria_CambiarEstado
   Activa o desactiva una categoría (borrado lógico) registrando en bitácora.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Categoria_CambiarEstado
    @IDUsuarioAdmin INT,
    @IDCategoria INT,
    @EstaActiva BIT,
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria)
        THROW 50104, N'La categoría no existe.', 1;

    DECLARE @EstadoAnterior BIT = (SELECT EstaActiva FROM dbo.Categoria WHERE IDCategoria = @IDCategoria);
    IF @EstadoAnterior = @EstaActiva
    BEGIN
        EXEC dbo.SP_Categoria_ObtenerPorId @IDCategoria = @IDCategoria;
        RETURN;
    END

    BEGIN TRANSACTION;

        UPDATE dbo.Categoria
        SET EstaActiva = @EstaActiva
        WHERE IDCategoria = @IDCategoria;

        INSERT INTO dbo.RegistroBitacora (
            FechaEvento,
            IDUsuario,
            Modulo,
            Entidad,
            IDRegistro,
            Accion,
            ValorAnterior,
            ValorNuevo,
            DireccionIP
        )
        VALUES (
            SYSUTCDATETIME(),
            @IDUsuarioAdmin,
            'catalogo',
            'Categoria',
            CAST(@IDCategoria AS NVARCHAR(100)),
            IIF(@EstaActiva = 1, 'activar_categoria', 'desactivar_categoria'),
            CONCAT('{"estaActiva":', IIF(@EstadoAnterior = 1, 'true', 'false'), '}'),
            CONCAT('{"estaActiva":', IIF(@EstaActiva = 1, 'true', 'false'), '}'),
            @DireccionIP
        );

    COMMIT TRANSACTION;

    EXEC dbo.SP_Categoria_ObtenerPorId @IDCategoria = @IDCategoria;
END;
GO

/* =========================================================================
   6. SP_Atributo_ListarConValores
   Devuelve los atributos con sus valores para formularios de variantes.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Atributo_ListarConValores
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        a.IDAtributo,
        a.Nombre AS Atributo,
        a.EstaActivo,
        v.IDValorAtributo,
        v.Valor,
        v.OrdenVisual
    FROM dbo.Atributo a
    LEFT JOIN dbo.ValorAtributo v ON a.IDAtributo = v.IDAtributo
    WHERE a.EstaActivo = 1
    ORDER BY a.Nombre ASC, v.OrdenVisual ASC, v.Valor ASC;
END;
GO

/* =========================================================================
   7. SP_Atributo_Crear
   Crea un nuevo atributo si no existe.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Atributo_Crear
    @Nombre NVARCHAR(60)
AS
BEGIN
    SET NOCOUNT ON;

    IF @Nombre IS NULL OR LTRIM(RTRIM(@Nombre)) = ''
        THROW 50001, N'El nombre del atributo es obligatorio.', 1;

    SET @Nombre = LTRIM(RTRIM(@Nombre));

    IF EXISTS (SELECT 1 FROM dbo.Atributo WHERE Nombre = @Nombre)
    BEGIN
        SELECT IDAtributo, Nombre, EstaActivo FROM dbo.Atributo WHERE Nombre = @Nombre;
        RETURN;
    END

    INSERT INTO dbo.Atributo (Nombre, EstaActivo)
    VALUES (@Nombre, 1);

    SELECT IDAtributo, Nombre, EstaActivo
    FROM dbo.Atributo
    WHERE IDAtributo = SCOPE_IDENTITY();
END;
GO

/* =========================================================================
   8. SP_ValorAtributo_Crear
   Crea un valor de atributo.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_ValorAtributo_Crear
    @IDAtributo INT,
    @Valor NVARCHAR(80),
    @OrdenVisual INT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Atributo WHERE IDAtributo = @IDAtributo)
        THROW 50104, N'El atributo especificado no existe.', 1;

    IF @Valor IS NULL OR LTRIM(RTRIM(@Valor)) = ''
        THROW 50001, N'El valor de atributo es obligatorio.', 1;

    SET @Valor = LTRIM(RTRIM(@Valor));

    IF EXISTS (SELECT 1 FROM dbo.ValorAtributo WHERE IDAtributo = @IDAtributo AND Valor = @Valor)
    BEGIN
        SELECT IDValorAtributo, IDAtributo, Valor, OrdenVisual 
        FROM dbo.ValorAtributo 
        WHERE IDAtributo = @IDAtributo AND Valor = @Valor;
        RETURN;
    END

    INSERT INTO dbo.ValorAtributo (IDAtributo, Valor, OrdenVisual)
    VALUES (@IDAtributo, @Valor, ISNULL(@OrdenVisual, 0));

    SELECT IDValorAtributo, IDAtributo, Valor, OrdenVisual
    FROM dbo.ValorAtributo
    WHERE IDValorAtributo = SCOPE_IDENTITY();
END;
GO

/* =========================================================================
   9. SP_Producto_CrearConVariantes
   Crea atómicamente un producto con sus variantes vendibles y su galería de imágenes.
   Registra en bitácora .
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Producto_CrearConVariantes
    @IDUsuarioAdmin INT,
    @IDCategoria INT,
    @Nombre NVARCHAR(180),
    @Slug VARCHAR(200) = NULL,
    @Descripcion NVARCHAR(MAX) = NULL,
    @Marca NVARCHAR(100) = NULL,
    @VariantesJson NVARCHAR(MAX),
    @ImagenesJson NVARCHAR(MAX) = NULL,
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Nombre IS NULL OR LTRIM(RTRIM(@Nombre)) = ''
        THROW 50001, N'El nombre del producto es obligatorio.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria AND EstaActiva = 1)
        THROW 50104, N'La categoría asignada no existe o se encuentra inactiva.', 1;

    IF @VariantesJson IS NULL OR ISJSON(@VariantesJson) <> 1
        THROW 50001, N'Debe proporcionar al menos una variante en formato JSON válido.', 1;

    SET @Nombre = LTRIM(RTRIM(@Nombre));

    -- Generar slug
    IF @Slug IS NULL OR LTRIM(RTRIM(@Slug)) = ''
    BEGIN
        SET @Slug = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(@Nombre, ' ', '-'), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'));
        SET @Slug = REPLACE(REPLACE(@Slug, 'ú', 'u'), 'ñ', 'n');
    END
    ELSE
    BEGIN
        SET @Slug = LOWER(LTRIM(RTRIM(@Slug)));
    END

    IF EXISTS (SELECT 1 FROM dbo.Producto WHERE Slug = @Slug)
        THROW 50109, N'El slug especificado para el producto ya existe en el sistema.', 1;

    -- Validar que no haya SKUs duplicados en el JSON ni en la base de datos
    IF EXISTS (
        SELECT 1
        FROM OPENJSON(@VariantesJson) WITH (sku VARCHAR(80) '$.sku') j
        JOIN dbo.VarianteProducto v ON j.sku = v.SKU
    )
        THROW 50109, N'Uno o más SKUs enviados ya se encuentran registrados en el catálogo.', 1;

    DECLARE @NuevoIDProducto INT;

    BEGIN TRANSACTION;

        INSERT INTO dbo.Producto (
            IDCategoria,
            Nombre,
            Slug,
            Descripcion,
            Marca,
            EstaActivo,
            FechaCreacion,
            FechaActualizacion
        )
        VALUES (
            @IDCategoria,
            @Nombre,
            @Slug,
            NULLIF(LTRIM(RTRIM(@Descripcion)), ''),
            NULLIF(LTRIM(RTRIM(@Marca)), ''),
            1,
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
        );

        SET @NuevoIDProducto = SCOPE_IDENTITY();

        -- 1. Insertar Variantes
        -- Tabla temporal para mapear índice de variante con IDVariante generado
        DECLARE @VariantesGeneradas TABLE (
            IDVariante INT,
            SKU VARCHAR(80)
        );

        INSERT INTO dbo.VarianteProducto (
            IDProducto,
            SKU,
            Precio,
            Costo,
            PesoGramos,
            EstaActiva,
            FechaCreacion,
            FechaActualizacion
        )
        OUTPUT inserted.IDVariante, inserted.SKU INTO @VariantesGeneradas
        SELECT 
            @NuevoIDProducto,
            v.sku,
            v.precio,
            v.costo,
            v.pesoGramos,
            1,
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
        FROM OPENJSON(@VariantesJson)
        WITH (
            sku VARCHAR(80) '$.sku',
            precio DECIMAL(12,2) '$.precio',
            costo DECIMAL(12,2) '$.costo',
            pesoGramos INT '$.pesoGramos'
        ) v;

        -- 2. Insertar Atributos por Variante
        INSERT INTO dbo.VarianteAtributo (
            IDVariante,
            IDAtributo,
            IDValorAtributo
        )
        SELECT 
            vg.IDVariante,
            a.idAtributo,
            a.idValorAtributo
        FROM OPENJSON(@VariantesJson)
        WITH (
            sku VARCHAR(80) '$.sku',
            atributos NVARCHAR(MAX) '$.atributos' AS JSON
        ) j
        JOIN @VariantesGeneradas vg ON j.sku = vg.SKU
        CROSS APPLY OPENJSON(j.atributos)
        WITH (
            idAtributo INT '$.idAtributo',
            idValorAtributo INT '$.idValorAtributo'
        ) a;

        -- 3. Insertar Imágenes si se proporcionaron
        IF @ImagenesJson IS NOT NULL AND ISJSON(@ImagenesJson) = 1
        BEGIN
            INSERT INTO dbo.ImagenProducto (
                IDProducto,
                IDVariante,
                URL,
                OrdenVisual,
                EsPrincipal
            )
            SELECT 
                @NuevoIDProducto,
                vg.IDVariante,
                img.url,
                ISNULL(img.ordenVisual, 0),
                ISNULL(img.esPrincipal, 0)
            FROM OPENJSON(@ImagenesJson)
            WITH (
                url NVARCHAR(1000) '$.url',
                ordenVisual INT '$.ordenVisual',
                esPrincipal BIT '$.esPrincipal',
                skuVariante VARCHAR(80) '$.skuVariante'
            ) img
            LEFT JOIN @VariantesGeneradas vg ON img.skuVariante = vg.SKU;
        END

        -- 4. Registrar en Bitácora de Auditoría 
        DECLARE @ValorNuevoJson NVARCHAR(MAX) = (
            SELECT 
                @NuevoIDProducto AS idProducto,
                @Nombre AS nombre,
                @Slug AS slug,
                (SELECT COUNT(1) FROM @VariantesGeneradas) AS totalVariantes
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );

        INSERT INTO dbo.RegistroBitacora (
            FechaEvento,
            IDUsuario,
            Modulo,
            Entidad,
            IDRegistro,
            Accion,
            ValorAnterior,
            ValorNuevo,
            DireccionIP
        )
        VALUES (
            SYSUTCDATETIME(),
            @IDUsuarioAdmin,
            'catalogo',
            'Producto',
            CAST(@NuevoIDProducto AS NVARCHAR(100)),
            'crear_producto',
            NULL,
            @ValorNuevoJson,
            @DireccionIP
        );

    COMMIT TRANSACTION;

    EXEC dbo.SP_Producto_ObtenerDetalle @IDProducto = @NuevoIDProducto;
END;
GO

/* =========================================================================
   10. SP_Producto_ListarCatalogo
   Listado paginado de productos con filtros de búsqueda, categoría, precio,
   ordenamiento dinámico y agregación de precios mínimos/máximos de variantes.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Producto_ListarCatalogo
    @Pagina INT = 1,
    @Limite INT = 12,
    @Busqueda NVARCHAR(100) = NULL,
    @IDCategoria INT = NULL,
    @PrecioMin DECIMAL(12,2) = NULL,
    @PrecioMax DECIMAL(12,2) = NULL,
    @SoloActivos BIT = 1,
    @ColumnaOrden VARCHAR(30) = 'fechacreacion',
    @Orden VARCHAR(4) = 'DESC'
AS
BEGIN
    SET NOCOUNT ON;

    SET @Pagina = IIF(@Pagina < 1, 1, @Pagina);
    SET @Limite = IIF(@Limite < 1 OR @Limite > 100, 12, @Limite);
    SET @Busqueda = NULLIF(LTRIM(RTRIM(@Busqueda)), '');
    SET @ColumnaOrden = LOWER(ISNULL(@ColumnaOrden, 'fechacreacion'));
    SET @Orden = UPPER(ISNULL(@Orden, 'DESC'));
    IF @Orden NOT IN ('ASC', 'DESC') SET @Orden = 'DESC';

    DECLARE @Offset INT = (@Pagina - 1) * @Limite;

    -- CTE Base con filtros
    ;WITH ProductosFiltrados AS (
        SELECT 
            p.IDProducto,
            p.IDCategoria,
            c.Nombre AS CategoriaNombre,
            p.Nombre,
            p.Slug,
            p.Marca,
            p.EstaActivo,
            p.FechaCreacion,
            p.FechaActualizacion,
            MIN(v.Precio) AS PrecioMinimo,
            MAX(v.Precio) AS PrecioMaximo,
            COUNT(v.IDVariante) AS TotalVariantes,
            (
                SELECT TOP 1 img.URL 
                FROM dbo.ImagenProducto img 
                WHERE img.IDProducto = p.IDProducto 
                ORDER BY img.EsPrincipal DESC, img.OrdenVisual ASC
            ) AS ImagenPrincipalUrl
        FROM dbo.Producto p
        JOIN dbo.Categoria c ON p.IDCategoria = c.IDCategoria
        LEFT JOIN dbo.VarianteProducto v ON p.IDProducto = v.IDProducto AND (@SoloActivos = 0 OR v.EstaActiva = 1)
        WHERE (@SoloActivos = 0 OR p.EstaActivo = 1)
          AND (@IDCategoria IS NULL OR p.IDCategoria = @IDCategoria)
          AND (
              @Busqueda IS NULL 
              OR p.Nombre LIKE '%' + @Busqueda + '%'
              OR p.Marca LIKE '%' + @Busqueda + '%'
              OR EXISTS (SELECT 1 FROM dbo.VarianteProducto vsku WHERE vsku.IDProducto = p.IDProducto AND vsku.SKU LIKE '%' + @Busqueda + '%')
          )
        GROUP BY 
            p.IDProducto,
            p.IDCategoria,
            c.Nombre,
            p.Nombre,
            p.Slug,
            p.Marca,
            p.EstaActivo,
            p.FechaCreacion,
            p.FechaActualizacion
        HAVING (
            (@PrecioMin IS NULL OR MIN(v.Precio) >= @PrecioMin)
            AND (@PrecioMax IS NULL OR MAX(v.Precio) <= @PrecioMax)
        )
    ),
    TotalCuenta AS (
        SELECT COUNT(1) AS TotalRegistros FROM ProductosFiltrados
    )
    SELECT 
        pf.*,
        tc.TotalRegistros
    FROM ProductosFiltrados pf
    CROSS JOIN TotalCuenta tc
    ORDER BY
        CASE WHEN @ColumnaOrden = 'nombre' AND @Orden = 'ASC' THEN pf.Nombre END ASC,
        CASE WHEN @ColumnaOrden = 'nombre' AND @Orden = 'DESC' THEN pf.Nombre END DESC,
        CASE WHEN @ColumnaOrden = 'precio' AND @Orden = 'ASC' THEN pf.PrecioMinimo END ASC,
        CASE WHEN @ColumnaOrden = 'precio' AND @Orden = 'DESC' THEN pf.PrecioMinimo END DESC,
        CASE WHEN @ColumnaOrden = 'fechacreacion' AND @Orden = 'ASC' THEN pf.FechaCreacion END ASC,
        CASE WHEN @ColumnaOrden = 'fechacreacion' AND @Orden = 'DESC' THEN pf.FechaCreacion END DESC,
        pf.IDProducto DESC
    OFFSET @Offset ROWS
    FETCH NEXT @Limite ROWS ONLY;
END;
GO

/* =========================================================================
   11. SP_Producto_ObtenerDetalle
   Obtiene producto completo, con todas sus variantes, atributos y fotos.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Producto_ObtenerDetalle
    @IDProducto INT = NULL,
    @Slug VARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @IDProducto IS NULL AND @Slug IS NULL
        THROW 50001, N'Debe proporcionar el IDProducto o el Slug del producto.', 1;

    IF @IDProducto IS NULL
        SELECT @IDProducto = IDProducto FROM dbo.Producto WHERE Slug = @Slug;

    IF @IDProducto IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE IDProducto = @IDProducto)
        THROW 50104, N'El producto solicitado no fue encontrado.', 1;

    -- 1. Cabecera del producto
    SELECT 
        p.IDProducto,
        p.IDCategoria,
        c.Nombre AS CategoriaNombre,
        c.Slug AS CategoriaSlug,
        p.Nombre,
        p.Slug,
        p.Descripcion,
        p.Marca,
        p.EstaActivo,
        p.FechaCreacion,
        p.FechaActualizacion
    FROM dbo.Producto p
    JOIN dbo.Categoria c ON p.IDCategoria = c.IDCategoria
    WHERE p.IDProducto = @IDProducto;

    -- 2. Variantes con sus atributos en JSON agregados
    SELECT 
        v.IDVariante,
        v.IDProducto,
        v.SKU,
        v.Precio,
        v.Costo,
        v.PesoGramos,
        v.EstaActiva,
        v.FechaCreacion,
        v.FechaActualizacion,
        ISNULL((
            SELECT SUM(ISNULL(inv.Existencia, 0) - ISNULL(inv.CantidadReservada, 0))
            FROM dbo.Inventario inv
            WHERE inv.IDVariante = v.IDVariante
        ), 0) AS Existencia,
        (
            SELECT 
                a.IDAtributo,
                a.Nombre AS Atributo,
                va.IDValorAtributo,
                va.Valor
            FROM dbo.VarianteAtributo varAtr
            JOIN dbo.Atributo a ON varAtr.IDAtributo = a.IDAtributo
            JOIN dbo.ValorAtributo va ON varAtr.IDValorAtributo = va.IDValorAtributo
            WHERE varAtr.IDVariante = v.IDVariante
            FOR JSON PATH
        ) AS AtributosJson
    FROM dbo.VarianteProducto v
    WHERE v.IDProducto = @IDProducto
    ORDER BY v.IDVariante ASC;

    -- 3. Galería de Imágenes
    SELECT 
        IDImagenProducto,
        IDProducto,
        IDVariante,
        URL,
        OrdenVisual,
        EsPrincipal
    FROM dbo.ImagenProducto
    WHERE IDProducto = @IDProducto
    ORDER BY EsPrincipal DESC, OrdenVisual ASC;
END;
GO

/* =========================================================================
   12. SP_Producto_Actualizar
   Actualiza datos generales del producto registrando en bitácora .
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Producto_Actualizar
    @IDUsuarioAdmin INT,
    @IDProducto INT,
    @IDCategoria INT,
    @Nombre NVARCHAR(180),
    @Slug VARCHAR(200),
    @Descripcion NVARCHAR(MAX) = NULL,
    @Marca NVARCHAR(100) = NULL,
    @ImagenesJson NVARCHAR(MAX) = NULL,
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE IDProducto = @IDProducto)
        THROW 50104, N'El producto a actualizar no existe.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria AND EstaActiva = 1)
        THROW 50104, N'La categoría asignada no existe o se encuentra inactiva.', 1;

    SET @Nombre = LTRIM(RTRIM(@Nombre));
    SET @Slug = LOWER(LTRIM(RTRIM(@Slug)));

    IF EXISTS (SELECT 1 FROM dbo.Producto WHERE Slug = @Slug AND IDProducto <> @IDProducto)
        THROW 50109, N'El slug especificado ya se encuentra en uso por otro producto.', 1;

    DECLARE @ValorAnteriorJson NVARCHAR(MAX) = (
        SELECT IDProducto, IDCategoria, Nombre, Slug, Descripcion, Marca
        FROM dbo.Producto
        WHERE IDProducto = @IDProducto
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    BEGIN TRANSACTION;

        UPDATE dbo.Producto
        SET 
            IDCategoria = @IDCategoria,
            Nombre = @Nombre,
            Slug = @Slug,
            Descripcion = NULLIF(LTRIM(RTRIM(@Descripcion)), ''),
            Marca = NULLIF(LTRIM(RTRIM(@Marca)), ''),
            FechaActualizacion = SYSUTCDATETIME()
        WHERE IDProducto = @IDProducto;

        -- Actualizar imágenes si se proporcionaron
        IF @ImagenesJson IS NOT NULL AND ISJSON(@ImagenesJson) = 1
        BEGIN
            DELETE FROM dbo.ImagenProducto WHERE IDProducto = @IDProducto;
            INSERT INTO dbo.ImagenProducto (
                IDProducto,
                URL,
                OrdenVisual,
                EsPrincipal
            )
            SELECT 
                @IDProducto,
                img.url,
                ISNULL(img.ordenVisual, 0),
                ISNULL(img.esPrincipal, 0)
            FROM OPENJSON(@ImagenesJson)
            WITH (
                url NVARCHAR(1000) '$.url',
                ordenVisual INT '$.ordenVisual',
                esPrincipal BIT '$.esPrincipal'
            ) img;
        END

        DECLARE @ValorNuevoJson NVARCHAR(MAX) = (
            SELECT 
                @IDProducto AS idProducto,
                @IDCategoria AS idCategoria,
                @Nombre AS nombre,
                @Slug AS slug
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );

        INSERT INTO dbo.RegistroBitacora (
            FechaEvento,
            IDUsuario,
            Modulo,
            Entidad,
            IDRegistro,
            Accion,
            ValorAnterior,
            ValorNuevo,
            DireccionIP
        )
        VALUES (
            SYSUTCDATETIME(),
            @IDUsuarioAdmin,
            'catalogo',
            'Producto',
            CAST(@IDProducto AS NVARCHAR(100)),
            'actualizar_producto',
            @ValorAnteriorJson,
            @ValorNuevoJson,
            @DireccionIP
        );

    COMMIT TRANSACTION;

    EXEC dbo.SP_Producto_ObtenerDetalle @IDProducto = @IDProducto;
END;
GO

/* =========================================================================
   13. SP_Producto_CambiarEstado
   Desactiva o activa un producto (borrado lógico, no borrado físico ).
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Producto_CambiarEstado
    @IDUsuarioAdmin INT,
    @IDProducto INT,
    @EstaActivo BIT,
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE IDProducto = @IDProducto)
        THROW 50104, N'El producto no existe.', 1;

    DECLARE @EstadoAnterior BIT = (SELECT EstaActivo FROM dbo.Producto WHERE IDProducto = @IDProducto);
    IF @EstadoAnterior = @EstaActivo
    BEGIN
        EXEC dbo.SP_Producto_ObtenerDetalle @IDProducto = @IDProducto;
        RETURN;
    END

    BEGIN TRANSACTION;

        UPDATE dbo.Producto
        SET 
            EstaActivo = @EstaActivo,
            FechaActualizacion = SYSUTCDATETIME()
        WHERE IDProducto = @IDProducto;

        INSERT INTO dbo.RegistroBitacora (
            FechaEvento,
            IDUsuario,
            Modulo,
            Entidad,
            IDRegistro,
            Accion,
            ValorAnterior,
            ValorNuevo,
            DireccionIP
        )
        VALUES (
            SYSUTCDATETIME(),
            @IDUsuarioAdmin,
            'catalogo',
            'Producto',
            CAST(@IDProducto AS NVARCHAR(100)),
            IIF(@EstaActivo = 1, 'activar_producto', 'desactivar_producto'),
            CONCAT('{"estaActivo":', IIF(@EstadoAnterior = 1, 'true', 'false'), '}'),
            CONCAT('{"estaActivo":', IIF(@EstaActivo = 1, 'true', 'false'), '}'),
            @DireccionIP
        );

    COMMIT TRANSACTION;

    EXEC dbo.SP_Producto_ObtenerDetalle @IDProducto = @IDProducto;
END;
GO

/* =========================================================================
   14. SP_Variante_Actualizar
   Actualiza precio, costo, peso o estado de una variante.
   -- Criterio: el precio se actualiza para futuras ventas; los pedidos anteriores
   mantienen su precio congelado en PedidoDetalle.
   ========================================================================= */
CREATE OR ALTER PROCEDURE dbo.SP_Variante_Actualizar
    @IDUsuarioAdmin INT,
    @IDVariante INT,
    @Precio DECIMAL(12,2),
    @Costo DECIMAL(12,2) = NULL,
    @PesoGramos INT = NULL,
    @EstaActiva BIT = 1,
    @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.VarianteProducto WHERE IDVariante = @IDVariante)
        THROW 50104, N'La variante no existe.', 1;

    IF @Precio <= 0
        THROW 50001, N'El precio de la variante debe ser mayor a 0.', 1;

    DECLARE @ValorAnteriorJson NVARCHAR(MAX) = (
        SELECT IDVariante, SKU, Precio, Costo, PesoGramos, EstaActiva
        FROM dbo.VarianteProducto
        WHERE IDVariante = @IDVariante
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    BEGIN TRANSACTION;

        UPDATE dbo.VarianteProducto
        SET 
            Precio = @Precio,
            Costo = @Costo,
            PesoGramos = @PesoGramos,
            EstaActiva = @EstaActiva,
            FechaActualizacion = SYSUTCDATETIME()
        WHERE IDVariante = @IDVariante;

        DECLARE @ValorNuevoJson NVARCHAR(MAX) = (
            SELECT 
                @IDVariante AS idVariante,
                @Precio AS precio,
                @Costo AS costo,
                @EstaActiva AS estaActiva
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );

        INSERT INTO dbo.RegistroBitacora (
            FechaEvento,
            IDUsuario,
            Modulo,
            Entidad,
            IDRegistro,
            Accion,
            ValorAnterior,
            ValorNuevo,
            DireccionIP
        )
        VALUES (
            SYSUTCDATETIME(),
            @IDUsuarioAdmin,
            'catalogo',
            'VarianteProducto',
            CAST(@IDVariante AS NVARCHAR(100)),
            'actualizar_precio_variante',
            @ValorAnteriorJson,
            @ValorNuevoJson,
            @DireccionIP
        );

    COMMIT TRANSACTION;

    SELECT 
        v.IDVariante,
        v.IDProducto,
        v.SKU,
        v.Precio,
        v.Costo,
        v.PesoGramos,
        v.EstaActiva,
        v.FechaActualizacion
    FROM dbo.VarianteProducto v
    WHERE v.IDVariante = @IDVariante;
END;
GO
