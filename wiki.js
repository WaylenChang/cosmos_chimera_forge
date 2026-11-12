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
    const t=String(line).replace(/^[\s#*\uE000-\uF8FF-]+/g,"").trim();
    if(!t||/^(juvenile|adolescent|adult|overload)$/i.test(t))return "";
    const numbered=/^([1-4])[.、)）]\s*/.exec(t);
    const ordinal=/^(?:[1-4][.、)）]\s*)?第([一二三四])階段[：:]?/.exec(t);
    const bare=/^(幼年|少年|成年|超載)(?:期|型態|形態)\s*[(（]/.test(t);
    if(!numbered&&!ordinal&&!bare)return "";
    const candidates=STAGES;
    if(ordinal){
      const order=["一","二","三","四"].indexOf(ordinal[1]);
      if(numbered&&Number(numbered[1])!==order+1)return "";
      return candidates[order];
    }
    const first=t.slice(0,180);
    const explicit=/(juvenile|adolescent|adult|overload)/i.exec(first);
    const zh=/(幼年|少年|成年|超載)/.exec(first);
    const inferred=explicit?explicit[1].toLowerCase():zh?({幼年:"juvenile",少年:"adolescent",成年:"adult",超載:"overload"})[zh[1]]:"";
    if(numbered&&inferred&&Number(numbered[1])!==candidates.indexOf(inferred)+1)return "";
    return inferred;
  }
  function isLegacyChapterBoundary(line) {
    const t=String(line).trim();
    return /^(?:#{1,5}\s*)?(?:[二三四五六七八九十]+[、.．]|[2-9][.、]\s*(?:生態|專屬|生命|骨架|動畫|技術|材質|機制|Field|Ecolog|Evolution|Materials)|第[二三四五六七八九十]章|各階段(?:演化|外觀))/.test(t);
  }
  function splitLegacy(source, subject, stage, sourceFile="") {
    const id=cleanId(subject);
    if(!STAGES.includes(stage))throw Error("不支援的宙獸型態");
    const lines=String(source||"").replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n").split("\n");
    const starts=[];
    for(let i=0;i<lines.length;i++){
      const selected=headerStage(lines[i]);
      if(selected)starts.push({i,stage:selected});
    }
    // Different historical files use tables, prose headings, or both.
    // Prefer the complete four-form group with the richest per-form content.
    const groups=[];
    for(let i=0;i<=starts.length-4;i++){
      const group=starts.slice(i,i+4);
      if(group.every((x,j)=>x.stage===STAGES[j])){
        const score=[0,1,2].reduce((sum,j)=>sum+lines.slice(group[j].i,group[j+1].i).join("\n").length,0);
        groups.push({group,score});
      }
    }
    if(!groups.length)throw Error(id+" 缺少完整四型態段落，拒絕猜測或複製其他型態");
    groups.sort((a,b)=>b.score-a.score||a.group[0].i-b.group[0].i);
    const group=groups[0].group, pos=STAGES.indexOf(stage),current=group[pos];
    let end=pos<3?group[pos+1].i:lines.length;
    if(pos===3)for(let i=current.i+1;i<lines.length;i++){
      if(isLegacyChapterBoundary(lines[i])){end=i;break;}
    }
    const block=lines.slice(current.i,end).join("\n").trim();
    if(block.length<20)throw Error(id+" "+stage+" 專屬段落過短，需人工核對");
    const intro=lines.slice(0,Math.min(12,group[0].i))
      .filter(line=>/通用代號|圖鑑登錄|正式名稱|中文正式|分類|元素屬性|屬性相性|文明|棲息|戰鬥定位|學名|內部代號|宙獸代號|^#/.test(line))
      .join("\n").trim();
    return ["# "+id+" — "+STAGE_ZH[stage]+"型態宙獸圖鑑",
      "", "- subject_id: "+id, "- stage: "+stage,
      "- status: migrated / review_required",
      "- source_wiki: "+(sourceFile||id+"_wiki.md"), "",
      "## 系列基本資料",intro||"請參照原始系列圖鑑。", "",
      "## 本型態專屬設定",block, "",
      "## 原始資料與驗收",
      "系列共通生態與跨階演化資訊保留於 wiki/_legacy/creatures/ 的原始檔案。",
      "本文件只代表文字資料拆分，3D、骨架、動畫與立繪仍須人工審查。",
      ""].join("\n");
  }
  window.COSMI_WIKI=Object.freeze({ROOT,STAGES,STAGE_ZH,describe,initialMarkdown,splitLegacy,headerStage});
})();
