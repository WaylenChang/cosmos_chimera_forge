# 宙獸骨架與動作規格（`creatures`）

> 對應資料來源：`catalog.js`（v2.10.0 `ACTIONS.creature`、`GRIP_MODES`）、`tasks.js`（`creature-model-rig`）。  
> 更新日期：2026-11-19（共 **57** 支動作，含近期新增之主控移動／格擋彈反／BOSS 狂暴／突進與目標爆破／生態生活 19 支＋雙持武器左右交替 `_r`/`_l` 12 支）。

---

## 1. 骨架體系（Generic Rig）

- **骨骼上限**：≤ 60 骨骼。
- **核心層級**：`Root`（地面原點 pivot）→ `Hips` → `Spine_01..n` → `Neck` → `Head`
- **四肢與附屬**：四肢以 `L_` / `R_` 為前綴；尾部 `Tail_01..n`；翅膀 `Wing_L_01..n` / `Wing_R_01..n`
- **插槽骨（Sockets）**：
  - `Socket_Mouth`（口部吐息／咬擊／進食點）
  - `Socket_Head`（頭部裝飾／視線基準點）
  - `Socket_Front`（前方技能發射點）
  - `Socket_Core_FX`（核心能量／超載特效點）
  - `Socket_PetTouch`（撫摸互動對位點）
  - `Socket_Ground_FX`（地面陣法／衝擊波點）
  - `Socket_Weapon_R`、`Socket_Weapon_L`（**預留空掛點**，位於身體兩側安全間距）

---

## 2. 虛擬大手與持有模式規範（`GRIP_MODES`）

> **核心鐵則**：武器與盾牌由「虛擬大手」持握並執行另外設計的獨立對應動畫，技能仍由宙獸本體發出（`Socket_Front`／`Socket_Mouth`／`Socket_Core_FX`）；因此宙獸本體模型與骨架動畫**不繪製、不包含任何武器、盾牌或虛擬大手**。`Socket_Weapon_R`／`Socket_Weapon_L` 僅作為空掛點預留，本體仍依持有模式節奏做出相應的軀幹、頭頸與四肢／羽翼動作。

| 持有模式 (`grip_mode`) | 掛點配置 | 對應獨立武器參考類型（勿繪於本體） | 本體動作節奏 | 過濾規則 |
|---|---|---|---|---|
| `two_handed`（雙手武器） | `Socket_Weapon_R`（主手）＋ `Socket_Weapon_L`（雙手輔助） | 近戰：雙頭刃／長棍、長槍／戟、雙手大劍、巨斧／巨錘<br>遠程：連弩／獵弓、長弓、法杖、重弩／巨砲杖 | 重心沉穩，做出重型蓄力、大弧度揮身與射擊後座動作 | 使用通用攻擊 clip（無 `_r`/`_l`） |
| `dual_wield`（雙持單手） | `Socket_Weapon_R`（主手）＋ `Socket_Weapon_L`（副手） | 近戰：匕首／拳爪、單手劍／彎刀、單手斧、單手錘<br>遠程：飛刃／手裡劍、手弩、短杖／魔導銃、投矛 | 低重心敏捷側身，依 `_r` 與 `_l` 交替左右前探扭轉 | 近戰／突進／遠程改用 `_r` / `_l` 交替 clip |
| `one_hand_shield`（單手＋盾） | `Socket_Weapon_R`（主手單手武器）＋ `Socket_Weapon_L`（副手盾牌） | 近戰／遠程同單手武器；副手盾牌：圓盾、鳶盾、塔盾、木圓盾、符紋盾、長方木盾 | 左側穩固護前、右側俐落發力或微探後座 | 使用通用攻擊 clip（無 `_r`/`_l`） |

---

## 3. 動作清單（30 fps · 共 57 支，clip 命名為 `cr_<stage>_<id>`）

> 標記 `[新增]` 為近期新增的 19 支實戰／生態／移動動作；`[雙持新增]` 為近期新增的 12 支雙持左右交替動作。既有 26 支 clip ID 全數保留相容。

### 3.1 移動、穿越與騎乘（13 支）

