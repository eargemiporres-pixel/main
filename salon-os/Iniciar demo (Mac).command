#!/bin/bash
# Doble clic para arrancar la demo de Salon OS en Mac.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "No encuentro Node.js. Instala la versión LTS desde https://nodejs.org y vuelve a intentarlo."
  read -r -p "Pulsa Enter para cerrar"
  exit 1
fi
node scripts/demo.js
