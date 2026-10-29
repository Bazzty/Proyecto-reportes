# Contrato de API — App de Reportes Ambientales

Base URL: `http://localhost:8000/api`

Los tokens expiran a los 30 días (configurable con `SANCTUM_EXPIRATION`, en minutos); después hay que volver a iniciar sesión (401).

Los endpoints protegidos requieren este header en cada petición:
```
Authorization: Bearer {token}
```

---

## Autenticación

### Registrar usuario
```
POST /register
```
No requiere token.

**Request:**
```json
{
  "name": "Bastian Contreras",
  "email": "bastian@example.com",
  "password": "12345678",
  "password_confirmation": "12345678"
}
```

**Response 201:**
```json
{
  "user": {
    "id": 1,
    "name": "Bastian Contreras",
    "email": "bastian@example.com",
    "is_admin": false
  },
  "token": "1|abc123..."
}
```

**Response 422 — Validación fallida:**
```json
{
  "message": "The email has already been taken.",
  "errors": {
    "email": ["The email has already been taken."]
  }
}
```

**Response 429 — Demasiados intentos:** máximo 10 registros por minuto por IP.

---

### Iniciar sesión
```
POST /login
```
No requiere token.

**Request:**
```json
{
  "email": "bastian@example.com",
  "password": "12345678"
}
```

**Response 200:**
```json
{
  "user": {
    "id": 1,
    "name": "Bastian Contreras",
    "email": "bastian@example.com",
    "is_admin": false
  },
  "token": "2|xyz789..."
}
```

**Response 401 — Credenciales incorrectas:**
```json
{
  "message": "Credenciales incorrectas."
}
```

**Response 429 — Demasiados intentos:** máximo 5 intentos de login por minuto por combinación email + IP. Esperar el tiempo indicado en el header `Retry-After`.

---

### Cerrar sesión
```
POST /logout
```
Requiere token.

**Response 200:**
```json
{
  "message": "Sesión cerrada correctamente."
}
```

---

## Reportes

### Listar todos los reportes
```
GET /reports
```
No requiere token (si se envía, se calcula `confirmed_by_me`).

**Response 200:**
```json
[
  {
    "id": 1,
    "description": "Basura acumulada en la esquina",
    "latitude": -33.4569,
    "longitude": -70.6483,
    "photo_url": "http://localhost:8000/storage/photos/reporte_1.jpg",
    "status": "Pendiente",
    "category": {
      "id": 1,
      "name": "basura"
    },
    "user": {
      "id": 1,
      "name": "Bastian Contreras"
    },
    "confirmations_count": 2,
    "confirmed_by_me": false,
    "created_at": "2026-06-05T12:00:00Z"
  }
]
```

---

### Crear reporte
```
POST /reports
```
Requiere token. Se envía como `multipart/form-data` porque incluye una foto.

**Request (form-data):**
| Campo | Tipo | Requerido |
|---|---|---|
| description | string | Sí |
| latitude | number | Sí |
| longitude | number | Sí |
| category_id | integer | Sí |
| photo | file (jpg/png, max 5MB) | Sí |
| client_uuid | uuid | No |

> **Idempotencia:** si se repite el mismo `client_uuid` (p. ej. reintento de la cola offline), el endpoint devuelve **200** con el reporte original en lugar de crear otro distinto; no compara el resto del payload. Con un `client_uuid` nuevo responde **201**.

**Response 201:**
```json
{
  "id": 2,
  "description": "Escombros en la vereda",
  "latitude": -33.4580,
  "longitude": -70.6500,
  "photo_url": "http://localhost:8000/storage/photos/reporte_2.jpg",
  "status": "Pendiente",
  "category": {
    "id": 2,
    "name": "escombros"
  },
  "user": {
    "id": 1,
    "name": "Bastian Contreras"
  },
  "confirmations_count": 0,
  "confirmed_by_me": false,
  "created_at": "2026-06-05T12:05:00Z"
}
```

**Response 422 — Validación fallida:**
```json
{
  "message": "The photo field is required.",
  "errors": {
    "photo": ["The photo field is required."]
  }
}
```

---

### Ver detalle de un reporte
```
GET /reports/{id}
```
No requiere token (si se envía, se calcula `confirmed_by_me`).

**Response 200:**
```json
{
  "id": 1,
  "description": "Basura acumulada en la esquina",
  "latitude": -33.4569,
  "longitude": -70.6483,
  "photo_url": "http://localhost:8000/storage/photos/reporte_1.jpg",
  "status": "Pendiente",
  "category": {
    "id": 1,
    "name": "basura"
  },
  "user": {
    "id": 1,
    "name": "Bastian Contreras"
  },
  "confirmations_count": 2,
  "confirmed_by_me": false,
  "created_at": "2026-06-05T12:00:00Z"
}
```

**Response 404 — No encontrado:**
```json
{
  "message": "Reporte no encontrado."
}
```

---

### Puntos del mapa de calor (con su zona)
```
GET /reports/heatmap
```
No requiere token. Devuelve **un punto por reporte** (`latitude`, `longitude`) junto con su `zone` (`{ id, name }`, o `null` si el reporte no cae en ninguna zona). No agrupa: se mantiene la densidad y la agrupación visual por zona, si se necesita, la resuelve el cliente.

