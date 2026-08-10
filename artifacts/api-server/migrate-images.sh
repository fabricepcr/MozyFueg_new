#!/usr/bin/env bash
# Bulk image migration via /api/admin/migrateImage
# Writes payload to tmp file to avoid "Argument list too long"

API="http://localhost:8080/api/admin/migrateImage"
PW="mozzarellayfuego123"
BASE="/tmp/menu_images"
SUPABASE_BASE="https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu"
PAYLOAD_FILE="/tmp/migrate_payload.json"

ok=0
fail=0
declare -a failed_list

migrate() {
  local file="$1"
  local supabase="$2"
  local full="$BASE/$file"
  local supabase_url="$SUPABASE_BASE/$supabase"

  if [ ! -f "$full" ]; then
    echo "❌ FILE NOT FOUND: $full"
    fail=$((fail+1)); failed_list+=("$supabase"); return
  fi

  local ext="${file##*.}"
  local ct
  case "${ext,,}" in
    jpg|jpeg) ct="image/jpeg" ;;
    png)      ct="image/png"  ;;
    webp)     ct="image/webp" ;;
    *)        ct="image/jpeg" ;;
  esac

  # Write payload to temp file — avoids ARG_MAX limit for large images
  python3 -c "
import base64, json, sys
with open(sys.argv[1],'rb') as f:
    b64 = base64.b64encode(f.read()).decode()
payload = {'supabaseUrl': sys.argv[2], 'base64': b64, 'contentType': sys.argv[3]}
with open('$PAYLOAD_FILE','w') as out:
    json.dump(payload, out)
" "$full" "$supabase_url" "$ct"

  local resp
  resp=$(curl -s -X POST "$API" \
    -H "Content-Type: application/json" \
    -H "x-admin-password: $PW" \
    --max-time 120 \
    --data @"$PAYLOAD_FILE")

  if echo "$resp" | grep -q '"success":true'; then
    ok=$((ok+1))
    local new_url
    new_url=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('newImageUrl',''))")
    echo "✅ $ok  ${file##*/}  →  $new_url"
  else
    fail=$((fail+1)); failed_list+=("$supabase")
    echo "❌ ${file##*/}: $resp"
  fi
}

# ── Pizzas ────────────────────────────────────────────────────────────────────
migrate "pizzas/Fotos menu/Amsterdam-WA0022.jpg"       "Amsterdam-WA0022.jpg"
migrate "pizzas/Fotos menu/Argentina-WA0017.jpg"       "Argentina-WA0017.jpg"
migrate "pizzas/Fotos menu/Atún-WA0042.jpg"            "Atun-WA0042.jpg"
migrate "pizzas/Fotos menu/Banana y canela-WA0040.jpg" "Banana%20y%20canela-WA0040.jpg"
migrate "pizzas/Fotos menu/Barbacoa-WA0052.jpg"        "Barbacoa-WA0052.jpg"
migrate "pizzas/Fotos menu/Calabresa-WA0035.jpg"       "Calabresa-WA0035.jpg"
migrate "pizzas/Fotos menu/Calabresaespecial.png"      "Calabresaespecial.png"
migrate "pizzas/Fotos menu/Caprese-WA0024.jpg"         "Caprese-WA0024.jpg"
migrate "pizzas/Fotos menu/Carioca-WA0046.jpg"         "Carioca-WA0046.jpg"
migrate "pizzas/Fotos menu/Carnívora-WA0009.jpg"       "Carnivora-WA0009.jpg"
migrate "pizzas/Fotos menu/Catalana-WA0033(1).jpg"     "Catalana-WA0033(1).jpg"
migrate "pizzas/Fotos menu/Crujiente-WA0013.jpg"       "Crujiente-WA0013.jpg"
migrate "pizzas/Fotos menu/Cuatroquesos.png"           "Cuatroquesos.png"
migrate "pizzas/Fotos menu/Del chef-WA0015.jpg"        "Del%20chef-WA0015.jpg"
migrate "pizzas/Fotos menu/Doritos.png"                "Doritos.png"
migrate "pizzas/Fotos menu/Dubai-WA0038.jpg"           "Dubai-WA0038.jpg"
migrate "pizzas/Fotos menu/Funghi-WA0044.jpg"          "Funghi-WA0044.jpg"
migrate "pizzas/Fotos menu/Granjera-WA0048.jpg"        "Granjera-WA0048.jpg"
migrate "pizzas/Fotos menu/Hawaiana Fuego-WA0006.jpg"  "Hawaiana%20Fuego-WA0006.jpg"
migrate "pizzas/Fotos menu/Ibérica.png"                "Iberica.png"
migrate "pizzas/Fotos menu/M&Ms.png"                   "M%26Ms.png"
migrate "pizzas/Fotos menu/Mafiosa.png"                "Mafiosa.png"
migrate "pizzas/Fotos menu/Marguerita.png"             "Marguerita.png"
migrate "pizzas/Fotos menu/Mozzarella-WA0021.jpg"      "Mozzarella-WA0021.jpg"
migrate "pizzas/Fotos menu/Picaña-WA0037.jpg"          "Picana-WA0037.jpg"
migrate "pizzas/Fotos menu/Piña Nevada-WA0039.jpg"     "Pina%20Nevada-WA0039.jpg"
migrate "pizzas/Fotos menu/Pizzaiolo-WA0011.jpg"       "Pizzaiolo-WA0011.jpg"
migrate "pizzas/Fotos menu/Portuguesa-WA0041.jpg"      "Portuguesa-WA0041.jpg"
migrate "pizzas/Fotos menu/Putanesca.png"              "Putanesca.png"
migrate "pizzas/Fotos menu/Ruffles-WA0030(1).jpg"      "Ruffles-WA0030.jpg"
migrate "pizzas/Fotos menu/Sensación-WA0051.jpg"       "Sensacion-WA0051.jpg"
migrate "pizzas/Fotos menu/Strogonoff-WA0019.jpg"      "Strogonoff-WA0019.jpg"
migrate "pizzas/Fotos menu/Tomateseco.png"             "Tomateseco.png"
migrate "pizzas/Fotos menu/Uva trufada-WA0043.jpg"    "Uva%20trufada-WA0043.jpg"
migrate "pizzas/Fotos menu/Vegetariana.png"            "Vegetariana.png"

# ── Bebidas ───────────────────────────────────────────────────────────────────
migrate "bebidas/agua-mineral-veri-330-ml-pack-35-botellas.jpg" "agua-mineral-veri-330-ml-pack-35-botellas.jpg"
migrate "bebidas/aquarius limon.jpeg"   "aquarius%20limon.webp"
migrate "bebidas/aquarius naranja.jpg"  "aquarius%20naranja.webp"
migrate "bebidas/cola cero.jpeg"        "coca%20cola%20zero.webp"
migrate "bebidas/fanta.jpeg"            "fanta%20de%20naranja.jpg"
migrate "bebidas/fusie tea.jpg"         "fusie%20tea.jpg"
migrate "bebidas/Guaraná.jpeg"          "guarana%20antartica.jpeg"
migrate "bebidas/lata-coca-cola.jpg"    "lata%20coca%20cola.jpg"
migrate "bebidas/sprite.jpeg"           "sprite.webp"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "=== DONE: $ok migrated, $fail failed ==="
if [ ${#failed_list[@]} -gt 0 ]; then
  echo "Not migrated:"; for f in "${failed_list[@]}"; do echo "  - $f"; done
fi
