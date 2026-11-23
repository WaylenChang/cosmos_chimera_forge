# 宙獸全圖鑑原型與形態分類總表（SSOT）

本表由 [designed.js](../../designed.js) 自動同步產生（共 **45** 條宙獸演化線：18 條已生成／御三家、27 條已設計待生成），將**設計原型（多標籤 `design_prototypes`）**與**形態分類維度（`base_entity`、`morphology_primary`、`morphology_secondary`）**納入單一對照表，避免重複選用相同生物或器物原型。

## 一、45 條宙獸演化線總表

| `line_id` | 狀態 | 屬性 | 名稱 | 設計原型（多標籤） | 基礎存在軸 | 主形態標籤 (60–70%) | 副形態標籤 (30–40%) | 敏感度 |
|---|---|---|---|---|---|---|---|---|
| `starter_sun_line` | 御三家（已定案） | 日 (light) | 鏡芽雀 → 鏡羽鷺 → 鏡環天鷺 | `大白鷺` · `太陽鏡陣` · `磁軌砲陣列` | `natural-bio` | `bio-artifact` | `bio-element` | `ok` |
| `starter_moon_line` | 御三家（已定案） | 月 (shadow) | 夜痕仔 → 夜痕狼 → 夜痕霜狼 | `灰狼` · `極光電離層` · `光學機獸` | `natural-bio` | `bio-element` | `bio-artifact` | `ok` |
| `starter_star_line` | 御三家（已定案） | 星 (thunder) | 星蹄駒 → 星蹄騏 → 星蹄天驥 | `駿馬` · `飛馬翼` · `超導軌道` | `supernatural-bio` | `multi-bio` | `bio-element` · `bio-artifact` | `ok` |
| `line_metal_gearclock` | 待生成（草稿） | 金 (metal) | 漏輪雛 → 漏輪衛 → 漏輪巨象 | `巨象` · `青銅發條` · `水力浮碗` | `natural-bio` | `bio-artifact` | `inanimate-biomimic` | `ok` |
| `line_wood_vinecrest` | 待生成（草稿） | 木 (wood) | 蔓冠守宮 → 蔓冠棘龍 → 蔓冠翠蜥 | `葉尾守宮` · `變色龍` · `藤蔓冠` | `natural-bio` | `bio-nature` | `bio-totem` | `review` |
| `line_water_tidecraft` | 待生成（草稿） | 水 (water) | 潮帆鰻 → 潮帆舟鰻 → 潮帆巨鰻 | `潮汐海鰻` · `雙體陶船` · `蟹爪風帆` | `natural-bio` | `bio-artifact` | `bio-element` | `ok` |
| `line_fire_blazelion` | 待生成（草稿） | 火 (fire) | 燼角羔 → 燼角羱 → 熔岩羱羊 → 焰角岩殿羱 | `沙漠羱羊` · `砂岩熔爐甲` · `電漿彎角` | `natural-bio` | `bio-element` | `bio-nature` | `ok` |
| `line_earth_gildedgolem` | 待生成（草稿） | 土 (earth) | 金殼仔 → 金甲滾犰 → 聖湖金甲犰 → 黃金聖甲巨犰 | `重甲犰狳` · `金箔雕甲` · `翡翠稜柱` | `natural-bio` | `bio-nature` | `bio-artifact` | `ok` |
| `line_ice_frostbeast` | 待生成（草稿） | 冰 (ice) | 霜角雛 → 霜角獵獸 → 霜角巨獸 | `極北鹿角獸` · `鍛鐵關節` · `毛氈鞍軛` | `supernatural-bio` | `bio-artifact` | `bio-element` · `bio-totem` | `review` |
| `line_wind_fluteglider` | 待生成（草稿） | 風 (wind) | 笛風舟 → 笛風巡舟 → 笛風天舟 | `排笛飛舟` · `刺繡滑翔帆` · `氣流風管` | `non-bio` | `inanimate-biomimic` | `bio-artifact` · `bio-element` | `ok` |
| `line_metal_citadelbull` | 待生成（草稿） | 金 (metal) | 城門鐵牛 | `翼牛` · `猛禽` · `城門甲冑` | `supernatural-bio` | `multi-bio` | `bio-totem` · `bio-artifact` | `review` |
| `line_wood_crownvine` | 待生成（草稿） | 木 (wood) | 蓮蔓龍蛇 | `濕地巨蛇` · `玉蓮冠冕` · `花藤羽飾` | `natural-bio` | `bio-nature` | `bio-totem` | `review` |
| `line_water_whalemaelstrom` | 待生成（草稿） | 水 (water) | 白鯨巨渦 | `象牙巨鯨` · `鹽晶脊柱` · `標槍繩索` | `natural-bio` | `bio-nature` | `bio-artifact` | `ok` |
| `line_fire_baobabhearth` | 待生成（草稿） | 火 (fire) | 猴麵包火蜥 | `陸行火蜥` · `猴麵包樹皮` · `火山爐心` | `natural-bio` | `bio-nature` | `bio-element` | `ok` |
| `line_earth_pillarbeast` | 待生成（草稿） | 土 (earth) | 石柱獠牙犀 | `神殿巨犀` · `浮雕石柱甲` · `玉石獨角` | `natural-bio` | `bio-nature` | `bio-totem` | `review` |
| `line_ice_driftvessel` | 待生成（草稿） | 冰 (ice) | 極地破冰獸 | `破冰木船` · `冰橇滑刃` · `測風桅杆` | `non-bio` | `inanimate-biomimic` | `bio-element` · `bio-artifact` | `ok` |
| `line_wind_mistwing` | 待生成（草稿） | 風 (wind) | 霧翼信天翁 | `遠洋信天翁` · `十字弓翼` · `航海星盤` | `natural-bio` | `bio-artifact` | `bio-element` | `ok` |
| `line_thunder_redburrower` | 待生成（草稿） | 雷 (thunder) | 戈壁赤電蟲 | `戈壁沙蟲` · `銅質電容環` · `磁軌脊刺` | `natural-bio` | `bio-element` | `bio-artifact` | `ok` |
| `line_light_foilprism` | 待生成（草稿） | 光 (light) | 金箔光環獸 | `折紙金箔環` · `粒子核球` · `稜鏡光扇` | `non-bio` | `inanimate-biomimic` | `amorphous-astral` · `bio-element` | `ok` |
| `line_shadow_ironsteed` | 待生成（草稿） | 影 (shadow) | 玄鐵幽貂熊 | `極北貂熊` · `寒鐵弧刃甲` · `幽影披風尾` | `natural-bio` | `bio-artifact` | `bio-element` | `ok` |
| `line_metal_trial_boss` | 待生成（草稿） | 金 (metal) | 羅盤星儀巨偶 | `黃銅星盤儀` · `羅盤準星環` · `雙桅砲台` | `non-bio` | `inanimate-biomimic` | `bio-artifact` | `ok` |
| `line_wood_trial_boss` | 待生成（草稿） | 木 (wood) | 翠波石塔龜 | `翠玉靈龜` · `湖心石塔` · `翡翠木劍` | `natural-bio` | `bio-nature` | `bio-totem` | `review` |
| `line_water_trial_boss` | 待生成（草稿） | 水 (water) | 銀潮珊瑚巨鱝 | `深海蝠鱝` · `珍珠珊瑚冠` · `潮汐滑翔翼` | `natural-bio` | `bio-nature` | `bio-element` | `ok` |
| `line_fire_trial_boss` | 待生成（草稿） | 火 (fire) | 熔岩雙輪蚺 | `黑曜巨蚺` · `火油戰車輪` · `熔岩裂縫甲` | `natural-bio` | `bio-element` | `bio-artifact` | `ok` |
| `line_earth_trial_boss` | 待生成（草稿） | 土 (earth) | 岩門赤岩巨熊 | `花崗岩巨熊` · `山門石柱前掌` · `壁畫陶片甲` | `natural-bio` | `bio-nature` | `bio-totem` | `review` |
| `line_ice_trial_boss` | 待生成（草稿） | 冰 (ice) | 冰桅六分海象 | `極地巨海象` · `三桅冰船背架` · `六分儀長牙` | `natural-bio` | `bio-artifact` | `bio-element` | `ok` |
| `line_thunder_trial_boss` | 待生成（草稿） | 雷 (thunder) | 塔紋方尖巨蜥 | `雷電巨蜥` · `方尖碑脊塔` · `新月金環` | `supernatural-bio` | `bio-totem` | `bio-element` · `bio-nature` | `review` |
| `line_wind_trial_boss` | 待生成（草稿） | 風 (wind) | 三翼星航巨蜓 | `平流層巨蜻蜓` · `三引擎渦輪尾` · `南十字羅盤` | `non-bio` | `inanimate-biomimic` | `bio-element` | `ok` |
| `line_shadow_trial_boss` | 待生成（草稿） | 影 (shadow) | 千燈墨潮獸 | `八腕巨蛸` · `貝殼面具` · `引魂幻燈` | `supernatural-bio` | `bio-totem` | `amorphous-astral` · `bio-artifact` | `review` |
| `line_light_trial_boss` | 待生成（草稿） | 光 (light) | 印紋聖角劍羚 | `單角劍羚` · `滑石玉雕印` · `聖光香爐冠` | `supernatural-bio` | `bio-totem` | `bio-artifact` | `review` |
| `cr_aqua_slime` | 已生成（Drive） | 水 (water) | 靈澤凝膠史萊姆 | `水滴史萊姆` · `水母觸膜` · `氣泡核` | `supernatural-bio` | `amorphous-astral` | `bio-element` | `ok` |
| `cr_chrono_beetle` | 已生成（Drive） | 金 (metal) | 懷錶犀角金龜 | `犀角甲蟲` · `航海懷錶` · `齒輪翼鞘` | `natural-bio` | `bio-artifact` | `inanimate-biomimic` | `ok` |
| `cr_earth_golem` | 已生成（Drive） | 土 (earth) | 陶泥厚岩偶 | `陶土石偶` · `花崗岩塊` · `古文符印` | `non-bio` | `inanimate-biomimic` | `bio-totem` · `bio-nature` | `review` |
| `cr_fire_wisp` | 已生成（Drive） | 火 (fire) | 熾焰火灶靈 | `炭火火靈` · `鑄鐵火灶` · `火舌燈籠` | `supernatural-bio` | `amorphous-astral` | `bio-element` · `inanimate-biomimic` | `ok` |
| `cr_frostblade_penguin` | 已生成（Drive） | 冰 (ice) | 冰刀企鵝 | `極地企鵝` · `競速冰刀` · `冰晶翼刃` | `natural-bio` | `bio-artifact` | `bio-element` | `ok` |
| `cr_ice_snowman` | 已生成（Drive） | 冰 (ice) | 霜魄冰晶雪人 | `雪人` · `六角冰晶` · `編織圍巾` | `non-bio` | `inanimate-biomimic` | `bio-element` · `bio-artifact` | `ok` |
| `cr_ink_stele` | 已生成（Drive） | 影 (shadow) | 墨影碑帖 | `浮空石碑帖` · `松煙墨煙` · `硃砂印章` | `non-bio` | `inanimate-biomimic` | `bio-totem` · `amorphous-astral` | `review` |
| `cr_light_khepri` | 已生成（Drive） | 光 (light) | 阿頓曦光聖甲蟲 | `聖甲蟲` · `太陽日輪` · `青金石甲` | `supernatural-bio` | `bio-totem` | `bio-element` | `review` |
| `cr_metal_vault` | 已生成（Drive） | 金 (metal) | 模組折疊集裝機兵 | `摺疊貨櫃` · `液壓機甲` · `防爆門盾` | `non-bio` | `inanimate-biomimic` | `bio-artifact` | `ok` |
| `cr_shadow_eye` | 已生成（Drive） | 影 (shadow) | 幽影虛空瞳 | `浮空魔眼` · `星雲黑洞` · `黑霧觸鬚` | `supernatural-bio` | `amorphous-astral` | `bio-element` | `ok` |
| `cr_solmane_lion` | 已生成（Drive） | 火 (fire) | 火鬃聖獅 | `草原雄獅` · `太陽日冕鬃` · `黃金爪甲` | `natural-bio` | `bio-element` | `bio-artifact` | `ok` |
| `cr_thunder_drone` | 已生成（Drive） | 雷 (thunder) | 超導電容巡航無人機 | `多旋翼無人機` · `超導電容環` · `電漿尾翼` | `non-bio` | `inanimate-biomimic` | `bio-element` | `ok` |
| `cr_verdant_aquila` | 已生成（Drive） | 木 (wood) | 葉冠鷲 | `高空金雕` · `蕨葉羽翼` · `橡木枝角` | `natural-bio` | `bio-nature` | — | `ok` |
| `cr_wind_bird` | 已生成（Drive） | 風 (wind) | 氣旋羽雲雀 | `鳴禽雲雀` · `積雲尾羽` · `氣旋風環` | `natural-bio` | `bio-element` | — | `ok` |
| `cr_wood_puppet` | 已生成（Drive） | 木 (wood) | 機巧靈木偶 | `懸絲木偶` · `十字翼架` · `發芽靈木` | `humanoid-bio` | `inanimate-biomimic` | `bio-nature` · `bio-artifact` | `ok` |

