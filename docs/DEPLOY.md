# Despliegue del backend en Azure + APK con EAS Build

Arquitectura en producción:

```
APK ──HTTPS──▶ https://<DOMINIO>  ──▶  Azure VM (Ubuntu + Docker Compose)
                                        ├─ caddy  (HTTPS automático, puertos 80/443)
                                        ├─ nginx → app (PHP-FPM / Laravel)
                                        └─ db     (MySQL 8, volumen persistente)
```

Archivos involucrados: `backend/docker-compose.prod.yml`, `backend/docker/caddy/Caddyfile`,
`frontend/eas.json`, `frontend/app.config.js`.

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
git clone https://github.com/Newt90xz/ProyectoDevelop.git
cd ProyectoDevelop/backend
```
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

# Sin ReportSeeder (datos de prueba)
dc exec app php artisan migrate --force
dc exec app php artisan db:seed --class=CategorySeeder --force
dc exec app php artisan db:seed --class=ZoneSeeder --force

dc exec app php artisan storage:link
dc exec app php artisan config:cache
dc exec app php artisan route:cache
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

### 5.1 API key de Google Maps
Sin ella el mapa sale en blanco en el APK (Expo Go usa su propia key; el APK no).

1. <https://console.cloud.google.com> → crear proyecto → **APIs y servicios → Biblioteca** →
   habilitar **Maps SDK for Android**.
2. **Credenciales → Crear credenciales → Clave de API**.
3. Restringir la clave: aplicación Android, paquete `com.reportesambientales.app` + huella SHA-1 del
   keystore de EAS (`eas credentials -p android` la muestra tras el primer build).

### 5.2 Configurar EAS (desde `frontend/`)
```bash
eas init                     # vincula el proyecto y escribe extra.eas.projectId en app.json
eas env:create --name GOOGLE_MAPS_API_KEY --value <KEY> --environment preview --visibility sensitive
```
`frontend/eas.json` ya apunta a `https://lagoenlinea.chilecentral.cloudapp.azure.com/api`; si el dominio cambia, actualizarlo ahí.

### 5.3 Build
```bash
eas build -p android --profile preview
```
Al terminar, EAS entrega un enlace/QR para descargar e instalar el APK.

---

## 6. Mantenimiento

**Actualizar tras un merge a `main`:**
```bash
cd ~/ProyectoDevelop && git pull && cd backend
dc up -d --build
dc exec app composer install --no-dev --optimize-autoloader
dc exec app php artisan migrate --force
dc exec app php artisan config:cache && dc exec app php artisan route:cache
```

**Backup de la BD:**
```bash
dc exec -T db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > ~/backup_$(date +%F).sql
```

**Créditos:** revisar *Cost Management + Billing* en el portal. Si se agotan, la VM se detiene.
