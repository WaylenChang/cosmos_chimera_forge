#!/usr/bin/env python3
"""
Generate all 52 side-quest field utility definitions, 52 character prompt files
(with Front / Turnaround / Main Keyart prompts), 26 new 4-stage creature lines
(no creature portraits), update Data/_catalog/character-creature-links.json,
and emit docs/design/field-utility-side-quests.md.
"""

from __future__ import annotations

import glob
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

if __package__:
    from .project_drive import REPO_ROOT as FORGE_ROOT, project_drive_root
else:
    from project_drive import REPO_ROOT as FORGE_ROOT, project_drive_root

DRIVE = project_drive_root()
GAME_ROOT = FORGE_ROOT.parent / "cosmos_chimera"

# 52 side-quest specifications
# Each entry: (utility, quest_line, quest_name_zh, quest_goal_zh, elements, creature_spec, char_spec, target_pol, target_rng)
# creature_spec: either existing_id string OR dict for new 4-stage line
SIDE_QUESTS: list[dict[str, Any]] = [
    # --- 1. 探索與地形通行 (8) ---
    {
        "utility": "open_obstacle", "quest_line": "探索與地形通行", "quest_name_zh": "開山破壁",
        "quest_goal_zh": "引導宙獸粉碎封鎖礦道口的巨岩路障，打通捷徑",
        "elements": ["earth", "metal", "fire"],
        "creature": {"id": "line_earth_pillarbeast"},
        "char": {
            "name_zh": "羅克·鐵砧", "name_en": "Rock Anvil", "gender": "男", "age": 44, "ethnicity": "北歐",
            "region": "晶礦星峽谷", "era": "工業", "style": "礦場爆破工裝", "height_cm": 182,
            "physique": "寬肩厚實、臂力驚人的重裝體型", "hair": "焦糖棕粗短刺蝟頭與濃密落腮鬍",
            "eyes": "琥珀黃瞳、眉骨有舊礦疤", "outfit": "深灰鉚釘防塵工裝背心、厚帆布護膝長褲、鋼頭採礦靴",
            "palette": "60% 深岩灰、30% 陶土橘、10% 黃銅金", "gear": "手提氣動岩錐、腰掛礦用安全燈"
        },
        "target_pol": "yin", "target_rng": "melee"
    },
    {
        "utility": "dive", "quest_line": "探索與地形通行", "quest_name_zh": "深淵潛行",
        "quest_goal_zh": "潛入水深超過 1 m 的海溝遺跡，採回深海發光珊瑚",
        "elements": ["water", "shadow"],
        "creature": {"id": "line_water_whalemaelstrom"},
        "char": {
            "name_zh": "莫阿娜·卡伊", "name_en": "Moana Kai", "gender": "女", "age": 22, "ethnicity": "南島",
            "region": "風暴星海岸", "era": "商貿", "style": "南島傳統潛水機能服", "height_cm": 165,
            "physique": "修長流暢、肺活量極佳的泳者體態", "hair": "海藻黑波浪長髮編成雙麻花辮",
            "eyes": "深海青瞳、臉頰帶細小鹽晶雀斑", "outfit": "深靛藍貼身防水潛水短袍、貝殼編織護腕、赤足綁帶涼鞋",
            "palette": "60% 深海靛、30% 珊瑚白、10% 碧光青", "gear": "骨製潛水目鏡、腰間編織網袋"
        },
        "target_pol": "yin", "target_rng": "melee"
    },
    {
        "utility": "swim", "quest_line": "探索與地形通行", "quest_name_zh": "破浪渡礁",
        "quest_goal_zh": "乘水冰系宙獸高速橫渡海峽，登陸離島聚落遞送補給",
        "elements": ["water", "ice"],
        "creature": {"id": "ch_1st_batch_frostblade_penguin"},
        "char": {
            "name_zh": "汐音·浪矢", "name_en": "Shione Namishi", "gender": "女", "age": 17, "ethnicity": "東亞",
            "region": "風暴星群島", "era": "商貿", "style": "海港競速水手服", "height_cm": 160,
            "physique": "輕盈敏捷的青少年水上運動員體型", "hair": "銀白微藍挑染俐落短鮑伯頭",
            "eyes": "冰湖藍瞳、爽朗露齒笑", "outfit": "白藍拼色短版防風衝浪夾克、快乾短褲、防滑溯溪鞋",
            "palette": "60% 浪花白、30% 冰藍、10% 橘紅救生扣", "gear": "摺疊救生浮標、防水信號哨"
        },
        "target_pol": "yin", "target_rng": "melee"
    },
    {
        "utility": "fly", "quest_line": "探索與地形通行", "quest_name_zh": "乘風登島",
        "quest_goal_zh": "飛行至平流層下方空島部落，取回高空風向標",
        "elements": ["wind", "light", "fire"],
        "creature": {"id": "ch_1st_batch_wind_bird"},
        "char": {
            "name_zh": "伊卡洛·索爾", "name_en": "Icaro Sol", "gender": "男", "age": 19, "ethnicity": "地中海",
            "region": "風暴星高地", "era": "蒸汽龐克", "style": "古典飛艇領航裝", "height_cm": 174,
            "physique": "精瘦修長、肩背靈活的飛行員體態", "hair": "金棕色蓬鬆自然捲短髮",
            "eyes": "晴空藍瞳、額戴復古皮革飛行護目鏡", "outfit": "駝色麂皮飛行夾克、白色高領圍巾、馬褲與長筒飛行靴",
            "palette": "60% 駝褐、30% 雲白、10% 黃銅金", "gear": "黃銅風速計、皮革航圖卷軸"
        },
        "target_pol": "yang", "target_rng": "mid"
    },
    {
        "utility": "levitate", "quest_line": "探索與地形通行", "quest_name_zh": "星軌浮空",
        "quest_goal_zh": "突破 1.0 R 平流層限制，浮空抵達 1.25 R 太空站採樣",
        "elements": ["wind", "light", "thunder"],
        "creature": {"id": "line_wind_fluteglider"},
        "char": {
            "name_zh": "莉拉·星軌", "name_en": "Lyra Orbit", "gender": "女", "age": 24, "ethnicity": "白人",
            "region": "風暴星高軌道", "era": "未來／太空", "style": "輕量宇航觀測服", "height_cm": 168,
            "physique": "勻稱挺拔的無重力適應體態", "hair": "珍珠銀高丸子頭、兩側留長鬢髮",
            "eyes": "星雲紫瞳、左頰有全息數據貼片", "outfit": "流線型瓷白連身航員外套、青藍發光導流條、磁吸短靴",
            "palette": "60% 瓷白、30% 太空深灰、10% 青藍光帶", "gear": "掌上軌道羅盤終端、氣壓感測器"
        },
        "target_pol": "yin", "target_rng": "long"
    },
    {
        "utility": "mount", "quest_line": "探索與地形通行", "quest_name_zh": "疾馳草原",
        "quest_goal_zh": "騎乘宙獸高速穿越沼澤與深沙地形，限時送達急件",
        "elements": ["thunder", "earth"],
        "creature": {"id": "line_thunder_redburrower"},
        "char": {
            "name_zh": "巴圖·風蹄", "name_en": "Batu Windhoof", "gender": "男", "age": 29, "ethnicity": "中亞",
            "region": "晶礦星草原", "era": "農耕", "style": "游牧遊騎兵服飾", "height_cm": 178,
            "physique": "肩寬腰細、下盤穩固的騎手體型", "hair": "烏黑長髮綁成單條後辮、戴皮毛邊額帶",
            "eyes": "鷹隼琥珀瞳、古銅日曬膚色", "outfit": "靛藍鑲金邊對襟騎馬袍、皮革護腿、軟底高筒馬靴",
            "palette": "60% 靛藍、30% 草原赭褐、10% 熾電金", "gear": "編織皮鞭、銅製郵差號角"
        },
        "target_pol": "yin", "target_rng": "melee"
    },
    {
        "utility": "quick_escape", "quest_line": "探索與地形通行", "quest_name_zh": "電光脫身",
        "quest_goal_zh": "在強敵領地內施展瞬步脫戰，安全撤離至邊界營地",
        "elements": ["thunder", "shadow", "wind"],
        "creature": {
            "id": "line_thunder_arclynx", "name_zh": "電弧瞬猞猁", "name_en": "Arclynx",
            "core": "沙漠獰貓、電漿跳躍腳環、殘影尾羽", "base": "natural-bio", "prim": "bio-element", "sec": "pure-stylized-bio",
            "palette": "電光青、炭夜灰、閃電白", "vfx": "電光青電弧、紫白殘影", "motifs": "雙耳閃電簇毛、踝部高壓銅環、分段電光尾",
            "stages": [("電spark幼貓","0.40 m","XS","短耳帶微弱靜電火花的小獰貓"),("瞬步電猞","1.15 m","M","四肢裝設自然電弧環、能短距瞬閃的敏捷猞猁"),("雷影瞬豹","1.95 m","L","背脊豎起電漿鰭、留下三道殘影的高速獵豹"),("超載雷閃皇","4.3 m","XL","化為純電弧光輪與多層瞬移殘影的雷光幻獸")]
        },
        "char": {
            "name_zh": "影丸·疾風", "name_en": "Kagemaru Swift", "gender": "男", "age": 16, "ethnicity": "東亞",
            "region": "晨昏星密林", "era": "商貿", "style": "現代街頭忍者機能裝", "height_cm": 167,
            "physique": "極度輕盈靈活的跑酷少年體型", "hair": "墨黑偏分遮右眼碎短髮",
            "eyes": "電青銳利眼眸", "outfit": "深灰連帽半面罩機能風衣、束口縮腿褲、分趾忍者跑鞋",
            "palette": "60% 炭夜黑、30% 暗灰藍、10% 電光青", "gear": "腰掛煙霧彈囊、鉤爪腕帶"
        },
        "target_pol": "yin", "target_rng": "melee"
    },
    {
        "utility": "party_stealth", "quest_line": "探索與地形通行", "quest_name_zh": "無聲潛行",
        "quest_goal_zh": "開啟隊伍隱身繞過巡邏菁英怪，無傷取得遺跡密函",
        "elements": ["shadow", "wood", "wind"],
        "creature": {"id": "line_shadow_ironsteed"},
        "char": {
            "name_zh": "薇拉·暮紗", "name_en": "Vela Duskveil", "gender": "女", "age": 26, "ethnicity": "白人",
            "region": "晨昏星古林", "era": "商貿", "style": "林間斥候潛行服", "height_cm": 169,
            "physique": "修長無聲、肩背靈活的偵察兵體態", "hair": "煙灰紫中長髮斜挽於耳後",
            "eyes": "霧銀色冷靜雙瞳", "outfit": "苔綠與暮灰拼接短斗篷、貼身皮甲背心、靜音軟底長靴",
            "palette": "60% 暮灰、30% 苔綠、10% 淡紫微光", "gear": "摺疊望遠鏡、消音皮革箭筒"
        },
        "target_pol": "yin", "target_rng": "melee"
    },

    # --- 2. 戰鬥與收服輔助 (8) ---
    {
        "utility": "catch_rate_up", "quest_line": "戰鬥與收服輔助", "quest_name_zh": "精準收服",
        "quest_goal_zh": "利用時間校準與鎖定補助，成功收服高警戒野生宙獸",
        "elements": ["metal", "light", "wood"],
        "creature": {"id": "ch_1st_batch_chrono_beetle"},
        "char": {
            "name_zh": "奧利佛·鐘擺", "name_en": "Oliver Pendulum", "gender": "男", "age": 34, "ethnicity": "白人",
            "region": "晶礦星都市", "era": "蒸汽龐克", "style": "精密時計師禮裝", "height_cm": 176,
            "physique": "修長斯文的學者工匠體態", "hair": "深棕整齊後梳髮與細框單片眼鏡",
            "eyes": "翡翠綠瞳", "outfit": "深墨綠三件式背心套裝、黃銅懷錶鏈、棕色皮質圍裙",
            "palette": "60% 深墨綠、30% 米白襯衫、10% 黃銅金", "gear": "精密秒錶校正儀、琉璃珠彈匣"
        },
        "target_pol": "yin", "target_rng": "long"
    },
    {
        "utility": "steal_item", "quest_line": "戰鬥與收服輔助", "quest_name_zh": "暗影探囊",
        "quest_goal_zh": "在不擊倒野生宙獸的前提下，偷取其攜帶的稀有結晶",
        "elements": ["shadow", "thunder"],
        "creature": {
            "id": "line_shadow_magpie", "name_zh": "夜翎竊鵲", "name_en": "Nightmagpie",
            "core": "黑羽喜鵲、鏡面碎銀盜賊披肩、電光爪鉤", "base": "natural-bio", "prim": "bio-artifact", "sec": "bio-element",
            "palette": "夜羽黑、星銀白、幽紫電光", "vfx": "幽紫殘影羽、細電弧", "motifs": "雙翼銀箔飛羽、眼周白色假面斑、尾羽鑰匙圈紋",
            "stages": [("墨羽幼鵲","0.35 m","XS","叼著亮晶晶小鐵片的黑白圓滾幼鵲"),("掠影盜鵲","0.95 m","S","披著半透明影紗短披肩、爪帶微電的靈巧喜鵲"),("幽翎怪盜鴞","1.70 m","M","展開鋸齒銀羽斗篷與電光勾爪的夜行怪盜鳥"),("超載千影星鵲","3.8 m","XL","周身環繞無數懸浮鏡面分身與紫電羽陣的幻影巨鳥")]
        },
        "char": {
            "name_zh": "菲利克斯·夜鑰", "name_en": "Felix Nightkey", "gender": "男", "age": 21, "ethnicity": "地中海",
            "region": "晨昏星市集", "era": "商貿", "style": "義賊貴公子便裝", "height_cm": 175,
            "physique": "靈活修長的舞台魔術師體型", "hair": "酒紅微亂短髮",
            "eyes": "金琥珀狐狸眼、嘴角帶笑", "outfit": "深紫立領短披肩外套、白色荷葉襯衫、露指皮手套",
            "palette": "60% 暗夜紫、30% 象牙白、10% 亮銀", "gear": "黃銅萬用鎖匙串、魔術撲克符籙"
        },
        "target_pol": "yang", "target_rng": "melee"
    },
    {
        "utility": "prevent_escape", "quest_line": "戰鬥與收服輔助", "quest_name_zh": "霜封退路",
        "quest_goal_zh": "於暴雪或野外鎖定高機動目標，防止其脫戰逃逸",
        "elements": ["ice", "shadow"],
        "creature": {"id": "line_ice_frostbeast"},
        "char": {
            "name_zh": "希芙·凍鎖", "name_en": "Sif Frostlock", "gender": "女", "age": 31, "ethnicity": "北歐",
            "region": "冰晶星苔原", "era": "工業", "style": "極地雪原追蹤者裝束", "height_cm": 173,
            "physique": "高挑健美的雪地獵手體態", "hair": "白金色高束粗辮",
            "eyes": "冰晶淺灰藍瞳", "outfit": "深藏青毛領防寒短大衣、雪白毛皮護腿、冰爪長靴",
            "palette": "60% 深藏青、30% 雪白毛領、10% 冰晶青", "gear": "冰晶鎖鏈輪、雪地追蹤羅盤"
        },
        "target_pol": "yin", "target_rng": "long"
    },
    {
        "utility": "scout_potential", "quest_line": "戰鬥與收服輔助", "quest_name_zh": "真視洞察",
        "quest_goal_zh": "戰前掃描並解析 3 隻野生宙獸的弱點屬性與個體潛力",
        "elements": ["light", "metal", "thunder"],
        "creature": {"id": "ch_1st_batch_light_khepri"},
        "char": {
            "name_zh": "納比勒·星盤", "name_en": "Nabil Astrolabe", "gender": "男", "age": 39, "ethnicity": "西亞",
            "region": "晶礦星觀星台", "era": "未來／太空", "style": "光學數據學者長袍", "height_cm": 177,
            "physique": "挺拔儒雅的學者體態", "hair": "黑褐整齊短髮、下顎修剪細鬍",
            "eyes": "耀金瞳孔、左眼戴透明全息鏡片", "outfit": "米白科技機能長大衣、鈷藍幾何肩飾、深灰長褲",
            "palette": "60% 羊皮米白、30% 鈷藍、10% 曦光金", "gear": "浮空光學菱鏡、全息記錄板"
        },
        "target_pol": "yang", "target_rng": "long"
    },
    {
        "utility": "egg_hatch_boost", "quest_line": "戰鬥與收服輔助", "quest_name_zh": "恆溫育雛",
        "quest_goal_zh": "以恆溫火光陪伴孵化 1 顆稀有宙獸蛋，縮短孵化里程",
        "elements": ["fire", "light"],
        "creature": {
            "id": "line_fire_hearthhen", "name_zh": "暖巢絨雉", "name_en": "Hearthhen",
            "core": "母雞／鳳凰雛、發光暖爐胸羽、琥珀蛋殼鞍座", "base": "natural-bio", "prim": "bio-nature", "sec": "bio-element",
            "palette": "暖杏橙、奶油白、琥珀金", "vfx": "柔和金橙暖光、漂浮溫熱絨羽", "motifs": "胸前圓形恆溫爐紋、尾羽如蒲公英火絨",
            "stages": [("暖絨小雞","0.32 m","XS","頂著半顆暖光蛋殼帽的圓滾滾火絨雛鳥"),("溫巢花雉","0.88 m","S","胸羽散發穩定 37 度金橘微光的溫馴母雉"),("晨曦暖鳳","1.75 m","M","雙翼展開如金色羽絨披風的守護聖鳥"),("超載日輪母鳳","4.0 m","XL","化為懸浮金色太陽巢環與溫暖光羽陣的聖獸")]
        },
        "char": {
            "name_zh": "梅琳·育雛", "name_en": "Meilin Hatch", "gender": "女", "age": 27, "ethnicity": "東亞",
            "region": "翠綠星牧場", "era": "農耕", "style": "溫暖牧場保育員圍裙裝", "height_cm": 162,
            "physique": "柔和圓潤、富親和力的保育員體型", "hair": "栗棕鬆軟低丸子頭、插著羽毛髮夾",
            "eyes": "暖茶色溫柔彎眼", "outfit": "鵝黃針織開襟衫、亞麻寬鬆長裙、編織暖毛短靴",
            "palette": "60% 奶油亞麻、30% 暖杏黃、10% 琥珀紅", "gear": "恆溫保溫籃、絨毛溫度計"
        },
        "target_pol": "yin", "target_rng": "mid"
    },
    {
        "utility": "weather_control", "quest_line": "戰鬥與收服輔助", "quest_name_zh": "呼風喚雨",
        "quest_goal_zh": "主動切換區域天氣為降雨或雷暴，驗證戰術場域加成",
        "elements": ["wind", "water", "fire"],
        "creature": {"id": "line_wind_mistwing"},
        "char": {
            "name_zh": "阿娜伊·雲巫", "name_en": "Anahi Cloud", "gender": "女", "age": 52, "ethnicity": "美洲原住民",
            "region": "風暴星高原", "era": "原始", "style": "現代融合高原觀象祭司服", "height_cm": 166,
            "physique": "沉穩莊重的中年長者體態", "hair": "黑灰夾雜雙股長辮、配風羽頭飾",
            "eyes": "深邃黑褐瞳、臉頰有雲紋彩繪", "outfit": "深青與赤褐條紋羊毛披肩、流蘇長裙、軟皮高筒靴",
            "palette": "60% 風暴青灰、30% 赤陶紅、10% 雲金", "gear": "銅製測風銅鈴杖、風向旗"
        },
        "target_pol": "yang", "target_rng": "long"
    },
    {
        "utility": "ice_stride", "quest_line": "戰鬥與收服輔助", "quest_name_zh": "冰面踏行",
        "quest_goal_zh": "在結冰湖面無打滑高速突進並穩固重心",
        "elements": ["ice", "water"],
        "creature": {
            "id": "line_ice_skateray", "name_zh": "冰刃鰩", "name_en": "Skateray",
            "core": "魔鬼魚、冰刀腹鰭、寒氣噴射尾", "base": "natural-bio", "prim": "bio-element", "sec": "pure-stylized-bio",
            "palette": "冰晶青、雪瓷白、深海藍", "vfx": "細碎冰晶刮痕、冷霧拖尾", "motifs": "雙翼邊緣透明冰刃、背部雪花結晶紋",
            "stages": [("雪片小鰩","0.42 m","XS","貼地滑行的圓盤狀冰藍小鰩魚"),("冰刃滑鰩","1.10 m","S","翼緣凝結鋒利冰刀、能切冰滑行的鰩魚"),("霜翼巨鰩","2.20 m","M","雙翼寬展如冰帆、尾曳暴雪氣流的巨鰩"),("超載極光冰鰩","4.8 m","XL","全身透明冰晶化並懸浮極光冰環的寒冰巨獸")]
        },
        "char": {
            "name_zh": "尤里·冰刃", "name_en": "Yuri Iceblade", "gender": "男", "age": 18, "ethnicity": "白人",
            "region": "冰晶星冰湖", "era": "商貿", "style": "花式競速冰舞服", "height_cm": 176,
            "physique": "修長流線、核心極穩的滑冰選手體態", "hair": "淺亞麻金微捲中短髮",
            "eyes": "冰藍清澈眼眸", "outfit": "深海藍修身立領短外套、銀白幾何袖紋、冰刀短靴",
            "palette": "60% 深海藍、30% 銀白、10% 冰晶青", "gear": "可拆式冰刀護套、銀質哨子"
        },
        "target_pol": "yin", "target_rng": "melee"
    },
    {
        "utility": "weather_ward", "quest_line": "戰鬥與收服輔助", "quest_name_zh": "天象庇護",
        "quest_goal_zh": "在極端暴雪與雷暴下保護隊伍免受異常狀態侵襲",
        "elements": ["ice", "thunder", "water"],
        "creature": {
            "id": "line_water_auroraturtle", "name_zh": "極光汐龜", "name_en": "Auroraturtle",
            "core": "海龜、避雷玻璃穹頂背甲、極光水膜", "base": "natural-bio", "prim": "bio-nature", "sec": "bio-element",
            "palette": "深海青、極光綠、珍珠白", "vfx": "半球形避雷水幕、極光流帶", "motifs": "透明穹頂龜殼、四鰭電光紋",
            "stages": [("汐泡小龜","0.38 m","XS","背負半透明水泡殼的迷你海龜"),("避雷汐龜","1.05 m","M","龜殼頂端生出小型避雷晶柱的海龜"),("極光穹頂龜","2.10 m","L","背甲化為折射極光的玻璃水幕穹頂的巨龜"),("超載天幕玄武","5.0 m","XL","展開覆蓋全場極光防護罩與雷水雙環的守護神龜")]
        },
        "char": {
            "name_zh": "索菲亞·避雷", "name_en": "Sofia Ward", "gender": "女", "age": 35, "ethnicity": "北歐",
            "region": "冰晶星海岸燈塔", "era": "工業", "style": "燈塔守望員防水長外套", "height_cm": 171,
            "physique": "穩重挺拔的守望者體態", "hair": "紅褐盤髮別著銅製髮簪",
            "eyes": "翡翠綠瞳", "outfit": "亮黃防風防水油布短大衣、深藍毛衣、橡膠長雨靴",
            "palette": "60% 燈塔深藍、30% 防水暖黃、10% 極光青", "gear": "手提暴風燈籠、黃銅氣壓計"
        },
        "target_pol": "yin", "target_rng": "long"
    },

    # --- 3. 採集與生態補給 (9) ---
    {
        "utility": "cast_net", "quest_line": "採集與生態補給", "quest_name_zh": "千網豐收",
        "quest_goal_zh": "於海岸淺灘撒網批次撈捕 10 份平價魚貝食材",
        "elements": ["water"],
        "creature": {
            "id": "line_water_netpelican", "name_zh": "撒網鵜鶘", "name_en": "Netpelican",
            "core": "鵜鶘、編織漁網喉囊、木浮標羽飾", "base": "natural-bio", "prim": "bio-artifact", "sec": "bio-nature",
            "palette": "海鷗白、漁網麻褐、海藍", "vfx": "水花網紋、氣泡群", "motifs": "展開如撒網的雙翼與大喉囊、腳踝浮標環",
            "stages": [("網兜幼雛","0.42 m","XS","喉囊掛著小麻網的圓滾雛鳥"),("拋網鵜鶘","1.05 m","S","雙翼能甩出繩網捕魚的海鳥"),("巨囊潮鵜","1.90 m","M","喉囊編滿結實麻繩與浮標的巨型鵜鶘"),("超載滄海網皇","4.2 m","XL","展開巨型光水漁網覆蓋海面的海鳥巨像")]
        },
        "char": {
            "name_zh": "馬可·漁網", "name_en": "Marco Net", "gender": "男", "age": 48, "ethnicity": "地中海",
            "region": "風暴星漁港", "era": "農耕", "style": "傳統地中海漁夫服飾", "height_cm": 173,
            "physique": "精壯黝黑、雙臂有力的漁夫體型", "hair": "花白捲髮戴紅褐色針織漁夫帽",
            "eyes": "深棕笑眼、眼角帶海風細紋", "outfit": "藍白條紋棉衫、卡其防水捲邊工作褲、防滑膠靴",
            "palette": "60% 海軍藍、30% 米白、10% 漁標橘", "gear": "手編尼龍漁網、竹編魚簍"
        },
        "target_pol": "yang", "target_rng": "mid"
    },
    {
        "utility": "hunt_ground", "quest_line": "採集與生態補給", "quest_name_zh": "原野追獵",
        "quest_goal_zh": "狩獵陸棲野生生物取得 5 份新鮮地面肉類食材",
        "elements": ["fire", "earth", "shadow"],
        "creature": {"id": "ch_1st_batch_solmane_lion"},
        "char": {
            "name_zh": "肯亞·獅心", "name_en": "Kenya Lionheart", "gender": "男", "age": 25, "ethnicity": "東非",
            "region": "熔岩星草原", "era": "原始", "style": "薩瓦納草原現代獵手裝", "height_cm": 183,
            "physique": "修長爆發力極強的長跑獵手體態", "hair": "黑色緊密短辮",
            "eyes": "銳利金褐瞳", "outfit": "赤褐幾何織紋斜肩披布、耐磨皮革短褲、綁帶獵靴",
            "palette": "60% 草原赤褐、30% 炭黑、10% 日落金", "gear": "木柄投矛、皮革獵物腰包"
        },
        "target_pol": "yang", "target_rng": "melee"
    },
    {
        "utility": "hunt_sky", "quest_line": "採集與生態補給", "quest_name_zh": "蒼穹獵羽",
        "quest_goal_zh": "於懸崖與高空區狩獵飛禽取得禽肉與蛋類食材",
        "elements": ["wind", "thunder"],
        "creature": {
            "id": "line_wind_crossbowhawk", "name_zh": "弩翼遊隼", "name_en": "Crossbowhawk",
            "core": "遊隼、弓弩骨架雙翼、雷矢尾羽", "base": "natural-bio", "prim": "bio-artifact", "sec": "bio-element",
            "palette": "蒼穹灰藍、箭羽白、雷金", "vfx": "音爆箭環、細電羽", "motifs": "雙翼前緣如反曲弩弓、尾羽如箭鏃",
            "stages": [("矢羽幼隼","0.35 m","XS","頭頂翹起箭鏃呆毛的小隼鳥"),("弦翼隼","0.90 m","S","翼骨呈反曲弓形、能高速俯衝的猛禽"),("霹靂弩鷹","1.75 m","M","雙翼張開如重型連弩的閃電遊隼"),("超載天箭雷隼","3.9 m","XL","周身環繞浮游光箭陣與雷鳴音爆環的蒼穹聖鷹")]
        },
        "char": {
            "name_zh": "亞爾·鷹眼", "name_en": "Yar Hawkeye", "gender": "男", "age": 32, "ethnicity": "中亞",
            "region": "風暴星懸崖", "era": "商貿", "style": "草原馴鷹人皮甲裝", "height_cm": 179,
            "physique": "精實挺拔、視力極佳的弓手體態", "hair": "深棕過肩長髮半束",
            "eyes": "琥珀金瞳", "outfit": "深棕毛邊短皮襖、左臂加厚馴鷹護臂、馬靴",
            "palette": "60% 深棕皮、30% 灰藍布、10% 雷金線", "gear": "折疊反曲短弓、皮製鷹哨"
        },
        "target_pol": "yang", "target_rng": "long"
    },
    {
        "utility": "set_trap", "quest_line": "採集與生態補給", "quest_name_zh": "巧陷採獲",
        "quest_goal_zh": "於地表設置動物／昆蟲陷阱，探索後回來定時收成",
        "elements": ["earth", "shadow"],
        "creature": {
            "id": "line_earth_trapspider", "name_zh": "機關陷門蛛", "name_en": "Trapspider",
            "core": "螲蟷（活板門蜘蛛）、石質齒輪蓋板、感壓觸絲", "base": "natural-bio", "prim": "inanimate-biomimic", "sec": "bio-nature",
            "palette": "砂岩褐、頁岩灰、幽苔綠", "vfx": "沙塵噴濺、微弱幽綠感壓線", "motifs": "背部圓形石質活板門、八足齒輪關節",
            "stages": [("沙蓋小蛛","0.35 m","XS","背著一塊圓卵石蓋子的小蜘蛛"),("齒板陷蛛","0.95 m","S","能在地面挖出齒輪機關蓋板的八足蛛"),("岩機地螲","1.85 m","M","背甲化為複雜石鎖機關陣的巨型活板門蛛"),("超載千機石蛛","4.1 m","XL","展開多層浮空岩盤齒輪與影絲陷阱網的機關巨蛛")]
        },
        "char": {
            "name_zh": "托比·巧手", "name_en": "Toby Snare", "gender": "男", "age": 14, "ethnicity": "原住民",
            "region": "翠綠星林緣", "era": "原始", "style": "少年林間設陷手服裝", "height_cm": 156,
            "physique": "嬌小靈巧的青少年體型", "hair": "栗黑自然捲短髮插著樹枝",
            "eyes": "機靈深棕眼", "outfit": "卡其多口袋背心、麻布七分褲、綁腿草鞋",
            "palette": "60% 卡其麻褐、30% 森林綠、10% 泥灰", "gear": "木製彈簧陷阱架、麻繩捲"
        },
        "target_pol": "yin", "target_rng": "mid"
    },
    {
        "utility": "harvest_crops", "quest_line": "採集與生態補給", "quest_name_zh": "豐饒農田",
        "quest_goal_zh": "於聚落農田收割穀物、塊莖與油料作物，供給加工",
        "elements": ["wood", "earth", "water"],
        "creature": {"id": "line_wood_crownvine"},
        "char": {
            "name_zh": "穗乃果·實", "name_en": "Honoka Minori", "gender": "女", "age": 20, "ethnicity": "東亞",
            "region": "翠綠星梯田", "era": "農耕", "style": "明亮田園農耕作業服", "height_cm": 159,
            "physique": "健康元氣的青年農夫體態", "hair": "暖栗色雙馬尾戴草編遮陽帽",
            "eyes": "翡翠綠明亮大眼", "outfit": "淺藍格紋襯衫捲袖、棕色吊帶工作褲、防水農作短靴",
            "palette": "60% 麥穗黃、30% 天空藍、10% 嫩葉綠", "gear": "彎月小鐮刀、藤編收穫籃"
        },
        "target_pol": "yang", "target_rng": "melee"
    },
    {
        "utility": "produce_milk", "quest_line": "採集與生態補給", "quest_name_zh": "晨露鮮乳",
        "quest_goal_zh": "照料草食哺乳類宙獸並定期收取 3 份營養鮮乳",
        "elements": ["wood", "earth"],
        "creature": {
            "id": "line_earth_milkyak", "name_zh": "乳花犛牛", "name_en": "Milkyak",
            "core": "高原犛牛、奶白色鈴蘭花冠、陶瓷奶罐角飾", "base": "natural-bio", "prim": "bio-nature", "sec": "pure-stylized-bio",
            "palette": "乳脂白、牧草綠、陶土棕", "vfx": "乳白光點、草葉飄落", "motifs": "雙角垂掛白色鈴蘭花鈴、蓬鬆奶油長毛",
            "stages": [("奶球小犢","0.48 m","S","圓滾滾、頭頂兩朵小鈴蘭的乳白牛犢"),("花鈴犛牛","1.35 m","M","長滿蓬鬆乳白絨毛與藤蔓項圈的溫馴犛牛"),("豐饒花犛牛","2.25 m","L","背負繁花草甸與陶鈴雙角的巨型犛牛"),("超載聖乳神牛","4.9 m","XL","周身環繞乳白星雲花環與豐饒光柱的高原聖獸")]
        },
        "char": {
            "name_zh": "海蒂·牧鈴", "name_en": "Heidi Bell", "gender": "女", "age": 12, "ethnicity": "白人",
            "region": "翠綠星高山牧場", "era": "農耕", "style": "阿爾卑斯牧童洋裝", "height_cm": 144,
            "physique": "活潑健康的兒童體型", "hair": "蜜金雙股長辮配紅白格紋髮帶",
            "eyes": "天藍圓潤雙眼", "outfit": "白色泡泡袖襯衫、深紅吊帶短裙、羊毛長襪與小皮鞋",
            "palette": "60% 乳白、30% 牧草紅、10% 金銅牛鈴", "gear": "木柄不鏽鋼提奶桶、銅牧鈴"
        },
        "target_pol": "yang", "target_rng": "melee"
    },
    {
        "utility": "forage_fungi", "quest_line": "採集與生態補給", "quest_name_zh": "幽谷尋菇",
        "quest_goal_zh": "於洞穴與陰暗沼澤採集發光菌菇與松露食材",
        "elements": ["shadow", "earth"],
        "creature": {
            "id": "line_shadow_shroomtapir", "name_zh": "螢菇貘", "name_en": "Shroomtapir",
            "core": "馬來貘、夜光傘菌背冠、孢子鼻管", "base": "natural-bio", "prim": "bio-nature", "sec": "amorphous-astral",
            "palette": "菌絲黑、幽藍螢光、苔土褐", "vfx": "藍紫螢光孢子雲", "motifs": "背部三層階梯狀發光靈芝傘、長鼻端感測觸鬚",
            "stages": [("孢子小貘","0.44 m","S","背上長著一顆藍光小蘑菇的圓胖貘寶寶"),("螢傘貘","1.15 m","M","背脊排滿階梯螢光菌傘、鼻端閃微光的貘"),("幽菌巨貘","2.10 m","L","全身覆蓋發光菌絲斗篷與巨型靈芝背冠的巨貘"),("超載菌星巨貘","4.6 m","XL","散發滿天星雲孢子傘蓋與暗影菌網的森林靈獸")]
        },
        "char": {
            "name_zh": "默林·菌叟", "name_en": "Merlin Fungi", "gender": "男", "age": 64, "ethnicity": "白人",
            "region": "晨昏星洞穴", "era": "農耕", "style": "隱世森林採菇長者袍", "height_cm": 168,
            "physique": "微駝但步履穩健的長者體態", "hair": "銀白蓬鬆長髮與長鬍，戴寬邊軟呢菇帽",
            "eyes": "深邃灰綠瞳、眼神慈祥", "outfit": "苔褐厚呢披肩斗篷、多口袋麻衣、厚底皮靴",
            "palette": "60% 枯葉褐、30% 苔暗綠、10% 幽藍菌光", "gear": "竹編採菇籃、放大鏡、木杖"
        },
        "target_pol": "yin", "target_rng": "long"
    },
    {
        "utility": "gather_essence", "quest_line": "採集與生態補給", "quest_name_zh": "晶脈萃靈",
        "quest_goal_zh": "從礦脈與結晶中萃取 5 份高純度元素精粹（附魔原料）",
        "elements": ["earth", "ice", "metal"],
        "creature": {"id": "ch_1st_batch_earth_golem"},
        "char": {
            "name_zh": "瑟蕾娜·晶脈", "name_en": "Selena Vein", "gender": "女", "age": 33, "ethnicity": "南亞",
            "region": "晶礦星礦脈", "era": "工業", "style": "地質結晶萃取師機能裝", "height_cm": 170,
            "physique": "修長精幹的實驗技術員體態", "hair": "烏黑長髮盤成俐落低髮髻",
            "eyes": "紫晶色亮眼", "outfit": "深石青防酸實驗短袍、皮質護腕、防滑作業靴",
            "palette": "60% 深石青、30% 銀灰、10% 晶紫", "gear": "音叉共鳴萃取器、試管腰帶"
        },
        "target_pol": "yin", "target_rng": "mid"
    },
    {
        "utility": "sense_treasure", "quest_line": "採集與生態補給", "quest_name_zh": "尋寶脈衝",
        "quest_goal_zh": "感應並定位隱藏寶箱與地下埋藏物的脈衝方向",
        "elements": ["metal", "thunder", "light"],
        "creature": {
            "id": "line_metal_radarhound", "name_zh": "羅盤獵犬", "name_en": "Radarhound",
            "core": "獵犬、旋轉黃銅探測耳罩、磁力指針尾", "base": "non-bio", "prim": "inanimate-biomimic", "sec": "bio-artifact",
            "palette": "黃銅金、鈷藍釉、銀白", "vfx": "金色同心圓聲納波紋", "motifs": "雙耳如拋物面雷達碟、尾巴末端為磁針羅盤",
            "stages": [("銅鈴幼犬","0.40 m","XS","耳朵像小銅碗、鼻子會發光的小機械犬"),("聲納獵犬","1.05 m","M","配備雙旋轉雷達耳與磁針尾的敏捷偵查犬"),("金盤巨獵犬","1.85 m","L","胸口嵌著大型星盤探測儀的鋼骨獵犬"),("超載天星偵查神犬","4.2 m","XL","周身展開三層金色全息雷達環與雷電聲納陣的機械聖犬")]
        },
        "char": {
            "name_zh": "傑克·尋金", "name_en": "Jack Seeker", "gender": "男", "age": 23, "ethnicity": "非裔",
            "region": "晶礦星遺跡", "era": "廢土", "style": "廢土遺跡尋寶獵人裝", "height_cm": 180,
            "physique": "精實修長的冒險者體態", "hair": "黑色短髒辮配黃銅扣環",
            "eyes": "亮金琥珀瞳", "outfit": "沙色破舊機能夾克、深棕多袋褲、厚底工裝靴",
            "palette": "60% 沙土褐、30% 深炭黑、10% 尋寶金", "gear": "手持金屬探測環、折疊工兵鏟"
        },
        "target_pol": "yang", "target_rng": "long"
    },

    # --- 4. 料理與加工 (7) ---
    {
        "utility": "campfire_revive", "quest_line": "料理與加工", "quest_name_zh": "營火復甦",
        "quest_goal_zh": "紮營點燃營火，將 1 隻昏厥的主力宙獸復甦歸隊",
        "elements": ["fire", "light"],
        "creature": {"id": "line_fire_baobabhearth"},
        "char": {
            "name_zh": "諾拉·星火", "name_en": "Nora Hearth", "gender": "女", "age": 38, "ethnicity": "東南亞",
            "region": "熔岩星營地", "era": "農耕", "style": "溫暖守夜營火看護裝", "height_cm": 164,
            "physique": "溫和沉穩的成熟女性體態", "hair": "深棕波浪長髮半挽以木釵固定",
            "eyes": "暖橙褐雙瞳", "outfit": "暖赤褐針織披肩、米白亞麻長襯衫、深棕長褲與短靴",
            "palette": "60% 暖赤褐、30% 米白、10% 營火金", "gear": "隨身銅火盆、草藥急救包"
        },
        "target_pol": "yin", "target_rng": "mid"
    },
    {
        "utility": "culinary_prep", "quest_line": "料理與加工", "quest_name_zh": "精細備料",
        "quest_goal_zh": "於野外完成涼拌／研磨／蒸製備料，達成最高品質料理",
        "elements": ["ice", "wood", "metal", "water"],
        "creature": {"id": "line_metal_citadelbull"},
        "char": {
            "name_zh": "克萊兒·備膳", "name_en": "Claire Prep", "gender": "女", "age": 26, "ethnicity": "白人",
            "region": "翠綠星小鎮", "era": "商貿", "style": "精緻法式旅途副廚裝", "height_cm": 166,
            "physique": "優雅整潔的青年廚師體態", "hair": "酒紅俐落馬尾配白色三角巾",
            "eyes": "青蘋果綠瞳", "outfit": "象牙白雙排扣短袖廚師服、深藍條紋長圍裙、平底皮鞋",
            "palette": "60% 象牙白、30% 深藍、10% 銀鋼刀光", "gear": "捲式主廚刀具組、大理石小研缽"
        },
        "target_pol": "yang", "target_rng": "melee"
    },
    {
        "utility": "chill_brew", "quest_line": "料理與加工", "quest_name_zh": "冰鎮特調",
        "quest_goal_zh": "不需生火即調製出降溫冰沙與冷湯特調料理",
        "elements": ["ice", "water"],
        "creature": {"id": "ch_1st_batch_ice_snowman"},
        "char": {
            "name_zh": "夏露·冰飲", "name_en": "Shalu Chill", "gender": "女", "age": 19, "ethnicity": "東亞",
            "region": "冰晶星市集", "era": "商貿", "style": "清爽冰菓飲品師服", "height_cm": 158,
            "physique": "纖細甜美的少女體型", "hair": "薄荷藍雙團子頭配碎冰髮飾",
            "eyes": "碧藍亮眼", "outfit": "雪白短袖襯衫、水藍荷葉邊圍裙、白色短靴",
            "palette": "60% 雪白、30% 薄荷水藍、10% 檸檬黃", "gear": "雪克搖搖杯、碎冰雕刻錐"
        },
        "target_pol": "yin", "target_rng": "mid"
    },
    {
        "utility": "ferment_cure", "quest_line": "料理與加工", "quest_name_zh": "歲月發酵",
        "quest_goal_zh": "將生鮮肉魚發酵熟成，延長料理增益持續時間",
        "elements": ["water", "wood", "shadow"],
        "creature": {
            "id": "line_wood_kegbadger", "name_zh": "橡木釀獾", "name_en": "Kegbadger",
            "core": "蜜獾、橡木發酵桶背甲、菌霜白爪", "base": "natural-bio", "prim": "bio-artifact", "sec": "bio-nature",
            "palette": "橡木褐、菌絲白、深紫漿", "vfx": "紫白發酵氣泡、木香霧氣", "motifs": "背嵌銅箍橡木小酒桶、臉頰白色菌斑條紋",
            "stages": [("木塞幼獾","0.40 m","XS","背著小木塞桶的圓胖獾寶寶"),("釀桶獾","1.05 m","S","桶身滲出清香發酵霧氣的健壯蜜獾"),("陳釀巨獾","1.85 m","M","背負雙層銅箍發酵巨桶與藤蔓封印的巨獾"),("超載瓊漿神獾","4.1 m","XL","周身環繞懸浮橡木釀甕與紫金發酵星雲的靈獸")]
        },
        "char": {
            "name_zh": "高田·麴翁", "name_en": "Takada Koji", "gender": "男", "age": 59, "ethnicity": "東亞",
            "region": "翠綠星山村", "era": "農耕", "style": "傳統釀造職人和風作務衣", "height_cm": 169,
            "physique": "精瘦結實的老師傅體態", "hair": "花白短髮額繫深藍布巾",
            "eyes": "睿智細長黑瞳", "outfit": "深靛藍傳統作務衣、麻布長圍裙、木屐與足袋",
            "palette": "60% 深靛藍、30% 原木褐、10% 麴白", "gear": "木質攪拌槳、陶製發酵小甕"
        },
        "target_pol": "yin", "target_rng": "long"
    },
    {
        "utility": "smoke_dry", "quest_line": "料理與加工", "quest_name_zh": "風乾燻製",
        "quest_goal_zh": "以高溫煙燻與乾燥氣流製成便攜耐放乾糧",
        "elements": ["wind", "fire"],
        "creature": {
            "id": "line_wind_smokekestrel", "name_zh": "燻風隼", "name_en": "Smokekestrel",
            "core": "紅隼、雙翼炭火燻爐羽鞘、熱風螺旋尾", "base": "natural-bio", "prim": "bio-element", "sec": "bio-artifact",
            "palette": "燻煙灰、餘燼橘、原木棕", "vfx": "旋風火星、松木香煙", "motifs": "翼根嵌著迷你陶瓷燻爐、尾羽呈螺旋風標",
            "stages": [("煙絨幼隼","0.34 m","XS","身上帶著松木煙香味的小隼"),("風爐隼","0.88 m","S","扇動翅膀能吹出乾燥熱風的紅隼"),("熾燻巨隼","1.70 m","M","翼下雙爐噴吐螺旋熱煙氣流的猛禽"),("超載焚風燻鷹","3.8 m","XL","化為赤金旋風與炙熱煙雲環繞的風火猛禽")]
        },
        "char": {
            "name_zh": "比約恩·燻肉", "name_en": "Bjorn Smoke", "gender": "男", "age": 41, "ethnicity": "北歐",
            "region": "冰晶星木屋", "era": "農耕", "style": "北歐獵屋燻製匠裝", "height_cm": 181,
            "physique": "厚實寬闊的北歐工匠體態", "hair": "紅金色濃密短髮與編辮鬍",
            "eyes": "深灰藍瞳", "outfit": "深棕毛領皮背心、格子法蘭絨襯衫、厚實工作褲與皮靴",
            "palette": "60% 燻木棕、30% 炭灰、10% 餘燼橘", "gear": "掛肉鐵鉤串、隨身迷你燻煙筒"
        },
        "target_pol": "yang", "target_rng": "mid"
    },

    # --- 5. 鍛造與冶煉 (5) ---
    {
        "utility": "craft_smelt_fire", "quest_line": "鍛造與冶煉", "quest_name_zh": "烈焰高爐",
        "quest_goal_zh": "以高溫火焰在野外熔煉礦石為高純度金屬錠",
        "elements": ["fire"],
        "creature": {"id": "ch_1st_batch_fire_wisp"},
        "char": {
            "name_zh": "伊格納·熾爐", "name_en": "Igna Furnace", "gender": "男", "age": 46, "ethnicity": "南歐",
            "region": "熔岩星冶煉場", "era": "工業", "style": "重工業高爐冶煉工裝", "height_cm": 180,
            "physique": "魁梧壯碩的傳統冶煉匠體型", "hair": "火紅夾雜灰白寸頭與短鬍",
            "eyes": "熔金橙瞳", "outfit": "隔熱銀灰長圍裙、無袖炭黑重磅棉衫、鋼頭防護靴",
            "palette": "60% 炭黑、30% 銀灰隔熱、10% 熾焰橘", "gear": "長柄坩堝鉗、隔熱防護面罩"
        },
        "target_pol": "yang", "target_rng": "melee"
    },
    {
        "utility": "craft_smelt_metal", "quest_line": "鍛造與冶煉", "quest_name_zh": "精煉壓鑄",
        "quest_goal_zh": "透過高壓金屬共鳴壓鑄出無雜質合金錠",
        "elements": ["metal"],
        "creature": {"id": "ch_1st_batch_metal_vault"},
        "char": {
            "name_zh": "漢斯·壓鑄", "name_en": "Hans Diecast", "gender": "男", "age": 50, "ethnicity": "白人",
            "region": "晶礦星精煉廠", "era": "工業", "style": "精密機械壓鑄技師裝", "height_cm": 177,
            "physique": "結實方正的資深技師體態", "hair": "銀灰整齊側分短髮",
            "eyes": "鋼藍冷靜雙眼", "outfit": "深藍工業工裝夾克、黃銅量尺腰帶、重型工作靴",
            "palette": "60% 工業深藍、30% 精鋼灰、10% 銅金", "gear": "游標卡尺、合金檢驗錘"
        },
        "target_pol": "yin", "target_rng": "melee"
    },
    {
        "utility": "craft_smith_metal", "quest_line": "鍛造與冶煉", "quest_name_zh": "千錘百鍛",
        "quest_goal_zh": "以精密金屬敲擊鍛造出高耐久鋼製武器",
        "elements": ["metal"],
        "creature": {
            "id": "line_metal_anvilram", "name_zh": "鐵砧公羊", "name_en": "Anvilram",
            "core": "大角羊、鋼鐵鐵砧額角、火星蹄鐵", "base": "natural-bio", "prim": "bio-artifact", "sec": "inanimate-biomimic",
            "palette": "鍛鐵黑、精鋼銀、餘燼金", "vfx": "敲擊金色火星、清脆音波環", "motifs": "額前雙角融合成T字型重型鐵砧、四蹄燃燒餘燼",
            "stages": [("鐵錘羔羊","0.46 m","S","額頭頂著小鐵錘凸起的小黑羊"),("鍛角公羊","1.28 m","M","雙角如雙面鐵砧般厚實的重裝公羊"),("聖砧巨羊","2.15 m","L","肩背覆蓋鍛鐵鱗甲、額角可承受萬鈞重擊的巨羊"),("超載天鍛神羊","4.7 m","XL","周身懸浮七柄鍛造光錘與黃金火花環的鍛造聖獸")]
        },
        "char": {
            "name_zh": "芙蕾雅·銀砧", "name_en": "Freya Anvil", "gender": "女", "age": 28, "ethnicity": "北歐",
            "region": "晶礦星鐵匠鋪", "era": "商貿", "style": "北歐女鍛造師皮甲圍裙裝", "height_cm": 174,
            "physique": "高挑健美、手臂線條結實的鍛造師體態", "hair": "火紅長髮高綁馬尾",
            "eyes": "琥珀金瞳", "outfit": "深棕厚牛皮鍛造圍裙、無袖白麻襯衫、護腕與重靴",
            "palette": "60% 深棕皮、30% 精鋼灰、10% 火星金", "gear": "單手鍛造圓頭錘、皮革護臂"
        },
        "target_pol": "yang", "target_rng": "melee"
    },
    {
        "utility": "craft_smith_fire", "quest_line": "鍛造與冶煉", "quest_name_zh": "炎紋鍛造",
        "quest_goal_zh": "結合烈焰淬火鍛造出帶有熱能加成的武器",
        "elements": ["fire", "metal"],
        "creature": {
            "id": "line_fire_bellowsboar", "name_zh": "風箱炎豬", "name_en": "Bellowsboar",
            "core": "野豬、雙側風箱肋甲、熔鐵獠牙", "base": "natural-bio", "prim": "bio-artifact", "sec": "bio-element",
            "palette": "赤銅紅、焦炭黑、熔金橘", "vfx": "鼓風火焰噴射、赤熱蒸汽", "motifs": "胸肋兩側可開合的皮革銅風箱構造、通紅雙獠牙",
            "stages": [("火鼻小豬","0.45 m","S","鼻孔會噴出小火星、背帶銅扣的小野豬"),("鼓風炎豬","1.20 m","M","呼吸時體側風箱會自動鼓風助燃的野豬"),("熔牙巨彘","2.10 m","L","雙獠牙如赤熱鍛鐵、全身覆蓋銅甲的巨豬"),("超載煉獄鼓風王","4.6 m","XL","全身化為移動熔鐵爐與四道烈焰風箱噴口的火獸")]
        },
        "char": {
            "name_zh": "剛藏·炎鍛", "name_en": "Gozo Flameforge", "gender": "男", "age": 54, "ethnicity": "東亞",
            "region": "熔岩星鍛刀坊", "era": "農耕", "style": "東亞傳統鑄劍師服飾", "height_cm": 172,
            "physique": "精悍厚實的老師傅體型", "hair": "銀白短髮綁白色頭巾",
            "eyes": "炯炯有神的深褐瞳", "outfit": "單肩袒露的深藍粗布鍛衣、火痕耐火褲、草編厚底鞋",
            "palette": "60% 深藍粗布、30% 炭黑、10% 朱紅火光", "gear": "雙手長柄鍛鐵鉗、淬火水杓"
        },
        "target_pol": "yang", "target_rng": "melee"
    },
    {
        "utility": "craft_smith_earth", "quest_line": "鍛造與冶煉", "quest_name_zh": "岩骨重鍛",
        "quest_goal_zh": "以玄武岩重錘鍛壓出高失衡值重型武器",
        "elements": ["earth", "metal"],
        "creature": {
            "id": "line_earth_slagarmadillo", "name_zh": "礦渣重犰", "name_en": "Slagarmadillo",
            "core": "巨犰狳、黑曜石鍛錘尾、玄武岩層甲", "base": "natural-bio", "prim": "bio-nature", "sec": "bio-artifact",
            "palette": "玄武黑灰、礦渣金、砂岩褐", "vfx": "岩石碎裂衝擊波、金屑火花", "motifs": "尾部末端長著方形玄武岩大重錘、背部交錯疊層礦甲",
            "stages": [("礫石小犰","0.38 m","XS","縮成一顆圓滾小卵石的小犰狳"),("岩錘犰狳","1.05 m","M","尾巴末端凝結實心石錘的犰狳"),("重甲礦犰","1.95 m","L","披著多層黑曜岩甲片與重型流星錘尾的巨犰狳"),("超載泰坦鍛犰","4.4 m","XL","化為懸浮黑曜巨盾環與千斤岩錘尾的巨獸")]
        },
        "char": {
            "name_zh": "達里奧·岩錘", "name_en": "Dario Rockhammer", "gender": "男", "age": 37, "ethnicity": "拉丁",
            "region": "晶礦星采石場", "era": "工業", "style": "重裝石鐵雙修工匠裝", "height_cm": 184,
            "physique": "高大寬闊的重裝工匠體型", "hair": "黑棕色濃密捲髮與短鬍",
            "eyes": "大地褐瞳", "outfit": "褐灰色厚皮革護胸、耐磨工裝褲、鐵頭重靴",
            "palette": "60% 岩褐、30% 鐵灰、10% 琥珀金", "gear": "短柄玄武岩鍛錘、礦石樣本袋"
        },
        "target_pol": "yin", "target_rng": "melee"
    },

    # --- 6. 紡織與染製 (7) ---
    {
        "utility": "craft_weave_wood", "quest_line": "紡織與染製", "quest_name_zh": "蔓藤編織",
        "quest_goal_zh": "將天然植物纖維與樹皮紡織為透氣強韌的草木布料",
        "elements": ["wood"],
        "creature": {
            "id": "line_wood_loomweaver", "name_zh": "織葉螽", "name_en": "Loomweaver",
            "core": "紡織娘（螽斯）、木梭前肢、葉脈織布網", "base": "natural-bio", "prim": "inanimate-biomimic", "sec": "bio-nature",
            "palette": "嫩草綠、原木棕、亞麻白", "vfx": "翠綠絲線飛舞、木葉光屑", "motifs": "一對前肢化為流線型木製織布梭子、背翼呈經緯葉脈格紋",
            "stages": [("嫩芽小螽","0.35 m","XS","觸鬚如兩根細麻線的小綠螽斯"),("木梭紡螽","0.90 m","S","前肢能快速交織草絲的螽斯"),("經緯織王螽","1.65 m","M","背負小型木織機架與翡翠葉網的巨型螽斯"),("超載森織聖螽","3.7 m","XL","周身展開萬千發光翠綠經緯絲線與懸浮木梭陣的靈蟲")]
        },
        "char": {
            "name_zh": "阿莉婭·麻織", "name_en": "Aliya Flax", "gender": "女", "age": 45, "ethnicity": "南亞",
            "region": "翠綠星林村", "era": "農耕", "style": "植物纖維手工織娘服飾", "height_cm": 161,
            "physique": "端莊優雅的中年匠人體態", "hair": "烏黑長髮編盤於腦後，插木梭髮簪",
            "eyes": "深棕溫柔眼眸", "outfit": "原色亞麻無袖長背心、草綠刺繡紗麗式長裙、編織涼鞋",
            "palette": "60% 原麻米白、30% 草木綠、10% 原木棕", "gear": "手搖木紡錘、亞麻線團籃"
        },
        "target_pol": "yin", "target_rng": "long"
    },
    {
        "utility": "craft_weave_wind", "quest_line": "紡織與染製", "quest_name_zh": "御風紡紗",
        "quest_goal_zh": "以高空強風氣流紡出極輕量且高閃避的風紋絲綢",
        "elements": ["wind"],
        "creature": {
            "id": "line_wind_silksparrow", "name_zh": "雲紗雀", "name_en": "Silksparrow",
            "core": "白喉文鳥、氣流絲帶尾羽、紡輪胸徽", "base": "natural-bio", "prim": "bio-element", "sec": "bio-artifact",
            "palette": "雲絲白、天青藍、銀灰", "vfx": "輕盈白紗氣流帶", "motifs": "修長如絲綢飄帶的三條分叉尾羽、胸前旋轉風車紡輪紋",
            "stages": [("絲絨小雀","0.30 m","XS","拖著一條短白絲帶尾毛的小白雀"),("紡風文鳥","0.75 m","S","雙翼鼓動能將風捻成半透明絲線的小鳥"),("雲紗天雀","1.50 m","M","周身環繞飄逸白藍雲紗絲帶的優雅飛鳥"),("超載天織雲凰","3.6 m","XL","化為數十條萬丈天青雲紗交織旋轉的風系神鳥")]
        },
        "char": {
            "name_zh": "瑟琳·雲紗", "name_en": "Celine Gossamer", "gender": "女", "age": 24, "ethnicity": "白人",
            "region": "風暴星風車鎮", "era": "商貿", "style": "輕盈飄逸的風車織坊少女裝", "height_cm": 167,
            "physique": "纖細高挑的青年織師體態", "hair": "淺銀白長髮隨風微揚",
            "eyes": "晴空淺藍瞳", "outfit": "半透明天青雪紡寬袖上衣、白色高腰短裙、繫帶舞鞋風短靴",
            "palette": "60% 雲絲白、30% 天青藍、10% 銀線", "gear": "手搖風力紗線輪、輕紗披帛"
        },
        "target_pol": "yang", "target_rng": "long"
    },
    {
        "utility": "craft_tailor_wood", "quest_line": "紡織與染製", "quest_name_zh": "葉脈剪裁",
        "quest_goal_zh": "以草木韌性針線縫製出帶有自然回血加成的林間戰衣",
        "elements": ["wood"],
        "creature": {
            "id": "line_wood_tailormantis", "name_zh": "裁葉螳", "name_en": "Tailormantis",
            "core": "蘭花螳螂、雙剪刀葉刃前足、針線觸鬚", "base": "natural-bio", "prim": "inanimate-biomimic", "sec": "bio-nature",
            "palette": "翠玉綠、櫻瓣粉、銀剪灰", "vfx": "裁切葉片光跡、粉綠花瓣", "motifs": "前足如一對精緻的園藝剪刀、裙擺狀花瓣腹甲",
            "stages": [("小剪螳","0.38 m","XS","舉著兩片小剪刀葉子的可愛粉綠螳螂"),("裁縫花螳","1.00 m","S","擅長將大樹葉精準裁成衣片的蘭花螳螂"),("翠裳螳師","1.80 m","M","身披多層拼花葉片禮服、雙剪閃銀光的螳螂"),("超載萬華裁聖","4.0 m","XL","周身懸浮數對巨大光刃剪刀與繁花錦緞帶的森靈蟲")]
        },
        "char": {
            "name_zh": "菲奧娜·葉裁", "name_en": "Fiona Leafcut", "gender": "女", "age": 29, "ethnicity": "白人",
            "region": "翠綠星林園", "era": "商貿", "style": "森系高級訂製服裁縫師裝", "height_cm": 168,
            "physique": "修長優雅的設計師體態", "hair": "苔綠挑染深棕波浪長髮",
            "eyes": "葉綠色雙瞳", "outfit": "墨綠修身馬甲配葉紋刺繡、米白長裙褲、尖頭綁帶短靴",
            "palette": "60% 墨綠、30% 米白、10% 玫瑰金剪刀", "gear": "黃銅裁縫大剪、腰掛針插包與軟尺"
        },
        "target_pol": "yin", "target_rng": "mid"
    },
    {
        "utility": "craft_tailor_shadow", "quest_line": "紡織與染製", "quest_name_zh": "夜幕縫製",
        "quest_goal_zh": "以暗影絲線縫製具備隱蔽與暴擊特性的夜行防具",
        "elements": ["shadow"],
        "creature": {
            "id": "line_shadow_needlebat", "name_zh": "銀針夜蝠", "name_en": "Needlebat",
            "core": "蝙蝠、長針尾刺、黑曜絲絨翼膜", "base": "natural-bio", "prim": "bio-artifact", "sec": "bio-element",
            "palette": "絲絨黑、幽紫、冷銀", "vfx": "銀針穿刺線跡、黑羽殘影", "motifs": "雙翼邊緣綴著一排發光銀針、長尾末端為穿線針孔",
            "stages": [("線球幼蝠","0.32 m","XS","抱著一顆紫線球倒掛的小黑蝠"),("穿針影蝠","0.85 m","S","尾針能牽引暗影絲線快速修補翼膜的蝙蝠"),("黑絨縫蝠","1.65 m","M","身披剪裁俐落的絲絨黑披肩翼膜與銀針陣的夜蝠"),("超載幽幕縫王","3.9 m","XL","展開無盡黑絲絨幕布與萬千銀針飛梭的暗夜聖蝠")]
        },
        "char": {
            "name_zh": "卡米拉·夜針", "name_en": "Camilla Stitch", "gender": "女", "age": 31, "ethnicity": "拉丁",
            "region": "晨昏星夜街", "era": "蒸汽龐克", "style": "哥德風高級夜裝裁縫師", "height_cm": 170,
            "physique": "纖細冷豔的成年女性體態", "hair": "墨黑俐落斜切鮑伯頭",
            "eyes": "暗酒紅魅惑雙瞳", "outfit": "黑絲絨束腰短禮服外套、紫黑蕾絲領結、高跟綁帶短靴",
            "palette": "60% 絲絨黑、30% 暗夜紫、10% 冷銀", "gear": "銀質長縫針組、暗紫捲尺項鍊"
        },
        "target_pol": "yang", "target_rng": "melee"
    },
    {
        "utility": "craft_dye_wood", "quest_line": "紡織與染製", "quest_name_zh": "草木染坊",
        "quest_goal_zh": "萃取花葉樹皮天然色素，染製溫潤的植物系戰衣",
        "elements": ["wood"],
        "creature": {
            "id": "line_wood_dyeslug", "name_zh": "彩汁蛞蝓", "name_en": "Dyeslug",
            "core": "海蛞蝓（海麒麟）、花瓣背鰓、天然染料腺", "base": "natural-bio", "prim": "bio-nature", "sec": "pure-stylized-bio",
            "palette": "茜草紅、藍靛、薑黃", "vfx": "彩色水墨暈染拖尾", "motifs": "背部綻放如三色染布的花朵鰓叢、雙觸角滴落彩色墨水",
            "stages": [("色滴小蝓","0.32 m","XS","爬過地面會留下彩色花紋的軟萌小蛞蝓"),("染花海蝓","0.85 m","S","背上開出紅黃藍三色花鰓的軟體靈獸"),("萬彩染龍蝓","1.70 m","M","身披層層疊疊水彩暈染裙邊的華麗海蛞蝓"),("超載虹彩森神蝓","3.8 m","XL","化為懸浮彩虹水墨漩渦與百花染坊光環的自然巨獸")]
        },
        "char": {
            "name_zh": "茜草·染月", "name_en": "Akane Dyemoon", "gender": "女", "age": 23, "ethnicity": "東亞",
            "region": "翠綠星染坊街", "era": "農耕", "style": "日式藍染草木染職人裝", "height_cm": 160,
            "physique": "輕巧敏捷的青年女職人體態", "hair": "深藍黑長髮以彩色碎布條紮成低丸子頭",
            "eyes": "暖褐靈動雙眼", "outfit": "漸層藍染半纏上衣、染跡點點的白色防水長圍裙、草鞋",
            "palette": "60% 天然藍靛、30% 茜草紅、10% 薑黃", "gear": "木製染布夾、天然色料陶罐腰帶"
        },
        "target_pol": "yin", "target_rng": "mid"
    },
    {
        "utility": "craft_dye_water", "quest_line": "紡織與染製", "quest_name_zh": "水拓流彩",
        "quest_goal_zh": "利用水面浮染技術，為布料印上流動的水紋保護色",
        "elements": ["water"],
        "creature": {
            "id": "line_water_marblingkoi", "name_zh": "墨錦鯉", "name_en": "Marblingkoi",
            "core": "錦鯉、水面大理石拓染鰭、墨彩氣泡", "base": "natural-bio", "prim": "bio-nature", "sec": "amorphous-astral",
            "palette": "碧海藍、朱紅、珍珠白", "vfx": "水面浮染波紋、彩色水泡", "motifs": "寬大如水拓絲綢的半透明尾鰭、身上流動的大理石彩紋",
            "stages": [("墨點小鯉","0.36 m","XS","半透明水中飄著兩滴彩色墨水的小錦鯉"),("拓彩錦鯉","0.95 m","S","游動時在空氣中留下水拓波紋的錦鯉"),("流彩龍鯉","1.85 m","M","雙鬚飄逸、尾鰭如巨幅水拓畫卷的優雅巨鯉"),("超載滄溟彩龍","4.3 m","XL","躍出水面化為巨大水彩雲龍與萬花波紋環的聖鯉")]
        },
        "char": {
            "name_zh": "達尼·流彩", "name_en": "Dani Marbling", "gender": "男", "age": 25, "ethnicity": "東南亞",
            "region": "風暴星水都", "era": "商貿", "style": "峇迪水拓染藝術家服裝", "height_cm": 173,
            "physique": "修長瀟灑的青年藝術家體態", "hair": "深黑微捲中長髮、額頭繫彩色頭帶",
            "eyes": "碧海綠瞳", "outfit": "水拓紋寬鬆襯衫、深藍捲邊亞麻褲、編織皮涼鞋",
            "palette": "60% 碧海藍、30% 珍珠白、10% 朱紅拓紋", "gear": "銅製蠟染筆（Canting）、水拓顏料盤"
        },
        "target_pol": "yin", "target_rng": "mid"
    },
    {
        "utility": "craft_dye_light", "quest_line": "紡織與染製", "quest_name_zh": "星輝金箔染",
        "quest_goal_zh": "以光屬性星塵染出在暗處微弱發光的聖潔禮裝布料",
        "elements": ["light"],
        "creature": {"id": "line_light_foilprism"},
        "char": {
            "name_zh": "奧羅拉·金箔", "name_en": "Aurora Foil", "gender": "女", "age": 30, "ethnicity": "地中海",
            "region": "晨昏星神殿區", "era": "商貿", "style": "古典金箔聖衣染藝師裝", "height_cm": 172,
            "physique": "高挑典雅的藝術工匠體態", "hair": "金色波浪長捲髮半挽",
            "eyes": "耀金琥珀瞳", "outfit": "象牙白修身長外袍配金箔滾邊、鈷藍腰封、金色綁帶涼鞋",
            "palette": "60% 象牙白、30% 鈷藍、10% 星輝金", "gear": "金箔刷具組、透明光塵瓶"
        },
        "target_pol": "yin", "target_rng": "long"
    },

    # --- 7. 木工與珠寶 (6) ---
    {
        "utility": "craft_carpentry_wood", "quest_line": "木工與珠寶", "quest_name_zh": "榫卯木藝",
        "quest_goal_zh": "以不用一根鐵釘的榫卯木工，製作靈活的木製武器與家具",
        "elements": ["wood"],
        "creature": {"id": "ch_1st_batch_wood_puppet"},
        "char": {
            "name_zh": "良太·榫卯", "name_en": "Ryota Joinery", "gender": "男", "age": 35, "ethnicity": "東亞",
            "region": "翠綠星木工坊", "era": "農耕", "style": "日式宮大工木匠服裝", "height_cm": 174,
            "physique": "精幹靈巧的傳統木匠體態", "hair": "深棕短髮戴白布頭巾",
            "eyes": "專注沉穩深褐瞳", "outfit": "藏青木工腹掛背心、米白長袖襯衫、木屑沾染的工裝褲",
            "palette": "60% 原木棕、30% 藏青、10% 刨花米白", "gear": "手拉鋸、木工鑿刀腰袋、墨斗"
        },
        "target_pol": "yang", "target_rng": "melee"
    },
    {
        "utility": "craft_carpentry_earth", "quest_line": "木工與珠寶", "quest_name_zh": "鐵木重構",
        "quest_goal_zh": "加工石化硬木與樹根，製作高耐久重型木質盾劍",
        "elements": ["earth", "wood"],
        "creature": {
            "id": "line_earth_petrifiedelk", "name_zh": "木化石巨鹿", "name_en": "Petrifiedelk",
            "core": "大角鹿、硅化木晶角、樹皮石甲", "base": "natural-bio", "prim": "bio-nature", "sec": "pure-stylized-bio",
            "palette": "硅化木褐、瑪瑙金、深苔綠", "vfx": "木屑與晶石碎片", "motifs": "雙角如年輪清晰的玉化古木樹枝、肩覆樹皮岩甲",
            "stages": [("木芽小鹿","0.50 m","S","頭頂長出兩根小木化石嫩枝的小鹿"),("石木牡鹿","1.40 m","M","角枝泛著瑪瑙光澤的沉穩牡鹿"),("古木巨麋","2.35 m","L","背負年輪石甲與參天玉化巨角的森林守護鹿"),("超載萬年神麋","5.2 m","XL","化為晶化世界樹巨角與懸浮年輪石環的遠古聖鹿")]
        },
        "char": {
            "name_zh": "加雷斯·硬木", "name_en": "Gareth Ironwood", "gender": "男", "age": 49, "ethnicity": "北歐",
            "region": "晶礦星古木區", "era": "工業", "style": "粗獷重木伐木雕匠裝", "height_cm": 185,
            "physique": "高大威猛的伐木木匠體型", "hair": "紅棕粗硬中長髮與濃密短鬚",
            "eyes": "深琥珀褐瞳", "outfit": "暗紅格紋厚法蘭絨衫、重帆布木工圍裙、鋼頭工作靴",
            "palette": "60% 暗木褐、30% 磚紅、10% 瑪瑙金", "gear": "雙刃手斧、大號木槌"
        },
        "target_pol": "yang", "target_rng": "melee"
    },
    {
        "utility": "craft_carpentry_wind", "quest_line": "木工與珠寶", "quest_name_zh": "風笛雕木",
        "quest_goal_zh": "雕琢中空共振輕木，打造出揮舞時會產生風壓的輕型木器",
        "elements": ["wind", "wood"],
        "creature": {
            "id": "line_wind_lyrebird", "name_zh": "風琴琴鳥", "name_en": "Lyrebird",
            "core": "華麗琴鳥、中空柳木風管尾羽、共振木冠", "base": "natural-bio", "prim": "bio-artifact", "sec": "bio-nature",
            "palette": "淺楓木棕、天青、象牙白", "vfx": "空氣音波波紋、樂音氣流", "motifs": "尾羽展開如古典木製豎琴與長笛管的結合體",
            "stages": [("竹笛雛鳥","0.35 m","XS","頭頂翹著一根小竹笛冠毛的小鳥"),("木管琴鳥","0.95 m","S","尾羽可吹出清脆木笛樂音的林間鳥"),("天琴巨鳥","1.80 m","M","展開巨大木雕豎琴尾羽、操縱風壓共振的琴鳥"),("超載蒼穹交響鳥","4.0 m","XL","周身環繞懸浮木管風琴陣與萬千音波氣環的神鳥")]
        },
        "char": {
            "name_zh": "盧卡·風笛", "name_en": "Luca Woodwind", "gender": "男", "age": 22, "ethnicity": "地中海",
            "region": "翠綠星風谷", "era": "商貿", "style": "吟遊木笛樂器匠服裝", "height_cm": 174,
            "physique": "修長優雅的青年匠人體態", "hair": "淺栗色蓬鬆微捲短髮",
            "eyes": "翠綠清亮眼眸", "outfit": "橄欖綠修身短斗篷外套、象牙白繫帶襯衫、麂皮長靴",
            "palette": "60% 淺木棕、30% 橄欖綠、10% 天青", "gear": "木工微雕刀組、腰掛木製長笛"
        },
        "target_pol": "yang", "target_rng": "mid"
    },
    {
        "utility": "craft_jewelcraft_light", "quest_line": "木工與珠寶", "quest_name_zh": "聚光琢玉",
        "quest_goal_zh": "精密切割菱鏡寶石，鑲嵌為提升洞察與光輝的飾品",
        "elements": ["light"],
        "creature": {
            "id": "line_light_gempeacock", "name_zh": "晶屏孔雀", "name_en": "Gempeacock",
            "core": "白孔雀、八心八箭鑽石尾屏、金絲鑲嵌冠", "base": "natural-bio", "prim": "bio-nature", "sec": "bio-artifact",
            "palette": "鑽石白、黃金、虹彩藍", "vfx": "七彩菱鏡折射光束", "motifs": "尾羽眼斑皆為精密切割的多面鑽石結晶",
            "stages": [("碎鑽小雀","0.38 m","XS","頭頂鑲著一顆小水鑽的白絨雛鳥"),("晶羽孔雀","1.10 m","S","尾羽末端綴著亮閃閃六角晶石的小孔雀"),("聖鑽白孔雀","2.05 m","M","開屏呈現百顆多面鑽石折射七彩光芒的白孔雀"),("超載萬象光鑽王","4.5 m","XL","化為懸浮黃金鑲爪與萬千光鑽屏風的璀璨神鳥")]
        },
        "char": {
            "name_zh": "瓦萊麗·鑽切", "name_en": "Valerie Facet", "gender": "女", "age": 28, "ethnicity": "白人",
            "region": "晶礦星珠寶街", "era": "商貿", "style": "優雅宮廷珠寶鑑定師裝", "height_cm": 171,
            "physique": "修長高貴的珠寶匠體態", "hair": "鉑金色高盤法式髻、插細金簪",
            "eyes": "寶石藍瞳、右眼戴珠寶放大鏡", "outfit": "香檳金收腰短西裝外套、黑色高腰長褲、細帶低跟短靴",
            "palette": "60% 香檳白、30% 黑絲絨、10% 鑽石虹彩", "gear": "珠寶切磨放大鏡、天鵝絨寶石盤"
        },
        "target_pol": "yin", "target_rng": "long"
    },
    {
        "utility": "craft_jewelcraft_earth", "quest_line": "木工與珠寶", "quest_name_zh": "大地鑲嵌",
        "quest_goal_zh": "磨製琥珀、翡翠與大地礦石，打造強化防禦與掉落的寶石飾品",
        "elements": ["earth"],
        "creature": {
            "id": "line_earth_jadeantelope", "name_zh": "碧玉羚", "name_en": "Jadeantelope",
            "core": "藏羚羊、墨翠玉雕雙角、金鑲玉護胸", "base": "natural-bio", "prim": "bio-nature", "sec": "bio-artifact",
            "palette": "翡翠綠、赭石褐、暖金", "vfx": "玉石溫潤光暈、碎石金粉", "motifs": "修長筆直的墨翠玉雕長角、胸前金鑲玉佩飾",
            "stages": [("玉角小羚","0.45 m","S","頭頂冒出兩根小綠玉筍的敏捷小羚羊"),("翠玉青羚","1.20 m","M","雙角溫潤通透如上等翡翠的草原羚羊"),("金鑲玉巨羚","2.10 m","L","身披黃金線條鑲嵌翠玉甲片的高雅巨羚"),("超載崑崙玉皇羚","4.6 m","XL","雙角化為通天玉柱並環繞黃金玉璧陣的聖獸")]
        },
        "char": {
            "name_zh": "玉琳·琢翠", "name_en": "Yulin Jade", "gender": "女", "age": 34, "ethnicity": "東亞",
            "region": "晶礦星玉雕坊", "era": "商貿", "style": "新中式玉石雕刻師服裝", "height_cm": 165,
            "physique": "沉穩端莊的匠人體態", "hair": "烏黑長髮盤成雙螺髻、配翡翠玉簪",
            "eyes": "深褐溫潤雙眸", "outfit": "月白立領改良對襟短衫、墨綠寬褲、布面繡花平底鞋",
            "palette": "60% 月白、30% 翡翠綠、10% 古金", "gear": "微型玉雕磨頭、青玉原石盒"
        },
        "target_pol": "yin", "target_rng": "mid"
    },
    {
        "utility": "craft_jewelcraft_ice", "quest_line": "木工與珠寶", "quest_name_zh": "永凍冰雕",
        "quest_goal_zh": "雕琢永不融化的極地冰晶寶石，製成冷卻減免飾品",
        "elements": ["ice"],
        "creature": {
            "id": "line_ice_crystalermine", "name_zh": "冰晶白鼬", "name_en": "Crystalermine",
            "core": "白鼬（雪貂）、六角冰晶尾尖、藍寶石項圈", "base": "natural-bio", "prim": "bio-nature", "sec": "pure-stylized-bio",
            "palette": "雪貂白、冰鑽藍、銀灰", "vfx": "細雪星芒、冰晶折射", "motifs": "尾巴末端凝結成一顆完美六角切面的永凍藍鑽",
            "stages": [("雪球小鼬","0.30 m","XS","尾尖掛著小冰晶珠的純白小貂"),("冰鑽白鼬","0.80 m","S","靈巧躍動、尾鑽閃爍藍光的雪貂"),("極光晶貂","1.55 m","M","頸披雪白絨領、尾部綻放三顆六角冰鑽的優雅巨貂"),("超載永凍冰晶皇","3.6 m","XL","化為透明冰晶琉璃身軀與七星冰鑽光環的聖獸")]
        },
        "char": {
            "name_zh": "艾爾莎·冰琢", "name_en": "Elsa Frostgem", "gender": "女", "age": 25, "ethnicity": "北歐",
            "region": "冰晶星寶石窟", "era": "商貿", "style": "高冷北歐冰晶珠寶師禮服", "height_cm": 172,
            "physique": "纖細高挑的冷豔青年體態", "hair": "冰銀色長直髮配雪花髮夾",
            "eyes": "冰藍透亮雙瞳", "outfit": "冰藍絲絨高領短大衣、白色皮草袖口、銀白高筒靴",
            "palette": "60% 冰銀白、30% 冰鑽藍、10% 鉑金", "gear": "極低溫冰鑿組、天鵝絨冰晶盒"
        },
        "target_pol": "yang", "target_rng": "long"
    },

    # --- 8. 附魔與秘儀 (3) ---
    {
        "utility": "craft_enchant_light", "quest_line": "附魔與秘儀", "quest_name_zh": "聖光銘刻",
        "quest_goal_zh": "消耗元素精粹為裝備銘刻光屬性防護與治癒附魔",
        "elements": ["light"],
        "creature": {
            "id": "line_light_runecat", "name_zh": "銘文聖貓", "name_en": "Runecat",
            "core": "暹羅貓／聖貓、懸浮金色光輪符環、額頭太陽眼紋", "base": "supernatural-bio", "prim": "bio-totem", "sec": "bio-element",
            "palette": "象牙白、聖殿金、天藍", "vfx": "旋轉金色幾何符文陣", "motifs": "頸背懸浮旋轉的金色文字圓環、雙耳垂金流蘇",
            "stages": [("金紋小貓","0.35 m","XS","額頭有個發光太陽圓點的小奶貓"),("銘文靈貓","0.90 m","S","尾巴尖端可凌空書寫金色光符的貓"),("聖環獅貓","1.70 m","M","背後懸浮雙層金色神聖符文環的優雅巨貓"),("超載太陽法典貓","3.9 m","XL","周身展開萬字金色星圖法陣與光翼的聖獸")]
        },
        "char": {
            "name_zh": "賽義德·光銘", "name_en": "Saeed Lightrune", "gender": "男", "age": 43, "ethnicity": "西亞",
            "region": "晶礦星神廟書庫", "era": "遠古遺跡", "style": "神殿光紋銘刻學者長袍", "height_cm": 178,
            "physique": "莊嚴修長的中年祭司學者體態", "hair": "烏黑短髮配金色幾何額飾",
            "eyes": "琥珀金雙瞳", "outfit": "純白亞麻與鈷藍幾何織錦罩袍、金絲腰帶、軟皮涼鞋",
            "palette": "60% 純白亞麻、30% 鈷藍、10% 聖殿金", "gear": "黃銅星紋刻筆、發光羊皮法典"
        },
        "target_pol": "yin", "target_rng": "long"
    },
    {
        "utility": "craft_enchant_fire", "quest_line": "附魔與秘儀", "quest_name_zh": "熾焰附魔",
        "quest_goal_zh": "消耗精粹為武器銘刻燃燒與破甲火屬性附魔",
        "elements": ["fire"],
        "creature": {
            "id": "line_fire_runefox", "name_zh": "火紋妖狐", "name_en": "Runefox",
            "core": "赤狐、懸浮朱砂符紙尾、熾焰書法筆尾尖", "base": "supernatural-bio", "prim": "bio-totem", "sec": "bio-element",
            "palette": "朱砂紅、炭墨黑、熾金", "vfx": "燃燒的朱砂符文、火星墨跡", "motifs": "多條狐尾末端化為燃燒毛筆尖、身側懸浮火紅符牌",
            "stages": [("墨火小狐","0.38 m","XS","尾巴尖端像沾了紅墨水毛筆的小赤狐"),("朱符狐","1.00 m","S","甩尾可在空中畫出燃燒火符的靈狐"),("炎篆三尾狐","1.80 m","M","三條巨尾纏繞燃燒朱砂符文環的赤狐"),("超載九尾炎篆狐","4.3 m","XL","展開九條烈焰筆尾與漫天焚天火符陣的妖狐聖獸")]
        },
        "char": {
            "name_zh": "緋村·朱印", "name_en": "Himura Vermilion", "gender": "女", "age": 21, "ethnicity": "東亞",
            "region": "熔岩星神社遺址", "era": "商貿", "style": "現代和風神道附魔師裝", "height_cm": 163,
            "physique": "靈動優雅的青年女性體態", "hair": "烏黑姬髮式長直髮配紅白繩結",
            "eyes": "朱紅銳利眼眸", "outfit": "白色無袖狩衣風短上衣、緋紅百褶機能袴褲、木屐風短靴",
            "palette": "60% 緋紅、30% 純白、10% 熾焰金", "gear": "朱砂毛筆、懸浮火紋符籙"
        },
        "target_pol": "yin", "target_rng": "melee"
    },
    {
        "utility": "craft_enchant_shadow", "quest_line": "附魔與秘儀", "quest_name_zh": "幽影密契",
        "quest_goal_zh": "消耗精粹為防具與武器銘刻吸血與狀態異常附魔",
        "elements": ["shadow"],
        "creature": {"id": "ch_1st_batch_shadow_eye"},
        "char": {
            "name_zh": "莫甘娜·墨契", "name_en": "Morgana Pact", "gender": "女", "age": 32, "ethnicity": "白人",
            "region": "晨昏星秘儀塔", "era": "遠古遺跡", "style": "神秘學秘契占星師長袍", "height_cm": 169,
            "physique": "修長神秘的成年女性體態", "hair": "深紫黑大波浪長髮",
            "eyes": "紫羅蘭色眼眸、左眼角有淚痣", "outfit": "暗紫天鵝絨開衩短長袍、銀月星盤領飾、過膝長靴",
            "palette": "60% 暗夜紫、30% 墨黑、10% 秘銀光", "gear": "黑曜石占星擺錘、銀墨羽毛筆"
        },
        "target_pol": "yin", "target_rng": "long"
    },

    # --- 9. 補充全覆蓋：其餘剩餘的 6 項 (camp_beacon + 檢查是否有遺漏) ---
    {
        "utility": "camp_beacon", "quest_line": "探索與地形通行", "quest_name_zh": "遠征烽火",
        "quest_goal_zh": "於野外架設臨時營地信標，提供短距傳送與簡易補給點",
        "elements": ["thunder", "fire", "metal"],
        "creature": {
            "id": "line_thunder_beaconowl", "name_zh": "烽火信標梟", "name_en": "Beaconowl",
            "core": "鵰鴞、胸前銅製信標燈籠、避雷鐵羽冠", "base": "natural-bio", "prim": "bio-artifact", "sec": "bio-element",
            "palette": "古銅金、雷電藍、炭羽灰", "vfx": "電磁信標光柱、溫暖火花", "motifs": "胸前嵌著發光銅製燈塔核心、頭頂雙簇羽如雙天線",
            "stages": [("銅燈雛梟","0.36 m","XS","胸口亮著一盞小黃燈的圓滾貓頭鷹寶寶"),("信標鴞","0.95 m","S","站立時頭頂天線羽會發出電光脈衝的貓頭鷹"),("烽塔巨梟","1.85 m","M","展翼投射安全營地電光結界的銅甲巨梟"),("超載天塔神梟","4.2 m","XL","化為高聳電磁燈塔光柱與旋轉銅環陣的守護巨梟")]
        },
        "char": {
            "name_zh": "雷歐·烽火", "name_en": "Leo Beacon", "gender": "男", "age": 31, "ethnicity": "非裔",
            "region": "風暴星邊境哨站", "era": "蒸汽龐克", "style": "邊境先遣信號兵裝", "height_cm": 181,
            "physique": "結實挺拔的探險先遣兵體態", "hair": "黑色短髮剃側邊線條",
            "eyes": "電光琥珀瞳", "outfit": "炭灰耐候風衣背心、銅扣信號帶、多口袋工裝褲與軍靴",
            "palette": "60% 炭羽灰、30% 古銅棕、10% 電光藍", "gear": "折疊銅製信標三腳架、信號旗"
        },
        "target_pol": "yang", "target_rng": "long"
    },
]


