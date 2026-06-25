# Planning — App de Reportes Ambientales

Estado actual del proyecto por funcionalidad. Actualizar al completar cada ítem.

---

## Backend

### Setup e infraestructura
- [x] Docker con 4 contenedores corriendo (app, nginx, db, phpmyadmin)
- [x] Laravel respondiendo en `http://localhost:8000/up`
- [x] phpMyAdmin accesible en puerto 8080

### Base de datos
- [x] Migración `users` — Bastian
- [x] Migración `categories` — Sebastian
- [x] Migración `reports` — Sebastian
- [x] Modelo `User` con relación `hasMany(Report)` — Sebastian
- [x] Modelo `Category` con relación `hasMany(Report)` — Sebastian
- [x] Modelo `Report` con `belongsTo(User)` y `belongsTo(Category)` — Sebastian
- [ ] Seeder de categorías (`basura`, `escombros`, `aguas`, `otro`) — **Sebastian** ⚠️ bloqueante

### Auth (`/api`) — Mathias
- [x] `POST /api/register`
- [x] `POST /api/login` — devuelve token
- [x] `POST /api/logout` — invalida token
- [x] Rutas protegidas con `auth:sanctum`

### Reportes (`/api`) — Sebastian
- [x] `GET /api/reports` — lista todos los reportes
- [x] `POST /api/reports` — crea reporte con foto
- [x] `GET /api/reports/{id}` — detalle de un reporte
- [x] `GET /api/reports/heatmap` — puntos para el mapa de calor
- [x] `GET /api/user/reports` — reportes del usuario autenticado
- [ ] `GET /api/categories` — listar categorías disponibles — **Sebastian** ⚠️ bloqueante para Oskar

### Tests — Mathias / Sebastian
- [x] `AuthApiTest` — register, login, logout
- [x] `ReportApiTest` — store, index
- [ ] Test para `GET /api/user/reports` — **Sebastian**
- [ ] Test para `GET /api/reports/heatmap` — **Sebastian**

---

## Frontend

### Navegación y estructura — Alonso
- [x] Navegación configurada entre pantallas (Stack Navigator)
- [x] Pantalla de bienvenida / home

### Auth — Alonso
- [x] `LoginScreen` conectada al backend con token en AsyncStorage
- [x] `RegisterScreen` conectada al backend
- [x] Redirección al home tras login exitoso
- [x] Restaurar sesión al iniciar la app (token persistente)

### Nuevo reporte — Oskar
- [x] `NewReportScreen` con formulario
- [x] Acceso a cámara y galería (`expo-image-picker`)
- [x] Obtener ubicación GPS automática (`expo-location`)
- [x] Envío real de reporte con foto al backend
- [ ] Selector de categoría dinámico (consume `GET /api/categories`) — **Oskar** ⚠️ depende de Sebastian

### Mis reportes — Alonso / Oskar
- [x] `MyReportsScreen` — lista reportes del usuario autenticado

### Mapa y heatmap — Catalina
- [ ] `MapScreen` con `react-native-maps`
- [ ] Marcadores de todos los reportes en el mapa
- [ ] Capa de heatmap sobre el mapa
- [ ] Clic en marcador → pantalla de detalle del reporte

---

## QA y entrega

- [ ] Correr todos los tests y que pasen — **Mathias + Sebastian**
- [ ] Pruebas en dispositivo real (celular físico) — **Todo el equipo**
- [ ] Pulir UI/UX — **Alonso, Catalina, Oskar**
- [ ] APK de Android con EAS Build — **Bastian**

---

## Dependencias críticas

```
Sebastian: seeder + GET /api/categories
    ↓ desbloquea
Oskar: selector de categoría en NewReportScreen

Backend heatmap (ya existe)
    ↓ desbloquea
Catalina: MapScreen + heatmap visual
```
