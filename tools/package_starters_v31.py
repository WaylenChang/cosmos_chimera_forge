"""Package twelve independently reopened V3.1 assets and review evidence."""
import argparse
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

def digest(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for data in iter(lambda:f.read(4*1024*1024),b''):h.update(data)
    return h.hexdigest()

ap=argparse.ArgumentParser();ap.add_argument('--root',default='Art/_incoming/starter_v31_20261111');args=ap.parse_args()
repo=Path(__file__).resolve().parents[1];root=Path(args.root).resolve();delivery=root/'delivery';delivery.mkdir(exist_ok=True)
jobs=json.loads((root/'jobs.json').read_text(encoding='utf-8-sig'));assert len(jobs)==12
rows=[];files_by_family={f:[] for f in ('sun','moon','star')}
for job in jobs:
    out=Path(job['output']);review=out/'review';vp=review/'structure_verification.json';v=json.loads(vp.read_text(encoding='utf8'))
    models=[*list((out/'models').glob('*.blend')),*list((out/'models').glob('*.glb'))]
    assert len(models)==2 and v['passed'] and v['revision']=='3.1',job['task_id']
    assert vp.stat().st_mtime>=max(p.stat().st_mtime for p in models),('stale check',job['task_id'])
    textures=list((out/'textures').glob('*.png'));assert len(textures)==3,(job['task_id'],textures)
    for n in ('volume_review.png','anatomy_review.png','rig_side.png','rig_top.png','material_front.png','material_side.png','material_back.png','material_quarter.png','reference_front_side_back.png','motion_page_1.png'):
        assert (review/n).exists(),(job['task_id'],n)
    motion=json.loads((out/'motion_spec.json').read_text(encoding='utf8'))
    assert len(list(review.glob('motion_page_*.png')))==(len(motion['clips'])+7)//8
    if job['stage']=='adult':assert (review/'turntable_360.gif').exists()
    row=dict(task_id=job['task_id'],family=job['family'],stage=job['stage'],name_zh=job['stage_data']['name_zh'],canonical_clips=v['canonical_clips'],supplemental_clips=v['supplemental_clips'],bones=v['bones'],technical_pass=True,art_status='reference-informed procedural revision; user art/engine acceptance pending',ground_error_m=v['max_stance_ground_error_m'],bone_length_error_m=v['max_bone_length_error_m'],flight_checks=v['flight_checks'],models=[dict(name=p.name,bytes=p.stat().st_size,sha256=digest(p)) for p in models])
    rows.append(row)
    include=models+textures+[out/n for n in ('rig_spec.json','motion_spec.json','build_report.json')]
    for p in review.iterdir():
        if p.name.startswith('motion_') and not p.name.startswith('motion_page_') and p.name!='motion_diagnostic.png':continue
        if p.suffix=='.gif' or p.name.startswith(('view_','bare_','open_','rig_','material_','glb_reopened_','motion_page_')) or p.name in ('volume_review.png','anatomy_review.png','reference_front_side_back.png','structure_verification.json','motion_diagnostic.png'):include.append(p)
    for p in include:
        name=job['task_id']+'/'+p.relative_to(out).as_posix()
        if p.parent==review and p.suffix=='.png':
            jpeg=root/'review_jpeg'/job['task_id']/(p.stem+'.jpg');assert jpeg.exists(),jpeg
            p=jpeg;name=name[:-4]+'.jpg'
        files_by_family[job['family']].append((p,name))
assert sum(r['canonical_clips'] for r in rows)==303
assert sum(r['supplemental_clips'] for r in rows)==93
readme='''# 御三家 V3.1：12 型態模型、骨架、材質與動作修訂

日線=鷺鳥＋追日鏡陣；月線=狼；星線=馬＋奇幻翼帶。各族 ZIP 含四型態 models/*.blend 與 *.glb，沿用 V3 檔名／Drive ID，檔案內容已修訂至 V3.1。

全套 303 個原訂動作（cr_*）按原時序與事件重建，另保留 93 個 V3 物種／關節診斷動作（v3_*）。補充版含相同語意的控制片段，不能解讀成 396 種主技能。30 fps；GLB 匯入時請先設定場景 30 fps，否則秒數不變但幀號會不同。遊戲事件使用 motion_spec.json sidecar；BLEND 另有 pose markers。召喚／召回僅 Root 等比縮放作顯隱近似，其餘片段不伸縮骨長。

每型態包含三張自製程序 PBR 圖集（base_color、normal、ORM）並封裝於 GLB／BLEND。這不是高模烘焙貼圖。rig_spec.json 記錄骨鏈，motion_spec.json 記錄動作、足序、事件、預期移動速度。BLEND 中保留原立繪供比對。

為符合 Drive 連接工具單檔 100 MB 上限，ZIP 內檢閱靜態圖使用原尺寸 JPEG quality 92；本機保留原始 PNG。模型、骨架、全部動作與 PBR 貼圖保持原檔，未降面或壓縮貼圖。

review/：八方向與頂視灰模、收展翼、骨架、重新匯入 GLB 的正側背與 3/4 材質圖、原立繪對照、每個片段八時間點的側面與 3/4 分頁。成年型態另有完整診斷動作 GIF 與 360° 轉台。structure_verification.json 記錄實際 BLEND 重開、GLB 空場景重匯、動作集合與原訂時序、全幀骨長／循環、權重、實際腳網格支撐高度及四足跑動的騰空檢查。技術通過不等於美術或遊戲引擎驗收。

這版改善多角度體積與物種動作，仍是程序造型：狼臉、毛簇細度、羽片重疊、額角與超載效果和原畫仍有差異。沒有肌肉／空氣動力／碰撞模擬；技能粒子、聲音、命中邏輯需遊戲端實作。最新設計與研究依據見 STARTER_3D_REDESIGN_V3.md。

重現：取得原 image_in 立繪包後，填寫 jobs.template.json 的 source_dir 與 output，使用 Blender 5.2 執行 --background --python pipeline/finish_starters_v31.py -- --jobs jobs.template.json。請勿使用 blender_starters.py 的舊建模入口。執行 verify_starters_v31.py、preview_starters_v31.py --glb 與檢閱頁腳本；--media-only 可在已通過且仍新鮮的模型上產生檢閱 GIF。各族 manifest.json 列出封裝檔案大小與 SHA-256；ZIP CRC 已逐包檢查。

依使用者授權更新既有 3D_out 的三份 V3 ZIP、設計文件與兩張總覽。舊 V2 未替換，也不視為合格美術資產。雲端讀回結果另存 cloud_delivery.json。
'''
(delivery/'README.md').write_text(readme,encoding='utf8');shutil.copy2(repo/'docs/STARTER_3D_REDESIGN_V3.md',delivery/'STARTER_3D_REDESIGN_V3.md')
template=[]
for job in jobs:
    d={k:v for k,v in job.items() if k not in ('output','source_dir','prompt')};d.update(source_dir='ABSOLUTE_SOURCE_ROOT/'+job['source_pack'],output='ABSOLUTE_OUTPUT_ROOT/'+job['task_id']);template.append(d)
(delivery/'jobs.template.json').write_text(json.dumps(template,ensure_ascii=False,indent=2),encoding='utf8')
summary=dict(revision='3.1',date='2026-11-11',models=12,canonical_clips=303,supplemental_clips=93,technical_passes=12,art_accepted=False,engine_accepted=False,cloud_upload_authorized=True,cloud_readback='recorded separately in cloud_delivery.json',stages=rows)
(delivery/'revision_delivery.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
common=[(delivery/n,n) for n in ('README.md','STARTER_3D_REDESIGN_V3.md','jobs.template.json','revision_delivery.json')]
for n in ('finish_starters_v31.py','verify_starters_v31.py','preview_starters_v31.py','anatomy_starters_v3.py','verify_anatomy_v3.py','blender_starters.py','anatomy_v3_sheets.ps1','sheets_starters_v31.ps1','diagnostics_starters_v31.ps1','compress_starters_v31.ps1','comparison_starters_v31.ps1','overview_starters_v31.ps1','check_starters_v31.ps1','package_starters_v31.py'):common.append((repo/'tools'/n,'pipeline/'+n))
for n in ('v3_12_forms_overview.png','v3_adult_structure_preview.png','visual_review_notes.json'):
    assert (root/n).exists(),n
    common.append((root/n,n))
archives=[]
for family,files in files_by_family.items():
    manifest=[dict(path=n,bytes=p.stat().st_size,sha256=digest(p)) for p,n in files+common];path=delivery/f'starter_v3_{family}_STRUCTURE_REVIEW.zip'
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p,n in files+common:z.write(p,n)
        z.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2))
    with zipfile.ZipFile(path) as z:assert z.testzip() is None
    archives.append(dict(family=family,path=str(path),bytes=path.stat().st_size,sha256=digest(path)));print('V31_PACKAGED',family,path.stat().st_size,flush=True)
(delivery/'archive_index.json').write_text(json.dumps(archives,indent=2),encoding='utf8')
print('V31_PACKAGE_COMPLETE 12 models / 303 canonical / 93 supplemental / 3 CRC checked archives',flush=True)
