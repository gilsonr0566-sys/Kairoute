#!/bin/sh
# Builds the Beta 2 app (a second copy of Kairoute, planned by the new engine) into beta2-site/index.html.
# Same app as build.sh, plus, ahead of everything else:
#  - its own storage: every saved key is kept under "b2:" so this copy never reads over or writes into the main app's
#    trips on the same web address family; on its first start it copies the main app's trips in once (read only);
#  - the new engine (src/engine/) and the places files (tools/places/data), and ENGINE2 = true so the app's plans
#    come from the new engine (src/features/zz-engine2.js).
set -e
cd "$(dirname "$0")"
sh build.sh
mkdir -p beta2-site
PRE=beta2-site/prelude.js
{
  cat <<'EOF'
var ENGINE2 = true;
(function () {
  // Separate storage for the Beta 2 copy (same origin as the main app): keys live under "b2:".
  var ls; try { ls = window.localStorage; } catch (e) { return; }
  var P = "b2:", NEVER = /^kairoute\.(sync|group|devid2|deleted)/;
  try {
    if (!ls.getItem(P + "__copied")) {
      for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && k.indexOf(P) !== 0 && /^kairoute/.test(k) && !NEVER.test(k)) ls.setItem(P + k, ls.getItem(k)); }
      ls.setItem(P + "__copied", String(Date.now()));
    }
  } catch (e) {}
  var shim = {
    getItem: function (k) { return ls.getItem(P + k); },
    setItem: function (k, v) { ls.setItem(P + k, v); },
    removeItem: function (k) { ls.removeItem(P + k); },
    clear: function () { var ks = []; for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && k.indexOf(P) === 0) ks.push(k); } ks.forEach(function (k) { ls.removeItem(k); }); },
    key: function (n) { var ks = []; for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && k.indexOf(P) === 0 && k !== P + "__copied") ks.push(k.slice(P.length)); } return ks[n] == null ? null : ks[n]; },
    get length() { var c = 0; for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && k.indexOf(P) === 0 && k !== P + "__copied") c++; } return c; }
  };
  try { Object.defineProperty(window, "localStorage", { configurable: true, get: function () { return shim; } }); } catch (e) {}
  addEventListener("DOMContentLoaded", function () {
    document.title = "Kairoute Beta 2";
    var b = document.createElement("div"); b.textContent = "Beta 2"; b.setAttribute("aria-hidden", "true");
    b.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:99999;background:#E8792B;color:#fff;font:600 12px/1 system-ui,sans-serif;padding:5px 8px;border-radius:10px;opacity:.9;pointer-events:none";
    document.body.appendChild(b);
  });
})();
EOF
  cat src/engine/*.js
  printf '\nvar PLACES2 = {};\n'
  for f in tools/places/data/*.json; do node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1]));process.stdout.write("PLACES2["+JSON.stringify(p.key)+"]="+JSON.stringify(p)+";\n")' "$f"; done
} > "$PRE"
node -e '
const fs = require("fs"); let h = fs.readFileSync("index.html", "utf8"); const pre = fs.readFileSync(process.argv[1], "utf8");
const at = h.indexOf("<script>"); if (at < 0) throw new Error("no script tag");
h = h.slice(0, at) + "<script>\n" + pre.replace(/<\/script/gi, "<\\/script") + "\n</script>\n" + h.slice(at);
h = h.replace("<meta name=\"apple-mobile-web-app-title\" content=\"Kairoute\">", "<meta name=\"apple-mobile-web-app-title\" content=\"Kairoute B2\">");
fs.writeFileSync("beta2-site/index.html", h);' "$PRE"
rm -f "$PRE"
cp version.txt beta2-site/
echo "Beta 2 app: beta2-site/index.html ($(wc -c < beta2-site/index.html) bytes)"
