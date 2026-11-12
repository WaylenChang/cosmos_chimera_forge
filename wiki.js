// Canonical stage-scoped wiki paths and conservative legacy family-wiki extraction.
(function () {
  "use strict";
  const ROOT = "wiki";
  const STAGES = Object.freeze(["juvenile", "adolescent", "adult", "overload"]);
  const STAGE_ZH = Object.freeze({juvenile:"幼年", adolescent:"少年", adult:"成年", overload:"超載"});
  const KIND = Object.freeze({characters:"角色", creatures:"宙獸", moves:"招式"});
  function cleanId(value) {
    const id=String(value||"").trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw Error("圖鑑主體 ID 格式無效");
    return id;
  }
  function kindFor(taskId) {
    if (taskId==="move-vfx") return "moves";
    if (String(taskId||"").startsWith("character")) return "characters";
    if (String(taskId||"").startsWith("creature")) return "creatures";
    throw Error("不支援此類型的圖鑑");
  }
  function describe(ctx) {
    const kind=kindFor(ctx?.task?.id), subject=cleanId(ctx?.subjectId||ctx?.taskId);
    const candidate=ctx?.opts?.stage||ctx?.concept?.stage||"";
    // Creatures have four independently maintained forms; characters may be un-staged.
    const stage=STAGES.includes(candidate)?candidate:(kind==="creatures"?"adult":"");
    const base=stage&&subject.endsWith("_"+stage)?subject.slice(0,-stage.length-1):subject;
    const path=ROOT+"/"+kind+"/"+base+(stage?"_"+stage:"")+"_wiki.md";
    return {kind,subject:base,stage,path,key:kind+"/"+base+(stage?"/"+stage:"")};
  }
  function initialMarkdown(ctx) {
    const d=describe(ctx), c=ctx.concept||{}, selected=c.locked?.stages?.find(s=>s.stage===d.stage)||{};
    const shared=["name_zh","name_en","elements","region","timeline","culture","bases",
      "base_parents","archetype","role","gender","age","height","ethnicity","biography","backstory_zh",
      "disposition","dex_zh","appearance_palette","hair_palette","eye_palette","outfit_palette"];
    const form=["creature_id","name_zh","name_en","stage","height_length","weight","size_class",
      "look","appearance","anatomy","limbs","signature_move","temperament","dex_zh","outfit",
      "accessories","silhouette_keywords"];
    const fields=[];
    for(const name of shared)if(c[name]!=null)fields.push("- "+name+": "+JSON.stringify(c[name]));
    for(const name of form)if(selected[name]!=null)fields.push("- "+name+": "+JSON.stringify(selected[name]));
    if(d.kind==="moves")for(const name of ["element","shape","tier","action","motion","name"])
      if(ctx.opts?.[name]!=null)fields.push("- "+name+": "+JSON.stringify(ctx.opts[name]));
    const title=selected.name_zh||c.name_zh||d.subject;
    return ["# "+title+" — "+(d.stage?STAGE_ZH[d.stage]+"型態 ":"")+KIND[d.kind]+"圖鑑",
      "",
      "- subject_id: "+d.subject,
      ...(d.stage?["- stage: "+d.stage]:[]),
      "- status: draft / review_required",
      "",
      "## 已提供的概念設定",
      fields.join("\n")||"尚無已確認的概念資料，請補充本型態設定。",
      "",
      "## 外觀、生態與動作",
      "待依此型態的已核准素材補充；不可複製其他型態描述冒充本型態。",
      "",
      "## 資產關聯與品質審查",
      "待關聯原始圖片／模型資產與人工 QA 紀錄；建立圖鑑不代表圖像或 3D 已通過審查。",
      ""].join("\n");
  }
  function headerStage(line) {
    const t=line.replace(/^[\s#*\-]+/g,"").trim();
    if(!t||t.length>165)return "";
    // Only structurally labeled form headings, never narrative mentions or animation rows.
    const numbered=/^[1-4][.、)）]\s*/.test(t)||/^第[一二三四]階段/.test(t);
    const bare=/^(幼年|少年|成年|超載)(?:期|型態|形態)\s*[(（]/.test(t);
    if(!numbered&&!bare)return "";
    const explicit=/juvenile|adolescent|adult|overload/i.exec(t);
    if(explicit)return explicit[0].toLowerCase();
    const zh=/幼年|少年|成年|超載/.exec(t);
    if(zh)return ({幼年:"juvenile",少年:"adolescent",成年:"adult",超載:"overload"})[zh[0]];
    const ordinal=/^第([一二三四])階段/.exec(t);
    return ordinal?STAGES[["一","二","三","四"].indexOf(ordinal[1])]:"";
  }
  function splitLegacy(source, subject, stage, sourceFile="") {
    const id=cleanId(subject);
    if(!STAGES.includes(stage))throw Error("不支援的宙獸型態");
    const lines=String(source||"").replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n").split("\n");
    // Stop at the second chapter; later ecological/animation prose may mention
    // other forms, and must not silently leak into the current form's entry.
    const chapter2=lines.findIndex((line,i)=>i>8 && /^(?:#{1,4}\s*)?(?:第二章|二、(?:生態|野外|棲息)|Chapter\s+2\b)/i.test(line.trim()));
    const limit=chapter2>=0?chapter2:lines.length;
    const starts=[];
    for(let i=0;i<limit;i++){const st=headerStage(lines[i]);if(st)starts.push({i,stage:st});}
    if(!starts.some(x=>x.stage===stage))throw Error(id+" 缺少 "+stage+" 專屬段落，拒絕以其他型態代替");
    const blocks=[];
    for(let n=0;n<starts.length;n++){
      const h=starts[n],end=n+1<starts.length?starts[n+1].i:limit;
      if(h.stage!==stage)continue;
      const part=lines.slice(h.i,end).join("\n").trim();
      if(part&&!blocks.includes(part))blocks.push(part);
    }
    const intro=lines.slice(0,starts[0].i).join("\n").trim();
    const context=intro.split("\n").filter(line=>!/\b(juvenile|adolescent|adult|overload)\b/.test(line))
      .join("\n").slice(0,1700).trim();
    return ["# "+id+" — "+STAGE_ZH[stage]+"型態宙獸圖鑑",
      "",
      "- subject_id: "+id,
      "- stage: "+stage,
      "- status: migrated / review_required",
      "- source_wiki: "+(sourceFile||id+"_wiki.md"),
      "",
      "## 本型態原始描述",
      blocks.join("\n\n"),
      "",
      "## 原系列共通背景（保留摘要）",
      context||"詳見舊版系列圖鑑備份。",
      "",
      "## 資產與驗收",
      "原始 3D、骨架、動作與立繪仍須逐項審查；本次僅拆分圖鑑內容，不宣稱資產已完成。",
      "系列其他型態與跨階進化資料保留於 wiki/_legacy/creatures/ 下的原始檔案。",
      ""].join("\n");
  }
  window.COSMI_WIKI=Object.freeze({ROOT,STAGES,STAGE_ZH,describe,initialMarkdown,splitLegacy,headerStage});
})();