## 二、本次去重改設計明細（11 條撞型替換 ＋ 1 條 3D 結構修正）

| `line_id` | 原撞型原型 | 更換後新原型 | 修正重點 |
|---|---|---|---|
| `line_wood_vinecrest` | 熱帶彩翼錦禽（撞 cr_verdant_aquila） | 葉尾守宮 × 變色龍 × 藤蔓冠 | 保留原 `line_id`／招式與被動 ID，全批文案與圖鑑同步更新 |
| `line_fire_blazelion` | 幼獅 / 荒原獅（撞 cr_solmane_lion） | 沙漠羱羊 × 砂岩熔爐甲（四階統一） | 保留原 `line_id`／招式與被動 ID，全批文案與圖鑑同步更新 |
| `line_earth_gildedgolem` | 陶泥石偶（撞 cr_earth_golem） | 重甲犰狳 × 金箔雕甲（四階統一） | 保留原 `line_id`／招式與被動 ID，全批文案與圖鑑同步更新 |
| `line_earth_pillarbeast` | 獅象石獸（撞 cr_solmane_lion / 巨象） | 神殿巨犀 × 浮雕石柱甲 | 保留原 `line_id`／招式與被動 ID，全批文案與圖鑑同步更新 |
| `line_earth_trial_boss` | 花崗岩雄獅（撞 cr_solmane_lion） | 花崗岩巨熊 × 山門石柱前掌 | 保留原 `line_id`／招式與被動 ID，全批文案與圖鑑同步更新 |
| `line_thunder_trial_boss` | 雷電獅獸（撞 cr_solmane_lion） | 雷電巨蜥 × 方尖碑脊塔 | 保留原 `line_id`／招式與被動 ID，全批文案與圖鑑同步更新 |
| `line_shadow_ironsteed` | 玄鐵戰馬（撞 starter_star_line） | 極北貂熊 × 寒鐵弧刃甲 | 保留原 `line_id`／招式與被動 ID，全批文案與圖鑑同步更新 |
| `line_water_trial_boss` | 深海巨鰻（撞 line_water_tidecraft） | 深海蝠鱝 × 珍珠珊瑚冠 | 保留原 `line_id`／招式與被動 ID，全批文案與圖鑑同步更新 |
| `line_ice_trial_boss` | 極地巨鯨（撞 line_water_whalemaelstrom） | 極地巨海象 × 三桅冰船背架 | 保留原 `line_id`／招式與被動 ID，全批文案與圖鑑同步更新 |
| `line_wind_trial_boss` | 巨翼信天翁（撞 line_wind_mistwing） | 平流層巨蜻蜓 × 三引擎渦輪尾 | 保留原 `line_id`／招式與被動 ID，全批文案與圖鑑同步更新 |
| `line_light_trial_boss` | 單角神牛（撞 line_metal_citadelbull） | 單角劍羚 × 滑石玉雕印 | 保留原 `line_id`／招式與被動 ID，全批文案與圖鑑同步更新 |
| `line_metal_citadelbull` | 五足城門人首牛 | `翼牛` · `猛禽` · `城門甲冑` | 收斂為四足 `winged_quadruped` 與幾何青銅護面，補齊 `sensitivity: review` |
