#!/bin/bash
# PIGWATCH 每日自动抓数 + 提交(launchd 周一至五 17:00 调用)
set -uo pipefail

PROJ="$HOME/pig-cycle-terminal"
PY="$HOME/miniconda3/envs/ashare/bin/python"
GIT=/usr/bin/git
LOG="$PROJ/.logs/daily_update.log"
mkdir -p "$PROJ/.logs"

echo "=== $(date '+%F %T') start ===" >> "$LOG"

cd "$PROJ" || { echo "[FAIL] cd $PROJ" >> "$LOG"; exit 1; }

# 1) 抓数(akshare 新浪源)
if ! "$PY" scripts/build_data.py >> "$LOG" 2>&1; then
  echo "[FAIL] build_data.py" >> "$LOG"
  exit 1
fi

# 2) 判定是否有实质变化(忽略 generated_at 时间戳;JSON 为单行,故用语义比较)
if ! "$GIT" diff --quiet -- site/data/terminal.json; then
  if "$PY" - <<'PYEOF' >> "$LOG" 2>&1
import json, subprocess, sys
p = "site/data/terminal.json"
head = subprocess.run(["/usr/bin/git", "show", "HEAD:%s" % p],
                      capture_output=True, text=True)
if head.returncode != 0:
    sys.exit(2)  # 仓库中无此文件的历史版本 → 视为有变化
cur = json.load(open(p, encoding="utf-8"))
old = json.loads(head.stdout)
cur.pop("generated_at", None)
old.pop("generated_at", None)
sys.exit(0 if cur == old else 1)
PYEOF
  then
    # 仅时间戳变化:还原工作区,不提交
    "$GIT" checkout -- site/data/terminal.json
    echo "[no change]" >> "$LOG"
  else
    "$GIT" add site/data/terminal.json
    "$GIT" commit -m "data: 每日行情更新 $(date '+%Y-%m-%d')" >> "$LOG" 2>&1
    echo "[commit] $($GIT log --oneline -1)" >> "$LOG"
  fi
else
  echo "[no change]" >> "$LOG"
fi
echo "[done] $(date '+%F %T')" >> "$LOG"
