#!/usr/bin/env sh
# Corre PHPUnit contra MySQL (BD "reportes_test"), para ejercitar enum/decimal que SQLite no aplica.
# Uso (desde backend/):  bin/test-mysql.sh [args de php artisan test]
set -e

# Crea la BD de pruebas y da permisos al usuario de la app (idempotente). Usa root dentro del contenedor.
docker compose exec -T db sh -c '
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" 2>/dev/null -e "
    CREATE DATABASE IF NOT EXISTS reportes_test;
    GRANT ALL PRIVILEGES ON reportes_test.* TO '"'"'$MYSQL_USER'"'"'@'"'"'%'"'"';"'

docker compose exec -T app php artisan test --configuration=phpunit.mysql.xml "$@"