| clip ID | 說明 | 幀數 | loop | RM | 事件@幀 | 備註 |
|---|---|---:|:---:|:---:|---|---|
| `idle` | 待機（2 秒短週期呼吸律動） | 60 | ✓ | | | 既有 |
| `idle_long` | 長時間靜止週期動作（4 秒定力循環） | 120 | ✓ | | | 既有 |
| `walk` | 移動 | 32 | ✓ | | `ev_footstep@8` | 既有 |
| `run` | 奔跑 | 20 | ✓ | | `ev_footstep@5` | 既有 |
| `sneak` | 潛行 | 40 | ✓ | | | 既有 |
| `jump` | 跳躍（起跳／滯空／落地） | 30 | | | | `[新增]` |
| `roll_dodge` | 翻滾閃避（主控無敵幀） | 18 | | ✓ | `ev_end_lock@14` | `[新增]` |
| `swim` | 游泳／水面移動 | 36 | ✓ | | | `[新增]` |
| `dive` | 潛水／水下移動 | 36 | ✓ | | | `[新增]` |
| `fly_idle` | 飛行／懸浮待機 | 60 | ✓ | | | `[新增]` |
| `fly_move` | 飛行／滑翔移動 | 32 | ✓ | | | `[新增]` |
| `mount_idle` | 被騎乘待機（穩定承載姿態） | 60 | ✓ | | | `[新增]` |
| `mount_run` | 被騎乘奔跑（高速載騎衝刺） | 22 | ✓ | | `ev_footstep@5` | `[新增]` |

### 3.2 格擋、受擊與 BOSS 狀態（9 支）

| clip ID | 說明 | 幀數 | loop | RM | 事件@幀 | 備註 |
|---|---|---:|:---:|:---:|---|---|
| `block` | 格擋 | 30 | | | | 既有 |
| `block_hit` | 格擋受擊（防禦震退回饋） | 16 | | | `ev_spawn_fx@2` | `[新增]` |
| `perfect_block` | 完美格擋（150ms 彈反震擊） | 22 | | | `ev_spawn_fx@4, ev_hit@6, ev_end_lock@16` | `[新增]` |
| `guard_break` | 破防硬直（架勢條滿崩解 1.5s） | 45 | | | | `[新增]` |
| `stagger` | 失衡硬直（受破招／重擊暈眩） | 45 | | | | `[新增]` |
| `dodge_miss` | 閃避（MISS 殘影） | 14 | | ✓ | | 既有 |
| `hit_react` | 受擊 | 15 | | | | 既有 |
| `faint` | 倒下 | 40 | | | | 既有 |
| `boss_enrage` | BOSS 狂暴（階段轉換威嚇咆哮） | 48 | | | `ev_spawn_fx@18` | `[新增]` |

### 3.3 主動技攻擊與武器持握交替（20 支）

