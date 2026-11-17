// Shared by the stop-script tools: loads the hand-written scripts and works out each one's lock fingerprint.
// A script is LOCKED when audio/locks.json holds the fingerprint of its words as they are now. Nothing is ever voiced
// unless it is locked (Richard, Nov 17: "Make sure the script is locked down first"). Editing a locked script changes
// its fingerprint, so it counts as a new draft until it is checked and locked again (node tools/script-lock.mjs <id>).
import fs from "node:fs"; import vm from "node:vm"; import crypto from "node:crypto";
export function loadScripts() {
  const code = fs.readFileSync("src/features/stop-scripts.js", "utf8");
  const noop = () => {}, ctx = vm.createContext({ partSpeech: noop, speakText: noop, speakSite: noop, updateAudioUI: noop });
  return vm.runInContext(code + "\n;({ S: STOP_SCRIPTS, say: sayText })", ctx);
}
export const fingerprint = sc => crypto.createHash("sha256").update(JSON.stringify([sc.id, sc.title, sc.parts.map(p => [p.name, p.stand || "", p.paras])])).digest("hex").slice(0, 20);
export const LOCKS = "audio/locks.json";
export const readLocks = () => fs.existsSync(LOCKS) ? JSON.parse(fs.readFileSync(LOCKS, "utf8")) : {};
export const isLocked = (sc, locks = readLocks()) => !!locks[sc.id] && locks[sc.id].fp === fingerprint(sc);
export const paraHash = text => crypto.createHash("sha1").update("aura-2:aurora:" + text).digest("hex").slice(0, 16);
