"""Package verified structural studies separately from rejected V2 art."""
import argparse
import hashlib
import json
import shutil
import zipfile
from pathlib import Path


def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()


ap=argparse.ArgumentParser();ap.add_argument('--root',default='Art/_incoming/starter_anatomy_v3_20261111');ap.add_argument('--cloud-authorized',action='store_true');args=ap.parse_args()
root=Path(args.root).resolve();repo=Path(__file__).resolve().parents[1]
jobs=json.loads((root/'jobs.json').read_text(encoding='utf-8-sig'));delivery=root/'delivery';delivery.mkdir(exist_ok=True)
assert len(jobs)==12
rows=[];files_by_family={f:[] for f in ('sun','moon','star')}
for job in jobs:
    out=Path(job['output']);vpath=out/'review/structure_verification.json';v=json.loads(vpath.read_text(encoding='utf8'))
    models=[*list((out/'models').glob('*.blend')),*list((out/'models').glob('*.glb'))]
    assert len(models)==2 and v['passed'],job['task_id']
    assert vpath.stat().st_mtime>=max(p.stat().st_mtime for p in models),('stale verification',job['task_id'])
    for name in ('volume_review.png','anatomy_review.png','motion_review.png','rig_side.png','rig_top.png'):
        assert (out/'review'/name).exists(),(job['task_id'],name)
    row=dict(task_id=job['task_id'],family=job['family'],stage=job['stage'],name_zh=job['stage_data']['name_zh'],source_pack=job['source_pack'],models=[dict(name=p.name,bytes=p.stat().st_size,sha256=digest(p)) for p in models],bones=v['bones'],prototype_clips=v['clips'],technical_pass=True,art_status='structure-reviewed; final sculpt/materials/performance NOT accepted',ground_error_m=v['max_stance_ground_error_m'],bone_length_error_m=v['max_bone_length_error_m'])
    rows.append(row)
    include=models+[out/n for n in ('rig_spec.json','motion_spec.json','build_report.json')]
    for p in (out/'review').glob('*'):
        if p.name.startswith(('motion_',)) and p.name!='motion_review.png':continue
        if p.suffix=='.gif' or p.name.startswith(('view_','bare_','open_','rig_','glb_reopened_')) or p.name in ('volume_review.png','anatomy_review.png','motion_review.png','structure_verification.json'):
            include.append(p)
    files_by_family[job['family']].extend((p,job['task_id']+'/'+p.relative_to(out).as_posix()) for p in include)
assert sum(r['prototype_clips'] for r in rows)==93
readme='''# 御三家 V3：物種解剖與運動結構原型

這批是 12 型態的三維結構設計原型，含 93 個專用動作實作。這不是 V2 那批 303 個正式識別動作的完成替代版，也不是最終高還原美術資產。

原型：日線=鷺鳥＋追日鏡陣；月線=灰狼；星線=馬＋獨立奇幻翼帶。研究來源、12 型態設計、骨鏈、材質方向及既有 303 動作的重設計語意，見 STARTER_3D_REDESIGN_V3.md。

每型態：models/ 的 GLB／BLEND；rig_spec.json 的實際骨鏈；motion_spec.json 的實作動作與落足相位；review/ 的八方向＋頂視、裸灰模、收展翼、骨架與雙視角動作檢閱圖。三個成年型態另附完整動作循環 GIF 與 360° 轉台。GLB 含色塊材質與骨架動作；BLEND 封裝原 front／turnaround 參照。沒有聲稱完成最終毛羽、PBR 貼圖、角色表演、空氣動力或遊戲驗收。

驗證逐一重開 BLEND、新場景匯入 GLB、檢查片段名稱、權重、全幀骨長、循環接縫、支撐期實際腳部幾何接地及運動變形。通過只代表這些已列出的技術檢查，不代表造型或自然運動已獲使用者認可。關節形變、動作表演、毛羽與效果仍需後續製作。

重現：pipeline/anatomy_starters_v3.py 為唯一建模入口；blender_starters.py 僅提供幾何／輸出工具，請勿改用其舊建模入口。取得原 image_in 三份立繪包後，修改 jobs.template.json 的 source_dir 和 output 為本機路徑；使用 Blender 5.2 執行 --background --python pipeline/anatomy_starters_v3.py -- --jobs jobs.template.json。再執行 verify_anatomy_v3.py --jobs jobs.template.json --media，最後產生檢閱圖及本包。fix_anatomy_v3_rear.py 記錄原型驗證時的揚前蹄承重修正，最新建模入口已內含修正，不必重複執行。

外傳狀態：新增 Drive 設計文件的上傳被自動審核拒絕，理由為新增文件的外傳授權尚未明確。此交付先保留本機；雲端舊 V2 不應視為合格美術資產。
'''
if args.cloud_authorized:
    readme=readme.replace('外傳狀態：新增 Drive 設計文件的上傳被自動審核拒絕，理由為新增文件的外傳授權尚未明確。此交付先保留本機；雲端舊 V2 不應視為合格美術資產。','上傳授權：使用者已明確授權將三份結構原型 ZIP、設計規格與總覽新增至既有 Google Drive 3D_out。實際上傳與讀回結果另見雲端交付紀錄。雲端舊 V2 不應視為合格美術資產。')
