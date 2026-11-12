// Browser-side anatomy summary for the prompt forge. Unlike a creature's
// cultural archetype, this plan describes joint and motion requirements.
(function () {
  "use strict";
  const exact = Object.freeze({
    "生物·哺乳類": "quadruped", "生物·鳥類": "avian",
    "生物·爬蟲類": "quadruped", "生物·兩棲類": "quadruped",
    "生物·魚類": "aquatic", "生物·昆蟲": "hexapod",
    "生物·甲殼類": "octopod", "生物·軟體動物": "tentacled",
    "古生物·獸腳恐龍": "biped", "古生物·植食恐龍": "quadruped",
    "古生物·翼龍/飛行爬蟲": "avian",
    "古生物·古海洋爬蟲/巨魚": "aquatic",
    "古生物·早古節肢/無脊椎": "hexapod",
    "古生物·新生代史前哺乳": "quadruped"
  });
  const prefixes = [
    ["植物·", "plant"], ["自然·", "amorphous"], ["物質·", "object"],
    ["造物·", "mechanism"], ["裝備·", "mechanism"], ["器械·", "mechanism"],
    ["載具·", "mechanism"], ["科幻機械·機甲/外骨骼", "humanoid_mecha"],
    ["科幻機械·仿生機獸", "quadruped_mecha"], ["科幻機械·", "mechanism"],
    ["類人奇幻·", "biped"], ["幻想生物·", "hybrid"]
  ];
  const rigid = new Set(["mechanism","humanoid_mecha","quadruped_mecha","multi_leg_mecha","object"]);
  const labels = Object.freeze({
    biped:"兩足人形", quadruped:"四足生物", hexapod:"六足生物",
    octopod:"八足生物", serpentine:"蛇形長軀", aquatic:"水生魚形",
    avian:"鳥類與翅膀", winged_quadruped:"四足雙翼",
    winged_biped:"兩足雙翼", tentacled:"觸手／軟體",
    plant:"植物", amorphous:"能量／不定形",
    object:"無機物", mechanism:"機械分件", humanoid_mecha:"人形機甲",
    quadruped_mecha:"四足機獸", multi_leg_mecha:"多足機械", hybrid:"混合／待核對"
  });
  const rigs = Object.freeze({
    biped:"biped skinning", quadruped:"quadruped skeleton",
    hexapod:"multi-leg skeleton", octopod:"multi-leg skeleton",
    serpentine:"spine spline chain", aquatic:"spine and fins",
    avian:"wing and body chains", winged_quadruped:"four legs and separate wings",
    winged_biped:"two legs and separate wings", tentacled:"independent tentacle chains",
    plant:"flexible stem chains", amorphous:"shape keys or material animation",
    object:"object transform", mechanism:"rigid parts with explicit pivots",
    humanoid_mecha:"rigid armor with constrained joints",
    quadruped_mecha:"four rigid limbs and constrained joints",
    multi_leg_mecha:"rigid multi-leg kinematics",
    hybrid:"custom anatomy landmarks and per-part rigging"
  });
  function plan(kind, concept, route) {
    if (kind === "move") return null;
    const parents = concept?.base_parents || concept?.base_parents_locked || [];
    const list = Array.isArray(parents) ? parents : [parents];
    const matched = list.filter(Boolean).map(p => {
      const name = typeof p === "string" ? p : p?.v || "";
      return exact[name] || prefixes.find(([prefix]) => name.startsWith(prefix))?.[1] || null;
    }).filter(Boolean);
    const unique = [...new Set(matched)];
    let anatomy = kind === "character" ? "biped" : unique.length === 1 ? unique[0] : "hybrid";
    // Explicit model topology is authoritative over visual catalog origins.
    const declared = concept?.anatomy || concept?.topology;
    if (declared && Object.prototype.hasOwnProperty.call(labels, declared)) anatomy = declared;
    const limbs = concept?.limbs || {};
    if (!declared && !rigid.has(anatomy)) {
      if (limbs.legs === 4 && limbs.wings > 0) anatomy = "winged_quadruped";
      else if (limbs.legs === 2 && limbs.wings > 0) anatomy = "winged_biped";
      else if (limbs.tentacles > 0 && !limbs.legs) anatomy = "tentacled";
      else if (limbs.legs === 8) anatomy = "octopod";
      else if (limbs.legs === 6) anatomy = "hexapod";
    }
    return {anatomy, label:labels[anatomy], rig:rigs[anatomy],
      input_mode:route === "text" ? "text" : "image",
      review_required:anatomy === "hybrid"};
  }
  window.COSMI_ANATOMY = Object.freeze({plan,labels,rigs,exact});
})();
