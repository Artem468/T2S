#!/usr/bin/env bash
# Запуск docker compose: с GPU, если доступен nvidia-smi, иначе только CPU.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1; then
  echo "[compose] NVIDIA GPU detected → docker-compose.gpu.yml"
  docker compose -f docker-compose.yml -f docker-compose.gpu.yml "$@"
else
  echo "[compose] GPU не найден или nvidia-smi недоступен → CPU (без gpu-файла)"
  docker compose -f docker-compose.yml "$@"
fi