| clip ID | 說明 | 幀數 | loop | RM | 事件@幀 | 適用 `grip_mode` / 距離 | 備註 |
|---|---|---:|:---:|:---:|---|---|---|
| `atk_melee_front` | 近戰：正前 | 26 | | | `ev_hit@12, ev_end_lock@20` | `two_handed`, `one_hand_shield` / `melee` | 既有 |
| `atk_melee_front_r` | 雙持近戰（右手）：正前快斬 | 22 | | | `ev_hit@9, ev_end_lock@16` | `dual_wield` / `melee` | `[雙持新增]` |
| `atk_melee_front_l` | 雙持近戰（左手）：正前快斬 | 22 | | | `ev_hit@9, ev_end_lock@16` | `dual_wield` / `melee` | `[雙持新增]` |
| `atk_melee_sweep` | 近戰：橫掃 | 30 | | | `ev_hit@14, ev_end_lock@24` | `two_handed`, `one_hand_shield` / `melee` | 既有 |
| `atk_melee_sweep_r` | 雙持近戰（右手）：橫掃 | 25 | | | `ev_hit@11, ev_end_lock@19` | `dual_wield` / `melee` | `[雙持新增]` |
| `atk_melee_sweep_l` | 雙持近戰（左手）：橫掃 | 25 | | | `ev_hit@11, ev_end_lock@19` | `dual_wield` / `melee` | `[雙持新增]` |
| `atk_melee_burst` | 近戰：擴散 | 34 | | | `ev_spawn_fx@16, ev_hit@18` | 全模式 / `melee` | 既有 |
| `atk_dash` | 突進：直線衝鋒攻擊 | 28 | | ✓ | `ev_hit@12, ev_end_lock@22` | `two_handed`, `one_hand_shield` | `[新增]` |
| `atk_dash_r` | 雙持突進（右手）：疾風突刺 | 24 | | ✓ | `ev_hit@10, ev_end_lock@18` | `dual_wield` | `[雙持新增]` |
| `atk_dash_l` | 雙持突進（左手）：疾風突刺 | 24 | | ✓ | `ev_hit@10, ev_end_lock@18` | `dual_wield` | `[雙持新增]` |
| `atk_ranged_line` | 射擊：直線 | 30 | | | `ev_spawn_fx@14` | `two_handed`, `one_hand_shield` / `ranged` | 既有 |
| `atk_ranged_line_r` | 雙持遠程（右手）：直線射擊／擲射 | 24 | | | `ev_spawn_fx@11, ev_end_lock@18` | `dual_wield` / `ranged` | `[雙持新增]` |
| `atk_ranged_line_l` | 雙持遠程（左手）：直線射擊／擲射 | 24 | | | `ev_spawn_fx@11, ev_end_lock@18` | `dual_wield` / `ranged` | `[雙持新增]` |
| `atk_ranged_cone` | 射擊：扇形 | 30 | | | `ev_spawn_fx@14` | `two_handed`, `one_hand_shield` / `ranged` | 既有 |
| `atk_ranged_cone_r` | 雙持遠程（右手）：扇形散射 | 26 | | | `ev_spawn_fx@12, ev_end_lock@20` | `dual_wield` / `ranged` | `[雙持新增]` |
| `atk_ranged_cone_l` | 雙持遠程（左手）：扇形散射 | 26 | | | `ev_spawn_fx@12, ev_end_lock@20` | `dual_wield` / `ranged` | `[雙持新增]` |
| `atk_ranged_arc` | 射擊：拋物線 | 34 | | | `ev_spawn_fx@18` | `two_handed`, `one_hand_shield` / `ranged` | 既有 |
| `atk_ranged_arc_r` | 雙持遠程（右手）：拋物線擲射 | 28 | | | `ev_spawn_fx@14, ev_end_lock@22` | `dual_wield` / `ranged` | `[雙持新增]` |
| `atk_ranged_arc_l` | 雙持遠程（左手）：拋物線擲射 | 28 | | | `ev_spawn_fx@14, ev_end_lock@22` | `dual_wield` / `ranged` | `[雙持新增]` |
| `atk_burst_target` | 遠程：指定目標點爆破引導 | 34 | | | `ev_spawn_fx@16, ev_hit@18` | 全模式 / `ranged` | `[新增]` |

### 3.4 輔助、場地、生態生活與演出（15 支）

| clip ID | 說明 | 幀數 | loop | RM | 事件@幀 | 備註 |
|---|---|---:|:---:|:---:|---|---|
| `sup_self` | 輔助：自身 | 36 | | | `ev_spawn_fx@18` | 既有 |
| `sup_ally` | 輔助：他者 | 36 | | | `ev_spawn_fx@18` | 既有 |
| `field_deploy` | 佈署場地 | 48 | | | `ev_spawn_fx@28` | 既有 |
| `field_utility` | 發動生活能力（操縱天氣／破障／生火） | 42 | | | `ev_spawn_fx@20` | `[新增]` |
| `wild_alert` | 野生警戒／領域威嚇 | 36 | | | `ev_spawn_fx@12` | `[新增]` |
| `sleep_rest` | 休眠／營地休息 | 90 | ✓ | | | `[新增]` |
| `eat_feed` | 進食／接受餵食 | 48 | | | `ev_spawn_fx@24` | `[新增]` |
| `petted` | 接受撫摸（依體型對位 `Socket_PetTouch`） | 60 | | | | 既有 |
| `summon_appear` | 被召喚登場 | 36 | | | | 既有 |
| `recall_vanish` | 被收回 | 24 | | | | 既有 |
| `capture_struggle` | 被收服時掙扎 | 45 | | | | 既有 |
| `overload_enter` | 進入超載 | 60 | | | `ev_spawn_fx@20` | 既有 |
| `overload_exit` | 超載結束 | 36 | | | | 既有 |
| `hatch` | 破蛋而出（僅幼年 `juvenile`） | 72 | | | | 既有 |
| `victory` | 勝利 | 60 | | | | 既有 |
