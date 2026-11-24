# 生活器物部件產生器（cosmos_chimera ADR-0016、P1-19b）

依「功能 × 時代 × 部件槽 × 變體」用 Blender 產生低面數部件，交付到遊戲 repo 的 `Assets/_Project/Art/Objects/`。規格見遊戲 repo `docs/design/everyday-objects.md`；功能目錄見 `everyday-objects-catalog.md`。

```
blender -b --factory-startup --python tools/object-kit/build.py -- [--functions Hoe,Barrel] [--eras Primal,Future] [--no-export] [--render <dir>]
```
- 輸出：每個（功能、時代）一個 `<Family>/<Function>/<Function>_<Era>.fbx`，內含 `<slot>_v<k>`（k = 0–5）各一個物件，全部在同一個功能座標系（Z 向上、正面 -Y，原點在握把或落地點）。遊戲端每槽取一個變體放在同一原點即可組裝。
- `object-kit.json`：部件槽、各變體三角形數、`max_assembled`（每槽取最大者相加）、`distinct`（每槽有幾個不同的變體）。任一組合超出預算（手持 600、擺設 1500、機械 4000）時，建置失敗。
- `--render`：每個功能一張 `objects-<Function>.png`，8 個時代 × 3 組隨機組合，用卡通預覽材質。
- 遊戲端門檻：`Bootstrap/Tests/EditMode/ObjectKitImportTests`。

## 結構
| 檔案 | 內容 |
|---|---|
| `kit_lib.py` | 幾何基本形（box、cyl、lathe、ring、tube、plate）；各時代工藝語彙 `STYLE`（倒角、表面雜訊、材質角色）；時代綁帶 `band`（繩、鐵箍、黃銅、螺栓、鉚釘、發光縫、鐵絲、符文）；收尾 `finish` |
| `kit_forms.py` | 每個功能的 8 個時代等價形體 |
| `build.py` | 建置、預算檢查、FBX 匯出、manifest、預覽圖 |

## 規則
- **可重現**：亂數一律用 `rng_for(...)`（key 字串的 crc32），不用 Python 的 `hash()`。
- **共用尺寸**：會被其他部件槽依賴的尺寸（桶高、半徑、握柄長度），一律用 `F(p, …)` 從（功能、時代）的 frame 亂數流抽取。各槽的 `J(p, …)` 只用在局部細節。若在接合尺寸上用了 `J`，蓋子會浮在桶身上方。
- **變體**：每槽 6 個，來源有兩個：局部抖動，以及 `morph` 的剖面調制（沿部件自身高度鼓起或收腰，兩端固定，接合面不動）。
- **材質**：物件材質命名為 `m_<名稱>`（如 `m_wood`、`m_brass`、`m_glow_rune`），遊戲端依名稱與地區配色重新上色。預覽色票 `PALETTE` 只用於預覽圖。
- **頂點色 COLOR_0**（線性值）：R 凹處（壓暗）、G 凸邊（磨損提亮）、B 毀損遮罩（遊戲端依 `Damage` 設門檻）、A 1。
- **新增功能**：在 `kit_forms.py` 用 `@function(name, family, slots, size)` 註冊。`name` 必須是遊戲 `ObjectFunction` 的成員，部件槽數必須等於 `ObjectCatalog.SlotCount`，否則門檻測試會失敗。
