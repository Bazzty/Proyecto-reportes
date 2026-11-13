# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monorepo for an environmental reports mobile app. Users report pollution/waste with a photo and GPS location. The app shows a heatmap of reports by sector.

- `backend/` — Laravel 12 REST API with Sanctum authentication
- `frontend/` — React Native (Expo) mobile app
- `docs/` — API contract and database diagram

## Team

| Nombre | Rol | Responsabilidades |
|--------|-----|-------------------|
| **Bastian** | Líder + Backend | Arquitectura, revisión de PRs, Docker, estructura API |
| **Mathias** | Backend | Auth: register, login, logout, Sanctum |
| **Sebastian** | Backend | Migraciones, modelos, CRUD reportes, heatmap, seeder |
| **Alonso** | Frontend | Pantallas Login/Registro, navegación, token |
| **Catalina** | Frontend | MapScreen, marcadores, heatmap visual, detalle reporte |
| **Oskar** | Frontend | Formulario nuevo reporte, cámara, GPS, envío al backend |

## Architecture

The API is a pure JSON backend — no Blade views, no sessions. All endpoints live under `/api/*` and are protected via Sanctum token auth (Bearer token in `Authorization` header). The frontend is completely decoupled and communicates only through the documented API contract in `docs/API.md`.

Request flow: `React Native → Nginx (:8000) → PHP-FPM (app) → MySQL (db)`

## Backend (Laravel 12)

All work happens inside `backend/`. Every command must be run inside the `app` container:

```bash
docker compose exec app php artisan <command>
```

### First-time setup

```bash
cp backend/.env.example backend/.env
# Fill in DB_PASSWORD and DB_ROOT_PASSWORD in backend/.env
cd backend && docker compose up -d --build
docker compose exec app php artisan key:generate
docker compose exec app php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
docker compose exec app php artisan migrate
docker compose exec app php artisan storage:link
```

### Daily commands

```bash
# Start/stop
cd backend && docker compose up -d
cd backend && docker compose down

# Run migrations
docker compose exec app php artisan migrate

# Create a migration
docker compose exec app php artisan make:migration create_reports_table

# Create a model + migration + controller
docker compose exec app php artisan make:model Report -mc

# Run tests
docker compose exec app php artisan test

# Run a single test file
docker compose exec app php artisan test tests/Feature/AuthTest.php
```

### Administradores

El rol admin se asigna por consola a un usuario ya registrado (nunca desde la API):

```bash
docker compose exec app php artisan user:admin correo@ejemplo.cl            # otorgar
docker compose exec app php artisan user:admin correo@ejemplo.cl --revoke   # quitar
```

`php artisan db:seed` carga los datos de demo (usuarios con contraseña `password`) solo fuera de producción.

### URLs

| Service    | URL                       |
|------------|---------------------------|
| API        | http://localhost:8000     |
| phpMyAdmin | http://localhost:8080     |

### API routes

Routes are registered in `backend/routes/api.php`, already wired in `bootstrap/app.php`.

Protected routes use `middleware('auth:sanctum')`. Public routes are `register` and `login`.

### Database schema

| Table        | Key fields |
|--------------|------------|
| `users`      | id, name, email, password |
| `reports`    | id, user_id, category_id, description, latitude, longitude, photo_path, status (Pendiente/En Progreso/Resuelto) |
| `categories` | id, name (basura, escombros, aguas, otro) |
| `roles` | id, name (`user`, `admin`; únicos, sembrados en la migración) |
| `role_user` | user_id, role_id (PK compuesta; todo usuario nuevo recibe `user`) |

### Current state

Migraciones y modelos (`Report`, `Category`) ya están creados. El roadmap semanal original ya no aplica — el proyecto estuvo pausado y se retoma sin seguir esa planificación. Las tareas se priorizan por funcionalidad: auth → reportes → heatmap.

## Frontend (React Native Expo)

Work happens inside `frontend/`. Node.js must be installed locally — Expo does not run inside Docker.

```bash
cd frontend
npm install   # only needed after cloning — dependencies are in package.json
npx expo start
```

### Generar APK (Android) y actualizaciones automáticas

El proyecto usa Expo SDK 58 (requiere Node 22+) y está enlazado a EAS (`@bazztyy/frontend`). `eas.json` tiene el perfil `preview`, que genera un APK instalable en el canal `preview`.

`EXPO_PUBLIC_API_URL` del APK sale de `eas.json` (no de `.env`, que no se sube a EAS) y apunta al backend desplegado en Azure (`https://lagoenlinea.chilecentral.cloudapp.azure.com/api`, ver `docs/DEPLOY.md`). El mapa es Leaflet en un WebView, así que el APK no necesita API key de Google Maps.

Desarrollo: `npx expo start` usa el backend de `frontend/.env` (Docker local); `npm run start:azure` arranca Expo Go contra el servidor de Azure leyendo la URL de `eas.json`, sin editar `.env`.

```bash
cd frontend
npx eas-cli build -p android --profile preview   # entrega un link/QR para instalar el APK
```

Cambios solo de JavaScript llegan a los APK ya instalados sin reinstalar (`expo-updates`): la app los descarga al abrirse y los aplica en la siguiente apertura. La URL del backend se toma del entorno al publicar:

```bash
EXPO_PUBLIC_API_URL=https://<dominio>/api npx eas-cli update --channel preview --message "descripción"
```

Si cambia código nativo (paquetes con módulos nativos, `app.json`, versión de Expo) hay que subir `version` en `app.json` y compilar un APK nuevo.

En iPhone se usa Expo Go (SDK 58): `npx expo start` (o `--tunnel` fuera de la red local) y escanear el QR.

Structure: `frontend/src/screens/`, `frontend/src/components/`, `frontend/src/services/`. All API calls go through `src/services/api.js` (axios instance with Sanctum token support already configured).

## Git workflow

- `main` — stable, only via PR from `develop`
- `develop` — integration branch, only via PR from `feat/*`
- `feat/<name>` — daily work per developer

Every task needs an open GitHub Issue and a `feat/` branch before coding starts.

Commit format: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `style:`, `ci:` prefixes are required.

## CI (GitHub Actions)

Workflows en `.github/workflows/` se ejecutan en cada PR hacia `develop` y `main`. Para correr los mismos checks en local:

```bash
# Backend: tests y estilo
docker compose exec app php artisan test
docker compose exec app vendor/bin/pint --test      # sin --test aplica los arreglos

# BD: migraciones + seed desde cero
docker compose exec app php artisan migrate:fresh --seed

# Tests contra MySQL (BD aparte "reportes_test"; ejercita enum/decimal que SQLite no aplica). Desde backend/
bin/test-mysql.sh

# Auditoría de integridad de datos (falla con exit 1 si hay hallazgos). Desde backend/
docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" reportes_db' < database/audit.sql

# Frontend
cd frontend && npm ci && npm run lint && npm test
```

Protección de ramas (manual, requiere admin del repo, GitHub → Settings → Branches): `develop` y `main` con PR obligatorio, checks requeridos (`PHPUnit`, `Laravel Pint`, `Validación de BD`, `ESLint + Jest`, `Prefijos de commit`), sin push directo. `main` solo recibe PR desde `develop` (check `main solo recibe PR desde develop`).
