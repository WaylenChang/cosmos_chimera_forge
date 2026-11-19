# 招式施放動作與特效骨架掛點規格（`moves`）

> 對應資料來源：`Data/schemas/move.schema.json`、`catalog.js`（v2.10.0 `VFX`、`ACTIONS.creature`、`GRIP_MODES`）、`tasks.js`（`move-vfx`）。  
> 更新日期：2026-11-19（補齊近期新增之 `movement: dash` 突進衝鋒、`origin: target` 目標點爆破、`dual_wield` 左右交替施放動作與本體掛點規範）。

---

## 1. 施放掛點與虛擬大手邊界

- **招式 VFX 一律由宙獸本體插槽骨發出**：
  - `Socket_Front`（正前／直線／扇形／近戰衝擊起點）
  - `Socket_Mouth`（口部吐息／咆哮／光束起點）
  - `Socket_Core_FX`（自身／他者輔助、核心聚能、目標點引導光環）
  - `Socket_Ground_FX`（場地展開、地面擴散波、落點警示印記）
- **武器與虛擬大手邊界**：
  - 武器／盾牌由獨立的虛擬大手動畫驅動（對應 `Socket_Weapon_R`／`Socket_Weapon_L` 空掛點）；招式 VFX 本體不依賴特定武器網格或特定宙獸部位，尺寸依施放者體型（`XS`／`S`／`M`／`L`／`XL`）在 `spec.json` `geometry.note` 寫明縮放倍率。

---

## 2. 招式形態與施放者骨架動作對照

| `move.schema.json` 形態參數 | VFX `shape` | 對應施放者動作 (`ACTIONS.creature`) | 雙持 (`dual_wield`) 交替動作 | 幀數／事件／RM | 主要發射掛點 | 備註 |
|---|---|---|---|---|---|---|
| `shape: "front"` | `melee_front` | `atk_melee_front` | `atk_melee_front_r` / `_l` | 26f (`22f` 雙持) · `ev_hit`, `ev_end_lock` | `Socket_Front` | 近戰正前打擊 |
| `shape: "sweep"` | `melee_sweep` | `atk_melee_sweep` | `atk_melee_sweep_r` / `_l` | 30f (`25f` 雙持) · `ev_hit`, `ev_end_lock` | `Socket_Front` | 近戰扇形橫掃 |
| `shape: "burst"`, `origin: "caster"` | `melee_burst` | `atk_melee_burst` | `atk_melee_burst`（共用） | 34f · `ev_spawn_fx@16`, `ev_hit@18` | `Socket_Core_FX` / `Socket_Ground_FX` | 以施放者為中心擴散 |
| `shape: "burst"`, `origin: "target"` | `melee_burst`（遠程目標點） | `atk_burst_target` | `atk_burst_target`（共用） | 34f · `ev_spawn_fx@16`, `ev_hit@18` | `Socket_Core_FX` → 目標 `Ground` | `[新增]` 限 `mid`/`long` 距，先出目標點警示印記再爆破 |
| `shape: "line"`, `movement: "dash"` | `ranged_line`（突進路徑） | `atk_dash` | `atk_dash_r` / `_l` | 28f (`24f` 雙持) · **RM=✓** · `ev_hit`, `ev_end_lock` | `Socket_Front` / `Socket_Ground_FX` | `[新增]` 帶位移突進衝鋒（`base_range_mm` 1..36000） |
| `shape: "line"`, `movement: "none"` | `ranged_line` | `atk_ranged_line` | `atk_ranged_line_r` / `_l` | 30f (`24f` 雙持) · `ev_spawn_fx` | `Socket_Front` / `Socket_Mouth` | 直線投射／射線 |
| `shape: "cone"` | `ranged_cone` | `atk_ranged_cone` | `atk_ranged_cone_r` / `_l` | 30f (`26f` 雙持) · `ev_spawn_fx` | `Socket_Front` / `Socket_Mouth` | 扇形散射／吐息 |
| `shape: "arc"` | `ranged_arc` | `atk_ranged_arc` | `atk_ranged_arc_r` / `_l` | 34f (`28f` 雙持) · `ev_spawn_fx` | `Socket_Front` | 拋物線投擲／落點指示 |
| `shape: "self"` | `support_self` | `sup_self` | `sup_self`（共用） | 36f · `ev_spawn_fx@18` | `Socket_Core_FX` | 自身增益／護盾／回復 |
| `shape: "ally"` | `support_ally` | `sup_ally` | `sup_ally`（共用） | 36f · `ev_spawn_fx@18` | `Socket_Core_FX` | 友方目標增益／治療 |
| `shape: "field"` | `field` | `field_deploy` | `field_deploy`（共用） | 48f · `ev_spawn_fx@28` | `Socket_Ground_FX` | 持續場地（依 `field_duration_ms` 週期跳動） |

---

## 3. 實戰／生活關聯通用特效與動作節奏

除上述 9 種招式形態外，近期擴充之通用特效與施放時序須對齊以下動作事件：

- **完美格擋彈反（`perfect_block`）**：22f，`ev_spawn_fx@4`、`ev_hit@6`（150ms 彈反視窗震擊光環與火花）。
- **格擋受擊（`block_hit`）**：16f，`ev_spawn_fx@2`（防禦盾波與震退粒子）。
- **BOSS 狂暴轉換（`boss_enrage`）**：48f，`ev_spawn_fx@18`（全周威嚇衝擊波與氣場展開）。
- **生活能力發動（`field_utility`）**：42f，`ev_spawn_fx@20`（操縱天氣／破障／生火環境互動特效）。
- **野生警戒（`wild_alert`）／進食（`eat_feed`）**：36f `ev_spawn_fx@12`／48f `ev_spawn_fx@24`。
- **翻滾殘影／超載指令**：角色 `command_overload`（30f `ev_spawn_fx@14`）對應宙獸 `overload_enter`（60f `ev_spawn_fx@20`）。
