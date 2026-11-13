# Despliegue del backend en Azure + APK con EAS Build

Arquitectura en producción:

```
APK ──HTTPS──▶ https://<DOMINIO>  ──▶  Azure VM (Ubuntu + Docker Compose)
                                        ├─ caddy  (HTTPS automático, puertos 80/443)
                                        ├─ nginx → app (PHP-FPM / Laravel)
                                        └─ db     (MySQL 8, volumen persistente)
```

Archivos involucrados: `backend/docker-compose.prod.yml`, `backend/docker/caddy/Caddyfile`,
`frontend/eas.json`.

En esta guía `<DOMINIO>` es el nombre DNS de la VM, p. ej.
`lagoenlinea.chilecentral.cloudapp.azure.com`.

---

## 1. Crear la VM en Azure

### 1.1 Cuenta
Activar **Azure for Students** en <https://azure.microsoft.com/free/students> con el correo
institucional. Queda una suscripción "Azure for Students".

### 1.2 Máquina virtual
Portal (<https://portal.azure.com>) → **Máquinas virtuales → Crear → Máquina virtual de Azure**.

**Aspectos básicos**

| Campo | Valor |
|---|---|
| Suscripción | **Azure for Students** (si hay otra suscripción en la cuenta, no usarla) |
| Grupo de recursos | Crear nuevo → `rg-lagoenlinea` |
| Nombre | `vm-lagoenlinea` |
| Región | `Chile Central`. Azure for Students solo permite algunas regiones (ver `az policy assignment list`); en esta suscripción: chilecentral, northcentralus, canadacentral, newzealandnorth, southafricanorth |
| Opciones de disponibilidad | No se requiere redundancia de infraestructura |
| Tipo de seguridad | Estándar |
| Imagen | Ubuntu Server 24.04 LTS – x64 Gen2 |
| Tamaño | "Ver todos los tamaños" → `Standard_B2ats_v2` (2 vCPU, 1 GB; B1s no existe en Chile Central). Revisar que el estimado sea ~10–20 USD/mes |
| Autenticación | Clave pública SSH |
| Usuario | `azureuser` |
| Origen de clave SSH | Generar nuevo par de claves → `vm-lagoenlinea_key` |
| Puertos de entrada | Permitir seleccionados: SSH (22), HTTP (80), HTTPS (443) |

**Discos:** SSD estándar, tamaño por defecto.
**Redes:** IP pública nueva, SKU Estándar (estática).
**Administración:** **desactivar "Apagado automático"** (si no, la API se cae cada noche).

**Revisar y crear → Crear → Descargar clave privada** (no se puede volver a descargar).

### 1.3 Nombre DNS
VM → Información general → clic en la **IP pública** → **Configuración** →
**Etiqueta de nombre DNS**: `lagoenlinea` → Guardar. El FQDN resultante es `<DOMINIO>`.

### 1.4 Restringir SSH
VM → **Redes → Configuración de red** → regla del puerto **22** → Origen: **Mi dirección IP**.
Si cambias de red y no puedes entrar, actualiza esta regla.

---

## 2. Conectarse por SSH (Windows / PowerShell)

```powershell
Move-Item "$HOME\Downloads\vm-lagoenlinea_key.pem" "$HOME\.ssh\vm-lagoenlinea_key.pem"
icacls "$HOME\.ssh\vm-lagoenlinea_key.pem" /inheritance:r
icacls "$HOME\.ssh\vm-lagoenlinea_key.pem" /grant:r "$($env:USERNAME):(R)"

ssh -i "$HOME\.ssh\vm-lagoenlinea_key.pem" azureuser@<DOMINIO>
```

Si aparece `UNPROTECTED PRIVATE KEY FILE`, repetir los `icacls`.

---

## 3. Preparar el servidor

```bash
sudo apt update && sudo apt upgrade -y

# Swap de 2 GB (con 1 GB de RAM, MySQL + composer se quedan sin memoria)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit
```

Reconectar por SSH y verificar: `docker run --rm hello-world`.

---

## 4. Desplegar el backend

### 4.1 Clonar
```bash
git clone -b develop https://github.com/Bazzty/Proyecto-reportes.git
cd Proyecto-reportes/backend
```
Se despliega `develop`: `main` todavía no recibe los cambios del backend (roles, administradores,
zonas). Cuando `develop` se promueva a `main`, cambiar de rama con `git checkout main`.
Repo privado: usar como contraseña un *Fine-grained token* de GitHub con permiso de solo
lectura sobre *Contents*.

### 4.2 `.env` de producción
```bash
cp .env.example .env
openssl rand -hex 24   # ejecutar dos veces: DB_PASSWORD y DB_ROOT_PASSWORD
nano .env
```

Valores a cambiar:
```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://<DOMINIO>
APP_DOMAIN=<DOMINIO>
LOG_LEVEL=warning

DB_HOST=db
DB_DATABASE=lagoenlinea
DB_USERNAME=lagoenlinea
DB_PASSWORD=<contraseña 1>
DB_ROOT_PASSWORD=<contraseña 2>
```

### 4.3 Levantar y configurar
```bash
echo "alias dc='docker compose -f docker-compose.prod.yml'" >> ~/.bashrc && source ~/.bashrc

dc up -d --build
dc exec app composer install --no-dev --optimize-autoloader
dc exec app php artisan key:generate --force
dc exec app chown -R www-data:www-data storage bootstrap/cache

# Con APP_ENV=production, db:seed carga categorías y zonas pero no los reportes de prueba
dc exec app php artisan migrate --force
dc exec app php artisan db:seed --force

# Administrador: registrarse desde la app y luego otorgar el rol
dc exec app php artisan user:admin correo@ejemplo.cl
# El mapa solo muestra reportes validados. Al actualizar un servidor con reportes previos,
# quedan ocultos hasta que este administrador los valide desde el panel (validación en lote).

dc exec app php artisan storage:link
dc exec app php artisan config:cache
dc exec app php artisan route:cache

# Los artisan anteriores corren como root: si alguno creó storage/logs/laravel.log, PHP-FPM
# (www-data) no podría escribirlo y la API respondería 500. Devolver la propiedad al final.
dc exec app chown -R www-data:www-data storage bootstrap/cache
```

### 4.4 Verificar
```bash
dc ps                      # app, nginx, db, caddy en "Up"
dc logs caddy | tail -20   # buscar "certificate obtained successfully"
curl -s https://<DOMINIO>/api/categories
```
Desde el celular **con datos móviles**: `https://<DOMINIO>/up` y `https://<DOMINIO>/api/categories`.

Si Caddy no obtiene el certificado: revisar que el puerto 80 esté abierto en el NSG y que
`APP_DOMAIN` coincida exactamente con la etiqueta DNS.

---

## 5. Generar el APK

El proyecto ya está enlazado a EAS (`@bazztyy/frontend`, ver `app.json`); no hace falta `eas init`.
El mapa es Leaflet dentro de un WebView, así que no se necesita API key de Google Maps.
`frontend/eas.json` ya apunta a `https://lagoenlinea.chilecentral.cloudapp.azure.com/api`; si el dominio cambia, actualizarlo ahí.

```bash
cd frontend
npx eas-cli build -p android --profile preview
```
Al terminar, EAS entrega un enlace/QR para descargar e instalar el APK.

**Antes de compilar:** desplegar en el servidor la versión de `develop` que se va a usar (sección 6,
con `migrate`). El APK usa endpoints nuevos (`/reports/version`, "Cargar más" por `offset`) que un
backend anterior no tiene.

**Versión 1.1.0:** guarda el token en el almacén seguro del sistema (`expo-secure-store`, módulo
nativo) y bloquea el tráfico HTTP sin cifrar. Hay que instalar el APK nuevo: los APK 1.0.0 ya no
reciben las actualizaciones publicadas desde esta versión (`runtimeVersion` sigue a `version`).

Cambios solo de JavaScript llegan a los APK instalados sin reinstalar (canal `preview`):
```bash
cd frontend
npm run update:preview -- --message "descripción"
```
El script toma la URL de `eas.json`. No usar `npx eas-cli update` directo: sin
`EXPO_PUBLIC_API_URL` en el entorno, el update se publica con la IP de tu `.env` y todos los APK
pierden la conexión.

---

## 6. Mantenimiento

**Actualizar tras un merge a `develop`** (la rama desplegada, ver 4.1):
```bash
cd ~/Proyecto-reportes && git pull && cd backend
dc up -d --build
dc exec app composer install --no-dev --optimize-autoloader
dc exec app php artisan migrate --force
dc exec app php artisan config:cache && dc exec app php artisan route:cache
dc exec app chown -R www-data:www-data storage bootstrap/cache
```

`dc up -d --build` también levanta el servicio `scheduler` (`php artisan schedule:work`), que cada
día borra los tokens de sesión vencidos (`sanctum:prune-expired`). Comprobar con `dc ps`.

**Backup de la BD:**
```bash
dc exec -T db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > ~/backup_$(date +%F).sql
```

**Créditos:** revisar *Cost Management + Billing* en el portal. Si se agotan, la VM se detiene.
