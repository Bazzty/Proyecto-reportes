-- Auditoría de integridad de datos (REP-59).
-- Cada chequeo cuenta filas problemáticas y debe dar 0. Si alguno da más de 0,
-- el script termina con error, de modo que CI y `mysql < audit.sql` fallen.
-- Solo usa una tabla temporal (no crea procedimientos ni deja nada en la BD).
--
-- Uso local:  docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" reportes_db' < database/audit.sql
--
-- No cubre que photo_path exista en disco: eso no se puede ver desde SQL.

DROP TEMPORARY TABLE IF EXISTS audit_findings;
CREATE TEMPORARY TABLE audit_findings (
    check_name VARCHAR(80) NOT NULL,
    rows_found INT NOT NULL
);

INSERT INTO audit_findings
SELECT 'reportes con user_id inexistente', COUNT(*)
FROM reports r LEFT JOIN users u ON u.id = r.user_id
WHERE u.id IS NULL;

INSERT INTO audit_findings
SELECT 'reportes con category_id inexistente', COUNT(*)
FROM reports r LEFT JOIN categories c ON c.id = r.category_id
WHERE c.id IS NULL;

INSERT INTO audit_findings
SELECT 'coordenadas nulas o fuera de rango', COUNT(*)
FROM reports
WHERE latitude IS NULL OR longitude IS NULL
   OR latitude NOT BETWEEN -90 AND 90
   OR longitude NOT BETWEEN -180 AND 180;

INSERT INTO audit_findings
SELECT 'estados fuera de dominio', COUNT(*)
FROM reports
WHERE status IS NULL
   OR status NOT IN ('Pendiente', 'En Progreso', 'Resuelto');

INSERT INTO audit_findings
SELECT 'emails duplicados', COUNT(*)
FROM (SELECT LOWER(email) FROM users GROUP BY LOWER(email) HAVING COUNT(*) > 1) d;

-- Los reportes del seeder (usuarios @demo.cl) no llevan foto a propósito.
INSERT INTO audit_findings
SELECT 'reportes sin foto (excluye @demo.cl)', COUNT(*)
FROM reports r JOIN users u ON u.id = r.user_id
WHERE (r.photo_path IS NULL OR r.photo_path = '')
  AND u.email NOT LIKE '%@demo.cl';

INSERT INTO audit_findings
SELECT 'usuarios sin ningún rol', COUNT(*)
FROM users u LEFT JOIN role_user ru ON ru.user_id = u.id
WHERE ru.user_id IS NULL;

INSERT INTO audit_findings
SELECT 'roles base faltantes (user, admin)', 2 - COUNT(*)
FROM roles WHERE name IN ('user', 'admin');

INSERT INTO audit_findings
SELECT 'categorías base faltantes (4)', 4 - COUNT(*)
FROM categories WHERE LOWER(name) IN ('basura', 'escombros', 'aguas', 'otro');

SELECT check_name, rows_found FROM audit_findings;

SELECT COALESCE(SUM(rows_found), 0) INTO @audit_total FROM audit_findings;
DROP TEMPORARY TABLE audit_findings;

-- Fuera de un procedimiento no hay SIGNAL: se fuerza el error consultando una tabla inexistente.
SET @audit_sql = IF(@audit_total > 0,
    'SELECT * FROM AUDITORIA_CON_HALLAZGOS__ver_tabla_anterior',
    'DO 0');
PREPARE audit_stmt FROM @audit_sql;
EXECUTE audit_stmt;
DEALLOCATE PREPARE audit_stmt;
