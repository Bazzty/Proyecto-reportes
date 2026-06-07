# Contrato de API — App de Reportes Ambientales

Base URL: `http://localhost:8000/api`

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
    "email": "bastian@example.com"
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
    "email": "bastian@example.com"
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
Requiere token.

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

**Response 201:**
```json
{
  "id": 2,
  "description": "Escombros en la vereda",
  "latitude": -33.4580,
  "longitude": -70.6500,
  "photo_url": "http://localhost:8000/storage/photos/reporte_2.jpg",
  "status": "pendiente",
  "category": {
    "id": 2,
    "name": "escombros"
  },
  "user": {
    "id": 1,
    "name": "Bastian Contreras"
  },
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
Requiere token.

**Response 200:**
```json
{
  "id": 1,
  "description": "Basura acumulada en la esquina",
  "latitude": -33.4569,
  "longitude": -70.6483,
  "photo_url": "http://localhost:8000/storage/photos/reporte_1.jpg",
  "status": "pendiente",
  "category": {
    "id": 1,
    "name": "basura"
  },
  "user": {
    "id": 1,
    "name": "Bastian Contreras"
  },
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

### Puntos para el mapa de calor
```
GET /reports/heatmap
```
Requiere token. Devuelve solo coordenadas — el frontend las usa para pintar el heatmap.

**Response 200:**
```json
[
  { "latitude": -33.4569, "longitude": -70.6483 },
  { "latitude": -33.4580, "longitude": -70.6500 },
  { "latitude": -33.4601, "longitude": -70.6512 }
]
```

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
