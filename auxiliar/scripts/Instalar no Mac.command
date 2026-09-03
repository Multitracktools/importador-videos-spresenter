#!/bin/bash
set -e

APP_NAME="Auxiliar do Importador para Spresenter.app"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_APP="$SCRIPT_DIR/$APP_NAME"
DESTINATION_APP="/Applications/$APP_NAME"

clear
echo "Instalador do Importador de Vídeos para Spresenter"
echo ""

if [ ! -d "$SOURCE_APP" ]; then
  echo "O aplicativo não foi encontrado dentro do instalador."
  read -r -p "Pressione Enter para fechar."
  exit 1
fi

echo "Copiando o auxiliar para a pasta Aplicativos..."
/usr/bin/ditto "$SOURCE_APP" "$DESTINATION_APP"

echo "Preparando a primeira abertura..."
/usr/bin/xattr -dr com.apple.quarantine "$DESTINATION_APP" 2>/dev/null || true

echo "Abrindo o auxiliar..."
/usr/bin/open "$DESTINATION_APP"

echo ""
echo "Instalação concluída. O auxiliar ficará na barra superior do Mac."
read -r -p "Pressione Enter para fechar."
