$ErrorActionPreference = 'Stop'

$adbCommand = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adbCommand) {
  Write-Error 'No se encontro adb. Instala Android Platform Tools y verifica que adb este en PATH.'
  exit 1
}

$devicesOutput = & $adbCommand.Source devices
$connectedDevices = @($devicesOutput | Where-Object { $_ -match "^\S+\s+device$" })
if ($connectedDevices.Count -eq 0) {
  Write-Error 'No se encontro un telefono autorizado. Conectalo por USB, activa Depuracion USB y acepta el aviso del telefono.'
  exit 1
}
if ($connectedDevices.Count -gt 1) {
  Write-Error 'Hay varios dispositivos Android conectados. Deja conectado solo el telefono que reproduce el problema.'
  exit 1
}

$outputDirectory = Join-Path $env:TEMP 'ProyectoDevelop-camera-diagnostics'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$fullLogPath = Join-Path $outputDirectory "camera-full-$timestamp.txt"
$errorLogPath = Join-Path $outputDirectory "camera-adb-errors-$timestamp.txt"
$filteredLogPath = Join-Path $outputDirectory "camera-filtered-$timestamp.txt"

& $adbCommand.Source logcat -c
if ($LASTEXITCODE -ne 0) {
  Write-Error 'No se pudo limpiar el registro de Android.'
  exit 1
}

$logProcess = Start-Process `
  -FilePath $adbCommand.Source `
  -ArgumentList @('logcat', '-v', 'threadtime') `
  -RedirectStandardOutput $fullLogPath `
  -RedirectStandardError $errorLogPath `
  -PassThru `
  -NoNewWindow

try {
  Write-Host ''
  Write-Host 'Capturando registros de Android.'
  Write-Host 'Ahora reproduce el problema: abre el formulario, toma una foto y pulsa Aceptar.'
  Read-Host 'Cuando Expo Go se reinicie, vuelve aqui y presiona Enter'
}
finally {
  $logProcess.Refresh()
  if (-not $logProcess.HasExited) {
    Stop-Process -Id $logProcess.Id
    $logProcess.WaitForExit()
  }
}

$pattern = 'FATAL EXCEPTION|AndroidRuntime|OutOfMemoryError|Killing|am_kill|host\.exp\.exponent|ReactNativeJS|ImagePicker|expo-image-picker|ActivityTaskManager|ActivityManager'
$matches = Select-String -Path $fullLogPath -Pattern $pattern -Context 3, 6

if ($matches) {
  $matches | Out-String -Width 240 | Set-Content -Path $filteredLogPath -Encoding UTF8
  Write-Host ''
  Write-Host "Listo. Comparte este archivo filtrado: $filteredLogPath"
}
else {
  'No hubo coincidencias en las lineas filtradas. Comparte el registro completo si se necesita mas detalle.' |
    Set-Content -Path $filteredLogPath -Encoding UTF8
  Write-Host ''
  Write-Host 'No se encontraron errores o eventos relevantes en el filtro.'
  Write-Host "Registro completo: $fullLogPath"
  Write-Host "Archivo de resultados: $filteredLogPath"
}