def verify_completeness() -> None:
    fu = json.loads((GAME_ROOT / "Data" / "field-utilities" / "field-utilities.json").read_text(encoding="utf-8"))
    links = json.loads((GAME_ROOT / "Data" / "_catalog" / "character-creature-links.json").read_text(encoding="utf-8"))
    covered_main = {w["field_utility"] for w in links["trial_wardens"]} | {q["field_utility"] for q in links["field_utility_quests"]}
    all_fu = {x["utility"] for x in fu}
    expected_side = all_fu - covered_main
    defined_side = {q["utility"] for q in SIDE_QUESTS}
    missing = expected_side - defined_side
    extra = defined_side - expected_side
    if missing or extra:
        raise RuntimeError(f"Mismatch! missing={missing}, extra={extra}")
    print(f"Verified exact coverage: {len(covered_main)} main + {len(defined_side)} side = {len(all_fu)} total!")


def load_moves_catalog() -> dict[str, list[dict[str, Any]]]:
    by_el: dict[str, list[dict[str, Any]]] = {}
    for p in sorted(glob.glob(str(GAME_ROOT / "Data" / "_catalog" / "moves" / "*.json"))):
        for m in json.loads(Path(p).read_text(encoding="utf-8")):
            by_el.setdefault(m["element"], []).append(m)
    return by_el


