"""Write delivery metadata from final, fresh checks and observed Drive targets."""
import argparse
import hashlib
import json
from pathlib import Path
ap=argparse.ArgumentParser();ap.add_argument('--root',default='Art/_incoming/starter_v32_20261111');args=ap.parse_args()
root=Path(args.root).resolve();delivery=root/'delivery';delivery.mkdir(exist_ok=True)
jobs=json.loads((root/'jobs.json').read_text(encoding='utf8'));targets=json.loads((root/'drive_grounded.json').read_text(encoding='utf8'));byname={t['title']:t for t in targets}
notes=json.loads((root/'visual_review_notes.json').read_text(encoding='utf8'));assert len(notes['forms'])==12
rows=[]
for job in jobs:
    out=Path(job['output']);vp=out/'review/structure_verification.json';v=json.loads(vp.read_text(encoding='utf8'));build=json.loads((out/'build_report.json').read_text(encoding='utf8'))
    assert v['passed'] and v['revision']=='3.2'
    models=list((out/'models').iterdir());models=[p for p in models if p.suffix in ('.blend','.glb')];assert len(models)==2 and vp.stat().st_mtime>=max(p.stat().st_mtime for p in models)
    unit='cr_'+job['subject_id']+'_'+job['stage'];links={ext:byname[unit+'.'+ext]['url'] for ext in ('glb','blend')};links['zip']=byname[job['task_id']+'.zip']['url']
    rows.append(dict(task_id=job['task_id'],family=job['family'],stage=job['stage'],name_zh=job['stage_data']['name_zh'],triangles=build['triangles'],bones=v['bones'],canonical_clips=v['canonical_clips'],supplemental_clips=v['supplemental_clips'],technical_pass=True,art_accepted=False,ground_error_m=v['max_stance_ground_error_m'],loop_error_m=v['loop_mesh_error_m'],bone_length_error_m=v['max_bone_length_error_m'],flight_checks=v['flight_checks'],links=links,models=[dict(name=p.name,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in models]))
assert sum(r['canonical_clips'] for r in rows)==303 and sum(r['supplemental_clips'] for r in rows)==93
data=dict(revision='3.2',date='2026-11-11',models=12,formats=['blend','glb'],canonical_clips=303,supplemental_clips=93,fps=30,technical_passes=12,user_art_accepted=False,target_engine_accepted=False,visual_review=notes,delivery='24 raw model files, 12 per-form ZIPs, 3 family ZIPs and review documentation; existing Drive IDs preserved',cloud_readback='recorded separately after upload',forms=rows)
(delivery/'starter_12_delivery_report.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
lines=['# 御三家 V3.2：外觀精修交付','', '12 型態均提供可編輯 BLEND 與帶蒙皮／動作 GLB。303 個原訂動作及 93 個診斷片段分列，30 fps。','', '本輪重做狼眼、口鼻、耳廓與分束尾毛；毛羽改依部位生長方向與主次束群安排，避免等距鱗片。修正誤長在口鼻上的胸毛、鳥眼被頭殼遮蔽及雛鳥不合適的長喉羽。金飾增加包邊、卷紋及葉花組；鏡環保留機構對稱。','', '逐模型比對原畫正、側、背面及側面／3/4 診斷動作；所有片段重新驗證骨長、循環及變形，另核對實際腳部網格的支撐與四足騰空樣本。12 份 BLEND 實際重開，12 份 GLB 在空場景重新匯入。沒有宣稱最終美術、目標引擎或全時域碰撞驗收。','', '| 型態 | 主／診斷動作 | 三角面 | 骨骼 | 檔案 |','|---|---:|---:|---:|---|']
for r in rows:lines.append(f"| {r['name_zh']} | {r['canonical_clips']} / {r['supplemental_clips']} | {r['triangles']:,} | {r['bones']} | [GLB]({r['links']['glb']}) · [BLEND]({r['links']['blend']}) · [ZIP]({r['links']['zip']}) |")
lines+=['','每份 ZIP 附貼圖、骨架／動作規格、正側背原畫對照、八方向及頂視、分頁動作檢閱、技術報告與 SHA-256 manifest。檢閱靜態圖以原尺寸 JPEG 封裝以符合連接工具大小限制，本機保留 PNG；模型與貼圖保持原檔。','', '外觀仍是原畫導向的程序雕形，與原畫的手繪表情、細毛羽、鬃毛捲度及超載效果仍有差距；詳細差異保存在 visual_review_notes.json。']
(delivery/'starter_12_delivery_report.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
print('V32_DELIVERY_REPORT_READY 12 fresh checks')
