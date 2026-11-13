(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.COSMI_MODEL_REVIEW = api; api.install(); }
})(typeof window === "object" ? window : globalThis, function () {
  "use strict";
  const state = { linked: "" };
  const isModel = pkg => /model|rig|anim/.test(pkg?.type || "");

  // Drive model packages may be named asset_cr_* or asset_chr_* rather than mdl-*.
  // Classify by manifest task type first, retaining ID fallbacks for legacy ZIPs.
  function matchesCategory(pkg, category) {
    if (!pkg || category === "all") return true;
    if (category === "pending") return ["pending", "missing"].includes(pkg.status);
    const type = String(pkg.type || pkg.manifest?.task_type || "").toLowerCase();
    const id = String(pkg.id || "").toLowerCase();
    const model = /model|rig|anim/.test(type) || /^(?:mdl|anim)(?:[-_]|$)/.test(id);
    const creature = type.startsWith("creature-") || /^(?:asset_)?cr(?:[-_]|$)/.test(id);
    const character = type.startsWith("character-") || /^(?:asset_)?chr(?:[-_]|$)/.test(id);
    if (category === "mdl") return model;
    if (category === "cr") return creature;
    if (category === "chr") return character;
    if (category === "fx") return /vfx|effect/.test(type) || /^fx(?:[-_]|$)/.test(id);
    return true;
  }

  function exactBuffer(bytes) {
    if (ArrayBuffer.isView(bytes)) return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    if (bytes instanceof ArrayBuffer) return bytes.slice(0);
    throw Error("GLB 不是有效的二進位資料");
  }

  function relative(path) {
    if (typeof path !== "string" || !path || /[\\:?#\x00-\x1f]/.test(path) ||
        path.split("/").some(p => !p || p === "." || p === "..")) throw Error("驗收資源必須使用包內相對路徑");
    return path;
  }

  function selectRootManifest(paths) {
    return paths.filter(p => /(^|\/)manifest\.json$/.test(p))
      .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))[0] || "";
  }

  function selectModelFile(files, manifest = {}, descriptor = null) {
    const candidates = files.filter(f => /\.glb$/i.test(f.path));
    const declared = descriptor?.model?.path;
    if (declared) {
      relative(declared);
      const match = candidates.find(f => f.path === declared);
      if (!match) throw Error("驗收描述檔指定的最終 GLB 不存在：" + declared);
      return match;
    }
    const primary = (manifest.files || []).filter(f => f.kind === "model" && f.level === "L1" && /\.glb$/i.test(f.path));
    for (const entry of primary) {
      const match = candidates.find(f => f.path === entry.path);
      if (match) return match;
    }
    if (primary.length) throw Error("manifest 指定的最終 GLB 不存在，請確認交付檔案");
    const rank = f => f.path.startsWith("models/") ? 0 : f.path.startsWith("rig/") ? 1 : f.path.startsWith("source/") ? 2 : 3;
    return candidates.slice().sort((a, b) => rank(a) - rank(b) || a.path.localeCompare(b.path))[0] || null;
  }

  function descriptorFor(pkg) {
    const key = Object.keys(pkg.rawFiles || {}).find(p => p === "review_viewer.json" || p === pkg.id + "/review_viewer.json");
    if (!key) return null;
    const value = JSON.parse(new TextDecoder().decode(pkg.rawFiles[key]));
    if (value.spec !== "cosmimera-model-review/1") throw Error("不支援的 3D 驗收描述檔版本");
    return value;
  }

  function packageFiles(pkg) {
    return pkg.driveFiles || Object.keys(pkg.rawFiles || {}).map(key => ({
      key, path: key.startsWith(pkg.id + "/") ? key.slice(pkg.id.length + 1) : key
    }));
  }

  function orbitFor(descriptor) {
    const orbit = descriptor?.camera_orbit || "0deg 80deg auto";
    if (!/^-?\d+(?:\.\d+)?deg \d+(?:\.\d+)?deg (?:auto|\d+(?:\.\d+)?m)$/.test(orbit)) throw Error("相機方向設定無效");
    return orbit;
  }

  function open(pkg = null) {
    const all = window.COSMI_FORGE?.packages() || [];
    const active = pkg || window.COSMI_FORGE?.activePackage();
    const target = active || all.find(isModel) || all[0] || null;
    if (target) window.COSMI_FORGE?.openReviewPackage?.(target);
  }

  function onPackagesChanged() {
    const desired = new URL(window.location.href).searchParams.get("review");
    if (desired && state.linked !== desired) {
      const pkg = (window.COSMI_FORGE?.packages() || []).find(p => p.id === desired);
      if (pkg) {
        state.linked = desired;
        open(pkg);
      }
    }
  }

  function install() {
    document.addEventListener("DOMContentLoaded", onPackagesChanged);
  }

  return Object.freeze({
    selectRootManifest, selectModelFile, descriptorFor, packageFiles, matchesCategory,
    exactBuffer, relative, orbitFor, open, onPackagesChanged, install
  });
});