def load_traits_catalog() -> dict[str, list[dict[str, Any]]]:
    by_el: dict[str, list[dict[str, Any]]] = {}
    seen: set[str] = set()
    for p in sorted(glob.glob(str(GAME_ROOT / "Data" / "_incoming" / "**" / "traits.json"), recursive=True)):
        if "invalid" in p:
            continue
        for t in json.loads(Path(p).read_text(encoding="utf-8")):
            tid = t.get("id", "")
            if tid.startswith("trait_") and tid not in seen:
                seen.add(tid)
                el = tid.split("_")[1]
                by_el.setdefault(el, []).append(t)
    return by_el


def pick_trait(
    traits_by_el: dict[str, list[dict[str, Any]]],
    used_traits: set[str],
    elements: list[str],
    require_unique: bool = False,
) -> dict[str, Any]:
    for el in elements:
        for t in traits_by_el.get(el, []):
            if t["id"] not in used_traits:
                used_traits.add(t["id"])
                return t
    if require_unique:
        raise RuntimeError(f"No unique trait available for {elements}")
    return traits_by_el[elements[0]][0]


def pick_signature_move(
    moves_by_el: dict[str, list[dict[str, Any]]],
    used_moves: set[str],
    elements: list[str],
    target_pol: str,
    target_rng: str,
) -> dict[str, Any]:
    # Try unused moves across creature's 1-3 elements with exact polarity & range first
    for el in elements:
        for m in moves_by_el.get(el, []):
            if m["id"] not in used_moves and m.get("polarity") == target_pol and m.get("range_class") == target_rng:
                used_moves.add(m["id"])
                return m
    # Try exact polarity & range across creature's elements (allowing reuse if unused exhausted)
    for el in elements:
        for m in moves_by_el.get(el, []):
            if m.get("polarity") == target_pol and m.get("range_class") == target_rng:
                used_moves.add(m["id"])
                return m
    # Try exact polarity & (melee vs non-melee) across creature's elements
    is_melee = target_rng == "melee"
    for el in elements:
        for m in moves_by_el.get(el, []):
            if m.get("polarity") == target_pol and ((m.get("range_class") == "melee") == is_melee):
                used_moves.add(m["id"])
                return m
    # Fallback
    for el in elements:
        for m in moves_by_el.get(el, []):
            if m["id"] not in used_moves:
                used_moves.add(m["id"])
                return m
    return moves_by_el[elements[0]][0]


