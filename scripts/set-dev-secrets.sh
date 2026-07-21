#!/bin/bash
# Interactive helper: writes Discord secrets from the clipboard into .dev.vars.
# Values never leave this machine and are never echoed to the screen.
set -euo pipefail
FILE="$(cd "$(dirname "$0")/.." && pwd)/.dev.vars"

replace() { # key, value
  python3 - "$FILE" "$1" "$2" <<'EOF'
import sys
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path).read().splitlines()
out = [f"{key}={value}" if l.startswith(key + "=") else l for l in lines]
open(path, "w").write("\n".join(out) + "\n")
EOF
}

echo "== MY SGG dev secrets =="
echo
echo "[1/2] Discordの Bot ページでトークンの「コピー」を押してから Enter を押してください"
read -r
BOT=$(pbpaste | tr -d '[:space:]')
if [[ ! "$BOT" =~ ^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]]; then
  echo "NG: クリップボードの内容がBotトークンの形式ではありません。もう一度コピーして再実行してください。"
  exit 1
fi
replace DISCORD_BOT_TOKEN "$BOT"
echo "OK: DISCORD_BOT_TOKEN を保存しました (${#BOT}文字)"
echo
echo "[2/2] OAuth2 ページで「秘密をリセット」→「コピー」を押してから Enter を押してください"
read -r
SECRET=$(pbpaste | tr -d '[:space:]')
if [[ ${#SECRET} -lt 24 || "$SECRET" == "$BOT" ]]; then
  echo "NG: クリップボードの内容がClient Secretに見えません。もう一度コピーして再実行してください。"
  exit 1
fi
replace DISCORD_CLIENT_SECRET "$SECRET"
echo "OK: DISCORD_CLIENT_SECRET を保存しました (${#SECRET}文字)"
echo
echo "完了です。チャットに「ok」と送ってください。"
