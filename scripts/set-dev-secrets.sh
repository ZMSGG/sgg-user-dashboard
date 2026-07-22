#!/bin/bash
# Interactive helper: writes Discord secrets from the clipboard into .dev.vars.
# Values never leave this machine and are never echoed to the screen.
set -euo pipefail
FILE="$(cd "$(dirname "$0")/.." && pwd)/.dev.vars"
MODE="${1:-all}"

case "$MODE" in
  all|bot|client-secret) ;;
  *)
    echo "使い方: $0 [all|bot|client-secret]"
    exit 2
    ;;
esac

replace() { # key, value
  printf '%s' "$2" | python3 -c '
import sys
path, key = sys.argv[1], sys.argv[2]
value = sys.stdin.read()
lines = open(path).read().splitlines()
found = any(line.startswith(key + "=") for line in lines)
out = [f"{key}={value}" if line.startswith(key + "=") else line for line in lines]
if not found:
    out.append(f"{key}={value}")
open(path, "w").write("\n".join(out) + "\n")
' "$FILE" "$1"
}

echo "== MY SGG dev secrets =="
echo

if [[ "$MODE" == "all" || "$MODE" == "bot" ]]; then
  echo "[Bot] Discordの Bot ページでトークンをコピーしてから Enter を押してください"
  read -r
  BOT=$(pbpaste | tr -d '[:space:]')
  if [[ ! "$BOT" =~ ^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]]; then
    echo "NG: クリップボードの内容がBotトークンの形式ではありません。もう一度コピーして再実行してください。"
    exit 1
  fi
  replace DISCORD_BOT_TOKEN "$BOT"
  echo "OK: DISCORD_BOT_TOKEN を保存しました (${#BOT}文字)"
  echo
fi

if [[ "$MODE" == "all" || "$MODE" == "client-secret" ]]; then
  echo "[OAuth2] OAuth2 > General で Client Secret をリセットしてコピーしてから Enter を押してください"
  read -r
  SECRET=$(pbpaste | tr -d '[:space:]')
  CURRENT_BOT=$(awk -F= '$1 == "DISCORD_BOT_TOKEN" { sub(/^[^=]*=/, ""); print; exit }' "$FILE")
  if [[ ${#SECRET} -lt 24 || "$SECRET" == "$CURRENT_BOT" ]]; then
    echo "NG: クリップボードの内容がClient Secretに見えません。もう一度コピーして再実行してください。"
    exit 1
  fi
  replace DISCORD_CLIENT_SECRET "$SECRET"
  echo "OK: DISCORD_CLIENT_SECRET を保存しました (${#SECRET}文字)"
  echo
fi

echo "完了です。チャットに「ok」と送ってください。"
