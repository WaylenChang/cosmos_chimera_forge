// Physical Drive folder and subject-file naming contract (never mutate stable game IDs).
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

  
  // Subject file naming is independent of stable game IDs and folder aliases.
  // Only files INSIDE a subject folder use this contract; category templates and
  // the historical migration backup keep their own names.
  const FORM_INDEX = Object.freeze({juvenile: 1, adolescent: 2, adult: 3, overload: 4});
  const FORM_STAGES = Object.freeze(["juvenile", "adolescent", "adult", "overload"]);
  const FILE_STEPS = Object.freeze([
    "00_appearance", "00_parameters", "01_portrait", "01b_vfx",
    "02_review_portrait", "03a_colab", "03b_blender", "04_review_3d", "05_wiki",
  ]);
  const FILE_TOKEN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
  const VERSION_TOKEN = /^(?:v[1-9][0-9]*|draft(?:_[a-z0-9]+)*|legacy(?:_[a-z0-9]+)*|[0-9]{8}(?:_[0-9]{4})?)$/;
  const EXTENSION_TOKEN = /^(?:[a-z0-9]+|prompt\.md)$/;

  function fileRole(role) {
    const value = String(role || "").toLowerCase().trim();
    if (!FILE_TOKEN.test(value)) throw Error("Asset file function must be an ASCII snake-case token: " + role);
    return value;
  }

  function stageIndex(value) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 4) return value;
    if (typeof value === "string" && /^[1-4]$/.test(value)) return Number(value);
    return FORM_INDEX[String(value || "").toLowerCase()] || 0;
  }

  // "final" must reflect actual approval/publication; merely producing a GLB
  // or a wiki draft does not make it an approved final deliverable.
  function assetFilename({kind, folderName, role, stage, step = "", version = "", final = false, ext} = {}) {
    if (!ROOTS.has(kind) || !isCompliant(kind, 1, folderName))
      throw Error("Asset filename requires a canonical physical subject folder");
    const func = fileRole(role);
    const extension = String(ext || "").toLowerCase().replace(/^\./, "");
    if (!EXTENSION_TOKEN.test(extension)) throw Error("Unsupported asset extension: " + ext);
    const i = stageIndex(stage);
    if (kind === "creatures" && !i) throw Error("Creature asset filenames require an explicit 1-4 form");
    if (kind !== "creatures" && stage !== undefined && stage !== null && stage !== "")
      throw Error("Character/move assets must not have a creature form");
    const suffix = kind === "creatures" ? "_form" + i : "";
    if (final) {
      if (step || version) throw Error("Final filename must omit pipeline step and version");
      return folderName + "_" + func + suffix + "." + extension;
    }
    if (!FILE_STEPS.includes(step)) throw Error("Nonfinal file requires a known pipeline step");
    if (!VERSION_TOKEN.test(String(version))) throw Error("Nonfinal file requires a version label");
    return folderName + "_" + func + suffix + "_" + step + "_" + version + "." + extension;
  }

  // Strict, reversible parse (requires the physical subject folder as context).
  // Files without a form, including cross-form shared creature prompts/tools,
  // deliberately do NOT pass as stage-specific deliverables.
  function parseSubjectFilename(kind, folderName, filename) {
    if (!ROOTS.has(kind) || !isCompliant(kind, 1, folderName)) return null;
    const name = String(filename || "");
    const prefix = folderName + "_";
    if (!name.startsWith(prefix) || name.includes("/") || name.includes("\\") || /[^\x20-\x7e]/.test(name)) return null;
    const extMatch = /(\.prompt\.md|\.[a-z0-9]+)$/i.exec(name);
    if (!extMatch) return null;
    const ext = extMatch[1].slice(1).toLowerCase();
    let rest = name.slice(prefix.length, -extMatch[1].length);
    let stage = "", form = 0;
    if (kind === "creatures") {
      const m = /_form([1-4])(?=_|$)/.exec(rest);
      if (!m || /_form[1-4](?=_|$)/.test(rest.slice(m.index + m[0].length))) return null;
      form = Number(m[1]);
      stage = FORM_STAGES[form - 1];
      const before = rest.slice(0, m.index);
      const after = rest.slice(m.index + m[0].length);
      rest = before + "||" + after;
    } else if (/_form[1-4](?:_|$)/.test(rest)) {
      return null;
    }
    const split = rest.split("||");
    if (split.length > 2) return null;
    const before = split[0];
    let after = kind === "creatures" ? split[1] : "";
    let role = before;
    let step = "", version = "";
    if (kind !== "creatures") {
      // Step markers are unambiguous because they contain a numeric pipeline code.
      for (const candidate of FILE_STEPS) {
        const needle = "_" + candidate + "_";
        const at = rest.lastIndexOf(needle);
        if (at > 0) {
          role = rest.slice(0, at);
          step = candidate;
          version = rest.slice(at + needle.length);
          break;
        }
      }
    } else if (after) {
      if (!after.startsWith("_")) return null;
      for (const candidate of FILE_STEPS) {
        const marker = "_" + candidate + "_";
        if (after.startsWith(marker)) {
          step = candidate;
          version = after.slice(marker.length);
          break;
        }
      }
      if (!step) return null;
    }
    if (!FILE_TOKEN.test(role)) return null;
    const final = !step;
    if (!final && !VERSION_TOKEN.test(version)) return null;
    const result = {kind, folderName, role, stage, form, step, version, final, ext};
    return assetFilename(result) === name ? result : null;
  }

  function isCompliantSubjectFilename(kind, folderName, filename) {
    return parseSubjectFilename(kind, folderName, filename) !== null;
  }

  const api = Object.freeze({
    SUBJECT_PREFIX,
    FORM_INDEX,
    FORM_STAGES,
    FILE_STEPS,
    assetFilename,
    parseSubjectFilename,
    isCompliantSubjectFilename,
    stageIndex,
    canonicalFolderName,
    folderCandidates,
    isCompliant,
    logicalSubjectId,
    logicalSubfolderName,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.COSMI_DRIVE_NAMES = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
