"""Read back Drive inventory and issue the final delivery index after all checks."""
import hashlib
import json
import argparse
from pathlib import Path

ap=argparse.ArgumentParser();ap.add_argument('--root',default=str(Path(__file__).resolve().parents[1]/'Art/_incoming/starter_blender_20261111'))
ROOT=Path(ap.parse_args().root).resolve()
jobs=json.loads((ROOT/'jobs.json').read_text(encoding='utf8'))
index=json.loads((ROOT/'delivery_index.json').read_text(encoding='utf8'))
uploads=json.loads((ROOT/'cloud_uploads.json').read_text(encoding='utf8'))
cloud=json.loads((ROOT/'cloud_readback.json').read_text(encoding='utf8'))
assert len(index)==12 and len(uploads)==36
assert len({u['name'] for u in uploads})==36
rows=[]
for job in jobs:
    entry=next(e for e in index if e['task_id']==job['task_id'])
    out=Path(job['output'])
    verification=json.loads((out/'review/verification.json').read_text(encoding='utf8'))
    assert verification['passed'],job['task_id']
    assert verification['evidence']['unweighted']==0 and verification['evidence']['max_influences']<=4
    assert len(verification['evidence']['glb_clips'])==len(job['actions'])
    assert (out/'review/mesh_integrity.json').exists()
    files={}
    for kind in ('zip','glb','blend'):
        local=Path(entry[kind]);name=local.name
        sent=next(u for u in uploads if u['name']==name)
        remote=next(c for c in cloud if c['id']==sent['id'])
        assert remote['title']==name and int(remote['size'])==local.stat().st_size,(name,'cloud size mismatch')
        files[kind]=dict(name=name,id=sent['id'],url=sent['url'],bytes=local.stat().st_size,sha256=hashlib.sha256(local.read_bytes()).hexdigest())
    rows.append(dict(task_id=job['task_id'],family=job['family'],stage=job['stage'],name_zh=job['stage_data']['name_zh'],source_pack=job['source_pack'],triangles=verification['evidence']['triangles'],bones=verification['evidence']['bones'],clips=len(job['actions']),files=files,verification=verification))
assert sum(r['clips'] for r in rows)==303
refined=any(j.get('refinement') for j in jobs)
report=dict(date='2026-11-11',timezone='Asia/Taipei',destination='project/cosmos_chimera_forge/3D_out',refinement=2 if refined else 1,models=12,clips=303,cloud_files_verified=36,technical_status='pass',art_status='reference-directed procedural reconstruction; reviewed but not game-approved',limitations=['Visible differences from the illustrations remain in facial proportions, fur/feather layering, wing outlines, linework and luminous effects.','PBR color/ORM atlases are painted/generated regions; authored fiber/ridge tangent normals are used in refinement 2, without a high-poly bake.','Technical reopening, topology and animation checks do not constitute Unity/game acceptance.'],stages=rows)
(ROOT/'starter_12_delivery_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
lines=['# 御三家四階段 Blender 交付記錄 · 2026-11-11','',
'12 型態、303 個骨架動作片段。36 個雲端交付檔（12 GLB、12 BLEND、12 ZIP）的檔名、ID 與大小皆已讀回核對。',
'','這批是依照立繪建立的可編輯程序化三維重建版本。已完成外觀多視角與逐動作四格檢閱，並修正 UV、權重、背羽、體型差異、封閉網格、法線、四足倒下方向／落地及超載翼緣連接。臉部比例、毛羽層次、翅形、描邊及發光效果與立繪仍有明顯簡化；本次不代表遊戲美術驗收或入庫。',
'','| 型態 | 階段 | 三角面 | 骨骼 | 動作 | 下載 |','|---|---|---:|---:|---:|---|']
for r in rows:
    f=r['files'];links=' / '.join(f"[{k.upper()}]({f[k]['url']})" for k in ('glb','blend','zip'))
    lines.append(f"| {r['name_zh']} | {r['stage']} | {r['triangles']} | {r['bones']} | {r['clips']} | {links} |")
lines+=['','## 驗證範圍','',
'- Blender 5.2.2 LTS 重新開啟每個 .blend，並在新場景匯入實際 .glb。',
'- 檢查骨骼數、面數預算、UV、貼圖內嵌、四權重上限、權重總和、每個動作的實際網格變形及循環接縫。',
'- 網格各外殼封閉且法線朝外；減面留下的微小單面裝飾已移除或補厚。',
'- 四足型態倒下終態的身體側倒與最低點接地已另行檢查。',
'- 每個 ZIP 包含 models/、anims/、rig/、textures/、images/、review/ 及 pipeline/。',
'- review/appearance_review.png 是立繪、前／側／背面、GLB 重開與步態對照；animation_review_1.png、animation_review_2.png 含每個動作的四個時間點。',
'','## 編輯與限制','',
'GLB 已包含命名動作及貼圖。BLEND 已封裝參照立繪、貼圖、可編輯網格、骨架與 Action；參照圖與攝影棚集合預設隱藏。骨骼事件另見 anims/anim_spec.json，需要引擎匯入。PBR Base Color 與 ORM 使用簡化色彩圖集，Normal 為中性貼圖，未聲稱高模烘焙。',
'','來源立繪包保留在 image_in，尚未移動或刪除。12 份執行 Prompt 已另外存入專案 prompts/。']
(ROOT/'starter_12_delivery_report.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
if refined:
    p=ROOT/'starter_12_delivery_report.md'
    text=p.read_text(encoding='utf8').replace('御三家四階段 Blender 交付記錄','御三家四階段 Blender 精修 V2 交付記錄').replace('Normal 為中性貼圖，未聲稱高模烘焙。','Normal 新增手工設計的毛流／羽脊微細節，未聲稱高模烘焙。')
    text+='\n## 本輪精修與比對\n\n臉部改為貼合頭部的杏仁眼、較薄的眼瞼與尖收鼻口；月線以分層頰毛、胸鬃、後腦毛和連續加權尾部取代球狀接縫；日線補上側身與頭側羽層，鏡羽改為放射狀金框鏡片；星線金翼改為上揚羽扇，鬃尾改為寬幅流線髮束。局部 UV 與粗糙度、金屬度及纖維法線已重製。\n\n每包 review/reference_front_side_back.png 同頁比較原立繪、實際重新匯入的精修 GLB，以及前一版模型的正／側／背面。各視圖分別適配畫面；沒有聲稱像素級對齊或虛構還原度百分比。所有 303 個動作重新檢查；四足倒下仍維持正確側倒及地面接觸。\n\n更新使用原有 Drive 檔案 ID，保留原下載連結。\n'
    p.write_text(text,encoding='utf8')
print(json.dumps(dict(models=12,clips=303,cloud_files_verified=36,technical_passes=sum(r['verification']['passed'] for r in rows)),indent=2))
