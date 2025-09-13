/*=== Configuración ===
$ApiKey = "fcd_060d6a7f8431a38c086635db7e4cd0769afde6211381b6e8"  # ← Reemplaza con la apiKey real del cliente 61
$Url = "http://localhost:3001/api/pruebas/factura-prueba"

# === Encabezados ===
$Headers = @{
  "x-api-key" = $ApiKey
  "Content-Type" = "application/json"
}

# === Intentar enviar la solicitud ===
try {
  $Response = Invoke-WebRequest -Uri $Url -Method Post -Headers $Headers -UseBasicParsing

  if ($Response.StatusCode -eq 200) {
    Write-Host "✅ Éxito: $( $Response.StatusCode )" -ForegroundColor Green
    $ResponseBody = $Response.Content | ConvertFrom-Json
    $ResponseBody | Format-List
  } else {
    Write-Host "❌ Error HTTP: $($Response.StatusCode)" -ForegroundColor Red
    $ErrorResponse = $Response.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($ErrorResponse) {
      $ErrorResponse | Format-List
    } else {
      Write-Host $Response.Content
    }
  }
}
catch {
  $Exception = $_.Exception
  
  # Manejar errores de conexión (como 404)
  if ($Exception.Response) {
    $StatusCode = [int]$Exception.Response.StatusCode
    $StatusDescription = $Exception.Response.StatusDescription
    Write-Host "❌ Error HTTP: $StatusCode - $StatusDescription" -ForegroundColor Red
    
    # Leer cuerpo del error si existe
    try {
      $Stream = $Exception.Response.GetResponseStream()
      $Reader = New-Object System.IO.StreamReader($Stream)
      $ResponseBody = $Reader.ReadToEnd()
      $ErrorBody = $ResponseBody | ConvertFrom-Json -ErrorAction SilentlyContinue
      if ($ErrorBody) {
        $ErrorBody | Format-List
      } else {
        Write-Host "Respuesta:" -ForegroundColor Yellow
        Write-Host $ResponseBody
      }
    } catch {
      Write-Host "No se pudo leer el cuerpo del error."
    }
  } else {
    # Otros errores (ej: servidor no responde, DNS, red)
    Write-Host "❌ Error de conexión: $($Exception.Message)" -ForegroundColor Red
  }
}


==================Insertar una factura========================
$ApiKey = "fcd_0e37d5e7731c9e1420530aac0f3c44f840be0f0134fb4a53"
$Url = "http://localhost:3001/api/facturas/insertar"

$Body = @{
  rifReceptor = "V7135111"
  razonSocialReceptor = "Pedro Perez"
  detalles = @(
    @{
      descripcion = "Disco Duro de 2TB sata"
      cantidad = 3
      precioUnitario = 180
    }
  )
} | ConvertTo-Json

$Headers = @{
  "x-api-key" = $ApiKey
  "Content-Type" = "application/json"
}

try {
  $Response = Invoke-WebRequest -Uri $Url -Method Post -Headers $Headers -Body $Body -UseBasicParsing
  $Response.Content | ConvertFrom-Json | Format-List
} catch {
  Write-Host "❌ Error:" -ForegroundColor Red
  $_.Exception.Response.GetResponseStream() | ReadAll
}

============EMPLEADO DE PRUEBA================

# === Configuración ===
$ApiKeyEncoded = "YWRtaW5AZmFjZGluLmNvbQ=="  # Base64 de admin@facdin.com
$Url = "http://localhost:3001/api/admin/generar-link"

# === Datos del cliente ===
$BodyJson = @{
  name = "Prueba4 Link desde Facdin"
  rif  = "J66148888"
} | ConvertTo-Json

# === Encabezados ===
$Headers = @{
  "Authorization" = "Bearer $ApiKeyEncoded"
  "Content-Type"  = "application/json"
}

# === Enviar solicitud ===
try {
  $Response = Invoke-WebRequest `
    -Uri $Url `
    -Method Post `
    -Headers $Headers `
    -Body $BodyJson `
    -UseBasicParsing

  Write-Host "✅ Éxito:" -ForegroundColor Green
  $Response.Content | ConvertFrom-Json | Format-List
}
catch {
  Write-Host "❌ Error del servidor:" -ForegroundColor Red
  if ($_.Exception.Response) {
    $Stream = $_.Exception.Response.GetResponseStream()
    $Reader = New-Object System.IO.StreamReader($Stream)
    $Resultado = $Reader.ReadToEnd()
    $Resultado | ConvertFrom-Json | Format-List
  } else {
    Write-Host $_.Exception.Message
  }
}


==========PARA INSERTAR PRODUCTOS EN LA TABLAS DE UN CLIENTE=======

# === Configuración ===
$ApiKey = "fcd_22e17f1d07e7aca17c0fff382b5b901f6677e970a79744aa"  # ← Reemplaza si es necesario
$Url = "http://localhost:3001/api/facturas/insertar"

# === Datos con caracteres UTF-8 correctos + cajaId e impresoraFiscal ===
$BodyJson = @{
  rifReceptor = "J987654321"
  razonSocialReceptor = "Distribuidora Papelera Integral SA"
  cajaId = "001"                    # ← Requerido
  impresoraFiscal = "EPSON-FISCAL-PRINTER-002345"  # ← Requerido
  detalles = @(
    @{ descripcion = "Lapiz HB"; cantidad = 10; precioUnitario = 0.50 },
    @{ descripcion = "Cuaderno A4"; cantidad = 5; precioUnitario = 3.00 }
  )
} | ConvertTo-Json -Depth 3

# === Forzar UTF-8 al enviar ===
$Bytes = [Text.Encoding]::UTF8.GetBytes($BodyJson)
$Headers = @{
  "x-api-key" = $ApiKey
  "Content-Type" = "application/json; charset=utf-8"
}

try {
  $Response = Invoke-WebRequest `
    -Uri $Url `
    -Method Post `
    -Headers $Headers `
    -Body $Bytes `
    -ContentType "application/json; charset=utf-8" `
    -UseBasicParsing

  Write-Host "✅ Éxito: $($Response.StatusCode)" -ForegroundColor Green
  $Resultado = $Response.Content | ConvertFrom-Json
  $Resultado | Format-List
}
catch {
  Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
  if ($_.Exception.Response) {
    $Stream = $_.Exception.Response.GetResponseStream()
    $Reader = New-Object System.IO.StreamReader($Stream, [System.Text.Encoding]::UTF8)
    $ErrorBody = $Reader.ReadToEnd() | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($ErrorBody) {
      $ErrorBody | Format-List
    } else {
      Write-Host $Reader.ReadToEnd()
    }
  }
}

=============== COMANDOS PARA REDIS=========================
Detener Redis -> docker stop facdin-redis
Iniciralo despues -> docker start facdin-redis
Eliminarlos -> docker rm -f facdin-redis
Ver log -> docker log facdin-redis

============ PARA INICIAR REDIS DIARIMENTE =================
En una terminal como adminitrador:

Set-ExecutionPolicy RemoteSigned -Scope CurrentUser


===============REGISTRAR UN EMPLEADO CON ROL===============

Invoke-WebRequest -Uri "http://localhost:3001/api/usuarios/registrar" `
  -Method Post `
  -Headers @{ "x-api-key" = "fcd_a6fc9b72ee9555faded5d956485840d0260c1441d313e940" } `
  -Body (@{ 
    nombre="Julio Pérez"; 
    email="julio@empresa.com"; 
    rol="cajero"; 
    password="Epa1126" 
  } | ConvertTo-Json) `
  -ContentType "application/json"


============= INICIAR SESIÓN COMO CAJERO==================

# Datos de login
$UserData = @{
  email    = "julio@empresa.com"
  password = "Epa1126"
}

# Convertir a JSON
$BodyJson = $UserData | ConvertTo-Json

try {
  # Hacer solicitud de login
  $Response = Invoke-WebRequest `
    -Uri "http://localhost:3001/api/usuarios/login" `
    -Method Post `
    -Headers @{
      "x-api-key" = "fcd_a6fc9b72ee9555faded5d956485840d0260c1441d313e940"
      "Content-Type" = "application/json; charset=utf-8"
    } `
    -Body $BodyJson `
    -UseBasicParsing

  # Extraer respuesta
  $Result = $Response.Content | ConvertFrom-Json
  $Token = $Result.token

  if ($Token) {
    Write-Host "✅ Login exitoso" -ForegroundColor Green
    Write-Host "🔐 Token JWT:" -ForegroundColor Yellow
    Write-Host $Token
  } else {
    Write-Host "❌ No se recibió token. Respuesta:" -ForegroundColor Red
    $Result | Format-List
  }

} catch {
  Write-Host "❌ Error en login:" -ForegroundColor Red
  Write-Host $_.Exception.Message
  if ($_.ErrorDetails.Message) {
    Write-Host "💬 Respuesta del servidor:" -ForegroundColor Cyan
    Write-Host $_.ErrorDetails.Message
  }
}

//============ USAR EL TOKEN PARA ABRIR UNA CAJA ==========

Invoke-WebRequest -Uri "http://localhost:3001/api/caja/abrir" `
  -Method Post `
  -Headers @{
    "Authorization" = "Bearer $Token"
    "x-api-key" = "fcd_a6fc9b72ee9555faded5d956485840d0260c1441d313e940"
  } `
  -Body (@{ cajaId="001"; impresoraFiscal="EPSON-PRINTER-002345" } | ConvertTo-Json) `
  -ContentType "application/json"



=========== EMITIR UNA FACTURA ==========================

# Suponiendo que ya tienes el token JWT del cajero
$Token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwiZW1haWwiOiJqdWxpb0BlbXByZXNhLmNvbSIsInJvbCI6ImNhamVybyIsImNsaWVudElkIjoxLCJpYXQiOjE3NTc3MTg3NDAsImV4cCI6MTc1Nzc0NzU0MH0.mww5OAbeajLFNloClgErLdyUwCad_G6PlaBZ2rk2-jk"

# Datos de la factura
$BodyJson = @{
  rifReceptor = "J987654321"
  razonSocialReceptor = "Distribuidora Integral SA"
  detalles = @(
    @{ descripcion = "Lápiz HB"; cantidad = 10; precioUnitario = 0.50 },
    @{ descripcion = "Cuaderno A4"; cantidad = 5; precioUnitario = 3.00 }
  )
} | ConvertTo-Json -Depth 3

try {
  $Response = Invoke-WebRequest `
    -Uri "http://localhost:3001/api/facturas/insertar" `
    -Method Post `
    -Headers @{
      "Authorization" = "Bearer $Token"
      "x-api-key" = "fcd_a6fc9b72ee9555faded5d956485840d0260c1441d313e940"
    } `
    -Body $BodyJson `
    -ContentType "application/json; charset=utf-8" `
    -UseBasicParsing

  $Resultado = $Response.Content | ConvertFrom-Json
  Write-Host "✅ Factura registrada:" -ForegroundColor Green
  $Resultado | Format-List

} catch {
  Write-Host "❌ Error al emitir factura:" -ForegroundColor Red
  Write-Host $_.ErrorDetails.Message
}

=========== USAR TOKEN PARA CERRAR CAJA =================

# Suponiendo que ya tienes el token JWT
$Token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwiZW1haWwiOiJhbmFAZW1wcmVzYS5jb20iLCJyb2wiOiJjYWplcm8iLCJjbGllbnRJZCI6MSwiaWF0IjoxNzU3NzE1ODYzLCJleHAiOjE3NTc3NDQ2NjN9.ADBriRndPzDlxELeF7fZnAUA8zHhkFGzQ6oI_7i_hGM"

Invoke-WebRequest `
  -Uri "http://localhost:3001/api/caja/cerrar" `
  -Method Post `
  -Headers @{
    "Authorization" = "Bearer $Token"
    "x-api-key" = "fcd_a6fc9b72ee9555faded5d956485840d0260c1441d313e940"
  } `
  -UseBasicParsing*/