**Response 200:**
```json
[
  { "latitude": -41.3198, "longitude": -72.9833, "zone": { "id": 1, "name": "Puerto Varas" } },
  { "latitude": -41.2030, "longitude": -72.5700, "zone": { "id": 7, "name": "Ensenada" } },
  { "latitude": -33.4569, "longitude": -70.6483, "zone": null }
]
```
> Para asignar `zone` a los reportes ya existentes, ejecutá una vez tras el deploy: `php artisan db:seed --class=ZoneSeeder` (carga las zonas) y luego `php artisan zones:assign` (backfill).

---

### Reportes del usuario autenticado
```
GET /user/reports
```
Requiere token. Devuelve solo los reportes del usuario que hace la petición.

**Response 200:**
```json
[
  {
    "id": 2,
    "description": "Escombros en la vereda",
    "latitude": -33.4580,
    "longitude": -70.6500,
    "photo_url": "http://localhost:8000/storage/photos/reporte_2.jpg",
    "status": "Pendiente",
    "category": {
      "id": 2,
      "name": "escombros"
    },
    "created_at": "2026-06-05T12:05:00Z"
  }
]
```

---

### Actualizar estado de un reporte (solo administradores)
```
PATCH /reports/{id}/status
```
Requiere token de un **usuario administrador** (investigadores de "Más Azul"). Un usuario normal recibe `403`.

**Request:**
```json
{ "status": "En Progreso" }
```
`status`: uno de `Pendiente`, `En Progreso`, `Resuelto`.

**Response 200:** mismo formato que el detalle de un reporte, con el `status` actualizado.

**Response 403:** el usuario no es administrador.

---

### Panel de administración — listar reportes
```
GET /admin/reports
```
Requiere token de **administrador**. Lista los reportes paginados (20 por página), incluyendo `validation_status`, `zone` y el validador. Filtros opcionales por query string: `validation_status` (`pendiente`|`valido`|`rechazado`), `zone_id`, `category_id`.

**Response 200:**
```json
{
  "data": [
    { "id": 1, "validation_status": "pendiente", "zone": { "id": 5, "name": "Puerto Varas" } }
  ],
  "meta": { "current_page": 1, "last_page": 1, "per_page": 20, "total": 21 }
}
```

---

### Panel de administración — validar / rechazar un reporte
```
PATCH /admin/reports/{id}/validation
```
Requiere token de **administrador**.

**Request (validar):**
```json
{ "validation_status": "valido" }
```
**Request (rechazar):**
```json
{ "validation_status": "rechazado", "rejection_reason": "No corresponde a contaminación." }
```
`rejection_reason` es obligatorio al rechazar.

**Response 200:** el reporte actualizado (incluye `validation_status`, `rejection_reason`, `validated_at` y `validated_by`).

> **Visibilidad:** los reportes con `validation_status = "pendiente"` **sí** son públicos (aparecen en `GET /reports` y en el heatmap; esto es intencional para no perder reportes aún no moderados). Los reportes `"rechazado"` **no** aparecen en `GET /reports` ni en el heatmap, y su detalle (`GET /reports/{id}`), sus comentarios (`GET/POST /reports/{id}/comments`) y su confirmación (`POST /reports/{id}/confirm`) devuelven `404` salvo para el autor o un administrador.

---

### Listar categorías
```
GET /categories
```
No requiere token.

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "Basura",
    "description": "Residuos sólidos domésticos o de consumo: bolsas, plásticos, envases y similares.",
    "icon": "trash-outline"
  },
  {
    "id": 2,
    "name": "Escombros",
    "description": "Restos de construcción o demolición: hormigón, maderas, cerámicas y escombros en general.",
    "icon": "construct-outline"
  }
]
```
`description` e `icon` son opcionales (pueden venir en `null`). `icon` es el nombre de un ícono de Ionicons.

---

### Confirmar / quitar confirmación de un reporte
```
POST /reports/{id}/confirm
```
Requiere token. Alterna la confirmación del usuario.

**Response 200:**
```json
{ "confirmed": true, "count": 3 }
```

---

### Listar comentarios de un reporte
```
GET /reports/{id}/comments
```
No requiere token. Ordenados del más nuevo al más antiguo.

**Response 200:**
```json
[
  {
    "id": 1,
    "body": "Sigue ahí esta mañana",
    "user": { "id": 1, "name": "Bastian Contreras" },
    "created_at": "2026-06-05T12:10:00Z"
  }
]
```

---

### Comentar un reporte
```
POST /reports/{id}/comments
```
Requiere token.

**Request:**
```json
{ "body": "Sigue ahí esta mañana" }
```
`body`: requerido, máximo 500 caracteres.

**Response 201:** mismo formato que un elemento del listado.

---

## Referencia rápida

### Categorías disponibles
| id | name |
|---|---|
| 1 | basura |
| 2 | escombros |
| 3 | aguas |
| 4 | otro |

### Estados de un reporte
`Pendiente` → `En Progreso` → `Resuelto`

### Códigos HTTP usados
| Código | Significado |
|---|---|
| 200 | OK — consulta exitosa |
| 201 | Created — recurso creado |
| 401 | Unauthorized — token inválido o credenciales incorrectas |
| 404 | Not Found — recurso no existe |
| 422 | Unprocessable — datos de entrada inválidos |
| 429 | Too Many Requests — límite de intentos en login/registro |
