# Lago en Línea — Sistema de Reportes Ambientales

App móvil para reportar incidencias ambientales (basura, escombros, contaminación) con foto y GPS. Incluye mapa interactivo con marcadores, filtros por categoría, confirmaciones de reportes entre usuarios y comentarios.

**Stack:** Laravel 12 · Sanctum · React Native Expo · Docker · MySQL

---

## Requisitos

- [Docker Desktop](https://www.docker.com/)
- [Node.js 18+](https://nodejs.org/)
- [Expo Go](https://expo.dev/client) en el dispositivo móvil

---

## Primer paso: Backend (Docker)

Para poder ejecutar la aplicacion, primero se debe levantar el servidor del backend.

```bash
# 1. Configurar entorno
cp backend/.env.example backend/.env
# Debes completar el DB_PASSWORD y DB_ROOT_PASSWORD en backend/.env con una contraseña.
# Puede ser cualquiera, solo deben estar y ser iguales
# Si surgiera algun error (ej: no anotaste la contraseña al levantar el servidor), para hacer que el cambio afecte, ejecuta estos dos:


# 2. Construir y levantar
cd backend
docker compose up -d --build

# 3. Primera vez
docker compose exec app composer install #Muy importante asegurarse de instalar las dependencias en el contenedor. Demora unos minutos.
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate
docker compose exec app php artisan storage:link

# 4. (Opcional) Datos de prueba
docker compose exec app php artisan db:seed
```

| Servicio | URL |
|----------|-----|
| API | http://localhost:8000/api |
| phpMyAdmin | http://localhost:8080 |

---

## Frontend (Expo)

Ahora, con el backend corriendo, hay que ejecutar la aplicación. Usaremos la aplicación movil Expo Go para probar y ejecutar cambios en tiempo real.
Expo Go nos permite verlo en nuestro telefono celular con solo escanear un qr y sincronizarse con nuestro entorno levantado.

```bash
cd frontend
```

Antes de instalar, recomendamos crear un archivo `.env` en la carpeta de frontend con la IP local de tu máquina:

```env
EXPO_PUBLIC_API_URL=http://192.168.X.X:8000/api
```

```bash
npm install
npx expo start
```

Escanear el QR con **Expo Go**. El dispositivo y la computadora deben estar en la misma red WiFi.

---
### 172.30.80.1
## Usuarios de prueba (seeder)

| Email | Contraseña |
|-------|------------|
| bastian@demo.cl | password |
| catalina@demo.cl | password |
| oskar@demo.cl | password |
| alonso@demo.cl | password |

---

## Funcionalidades

- Registro, login y logout con token Sanctum
- Modo invitado (solo lectura, sin registro)
- Mapa con marcadores coloreados por estado (Pendiente / En Progreso / Resuelto)
- Filtros por categoría (basura, escombros, aguas, otro)
- Heatmap de densidad en Android
- Crear reporte con foto (cámara o galería), GPS y categoría
- Mis Reportes con foto, estado y lightbox de imagen
- Detalle de reporte con botón "Yo también lo vi" y comentarios
- Polling automático cada 5 segundos para mantener el mapa actualizado

---

## Flujo Git

```
main ← develop ← feat/*
```

```bash
git checkout develop && git pull origin develop
git checkout -b feat/nombre-tarea
# ... commits ...
git push origin feat/nombre-tarea
# Abrir PR hacia develop
```

Prefijos: `feat:` `fix:` `docs:` `chore:` `refactor:`

---

## Equipo

| Nombre | Rol |
|--------|-----|
| Bastian Contreras | Líder + Backend |
| Mathias | Backend — Auth |
| Alonso | Frontend — Login/Registro |
| Catalina | Frontend — Mapa |
| Oskar | Frontend — Nuevo Reporte |