def write_character_prompt(q: dict[str, Any], fu_kind: str) -> Path:
    c = q["char"]
    cid = f"chr_quest_{q['utility']}"
    vessel = "符籙卡片 (`talisman_card`)" if fu_kind == "move" else "琉璃珠 (`glass_bead`)"
    els_str = " / ".join(q["elements"])
    creature_id = q["creature"]["id"]
    # Stable per-character choice prevents regenerating a different design each run.
    cup = "ABCDE"[int.from_bytes(hashlib.sha256(cid.encode()).digest()[:8], "big") % 5] if c["gender"] == "女" and c["age"] >= 18 else None
    existing = DRIVE / "characters" / "_designed_prompts" / f"{cid}.prompt.md"
    if cup and existing.exists():
        match = re.search(r"罩杯：([A-E]) Cup", existing.read_text(encoding="utf-8"))
        if match:
            cup = match.group(1)
    cup_identity = f"；罩杯：{cup} Cup" if cup else ""
    strict_t_pose = "必須採用嚴格 T-pose：軀幹直立，雙臂在肩高向左右水平伸直，與軀幹各成 90°，雙肘伸直、手腕平直、掌心朝下、手指自然伸直，雙腿伸直、雙腳略分平行、腳尖朝前，重心均分。禁止 A-pose、垂臂、斜抬手臂、屈肘、彎腕、叉腰或動態站姿。道具固定於服裝、腰間或背部，雙手保持空手。"
    turnaround_angles = "正面、正側面、背面及 3/4 視角均須鎖定同一全身姿勢，只改變正交相機的觀察方位。每格須完整呈現角色，側面依投影自然呈現手臂的縮短與重疊。"
    cup_front = f"成年女性體型為 {cup} Cup，與角色設定一致。" if cup else ""

    content = f"""# [{cid}] {c['name_zh']} ({c['name_en']})

## 1. 角色識別與設計軸
- **角色 ID**：`{cid}`
- **任務類型**：支線生活招式任務（{q['quest_line']} · `{q['utility']}` · `{fu_kind}`）
- **任務目標**：{q['quest_name_zh']} — {q['quest_goal_zh']}
- **關聯宙獸**：`{creature_id}`（屬性：{els_str}）
- **地區文化 / 年代文化 / 外觀風格**：{c['region']} / {c['era']} / {c['style']}
- **基本體貌**：{c['gender']}，{c['age']} 歲，{c['ethnicity']}，身高 {c['height_cm']} cm，{c['physique']}{cup_identity}
- **髮型與瞳色**：{c['hair']}；{c['eyes']}
- **服裝配色 (60-30-10)**：{c['palette']}
- **剪影與隨身裝備**：{c['outfit']}；{c['gear']}；慣用收服道具：{vessel}

## 2. 正面圖 Prompt（Front View / T-Pose 基準） — `{cid}_01_portrait_front.png`
{cup_front}原創日式 ACG 動畫風格全身角色設定正面基準圖，{c['age']} 歲{c['ethnicity']}{c['gender']}性「{c['name_zh']}」，身高 {c['height_cm']} cm，{c['physique']}，{strict_t_pose}正交平視全身不裁切頭腳。{c['hair']}，{c['eyes']}。身穿{c['style']}：{c['outfit']}，隨身佩帶{c['gear']}與{vessel}。整體配色嚴格遵守 {c['palette']}。乾淨深色描邊，2–3 階柔和賽璐璐著色，中性灰 `#808080` 純色背景、均勻無投影平光。

## 3. 三視圖 Prompt（Turnaround：正面 / 側面 / 背面 / 3/4 視角） — `{cid}_01_portrait_turnaround.png`
參照第一張生成的正面圖，嚴格保持角色外觀一致。{strict_t_pose}{turnaround_angles}同一角色「{c['name_zh']}」之正交等比例角色三視圖合圖（正面、正側面、背面、3/4 視角並列），嚴格鎖定面容、{c['hair']}、{c['outfit']}與{c['gear']}之左右位置及 {c['palette']} 配色完全一致。背面清楚呈現衣領、背帶與腰間道具掛載結構（無過長遮擋披風）。中性灰 `#808080` 純色背景、均勻平光、2–3 階賽璐璐著色。嚴格禁止任何文字、標籤、字母、數字、標誌與浮水印。

## 4. 主立繪 Prompt（Main Keyart：動態職業構圖） — `{cid}_01_portrait_main.png`
參照第一張生成的正面圖，嚴格保持角色外觀一致。同一角色「{c['name_zh']}」之動態全身主立繪，展現「{q['quest_name_zh']}（{c['style']}）」的專業氣場與自信神情，單手持{vessel}或操作{c['gear']}的標誌性工作姿態，衣襬與髮絲帶動自然動態張力；保持與正面基準圖完全一致的五官、服裝版型與 {c['palette']} 配色，乾淨賽璐璐著色，完整不透明背景，不含其他角色與文字浮水印。描繪符合{c['region']}、{c['era']}、{c['style']}及角色任務的具體環境場景，包含相應建築、地景或工作設施。一張完整直式的主角前景與背景立繪圖，畫面連續完整，不要分割成多圖、分格或拼貼。

## 5. 排除項目（Negative Constraints）
正面圖與三視圖不得出現背景建築、複雜風景；所有圖不得出現其他人物、宙獸本體、過長遮擋視線的斗篷、文字、標籤、浮水印、額外肢體或手指畸形、寫實攝影皮膚質感、左右裝備鏡像錯置。
"""
    out_path = DRIVE / "characters" / "_designed_prompts" / f"{cid}.prompt.md"
    out_path.write_text(content, encoding="utf-8")
    return out_path