(delivery/'README.md').write_text(readme,encoding='utf8')
shutil.copy2(repo/'docs/STARTER_3D_REDESIGN_V3.md',delivery/'STARTER_3D_REDESIGN_V3.md')
template=[]
for job in jobs:
    data={k:v for k,v in job.items() if k not in ('output','source_dir','prompt','actions')}
    data['source_dir']='ABSOLUTE_SOURCE_ROOT/'+job['source_pack'];data['output']='ABSOLUTE_OUTPUT_ROOT/'+job['task_id'];template.append(data)
(delivery/'jobs.template.json').write_text(json.dumps(template,ensure_ascii=False,indent=2),encoding='utf8')
summary=dict(status='V3 structural design studies, NOT final art',date='2026-11-11',models=12,prototype_clips=93,technical_passes=12,cloud_uploaded=False,cloud_block_reason='Automatic review rejected adding a new design document without explicit authorization for this new external artifact.',stages=rows)
if args.cloud_authorized:
    summary.update(cloud_upload_authorized=True,cloud_upload_status='authorized; upload readback recorded separately',cloud_block_reason=None)
(delivery/'prototype_delivery.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
common=[(delivery/n,n) for n in ('README.md','STARTER_3D_REDESIGN_V3.md','jobs.template.json','prototype_delivery.json')]
for name in ('anatomy_starters_v3.py','verify_anatomy_v3.py','fix_anatomy_v3_rear.py','anatomy_v3_sheets.ps1','anatomy_v3_overview.ps1','check_anatomy_v3.ps1','package_anatomy_v3.py','blender_starters.py'):
    common.append((repo/'tools'/name,'pipeline/'+name))
for name in ('v3_adult_structure_preview.png','v3_12_forms_overview.png','v3_side_profile_preview.png'):
    if (root/name).exists():common.append((root/name,name))
if (root/'visual_review_notes.json').exists():common.append((root/'visual_review_notes.json','visual_review_notes.json'))
archives=[]
for family,files in files_by_family.items():
    manifest=[dict(path=name,bytes=p.stat().st_size,sha256=digest(p)) for p,name in files+common]
    path=delivery/f'starter_v3_{family}_STRUCTURE_REVIEW.zip'
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p,name in files+common:z.write(p,name)
        z.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2))
    with zipfile.ZipFile(path) as z:assert z.testzip() is None
    archives.append(dict(family=family,path=str(path),bytes=path.stat().st_size,sha256=digest(path)))
    print('V3_PACKAGED',family,path.stat().st_size,flush=True)
(delivery/'archive_index.json').write_text(json.dumps(archives,indent=2),encoding='utf8')
print(json.dumps(dict(models=12,prototype_clips=93,technical_passes=12,archives=len(archives)),indent=2))
