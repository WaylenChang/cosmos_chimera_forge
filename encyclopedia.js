(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.COSMI_ENCYCLOPEDIA = api;
  if (root?.document) root.document.addEventListener("DOMContentLoaded", () => api.install(root));
})(typeof window === "undefined" ? null : window, function () {
  "use strict";
  const CATALOG_PATHS = Object.freeze(["characters/encyclopedia.json", "creatures/encyclopedia.json", "moves/encyclopedia.json"]);
  const FIELDS = Object.freeze({appearance:"外觀／招式意象",summary:"簡介",ecology:"生態分析",habits:"習性",habitat:"棲地觀察",reproduction:"出生與繁殖",growth:"發育與演化階段",social_structure:"社會結構",occupation:"職業",biography:"生平",race:"種族",physique:"體型",likes:"喜好",dislikes:"厭惡",description:"招式世界觀描述"});
  const HIDDEN_GAME_FIELDS = new Set(["effects", "field_effects", "value_refs"]);

  function project(entry, level) {
    if (!["unknown", "basic", "complete", "author"].includes(level)) throw Error("無效的預覽狀態");
    if (level === "unknown") return {kind:entry.kind,basic:{name_zh:"？？？"}};
    const result = {kind:entry.kind,stage:entry.stage,basic:structuredClone(entry.basic)};
    if (level === "complete" || level === "author") result.details = structuredClone(entry.details);
    if (level === "author") Object.assign(result, {id:entry.id,status:entry.status,sources:structuredClone(entry.sources),assets:structuredClone(entry.assets)});
    return result;
  }
  function title(entry, level) {
    const visible = project(entry, level);
    return visible.basic.name_zh || visible.basic.name_en || "資料待補";
  }
  function filter(entries, kind, query, level) {
    const search = String(query || "").trim().toLocaleLowerCase();
    return entries.filter(entry => (!kind || entry.kind === kind) && (!search ||
      (level !== "unknown" && title(entry,level).toLocaleLowerCase().includes(search))));
  }
  function visibleValues() {
    // Game stats/values are strictly managed in cosmos_chimera & Game Data tab (🌌), never mixed into Wiki.
    return [];
  }

  function install(win) {
    const doc=win.document, button=doc.getElementById("viewBtnEncyclopedia");
    if (!button) return;
    const dialog=doc.createElement("dialog"); dialog.className="encyclopedia-dialog";
    dialog.setAttribute("aria-label","角色、宙獸與技能圖鑑");
    const heading=doc.createElement("h2"); heading.textContent="角色／宙獸／技能圖鑑";
    const close=doc.createElement("button"); close.className="btn ghost"; close.textContent="關閉圖鑑"; close.type="button";
    const toolbar=doc.createElement("div"); toolbar.className="encyclopedia-toolbar";
    const category=doc.createElement("select"); category.setAttribute("aria-label","圖鑑分類");
    for(const [value,label] of [["","全部"],["character","角色"],["creature","宙獸"],["skill","技能"]]) category.add(new Option(label,value));
    const level=doc.createElement("select"); level.setAttribute("aria-label","資料可見狀態");
    for(const [value,label] of [["author","作者全覽（待審內容）"],["unknown","玩家：未知"],["basic","玩家：基本資料"],["complete","玩家：完整資料"]]) level.add(new Option(label,value));
    const search=doc.createElement("input"); search.type="search"; search.placeholder="搜尋已公開名稱"; search.setAttribute("aria-label","搜尋圖鑑");
    const reload=doc.createElement("button"); reload.className="btn"; reload.type="button"; reload.textContent="從 Drive 重新讀取";
    const openGameData=doc.createElement("button"); openGameData.className="btn ghost"; openGameData.type="button"; openGameData.textContent="🌌 遊戲數值與關係";
    openGameData.addEventListener("click",()=>{dialog.close();doc.getElementById("viewBtnGameData")?.click();});
    const status=doc.createElement("p"); status.setAttribute("role","status"); status.setAttribute("aria-live","polite");
    const body=doc.createElement("div"); body.className="encyclopedia-body";
    const list=doc.createElement("div"); list.className="encyclopedia-list";
    const details=doc.createElement("article"); details.className="encyclopedia-details";
    toolbar.append(category,level,search,reload,openGameData,close); body.append(list,details); dialog.append(heading,toolbar,status,body); doc.body.append(dialog);
    let entries=[], active=null, generation=0, portraitUrl=null;
    const revoke=()=>{if(portraitUrl){URL.revokeObjectURL(portraitUrl);portraitUrl=null;}};
    const clear=()=>{generation++;revoke();entries=[];active=null;list.replaceChildren();details.replaceChildren();};
    function line(parent,tag,text){const node=doc.createElement(tag);node.textContent=text;parent.append(node);return node;}
    async function renderDetails(entry) {
      revoke(); details.replaceChildren(); active=entry;
      const visible=project(entry,level.value), token=++generation;
      line(details,"h3",title(entry,level.value));
      if(level.value==="unknown"){line(details,"p",entry.kind==="creature"?"遭遇後開放基本資料，捕獲後完整解鎖。":entry.kind==="character"?"初次對話開放基本資料，完成角色任務後完整解鎖。葉澄汐、洛恩為開局完整解鎖例外。":"首次目擊施放開放基本資料，取得後完整解鎖。");return;}
      if(entry.authored_fields?.length)line(details,"p","含新設計內容・待審");
      if(visible.stage)line(details,"p",({juvenile:"幼年",adolescent:"少年",adult:"成年",overload:"超載"})[visible.stage]);
      for(const group of [visible.basic,visible.details]) if(group)for(const [key,value] of Object.entries(group)){
        if(key.startsWith("name_")||HIDDEN_GAME_FIELDS.has(key))continue;
        line(details,"h4",FIELDS[key]||key);line(details,"p",value==null?"資料待補":Array.isArray(value)?value.join("、"):String(value));
      }
      if(level.value==="basic")line(details,"p","捕獲／角色任務／取得技能後，才顯示完整資料。資料待補與玩家未解鎖是不同狀態。");
      if(level.value==="author"){
        line(details,"p","內容狀態："+entry.status+"；此頁不代表美術資產已核准。");
        for(const source of visible.sources)if(source.storage==="drive"){
          const link=line(details,"a",source.path);link.href="https://drive.google.com/file/d/"+encodeURIComponent(source.drive_file_id)+"/view";link.target="_blank";link.rel="noopener noreferrer";
        }
      }
      const portrait=entry.sources.find(source=>source.id===entry.assets.portrait);
      if(portrait?.storage==="drive")try{
        const blob=await win.COSMI_DRIVE.readById(portrait.drive_file_id);
        const digest=await win.crypto.subtle.digest("SHA-256",await blob.arrayBuffer());
        const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
        if(hash!==portrait.sha256)throw Error("立繪來源已改變，需重新匯入核對");
        if(token!==generation||!dialog.open)return;
        portraitUrl=URL.createObjectURL(blob);const img=doc.createElement("img");img.src=portraitUrl;img.alt=title(entry,level.value);img.className="encyclopedia-portrait";details.prepend(img);
      }catch(error){if(token===generation)line(details,"p","立繪未載入："+error.message);}
    }
    function render(){
      const matches=filter(entries,category.value,search.value,level.value);list.replaceChildren();
      status.textContent=matches.length+" / "+entries.length+" 筆；僅顯示 Wiki 圖鑑文本（遊戲數值與效果請至 🌌 分頁檢視）。";
      for(const entry of matches){const item=doc.createElement("button");item.type="button";item.className="btn ghost";item.textContent=title(entry,level.value);item.addEventListener("click",()=>renderDetails(entry));list.append(item);}
      if(matches.length)void renderDetails(matches.includes(active)?active:matches[0]);else{generation++;revoke();details.replaceChildren();}
    }
    async function load(){
      clear();const token=generation;status.textContent="正在讀取已授權的 Drive 圖鑑…";reload.disabled=true;
      try{
        const catalogs=await Promise.all(CATALOG_PATHS.map(async path=>JSON.parse(await(await win.COSMI_DRIVE.read(path)).text())));
        if(token!==generation||!dialog.open)return;
        entries=catalogs.flat();render();
      }catch(error){if(token===generation)status.textContent="圖鑑未載入："+error.message;}
      finally{reload.disabled=false;}
    }
    button.addEventListener("click",()=>{dialog.showModal();void load();});close.addEventListener("click",()=>dialog.close());
    dialog.addEventListener("close",clear);reload.addEventListener("click",()=>void load());
    for(const control of [category,level])control.addEventListener("change",render);search.addEventListener("input",render);
    const app=doc.getElementById("driveApp");
    if(app)new MutationObserver(()=>{if(app.hidden){clear();if(dialog.open)dialog.close();}}).observe(app,{attributes:true,attributeFilter:["hidden"]});
  }
  return Object.freeze({CATALOG_PATHS,project,title,filter,visibleValues,install});
});
