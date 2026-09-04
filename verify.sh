#!/bin/bash
# hermes-verify-pigwatch: PIGWATCH 静态站点冒烟验证（ad-hoc，非正式测试套件）
set -u
SITE=/Users/miaomiaomiao/Desktop/pig-cycle-terminal/site
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FAIL=0

echo "== 1. JS syntax (node --check)"
for f in home.js terminal.js sw.js; do
  if node --check "$SITE/$f" 2>/tmp/hv-err; then
    echo "  ok  $f"
  else
    echo "  FAIL $f: $(cat /tmp/hv-err)"; FAIL=1
  fi
done

echo "== 2. JSON validity"
node -e 'const d=require("/Users/miaomiaomiao/Desktop/pig-cycle-terminal/site/data/terminal.json");
for (const k of ["stats","chart","note","ratio_bands"]) if (!d[k]) throw new Error("missing "+k);
const c = d.chart;
if (!(c.dates.length === c.lh.length && c.lh.length === c.ratio.length && c.ratio.length === c.feed_idx.length))
  throw new Error("chart length mismatch");
if (!(d.stats.ratio > 0 && d.stats.lh_close > 0)) throw new Error("bad stats");
console.log("  ok  terminal.json pts=" + c.dates.length + " asof=" + d.stats.asof);' || FAIL=1

echo "== 3. HTTP 200 on assets"
for p in index.html terminal.html capacity.html notes.html home.css terminal.css home.js terminal.js capacity.js pwa-install.js data/terminal.json data/capacity.json assets/echarts.min.js assets/card-cycle.svg assets/card-capacity.svg assets/card-feed.svg assets/card-curve.svg assets/card-season.svg assets/card-note.svg manifest.webmanifest sw.js icons/icon-192.png icons/icon-512.png; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8765/$p")
  if [ "$code" = 200 ]; then echo "  ok  $p"; else echo "  FAIL $p -> $code"; FAIL=1; fi
done

echo "== 4. headless render (4 pages)"
check_page() {
  local page="$1" min_canvas="$2" grep_pat="$3" label="$4"
  dom=$("$CHROME" --headless --disable-gpu --virtual-time-budget=6000 --dump-dom "http://127.0.0.1:8765/$page" 2>/dev/null)
  canvases=$(printf '%s' "$dom" | grep -c "<canvas")
  if [ "$canvases" -ge "$min_canvas" ] && printf '%s' "$dom" | grep -q "$grep_pat"; then
    echo "  ok  $label ($canvases canvas)"
  else
    echo "  FAIL $label canvas=$canvases"; return 1
  fi
}
check_page index.html 0 'id="hero-lh-price"[^<]*元/吨' "index price filled" || FAIL=1
check_page terminal.html 5 'id="terminal-note"[^>]*>[^<]\{5,\}' "terminal 5 charts" || FAIL=1
check_page capacity.html 1 'id="capacity-meta">[^<]\{5,\}' "capacity chart" || FAIL=1
dom_notes=$("$CHROME" --headless --disable-gpu --virtual-time-budget=4000 --dump-dom "http://127.0.0.1:8765/notes.html" 2>/dev/null)
if printf '%s' "$dom_notes" | grep -q 'id="note-001"' && printf '%s' "$dom_notes" | grep -q 'id="note-002"'; then
  echo "  ok  notes two articles"
else
  echo "  FAIL notes"; FAIL=1
fi

echo
if [ $FAIL -eq 0 ]; then echo "RESULT: PASS"; else echo "RESULT: FAIL"; fi
rm -f /tmp/hv-err
exit $FAIL
