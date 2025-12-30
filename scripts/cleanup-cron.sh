#!/bin/bash

# Script para limpieza automática vía CRON
# Guardar como: /home/julio-perez/API-FACDIN/scripts/cleanup-cron.sh

# Configuración
LOG_FILE="/var/log/facdin-cleanup.log"
SCRIPT_DIR="/home/julio-perez/API-FACDIN"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Función para loguear
log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

# Cambiar al directorio del proyecto
cd "$SCRIPT_DIR" || {
    log "❌ Error: No se pudo acceder a $SCRIPT_DIR"
    exit 1
}

# Cargar variables de entorno
if [ -f .env ]; then
    set -a
    source .env
    set +a
    log "✅ Variables de entorno cargadas"
else
    log "⚠️  Advertencia: Archivo .env no encontrado"
fi

# Ejecutar limpieza
log "🧹 Iniciando limpieza automática..."
/usr/bin/node scripts/cleanup-final.js --force >> "$LOG_FILE" 2>&1

EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
    log "✅ Limpieza completada exitosamente"
else
    log "❌ Error en limpieza (código: $EXIT_CODE)"
fi

exit $EXIT_CODE