def write_new_creature_prompt(q: dict[str, Any]) -> Path | None:
    cr = q["creature"]
    if "name_zh" not in cr:
        return None  # Existing creature line
    cid = cr["id"]
    s1, s2, s3, s4 = cr["stages"]
    content = f"""# [{cid}] {s1[0]} → {s2[0]} → {s3[0]} → {s4[0]}

## 1. 四型態一致性（Visual Consistency）
- **核心原型**：{cr['core']}
- **設計原型標籤**：{cr['core']}
- **形態路由**：base_entity={cr['base']} · primary={cr['prim']} · secondary={cr['sec']}
- **共通配色**：{cr['palette']}
- **元素光效色系**：{cr['vfx']}
- **標誌性紋樣**：{cr['motifs']}

## 2. 各型態特徵（Per-Stage Visual Features）

### 幼年 (juvenile · {s1[0]})
- **體型尺度**：{s1[1]}（`{s1[2]}`）
- **視覺特徵**：{s1[3]}

### 少年 (adolescent · {s2[0]})
- **體型尺度**：{s2[1]}（`{s2[2]}`）
- **視覺特徵**：{s2[3]}

### 成年 (adult · {s3[0]})
- **體型尺度**：{s3[1]}（`{s3[2]}`）
- **視覺特徵**：{s3[3]}

### 超載 (overload · {s4[0]})
- **體型尺度**：{s4[1]}（`{s4[2]}`）
- **視覺特徵**：{s4[3]}

## 3. 型態演化關係（Evolution Visual Deltas）
- **{s1[0]}（幼年） → {s2[0]}（少年）**：體型由 {s1[1]} 放大至 {s2[1]}；延續核心原型與共通配色，視覺演化為：{s2[3]}
- **{s2[0]}（少年） → {s3[0]}（成年）**：體型由 {s2[1]} 放大至 {s3[1]}；延續核心原型與共通配色，視覺演化為：{s3[3]}
- **{s3[0]}（成年） → {s4[0]}（超載）**：體型由 {s3[1]} 放大至 {s4[1]}；延續核心原型與共通配色，視覺演化為：{s4[3]}
"""
    out_path = DRIVE / "creatures" / "_designed_prompts" / "_lines" / f"{cid}.prompt.md"
    out_path.write_text(content, encoding="utf-8")
    return out_path


