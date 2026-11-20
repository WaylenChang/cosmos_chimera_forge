// Physical Google Drive folder naming contract (does not rename game IDs or files).
// Stable game IDs resolve to renamed physical Drive folders; transitional names remain readable.
(function (global) {
  "use strict";

  const ROOTS = new Set(["characters", "creatures", "moves"]);
  const SUBJECT_PREFIX = Object.freeze({
    characters: "chr",
    creatures: "ch",
    moves: "mv",
  });
  const LEGACY_CHARACTERS = Object.freeze({
    chr_1286: "chr_protagonist_yeh_chengxi",
    chr_1855: "chr_protagonist_amemori_sumiha",
    chr_3d04: "chr_protagonist_roen",
  });
  const CATEGORY_HELPERS = new Set([
    "designed_prompts", "prompts", "backup", "wiki", "reviews",
    "00_settings", "01_portraits", "01_portrait", "01_vfx", "01b_vfx",
    "02_3d", "02_review_portrait", "03_completed", "03a_colab",
    "03b_blender", "04_review_3d", "05_wiki",
  ]);

  function slug(value) {
    const raw = String(value || "").trim();
    if (!/^[a-z0-9_-]+$/i.test(raw)) {
      throw Error("Drive folder name must be English ASCII letters, digits, hyphens or underscores: " + raw);
    }
    const clean = raw.toLowerCase().replace(/-+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    if (!clean) throw Error("Drive folder name cannot be empty");
    return clean;
  }

  function subjectPattern(kind) {
    const prefix = SUBJECT_PREFIX[kind];
    if (!prefix) throw Error("Unknown Drive asset category: " + kind);
    return new RegExp("^" + prefix + "_[a-z0-9]+(?:_[a-z0-9]+)+$");
  }

  function isCompliant(kind, depth, folderName) {
    if (!ROOTS.has(kind)) return false;
    const name = String(folderName || "");
    if (depth === 0) return name === kind;
    if (depth === 1 && subjectPattern(kind).test(name) && !/^(?:chr|ch)_legacy_/.test(name)) return true;
    return /^_[a-z0-9]+(?:_[a-z0-9]+)*$/.test(name);
  }

  function canonicalFolderName(kind, depth, folderName) {
    const original = String(folderName || "");
    if (depth === 0 || !ROOTS.has(kind)) return original;
    const s = slug(original);
    if (depth > 1 || original.startsWith("_")) return "_" + s;

    if (CATEGORY_HELPERS.has(s)) return "_" + s;
    if (kind === "characters") {
      if (LEGACY_CHARACTERS[s]) return LEGACY_CHARACTERS[s];
      if (s.startsWith("chr_legacy_")) return "chr_protagonist_" + s.slice("chr_legacy_".length);
      if (subjectPattern(kind).test(s)) return s;
      if (s.startsWith("chr_")) return "chr_protagonist_" + s.slice(4);
      return "_" + s;
    }
    if (kind === "creatures") {
      if (s.startsWith("ch_legacy_")) return "ch_1st_batch_" + s.slice("ch_legacy_".length);
      if (subjectPattern(kind).test(s)) return s;
      if (s.startsWith("cr_")) return "ch_1st_batch_" + s.slice(3);
      if (s.startsWith("starter_")) return "ch_starter_" + s.slice(8);
      const boss = /^line_(.+)_trial_boss$/.exec(s);
      if (boss) return "ch_trial_boss_" + boss[1] + "_line";
      if (s.startsWith("line_")) return "ch_1st_batch_" + s;
      return "_" + s;
    }
    if (subjectPattern(kind).test(s)) return s;
    if (/^(?:fx_|vsl_|move_|[a-z]+_[a-z]+_)/.test(s)) return "mv_legacy_" + s;
    return "_" + s;
  }

  // Keep saved game subject IDs stable even when the physical Drive folder is renamed.
  function logicalSubjectId(kind, folderName) {
    const s = String(folderName || "");
    if (kind === "characters") {
      for (const [previous, current] of Object.entries(LEGACY_CHARACTERS)) {
        if (s === current || s === current.replace("chr_protagonist_", "chr_legacy_")) return previous;
      }
    }
    if (kind === "creatures") {
      if (s.startsWith("ch_1st_batch_line_")) return s.slice("ch_1st_batch_".length);
      if (s.startsWith("ch_1st_batch_")) return "cr_" + s.slice("ch_1st_batch_".length);
      if (s.startsWith("ch_legacy_line_")) return s.slice("ch_legacy_".length);
      if (s.startsWith("ch_legacy_")) return "cr_" + s.slice("ch_legacy_".length);
      if (s.startsWith("ch_starter_")) return "starter_" + s.slice("ch_starter_".length);
      const boss = /^ch_trial_boss_(.+)_line$/.exec(s);
      if (boss) return "line_" + boss[1] + "_trial_boss";
    }
    if (kind === "moves" && s.startsWith("mv_legacy_")) {
      return s.slice("mv_legacy_".length);
    }
    return s;
  }

  // The web application keeps using logical legacy step paths while physical Drive
  // directories use the leading underscore. Older already-prefixed backup folders
  // must retain their historical names.
  function logicalSubfolderName(folderName) {
    const name = String(folderName || "");
    if (/^_(?:empty_before_migration_|backup_pre_fix_)/.test(name)) return name;
    return name.startsWith("_") ? name.slice(1) : name;
  }

  function folderCandidates(kind, depth, folderName) {
    const original = String(folderName || "");
    const canonical = canonicalFolderName(kind, depth, original);
    if (depth !== 1 || canonical === original) return canonical === original ? [canonical] : [canonical, original];
    const former = canonical
      .replace(/^chr_protagonist_/, "chr_legacy_")
      .replace(/^ch_1st_batch_/, "ch_legacy_");
    return [...new Set([canonical, former, original])];
  }

  const api = Object.freeze({
    SUBJECT_PREFIX,
    canonicalFolderName,
    folderCandidates,
    isCompliant,
    logicalSubjectId,
    logicalSubfolderName,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.COSMI_DRIVE_NAMES = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
