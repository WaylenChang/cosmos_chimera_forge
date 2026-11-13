# Anime3D 管線查核與葉澄汐測試（2026-11-13）

## 真實 Colab 結果更新

葉澄汐已完成實際 Pixal3D → SkinTokens → Blender 執行，交付狀態為 **REVIEW_REQUIRED**，尚未取得人工模型核准。此結果只涵蓋本角色與本次環境，不代表六類管線皆通過。

- [互動模型與三段動畫](https://colab.research.google.com/drive/1V1W7gHeQRY2Notq5093MFAjcT4MJeezd#scrollTo=ngNBeRBefnW5)、[完整驗收包](https://drive.google.com/file/d/1HH-2maBDq6TWHl-2RRZ2MZh9F7WTNojg/view)、[Drive 成果目錄](https://drive.google.com/drive/folders/1k8wNfhPIffvC-OwXEs0jSGy_N4D30Cl9)。
- NVIDIA L4 23034 MiB、Python 3.11.17 隔離環境、Torch 2.7.0+cu128、CUDA toolkit 12.8.93、Blender 4.0.2。未使用 Tripo 付費 API。
- 來源經使用者正式核准，圖片 SHA256 保持 `8a0f0cae38da166026167c83cfc69d8dddc22d01783b020e5aece285b1925482`。
- 實際模型為 29,540 三角面、2048 貼圖、52 根 SkinTokens 骨骼，無未加權頂點。保留獨立 source／rig；依實際骨架與原 rig SHA256 綁定動作映射，完成 idle／walk／run 與 GLB 重載驗證。
- 四視角、三段動作與旋轉影片皆由實際模型渲染；互動檢視器已驗證載入與動畫切換。最終 GLB 從 Drive 讀回的 SHA256 已核對：`5e5461fe12bd225d92538022d67f6555f942102e0841c1ca2dedd89560078167`。
- `automated_pass=true`，`passed=false`、`human_approved=false`。背包／腰珠細節較簡化；臉部、髮型、關節變形、足部接觸與穿模仍需人工驗收。Unity Toon shader 尚待引擎端設定，未宣稱已套用。
- 執行修復包含 MoGe 2 固定版本、BiRefNet 的 einops、SkinTokens 的 scipy，以及公開 BiRefNet 去背模型。實際安裝腳本、權重 revision、pip freeze、推論日誌與 SHA256 收據均隨成果保存。

以下為取得授權與建立雲端環境前的歷史查核；其中 BLOCKED 狀態已由上方實際執行結果更新。

## 初次查核結論與驗證範圍（歷史）

**目前不符合「六類管線均完成端到端驗證」；葉澄汐的真實 Colab img-to-3D 推論仍為 BLOCKED。**
本次完成可在本機重現的執行錯誤修復、真正來源圖校驗、Notebook 儲存格編譯及 Blender 網格／蒙皮／動畫往返測試。合成 Blender 測試不是葉澄汐的生成模型，沒有用占位模型替代實際推論，也沒有建立假的核准紀錄。

查核依據為 [AI_Agent_Colab_Anime3D_Pipeline](AI_Agent_Colab_Anime3D_Pipeline.md)，並與專案的 Drive 單步驟管線、typed runner、API runner、Blender 後處理及 notebook 逐項比較。規格是建置目標；下面未完成項目仍須保留。

## N00–N08 對照

| 節點 | 現有實作及本次修復 | 符合程度／尚缺條件 |
| --- | --- | --- |
| N00 Ingest & Cache | 核准紀錄、來源包、授權狀態、明確 source_image、PNG/JPEG/WebP；同時支援待審與完成區來源；核對 manifest.subject_id；保存來源 GLB SHA256 並續跑 | 部分符合。葉澄汐圖檔可解碼、身分一致，但未核准。未做來源雜湊與既有核准紀錄的歷史綁定、完整版權審核或自動去背品質驗收 |
| N01 Visual Planner | 六類資產與實際解剖分類；人形、翼、腿、尾、硬表面、程序動作及 QA 路由 | 部分符合。依已提供 metadata 分類；沒有 VLM 自動檢查原圖、遮擋、漏肢或多視角一致性 |
| N02 Route Selector / generation | Tripo P2 與 Rig v3；AniGen、Pixal3D、PartCrafter 獨立 CLI adapter；明確付費選擇；Notebook 修正不可執行的字面反斜線換行，執行失敗會拋出錯誤 | 介面符合、實際模型待驗。未配置 GPU、模型依賴與權重；沒有自動模型安裝或已實測的跨後端 fallback。公開 CLI 與 API 文件已重新查核 |
| N03 Mesh QA & Repair | 真正 GLB 匯入、面數／UV／材質檢查；排除 Blender 5.2 骨架顯示用 Icosphere，避免誤判角色缺材質 | 部分符合。缺破洞／法線完整驗收、自動縮面／UV 修復與最多兩輪修復流程。Tripo 分支主要幾何 QA 仍在 rig/retarget 之後，未完全符合規格先 mesh QA 再 rig 的順序 |
| N04 Rig Decision | Tripo 先 rig-check 再 rig，明確 v3 版本；非人形已修正為自己的 rig_type；機械以剛性零件處理；蒙皮檢查至少有實際 deform mesh 且其頂點有骨骼權重 | 部分符合。Pixal3D 只產 mesh；**SkinTokens 串接尚未實作**。AniGen 輸出之解剖、權重與任意骨名映射仍需實測；不能把 envelope guide 當正式角色骨架 |
| N05 Motion Planner | 依實際後端選動作；開源後端不再假設持有 Tripo preset；保留已有 clips；逐項檢查所需動畫是否在 GLB 匯出／重匯入後仍存在 | 部分符合。本機已測 idle/walk/run、機械旋轉／滑動、物件轉動。程序動作只適用已支援骨名／關節通道；不是任意骨架的通用 retarget，也未驗證接地、循環品質、物種步態 |
| N06 Headless Blender | 真正 Blender 5.2.2 headless、四方向 PNG、原始 GLB 保存、可編輯 Blend、GLB 往返；缺骨架／動畫時 QA_PENDING，命令回傳失敗；過期 QA 報告不能驗證後續失敗執行 | 部分符合。四方向仍是靜態 Workbench 視圖，**不是動作 pose sweep／碰撞掃描**。無 GPU 時沒有完整的自動渲染降級與幾何驗收拆分策略 |
| N07 Toon Formatter | 產出 material_profile.json，明確 shader_applied=false 與目標引擎 | 部分符合。尚未實作真正色票量化、二／三段 cel shading、描邊與 Blender Toon 預覽；Unity Shader 需引擎套用 |
| N08 Export & QA | GLB、Blend、animations manifest、QA JSON、四方向預覽與 Drive manifest；圖鑑採 wiki/characters 或含 stage 的 wiki/creatures，相容舊路徑讀取；不自動移到完成區 | 部分符合。尚缺 QA HTML、動畫關鍵影格／影片，以及按需求的 FBX／VRM。passed 維持 false；獨立人工核准與引擎驗收尚未執行 |
| 狀態機／續跑／預算 | 成功 API task 不重送；成功 source GLB 按雜湊重用；輸入變動需新 asset ID；POST 結果不明標記 SUBMISSION_UNKNOWN，禁止自動重送付費任務；啟動失敗／逾時可落盤 | 部分符合。SUBMISSION_UNKNOWN 是 task 子狀態。缺完整 QUEUED→RETRY→FALLBACK→FAILED 自動調度、逐節點時間／費用／VRAM、每日供應商限額與 GPU 預算強制執行。max_auto_retries 欄位仍不是已實作的兩輪修復器 |

## 每條資產與工作流程

| 管線 | 與規格吻合部分 | 現況與驗收缺口 |
| --- | --- | --- |
| 人形／NPC | biped、Tripo rig-check/v3、Unity spec、idle/walk/run；開源分支不冒用 API 動畫 | 有本機合成蒙皮／三動畫測試；葉澄汐的實際 mesh、臉、馬尾、背包、右腰珠與衣物變形尚未生成或驗收 |
| 怪物 | 依兩足、多足、觸手／混合拓撲分流，不一律套 biped | 非標準 appendage、骨名與完整動作未經真實生成驗證 |
| 動物 | quadruped/hexapod/octopod/serpentine/aquatic 各自 rig_type；不捏造官方 preset | 物種步態、avian 與模板動作仍待實測 |
| 奇幻生物 | 翼與腿分開，複雜拓撲轉 typed adapter／待審 | 缺實際四足雙翼／多頭等樣本與 pose sweep；不能將 others 視為通用動作 |
| 機械 | PartCrafter 分件契約、剛性零件、人工提供 pivot/axis/limits；本機 hinge/slider 動畫測試 | 不會自動推導真實連桿、碰撞、分件語義或機構設計 |
| 機器人／機甲 | 保留機械表面、腿數及 rigid hierarchy 路由，不預設軟蒙皮 | 無真實裝甲分件、人形 IK、關節限位及裝甲穿插量測驗證 |
| Image→Colab＋Blender | 核准來源→推論 adapter→typed QA→02_3d/colab；本次修復 Notebook 與來源選擇 | 實際 Colab runtime 與模型未就緒，葉澄汐在 N00 停止；不擅自切付費 API |
| Image→AI＋Blender | 同樣來源核准與 typed QA；02_3d/ai_blender 路由獨立 | 需真正可用的生成 adapter／建模工具；單步驟 prompt 本身不啟動外部 AI |
| Prompt→AI＋Blender | 原創 brief、獨立 wiki 身分及 stage、文字不繼承舊立繪，後補已核准來源 | 外部文字建模 adapter 未內建；不能用本次圖片測試取代此分支驗證 |
| 外觀→立繪→立繪審查→3D 審查 | 單步驟 prompt、來源綁定、目錄路由與完成區搬移有網頁回歸測試 | 本次未修改 Drive 審查紀錄、搬移或發布資產；最終人工核准仍獨立存在 |

規格的 API 優先策略與網頁的「Colab GPU 不擅用付費 API」需同時遵守：本次 Notebook 預設開源 Pixal3D，不會因沒 GPU 就自動啟用 Tripo。這是顯式路由選擇，不代表 Pixal3D 已包含 SkinTokens 綁骨。

## 葉澄汐實際輸入

- [來源包 chr-20261106-1286-2039](https://drive.google.com/drive/folders/1TfpZQiZH0mSaJBXq9pKuwS0t73w_JLO7)，manifest 與 concept 的雲端 subject_id=`chr_1286`、name_zh=`葉澄汐`。本機圖鑑 ID 為 `chr_yeh_chengxi`，已在測試 spec 明確區分。
- 正面圖 `images/chr_1286_front.png`：1024×1024、RGB、257594 bytes，實際解碼成功。
- SHA256：`8a0f0cae38da166026167c83cfc69d8dddc22d01783b020e5aece285b1925482`。
- 已閱讀來源 manifest 的品質限制：技術視圖源於原圖裁切／調整，關節、手指、側面重疊與比例仍需覆核，不能視為精確多視角幾何真值。
- 查核 Drive `reviews/` 直接列舉為空；沒有此 source_pack 的 ok 紀錄。本次沒有偽造核准或替它建立假 review。
- 當前可用執行環境：本機 Blender 5.2.2；沒有可用的 nvidia-smi 或已設定 GPU 模型 runtime。瀏覽器控制工具因沙箱程序初始化失敗而未能連入真實 Colab。此錯誤不是模型推論失敗，也不是通過驗證。

實際前置檢查：`BLOCKED`，原因為來源未核准、缺獨立 backend config／權重環境、缺 NVIDIA GPU runtime。
`inference_executed=false`、`colab_verified=false`、`passed=false`。

私人原始圖、manifest／concept 副本與機器可讀結果保留在本機忽略目錄 `Art/_incoming/anime3d-audit-20261113/`，不納入 GitHub Pages 建置或來源修復包。

## 重現與接續

本次驗證結果：

- `python -m compileall -q scripts` 通過。
- `python -m unittest discover -s tests -p 'test_anime3d*.py' -v`：**41 項通過，無跳過**。其中 5 項實際 Blender 整合測試涵蓋蒙皮人形三動畫／既有動畫保留、未綁骨人形拒收、物件轉動、機械 hinge／slider。
- `node --test tools/tests/*.cjs`：**89 項通過，無跳過**；修正一項既有 workflow 測試對 Windows CRLF 不相容的問題，未改 CI 權限。
- `node tools/build-site.mjs` 通過；私人立繪與來源包不在建置輸出。
- `git diff --check` 通過。

測試 log 與實際輸入檢查 JSON 保存在 `Art/_incoming/anime3d-audit-20261113/`。合成測試只證明軟體執行契約，不能證明 AI 推論或葉澄汐角色品質。

```bash
python scripts/anime3d_preflight.py --root /content/drive/MyDrive/project/cosmos_chimera_forge --asset-id mdl-yeh-chengxi-colab-20261113 --spec docs/examples/yeh_chengxi.asset_spec.json --backend pixal3d --backend-config /path/to/backends.json --blender /usr/bin/blender
```

使用 [07_batch_runner.ipynb](../notebooks/07_batch_runner.ipynb)。本機尚未發布的修復可透過 `anime3d_colab_source.zip` 上傳到 Colab `/content/` 載入，避免 notebook 從 main 下載到舊程式。Notebook 預設 EXECUTE=false。

要完成葉澄汐真正端到端驗收，仍必須具備：

1. 真實 Colab runtime 與足夠 GPU；依官方文件安裝隔離環境、相容權重，填入 backend config。
2. 人工覆核這份來源立繪並由正式審查流程保存 ok；不得把此文件或 preflight 當成核准紀錄。
3. 選定完整 mesh→rig 路徑。Pixal3D 的 mesh-only 輸出不能直接通過本案人物骨架門檻；需補真正綁骨 adapter／已驗證骨架和動作映射，或明確授權後使用 Tripo 主幹。
4. 實際生成、檢查三段動畫與 pose sweep，覆核臉部、手腳、袖口、馬尾、背包、珠座和蒙皮，再驗收 Toon 與目標引擎。

## 官方契約重新查核

本次核對 [Tripo P2 Image-to-Model](https://developers.tripo3d.ai/en/docs/generation-image-to-model/p)、[Rig Check](https://developers.tripo3d.ai/en/docs/animations-rig-check)、[Retarget](https://developers.tripo3d.ai/en/docs/animations-retarget) 的端點及人形 preset；未呼叫付費 API。

開源 adapter 命令比對 [Pixal3D inference.py](https://github.com/TencentARC/Pixal3D/blob/master/inference.py)、[AniGen example.py](https://github.com/VAST-AI-Research/AniGen/blob/main/example.py)、[PartCrafter inference_partcrafter.py](https://github.com/wgsxm/PartCrafter/blob/main/scripts/inference_partcrafter.py)。命令契約相符不代表權重推論已通過。[SkinTokens demo.py](https://github.com/VAST-AI-Research/SkinTokens/blob/main/demo.py) 是規格所列可用銜接方向，目前尚未整合進 runner。
