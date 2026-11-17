"""Regenerate designed.js (prompt-forge「已設計項目」) from Data/ batches.

Data JSON stays the single source of truth; designed.js is a generated view so the
browser tool works offline without fetch(). Re-run after editing a batch:
    python gen_designed.py
Stdlib only. Exit 1 if a referenced id is missing.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent
OUT = Path(__file__).with_name("designed.js")

# Visual-only fields the data schema does not carry (concept pipeline step 6). Keyed by line_id.
LINES = {
    "starter_sun_line": {
        "batch": "Data/_incoming/p2-08-starters-draft-01",
        "code_zh": "日",
        "element": "light",
        "elements": ["light（光）", "fire（火，成年起）"],
        "element_palettes": ["金白、暖黃光暈、淡粉", "橘紅、熔金、炭黑邊緣"],
        "base_parents": ["生物·鳥類", "器械·天文/測量儀器", "科幻機械·能量/量子構裝"],
        "bases": ["大白鷺", "太陽鏡陣飛行器", "能量/量子構裝·浮游感應磁軌砲陣列"],
        "timeline": "近代科幻想像（20 世紀初）",
        "disposition": "沉穩專注、喜歡曬太陽",
        "habit": "territorial",
        "archetype": "蘇丹娜之夢：空中花園與日鏡聚光（Sultana's Dream）",
        "archetype_name": "蘇丹娜之夢·日鏡花園",
        "archetype_type": "P5-02 考據庫·神話象徵",
        "archetype_meaning": "以太陽鏡陣汲取天火、凝聚光明的智慧與守護",
        "adult_dims": {"height_length": "2.2 m", "weight": "95 kg", "body_fat": "12%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.45 m", "weight": "1.8 kg", "body_fat": "15%"},
            "adolescent": {"height_length": "1.25 m", "weight": "28 kg", "body_fat": "13%"},
            "adult": {"height_length": "2.2 m", "weight": "95 kg", "body_fat": "12%"},
            "overload": {"height_length": "4.8 m", "weight": "1200 kg", "body_fat": "10%"}
        }
    },
    "starter_moon_line": {
        "batch": "Data/_incoming/p2-08-starters-draft-01",
        "code_zh": "月",
        "element": "shadow",
        "elements": ["shadow（影）", "ice（冰，成年起）"],
        "element_palettes": ["深紫、墨黑、幽藍邊光", "冰藍、霜白、淡紫折射"],
        "base_parents": ["生物·哺乳類", "自然·星體", "科幻機械·仿生機獸"],
        "bases": ["灰狼", "極光電離層", "仿生機獸·光學迷彩合金黑豹"],
        "timeline": "遠古神話（極地口傳）",
        "disposition": "孤僻警覺、只親近主人",
        "habit": "territorial",
        "archetype": "萬年玄冰·極夜星痕巨狼（Amarok）",
        "archetype_name": "阿瑪洛克·極夜霜狼",
        "archetype_type": "P5-02 考據庫·神話象徵",
        "archetype_meaning": "在終古極夜中孤行伏襲、守望冰原星光的堅韌霜魂",
        "adult_dims": {"height_length": "2.5 m", "weight": "420 kg", "body_fat": "18%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.55 m", "weight": "4.2 kg", "body_fat": "20%"},
            "adolescent": {"height_length": "1.4 m", "weight": "52 kg", "body_fat": "19%"},
            "adult": {"height_length": "2.5 m", "weight": "420 kg", "body_fat": "18%"},
            "overload": {"height_length": "5.6 m", "weight": "3800 kg", "body_fat": "15%"}
        }
    },
    "starter_star_line": {
        "batch": "Data/_incoming/p2-08-starters-draft-01",
        "code_zh": "星",
        "element": "thunder",
        "elements": ["thunder（雷）", "wind（風，少年起）"],
        "element_palettes": ["電紫、亮黃、白色閃光", "薄荷綠、雲白、淡青流線"],
        "base_parents": ["生物·哺乳類", "幻想生物·歐洲奇幻", "科幻機械·賽博/電子終端"],
        "bases": ["駿馬", "黃金飛馬天馬", "賽博/電子終端·超導電磁軌道發射器"],
        "timeline": "遠古神話（草原史詩）",
        "disposition": "熱血莽撞、愛衝在最前面",
        "habit": "territorial",
        "archetype": "降魔天駒·奔雷雙翼天馬（Tulpar）",
        "archetype_name": "圖爾帕·金翼神駒",
        "archetype_type": "P5-02 考據庫·神話象徵",
        "archetype_meaning": "馳騁雷雲草原、衝鋒在先驅散陰霾的金色戰魂",
        "adult_dims": {"height_length": "2.5 m", "weight": "540 kg", "body_fat": "14%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.58 m", "weight": "4.8 kg", "body_fat": "16%"},
            "adolescent": {"height_length": "1.4 m", "weight": "62 kg", "body_fat": "15%"},
            "adult": {"height_length": "2.5 m", "weight": "540 kg", "body_fat": "14%"},
            "overload": {"height_length": "6.2 m", "weight": "4600 kg", "body_fat": "12%"}
        }
    },
    "line_metal_gearclock": {
        "batch": "Data/_incoming/p5-03-creatures-draft-01",
        "code_zh": "金",
        "element": "metal",
        "elements": ["metal（金）"],
        "element_palettes": ["青銅綠、黃銅金、玄鐵黑"],
        "base_parents": ["科幻機械·機甲/外骨骼", "器械·鐘錶/計時儀器", "生物·哺乳類"],
        "bases": ["精密青銅發條機關", "鐘錶齒輪與水力平衡連桿", "巨象"],
        "timeline": "古代技術想像（中世紀西亞發條機械）",
        "disposition": "沉穩厚重、分秒不差",
        "habit": "territorial",
        "archetype": "arch_al_jazari",
        "archetype_name": "賈扎里象鐘機關",
        "archetype_type": "P5-02 考據庫·歷史工匠技術",
        "archetype_meaning": "以水力浮碗與發條齒輪驅動的精密報時巨象機兵",
        "adult_dims": {"height_length": "2.40 m", "weight": "650 kg", "body_fat": "8%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.48 m", "weight": "14 kg", "body_fat": "10%"},
            "adolescent": {"height_length": "1.30 m", "weight": "95 kg", "body_fat": "9%"},
            "adult": {"height_length": "2.40 m", "weight": "650 kg", "body_fat": "8%"},
            "overload": {"height_length": "5.2 m", "weight": "5800 kg", "body_fat": "6%"}
        }
    },
    "line_wood_vinecrest": {
        "batch": "Data/_incoming/p5-03-creatures-draft-01",
        "code_zh": "木",
        "element": "wood",
        "elements": ["wood（木）"],
        "element_palettes": ["翡翠綠、孔雀藍、琉璃金"],
        "base_parents": ["生物·鳥類", "植物·草本/藤蔓", "物質·珠寶"],
        "bases": ["熱帶彩翼錦禽", "蔓生藤蔓羽冠", "黃銅雕花底座"],
        "timeline": "遠古神話（東南亞口傳）",
        "disposition": "高貴敏銳、警覺守望",
        "habit": "territorial",
        "archetype": "arch_sarimanok",
        "archetype_name": "薩里馬諾克彩鳳",
        "archetype_type": "P5-02 考據庫·神話神獸",
        "archetype_meaning": "銜魚守護福佑、羽翼流淌雙重虹彩的熱帶祥鳥",
        "adult_dims": {"height_length": "2.10 m", "weight": "65 kg", "body_fat": "11%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.42 m", "weight": "2.2 kg", "body_fat": "14%"},
            "adolescent": {"height_length": "1.15 m", "weight": "18 kg", "body_fat": "12%"},
            "adult": {"height_length": "2.10 m", "weight": "65 kg", "body_fat": "11%"},
            "overload": {"height_length": "4.6 m", "weight": "850 kg", "body_fat": "9%"}
        }
    },
    "line_water_tidecraft": {
        "batch": "Data/_incoming/p5-03-creatures-draft-01",
        "code_zh": "水",
        "element": "water",
        "elements": ["water（水）"],
        "element_palettes": ["潮汐碧藍、白沫銀、陶土赭紅"],
        "base_parents": ["生物·魚類/水生", "裝備·載具/舟艇", "科幻機械·仿生機獸"],
        "bases": ["潮汐海鰻", "雙體風帆外甲浮筒", "蟹爪式聚合物風帆"],
        "timeline": "遠古神話（大洋洲航海遠征）",
        "disposition": "隨波逐流、暗藏殺機",
        "habit": "territorial",
        "archetype": "arch_edai_siabo_lakatoi",
        "archetype_name": "埃達伊·西阿波陶船傳奇",
        "archetype_type": "P5-02 考據庫·航海史詩",
        "archetype_meaning": "隨季風遠航海蝕裂隙、身披雙體陶船甲板的碧波巨鰻",
        "adult_dims": {"height_length": "2.45 m", "weight": "120 kg", "body_fat": "15%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.55 m", "weight": "3.5 kg", "body_fat": "18%"},
            "adolescent": {"height_length": "1.35 m", "weight": "32 kg", "body_fat": "16%"},
            "adult": {"height_length": "2.45 m", "weight": "120 kg", "body_fat": "15%"},
            "overload": {"height_length": "6.8 m", "weight": "2800 kg", "body_fat": "13%"}
        }
    },
    "line_fire_blazelion": {
        "batch": "Data/_incoming/p5-03-creatures-draft-01",
        "code_zh": "火",
        "element": "fire",
        "elements": ["fire（火）"],
        "element_palettes": ["玫瑰砂岩紅、熾金黃、玄武岩暗灰"],
        "base_parents": ["生物·哺乳類", "物質·礦物", "科幻機械·能量/量子構裝"],
        "bases": ["沙漠羱羊", "玫瑰紅砂岩熔爐甲胄", "高溫電漿雙彎角"],
        "timeline": "遠古神話（納巴泰峽谷神殿）",
        "disposition": "兇悍霸烈、主動進攻",
        "habit": "dominant",
        "archetype": "arch_dushara_petra",
        "archetype_name": "杜沙拉·佩特拉玫瑰岩殿",
        "archetype_type": "P5-02 考據庫·神話戰神",
        "archetype_meaning": "背負玫瑰砂岩神殿火口與雙目方塊聖石、以電漿彎角引動岩漿噴湧的沙漠羱羊",
        "adult_dims": {"height_length": "2.30 m", "weight": "310 kg", "body_fat": "13%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.50 m", "weight": "6.5 kg", "body_fat": "17%"},
            "adolescent": {"height_length": "1.30 m", "weight": "68 kg", "body_fat": "15%"},
            "adult": {"height_length": "2.30 m", "weight": "310 kg", "body_fat": "13%"},
            "overload": {"height_length": "5.4 m", "weight": "3600 kg", "body_fat": "11%"}
        }
    },
    "line_earth_gildedgolem": {
        "batch": "Data/_incoming/p5-03-creatures-draft-01",
        "code_zh": "土",
        "element": "earth",
        "elements": ["earth（土）"],
        "element_palettes": ["鎏金黃、翡翠綠、陶土赭褐"],
        "base_parents": ["生物·哺乳類", "物質·礦物", "物質·珠寶"],
        "bases": ["四足重裝犰狳", "聖湖金箔雕甲", "高山聖湖綠寶石稜柱"],
        "timeline": "遠古神話（安地斯文明）",
        "disposition": "沉默威儀、堅不可摧",
        "habit": "territorial",
        "archetype": "arch_el_dorado_muisca",
        "archetype_name": "黃金國穆伊斯卡祭典",
        "archetype_type": "P5-02 考據庫·原住民祭典",
        "archetype_meaning": "身披九節鎏金陶甲與聖湖蘆葦紋金盾、背負翡翠稜柱的崇高四足金甲犰狳",
        "adult_dims": {"height_length": "2.25 m", "weight": "480 kg", "body_fat": "9%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.48 m", "weight": "12 kg", "body_fat": "12%"},
            "adolescent": {"height_length": "1.25 m", "weight": "95 kg", "body_fat": "10%"},
            "adult": {"height_length": "2.25 m", "weight": "480 kg", "body_fat": "9%"},
            "overload": {"height_length": "5.8 m", "weight": "6400 kg", "body_fat": "7%"}
        }
    },
    "line_ice_frostbeast": {
        "batch": "Data/_incoming/p5-03-creatures-draft-01",
        "code_zh": "冰",
        "element": "ice",
        "elements": ["ice（冰）"],
        "element_palettes": ["霜雪白、冰川淡藍、凍鐵古金"],
        "base_parents": ["生物·哺乳類", "幻想生物·歐洲奇幻", "器械·鍛造/金工"],
        "bases": ["永凍鹿角神獸", "冰裂鍛鐵關節", "金箔毛氈鞍軛"],
        "timeline": "遠古神話（歐亞草原游牧）",
        "disposition": "傲骨凌霜、極地伏擊",
        "habit": "aggressive",
        "archetype": "arch_pazyryk_antlered_griffin",
        "archetype_name": "巴澤雷克鹿角神獸",
        "archetype_type": "P5-02 考據庫·斯基泰金工",
        "archetype_meaning": "分叉金屬鹿角生長冰棘、鎮守永凍冰塚的極北獵獸",
        "adult_dims": {"height_length": "2.40 m", "weight": "380 kg", "body_fat": "14%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.52 m", "weight": "5.0 kg", "body_fat": "18%"},
            "adolescent": {"height_length": "1.35 m", "weight": "58 kg", "body_fat": "16%"},
            "adult": {"height_length": "2.40 m", "weight": "380 kg", "body_fat": "14%"},
            "overload": {"height_length": "5.5 m", "weight": "3900 kg", "body_fat": "12%"}
        }
    },
    "line_wind_fluteglider": {
        "batch": "Data/_incoming/p5-03-creatures-draft-01",
        "code_zh": "風",
        "element": "wind",
        "elements": ["wind（風）"],
        "element_palettes": ["茜草絳紅、竹青綠、暖沙金"],
        "base_parents": ["器械·樂器/聲學", "裝備·載具/舟艇", "科幻機械·航太/深空探測"],
        "bases": ["氣流排笛輕舟", "幾何刺繡風帆滑翔翼", "奇納布河流線浮空構裝"],
        "timeline": "遠古神話（印度河與旁遮普民間史詩）",
        "disposition": "自由不羈、隨風起舞",
        "habit": "tolerant",
        "archetype": "arch_heer_ranjha",
        "archetype_name": "希爾與蘭賈之笛",
        "archetype_type": "P5-02 考據庫·民間傳奇",
        "archetype_meaning": "以雕花竹笛共鳴氣流、揚起幾何刺繡滑翔帆乘風翱翔的天舟",
        "adult_dims": {"height_length": "2.20 m", "weight": "85 kg", "body_fat": "10%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.46 m", "weight": "2.8 kg", "body_fat": "15%"},
            "adolescent": {"height_length": "1.20 m", "weight": "22 kg", "body_fat": "12%"},
            "adult": {"height_length": "2.20 m", "weight": "85 kg", "body_fat": "10%"},
            "overload": {"height_length": "6.0 m", "weight": "1150 kg", "body_fat": "8%"}
        }
    },
    "line_metal_citadelbull": {
        "batch": "Data/_incoming/p5-03-creatures-draft-02",
        "code_zh": "金",
        "element": "metal",
        "elements": ["metal（金）", "earth（土，成年副專精）"],
        "element_palettes": ["青銅綠、古銅金、玄鐵黑"],
        "base_parents": ["生物·哺乳類", "幻想生物·美索不達米亞神獸", "器械·城防/機關"],
        "bases": ["青銅翼牛", "楔形護符胸甲", "浮雕城門連桿"],
        "timeline": "遠古神話（美索不達米亞城邦）",
        "disposition": "威嚴守禦、不動如山",
        "habit": "territorial",
        "archetype": "arch_lamassu",
        "archetype_name": "拉瑪蘇神牛門衛",
        "archetype_type": "P5-02 考據庫·神話守護神獸",
        "archetype_meaning": "立於古城門扉兩側、以五足雙翼鎮守秩序的青銅人首翼牛",
        "adult_dims": {"height_length": "2.80 m", "weight": "920 kg", "body_fat": "8%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.60 m", "weight": "28 kg", "body_fat": "11%"},
            "adolescent": {"height_length": "1.55 m", "weight": "210 kg", "body_fat": "9%"},
            "adult": {"height_length": "2.80 m", "weight": "920 kg", "body_fat": "8%"},
            "overload": {"height_length": "6.2 m", "weight": "7400 kg", "body_fat": "6%"}
        }
    },
    "line_wood_crownvine": {
        "batch": "Data/_incoming/p5-03-creatures-draft-02",
        "code_zh": "木",
        "element": "wood",
        "elements": ["wood（木）", "water（水，成年副專精）"],
        "element_palettes": ["翡翠綠、象牙白、蓮粉紅"],
        "base_parents": ["生物·爬蟲類", "植物·水生花卉", "幻想生物·東南亞龍蛇"],
        "bases": ["濕地巨蛇", "七瓣玉蓮冠冕", "茉莉與檳榔花藤"],
        "timeline": "遠古神話（湄公河濕地創世傳說）",
        "disposition": "謹慎優雅、守護水源",
        "habit": "tolerant",
        "archetype": "arch_neang_neak",
        "archetype_name": "蓮冠龍女納迦",
        "archetype_type": "P5-02 考據庫·神話靈蛇",
        "archetype_meaning": "頭戴七首蓮冠、盤踞濕地聖泉守護生機的翡翠龍蛇",
        "adult_dims": {"height_length": "3.40 m", "weight": "185 kg", "body_fat": "12%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.52 m", "weight": "2.6 kg", "body_fat": "14%"},
            "adolescent": {"height_length": "1.70 m", "weight": "42 kg", "body_fat": "13%"},
            "adult": {"height_length": "3.40 m", "weight": "185 kg", "body_fat": "12%"},
            "overload": {"height_length": "7.5 m", "weight": "1900 kg", "body_fat": "10%"}
        }
    },
    "line_water_whalemaelstrom": {
        "batch": "Data/_incoming/p5-03-creatures-draft-02",
        "code_zh": "水",
        "element": "water",
        "elements": ["water（水）"],
        "element_palettes": ["象牙白、深海靛藍、鹽晶銀"],
        "base_parents": ["生物·海洋哺乳類", "自然·洋流/漩渦", "物質·鹽晶礦物"],
        "bases": ["象牙白巨鯨", "斷裂銅製標槍繩索", "鹽晶深海脊柱"],
        "timeline": "近代文學（19 世紀遠洋捕鯨史詩）",
        "disposition": "桀驁狂放、領潮破浪",
        "habit": "aggressive",
        "archetype": "arch_moby_dick",
        "archetype_name": "白鯨莫比·迪克",
        "archetype_type": "P5-02 考據庫·海洋文學巨獸",
        "archetype_meaning": "額刻風暴疤痕、統領深海巨渦與遠洋狂潮的傳奇白鯨",
        "adult_dims": {"height_length": "5.80 m", "weight": "2400 kg", "body_fat": "22%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.85 m", "weight": "35 kg", "body_fat": "24%"},
            "adolescent": {"height_length": "2.60 m", "weight": "480 kg", "body_fat": "23%"},
            "adult": {"height_length": "5.80 m", "weight": "2400 kg", "body_fat": "22%"},
            "overload": {"height_length": "11.5 m", "weight": "14000 kg", "body_fat": "20%"}
        }
    },
    "line_fire_baobabhearth": {
        "batch": "Data/_incoming/p5-03-creatures-draft-02",
        "code_zh": "火",
        "element": "fire",
        "elements": ["fire（火）"],
        "element_palettes": ["赤木棕、炭火橘、玄武岩灰"],
        "base_parents": ["生物·爬蟲類", "植物·巨木", "自然·火山/地熱"],
        "bases": ["巨型陸行火蜥", "猴麵包樹耐熱樹皮甲", "背脊火山口爐心"],
        "timeline": "遠古神話（馬達加斯加英雄史詩）",
        "disposition": "沉穩熾烈、護火守土",
        "habit": "territorial",
        "archetype": "arch_ibonia",
        "archetype_name": "伊博尼亞聖火巨木",
        "archetype_type": "P5-02 考據庫·英雄史詩",
        "archetype_meaning": "身披猴麵包樹皮岩甲、懷抱不滅聖火與火山爐心的熾焰巨蜥",
        "adult_dims": {"height_length": "2.60 m", "weight": "420 kg", "body_fat": "11%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.50 m", "weight": "8 kg", "body_fat": "14%"},
            "adolescent": {"height_length": "1.45 m", "weight": "98 kg", "body_fat": "12%"},
            "adult": {"height_length": "2.60 m", "weight": "420 kg", "body_fat": "11%"},
            "overload": {"height_length": "6.0 m", "weight": "4500 kg", "body_fat": "9%"}
        }
    },
    "line_earth_pillarbeast": {
        "batch": "Data/_incoming/p5-03-creatures-draft-02",
        "code_zh": "土",
        "element": "earth",
        "elements": ["earth（土）"],
        "element_palettes": ["砂岩赭、花崗岩灰、玉石翠"],
        "base_parents": ["生物·哺乳類", "幻想生物·南亞神殿石獸", "物質·礦物/岩石"],
        "bases": ["獅象混合石獸", "神殿千柱浮雕甲", "玉石彎曲獠牙"],
        "timeline": "古代建築想像（南亞石雕神殿）",
        "disposition": "剛猛威武、撼動地脈",
        "habit": "aggressive",
        "archetype": "arch_yali",
        "archetype_name": "亞利神殿石柱獸",
        "archetype_type": "P5-02 考據庫·神殿建築神獸",
        "archetype_meaning": "融合獅鬃、象鼻與千柱浮雕岩盤、鎮守南亞石殿的剛猛守護獸",
        "adult_dims": {"height_length": "2.50 m", "weight": "580 kg", "body_fat": "10%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.52 m", "weight": "14 kg", "body_fat": "12%"},
            "adolescent": {"height_length": "1.35 m", "weight": "140 kg", "body_fat": "11%"},
            "adult": {"height_length": "2.50 m", "weight": "580 kg", "body_fat": "10%"},
            "overload": {"height_length": "5.8 m", "weight": "5600 kg", "body_fat": "8%"}
        }
    },
    "line_ice_driftvessel": {
        "batch": "Data/_incoming/p5-03-creatures-draft-02",
        "code_zh": "冰",
        "element": "ice",
        "elements": ["ice（冰）"],
        "element_palettes": ["冰川藍、原木棕、極夜雪白"],
        "base_parents": ["裝備·載具/舟艇", "器械·極地測繪儀器", "自然·冰川/浮冰"],
        "bases": ["破冰木船殼體", "極地冰橇滑刃", "測風桅杆冰翼"],
        "timeline": "近代探險（19 世紀末極地漂流遠征）",
        "disposition": "堅毅無畏、破冰前行",
        "habit": "tolerant",
        "archetype": "arch_fridtjof_nansen",
        "archetype_name": "南森前進號冰舟",
        "archetype_type": "P5-02 考據庫·極地探險史",
        "archetype_meaning": "以耐壓圓弧船身順應極冰擠壓、載著風標桅杆突破冰原的探險冰獸",
        "adult_dims": {"height_length": "3.20 m", "weight": "890 kg", "body_fat": "14%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.45 m", "weight": "6 kg", "body_fat": "16%"},
            "adolescent": {"height_length": "1.60 m", "weight": "180 kg", "body_fat": "15%"},
            "adult": {"height_length": "3.20 m", "weight": "890 kg", "body_fat": "14%"},
            "overload": {"height_length": "7.2 m", "weight": "6800 kg", "body_fat": "12%"}
        }
    },
    "line_wind_mistwing": {
        "batch": "Data/_incoming/p5-03-creatures-draft-02",
        "code_zh": "風",
        "element": "wind",
        "elements": ["wind（風）"],
        "element_palettes": ["海霧灰白、青銅綠、暴風眼青"],
        "base_parents": ["生物·鳥類", "器械·航海羅盤/星盤", "自然·海霧/氣流"],
        "bases": ["遠洋巨信天翁", "十字弓型修長展翼", "青銅航海星盤"],
        "timeline": "近代文學（18 世紀航海敘事詩）",
        "disposition": "孤高警覺、乘霧遠翔",
        "habit": "tolerant",
        "archetype": "arch_ancient_mariner_albatross",
        "archetype_name": "古舟子霧翼信天翁",
        "archetype_type": "P5-02 考據庫·海洋詩篇",
        "archetype_meaning": "穿梭南極海霧、胸懸青銅星盤指引季風與洋流的跨洋巨鳥",
        "adult_dims": {"height_length": "2.40 m", "weight": "72 kg", "body_fat": "9%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.44 m", "weight": "2.4 kg", "body_fat": "13%"},
            "adolescent": {"height_length": "1.25 m", "weight": "21 kg", "body_fat": "11%"},
            "adult": {"height_length": "2.40 m", "weight": "72 kg", "body_fat": "9%"},
            "overload": {"height_length": "5.8 m", "weight": "960 kg", "body_fat": "7%"}
        }
    },
    "line_thunder_redburrower": {
        "batch": "Data/_incoming/p5-03-creatures-draft-02",
        "code_zh": "雷",
        "element": "thunder",
        "elements": ["thunder（雷）", "fire（火，成年副專精）"],
        "element_palettes": ["赤紅砂礫、銅線圈橙、電漿紫藍"],
        "base_parents": ["生物·無脊椎/蟲類", "幻想生物·戈壁傳說", "科幻機械·電磁磁軌"],
        "bases": ["赤紅戈壁沙蟲", "高壓銅質電容環", "結晶化磁軌脊刺"],
        "timeline": "近代神秘傳說（中亞戈壁口傳）",
        "disposition": "詭譎迅猛、蓄電狙擊",
        "habit": "aggressive",
        "archetype": "arch_olgoi_khorkhoi",
        "archetype_name": "戈壁死亡赤蟲",
        "archetype_type": "P5-02 考據庫·荒漠傳說",
        "archetype_meaning": "潛伏乾燥戈壁沙丘之下、以雙極銅環蓄電轟出電漿雷光的赤紅沙蟲",
        "adult_dims": {"height_length": "4.20 m", "weight": "640 kg", "body_fat": "10%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.48 m", "weight": "3.2 kg", "body_fat": "12%"},
            "adolescent": {"height_length": "1.80 m", "weight": "110 kg", "body_fat": "11%"},
            "adult": {"height_length": "4.20 m", "weight": "640 kg", "body_fat": "10%"},
            "overload": {"height_length": "9.0 m", "weight": "5200 kg", "body_fat": "8%"}
        }
    },
    "line_light_foilprism": {
        "batch": "Data/_incoming/p5-03-creatures-draft-02",
        "code_zh": "光",
        "element": "light",
        "elements": ["light（光）", "thunder（雷，成年副專精）"],
        "element_palettes": ["純金箔黃、暖白核心、虹彩稜鏡光"],
        "base_parents": ["物質·金屬箔片", "器械·粒子加速器", "自然·光學稜鏡"],
        "bases": ["極薄折紙金箔環", "迴旋加速器核球", "七彩光譜散射扇"],
        "timeline": "現代科學想像（20 世紀初原子核物理）",
        "disposition": "敏銳純淨、折射萬象",
        "habit": "tolerant",
        "archetype": "arch_ernest_rutherford",
        "archetype_name": "拉塞福金箔散射環",
        "archetype_type": "P5-02 考據庫·科學發現象徵",
        "archetype_meaning": "以極薄金箔稜鏡環繞高能粒子核心、將撞擊光束折射為極光扇陣的科學光靈",
        "adult_dims": {"height_length": "1.95 m", "weight": "48 kg", "body_fat": "5%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.35 m", "weight": "0.9 kg", "body_fat": "5%"},
            "adolescent": {"height_length": "1.05 m", "weight": "12 kg", "body_fat": "5%"},
            "adult": {"height_length": "1.95 m", "weight": "48 kg", "body_fat": "5%"},
            "overload": {"height_length": "4.5 m", "weight": "420 kg", "body_fat": "4%"}
        }
    },
    "line_shadow_ironsteed": {
        "batch": "Data/_incoming/p5-03-creatures-draft-02",
        "code_zh": "影",
        "element": "shadow",
        "elements": ["shadow（影）"],
        "element_palettes": ["啞光玄鐵黑、幽冥銀灰、極夜深藍"],
        "base_parents": ["生物·哺乳類", "裝備·重甲戰馬具", "自然·極夜暮影"],
        "bases": ["極北玄鐵戰馬", "寒鐵弧刃護甲", "幽影披風長鬃"],
        "timeline": "遠古神話（薩哈／雅庫特英雄史詩）",
        "disposition": "冷峻忠誠、無聲突襲",
        "habit": "territorial",
        "archetype": "arch_nyurgun_bootur",
        "archetype_name": "紐爾貢·博圖爾黑鐵駿馬",
        "archetype_type": "P5-02 考據庫·北亞英雄史詩",
        "archetype_meaning": "身披啞光玄鐵戰甲、在極夜雪原踏出幽影殘像的忠誠鐵騎",
        "adult_dims": {"height_length": "2.45 m", "weight": "490 kg", "body_fat": "12%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.58 m", "weight": "16 kg", "body_fat": "15%"},
            "adolescent": {"height_length": "1.45 m", "weight": "135 kg", "body_fat": "13%"},
            "adult": {"height_length": "2.45 m", "weight": "490 kg", "body_fat": "12%"},
            "overload": {"height_length": "5.5 m", "weight": "3900 kg", "body_fat": "10%"}
        }
    }
}

# 十大宙獸演化線超載型態（Overload）定案設定
OVERLOADS = {
    "starter_sun_line": {
        "stage": "overload",
        "creature_id": "sun_coronavault_skyheron",
        "habit": "dominant",
        "disposition": "神聖威嚴、君臨長空",
        "name_zh": "鏡環天鷺",
        "name_en": "Mirravault",
        "naming_note": "四階段統一命名；鏡陣大成，日冕登冠。",
        "size_class": "XL",
        "height_length": "4.8 m",
        "weight": "1200 kg",
        "body_fat": "10%",
        "look": "太陽鏡陣飛行器與天鷺完全共鳴；背部環形鏡陣激發為三層旋轉日冕光環，光羽噴射耀眼金炎，以太管道引導星雲光子流",
        "dex_zh": "當以太能量在鏡陣中超載激盪，背部的聚光環便會如初升之日般耀眼綻放。合攏所有鏡面射出的神聖日冕光柱，能在一瞬間照亮整顆星球的夜空。",
        "dex_en": "When ether energy surges beyond limits in its array, the corona ring on its back blazes like the rising sun. Focusing every mirror into a divine coronal pillar, it can instantly banish night from the entire planetary sky.",
        "signature_move": {
            "move_id": "light_coronavault_burst",
            "name_zh": "日冕貫天神光",
            "name_en": "Coronal Burst",
            "element": "light",
            "range_class": "long",
            "shape": "line",
            "movement": "none",
            "naming_note": "全鏡合一，貫穿穹蒼。",
            "desc_zh": "全鏡面合攏聚光鎖定，射出貫穿天際的金色日冕光柱，伴隨刺目光波震盪。",
            "desc_en": "Aligns all mirrors into a focused lock, unleashing a golden coronal pillar that pierces the heavens with radiant shockwaves.",
            "visual": "全鏡面合攏聚光鎖定，射出貫穿天際的金色日冕光柱，伴隨刺目光波震盪。"
        }
    },
    "starter_moon_line": {
        "stage": "overload",
        "creature_id": "moon_eclipsvast_wolf",
        "habit": "dominant",
        "disposition": "狂暴冷酷、蝕滅萬物",
        "name_zh": "夜痕霜狼",
        "name_en": "Nivervast",
        "naming_note": "四階段統一命名；極夜化身，蝕月生寒。",
        "size_class": "XL",
        "height_length": "5.6 m",
        "weight": "3800 kg",
        "body_fat": "15%",
        "look": "極地霜原巨狼超載爆發；極夜暗影與萬年玄冰包覆全身，背脊升起星圖冰棘，雙瞳燃燒極光幽火，踩踏之處地面化為幽冥暗影冰鏡",
        "dex_zh": "在極寒與暗影達到頂點的瞬間，牠的身軀化作吞噬光芒的蝕月巨狼。踏冰而過時留下的夜痕凍結空間，揮動的霜影重爪足以撕裂冰河裂谷。",
        "dex_en": "When cold and shadow reach their zenith, it transforms into the eclipse wolf that devours light itself. Its frosted footsteps freeze space in its wake, and a sweep of its shadow claw shatters glacial valleys.",
        "signature_move": {
            "move_id": "shadow_eclipsvast_claw",
            "name_zh": "極夜蝕月裂空爪",
            "name_en": "Eclipse Claws",
            "element": "shadow",
            "range_class": "melee",
            "shape": "sweep",
            "movement": "forward",
            "naming_note": "撕裂裂谷，極夜降臨。",
            "desc_zh": "撕開暗影裂隙暴風突進，巨爪帶起幽藍極光與霜凍暗影大範圍橫掃。",
            "desc_en": "Rips open shadow fissures in a blizzard rush, sweeping immense claws cloaked in auroral frost across a broad arc.",
            "visual": "撕開暗影裂隙暴風突進，巨爪帶起幽藍極光與霜凍暗影大範圍橫掃。"
        }
    },
    "starter_star_line": {
        "stage": "overload",
        "creature_id": "star_tempest_celestial",
        "habit": "dominant",
        "disposition": "萬鈞奔雷、威壓寰宇",
        "name_zh": "星蹄天驥",
        "name_en": "Voltrazent",
        "naming_note": "四階段統一命名；雷皇踏空，星霆撼野。",
        "size_class": "XL",
        "height_length": "6.2 m",
        "weight": "4600 kg",
        "body_fat": "12%",
        "look": "天馬雷霆超載；金色雙翼展開為暴風雷雲之翼，周身奔湧萬鈞高壓電弧，鬃毛如雷漿流淌，馬蹄踏空激起轟鳴雷爆",
        "dex_zh": "體內的雷霆核心完全解放，四蹄踏擊雷雲如金鼓擂動。牠能裹挾萬重狂風與熾盛天雷在天際翱翔，如同一顆劃破長夜的金色流星。",
        "dex_en": "With its thunder core unleashed, four hooves strike thunderclouds like war drums. Enveloped in tempests and blazing lightning, it soars across the sky like a golden meteor cutting through the endless dark.",
        "signature_move": {
            "move_id": "thunder_tempest_stride",
            "name_zh": "萬鈞星雷破空撞",
            "name_en": "Tempest Celestial Stride",
            "element": "thunder",
            "range_class": "melee",
            "shape": "burst",
            "movement": "forward",
            "naming_note": "萬鈞金雷，破空先鋒。",
            "desc_zh": "雙翼聚斂百萬伏特雷暴，以超音速突進引發全場範圍的金色雷暴轟鳴。",
            "desc_en": "Gathers a million-volt storm in its wings and charges at supersonic speed, igniting field-wide golden thunderclaps.",
            "visual": "雙翼聚斂百萬伏特雷暴，以超音速突進引發全場範圍的金色雷暴轟鳴。"
        }
    },
    "line_metal_gearclock": {
        "stage": "overload",
        "creature_id": "metal_chronos_colossus",
        "habit": "dominant",
        "disposition": "萬古恆準、破山裂陣",
        "name_zh": "漏輪巨象",
        "name_en": "Clepsarche",
        "naming_note": "四階段統一命名；水鐘化天樞，發條鎮乾坤。",
        "size_class": "XL",
        "height_length": "5.2 m",
        "weight": "5800 kg",
        "body_fat": "6%",
        "look": "青銅象鐘發條全功率超載運轉；背部水力平衡浮碗激發為多重星空報時齒輪天環，四足裝甲化為城壁般的黃銅金剛岩柱，象鼻化為噴射高壓青銅蒸氣與電離磁針的聚能炮塔",
        "dex_zh": "當體內的漏刻水流與發條能量突破臨界，巨象身軀化作鎮壓大地的金屬要塞。背後旋轉的天樞齒輪每轉一刻度，便在大地引發劇烈的重力共鳴與音波衝擊。",
        "dex_en": "Overloading its inner water clock and springs, the colossus transforms into an unyielding bronze fortress. Each turn of its celestial gear rings unleashes deep gravitational resonance and seismic tremors across the earth.",
        "signature_move": {
            "move_id": "metal_celestial_clockquake",
            "name_zh": "天樞時輪震天破",
            "name_en": "Celestial Clockquake",
            "element": "metal",
            "range_class": "melee",
            "shape": "burst",
            "movement": "forward",
            "naming_note": "萬齒齊鳴，時空崩裂。",
            "desc_zh": "全身青銅齒輪急轉蓄力，象足重踏大地引發全周金屬音波與環形地震波，重創全場敵方。",
            "desc_en": "Spins every bronze gear at maximum speed and stomps the earth, unleashing field-wide seismic shockwaves and deafening metallic chimes.",
            "visual": "全身青銅齒輪急轉蓄力，象足重踏大地引發全周金屬音波與環形地震波，重創全場敵方。"
        }
    },
    "line_wood_vinecrest": {
        "stage": "overload",
        "creature_id": "wood_canopy_sovereign",
        "habit": "dominant",
        "disposition": "神聖祥和、庇蔭萬木",
        "name_zh": "蔓冠虹禽",
        "name_en": "Vireloria",
        "naming_note": "四階段統一命名；雙虹耀天，萬木來朝。",
        "size_class": "XL",
        "height_length": "4.6 m",
        "weight": "850 kg",
        "body_fat": "9%",
        "look": "薩里馬諾克熱帶彩鳳超載爆發；頭頂蔓冠舒展為通天巨樹般的光質翡翠神木，雙重虹彩長羽化作如極光瀑布般的七色光帶，足下黃銅底座完全熔鑄為凌空懸浮的符文靈盤，口銜的神話光靈之魚化為高能以太光核",
        "dex_zh": "超載激發的翠玉生機使天際化作七彩祥雲。振翅間灑落的翡翠光塵能活化整片林海，口中光魚引導的蒼穹虹光更可將一切侵蝕生機的邪穢淨化殆盡。",
        "dex_en": "Overloaded life energy paints the heavens in iridescent aurorae. Gliding on radiant rainbow plumage, it showers forests with revitalizing emerald spores and focuses a purifying solar beam through its sacred spirit fish.",
        "signature_move": {
            "move_id": "wood_aurora_canopy_bloom",
            "name_zh": "虹彩天幕森羅綻",
            "name_en": "Aurora Canopy Bloom",
            "element": "wood",
            "range_class": "long",
            "shape": "burst",
            "movement": "none",
            "naming_note": "虹光鋪天，生靈盛放。",
            "desc_zh": "振起七彩虹羽鋪展覆天樹冠，降下狂暴的翡翠荊棘雨與神聖虹光波，引發大範圍以太生機引爆。",
            "desc_en": "Spreads seven-colored wings into a celestial canopy, raining down surging emerald briars and radiant rainbow flares across the entire field.",
            "visual": "振起七彩虹羽鋪展覆天樹冠，降下狂暴的翡翠荊棘雨與神聖虹光波，引發大範圍以太生機引爆。"
        }
    },
    "line_water_tidecraft": {
        "stage": "overload",
        "creature_id": "water_oceanvoyage_leviathan",
        "habit": "dominant",
        "disposition": "翻江倒海、吞吐狂瀾",
        "name_zh": "潮帆巨鰻",
        "name_en": "Brinamar",
        "naming_note": "四階段統一命名；萬里破浪，海天合一。",
        "size_class": "XL",
        "height_length": "6.8 m",
        "weight": "2800 kg",
        "body_fat": "13%",
        "look": "雙體巨舟風帆與遠古海鰻融為一體；背脊生長出如戰列旗艦般的重層光翼蟹爪帆，船體外甲陶紋亮起高純度水以太脈衝，周身環繞著狂暴的迴旋引力潮汐水環",
        "dex_zh": "巨鰻身軀在超載時膨脹為能載動城邦的碧海神舟。破浪游動時隨身掀起遮天蔽日的暴風海嘯，蟹爪主帆聚斂的狂濤能在瞬間淹沒整片群島要塞。",
        "dex_en": "Swelling to the scale of a floating fortress in overload, it charges through storm-tossed waters beneath towering light-wing sails. Waves swirling around its flanks can drown entire coastal bastions in a single surge.",
        "signature_move": {
            "move_id": "water_tidal_deluge_tsunami",
            "name_zh": "萬重潮瀾破天浪",
            "name_en": "Sovereign Tidal Tsunami",
            "element": "water",
            "range_class": "long",
            "shape": "line",
            "movement": "forward",
            "naming_note": "季風合一，萬浪齊崩。",
            "desc_zh": "張開全重光翼蟹爪帆激引深海暗湧，以驚天之勢朝前方轟射吞沒長空的狂瀾水龍卷衝擊波。",
            "desc_en": "Unfurls all light-weave crab-claw sails to command the deep ocean trench, unleashing a massive forward surge of swirling tidal waters that engulfs the front line.",
            "visual": "張開全重光翼蟹爪帆激引深海暗湧，以驚天之勢朝前方轟射吞沒長空的狂瀾水龍卷衝擊波。"
        }
    },
    "line_fire_blazelion": {
        "stage": "overload",
        "creature_id": "fire_sunpharaoh_lion",
        "habit": "dominant",
        "disposition": "焚天滅世、神威君臨",
        "name_zh": "焰角羱羊",
        "name_en": "Pyribex",
        "naming_note": "四階段統一命名；玫瑰岩殿化熔爐，雙角引天火。",
        "size_class": "XL",
        "height_length": "5.4 m",
        "weight": "3600 kg",
        "body_fat": "11%",
        "look": "玫瑰砂岩沙漠羱羊超載化身為峽谷熔岩聖獸；一對巨型後彎環節角展開為三千度耀白電漿弧拱，背脊神殿火口與雙目方塊聖石崩解重組為懸浮玫瑰岩熔爐冠環，四足岩蹄踏出沸騰岩漿",
        "dex_zh": "超載讓玫瑰岩殿的熔爐核心完全解放。牠立足之處砂石瞬間化為流淌岩漿，昂首引動雙角電漿弧時噴發的滔天烈焰足以將峽谷染成永恆白晝。",
        "dex_en": "Overloading unleashes the rose-sandstone furnace within the canyon ibex. Sand and rock liquefy into flowing magma beneath its hooves, while plasma arcs between its colossal curved horns erupt across the sky.",
        "signature_move": {
            "move_id": "fire_solar_pharaoh_eruption",
            "name_zh": "炎皇日輪焚天怒",
            "name_en": "Solar Pharaoh Eruption",
            "element": "fire",
            "range_class": "long",
            "shape": "burst",
            "movement": "none",
            "naming_note": "岩殿傾瀉，萬物焦土。",
            "desc_zh": "背部玫瑰岩熔爐全開聚集百萬度電漿核焰，向目標區域轟落核爆級別的環形烈焰。",
            "desc_en": "Ignites the dorsal rose-sandstone furnace into a million-degree plasma flare, detonating a cataclysmic ring of fire over the target sector.",
            "visual": "背部玫瑰岩熔爐全開聚集百萬度電漿核焰，向目標區域轟落核爆級別的環形烈焰。"
        }
    },
    "line_earth_gildedgolem": {
        "stage": "overload",
        "creature_id": "earth_eldorado_colossus",
        "habit": "dominant",
        "disposition": "不動如山、威鎮八荒",
        "name_zh": "金甲犰狳",
        "name_en": "Gildumara",
        "naming_note": "四階段統一命名；聖湖化金甲，萬仞鎮八荒。",
        "size_class": "XL",
        "height_length": "5.8 m",
        "weight": "6400 kg",
        "body_fat": "7%",
        "look": "四足重裝金甲犰狳完全沉浸於黃金國祭典神能中；九節穹頂背殼生成千層高純黃金重甲與菱形祖母綠稜柱陣列，背脊聖湖蘆葦金筏化為懸浮引力星環，四足如金剛岩柱深植大地",
        "dex_zh": "超載使金甲犰狳化為黃金之國的移動神殿要塞。任何物理與能量衝擊撞上其金晶穹頂背殼皆如微風拂面，四足踏步間能引動整片大陸構造板塊的沉凝防護重壓。",
        "dex_en": "Overloaded gold and emerald matrices crown this colossal four-legged armadillo as a moving bastion of El Dorado. Physical and energetic blows bounce harmlessly from its domed auric carapace while each step shifts tectonic plates.",
        "signature_move": {
            "move_id": "earth_eldorado_tectonic_slam",
            "name_zh": "黃金天國地動破",
            "name_en": "Eldorado Tectonic Slam",
            "element": "earth",
            "range_class": "melee",
            "shape": "burst",
            "movement": "forward",
            "naming_note": "萬仞金山，鎮壓萬物。",
            "desc_zh": "雙臂金晶巨柱以崩山之勢重砸地面，激起沖天黃金晶柱與連鎖地裂地震波，重創全場敵軍。",
            "desc_en": "Slams its gold-crystal pillar arms into the earth with mountain-cleaving force, erupting towering auric spires and shattering seismic faults across the zone.",
            "visual": "雙臂金晶巨柱以崩山之勢重砸地面，激起沖天黃金晶柱與連鎖地裂地震波，重創全場敵軍。"
        }
    },
    "line_ice_frostbeast": {
        "stage": "overload",
        "creature_id": "ice_permafrost_griffin",
        "habit": "dominant",
        "disposition": "凌寒肅殺、極北主宰",
        "name_zh": "霜角巨獸",
        "name_en": "Rimbragard",
        "naming_note": "四階段統一命名；永凍千尋，鹿角破冥。",
        "size_class": "XL",
        "height_length": "5.5 m",
        "weight": "3900 kg",
        "body_fat": "12%",
        "look": "永凍冰塚守護神獸超載覺醒；一對巨型金屬鹿角生長為覆蓋天際的結晶冰珊瑚樹，鍛鐵羽翼覆上絕對零度的幽藍玄冰，金箔鞍軛散發刺骨幽靈星光",
        "dex_zh": "超載降臨的瞬間，整座荒原的溫度降至絕對零度。巨獸鹿角間跳躍的零度冰魄電弧能在一瞬間將暴風雨凍結成靜止的冰雕，振翼掀起的寒潮令萬物歸於寂靜。",
        "dex_en": "At the moment of overload, temperatures plunge toward absolute zero. Crystalline arcs leaping across its colossal antler canopy freeze blizzards mid-air into silent ice sculptures.",
        "signature_move": {
            "move_id": "ice_absolute_permafrost_howl",
            "name_zh": "萬古霜冥極寒劫",
            "name_en": "Absolute Permafrost Howl",
            "element": "ice",
            "range_class": "long",
            "shape": "sweep",
            "movement": "none",
            "naming_note": "絕對零度，萬籟俱寂。",
            "desc_zh": "鹿角匯聚極北永凍寒髓，仰天引吭咆哮，釋放橫掃全場的零度冰風暴與極地碎冰潮。",
            "desc_en": "Channels the core frost of eternal glaciers through its antlers and unleashes an all-encompassing blizzard gale that entombs the battlefield in permafrost.",
            "visual": "鹿角匯聚極北永凍寒髓，仰天引吭咆哮，釋放橫掃全場的零度冰風暴與極地碎冰潮。"
        }
    },
    "line_wind_fluteglider": {
        "stage": "overload",
        "creature_id": "wind_zephyr_archcruiser",
        "habit": "dominant",
        "disposition": "乘風破浪、縹緲天籟",
        "name_zh": "笛風天舟",
        "name_en": "Reevilora",
        "naming_note": "四階段統一命名；九天仙籟，風御萬里。",
        "size_class": "XL",
        "height_length": "6.0 m",
        "weight": "1150 kg",
        "body_fat": "8%",
        "look": "傳奇風舟在超載中幻化為空靈雲海巨艦；幾何刺繡風帆化作千層半透明光羽流雲翼，舟身百孔排笛在以太狂風中演奏出撕裂長空的音波風暴，周身環繞著高速平流層氣流環",
        "dex_zh": "超載讓笛舟徹底融入大氣平流層。其所過之處天籟交鳴、狂風隨其指揮若定，百孔排笛共振釋放的超高壓風刃甚至能在雲海中斬開長達數十里的無雲天塹。",
        "dex_en": "Fusing completely into stratospheric air currents during overload, the archcruiser plays a symphony of tempests. Resonating high-pressure sonic wind blades carve massive clear ravines through endless seas of clouds.",
        "signature_move": {
            "move_id": "wind_stratosphere_symphony",
            "name_zh": "九天笛音裂空風",
            "name_en": "Stratospheric Symphony Gale",
            "element": "wind",
            "range_class": "long",
            "shape": "line",
            "movement": "forward",
            "naming_note": "萬管齊鳴，天塹破雲。",
            "desc_zh": "全船百組竹笛共振激發音爆颶風，在超高速巡航中沿直線向前轟出撕裂大氣的狂暴螺旋風壓波。",
            "desc_en": "Vibrates hundred-flute arrays into a sonic tempest, projecting a spiraling atmospheric vacuum cannon forward in supersonic flight.",
            "visual": "全船百組竹笛共振激發音爆颶風，在超高速巡航中沿直線向前轟出撕裂大氣的狂暴螺旋風壓波。"
        }
    },
    "line_metal_citadelbull": {
        "stage": "overload",
        "creature_id": "metal_citadel_overload",
        "habit": "dominant",
        "disposition": "萬鈞鎮嶽、不動城塞",
        "name_zh": "城門鐵牛",
        "name_en": "Lamassugate",
        "naming_note": "四階段統一命名；五足青銅城塞完全展開。",
        "size_class": "XL",
        "height_length": "6.2 m",
        "weight": "7400 kg",
        "body_fat": "6%",
        "look": "古城門扉裝甲徹底展開為移動青銅堡壘；五足踏地引動大地磁場，雙翼化作十二道楔形浮雕砲翼，額間太陽門環燃起熾白熔金光焰",
        "dex_zh": "超載讓城門鐵牛化作無法撼動的活體城塞。其展開的青銅翼牆能彈開重砲轟擊，高壓鐵砧震波一落便足以粉碎整片岩層。",
        "dex_en": "Overload transforms Lamassugate into an immovable bronze bastion. Its unfurled wing-walls deflect heavy barrages before dropping a tectonic anvil shockwave.",
        "signature_move": {
            "move_id": "metal_citadel_cataclysm",
            "name_zh": "萬鈞城塞天砧落",
            "name_en": "Citadel Sky-Anvil",
            "element": "metal",
            "range_class": "long",
            "shape": "area",
            "movement": "none",
            "naming_note": "城門鎮嶽，萬鈞壓頂。",
            "desc_zh": "將十二道青銅翼牆聚合為巨型城塞鐵砧，從高空垂直鎮壓整片戰場。",
            "desc_en": "Converges twelve bronze wing-walls into a colossal sky-anvil that crushes the entire arena.",
            "visual": "將十二道青銅翼牆聚合為巨型城塞鐵砧，從高空垂直鎮壓整片戰場。"
        }
    },
    "line_wood_crownvine": {
        "stage": "overload",
        "creature_id": "wood_crownvine_overload",
        "habit": "dominant",
        "disposition": "神聖威儀、森羅萬象",
        "name_zh": "蓮蔓龍蛇",
        "name_en": "Neaklotus",
        "naming_note": "四階段統一命名；七首玉蓮化作遮天聖林。",
        "size_class": "XL",
        "height_length": "7.5 m",
        "weight": "1900 kg",
        "body_fat": "10%",
        "look": "七瓣玉蓮冠冕綻放成懸浮翡翠光輪，修長龍蛇身軀與千年古樹根系共生，萬千茉莉花藤化作覆蓋戰場的翠綠天幕",
        "dex_zh": "超載喚醒濕地聖泉的遠古生機。蓮蔓龍蛇吐息之間便能催生整片翡翠巨木林，以神聖根脈封鎖並淨化一切侵擾。",
        "dex_en": "Overload awakens the primordial vitality of sacred wetlands, sprouting an emerald canopy of ancient roots that seals and purifies the battlefield.",
        "signature_move": {
            "move_id": "wood_sacred_lotus_canopy",
            "name_zh": "七蓮聖林覆天陣",
            "name_en": "Sacred Lotus Canopy",
            "element": "wood",
            "range_class": "long",
            "shape": "area",
            "movement": "none",
            "naming_note": "七蓮齊放，古木參天。",
            "desc_zh": "催動七瓣玉蓮光輪，令無數翡翠巨木破土而出並交織成壓頂聖林。",
            "desc_en": "Pulses its seven-petaled lotus halo to erupt a towering canopy of emerald timber across the field.",
            "visual": "催動七瓣玉蓮光輪，令無數翡翠巨木破土而出並交織成壓頂聖林。"
        }
    },
    "line_water_whalemaelstrom": {
        "stage": "overload",
        "creature_id": "water_whalemaelstrom_overload",
        "habit": "dominant",
        "disposition": "狂暴深海、無可阻擋",
        "name_zh": "白鯨巨渦",
        "name_en": "Mobymael",
        "naming_note": "四階段統一命名；白鯨化作吞天海嘯漩渦。",
        "size_class": "XL",
        "height_length": "11.5 m",
        "weight": "14000 kg",
        "body_fat": "20%",
        "look": "象牙白巨鯨周身環繞三道百丈深海漩渦，體側鹽晶脊柱釋放幽藍高壓水柱，舊時代銅製標槍化作引導雷潮的避雷長戟",
        "dex_zh": "進入超載的白鯨巨渦宛如移動的深海風暴核心，所過之處洋流倒捲、巨浪排空，連鐵甲戰艦也會被漩渦吞沒。",
        "dex_en": "In overload, Mobymael becomes the eye of an abyssal tempest, reversing ocean currents and swallowing ironclad formations in towering maelstroms.",
        "signature_move": {
            "move_id": "water_abyssal_maelstrom",
            "name_zh": "深海歸墟大漩渦",
            "name_en": "Abyssal Maelstrom",
            "element": "water",
            "range_class": "long",
            "shape": "sweep",
            "movement": "forward",
            "naming_note": "白鯨領潮，歸墟吞天。",
            "desc_zh": "引動深海歸墟巨渦向前席捲，將沿途目標捲入高壓水牆之中徹底粉碎。",
            "desc_en": "Unleashes a sweeping abyssal maelstrom forward, crushing everything caught in its roaring wall of water.",
            "visual": "引動深海歸墟巨渦向前席捲，將沿途目標捲入高壓水牆之中徹底粉碎。"
        }
    },
    "line_fire_baobabhearth": {
        "stage": "overload",
        "creature_id": "fire_baobabhearth_overload",
        "habit": "dominant",
        "disposition": "熾烈護土、聖火長明",
        "name_zh": "猴麵包火蜥",
        "name_en": "Baobabhearth",
        "naming_note": "四階段統一命名；古木火山徹底甦醒。",
        "size_class": "XL",
        "height_length": "6.0 m",
        "weight": "4500 kg",
        "body_fat": "9%",
        "look": "背脊猴麵包樹皮化作黑曜岩冠冕，體內聖火透過六座火山爐口衝天噴湧，熾金岩漿脈絡沿著四肢甲片流淌",
        "dex_zh": "超載點燃了遠古巨木深處的地熱爐心。猴麵包火蜥每踏一步皆迸發金紅火蓮，以焚天熔岩守護領土。",
        "dex_en": "Overload ignites the geothermal hearth within its ancient bark, erupting golden-red lava blooms from six dorsal vents.",
        "signature_move": {
            "move_id": "fire_sacred_hearth_eruption",
            "name_zh": "聖木火口大噴發",
            "name_en": "Sacred Hearth Eruption",
            "element": "fire",
            "range_class": "long",
            "shape": "area",
            "movement": "none",
            "naming_note": "六口齊噴，烈焰焚野。",
            "desc_zh": "六座背脊火山口同時向天際噴發，降下覆蓋全場的熾金熔岩火雨。",
            "desc_en": "Erupts all six dorsal caldera vents skyward, raining molten gold fire across the battlefield.",
            "visual": "六座背脊火山口同時向天際噴發，降下覆蓋全場的熾金熔岩火雨。"
        }
    },
    "line_earth_pillarbeast": {
        "stage": "overload",
        "creature_id": "earth_pillarbeast_overload",
        "habit": "dominant",
        "disposition": "威震八方、地動山搖",
        "name_zh": "石柱獠牙獸",
        "name_en": "Yalipillar",
        "naming_note": "四階段統一命名；千柱神殿化作移動山嶽。",
        "size_class": "XL",
        "height_length": "5.8 m",
        "weight": "5600 kg",
        "body_fat": "8%",
        "look": "神殿千柱浮雕在超載中展開為懸浮黃金寶輪與花崗岩拱門，玉石獠牙延伸為丈長破岩巨刃，周身環繞浮空碎岩",
        "dex_zh": "超載的石柱獠牙獸如一座甦醒的古代石殿，足踏地脈即可掀起百丈岩柱林海，令敵陣無從立足。",
        "dex_en": "In overload, Yalipillar awakens like a living stone temple, raising forests of monolithic pillars along subterranean fault lines.",
        "signature_move": {
            "move_id": "earth_thousand_pillar_quake",
            "name_zh": "千柱神殿裂地陣",
            "name_en": "Thousand-Pillar Quake",
            "element": "earth",
            "range_class": "long",
            "shape": "area",
            "movement": "none",
            "naming_note": "千柱齊出，地脈崩摧。",
            "desc_zh": "猛踏大地喚起神殿千柱從地底穿刺而出，同時引發劇烈岩脈震盪。",
            "desc_en": "Stomps the earth to erupt a forest of temple stone pillars beneath opposing ranks.",
            "visual": "猛踏大地喚起神殿千柱從地底穿刺而出，同時引發劇烈岩脈震盪。"
        }
    },
    "line_ice_driftvessel": {
        "stage": "overload",
        "creature_id": "ice_driftvessel_overload",
        "habit": "dominant",
        "disposition": "極地領航、破冰不息",
        "name_zh": "極地破冰獸",
        "name_en": "Framdrift",
        "naming_note": "四階段統一命名；前進號化作極光破冰巨艦。",
        "size_class": "XL",
        "height_length": "7.2 m",
        "weight": "6800 kg",
        "body_fat": "12%",
        "look": "圓弧木船殼與萬年藍冰融合成極地巨艦，三座測風冰桅閃耀翡翠極光，船首破冰巨刃散發絕對零度寒霧",
        "dex_zh": "超載讓極地破冰獸承載整座極夜冰川之勢，無論多厚的冰封屏障都能一撞而碎，在極光下開闢航道。",
        "dex_en": "Overload fuses Framdrift with glacial mass, its aurora-lit masts and zero-degree prow shattering any frozen barrier.",
        "signature_move": {
            "move_id": "ice_aurora_icebreaker",
            "name_zh": "極光萬年破冰艦",
            "name_en": "Aurora Icebreaker",
            "element": "ice",
            "range_class": "long",
            "shape": "line",
            "movement": "forward",
            "naming_note": "極光引航，冰川開道。",
            "desc_zh": "借極光寒流加速破冰巨刃，沿直線貫穿全場並留下永凍冰牆。",
            "desc_en": "Accelerates its aurora-charged prow in a devastating linear charge that leaves frozen spires behind.",
            "visual": "借極光寒流加速破冰巨刃，沿直線貫穿全場並留下永凍冰牆。"
        }
    },
    "line_wind_mistwing": {
        "stage": "overload",
        "creature_id": "wind_mistwing_overload",
        "habit": "dominant",
        "disposition": "御風千里、海天莫測",
        "name_zh": "霧翼信天翁",
        "name_en": "Mistalbatross",
        "naming_note": "四階段統一命名；海霧巨翼化作暴風眼。",
        "size_class": "XL",
        "height_length": "5.8 m",
        "weight": "960 kg",
        "body_fat": "7%",
        "look": "遠洋巨翼展開化作半透明雲嵐天幕，胸前青銅星盤化為三環氣流儀，羽尖拖曳著環繞戰場的銀白暴風眼環流",
        "dex_zh": "超載使霧翼信天翁成為南極洋流的化身，雙翼一振便能召來吞沒天際的海霧與超音速信風。",
        "dex_en": "In overload, Mistalbatross embodies the southern ocean gales, summoning blinding sea-mist and supersonic trade winds.",
        "signature_move": {
            "move_id": "wind_tempest_astrolabe",
            "name_zh": "星盤極洋大暴風",
            "name_en": "Tempest Astrolabe",
            "element": "wind",
            "range_class": "long",
            "shape": "sweep",
            "movement": "none",
            "naming_note": "星盤定風，巨翼掀濤。",
            "desc_zh": "轉動胸前星盤氣流儀，喚起橫掃全場的超音速海霧颶風。",
            "desc_en": "Spins its aerial astrolabe to sweep the entire field with supersonic sea-mist gales.",
            "visual": "轉動胸前星盤氣流儀，喚起橫掃全場的超音速海霧颶風。"
        }
    },
    "line_thunder_redburrower": {
        "stage": "overload",
        "creature_id": "thunder_redburrower_overload",
        "habit": "dominant",
        "disposition": "狂雷奔湧、荒漠霸主",
        "name_zh": "戈壁赤電蟲",
        "name_en": "Khorkhoivolt",
        "naming_note": "四階段統一命名；高壓磁軌環徹底超頻。",
        "size_class": "XL",
        "height_length": "9.0 m",
        "weight": "5200 kg",
        "body_fat": "8%",
        "look": "赤紅砂龍蟲體節化作十二座懸浮超導磁軌環，口器噴湧熾白電漿弧光，周身砂礫因靜電懸浮成玻璃化晶環",
        "dex_zh": "超載的戈壁赤電蟲能將方圓數里的沙粒瞬間熔成閃電玻璃，脊背磁軌砲一擊足以貫穿山嶺。",
        "dex_en": "Overload turns Khorkhoivolt into a living particle railgun, fusing desert sands into fulgurite rings around twelve floating coils.",
        "signature_move": {
            "move_id": "thunder_fulgurite_hyperrail",
            "name_zh": "超導赤砂天雷砲",
            "name_en": "Fulgurite Hyperrail",
            "element": "thunder",
            "range_class": "long",
            "shape": "line",
            "movement": "none",
            "naming_note": "十二磁環超頻齊射。",
            "desc_zh": "十二座超導磁環同步充能，沿直線轟出將沙塵熔為晶柱的極限電漿雷砲。",
            "desc_en": "Fires an overcharged plasma rail-beam through twelve floating coils, vitrifying everything in its path.",
            "visual": "十二座超導磁環同步充能，沿直線轟出將沙塵熔為晶柱的極限電漿雷砲。"
        }
    },
    "line_light_foilprism": {
        "stage": "overload",
        "creature_id": "light_foilprism_overload",
        "habit": "dominant",
        "disposition": "純淨耀眼、萬光歸一",
        "name_zh": "金箔光環獸",
        "name_en": "Foilprism",
        "naming_note": "四階段統一命名；千重金箔展開為太陽迴旋陣。",
        "size_class": "XL",
        "height_length": "4.5 m",
        "weight": "420 kg",
        "body_fat": "4%",
        "look": "千片極薄金箔在空中組成對稱幾何星盤，中央原子核球綻放宛如微型恆星的純白輝光，萬道七彩稜鏡射線交織成光之聖殿",
        "dex_zh": "超載將金箔光環獸的散射效率推向極限，任何接觸其金箔光陣的能量都會被分解為無數道致盲極光。",
        "dex_en": "Overload expands Foilprism into a stellar geometric mandala of gold-foil mirrors, refracting incoming energy into blinding aurora rays.",
        "signature_move": {
            "move_id": "light_stellar_cyclotron",
            "name_zh": "恆星金箔大迴旋",
            "name_en": "Stellar Cyclotron",
            "element": "light",
            "range_class": "long",
            "shape": "area",
            "movement": "none",
            "naming_note": "千箔散射，極光漫天。",
            "desc_zh": "展開幾何金箔星盤高速迴旋，向全場折射出覆蓋天地的七彩高能粒子光雨。",
            "desc_en": "Spins a vast mandala of gold-foil mirrors to rain refracted high-energy aurora beams across the arena.",
            "visual": "展開幾何金箔星盤高速迴旋，向全場折射出覆蓋天地的七彩高能粒子光雨。"
        }
    },
    "line_shadow_ironsteed": {
        "stage": "overload",
        "creature_id": "shadow_ironsteed_overload",
        "habit": "dominant",
        "disposition": "永夜鐵騎、孤高無雙",
        "name_zh": "玄鐵幽駒",
        "name_en": "Bootursteed",
        "naming_note": "四階段統一命名；永夜玄鐵重騎降臨。",
        "size_class": "XL",
        "height_length": "5.5 m",
        "weight": "3900 kg",
        "body_fat": "10%",
        "look": "啞光玄鐵戰甲與極夜暗影徹底融合，馬首生出雙重寒鐵戰角，身後展開如極夜極光般的墨黑影翼，四蹄踏過之處凝結黑霜",
        "dex_zh": "超載的玄鐵幽駒如北亞史詩中踏破冥界的神駒，化作無聲黑鐵疾風貫穿戰場，將一切光芒吞入永夜。",
        "dex_en": "In overload, Bootursteed becomes the mythic iron steed of the northern epics, galloping on black frost with shadowy wings.",
        "signature_move": {
            "move_id": "shadow_eternal_night_stampede",
            "name_zh": "永夜玄鐵奔騰斬",
            "name_en": "Eternal Night Stampede",
            "element": "shadow",
            "range_class": "long",
            "shape": "line",
            "movement": "forward",
            "naming_note": "冥界鐵騎，踏破永夜。",
            "desc_zh": "展開墨黑影翼率領無數幽影殘像沿直線奔騰衝鋒，斬裂並吞沒沿途光影。",
            "desc_en": "Charges forward with shadowy wings and phantom afterimages, cleaving through the entire battlefield.",
            "visual": "展開墨黑影翼率領無數幽影殘像沿直線奔騰衝鋒，斬裂並吞沒沿途光影。"
        }
    }
}

# 15 Drive 既定宙獸系列（creatures/01_portraits & 02_3d/ai_blender）— 補齊成果審查台統一介面所需完整文字與四階設定
DRIVE_CREATURES = [
    {
        "line_id": "cr_aqua_slime", "code_zh": "水", "element": "water", "title_zh": "靈澤凝膠史萊姆",
        "name_en": "Aquagel Slime", "palette": ["靈澤碧藍", "半透明水白", "珍珠泡沫銀"],
        "bases": ["半透明凝膠軟體", "深潭水紋核心", "浮動氣泡護膜"],
        "base_parents": ["幻想生物·史萊姆", "自然·泉水/潭澤"],
        "timeline": "遠古自然精靈（星海湖澤傳說）", "region": "大洋洲·珊瑚環礁",
        "archetype": "arch_spring_nymph", "archetype_name": "靈澤泉精", "archetype_meaning": "凝聚清澈泉水與浮動氣泡、隨環境形態流動的潔淨水靈",
        "role": "控場 / 緩衝", "disposition": "溫順好奇、喜歡貼近水邊", "habit": "vigilant",
        "trait": ("trait_aqua_gel_buffer", "凝膠緩衝", "半流質水體能吸收鈍擊衝力，並緩慢平復自身表面裂紋。"),
        "stages": [
            ("juvenile", "XS", "0.35 m", "1.2 kg", "5%", "圓潤透亮的水藍色凝膠球體，頂端冒出兩顆小氣泡與呆萌水滴眼，體內懸浮微弱藍光核", "剛從靈澤泉眼凝結出的水滴史萊姆，受驚時會把自己縮成彈跳水球。", "A translucent aqua slime droplet newly condensed from sacred spring water.", "water_bubble_pop", "泡沫彈擊", "Bubble Pop", "close", "single", "鼓起氣泡向前彈射微涼水球。"),
            ("adolescent", "S", "0.85 m", "18 kg", "5%", "身軀延展成流線水母傘蓋狀，周圍環繞三條半透明水帶觸手，核心折射出波紋光暈", "學會利用水流張力塑形，能將多餘水分壓縮為彈性水環防禦。", "Learns to shape currents into resilient water rings around its translucent core.", "water_ripple_whip", "水紋鞭擊", "Ripple Whip", "mid", "line", "甩出凝膠水帶向前抽擊並留下水漬。"),
            ("adult", "M", "1.65 m", "95 kg", "5%", "半人形與巨型水母交融的優雅凝膠體，肩披透明水膜披肩，胸口浮現多層波紋水環", "能自由操控方圓數丈的淡水凝結為護盾與高壓水刃，守護棲息水域。", "Commands freshwater currents to form barriers and pressurized blades.", "water_hydro_surge", "靈澤湧潮", "Hydro Surge", "mid", "sweep", "展開半透明水膜向四周湧出高壓淨水浪潮。"),
            ("overload", "XL", "4.2 m", "1450 kg", "4%", "巨大結晶水冠在頭頂展開，全身化作深海琉璃漩渦巨像，周身懸浮數十顆高壓水球陣列", "超載時全身轉化為高純度結晶水渦，能瞬間撫平烈焰並重塑河道地形。", "Transforms into a crystalline hydro-maelstrom colossus in overload.", "water_abyssal_deluge", "蒼穹靈澤洪流", "Abyssal Deluge", "long", "area", "引爆全部懸浮水球降下覆蓋全場的靈澤暴雨。")
        ]
    },
    {
        "line_id": "cr_chrono_beetle", "code_zh": "金", "element": "metal", "title_zh": "懷錶犀角金龜",
        "name_en": "Chronobeetle", "palette": ["黃銅金", "琺瑯白", "發條深棕"],
        "bases": ["重裝犀角甲蟲", "精密懷錶錶盤", "黃銅齒輪翼鞘"],
        "base_parents": ["生物·節肢昆蟲", "器械·鐘錶/計時儀器"],
        "timeline": "近代工藝想像（19 世紀精密製錶）", "region": "歐洲·阿爾卑斯鐘錶谷",
        "archetype": "arch_pocket_chronometer", "archetype_name": "航海懷錶機關", "archetype_meaning": "將精密擺輪與羅馬數字錶盤嵌於鞘翅之中的發條金龜",
        "role": "前排重裝 / 反擊", "disposition": "守時執著、分秒必爭", "habit": "territorial",
        "trait": ("trait_chrono_gear_lock", "發條鎖定", "每次承受撞擊都會替體內主發條上弦，強化下一次突擊力道。"),
        "stages": [
            ("juvenile", "XS", "0.38 m", "4.5 kg", "6%", "背甲像一只小巧圓潤的黃銅懷錶，頭頂長出短短單齒角，走動時發出輕快滴答聲", "幼體每天固定在整點甦醒覓食，背殼上的小指針會隨體力擺動。", "A pocket-watch sized bronze beetle whose tiny dorsal hands tick with its heartbeat.", "metal_tick_butt", "滴答角撞", "Tick Butt", "close", "single", "壓低黃銅短角順著發條節奏向前頂撞。"),
            ("adolescent", "M", "1.15 m", "68 kg", "6%", "鞘翅裂開露出雙層齒輪擺輪，前足包覆黃銅護腕，額角分叉為游標卡尺般的雙刃", "開始能精準預判對手動作節拍，在交鋒瞬間卡住敵方兵器。", "Times its parries to the millisecond using exposed brass escapement gears.", "metal_gear_cleave", "齒輪剪擊", "Gear Cleave", "close", "sweep", "展開雙叉卡尺角夾擊並高速旋轉齒輪斬落。"),
            ("adult", "L", "2.10 m", "340 kg", "5%", "雄偉的雙角犀金龜戰甲，胸前嵌著發光琺瑯羅馬錶盤，展開鞘翅時露出高速旋轉的陀飛輪核心", "每當陀飛輪全速運轉，其衝鋒幾乎無視風阻與時間差，穩如鋼鐵堡壘。", "Unleashes unstoppable momentum once its chest tourbillon reaches peak RPM.", "metal_chronos_ram", "時輪破甲衝", "Chronos Ram", "mid", "line", "鎖定整點節拍將雙角化作高壓撞角沿直線衝撞。"),
            ("overload", "XL", "4.8 m", "3200 kg", "4%", "背甲化作三層懸浮天文鐘環，黃金齒輪翼片噴射金色以太蒸汽，額角延伸為巨型時針長戟", "超載使時間齒輪超越極限，揮角之間連空氣振動彷彿都陷入短暫凝滯。", "Overdrives its astrolabe wing-rings, turning its horn into a colossal clock-hand lance.", "metal_grand_horology", "大天文鐘絕響", "Grand Horology", "long", "area", "展開三層天文鐘環敲響震碎戰場的金屬時鐘震波。")
        ]
    },
    {
        "line_id": "cr_earth_golem", "code_zh": "土", "element": "earth", "title_zh": "陶泥厚岩偶",
        "name_en": "Terragolem", "palette": ["陶土赭紅", "花崗岩灰", "苔蘚綠"],
        "bases": ["素燒陶土偶", "厚實花崗岩塊", "嵌石古文符印"],
        "base_parents": ["物質·陶器/黏土", "自然·岩石/礦脈"],
        "timeline": "遠古工藝（新石器彩陶文明）", "region": "東亞·黃土高原",
        "archetype": "arch_terracotta_guardian", "archetype_name": "古窯陶岩護衛", "archetype_meaning": "以千年窯火燒製的陶土與地脈厚岩凝結而成的忠誠守護偶",
        "role": "重裝坦衛", "disposition": "鈍重忠厚、一步一印", "habit": "territorial",
        "trait": ("trait_terra_kiln_shell", "古窯厚甲", "乾燥堅硬的陶岩外殼能大幅減免物理撞擊與火焰燒灼。"),
        "stages": [
            ("juvenile", "S", "0.50 m", "22 kg", "4%", "圓墩墩的紅陶小泥偶，頭頂嵌著一塊發芽的鵝卵石，雙手是鈍實的陶土小拳", "剛從古窯餘溫中甦醒的陶偶，最喜歡把自己埋進濕潤泥土裡曬太陽。", "A chubby terracotta sprite topped with a mossy pebble, fond of basking in warm clay.", "earth_clay_bump", "陶拳重敲", "Clay Bump", "close", "single", "邁開短腿以厚實陶拳向前捶擊。"),
            ("adolescent", "M", "1.35 m", "195 kg", "4%", "肩部與雙臂披上層疊花崗岩塊，胸口刻出螺旋彩陶紋，眼神沉穩閃爍琥珀光", "岩石與陶土融合得更加緊密，即使碎裂也能透過泥漿重新黏合。", "Layered granite plates armor its shoulders, mending cracks with wet clay.", "earth_boulder_slam", "厚岩震地", "Boulder Slam", "close", "area", "高舉岩石雙臂重砸地面掀起環狀碎石波。"),
            ("adult", "L", "2.40 m", "780 kg", "3%", "巍峨如城牆般的古窯巨偶，背部背負兩座苔蘚石碑，雙拳大如磨盤且嵌滿黑曜石碎塊", "立於陣前便如不動山嶽，曾有記載單隻陶泥厚岩偶獨自擋下山洪改道。", "Stands like an immovable mountain wall with moss-covered monoliths on its back.", "earth_monolith_crush", "石碑壓頂", "Monolith Crush", "mid", "line", "踏碎地脈向前突進，雙拳如磨盤般合擊敵陣。"),
            ("overload", "XL", "5.5 m", "6200 kg", "2%", "全身陶甲龜裂並透出地心赤金岩漿脈絡，頭頂升起浮空石環與古窯聖火炬", "超載喚醒地核窯火，每一步都在戰場上留下隆起的玄武岩柱。", "Overload awakens kiln-magma beneath its cracked plates, raising basalt pillars.", "earth_kiln_cataclysm", "地核古窯崩落", "Kiln Cataclysm", "long", "area", "喚起無數燒紅巨岩從天而降鎮壓全場。")
        ]
    },
    {
        "line_id": "cr_fire_wisp", "code_zh": "火", "element": "fire", "title_zh": "熾焰火灶靈",
        "name_en": "Hearthwisp", "palette": ["爐火橘紅", "木炭黑", "暖金白"],
        "bases": ["浮動火焰精靈", "鑄鐵火灶燈籠", "赤紅炭火核"],
        "base_parents": ["自然·火焰/炭火", "器械·火灶/提燈"],
        "timeline": "古代生活想像（傳統鍛鐵火爐）", "region": "東亞·山村鐵匠坊",
        "archetype": "arch_kamado_spirit", "archetype_name": "火灶爐魂", "archetype_meaning": "誕生於永不熄滅的鐵匠火灶之中、兼具溫暖與爆裂火勢的精靈",
        "role": "遠距火力", "disposition": "活潑躁動、愛吃木炭", "habit": "tolerant",
        "trait": ("trait_hearth_ember_feed", "添炭升溫", "在場上停留時間越久，體內爐火溫度越高，火屬性招式威力隨之攀升。"),
        "stages": [
            ("juvenile", "XS", "0.32 m", "0.6 kg", "2%", "一團裹著小鑄鐵火盆底座的橘紅火苗精靈，頭頂冒著兩撮跳動火星小角", "喜歡蹲在營火旁幫忙點火，高興時會噴出噼啪作響的小火花。", "A cheerful flame sprite nested in a tiny cast-iron brazier, popping happy sparks.", "fire_ember_puff", "炭火噗吐", "Ember Puff", "mid", "single", "鼓起臉頰朝前方吐出一串跳動火星。"),
            ("adolescent", "S", "0.95 m", "14 kg", "2%", "鑄鐵燈籠外框包覆火靈核心，雙臂化作可伸縮的火鉗與火舌披風", "開始學會控制燃燒溫度，能把散亂火星聚成高溫火球投擲。", "Enclosed in a wrought-iron lantern frame, focusing wild sparks into tight fireballs.", "fire_brazier_flare", "火灶爆燃", "Brazier Flare", "mid", "sweep", "打開鑄鐵爐門向扇形前方噴湧炙熱火浪。"),
            ("adult", "M", "1.75 m", "88 kg", "2%", "優雅懸浮的赤紅鍛爐精靈，身披六片浮動鑄鐵護片與白熾火焰羽翼", "體內爐溫足以熔化精鋼，是冒險隊伍在極寒雪原中最可靠的移動暖爐。", "A radiant forge-spirit with six floating iron plates and white-hot flame wings.", "fire_furnace_lance", "熔爐貫焰", "Furnace Lance", "long", "line", "將鍛爐烈焰壓縮為細長白熾火槍沿直線貫射。"),
            ("overload", "XL", "4.3 m", "920 kg", "1%", "化為三層懸浮鐵鑄天燈巨像，中央白金太陽爐火燃起沖天烈焰冠冕", "超載讓火灶靈成為照亮黑夜的太陽鍛爐，方圓百步冰雪瞬間氣化。", "Becomes a towering triple-tiered iron sky-lantern blazing with white-gold solar fire.", "fire_supernova_hearth", "天灶焚星烈焰", "Supernova Hearth", "long", "area", "釋放太陽鍛爐般的環形火海吞沒整片戰場。")
        ]
    },
    {
        "line_id": "cr_frostblade_penguin", "code_zh": "冰", "element": "ice", "title_zh": "冰刀企鵝",
        "name_en": "Frostblade", "palette": ["冰刃青藍", "深海藏青", "雪白"],
        "bases": ["極地企鵝", "雙足競速冰刀", "半透明冰晶翼刃"],
        "base_parents": ["生物·鳥類", "裝備·冰刀/競技護具"],
        "timeline": "現代運動想像（極地競速滑冰）", "region": "極地·南極冰棚",
        "archetype": "arch_speed_skater", "archetype_name": "極速冰刃手", "archetype_meaning": "足踏天然冰刀、在冰原上以高速彎道斬擊聞名的企鵝劍士",
        "role": "高速突擊", "disposition": "好勝敏捷、講究身法", "habit": "aggressive",
        "trait": ("trait_ice_blade_momentum", "冰面加速", "連續直線衝刺時移動速度遞增，滑行軌跡會短暫凝結滑溜冰面。"),
        "stages": [
            ("juvenile", "XS", "0.42 m", "3.8 kg", "14%", "圓滾滾的灰白絨毛小企鵝，雙腳踩著一對小巧透藍冰刀片，平衡感還在練習", "常在冰面上滑倒又立刻爬起來繼續衝，翼尖已經能凝出細小冰稜。", "A fluffy penguin chick on tiny translucent ice skates, always eager to race.", "ice_skate_dash", "冰刀滑撞", "Skate Dash", "close", "line", "俯低身子踏著冰刀沿直線快速滑撞。"),
            ("adolescent", "M", "1.15 m", "38 kg", "12%", "換上流線黑白防風羽衣，雙翼邊緣長出半透明鋸齒冰刃，足下冰刀帶有護踝冰甲", "能在冰面上急轉甩尾，用雙翼冰刃斬斷堅硬浮冰。", "Sleek plumage and serrated wing-blades let it carve tight turns across pack ice.", "ice_cross_slash", "雙翼冰斬", "Cross Slash", "close", "sweep", "貼近敵身高速旋轉並以雙翼冰刃交叉揮斬。"),
            ("adult", "L", "1.85 m", "92 kg", "10%", "身姿挺拔的極速冰刃戰士，頭頂豎起兩道結晶冰冠，雙翼化作修長水晶軍刀", "滑行速度快到只剩殘影，冰刀劃過處立刻綻開銳利冰錐。", "A poised ice-blade duelist whose crystal sabers leave frost-spires in its wake.", "ice_glacial_lunge", "極速冰鋒突", "Glacial Lunge", "mid", "line", "俯衝加速化作藍白極光箭矢貫穿敵陣。"),
            ("overload", "XL", "4.0 m", "780 kg", "8%", "雙翼展開為六枚浮空結晶巨刃，足下冰刀噴射極寒噴流，全身覆蓋流線冰晶競速裝甲", "超載使冰刀企鵝突破音障，每一次急轉都在戰場上掀起雪暴刀陣。", "Breaks the sound barrier on frost jets, trailing six floating crystal greatswords.", "ice_zero_tempest_rink", "絕對零度冰舞陣", "Zero Tempest Rink", "long", "area", "以極速繞行戰場畫出巨大冰環並引爆全場冰刃風暴。")
        ]
    },
    {
        "line_id": "cr_ice_snowman", "code_zh": "冰", "element": "ice", "title_zh": "霜魄冰晶雪人",
        "name_en": "Frostsoul", "palette": ["純淨雪白", "冰晶藍", "圍巾赤紅"],
        "bases": ["雪球疊層身軀", "六角冰晶核心", "編織紅圍巾"],
        "base_parents": ["自然·積雪/冰晶", "器物·冬日雪人"],
        "timeline": "近代民間冬日傳說（北歐雪夜）", "region": "歐洲·北歐雪原",
        "archetype": "arch_winter_snowman", "archetype_name": "冬夜霜魄雪人", "archetype_meaning": "凝聚初雪與極夜霜魄誕生的雪人精靈，越冷越精神奕奕",
        "role": "範圍控場", "disposition": "樂天溫厚、怕熱怕曬", "habit": "tolerant",
        "trait": ("trait_frost_snowpack", "積雪再生", "在寒冷環境或冰屬性招式影響下能不斷吸附雪花修補自身體積。"),
        "stages": [
            ("juvenile", "XS", "0.45 m", "6 kg", "10%", "兩顆雪球疊成的迷你雪人，圍著一條過長的紅毛線圍巾，鼻頭是一小顆冰晶", "冬天清晨最先醒來的小雪人，喜歡用圓滾滾的雪球丟夥伴玩。", "A two-sphere snowling wearing an oversized red scarf and a crystal nose.", "ice_snowball_toss", "雪球拋擊", "Snowball Toss", "mid", "single", "雙手搓出圓滾滾的實心雪球擲向目標。"),
            ("adolescent", "M", "1.30 m", "85 kg", "10%", "三層雪軀外覆上剔透冰晶肩甲，雙手能凝結實心冰錘與雪暴披風", "學會召喚局地飄雪替隊友降溫，揮動冰錘能擊飛靠近的威脅。", "Three-tiered snow body armored with crystal pauldrons and solid ice mallets.", "ice_frost_hammer", "霜晶雪錘", "Frost Hammer", "close", "sweep", "揮舞雙手凝結的巨大雪錘橫掃前方敵群。"),
            ("adult", "L", "2.30 m", "460 kg", "9%", "威嚴的北歐霜晶巨雪人，胸口露出發光的六角冰晶心臟，肩披飄飛冰霜長袍", "暴風雪中宛如冬之精靈王，隨手一揮便能築起厚實冰牆抵擋攻勢。", "A majestic frost-spirit whose glowing hexagonal ice-heart commands blizzards.", "ice_blizzard_veil", "極夜暴雪幕", "Blizzard Veil", "long", "area", "自胸口冰晶核心向全場釋放夾帶冰雹的狂暴雪幕。"),
            ("overload", "XL", "5.4 m", "4800 kg", "8%", "身軀化作移動雪山城堡，六角冰晶核心化作巨大星芒光環懸浮於背後", "超載讓周圍大氣瞬間凝結成萬年雪原，連陽光都只能透過冰晶折射。", "Becomes a walking glacial citadel crowned by a massive six-pointed frost halo.", "ice_eternal_snowfall", "永冬霜魄降臨", "Eternal Snowfall", "long", "area", "召喚覆蓋天際的極寒暴雪徹底冰封整片戰場。")
        ]
    },
    {
        "line_id": "cr_ink_stele", "code_zh": "影", "element": "shadow", "title_zh": "墨影碑帖",
        "name_en": "Inkstele", "palette": ["松煙墨黑", "宣紙素白", "硃砂印紅"],
        "bases": ["浮空石碑帖", "流動松煙墨跡", "硃砂印章核"],
        "base_parents": ["器物·碑帖/書法", "自然·墨煙/陰影"],
        "timeline": "古代文化想像（唐宋書法碑林）", "region": "東亞·江南書院",
        "archetype": "arch_calligraphy_stele", "archetype_name": "墨林碑魂", "archetype_meaning": "吸納千年書法筆意與松煙墨韻而甦醒的無形碑帖之靈",
        "role": "法術干擾", "disposition": "沉靜孤高、惜墨如金", "habit": "vigilant",
        "trait": ("trait_ink_wash_veil", "墨韻暈染", "攻擊會在目標身上留下墨跡標記，降低其下次攻擊的命中精準度。"),
        "stages": [
            ("juvenile", "XS", "0.40 m", "5 kg", "0%", "一塊巴掌大的浮空青石小碑，表面閃著未乾墨跡，周圍飄著兩條小墨魚", "安靜懸浮在書案旁吸收筆氣，受驚時會潑出墨點掩護自己逃走。", "A floating palm-sized stone tablet trailing wet ink ribbons and tiny ink-fish.", "shadow_ink_blot", "飛墨點染", "Ink Blot", "mid", "single", "碑面筆劃閃動，彈出一道高速墨點射向敵人。"),
            ("adolescent", "M", "1.35 m", "72 kg", "0%", "修長青石碑身裂成三段浮空拼接，硃砂印章懸於頂端，周圍飛舞流動書法墨帶", "碑文筆意化為實體墨劍與鎖鏈，能從陰影中束縛對手行動。", "Three-piece floating stele crowned by a vermilion seal, weaving ink-ribbon chains.", "shadow_brush_bind", "狂草墨鎖", "Brush Bind", "mid", "sweep", "揮動飛舞的狂草墨帶橫掃並遲滯前方敵人。"),
            ("adult", "L", "2.45 m", "310 kg", "0%", "古雅巍峨的墨影巨碑，碑面刻滿發光銀白篆書，雙側浮現如龍蛇盤繞的立體水墨巨筆", "大筆一揮便能將立體水墨化為實體異獸與黑霧，令敵人迷失於潑墨畫境。", "An ancient monolith inscribed with glowing script, flanked by living sumi-e dragons.", "shadow_calligraphy_slash", "鐵畫銀鉤斬", "Calligraphy Slash", "long", "line", "引動巨型水墨筆鋒沿直線劈出破空墨斬。"),
            ("overload", "XL", "5.2 m", "2600 kg", "0%", "化為環繞九座浮空斷碑的墨海硯台陣，中央升起巨大的硃砂天印與遮天水墨山河圖", "超載展開整幅水墨山河領域，戰場瞬間化為黑白分明的書法畫卷。", "Surrounded by nine floating steles and a colossal vermilion seal, unfolding an ink-wash domain.", "shadow_ink_cosmos", "潑墨山河印", "Ink Cosmos", "long", "area", "落下巨大硃砂天印，以吞天水墨洪流洗刷全場。")
        ]
    },
    {
        "line_id": "cr_light_khepri", "code_zh": "光", "element": "light", "title_zh": "阿頓曦光聖甲蟲",
        "name_en": "Kheprisun", "palette": ["日輪聖金", "青金石藍", "象牙白"],
        "bases": ["黃金聖甲蟲", "太陽日輪球體", "青金石鑲嵌甲"],
        "base_parents": ["生物·節肢昆蟲", "幻想生物·古埃及太陽象徵"],
        "timeline": "遠古神話（尼羅河日出信仰）", "region": "非洲·尼羅河谷",
        "archetype": "arch_khepri_scarab", "archetype_name": "凱布利推日聖甲蟲", "archetype_meaning": "雙足推動黎明太陽金輪升起、象徵新生與永恆光輝的聖甲蟲",
        "role": "輔助 / 光砲", "disposition": "莊嚴虔誠、向光而行", "habit": "tolerant",
        "trait": ("trait_khepri_solar_orb", "推日蓄光", "每回合為前方日輪累積光能，釋放光屬性招式時附加額外淨化輝光。"),
        "stages": [
            ("juvenile", "XS", "0.36 m", "2.5 kg", "4%", "青金石藍小甲蟲推動著一顆發光的微型金珠，背甲閃耀柔和晨曦光暈", "每天黎明準時出現，認真地把小小太陽珠推上沙丘頂端。", "A lapis-blue scarab pup diligently rolling a miniature glowing golden sun-pearl.", "light_dawn_spark", "晨曦微光", "Dawn Spark", "mid", "single", "從日輪珠彈出一道聚光晨曦射線。"),
            ("adolescent", "M", "1.10 m", "55 kg", "4%", "黃金胸甲展開四片半透明薄翼，頭頂雙角托起一顆不斷旋轉的熾熱日輪", "已能將太陽珠舉至高空照射戰場，替隊友驅散黑暗與迷霧。", "Gold-plated thorax with four translucent wings cradling a spinning solar orb.", "light_scarab_ray", "聖甲日光線", "Scarab Ray", "long", "line", "令頭頂日輪聚光射出筆直的金色淨化光束。"),
            ("adult", "L", "2.05 m", "240 kg", "3%", "華麗的黃金與青金石雕花聖甲蟲，展開雙翼時背後浮現巨大太陽羽輪與光環法陣", "宛如清晨第一道破曉曙光，其推動的太陽日輪能輕易融化極夜寒冰。", "Ornate gold and lapis scarab whose unfurled wings reveal a radiant solar disk.", "light_helios_roll", "日輪巡天擊", "Helios Roll", "mid", "sweep", "將巨大熾熱日輪向前滾壓並散射金色光環。"),
            ("overload", "XL", "4.8 m", "2100 kg", "2%", "全身化作懸浮黃金太陽神舟形聖甲蟲，雙翼展開為十二道日冕光翼，托舉微型恆星", "超載點燃真正的微型太陽，方圓數里化作永晝領域，陰影無所遁形。", "Transforms into a solar-barque colossus with twelve coronal wings holding a miniature star.", "light_aten_zenith", "阿頓正午神輝", "Aten Zenith", "long", "area", "將托舉的太陽日輪升至天頂並釋放照耀全場的淨化光瀑。")
        ]
    },
    {
        "line_id": "cr_metal_vault", "code_zh": "金", "element": "metal", "title_zh": "模組折疊集裝機兵",
        "name_en": "Vaultmech", "palette": ["工業灰鐵", "警示琥珀黃", "裝甲軍綠"],
        "bases": ["摺疊集裝箱體", "液壓連桿機械臂", "裝甲防爆門盾"],
        "base_parents": ["科幻機械·重工模組", "器物·貨櫃/保險庫"],
        "timeline": "近未來工業（軌道貨運機甲）", "region": "東亞·近未來港灣都市",
        "archetype": "arch_modular_container", "archetype_name": "模組貨櫃機兵", "archetype_meaning": "待機時折疊成標準貨櫃方塊、接戰時瞬間展開武裝的工業守護機兵",
        "role": "變形重裝", "disposition": "嚴謹機械、執行指令", "habit": "territorial",
        "trait": ("trait_vault_armor_fold", "裝甲閉鎖", "切換防禦姿態時將肢體收進厚實貨櫃外殼內，大幅提升抗打擊能力。"),
        "stages": [
            ("juvenile", "XS", "0.45 m", "18 kg", "0%", "一只方方正正的迷你金屬工具箱，展開四隻小液壓腳與單眼琥珀感測燈", "平時安靜蹲在角落像個安全箱，一旦偵測到異常就會彈出機械小鉗。", "A compact metal tool-box bot that pops out hydraulic legs and an amber sensor eye.", "metal_clamp_snap", "液壓夾擊", "Clamp Snap", "close", "single", "彈出液壓機械鉗向前精準夾擊。"),
            ("adolescent", "M", "1.45 m", "260 kg", "0%", "標準小型貨櫃展開成雙足工業機兵，左臂為防爆門盾，右臂裝備伸縮撞錘", "能在兩秒內完成收納與戰鬥展開，是前線最可靠的機動掩體。", "Unfolds from a compact cargo pod into a bipedal mech armed with a blast-door shield.", "metal_piston_punch", "重錘推進拳", "Piston Punch", "close", "line", "啟動背後推進噴口配合液壓重拳直線突擊。"),
            ("adult", "L", "2.40 m", "980 kg", "0%", "厚重全武裝模組集裝機兵，雙肩搭載多聯裝裝甲艙蓋，胸前保險庫轉盤閃爍鎖定紅光", "全身裝甲皆可獨立彈射或組合成移動堡壘，防禦力堪比戰列艦主裝甲。", "A heavy modular vault-mech with multi-pod shoulder launchers and a rotating chest lock.", "metal_vault_barrage", "貨櫃模組齊射", "Vault Barrage", "mid", "sweep", "打開肩部與胸口裝甲艙蓋向前方傾瀉金屬彈幕。"),
            ("overload", "XL", "5.0 m", "8400 kg", "0%", "三個集裝機兵模組超載合體成移動鋼鐵要塞，雙臂化作巨型磁軌攻城錘與全覆式防爆壁", "超載啟動最高安全鎖定，將整座移動軍械庫的火力與裝甲同時釋放。", "Fuses triple container modules into a walking steel fortress with siege rail-hammers.", "metal_fortress_protocol", "最終保險庫協定", "Fortress Protocol", "long", "area", "展開全機裝甲艙並發射覆蓋全場的磁軌穿甲齊射。")
        ]
    },
    {
        "line_id": "cr_shadow_eye", "code_zh": "影", "element": "shadow", "title_zh": "幽影虛空瞳",
        "name_en": "Voideye", "palette": ["虛空黑紫", "星雲品紅", "幽冥銀"],
        "bases": ["浮空單眼魔核", "黑霧觸鬚斗篷", "破碎星環瞳孔"],
        "base_parents": ["幻想生物·虛空魔眼", "自然·星雲/黑洞"],
        "timeline": "遠古星界想像（深空觀測神話）", "region": "極地·永夜觀星台",
        "archetype": "arch_void_oculus", "archetype_name": "深空虛空之瞳", "archetype_meaning": "凝視星界裂隙而生的浮空單眼精靈，瞳孔深處映照著扭曲的星雲暗影",
        "role": "遠距干擾", "disposition": "沉默凝視、神出鬼沒", "habit": "vigilant",
        "trait": ("trait_void_gaze_lock", "虛空凝視", "被其瞳孔鎖定的敵人會感到空間錯位，移動與閃避反應變慢。"),
        "stages": [
            ("juvenile", "XS", "0.35 m", "1.0 kg", "0%", "一顆拳頭大的紫黑色小眼球，裹著一圈半透明黑煙小斗篷安靜飄浮", "好奇心極強卻非常害羞，被直視時會立刻躲進自己的影子裡。", "A fist-sized violet-black eye sprite wrapped in a wispy cloak of dark mist.", "shadow_gaze_ping", "幽瞳微刺", "Gaze Ping", "mid", "single", "瞳孔縮緊，朝目標射出一道細小黑紫視線光束。"),
            ("adolescent", "S", "0.95 m", "15 kg", "0%", "眼球周圍長出兩道破碎銀環與三條飄逸黑霧觸手，瞳仁呈現旋轉星雲狀", "開始能扭曲周圍光線製造殘像，讓敵人分不清真正的本體位置。", "Orbited by broken silver rings and dark-mist tendrils with a swirling nebula pupil.", "shadow_rift_beam", "裂隙凝視波", "Rift Beam", "long", "line", "旋轉銀環對焦後射出扭曲空間的紫黑光束。"),
            ("adult", "M", "1.80 m", "65 kg", "0%", "莊嚴詭譎的虛空魔眼，三道刻有星圖符文的銀環繞瞳旋轉，下方垂落如斗篷般的暗影觸鬚", "凝視之間便能撕開微型空間裂隙，將敵方的遠距攻擊吞入虛無。", "Three star-charted silver rings orbit its core above flowing shadow-mantle tendrils.", "shadow_abyss_stare", "深淵魔眼凝視", "Abyss Stare", "long", "sweep", "瞳孔全開向扇形區域釋放吞噬光線的暗影視界波。"),
            ("overload", "XL", "4.6 m", "1100 kg", "0%", "化為直徑數丈的星界黑洞巨瞳，七重破碎星環交錯旋轉，背後展開遮蔽星光的暗影羽翼", "超載開啟深空觀測視界，所見之處連空間座標都會產生短暫坍縮。", "Manifests as a colossal black-hole oculus framed by seven intersecting star-rings.", "shadow_event_horizon", "視界坍縮宣告", "Event Horizon", "long", "area", "張開星界黑洞巨瞳，在戰場中央引發吞噬萬物的暗影引力波。")
        ]
    },
    {
        "line_id": "cr_solmane_lion", "code_zh": "火", "element": "fire", "title_zh": "火鬃聖獅",
        "name_en": "Solmane", "palette": ["熾金紅", "象牙白", "太陽金"],
        "bases": ["草原雄獅", "燃燒太陽鬃毛", "黃金護肩爪甲"],
        "base_parents": ["生物·哺乳類", "自然·太陽光冕"],
        "timeline": "遠古神話（撒哈拉日輪王國）", "region": "非洲·熱帶草原",
        "archetype": "arch_solar_lion", "archetype_name": "日輪火鬃聖獅", "archetype_meaning": "頸繞永恆日冕火鬃、咆哮如正午太陽般威嚴的草原王獅",
        "role": "近戰強攻", "disposition": "光明磊落、王者氣度", "habit": "aggressive",
        "trait": ("trait_solmane_radiance", "日冕威壓", "熾熱鬃毛散發耀眼熱浪，使近身交鋒的敵人難以直視其動作。"),
        "stages": [
            ("juvenile", "S", "0.52 m", "12 kg", "12%", "奶白色小獅崽頸間冒出一圈蓬鬆橘紅小火毛，雙爪帶著淡淡金紋", "精力充沛愛晒太陽，打噴嚏時會從鼻尖冒出一小朵金色火苗。", "An ivory lion cub with a fluffy ring of orange-red flame-fur around its neck.", "fire_cub_pounce", "火爪撲擊", "Cub Pounce", "close", "single", "帶著橘紅火星向前躍起撲擊目標。"),
            ("adolescent", "M", "1.30 m", "95 kg", "11%", "修長健壯的少年獅王，火鬃如烈焰圍巾般向後飄揚，四肢套上鍛金護脛", "奔跑時身後拖出長長火尾，咆哮聲已帶著震懾群獸的威勢。", "Lithe adolescent lion trailing a sweeping flame-mane and gilded greaves.", "fire_mane_charge", "烈鬃突進", "Mane Charge", "mid", "line", "壓低獅首讓火鬃化作火球沿直線高速猛撞。"),
            ("adult", "L", "2.25 m", "280 kg", "10%", "威風凜凜的日輪聖獅，龐大鬃毛燃燒成太陽日冕狀雙環，額嵌黃金太陽徽記", "一聲獅吼足以引燃乾燥草原氣流，被視為太陽神殿最忠誠的守衛王獸。", "A regal lion crowned with twin coronal flame-rings and a golden solar crest.", "fire_solar_roar", "聖獅日冕吼", "Solar Roar", "mid", "sweep", "仰天咆哮噴出扇形太陽日冕火浪橫掃前方。"),
            ("overload", "XL", "5.0 m", "2900 kg", "8%", "全身披上黃金太陽神鎧，火鬃膨脹成三層旋轉熾白恆星光環，四爪踏火凌空", "超載化作行走的太陽化身，每一次揮爪都伴隨耀眼日珥噴發。", "Clad in golden solar armor with triple spinning stellar-corona rings around its mane.", "fire_coronal_sovereign", "太陽王權大日珥", "Coronal Sovereign", "long", "area", "躍至半空引爆三層日冕火環，降下熾金火雨焚盡全場。")
        ]
    },
    {
        "line_id": "cr_thunder_drone", "code_zh": "雷", "element": "thunder", "title_zh": "超導電容巡航無人機",
        "name_en": "Voltcraft", "palette": ["電漿青藍", "航空鈦白", "碳纖黑"],
        "bases": ["多旋翼巡航無人機", "超導電容環陣", "高壓電漿尾翼"],
        "base_parents": ["科幻機械·無人飛行載具", "器械·電容/線圈"],
        "timeline": "近未來科技（大氣層電離巡邏網）", "region": "美洲·高空觀測站",
        "archetype": "arch_capacitor_drone", "archetype_name": "超導巡航電翼", "archetype_meaning": "搭載環形超導電容與無葉片離子推進器的高空雷屬性無人機獸",
        "role": "高機動狙擊", "disposition": "冷靜精準、持續盤旋", "habit": "tolerant",
        "trait": ("trait_drone_superconduct", "超導迴路", "高速巡航時線圈持續累積靜電電荷，下次遠程雷擊射程與速度提升。"),
        "stages": [
            ("juvenile", "XS", "0.38 m", "2.2 kg", "0%", "圓盤狀白色小偵察機，兩側掛著迷你藍光電容筒，飛行時發出輕微電流嗡鳴", "總是在高處盤旋掃描環境，電力不足時會自己飛去避雷針充電。", "A compact white scout drone flanked by miniature blue capacitor pods.", "thunder_spark_ping", "脈衝微彈", "Spark Ping", "mid", "single", "從機首感測器射出一發精準藍色電漿彈。"),
            ("adolescent", "M", "1.15 m", "42 kg", "0%", "雙翼展開為前掠翼構型，中央嵌著發光超導環，機腹掛載雙聯電弧導軌", "能在暴風雨雲層中自如穿梭，利用雷雲靜電替自己瞬間滿電。", "Forward-swept wings and a central superconducting ring let it harvest storm clouds.", "thunder_arc_strafe", "電弧掃射", "Arc Strafe", "mid", "sweep", "低空高速掠過並向下方扇形區域傾瀉電弧。"),
            ("adult", "L", "2.10 m", "180 kg", "0%", "流線型隱形戰機級電容無人機，四具無葉片環形離子引擎噴吐藍紫電漿尾焰", "巡航速度超越音速，主電容蓄滿後能精準狙擊數里外的單一目標。", "Stealth-class cruiser drone powered by four bladeless plasma-ring thrusters.", "thunder_rail_snipe", "超導雷光狙擊", "Rail Snipe", "long", "line", "將四具環形電容電力匯聚機首，射出極速穿甲雷射電漿。"),
            ("overload", "XL", "4.8 m", "1650 kg", "0%", "展開為龐大戰略級空中電離航母，機翼延伸出六枚浮空磁軌浮游砲與電離護盾", "超載連結高空電離層，令戰場上空化為持續放電的電磁風暴區。", "Expands into an atmospheric carrier drone deploying six floating rail-bits.", "thunder_ionosphere_strike", "電離層軌道雷擊", "Ionosphere Strike", "long", "area", "導引六枚浮游砲從天際降下覆蓋全場的交叉雷網。")
        ]
    },
    {
        "line_id": "cr_verdant_aquila", "code_zh": "木", "element": "wood", "title_zh": "葉冠鷲",
        "name_en": "Verdaquila", "palette": ["森葉翠綠", "原木深棕", "金秋琥珀"],
        "bases": ["高空金雕/鷲", "層疊蕨葉羽翼", "橡木枝角冠冕"],
        "base_parents": ["生物·鳥類", "植物·蕨葉/橡木"],
        "timeline": "遠古森林神話（高原古林守護鳥）", "region": "美洲·安地斯雲霧林",
        "archetype": "arch_forest_aquila", "archetype_name": "森冠巨鷲", "archetype_meaning": "雙翼由層疊翠綠葉片織成、頭戴橡實枝角冠冕的高空木屬性猛禽",
        "role": "空中突襲", "disposition": "銳利警覺、守護林冠", "habit": "territorial",
        "trait": ("trait_aquila_leaf_glide", "林冠乘風", "從高處俯衝時葉羽自動張開減阻，命中後可迅速拉升脫離近戰。"),
        "stages": [
            ("juvenile", "XS", "0.40 m", "1.8 kg", "11%", "絨毛間夾雜著嫩綠新葉的小鷲雛，頭頂冒出兩片小小的三葉草羽冠", "最愛棲息在樹梢最高處觀察雲霧，振翅時會飄落清香葉粉。", "A downy eaglet sprouted with fresh green leaf-feathers and a clover crest.", "wood_leaf_flutter", "葉羽飛鏢", "Leaf Flutter", "mid", "single", "抖落翼間幾片硬化嫩葉化作飛鏢射向目標。"),
            ("adolescent", "M", "1.20 m", "26 kg", "10%", "雙翼換上堅韌深綠劍葉長羽，雙爪覆著老樹皮鱗甲，頭冠長出分叉小木角", "俯衝速度極快，葉片邊緣如鋸齒般鋒利，能輕易斬斷藤蔓與木樁。", "Broad sword-leaf pinions and bark-armored talons slice cleanly through thickets.", "wood_razor_dive", "翠羽俯衝斬", "Razor Dive", "mid", "line", "收攏葉翼自空中高速俯衝沿直線掠斬。"),
            ("adult", "L", "2.15 m", "78 kg", "9%", "氣勢非凡的森林霸主巨鷲，頭頂繁茂橡枝冠冕綻放金琥珀花蕾，尾羽如孔雀蕨扇展開", "翼展遮蔽林間日光，一振翅便能掀起夾帶萬千葉刃的森林綠風。", "Majestic forest sovereign crowned with blooming oak branches and fern-fan tail.", "wood_canopy_gale", "林冠葉刃風暴", "Canopy Gale", "long", "sweep", "高空振翅向下方扇形區域捲起無數銳利葉刃狂風。"),
            ("overload", "XL", "5.2 m", "980 kg", "7%", "全身羽翼化作百層發光翡翠世界樹枝葉，橡木王冠綻放金色聖花光環", "超載讓葉冠鷲成為移動的空中聖林，所過之處枯木逢春、萬葉化劍。", "Transforms into a luminous canopy colossus with hundred-layered emerald boughs.", "wood_worldtree_tempest", "世界樹翠羽天嵐", "Worldtree Tempest", "long", "area", "召喚遮天蔽日的翠綠葉劍風暴覆蓋整片戰場。")
        ]
    },
    {
        "line_id": "cr_wind_bird", "code_zh": "風", "element": "wind", "title_zh": "氣旋羽雲雀",
        "name_en": "Zephyrlark", "palette": ["天青藍", "雲絮白", "薄荷綠"],
        "bases": ["高速鳴禽雲雀", "雙層雲絮尾羽", "流線氣旋風環"],
        "base_parents": ["生物·鳥類", "自然·積雲/氣流"],
        "timeline": "遠古自然傳說（高原牧歌）", "region": "中亞·天山草原",
        "archetype": "arch_sky_lark", "archetype_name": "天嵐雲雀", "archetype_meaning": "歌聲能喚來晴朗順風、雙翼常伴隨雲絮氣旋翻飛的靈動飛鳥",
        "role": "輔助 / 高速遊擊", "disposition": "開朗愛唱、隨風翱翔", "habit": "tolerant",
        "trait": ("trait_lark_tailwind_song", "順風鳴囀", "啼鳴後能替周圍同伴帶來順風氣流，略微提升移動與出招流暢度。"),
        "stages": [
            ("juvenile", "XS", "0.28 m", "0.7 kg", "10%", "蓬鬆像一團白色雲朵的小雲雀，雙頰帶有天青色羽斑，尾羽捲成小氣旋", "喜歡乘著微風打轉玩耍，邊飛邊發出清脆悅耳的風鈴般叫聲。", "A puffball cloud-lark with sky-blue cheek tufts and a curled cyclone tail.", "wind_chirp_gust", "風鈴微風", "Chirp Gust", "mid", "single", "清脆啼鳴並扇出一道輕快氣流彈擊退敵人。"),
            ("adolescent", "S", "0.85 m", "11 kg", "9%", "翼羽拉長為流線燕尾型，頸間圍著一圈漂浮的半透明雲霧環", "能在強風中懸停不動並靈活翻滾，用氣旋尾羽捲起小型塵捲風。", "Swallow-tailed flyer wearing a floating mist collar, able to hover in gales.", "wind_vortex_loop", "氣旋迴旋斬", "Vortex Loop", "mid", "line", "包裹在旋轉氣流中沿弧線高速撞擊並拉升。"),
            ("adult", "M", "1.65 m", "45 kg", "8%", "優雅的天空舞者，雙翼拖曳著兩條長長的薄荷綠風帶與雲絮羽尾", "歌聲響徹雲霄時能驅散陰霾烏雲，替隊伍引導出最順暢的高空航道。", "An aerial dancer trailing twin mint-green wind ribbons and billowing cloud-plumes.", "wind_skyward_sonata", "天嵐鳴囀波", "Skyward Sonata", "long", "sweep", "高鳴一曲同時振翅釋放橫掃前方的聲波氣旋。"),
            ("overload", "XL", "4.2 m", "680 kg", "6%", "幻化為拖曳百尺白雲與極光風帶的蒼穹鳳雀，背後懸浮三道高速旋轉氣旋風環", "超載使氣旋羽雲雀化作整片晴空順風的化身，振翼間便能吹散一切迷霧。", "Ascends into a celestial skylark trailing aurora wind-ribbons and triple cyclone rings.", "wind_stratosphere_chorus", "九霄晴嵐大合唱", "Stratosphere Chorus", "long", "area", "展開三道氣旋風環向全場捲起清澈猛烈的上升颶風。")
        ]
    },
    {
        "line_id": "cr_wood_puppet", "code_zh": "木", "element": "wood", "title_zh": "機巧靈木偶",
        "name_en": "Woodpuppet", "palette": ["胡桃木棕", "翡翠絲線", "象牙白"],
        "bases": ["球體關節木偶", "懸絲木十字架", "發芽原木機關"],
        "base_parents": ["器物·懸絲木偶", "植物·靈木/嫩芽"],
        "timeline": "近代劇場工藝（18 世紀歐洲木偶戲）", "region": "歐洲·波希米亞木偶工坊",
        "archetype": "arch_living_marionette", "archetype_name": "靈木懸絲偶", "archetype_meaning": "因工匠傾注心血而長出嫩芽、自行剪斷控制線卻仍保留十字翼架的活木偶",
        "role": "技巧 / 控場", "disposition": "戲劇化、優雅敬禮", "habit": "tolerant",
        "trait": ("trait_puppet_jade_threads", "翡翠絲線", "能將無形木靈絲線附著於目標關節，短暫牽制其出招角度。"),
        "stages": [
            ("juvenile", "XS", "0.42 m", "3.0 kg", "0%", "雕工精細的小核桃木人偶，關節以翡翠木珠連接，頭頂冒出一片小嫩葉", "總是一本正經地向人鞠躬行禮，走起路來關節會發出清脆木響。", "A finely carved walnut marionette with jade bead joints and a tiny head-sprout.", "wood_thread_flick", "木絲彈指", "Thread Flick", "mid", "single", "指尖彈出翠綠靈絲輕巧抽擊敵方手腳。"),
            ("adolescent", "M", "1.25 m", "34 kg", "0%", "身手敏捷的劇場木偶劍士，背後懸浮著木製十字線架，十指拖曳發光翡翠絲線", "不需要操偶師也能隨心舞動，能用靈絲操縱樹枝與石塊協助戰鬥。", "An agile marionette duelist with a floating wooden control-cross and glowing jade strings.", "wood_marionette_snare", "懸絲木舞陣", "Marionette Snare", "mid", "sweep", "揮動十字線架灑出交錯翡翠絲線牽制前方。"),
            ("adult", "L", "2.00 m", "110 kg", "0%", "華麗的古木舞台騎士，披著鑲邊劇服斗篷，背後十字線架化作雙翼木骨滑翔機", "結合木偶機關與靈木魔法，戰鬥時宛如在舞台上演出一場完美劍舞。", "A theatrical wooden knight whose control-cross unfolds into articulated wing-frames.", "wood_puppet_finale", "靈木謝幕斬", "Puppet Finale", "mid", "line", "藉背後靈絲彈射加速，沿直線揮出木劍連斬。"),
            ("overload", "XL", "4.6 m", "1200 kg", "0%", "化為三層劇院懸絲巨像，背後展開巨大古樹十字架並垂落數十道翡翠光絲操控戰局", "超載將整片戰場變成自己的劇場舞台，萬千木靈絲線隨指尖起舞。", "Expands into a towering theater-colossus beneath a great ancient-tree control cross.", "wood_grand_marionette", "森羅傀儡大劇院", "Grand Marionette", "long", "area", "拉動萬千翡翠光絲令全場木藤與機關同步絞殺敵陣。")
        ]
    }
]


def build_drive_creature_item(spec: dict) -> dict:
    line_id = spec["line_id"]
    trait_id, trait_zh, trait_desc = spec["trait"]
    locked_stages = []
    stage_dims = {}
    for stg, sz, hl, wt, bf, look, dex_zh, dex_en, mv_id, mv_zh, mv_en, rng, shp, mv_desc in spec["stages"]:
        stage_dims[stg] = {"height_length": hl, "weight": wt, "body_fat": bf}
        locked_stages.append({
            "stage": stg,
            "creature_id": f"{line_id}_{stg}",
            "name_zh": spec["title_zh"],
            "name_en": spec["name_en"],
            "naming_note": f"四階段統一命名；{spec['archetype_name']}。",
            "size_class": sz,
            "habit": "dominant" if stg == "overload" else spec["habit"],
            "height_length": hl,
            "weight": wt,
            "body_fat": bf,
            "look": look,
            "dex_zh": dex_zh,
            "dex_en": dex_en,
            "signature_move": {
                "move_id": mv_id,
                "name_zh": mv_zh,
                "name_en": mv_en,
                "element": spec["element"],
                "range_class": rng,
                "shape": shp,
                "movement": "forward" if shp == "line" else "none",
                "naming_note": f"{spec['title_zh']} {stg} 專屬招式。",
                "desc_zh": mv_desc,
                "desc_en": f"{spec['name_en']} unleashes {mv_en}.",
                "visual": mv_desc,
            },
        })
    ov = locked_stages[-1]
    elem_zh = {"metal": "金", "wood": "木", "water": "水", "fire": "火", "earth": "土", "ice": "冰", "wind": "風", "thunder": "雷", "light": "光", "shadow": "影"}.get(spec["element"], spec["code_zh"])
    elements = [f"{spec['element']}（{elem_zh}）"]
    return {
        "line_id": line_id,
        "code_zh": spec["code_zh"],
        "element": spec["element"],
        "title_zh": spec["title_zh"],
        "source": "Drive (creatures/ · 已完成 2D/3D 交付)",
        "concept": {
            "line_id": line_id,
            "elements": elements,
            "element_palettes": spec["palette"],
            "base_parents": spec["base_parents"],
            "bases": spec["bases"],
            "appearance_palette": spec["palette"],
            "timeline": spec["timeline"],
            "region": spec["region"],
            "archetype": spec["archetype"],
            "archetype_name": spec["archetype_name"],
            "archetype_type": "Drive 實作宙獸系列",
            "meaning": spec["archetype_meaning"],
            "motifs": "、".join(spec["bases"]),
            "sensitivity": "ok",
            "role": spec["role"],
            "habit": spec["habit"],
            "disposition": spec["disposition"],
            "size_profile": "→".join(s["size_class"] for s in locked_stages),
            "stage_dims": stage_dims,
            **stage_dims["adult"],
            "formula": " + ".join(elements) + " × " + " + ".join(spec["bases"]) + " × " + spec["archetype_name"],
            "locked": {
                "status": "已設計（Drive 實作宙獸；四階與文字資料補齊）",
                "stages": locked_stages,
                "trait": {"trait_id": trait_id, "name_zh": trait_zh, "idea_zh": trait_desc},
                "overload": f"{ov['name_zh']}（{ov['creature_id']} · XL）：{ov['look']}",
            },
        },
    }


def load_all_kind(repo: Path, kind: str) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for p in sorted((repo / "Data/_incoming").glob(f"**/{kind}/*.json")):
        for item in json.loads(p.read_text(encoding="utf-8")):
            out[item["id"]] = item
    return out


def main() -> int:
    moves_all = load_all_kind(REPO, "moves")
    traits_all = load_all_kind(REPO, "traits")
    items = []

    for line_id, extra in LINES.items():
        batch = REPO / extra["batch"]
        creatures = {c["id"]: c for c in json.loads((batch / "creatures/creatures.json").read_text(encoding="utf-8"))}
        copy = json.loads((batch / "copy-terra.json").read_text(encoding="utf-8"))
        copy_by_id = {x["id"]: x for k in ("creatures", "moves", "traits") for x in copy.get(k, [])}
        stages = sorted((c for c in creatures.values() if c["line_id"] == line_id),
                        key=lambda c: ["juvenile", "adolescent", "adult"].index(c["stage"]))
        if len(stages) != 3:
            print(f"error: {line_id} has {len(stages)} stages in {batch}", file=sys.stderr)
            return 1
        adult = stages[-1]
        concept = adult["concept"]
        trait_id = adult["trait"]
        locked_stages = []
        for c in stages:
            stg = c["stage"]
            mv = moves_all.get(c["signature_move"])
            cp = copy_by_id.get(c["id"], {})
            mcp = copy_by_id.get(c["signature_move"], {})
            if mv is None or trait_id not in traits_all:
                print(f"error: {c['id']} references missing move '{c['signature_move']}' or trait '{trait_id}'", file=sys.stderr)
                return 1
            s_dims = extra["stage_dims"].get(stg, extra["adult_dims"])
            locked_stages.append({
                "stage": stg,
                "creature_id": c["id"],
                "name_zh": cp.get("name_zh", ""),
                "name_en": cp.get("name_en", ""),
                "naming_note": cp.get("naming_note", ""),
                "size_class": c["size_class"],
                "niches": c.get("niches", []),
                "height_length": s_dims["height_length"],
                "weight": s_dims["weight"],
                "body_fat": s_dims["body_fat"],
                "look": c["concept"]["base"] + "；" + c["concept"]["stage_look"],
                "dex_zh": cp.get("dex_zh", ""),
                "dex_en": cp.get("dex_en", ""),
                "signature_move": {
                    "move_id": mv["id"],
                    "name_zh": mcp.get("name_zh", ""),
                    "name_en": mcp.get("name_en", ""),
                    "element": mv["element"],
                    "range_class": mv["range_class"],
                    "shape": mv["shape"],
                    "movement": mv.get("movement", "none"),
                    "naming_note": mcp.get("naming_note", ""),
                    "desc_zh": mcp.get("desc_zh", ""),
                    "desc_en": mcp.get("desc_en", ""),
                    "visual": mcp.get("desc_zh", "")
                },
            })
        if line_id in OVERLOADS:
            locked_stages.append(OVERLOADS[line_id])
        tcp = copy_by_id.get(trait_id, {})
        ov = OVERLOADS.get(line_id, {})
        items.append({
            "line_id": line_id,
            "code_zh": extra["code_zh"],
            "element": extra["element"],
            "title_zh": " → ".join(dict.fromkeys(s["name_zh"] for s in locked_stages)),
            "source": extra["batch"],
            "concept": {
                "line_id": line_id,
                "elements": extra["elements"],
                "element_palettes": extra["element_palettes"],
                "base_parents": extra["base_parents"],
                "bases": extra["bases"],
                "appearance_palette": [p.strip() for p in concept["palette"].split("、")],
                "timeline": extra["timeline"],
                "region": concept["region"],
                "archetype": extra.get("archetype", concept["archetype"]),
                "archetype_name": extra.get("archetype_name", concept["archetype"]),
                "archetype_type": extra.get("archetype_type", "P5-02 考據庫"),
                "meaning": extra.get("archetype_meaning", ""),
                "motifs": "、".join(concept["motifs_used"]),
                "sensitivity": "ok",
                "role": concept["role"],
                # Concept-only representative habit; the game draws each wild individual's habit from its niche.
                "habit": extra.get("habit", "tolerant"),
                "disposition": extra.get("disposition", "沉穩"),
                "size_profile": "→".join(s["size_class"] for s in locked_stages),
                "stage_dims": extra["stage_dims"],
                **extra["adult_dims"],
                "formula": " + ".join(extra["elements"]) + " × " + " + ".join(extra["bases"]) + " × " + extra.get("archetype_name", concept["archetype"]),
                "locked": {
                    "status": "已設計（Data/_incoming 草稿；id 與名稱照抄，不可改）",
                    "stages": locked_stages,
                    "trait": {"trait_id": trait_id, "name_zh": tcp.get("name_zh", ""), "idea_zh": tcp.get("desc_zh", "")},
                    "overload": ov.get("name_zh", "") + "（" + ov.get("creature_id", "") + " · XL）：" + ov.get("look", "超載爆發型態") if ov else "暫無超載型態",
                },
            },
        })

    for spec in DRIVE_CREATURES:
        items.append(build_drive_creature_item(spec))

    # Load pre-designed characters from canonical sample batch
    char_batch = REPO / "Data/_incoming/p0-05-samples/valid/characters/characters.json"
    characters = []
    if char_batch.exists():
        characters = json.loads(char_batch.read_text(encoding="utf-8"))

    payload = json.dumps({"version": "2.2.0", "items": items, "characters": characters}, ensure_ascii=False, indent=2)
    OUT.write_text(
        "// GENERATED by tools/prompt-forge/gen_designed.py from Data/_incoming batches — do not edit by hand.\n"
        "window.COSMI_DESIGNED = " + payload + ";\n",
        encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(REPO)} ({len(items)} creature lines, {len(characters)} characters)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
