# App de Reportes Ambientales

App móvil para reportar basura y problemas ambientales con foto y GPS. Incluye mapa de calor por densidad de reportes.

**Stack:** Laravel 12 (API) · React Native Expo (Mobile) · Docker · MySQL

---

## Requisitos

- [Docker](https://www.docker.com/) y Docker Compose
- [Node.js](https://nodejs.org/) (para el frontend)
- Git

---

## Levantar el Backend

```bash
# 1. Copiar el archivo de entorno y completar las contraseñas
cp backend/.env.example backend/.env

# 2. Abrir backend/.env y llenar estos campos:
#    DB_PASSWORD=
#    DB_ROOT_PASSWORD=

# 3. Construir y levantar los contenedores
cd backend
docker compose up -d --build

# 4. Generar la app key (solo la primera vez)
docker compose exec app php artisan key:generate

# 5. Publicar configuración de Sanctum (solo la primera vez)
docker compose exec app php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"

# 6. Correr las migraciones
docker compose exec app php artisan migrate
```

| Servicio    | URL                    |
|-------------|------------------------|
| API         | http://localhost:8000  |
| phpMyAdmin  | http://localhost:8080  |

---

## Levantar el Frontend

```bash
cd frontend
npm install
npx expo start
```

Escanea el QR con la app **Expo Go** en tu celular o presiona `a` para Android / `i` para iOS.

---

## Flujo de trabajo

```bash
# Siempre partir desde develop actualizado
git checkout develop
git pull origin develop

# Crear tu rama
git checkout -b feat/nombre-tarea

# Commits
git commit -m "feat: descripción"

# Subir y abrir PR hacia develop
git push origin feat/nombre-tarea
```

Prefijos de commits: `feat:` `fix:` `docs:` `chore:` `refactor:`
