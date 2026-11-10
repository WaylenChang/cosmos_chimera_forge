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
        "temperament": "territorial",
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
        "temperament": "territorial",
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
        "temperament": "territorial",
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
        "temperament": "territorial",
        "archetype": "arch_al_jazari",
        "archetype_name": "賈扎里象鐘機關",
        "archetype_type": "P5-02 考據庫·歷史工匠技術",
        "archetype_meaning": "以水力浮碗與發條齒輪驅動的精密報時巨象機兵",
        "adult_dims": {"height_length": "2.40 m", "weight": "650 kg", "body_fat": "8%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.48 m", "weight": "14 kg", "body_fat": "10%"},
            "adolescent": {"height_length": "1.30 m", "weight": "95 kg", "body_fat": "9%"},
            "adult": {"height_length": "2.40 m", "weight": "650 kg", "body_fat": "8%"}
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
        "temperament": "territorial",
        "archetype": "arch_sarimanok",
        "archetype_name": "薩里馬諾克彩鳳",
        "archetype_type": "P5-02 考據庫·神話神獸",
        "archetype_meaning": "銜魚守護福佑、羽翼流淌雙重虹彩的熱帶祥鳥",
        "adult_dims": {"height_length": "2.10 m", "weight": "65 kg", "body_fat": "11%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.42 m", "weight": "2.2 kg", "body_fat": "14%"},
            "adolescent": {"height_length": "1.15 m", "weight": "18 kg", "body_fat": "12%"},
            "adult": {"height_length": "2.10 m", "weight": "65 kg", "body_fat": "11%"}
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
        "temperament": "territorial",
        "archetype": "arch_edai_siabo_lakatoi",
        "archetype_name": "埃達伊·西阿波陶船傳奇",
        "archetype_type": "P5-02 考據庫·航海史詩",
        "archetype_meaning": "隨季風遠航海蝕裂隙、身披雙體陶船甲板的碧波巨鰻",
        "adult_dims": {"height_length": "2.45 m", "weight": "120 kg", "body_fat": "15%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.55 m", "weight": "3.5 kg", "body_fat": "18%"},
            "adolescent": {"height_length": "1.35 m", "weight": "32 kg", "body_fat": "16%"},
            "adult": {"height_length": "2.45 m", "weight": "120 kg", "body_fat": "15%"}
        }
    },
    "line_fire_blazelion": {
        "batch": "Data/_incoming/p5-03-creatures-draft-01",
        "code_zh": "火",
        "element": "fire",
        "elements": ["fire（火）"],
        "element_palettes": ["赭石紅、熾金黃、玄武岩暗灰"],
        "base_parents": ["生物·哺乳類", "物質·礦物", "科幻機械·能量/量子構裝"],
        "bases": ["烈焰雄獅", "砂岩熔核甲胄", "高溫電漿噴口"],
        "timeline": "遠古神話（尼羅河上游）",
        "disposition": "兇悍霸烈、主動進攻",
        "temperament": "apex",
        "archetype": "arch_apedemak",
        "archetype_name": "阿佩德馬克獅首神",
        "archetype_type": "P5-02 考據庫·神話戰神",
        "archetype_meaning": "背負砂岩金字塔尖、盤蛇蓮花熔焰生輝的四臂守護雄獅",
        "adult_dims": {"height_length": "2.30 m", "weight": "310 kg", "body_fat": "13%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.50 m", "weight": "6.5 kg", "body_fat": "17%"},
            "adolescent": {"height_length": "1.30 m", "weight": "68 kg", "body_fat": "15%"},
            "adult": {"height_length": "2.30 m", "weight": "310 kg", "body_fat": "13%"}
        }
    },
    "line_earth_gildedgolem": {
        "batch": "Data/_incoming/p5-03-creatures-draft-01",
        "code_zh": "土",
        "element": "earth",
        "elements": ["earth（土）"],
        "element_palettes": ["鎏金黃、翡翠綠、陶土赭褐"],
        "base_parents": ["造物·積木/魔像", "物質·礦物", "物質·珠寶"],
        "bases": ["黃金礦脈人形石偶", "儀典岩鎧石偶", "高山聖湖綠寶石核心"],
        "timeline": "遠古神話（安地斯文明）",
        "disposition": "沉默威儀、堅不可摧",
        "temperament": "territorial",
        "archetype": "arch_el_dorado_muisca",
        "archetype_name": "黃金國穆伊斯卡祭典",
        "archetype_type": "P5-02 考據庫·原住民祭典",
        "archetype_meaning": "金粉覆身、乘聖湖蘆葦木筏降臨的崇高黃金守護石偶",
        "adult_dims": {"height_length": "2.25 m", "weight": "480 kg", "body_fat": "9%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.48 m", "weight": "12 kg", "body_fat": "12%"},
            "adolescent": {"height_length": "1.25 m", "weight": "95 kg", "body_fat": "10%"},
            "adult": {"height_length": "2.25 m", "weight": "480 kg", "body_fat": "9%"}
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
        "temperament": "fierce",
        "archetype": "arch_pazyryk_antlered_griffin",
        "archetype_name": "巴澤雷克鹿角神獸",
        "archetype_type": "P5-02 考據庫·斯基泰金工",
        "archetype_meaning": "分叉金屬鹿角生長冰棘、鎮守永凍冰塚的極北獵獸",
        "adult_dims": {"height_length": "2.40 m", "weight": "380 kg", "body_fat": "14%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.52 m", "weight": "5.0 kg", "body_fat": "18%"},
            "adolescent": {"height_length": "1.35 m", "weight": "58 kg", "body_fat": "16%"},
            "adult": {"height_length": "2.40 m", "weight": "380 kg", "body_fat": "14%"}
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
        "temperament": "normal",
        "archetype": "arch_heer_ranjha",
        "archetype_name": "希爾與蘭賈之笛",
        "archetype_type": "P5-02 考據庫·民間傳奇",
        "archetype_meaning": "以雕花竹笛共鳴氣流、揚起幾何刺繡滑翔帆乘風翱翔的天舟",
        "adult_dims": {"height_length": "2.20 m", "weight": "85 kg", "body_fat": "10%"},
        "stage_dims": {
            "juvenile": {"height_length": "0.46 m", "weight": "2.8 kg", "body_fat": "15%"},
            "adolescent": {"height_length": "1.20 m", "weight": "22 kg", "body_fat": "12%"},
            "adult": {"height_length": "2.20 m", "weight": "85 kg", "body_fat": "10%"}
        }
    }
}

# 御三家超載型態（Overload）定案設定
OVERLOADS = {
    "starter_sun_line": {
        "stage": "overload",
        "creature_id": "sun_coronavault_skyheron",
        "temperament": "apex",
        "disposition": "神聖威嚴、君臨長空",
        "name_zh": "鏡冕天鷺",
        "name_en": "Mirracorona",
        "naming_note": "鏡陣大成，日冕登冠。",
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
        "temperament": "apex",
        "disposition": "狂暴冷酷、蝕滅萬物",
        "name_zh": "夜痕蝕月狼",
        "name_en": "Niverclis",
        "naming_note": "極夜化身，蝕月生寒。",
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
        "temperament": "apex",
        "disposition": "萬鈞奔雷、威壓寰宇",
        "name_zh": "星蹄雷皇驥",
        "name_en": "Voltrastorm",
        "naming_note": "雷皇踏空，星霆撼野。",
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
    }
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
                "temperament": c.get("temperament", "normal"),
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
            "title_zh": " → ".join(s["name_zh"] for s in locked_stages),
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
                "temperament": extra.get("temperament", adult.get("temperament", "normal")),
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
