# 角色骨架與動作規格（`characters`）

> 對應資料來源：`catalog.js`（v2.10.0 `ACTIONS.character`）、`tasks.js`（`character-model-rig`）。  
> 更新日期：2026-11-19（共 **50** 支動作，含近期新增之移動／騎乘／生活採集／營火料理／圖鑑手冊／超載指令等 17 支動作）。

---

## 人形基礎骨架與動捕庫

共用來源位於 Google Drive 專案的 `characters/_motion_sources/humanoid_motion_library/`。庫內的 `game_actions.md` 依本頁 50 個動作 ID 列出對應素材、局部參考和需自製的部分。兩副 T-pose 模板位於 `rigs/`，ACCAD 與 CMU 實錄位於 `mocap/`，CC0 關鍵幀素材位於 `keyframed/`。原列為需自製的 11 支已完成，男女兩套 Blender Actions、姿勢預覽和驗證記錄位於 `authored/`。原列為局部參考的 21 支及其來源幀段位於 `hybrid/`。最後 18 支也已重定向，`complete/` 提供男、女各一份含 50 個可附加 Actions 的 Blender 庫，以及事件、幀數、根位移和循環驗證。`catalog.json` 記錄各素材的來源、採樣率、重定向骨名與遊戲動作對照。製作遊戲片段時，依本頁的幀數、循環、根位移和事件要求重定向並驗收。[開啟共用骨架庫](https://drive.google.com/drive/folders/1tHwde_PWFl3PARxx5Kz5zm6JQYG2KgqJ)

## 1. 骨架體系（Unity Humanoid）

- **骨骼上限**：≤ 75 骨骼，採 Unity Humanoid 標準命名：
  - 核心軀幹：`Hips` → `Spine` → `Chest` → `UpperChest` → `Neck` → `Head`
  - 四肢：`Shoulder` → `Arm` → `ForeArm` → `Hand`（含手指三節 `Thumb` / `Index` / `Middle` / `Ring` / `Little`）；`UpLeg` → `Leg` → `Foot` → `Toes`
  - 附屬物理：`Extra_*`（頭髮、披風、飾帶等）
- **插槽骨（Sockets）**：
  - `Socket_HandR_Prop`（右手道具／礦鎬／釣竿／廚具／收服器掛點）
  - `Socket_HandL_Prop`（左手道具／盾牌／冒險手冊掛點）
  - `Socket_Back_Pack`（背包掛點）
  - `Socket_Throw`（投擲收服道具／道具出手基準點）
  - `Socket_Head_FX`（頭頂／情緒／狀態特效掛點）

---

## 2. 動作清單（30 fps · 共 50 支）

> 標記 `[新增]` 為近期依 `cosmos_chimera` 現行玩法擴充的 17 支動作；既有 33 支 clip ID 全數保留相容。

### 2.1 基礎移動與穿越（13 支）

| clip | 說明 | 幀數 | loop | RM | 事件@幀 | 備註 |
|---|---|---:|:---:|:---:|---|---|
| `chr_idle` | 待機（2 秒短週期呼吸律動） | 60 | ✓ | | | 既有 |
| `chr_idle_long` | 長時間靜止週期動作（4 秒定力循環） | 120 | ✓ | | | 既有 |
| `chr_walk` | 走路 | 32 | ✓ | | `ev_footstep@8, ev_footstep@24` | 既有 |
| `chr_run` | 奔跑 | 22 | ✓ | | `ev_footstep@5, ev_footstep@16` | 既有 |
| `chr_sneak_idle` | 潛行待機 | 60 | ✓ | | | 既有 |
| `chr_sneak_move` | 潛行移動 | 40 | ✓ | | | 既有 |
| `chr_roll_dodge` | 翻滾閃避（無敵幀） | 20 | | ✓ | `ev_end_lock@16` | 既有 |
| `chr_jump` | 跳躍（起跳／滯空／落地） | 30 | | | | 既有 |
| `chr_swim_idle` | 水面漂浮待機 | 60 | ✓ | | | `[新增]` |
| `chr_swim_move` | 游泳移動 | 36 | ✓ | | | `[新增]` |
| `chr_glide` | 滑翔滯空（乘風／高空移動） | 45 | ✓ | | | `[新增]` |
| `chr_mount_idle` | 騎乘待機（坐姿握鞍） | 60 | ✓ | | | `[新增]` |
| `chr_mount_run` | 騎乘奔跑（騎乘衝刺） | 24 | ✓ | | | `[新增]` |

### 2.2 戰鬥與受擊（4 支）

| clip | 說明 | 幀數 | loop | RM | 事件@幀 | 備註 |
|---|---|---:|:---:|:---:|---|---|
| `chr_block` | 格擋（舉起→維持→放下） | 30 | | | | 既有 |
| `chr_hit_react` | 受擊 | 15 | | | | 既有 |
| `chr_knockdown` | 倒地 | 30 | | | | 既有 |
| `chr_getup` | 起身 | 30 | | | | 既有 |

### 2.3 指令與召喚（6 支）

| clip | 說明 | 幀數 | loop | RM | 事件@幀 | 備註 |
|---|---|---:|:---:|:---:|---|---|
| `chr_command_point` | 命令：指向目標 | 24 | | | `ev_release@10` | 既有 |
| `chr_command_attack` | 命令：全力進攻 | 24 | | | `ev_release@10` | 既有 |
| `chr_command_recall` | 命令：後退集合 | 24 | | | `ev_release@10` | 既有 |
| `chr_command_overload` | 命令：觸發超載進化 | 30 | | | `ev_spawn_fx@14` | `[新增]` |
| `chr_summon` | 召喚宙獸 | 36 | | | `ev_spawn_fx@18` | 既有 |
| `chr_recall` | 收回宙獸 | 30 | | | `ev_spawn_fx@14` | 既有 |

### 2.4 道具、背包與投擲收服（8 支）

| clip | 說明 | 幀數 | loop | RM | 事件@幀 | 備註 |
|---|---|---:|:---:|:---:|---|---|
| `chr_item_use_self` | 使用道具（自身） | 40 | | | `ev_spawn_fx@24` | 既有 |
| `chr_item_use_other` | 使用道具（他者／宙獸） | 40 | | | `ev_release@20` | 既有 |
| `chr_field_deploy` | 佈署場地 | 48 | | | `ev_spawn_fx@30` | 既有 |
| `chr_backpack_open` | 使用背包（取下→翻找→收回） | 60 | | | | 既有 |
| `chr_handbook_open` | 翻閱冒險手冊／圖鑑 | 60 | ✓ | | | `[新增]` |
| `chr_throw_card` | 投擲：符籙卡片（雙指甩出） | 24 | | | `ev_release@12` | 既有 |
| `chr_throw_bead` | 投擲：琉璃珠（下手拋擲） | 28 | | | `ev_release@15` | 既有 |
| `chr_throw_cube` | 投擲：魔術方塊（轉動後上手投） | 32 | | | `ev_release@18` | 既有 |

### 2.5 生活採集、營火與鍛造（10 支）

| clip | 說明 | 幀數 | loop | RM | 事件@幀 | 備註 |
|---|---|---:|:---:|:---:|---|---|
| `chr_interact_pickup` | 近身互動／拾取素材 | 24 | | | `ev_release@10` | `[新增]` |
| `chr_gather_forage` | 採集植物／散佈物（彎腰採摘） | 42 | | | `ev_release@22` | `[新增]` |
| `chr_mine_pick` | 礦鎬採礦（揮鎬敲擊礦脈） | 36 | | | `ev_hit@16, ev_spawn_fx@16` | `[新增]` |
| `chr_fish_cast` | 釣魚：拋竿 | 30 | | | `ev_release@16` | `[新增]` |
| `chr_fish_wait` | 釣魚：持竿待機 | 60 | ✓ | | | `[新增]` |
| `chr_fish_reel` | 釣魚：拉竿收魚 | 36 | | | `ev_spawn_fx@20` | `[新增]` |
| `chr_cook_camp` | 營火料理（生火／翻炒烹飪） | 60 | ✓ | | `ev_spawn_fx@30` | `[新增]` |
| `chr_craft_forge` | 生活製作／鍛造加工 | 48 | ✓ | | `ev_hit@18, ev_spawn_fx@18` | `[新增]` |
| `chr_trap_place` | 佈置／回收採集陷阱 | 40 | | | `ev_spawn_fx@22` | `[新增]` |
| `chr_revive_ally` | 營火復甦／治療昏厥宙獸 | 54 | | | `ev_spawn_fx@28` | `[新增]` |

### 2.6 對話、撫摸與結算（9 支）

| clip | 說明 | 幀數 | loop | RM | 事件@幀 | 備註 |
|---|---|---:|:---:|:---:|---|---|
| `chr_talk_idle` | 對話待機 | 90 | ✓ | | | 既有 |
| `chr_talk_gesture` | 對話手勢 | 45 | | | | 既有 |
| `chr_pet_xs` | 撫摸 XS 體型（托在掌心輕撫） | 60 | | | `ev_spawn_fx@30` | 既有 |
| `chr_pet_s` | 撫摸 S 體型（蹲下摸頭） | 60 | | | `ev_spawn_fx@30` | 既有 |
| `chr_pet_m` | 撫摸 M 體型（彎腰） | 60 | | | `ev_spawn_fx@30` | 既有 |
| `chr_pet_l` | 撫摸 L 體型（抬手摸頸） | 60 | | | `ev_spawn_fx@30` | 既有 |
| `chr_pet_xl` | 撫摸 XL 體型（宙獸低頭，雙手撫摸） | 72 | | | `ev_spawn_fx@36` | 既有 |
| `chr_victory` | 勝利 | 60 | | | | 既有 |
| `chr_defeated` | 戰敗 | 45 | | | | 既有 |
