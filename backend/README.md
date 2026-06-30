# Suralis — Backend

API REST construida con Laravel 12 y Sanctum. Ver el README raíz del monorepo para instrucciones de setup completo.

## Comandos útiles

```bash
# Migraciones
docker compose exec app php artisan migrate
docker compose exec app php artisan migrate:fresh --seed

# Crear archivos
docker compose exec app php artisan make:model NombreModelo -mc
docker compose exec app php artisan make:migration nombre_migracion

# Tests
docker compose exec app php artisan test

# Logs
docker compose exec app tail -f storage/logs/laravel.log
```

## Estructura

```
app/Http/Controllers/
  AuthController.php         ← register, login, logout
  ReportController.php       ← CRUD + heatmap + user reports
  CategoryController.php     ← listado de categorías
  ConfirmationController.php ← toggle "yo también lo vi"
  CommentController.php      ← comentarios por reporte

app/Models/
  User, Report, Category, Confirmation, Comment

routes/api.php               ← definición de todas las rutas
```
