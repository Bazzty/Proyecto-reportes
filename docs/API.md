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
No requiere token. Devuelve solo reportes validados (`validation_status = "valido"`). Si se envía token, se calcula `confirmed_by_me` y se incluyen también los reportes **pendientes del propio usuario** (nunca los rechazados ni los pendientes de otros).

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

El reporte nace con `validation_status = "pendiente"`, salvo que lo cree un administrador: en ese caso nace `"valido"`, con `validated_by` igual al autor.

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
No requiere token. Devuelve **un punto por reporte validado** (`latitude`, `longitude`) junto con su `zone` (`{ id, name }`, o `null` si el reporte no cae en ninguna zona). No agrupa: se mantiene la densidad y la agrupación visual por zona, si se necesita, la resuelve el cliente.

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
Requiere token de **administrador**. Lista los reportes paginados (20 por página), incluyendo `validation_status`, `zone` y el validador. Filtros opcionales por query string: `validation_status` (`pendiente`|`valido`|`rechazado`), `zone_id`, `category_id`, `status` (`Pendiente`|`En Progreso`|`Resuelto`), `search` y `sort`.

- `search`: texto (máx. 100, se aplica `trim`; vacío = sin filtro). Coincide (`LIKE`) con la `description`, el nombre del autor o el nombre de la zona. `%`, `_` y `\` se tratan como texto literal.
- `sort`: `recientes` (por defecto, más nuevos primero) o `confirmaciones` (más `confirmations_count` primero y, a igualdad, los más recientes). Cualquier otro valor da `422`.

Además de los campos del reporte, cada elemento trae `validated_by` (`{id,name}|null`), `status_updated_by` (`{id,name}|null`), `status_updated_at` (ISO 8601 o `null`) y `auto_validated` (`true` si quien validó es el propio autor, p. ej. un admin que reporta).

**Response 200:**
```json
{
  "data": [
    {
      "id": 1, "validation_status": "valido", "status": "En Progreso", "zone": { "id": 5, "name": "Puerto Varas" },
      "validated_by": { "id": 2, "name": "Admin" }, "auto_validated": false,
      "status_updated_by": { "id": 2, "name": "Admin" }, "status_updated_at": "2026-11-05T14:00:00.000000Z"
    }
  ],
  "meta": {
    "current_page": 1, "last_page": 1, "per_page": 20, "total": 21,
    "counts": { "pendiente": 12, "valido": 7, "rechazado": 2, "total": 21 }
  }
}
```

`meta.counts` indica cuántos reportes hay en cada estado de validación (con `0` por defecto) y su `total`. Aplica los filtros `zone_id`, `category_id`, `status` y `search`, pero **no** `validation_status`, así que sirve para mostrar el contador de cada pestaña aunque haya una seleccionada. `meta.total` sí respeta todos los filtros.

---

### Panel de administración — validar / rechazar un reporte
```
PATCH /admin/reports/{id}/validation
```
Requiere token de **administrador**.

**Request (validar):**
```json
{ "validation_status": "valido", "expected_validation_status": "pendiente" }
```
**Request (rechazar):**
```json
{ "validation_status": "rechazado", "rejection_reason": "No corresponde a contaminación.", "expected_validation_status": "pendiente" }
```
**Request (deshacer):**
```json
{ "validation_status": "pendiente", "expected_validation_status": "valido" }
```
`validation_status` acepta `pendiente`, `valido` y `rechazado`. `expected_validation_status` es **obligatorio**: es el estado que el cliente vio al cargar la lista (concurrencia optimista). `rejection_reason` es obligatorio solo al rechazar.

Al pasar a `pendiente` se limpian `validated_by`, `validated_at`, `rejection_reason`, `status_updated_by` y `status_updated_at`, y `status` vuelve a `Pendiente`. Si se pasa de `valido` a `pendiente` y el reporte ya avanzó de estado (`En Progreso` o `Resuelto`), la respuesta es `409`: deshacer no borra el cambio de estado de otro admin.

Opcional al pasar a `valido` o `rechazado` (deshacer una moderación previa): `restore_validated_by` (id de usuario existente) y `restore_validated_at` (fecha ISO 8601, no futura), siempre juntos. En vez de registrar como moderador a quien deshace, se restauran quien moderó antes y cuándo. No se aceptan al pasar a `pendiente` (`422`).
```json
{ "validation_status": "valido", "expected_validation_status": "rechazado", "restore_validated_by": 7, "restore_validated_at": "2026-11-01T10:00:00.000000Z" }
```

**Response 200:** el reporte actualizado (incluye `validation_status`, `rejection_reason`, `validated_at`, `validated_by`, `status_updated_by`, `status_updated_at` y `auto_validated`).

**Response 409 — El estado cambió mientras tanto:** otro admin ya modificó el reporte. El `UPDATE` es atómico (`WHERE id = ? AND validation_status = ?`), así que dos admins simultáneos no pueden pisarse; recargá la lista y reintentá.

> **Visibilidad:** solo los reportes con `validation_status = "valido"` son públicos. Los `"pendiente"` y `"rechazado"` **no** aparecen en el heatmap ni, para otros usuarios, en `GET /reports`; su detalle (`GET /reports/{id}`), sus comentarios (`GET/POST /reports/{id}/comments`) y su confirmación (`POST /reports/{id}/confirm`) devuelven `404` salvo para el autor o un administrador. Excepción: `GET /reports` con token incluye además los reportes **pendientes del propio usuario**, para que vea en el mapa el que acaba de enviar.

---

### Panel de administración — zonas
```
GET /admin/zones
```
Requiere token de **administrador**. Lista id y nombre de todas las zonas, ordenadas por nombre (para el filtro `zone_id`).

**Response 200:**
```json
[
  { "id": 3, "name": "Frutillar" },
  { "id": 5, "name": "Puerto Montt" }
]
```

---

### Panel de administración — resumen
```
GET /admin/reports/summary
```
Requiere token de **administrador**. Sin parámetros.

**Response 200:**
```json
{
  "total": 64,
  "pending": 62,
  "new_this_week": 5,
  "avg_validation_hours": 3.5,
  "top_zone": { "id": 5, "name": "Puerto Montt", "count": 20 }
}
```
- `new_this_week`: reportes creados en los últimos 7 días.
- `avg_validation_hours`: promedio en horas (1 decimal) entre `created_at` y `validated_at` de los últimos 200 reportes validados o rechazados, **sin contar los autovalidados** (`validated_by` = autor). `null` si no hay datos.
- `top_zone`: zona con más reportes no rechazados (desempate: id menor) o `null`.

---

### Panel de administración — validar / rechazar en lote
```
POST /admin/reports/bulk-validation
```
Requiere token de **administrador**.

**Request:**
```json
{ "ids": [1, 2, 3, 4], "validation_status": "rechazado", "rejection_reason": "Duplicados." }
```
- `ids`: de 1 a 50 enteros distintos que existan (más de 50, repetidos o inexistentes dan `422`; la existencia se revisa con una sola consulta y el error va en `ids`).
- `validation_status`: `valido` o `rechazado`; `rejection_reason` (máx. 500) es obligatorio al rechazar.

Solo se modifican los reportes que sigan `pendiente` en ese momento (selección bloqueada dentro de una transacción, así dos admins simultáneos no se pisan). No es todo-o-nada: los demás se informan en `skipped`.

**Response 200:**
```json
{
  "updated": [1, 2, 3],
  "skipped": [4],
  "validated_by": { "id": 2, "name": "Admin" },
  "validated_at": "2026-11-12T15:00:00.000000Z"
}
```
`validated_by` y `validated_at` corresponden a los reportes de `updated` (los mismos para todos), para que el panel actualice el historial sin recargar.

---

### Panel de administración — exportar CSV
```
GET /admin/reports/export
```
Requiere token de **administrador** (cabecera `Authorization: Bearer`; se descarga con una petición autenticada). Acepta los mismos filtros que el listado: `validation_status`, `zone_id`, `category_id`, `status`, `search` y `sort`.

**Response 200:** `Content-Type: text/csv; charset=UTF-8` y `Content-Disposition: attachment; filename="reportes-2026-11-06.csv"`. El archivo empieza con BOM UTF-8 y tiene como máximo 5000 filas (las más recientes según el orden pedido). Columnas, en este orden:
```
id,categoria,descripcion,zona,autor,estado,validacion,motivo_rechazo,confirmaciones,latitud,longitud,creado,validado_por,validado_en,estado_actualizado_por,estado_actualizado_en
```
```
12,basura,"Basura en la costanera, lado norte",Puerto Montt,Ana,Resuelto,valido,,3,-41.32,-72.98,2026-11-01T12:00:00.000000Z,Admin,2026-11-01T15:30:00.000000Z,Admin,2026-11-03T09:00:00.000000Z
```
Las fechas van en ISO 8601. Los valores se escapan según CSV (comillas, comas, saltos de línea) y toda celda de texto que empiece por `=`, `+`, `-`, `@`, tab o retorno de carro se antepone con una comilla simple `'` para evitar inyección de fórmulas. Filtros inválidos dan `422`.

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

