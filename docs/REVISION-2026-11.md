# Revisión integral — noviembre 2026

Base revisada: rama `fix/seguridad-apk` (HEAD `dde3298`). Revisión con `engineering:code-review`, por capa: R1 backend API/seguridad, R2 datos/rendimiento/tests backend, R3 frontend/UX/tests.

Resultado: **0 críticos · 9 importantes · 27 menores**. Todos los importantes fueron verificados contra el código por el dirigente. Ninguno requiere APK nuevo ni rompe el contrato con los APK instalados.

Correcciones de los importantes: rama `feat/revision-integral`, issue #61.

Estado: `pendiente` = aún no corregido · `corregido` · `descartado`.

## Importantes (verificados)

| id | orig | eje | archivo:línea | escenario | arreglo | test | estado |
|---|---|---|---|---|---|---|---|
| I-1 | R2-2 | integridad / concurrencia | `backend/app/Http/Controllers/ReportController.php:127-138` | Admin A lee reporte `valido`; admin B lo devuelve a `pendiente`; A guarda `status='En Progreso'` → reporte `pendiente` con estado de gestión cambiado (invariante roto) | `DB::transaction` + `lockForUpdate()` y re-chequear `validation_status` dentro | Cambiar la fila entre lectura y guardado → 409 y sin `pendiente` con `status != Pendiente` | corregido |
| I-2 | R1-1 | seguridad / UX | `ReportController.php:38-42`, `CommentController.php:14,31`, `ConfirmationController.php:16`, `bootstrap/app.php` | `GET /api/reports/9999` → `"No query results for model [App\\Models\\Report] 9999"`; reporte oculto → `""`. Oráculo de existencia y fuga de clase interna; contradice `docs/API.md` ("Reporte no encontrado.") | Render de `NotFoundHttpException` para `api/*` con mensaje fijo | Inexistente vs pendiente ajeno → mismo 404 y mismo cuerpo | corregido |
| I-3 | R1-2 | UX | `backend/config/app.php:81`, `.env.example:11`, sin `lang/` | Errores 422/401 llegan en inglés ("The email has already been taken.") y la app los muestra tal cual | `APP_LOCALE=es` + `lang/es/validation.php` (con `attributes`) | `register` con email duplicado → mensaje en español | corregido |
| I-4 | R3-1 | funcionamiento | `frontend/src/hooks/useOfflineSync.js:9-22` | 5xx/timeout con red "conectada" → reporte encolado y nada lo reintenta hasta cambio de red o de AppState | Intervalo ~60 s mientras haya conexión y pendientes | Timers falsos: 503 y luego 201 → `api.post` ×2 sin cambiar red | corregido |
| I-5 | R3-2 | integridad (duplicados) | `frontend/src/screens/NewReportScreen.js:154-157` | Sin conexión, doble toque → dos `randomUUID` → dos reportes encolados y publicados | Guarda síncrona `useRef` + `setLoading` también en la ruta offline | `isConnected=false`, dos `press` → `enqueue` ×1 | corregido |
| I-6 | R3-3 | funcionamiento / UX admin | `frontend/src/screens/DetalleReporteScreen.js:181-212` | PATCH de rechazo falla → `handleValidation` traga el error → el modal se cierra y el motivo se pierde; 409 con mensaje genérico | Devolver éxito/fracaso y cerrar el modal solo si hubo éxito; mensaje propio para 409 y recarga | `api.patch` rechaza → modal abierto y motivo conservado | corregido |
| I-7 | R3-4 | seguridad (sesión) | `frontend/src/services/tokenStorage.js:36-39`, `frontend/src/services/session.js:20-22` | Si `AsyncStorage.removeItem` lanza, el token de SecureStore sobrevive → el siguiente arranque restaura la sesión anterior; si `multiRemove` lanza, el header Authorization queda en memoria | Borrar cada almacén en `try/finally` independiente; `clearAuthToken()` siempre | `removeItem` rechaza → igual se llama `SecureStore.deleteItemAsync`; `multiRemove` rechaza → header limpio | corregido |
| I-8 | R3-5 | integridad (fuga entre usuarios) | `frontend/src/screens/HomeScreen.js:229`, `frontend/src/services/notifications.js:69-113` | Logout durante un poll → `syncStatusNotifications` en vuelo reescribe snapshot y avisos de A tras `clearSession`; B ve "Tu reporte fue aprobado" de A | Serializar con cadena de promesas y descartar si cambió la sesión | `clearNotifications()` en medio del sync → almacenamiento vacío | corregido |
| I-9 | R1-5 + R2-7 | rendimiento | `ReportController.php:18-32,113-119,165-180`, `CommentController.php:17-25` | `/reports`, `/reports/heatmap`, `/user/reports` y comentarios sin tope; cada poll baja toda la tabla; `index` carga el `user` completo; `latest()` sin índice | `with('user:id,name')`, tope duro (sin paginar, para no romper APK), nueva migración con índice `(validation_status, created_at)` | Conteo de queries constante / tope respetado | corregido |

## Menores

