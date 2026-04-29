# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monorepo for an environmental reports mobile app. Users report pollution/waste with a photo and GPS location. The app shows a heatmap of reports by sector.

- `backend/` — Laravel 12 REST API with Sanctum authentication
- `frontend/` — React Native (Expo) mobile app
- `docs/` — API contract and database diagram

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
| `reports`    | id, user_id, description, latitude, longitude, photo_url, status (pendiente/en revisión/resuelto) |
| `categories` | id, name (basura, escombros, aguas, otro) |

## Frontend (React Native Expo)

Work happens inside `frontend/`. Node.js must be installed locally — Expo does not run inside Docker.

```bash
cd frontend
npm install   # only needed after cloning — dependencies are in package.json
npx expo start
```

Structure: `frontend/src/screens/`, `frontend/src/components/`, `frontend/src/services/`. All API calls go through `src/services/api.js` (axios instance with Sanctum token support already configured).

## Git workflow

- `main` — stable, only via PR from `develop`
- `develop` — integration branch, only via PR from `feat/*`
- `feat/<name>` — daily work per developer

Every task needs an open GitHub Issue and a `feat/` branch before coding starts.

Commit format: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:` prefixes are required.
