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
    // The "Beta 2" tag sits beside the logo or the trip name, where nothing is tapped (outside review, Nov 20: a badge
    // pinned to the corner covered the menu's Settings or Trip label on every screen).
    var css = document.createElement("style");
    css.textContent = ".b2tag{display:inline-block;vertical-align:middle;margin-left:8px;background:#E8792B;color:#fff;font:700 11px/1 system-ui,sans-serif;padding:4px 6px;border-radius:4px;letter-spacing:.02em;pointer-events:none;white-space:nowrap}.tabs .b2tag{display:none;margin:2px auto 6px;align-self:center}@media (min-width:800px) and (min-height:560px){html.railnav .tabs .b2tag{display:inline-block}html.railnav .brand .b2tag{display:none}}";
    document.head.appendChild(css);
    var mk = function () { var b = document.createElement("span"); b.className = "b2tag"; b.textContent = "Beta 2"; b.setAttribute("aria-hidden", "true"); return b; };
    var logo = document.querySelector(".brand h1"), home = document.querySelector(".tabs .railhome");
    if (logo) logo.appendChild(mk());
    if (home) home.parentNode.insertBefore(mk(), home.nextSibling);
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
// Beta 2 looks blue where the demo app is green: the same colours turned to a blue hue (same lightness and strength).
// Walking keeps its green (each way of getting around has its own colour; the train is already blue).
h = h.replace(/--t-walk: #146B61/g, "--t-walk: @@W1").replace(/--t-walk: #4CC2B0/g, "--t-walk: @@W2");
for (const [a, b] of [["#146B61", "#143B6B"], ["#4CC2B0", "#4C81C2"], ["#DCEEEA", "#DCE4EE"], ["#143A36", "#14253A"], ["#123C3A", "#12253C"], ["#E8F1EE", "#E8ECF1"]]) h = h.split(a).join(b).split(a.toLowerCase()).join(b);
h = h.replace(/@@W1/g, "#146B61").replace(/@@W2/g, "#4CC2B0");
fs.writeFileSync("beta2-site/index.html", h);' "$PRE"
rm -f "$PRE"
cp version.txt beta2-site/
# Beta 2's own offline store name, so its updates and the demo app's never delete each other's saved copy.
sed 's/^const APP = "kairoute";/const APP = "kairoute-b2";/' sw.js > beta2-site/sw.js
grep -q '^const APP = "kairoute-b2";' beta2-site/sw.js || { echo "beta2-site/sw.js: offline store name not set"; exit 1; }
echo "Beta 2 app: beta2-site/index.html ($(wc -c < beta2-site/index.html) bytes)"