### Confirmar / quitar confirmación de un reporte ("Yo también lo vi")
```
POST /reports/{id}/confirm
```
Requiere token. Sin body. Alterna la confirmación del usuario sobre el reporte.

**Reglas acordadas por el equipo:**
- Cada usuario confirma un reporte **una sola vez** (restricción `unique(user_id, report_id)` en la tabla `confirmations`).
- La confirmación **se puede deshacer**: llamar de nuevo al mismo endpoint la quita (`confirmed: false`).
- **No se puede confirmar el propio reporte** (403). La app tampoco muestra el botón al dueño; en su lugar le muestra cuántas personas lo confirmaron.

`confirmed` indica el estado del usuario después de la llamada y `count` el total de confirmaciones del reporte. Es el mismo valor que `confirmations_count` en el detalle y en el listado, donde `confirmed_by_me` solo vale `true` si la petición envía el token.

**Response 200 — Confirmado:**
```json
{ "confirmed": true, "count": 3 }
```

**Response 200 — Confirmación quitada:**
```json
{ "confirmed": false, "count": 2 }
```

**Response 401 — Sin token o token inválido:**
```json
{ "message": "Unauthenticated." }
```

**Response 403 — Es tu propio reporte:**
```json
{ "message": "No puedes confirmar tu propio reporte." }
```

**Response 404 — El reporte no existe.**

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
| 403 | Forbidden — acción no permitida (ej: confirmar tu propio reporte) |
| 404 | Not Found — recurso no existe |
| 422 | Unprocessable — datos de entrada inválidos |
| 429 | Too Many Requests — límite de intentos en login/registro |
