// Device preferences and application version information. No credentials are persisted here.
(function(){
"use strict";
const $=id=>document.getElementById(id);
let checking=false;
function message(text){const node=$("settingsMessage");if(node)node.textContent=text;}
async function refresh(){
 const versions=window.COSMI_FORGE?.versionInfo?.()||{};
 $("settingsToolVersion").textContent=versions.tool||"—";
 $("settingsCatalogVersion").textContent=versions.catalog||"—";
 $("settingsSpecVersion").textContent=versions.spec||"—";
 const prefs=window.COSMI_DRIVE_CACHE?.preferences()||{};
 $("settingsCacheEnabled").checked=!!prefs.cacheEnabled;
 $("settingsAutoSync").checked=!!prefs.autoSync;
 $("settingsCacheTTL").value=String(prefs.ttlMinutes||60);
 try{$("settingsPortraitMode").value=window.localStorage?.getItem("cosmimera.portrait-mode.v1")==="auto"?"auto":"manual";}catch(_){$("settingsPortraitMode").value="manual";}
 try{
  const stat=await window.COSMI_DRIVE?.cacheStats();
  $("settingsCacheStats").textContent=stat?.supported
   ? "此帳號快取："+stat.count+" 個資產，約 "+(stat.bytes/1024/1024).toFixed(1)+" MiB（最多 80 MiB）"
   : "瀏覽器不支援 IndexedDB，將直接從雲端載入。";
 }catch(_){$("settingsCacheStats").textContent="快取資訊暫時無法取得。";}
}
async function checkVersion(){
 if(checking)return;
 checking=true;$("settingsVersionStatus").textContent="正在檢查部署版本…";
 try{
  const r=await fetch("version.json?t="+Date.now(),{cache:"no-store"});
  if(!r.ok)throw Error("HTTP "+r.status);
  const info=await r.json();
  const local=window.COSMI_FORGE?.versionInfo?.()||{};
  $("settingsBuildVersion").textContent=info.commit||info.tool||"—";
  $("settingsVersionStatus").textContent=info.tool===local.tool&&info.catalog===local.catalog
   ?"目前使用的版本與部署資訊一致。"
   :"網站已有不同版本；可重新整理頁面取得最新檔案。";
 }catch(_){$("settingsVersionStatus").textContent="無法取得部署版本資訊；本機開發模式可忽略。";}
 finally{checking=false;}
}
document.addEventListener("DOMContentLoaded",()=>{
 $("settingsCacheEnabled")?.addEventListener("change",e=>{window.COSMI_DRIVE_CACHE?.updatePreferences({cacheEnabled:e.target.checked});message("已儲存快取偏好。");void refresh();});
 $("settingsAutoSync")?.addEventListener("change",e=>{window.COSMI_DRIVE_CACHE?.updatePreferences({autoSync:e.target.checked});message("已儲存同步偏好。");});
 $("settingsCacheTTL")?.addEventListener("change",e=>{window.COSMI_DRIVE_CACHE?.updatePreferences({ttlMinutes:Number(e.target.value)});message("已更新快取有效期限。");});
 $("settingsPortraitMode")?.addEventListener("change",e=>{
  const select=$("portraitMode");if(select){select.value=e.target.value;select.dispatchEvent(new Event("change"));}
  message("已切換立繪模式。");
 });
 $("settingsClearCache")?.addEventListener("click",async()=>{
  try{await window.COSMI_DRIVE?.clearCache();message("已清理目前帳號的本機 Drive 快取，雲端檔案不受影響。");}
  catch(e){message("清理快取失敗："+e.message);}
  await refresh();
 });
 $("settingsForceSync")?.addEventListener("click",async()=>{
  message("正在從 Google Drive 強制同步…");
  try{await window.COSMI_DRIVE?.syncPackages({force:true});message("Drive 強制同步完成。");}
  catch(e){message("同步失敗："+e.message);}
  await refresh();
 });
 $("settingsSignOut")?.addEventListener("click",()=>window.COSMI_DRIVE?.signOut());
 $("settingsCheckVersion")?.addEventListener("click",checkVersion);
 window.addEventListener("cosmi:authorized",()=>{void refresh();void checkVersion();});
});
window.COSMI_SETTINGS=Object.freeze({refresh,checkVersion});
})();