| id | orig | eje | archivo | resumen | estado |
|---|---|---|---|---|---|
| M-1 | R2-1 | seguridad | `database/seeders/ReportSeeder.php` | El guard de producción solo está en `DatabaseSeeder`: `--class=ReportSeeder` crea el admin demo `password`. Prod usa `APP_ENV=production` → riesgo solo por uso manual | corregido |
| M-2 | R1-3 | funcionamiento | `AppServiceProvider.php:31-32` | `email` como array en login → "Array to string" → 500 en vez de 422 | corregido |
| M-3 | R1-4 | seguridad | `AppServiceProvider.php:31-32` | Sin tope por IP en login: password spraying sobre N emails | corregido |
| M-4 | R1-6 | privacidad | `ReportController.php:75` | EXIF (GPS del teléfono) servido públicamente; fotos de rechazados accesibles por URL | corregido: se quitan APP1 (EXIF/XMP) y APP13 (IPTC) del JPEG en PHP, sin GD |
| M-5 | R1-7 | contrato | `docs/API.md` | Docs desalineados (MIME, campos de respuesta, 409 de status, límites 429, voseo) | corregido |
| M-6 | R2-3 | caché | `ZoneResolver.php:42`, `AssignZones.php:23` | `zones:assign` no cambia la huella de `/version` → los APK no ven las zonas nuevas | corregido |
| M-7 | R2-4 | caché | `ReportController.php:134-143` | Dos cambios en el mismo segundo → misma versión | corregido |
| M-8 | R2-5 | migración | `2026_10_30_000001_scope_client_uuid_unique_to_user.php` | `down()` puede fallar en MySQL (índice usado por la FK) | corregido: el down() crea un índice en user_id antes de borrar el unique |
| M-9 | R2-6 | migración | `2026_10_15_200200_add_bounds_to_zones_table.php` | Migración acoplada al modelo `Zone` | no corregido: exige editar una migración aplicada |
| M-10 | R2-8 | integridad | `AuditReportPhotos.php` | Fotos huérfanas sin detectar ni limpiar | corregido |
| M-11 | R2-9 | integridad | `database/audit.sql` | No verifica los invariantes de moderación | corregido |
| M-12 | R2-10 | tests | `DatabaseIntegrityTest.php` | Skip innecesario en SQLite; `rejection_reason` máx. 500 vs columna de 255 → 500 en MySQL | corregido |
| M-13 | R2-11 | tests | `backend/tests/**` | Huecos: rollback, ReportSeeder, concurrencia de confirmaciones, GrantAdmin | corregido |
| M-14 | R2-12 | UX consola | `GrantAdmin.php:29-33` | `--revoke` dice "removido" aunque no fuera admin; no advierte al quitar el último admin | corregido |
| M-15 | R3-6 | sesión | `frontend/src/services/api.js:34-38` | 401 obsoleto del token A cierra la sesión recién abierta de B | corregido |
| M-16 | R3-7 | UX GPS | `hooks/useAutoLocation.js:38` | Sin timeout: "Obteniendo ubicación…" infinito | corregido |
| M-17 | R3-8 | funcionamiento | `NewReportScreen.js:92-121` | Errores de cámara o conversión sin capturar; sin "Abrir Ajustes"; descripción enviada sin `trim` | corregido |
| M-18 | R3-9 | UX | `MyReportsScreen.js:294` | La cuadrícula oculta los pendientes y fallidos de la cola | corregido |
| M-19 | R3-10 | rendimiento | `MyReportsScreen.js:57-79` | Cargas concurrentes sin guarda; spinner de pantalla completa en cada `emit` | corregido |
| M-20 | R3-11 | UX | `App.js:48-52` | Bienvenida mínima de 2,5 s en cada arranque | corregido |
| M-21 | R3-12 | funcionamiento | `offlineQueue.js:181-196` | Con el servidor caído recorre toda la cola (60 s por ítem); un 429 no corta el bucle | corregido |
| M-22 | R3-13 | UX | `LoginScreen.js`, `RegisterScreen.js` | Fallo de `saveToken` mostrado como error de red; email sin `trim` | corregido |
| M-23 | R3-14 | UX | `HomeScreen.js:288-300` | Logout offline espera 15 s antes de limpiar la sesión | corregido |
| M-24 | R3-15 | accesibilidad | `HomeScreen.js`, Login/Register | Botones de solo ícono sin `accessibilityLabel` | corregido |
| M-25 | R3-16 | config | `eas.json:6-11` | Perfil `development` sin URL (cae a localhost HTTP con cleartext desactivado) | corregido |
| M-26 | R3-17 | robustez | `leafletMapHtml.js:222,263` | `id` concatenado en `onclick` sin forzar a número | corregido |
| M-27 | R3 | tests | `frontend/src/__tests__` | Sin tests de `useOfflineSync` ni `useReportsPolling`; `leafletMapHtml.test` solo usa `toContain` | corregido |

## Descartado tras verificar
IDOR (todo pasa por `isVisibleTo` y el middleware `admin`), mass assignment, fuga de emails, validación de foto (MIME por contenido, nombre aleatorio, 5 MB), revocación y expiración de tokens, trusted proxies en producción, duplicados de confirmaciones (unique + lock), cascadas de FK, decimales de coordenadas, XSS en los popups de Leaflet (`esc`, `safeUrl`, iframe sandbox), idempotencia de `client_uuid`, limpieza de los pollings.

## Nota
Esta rama ya introduce `expo-secure-store` (módulo nativo): los APK 1.0.0 necesitan el APK 1.1.0. Ningún arreglo de esta lista exige otro APK, salvo M-25 si se quiere un build de desarrollo.

## Hallazgo nuevo durante la verificación

| id | eje | archivo | resumen | estado |
|---|---|---|---|---|
| N-1 | migración | `2026_10_30_000002_add_status_updated_to_reports_table.php` | `down()` hace `dropColumn('status_updated_by')` sin `dropForeign` antes: en MySQL `migrate:rollback` falla en ese paso (por eso M-8 solo quedó probado hasta ahí). Corregirlo exige editar el `down()` de una migración aplicada | corregido: dropForeign antes de dropColumn; migrate:reset completo verificado en MySQL |

Notas: M-13 (d) sin cambios, porque `register` guarda el email tal cual y la búsqueda solo ignora mayúsculas en MySQL. M-12 amplió `rejection_reason` a `text` (la app permite 500 caracteres).
