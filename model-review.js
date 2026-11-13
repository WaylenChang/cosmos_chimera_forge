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

  // One subject = one review-desk row. Catalog designs and real Drive packages
  // are views of the same subject, never separate items in the rail.
  function unifiedEntries(packages = [], creatures = [], characters = [], category = "all", search = "") {
    const norm = value => String(value || "").trim().toLowerCase();
    const base = value => norm(value)
      .replace(/^asset_(?=(?:cr|chr)[_-])/, "")
      .replace(/[-_](juvenile|adolescent|adult|overload)$/, "");
    const catalogs = new Map(), aliases = new Map(), groups = new Map();
    const addCatalog = (kind, id, label, item, ids) => {
      if (!id) return;
      const key = kind + ":" + norm(id);
      catalogs.set(key, { kind, id, label, item });
      for (const alias of ids) {
        if (norm(alias)) aliases.set(norm(alias), key);
        if (base(alias)) aliases.set(base(alias), key);
      }
    };
    for (const d of creatures) {
      addCatalog("creature", d.line_id, [d.code_zh, d.title_zh].filter(Boolean).join(" · ") || d.line_id, d,
        [d.line_id, ...(d.concept?.locked?.stages || []).map(s => s.creature_id)]);
    }
    for (const c of characters) {
      addCatalog("character", c.id, [c.name_zh, c.name_en].filter(Boolean).join(" · ") || c.id, c, [c.id]);
    }
    const byId = new Map(packages.map(p => [norm(p.id), p]));
    const resolveCatalog = p => {
      const src = byId.get(norm(p.manifest?.source_pack));
      const ids = [p.subjectId, p.manifest?.subject_id, p.concept?.line_id,
        p.concept?.creature_id, p.concept?.id, src?.subjectId,
        src?.manifest?.subject_id, p.baseId, p.groupKey, p.id];
      for (const id of ids) {
        const match = aliases.get(norm(id)) || aliases.get(base(id));
        if (match) return match;
      }
      return "";
    };
    const ensure = (key, fallback) => {
      if (!groups.has(key)) {
        const design = catalogs.get(key) || null;
        groups.set(key, { key, label: design?.label || fallback || key,
          catalog: design, packages: [] });
      }
      return groups.get(key);
    };
    for (const p of packages) {
      const catalogKey = resolveCatalog(p);
      const src = byId.get(norm(p.manifest?.source_pack));
      const subject = base(p.subjectId || p.manifest?.subject_id ||
        p.concept?.line_id || p.concept?.creature_id || p.concept?.id ||
        src?.subjectId || src?.manifest?.subject_id || p.groupKey || p.baseId || p.id);
      const key = catalogKey || "subject:" + (subject || norm(p.id));
      ensure(key, p.subjectId || p.manifest?.subject_id || subject || p.id).packages.push(p);
    }
    for (const [key, design] of catalogs) ensure(key, design.label);
    const q = norm(search);
    return [...groups.values()].filter(g => {
      const accepted = g.packages.some(p => ["ok", "approved", "provisional"].includes(p.status));
      if (category === "designed") {
        if (!g.catalog && !accepted) return false;
      } else if (category === "pending") {
        if (!g.packages.some(p => matchesCategory(p, "pending"))) return false;
      } else if (category !== "all") {
        const kindMatch = (category === "cr" && g.catalog?.kind === "creature") ||
          (category === "chr" && g.catalog?.kind === "character");
        if (!kindMatch && !g.packages.some(p => matchesCategory(p, category))) return false;
      }
      return !q || [g.label, g.key, g.catalog?.id,
        ...g.packages.flatMap(p => [p.id, p.subjectId, p.manifest?.source_pack, p.drivePath])
      ].some(v => norm(v).includes(q));
    }).map(g => ({
      ...g,
      star: g.packages.some(p => ["ok", "approved"].includes(p.status)) ? "★"
        : (g.catalog || g.packages.some(p => p.status === "provisional")) ? "☆" : "",
      starTitle: g.packages.some(p => ["ok", "approved"].includes(p.status)) ? "審查通過"
        : g.packages.some(p => p.status === "provisional") ? "暫時採用" : g.catalog ? "已有設計，尚未審查通過" : "",
      visiblePackages: ["pending", "chr", "cr", "mdl", "fx"].includes(category)
        ? g.packages.filter(p => matchesCategory(p, category)) : g.packages
    }));
  }

  // Keep the active package only when it is present in the selected category.
  // A catalog design and its Blender model may share one subject-level row.
  function preferredVisiblePackage(entries = [], activeId = "") {
    const shown = entries.flatMap(entry => entry.visiblePackages || []);
    return shown.find(pkg => pkg.id === activeId) || shown[0] || null;
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
    selectRootManifest, selectModelFile, descriptorFor, packageFiles, matchesCategory, unifiedEntries, preferredVisiblePackage,
    exactBuffer, relative, orbitFor, open, onPackagesChanged, install
  });
});