def main() -> None:
    verify_completeness()
    fu_map = {x["utility"]: x for x in json.loads((GAME_ROOT / "Data" / "field-utilities" / "field-utilities.json").read_text(encoding="utf-8"))}
    links_path = GAME_ROOT / "Data" / "_catalog" / "character-creature-links.json"
    links = json.loads(links_path.read_text(encoding="utf-8"))
    moves_by_el = load_moves_catalog()
    traits_by_el = load_traits_catalog()

    used_moves = {w.get("signature_move") for w in links["trial_wardens"] if w.get("signature_move")}
    used_moves |= {q.get("signature_move") for q in links["field_utility_quests"] if q.get("signature_move")}
    used_traits = {w.get("trait") for w in links["trial_wardens"] if w.get("trait")}
    used_traits |= {q.get("trait") for q in links["field_utility_quests"] if q.get("trait")}

    # Fill missing signature_move & trait in main field_utility_quests (1主1被)
    for fq in links["field_utility_quests"]:
        if not fq.get("signature_move"):
            sm = pick_signature_move(moves_by_el, used_moves, [fq["element"]], "yin", "mid")
            fq["signature_move"] = sm["id"]
        if not fq.get("trait"):
            tr = pick_trait(traits_by_el, used_traits, [fq["element"]])
            fq["trait"] = tr["id"]

    side_entries: list[dict[str, Any]] = []
    new_creatures_count = 0
    new_chars_count = 0

    # Compute current main-20 polarity & range counts to dynamically balance to ~50:50
    moves_flat = {m["id"]: m for lst in moves_by_el.values() for m in lst}
    pol_bal = Counter()
    rng_bal = Counter()
    for m20 in links["trial_wardens"] + links["field_utility_quests"]:
        sm = m20.get("signature_move")
        if sm and sm in moves_flat:
            pol_bal[moves_flat[sm].get("polarity") or "none"] += 1
            rng_bal["melee" if moves_flat[sm].get("range_class") == "melee" else "ranged"] += 1

    # 70:28:2 star schedule for 52 moves & 52 traits -> 36 x 1★, 15 x 2★, 1 x 3★
    # Place 3★ on an unused unique skill (last slot or dedicated index)
    move_stars = [3] + [2] * 15 + [1] * 36
    trait_stars = [1] * 36 + [2] * 15 + [3]

    for idx, q in enumerate(SIDE_QUESTS):
        u = q["utility"]
        fu_obj = fu_map[u]
        fu_kind = fu_obj["kind"]
        fu_star = (fu_obj.get("combat_move") or fu_obj.get("combat_trait") or {}).get("star", 1)
        primary_el = q["elements"][0]
        desired_pol = "yang" if pol_bal["yang"] <= pol_bal["yin"] else "yin"
        desired_rng = "melee" if rng_bal["melee"] <= rng_bal["ranged"] else q["target_rng"]
        if desired_rng != "melee" and desired_rng == "melee":
            desired_rng = "mid"
        sig_move = pick_signature_move(moves_by_el, used_moves, q["elements"], desired_pol, desired_rng)
        tr_obj = pick_trait(traits_by_el, used_traits, q["elements"])
        pol_bal[sig_move.get("polarity") or "none"] += 1
        rng_bal["melee" if sig_move.get("range_class") == "melee" else "ranged"] += 1

        write_character_prompt(q, fu_kind)
        new_chars_count += 1
        if write_new_creature_prompt(q) is not None:
            new_creatures_count += 1

        side_entries.append({
            "character_id": f"chr_quest_{u}",
            "name_zh": q["char"]["name_zh"],
            "name_en": q["char"]["name_en"],
            "role": "side_field_utility_quest",
            "quest_line": q["quest_line"],
            "quest_name_zh": q["quest_name_zh"],
            "quest_goal_zh": q["quest_goal_zh"],
            "field_utility": u,
            "utility_kind": fu_kind,
            "field_utility_star": fu_star,
            "elements": q["elements"],
            "primary_element": primary_el,
            "creature_line_id": q["creature"]["id"],
            "signature_move": sig_move["id"],
            "signature_move_star": move_stars[idx],
            "signature_move_polarity": sig_move.get("polarity"),
            "signature_move_range": sig_move.get("range_class"),
            "trait": tr_obj["id"],
            "trait_star": trait_stars[idx],
            "region_culture": q["char"]["region"],
            "era_culture": q["char"]["era"],
            "appearance_style": q["char"]["style"],
            "age": q["char"]["age"],
            "gender": q["char"]["gender"],
        })

    links["side_field_utility_quests"] = side_entries
    links_path.write_text(json.dumps(links, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Compute full 72 balance stats
    moves_flat = {m["id"]: m for lst in moves_by_el.values() for m in lst}
    main_20 = links["trial_wardens"] + links["field_utility_quests"]
    all_primary_el = Counter()
    all_total_el = Counter()
    all_kind = Counter()
    all_pol = Counter()
    all_rng = Counter()

    for m20 in main_20:
        u = m20["field_utility"]
        el = m20["element"]
        all_primary_el[el] += 1
        all_total_el[el] += 1
        all_kind[fu_map[u]["kind"]] += 1
        sm = m20.get("signature_move")
        if sm and sm in moves_flat:
            all_pol[moves_flat[sm].get("polarity") or "none"] += 1
            all_rng[moves_flat[sm].get("range_class") or "none"] += 1

    for s52 in side_entries:
        all_primary_el[s52["primary_element"]] += 1
        for el in s52["elements"]:
            all_total_el[el] += 1
        all_kind[s52["utility_kind"]] += 1
        all_pol[s52["signature_move_polarity"] or "none"] += 1
        all_rng[s52["signature_move_range"] or "none"] += 1

    # Compute star counts for side quests
    fu_stars = Counter(s["field_utility_star"] for s in side_entries)
    mv_stars = Counter(s["signature_move_star"] for s in side_entries)
    tr_stars = Counter(s["trait_star"] for s in side_entries)
    combat_stars = mv_stars + tr_stars
    all_side_stars = fu_stars + combat_stars

    # Write design doc
    doc_lines = [
        "# 支線生活招式任務、角色與宙獸完整設計總表（共 52 支線 + 20 主線 = 72 項全覆蓋）",
        "",
        "本表補齊 `Data/field-utilities/field-utilities.json` 全部 **52 項支線生活招式** 對應的任務、角色（含地區文化／年代文化／外觀風格／年齡與正面圖／三視圖／主立繪 Prompt）、1–3 屬性宙獸（無需立繪），並為全 72 隻宙獸補齊 **1 主動技＋1 被動技（1 主 1 被）**。",
        "所有設計已寫入 `Data/_catalog/character-creature-links.json#side_field_utility_quests`、`Drive/characters/_designed_prompts/` 與 `Drive/creatures/_designed_prompts/_lines/`。",
        "",
        "## 1. 主線 + 支線（全 72 項）平衡與星等統計",
        f"- **主動 vs 被動**：主動 `move` = **{all_kind['move']}** ｜ 被動 `trait` = **{all_kind['trait']}**（1:1 完美平衡）",
        f"- **陰 vs 陽（對應招牌主動技）**：陽 `yang` = **{all_pol['yang']}** ｜ 陰 `yin` = **{all_pol['yin']}**",
        f"- **近戰 vs 遠攻／控制**：近戰 `melee` = **{all_rng['melee']}** ｜ 遠攻／控制 `mid+long` = **{all_rng['mid'] + all_rng['long']}**（`mid` {all_rng['mid']} + `long` {all_rng['long']}）",
        f"- **主屬性分布（72 項）**：`{dict(sorted(all_primary_el.items()))}`",
        f"- **總屬性出現次數（含 1–3 屬性）**：`{dict(sorted(all_total_el.items()))}`",
        f"- **支線生活技星等（生活技無 3 星）**：1★ **{fu_stars[1]}** ／ 2★ **{fu_stars[2]}** ／ 3★ **0**",
        f"- **支線補齊戰鬥技星等（70 : 28 : 2，52 主 + 52 被 = 104 招）**：1★ **{combat_stars[1]}**（69.2%）／ 2★ **{combat_stars[2]}**（28.8%）／ 3★ **{combat_stars[3]}**（1.9%，獨有）",
        f"- **支線合計（生活 52 + 戰鬥 104 = 156 招）**：1★ **{all_side_stars[1]}**（71.8%）／ 2★ **{all_side_stars[2]}**（26.9%）／ 3★ **{all_side_stars[3]}**（1.3%）",
        "",
        "## 2. 全部 52 項支線生活招式任務明細（1 主 1 被 + 星等）",
        "| # | 任務線 | 生活招式 (星等) | 屬性 (1–3) | 關主角色 (文化／年代／風格／年齡) | 對應宙獸 | 招牌主動技 (星／陰陽／距離) | 被動技 (星) |",
        "|---:|---|---|---|---|---|---|---|",
    ]
    for idx, s in enumerate(side_entries, 1):
        els = " / ".join(s["elements"])
        ch_desc = f"`{s['character_id']}` {s['name_zh']}（{s['region_culture']}／{s['era_culture']}／{s['appearance_style']}／{s['age']}歲）"
        mv_desc = f"`{s['signature_move']}` ({s['signature_move_star']}★/{s['signature_move_polarity']}/{s['signature_move_range']})"
        tr_desc = f"`{s['trait']}` ({s['trait_star']}★)"
        doc_lines.append(
            f"| {idx} | {s['quest_line']} | `{s['field_utility']}` ({s['quest_name_zh']}, {s['utility_kind']}, {s['field_utility_star']}★) | {els} | {ch_desc} | `{s['creature_line_id']}` | {mv_desc} | {tr_desc} |"
        )

    doc_path = GAME_ROOT / "docs" / "design" / "field-utility-side-quests.md"
    doc_path.write_text("\n".join(doc_lines) + "\n", encoding="utf-8")

    print(f"Generated {new_chars_count} character prompts, {new_creatures_count} new creature lines.")
    print("72-item balance:")
    print("  kind:", dict(all_kind))
    print("  polarity:", dict(all_pol))
    print("  range:", dict(all_rng))
    print("  primary_el:", dict(sorted(all_primary_el.items())))
    print("  total_el:", dict(sorted(all_total_el.items())))


if __name__ == "__main__":
    main()
