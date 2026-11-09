// COSMIMERA prompt-forge · 選項池與規格資料（唯一來源）
// 改動規則見 README.md：新增選項 → minor；改既有 ID / 刪除 / 改動作事件 → major。
// 權重 w 為相對值，不必加總為 100。
window.COSMI_CATALOG = {
  version: "2.5.0",

  ELEMENTS: [
    { v: "metal",   zh: "金", palette: "銀白、淡金、鋼藍高光" },
    { v: "wood",    zh: "木", palette: "翠綠、嫩芽黃綠、木褐" },
    { v: "water",   zh: "水", palette: "青藍、湖綠、白色浪花" },
    { v: "fire",    zh: "火", palette: "橘紅、熔金、炭黑邊緣" },
    { v: "earth",   zh: "土", palette: "赭黃、陶土紅、苔綠點綴" },
    { v: "ice",     zh: "冰", palette: "冰藍、霜白、淡紫折射" },
    { v: "wind",    zh: "風", palette: "薄荷綠、雲白、淡青流線" },
    { v: "thunder", zh: "雷", palette: "電紫、亮黃、白色閃光" },
    { v: "light",   zh: "光", palette: "金白、暖黃光暈、淡粉" },
    { v: "shadow",  zh: "影", palette: "深紫、墨黑、幽藍邊光" },
    { v: "未知",    zh: "未知", palette: "留待生成決定" }
  ],
  ELEMENT_COUNT: [ { n: 1, w: 40 }, { n: 2, w: 45 }, { n: 3, w: 15 } ],

  VESSELS: [
    { v: "talisman_card", zh: "符籙卡片", sub: "招式", look: "可甩出的紙/金屬符卡，書寫發光符文，命中後展開成封印陣" },
    { v: "glass_bead",    zh: "琉璃珠",   sub: "特性", look: "掌心大小的多色琉璃珠，內有流動星雲，拋擲後化為光泡包覆" },
    { v: "magic_cube",    zh: "魔術方塊", sub: "超載", look: "可旋轉的多面方塊，各面刻屬性紋章，投擲後轉動解鎖成牢籠" },
    { v: "未知",          zh: "未知",     sub: "未知", look: "留待外包/模型階段自由發揮" }
  ],

  // 跨角色/宙獸共用之文化地區
  CULTURE_REGIONS: [
    "東亞", "南亞", "東南亞", "西亞/中東", "非洲", "歐洲", "美洲", "大洋洲",
    "中亞/北亞", "極地", "多元交融/世界都市", "星際宙域/跨星系殖民地", "未知"
  ],
  get RESEARCH_REGIONS() { return this.CULTURE_REGIONS; },

  // 跨角色/宙獸共用之文化時間線（包含歷史、近現代與不同幻想的未來時間線發展）
  TIMELINES: [
    { v: "遠古神話/原始神代", zh: "遠古神話/原始神代", desc: "神祇行走於世、原始混沌、創世圖騰與古老神明" },
    { v: "遠古石器/部落圖騰紀元", zh: "遠古石器/部落圖騰", desc: "岩壁彩繪、薩滿信仰、巨獸與原始聚落共生" },
    { v: "青銅神話/古典英雄時代", zh: "青銅神話/古典英雄", desc: "山海經與荷馬史詩、神兵青銅、英雄史詩遠征" },
    { v: "封建王朝/古典帝國盛世", zh: "古典帝國/封建盛世", desc: "絲路跨洲貿易、哲學百家、宏偉古帝國城堡與宮廷" },
    { v: "中世紀高奇幻/騎士魔導王國", zh: "中世紀高奇幻/魔導王國", desc: "圓桌騎士、魔導高塔、領地城堡、巨龍與法印" },
    { v: "大航海大發現/符文星盤開拓", zh: "大航海/符文星盤開拓", desc: "洋流探險、新大陸測繪、神秘海圖與巨艦遠航" },
    { v: "以太蒸汽/魔導第一次工業革命", zh: "以太蒸汽/魔導工革", desc: "齒輪工場、飛行飛艇、以太蒸氣重機關與發明潮" },
    { v: "柴油重工/符文鋼鐵要塞", zh: "柴油重工/符文裝甲", desc: "重裝履帶、鋼鐵要塞、柴油魔導內燃裝甲與要塞戰" },
    { v: "電氣霓虹/裝飾藝術時代", zh: "電氣霓虹/裝飾藝術", desc: "早期無線電、摩天摩登、爵士狂潮、早期電氣火花" },
    { v: "晶石賽博/霓虹魔導義體紀元", zh: "晶石賽博/魔導義體", desc: "霓虹雨夜、魔導晶片、賽博駭客、合成人神崇拜" },
    { v: "太陽龐克/生態科技綠色未來", zh: "太陽龐克/生態共生", desc: "生物建築、太陽光帆、微氣候循環、萬物和諧共榮" },
    { v: "近未來軌道殖民/近地宙域", zh: "近未來軌道/太空電梯", desc: "太空電梯、月面質量投射器、低軌殖民站與空間站" },
    { v: "太空歌劇/星際魔導帝國", zh: "太空歌劇/星際魔導", desc: "曲率躍遷、星門艦隊、跨星系議會、行星巨構與宙航" },
    { v: "後啟示末日/廢土殘響重生", zh: "後啟示末日/廢土殘響", desc: "古文明崩解、荒原拾荒、機械殘骸、神明再臨與廢墟重組" },
    { v: "虛空超弦/維度升華神代", zh: "虛空超弦/維度升華", desc: "高維躍遷、超光速純能量體、超維宇宙巨構與因果改寫" },
    { v: "未知", zh: "未知", desc: "自由發揮未來或架空時空" }
  ],

  // 基礎單色系選項池（供角色服裝、頭髮與宙獸外觀多選組合，每項為單色，可多選組合成 1~4 色）
  COLOR_TONES: [
    // 中性通用色（全元素適用，或作基底/高光）
    { v: "曜石純黑", zh: "曜石黑", elements: ["all"], w: 9 },
    { v: "月華純白", zh: "月華白", elements: ["all"], w: 9 },
    { v: "象牙米白", zh: "象牙白", elements: ["all"], w: 8 },
    { v: "炭煙燻灰", zh: "炭煙灰", elements: ["all"], w: 8 },
    { v: "暮雲灰藍", zh: "暮雲灰藍", elements: ["water", "wind", "ice", "metal", "all"], w: 7 },
    { v: "鍍銀鋼白", zh: "鍍銀鋼白", elements: ["metal", "ice", "light", "all"], w: 8 },
    { v: "玄鐵青黑", zh: "玄鐵青黑", elements: ["metal", "earth", "shadow", "all"], w: 7 },
    { v: "古銅生鏽綠", zh: "古銅綠", elements: ["metal", "earth", "wood"], w: 6 },
    { v: "黃銅金", zh: "黃銅金", elements: ["metal", "thunder", "light"], w: 7 },

    // 火系相關
    { v: "熔岩赤紅", zh: "熔岩赤紅", elements: ["fire", "earth"], w: 8 },
    { v: "烈焰紅", zh: "烈焰紅", elements: ["fire"], w: 8 },
    { v: "珊瑚鮮橘", zh: "珊瑚鮮橘", elements: ["fire", "light", "water"], w: 7 },
    { v: "深酒紅", zh: "深酒紅", elements: ["fire", "shadow"], w: 7 },
    { v: "陶土磚紅", zh: "陶土磚紅", elements: ["earth", "fire"], w: 7 },

    // 木系相關
    { v: "蒼翡翠", zh: "蒼翡翠", elements: ["wood"], w: 8 },
    { v: "翠綠", zh: "翠綠", elements: ["wood"], w: 8 },
    { v: "嫩芽黃綠", zh: "嫩芽黃綠", elements: ["wood", "light"], w: 7 },
    { v: "橄欖墨綠", zh: "橄欖墨綠", elements: ["wood", "earth"], w: 7 },
    { v: "苔綠", zh: "苔蘚綠", elements: ["wood", "earth"], w: 7 },

    // 水系相關
    { v: "海軍深藍", zh: "海軍深藍", elements: ["water", "shadow"], w: 8 },
    { v: "深海湛藍", zh: "深海湛藍", elements: ["water"], w: 8 },
    { v: "克萊因藍", zh: "克萊因藍", elements: ["water", "thunder"], w: 7 },
    { v: "清透天藍", zh: "清透天藍", elements: ["water", "wind", "ice"], w: 7 },
    { v: "湖水綠", zh: "湖水綠", elements: ["water", "wood"], w: 7 },

    // 冰系相關
    { v: "冰晶天藍", zh: "冰晶天藍", elements: ["ice", "water"], w: 8 },
    { v: "霜雪透白", zh: "霜雪透白", elements: ["ice", "light"], w: 8 },
    { v: "純淨冰藍", zh: "純淨冰藍", elements: ["ice"], w: 8 },
    { v: "稜鏡淡紫", zh: "稜鏡淡紫", elements: ["ice", "light", "wind"], w: 7 },

    // 風系相關
    { v: "薄荷淺青", zh: "薄荷淺青", elements: ["wind", "water", "ice"], w: 8 },
    { v: "青瓷灰綠", zh: "青瓷灰綠", elements: ["wind", "wood", "water"], w: 7 },
    { v: "流線淡青", zh: "流線淡青", elements: ["wind", "light"], w: 7 },

    // 土系相關
    { v: "大地赭石", zh: "大地赭石", elements: ["earth"], w: 8 },
    { v: "卡其棕", zh: "卡其棕", elements: ["earth", "wood", "all"], w: 7 },
    { v: "焦糖茶褐", zh: "焦糖茶褐", elements: ["earth", "wood"], w: 7 },
    { v: "砂岩黃", zh: "砂岩黃", elements: ["earth", "light"], w: 7 },

    // 雷系相關
    { v: "雷電曜紫", zh: "雷電曜紫", elements: ["thunder", "shadow"], w: 8 },
    { v: "閃電熾黃", zh: "閃電熾黃", elements: ["thunder", "light"], w: 8 },
    { v: "電弧青藍", zh: "電弧青藍", elements: ["thunder", "water"], w: 7 },

    // 光系相關
    { v: "耀日光金", zh: "耀日光金", elements: ["light", "thunder", "metal", "fire"], w: 8 },
    { v: "晨曦金", zh: "晨曦金", elements: ["light", "fire"], w: 8 },
    { v: "琥珀金", zh: "琥珀金", elements: ["light", "earth", "thunder"], w: 7 },
    { v: "櫻花粉", zh: "櫻花粉", elements: ["light", "wood"], w: 7 },

    // 影系相關
    { v: "虛空深紫", zh: "虛空深紫", elements: ["shadow"], w: 8 },
    { v: "暗影幽黑", zh: "暗影幽黑", elements: ["shadow"], w: 8 },
    { v: "丁香淡紫", zh: "丁香淡紫", elements: ["shadow", "wind", "ice", "light"], w: 7 },
    { v: "緋紅血瞳色", zh: "緋紅血瞳色", elements: ["shadow", "fire"], w: 6 }
  ],

  // 取得受元素限定範圍的色系池（排除與元素不合的色系）
  getFilteredPalettes(creatureElements) {
    if (!creatureElements || !creatureElements.length) return this.COLOR_TONES;
    const cleanElems = creatureElements.map(e => e.replace(/（.*）/, "").replace(/\(.*?\)/, "").trim());
    if (cleanElems.includes("未知") || !cleanElems.length) return this.COLOR_TONES;
    return this.COLOR_TONES.filter(c => {
      if (c.elements.includes("all")) return true;
      return cleanElems.some(el => c.elements.includes(el));
    });
  },

  // 依角色/宙獸色系判定 2D AGC 立繪背景色（RGB 三通道嚴格均等）
  determineAgcBgColor(concept, isCharacter) {
    if (!concept) {
      return {
        hex: "#808080",
        rgb: [128, 128, 128],
        rgbStr: "rgb(128, 128, 128)",
        luminance: 0.5,
        toneType: "balanced",
        toneLabel: "標準中性灰",
        reason: "主體為均衡/中彩度色系，採用標準中性灰 #808080（R=G=B=128），維持無色偏平光環境",
        promptGuide: "純中性灰 #808080 純色背景，平光無陰影、無色偏"
      };
    }

    const colorKeywords = [];
    if (isCharacter) {
      if (Array.isArray(concept.outfit_palette)) colorKeywords.push(...concept.outfit_palette);
      if (concept.hair_palette) colorKeywords.push(...(Array.isArray(concept.hair_palette) ? concept.hair_palette : [concept.hair_palette]));
      if (concept.eye_palette) colorKeywords.push(...(Array.isArray(concept.eye_palette) ? concept.eye_palette : [concept.eye_palette]));
    } else {
      if (Array.isArray(concept.appearance_palette)) colorKeywords.push(...concept.appearance_palette);
      if (Array.isArray(concept.bases)) colorKeywords.push(...concept.bases);
    }
    if (Array.isArray(concept.elements)) colorKeywords.push(...concept.elements);

    // 評估明度權重表 (0~1)
    function estimateLuminance(str) {
      if (!str || typeof str !== "string") return 0.5;
      const s = str.toLowerCase();
      // 極深/暗色系 (0.12)
      if (/黑|曜石|暗|夜|幽|玄鐵|炭|煙燻|墨|虛空|shadow/.test(s)) return 0.12;
      // 深色系 (0.28)
      if (/深藍|深海|海軍|深酒|深栗|古銅|橄欖|灰藍|青黑|深/.test(s)) return 0.28;
      // 極淺/白銀光系 (0.88)
      if (/白|月華|象牙|米白|霜雪|霜|鍍銀|鋼白|透白|light/.test(s)) return 0.88;
      // 淺亮系 (0.74)
      if (/冰晶|純淨冰|清透天藍|薄荷|淡青|砂岩黃|晨曦|耀日|金白|淡紫|粉|ice/.test(s)) return 0.74;
      // 亮彩色系 (0.62)
      if (/珊瑚|鮮橘|嫩芽|黃綠|閃電熾黃|耀日光金|黃銅|琥珀|電弧|櫻花/.test(s)) return 0.62;
      // 中彩色系 (0.48)
      if (/赤紅|烈焰|火|陶土|磚紅|蒼翡翠|翠綠|湖水|克萊因|大地|赭石|卡其|焦糖|茶褐|雷電|曜紫|青瓷|wood|earth|water|fire|wind|thunder/.test(s)) return 0.48;
      return 0.50;
    }

    let sum = 0, count = 0;
    for (const kw of colorKeywords) {
      sum += estimateLuminance(kw);
      count++;
    }

    const avgL = count > 0 ? (sum / count) : 0.50;

    // 依 2D AGC 立繪剪影分離原則判定：RGB 三通道嚴格相同
    if (avgL < 0.38) {
      // 主體偏深色：背景提高至淺中性灰 #c0c0c0 (R=G=B=192)
      return {
        hex: "#c0c0c0",
        rgb: [192, 192, 192],
        rgbStr: "rgb(192, 192, 192)",
        luminance: avgL,
        toneType: "dark_dominant",
        toneLabel: "淺中性灰（深色主體反差）",
        reason: "主體偏深色/暗影系，採用淺中性灰 #c0c0c0 確保剪影邊緣分離且無環境色偏",
        promptGuide: "淺中性灰 #c0c0c0 純色背景（深色主體反差），平光無陰影、無色偏"
      };
    } else if (avgL > 0.65) {
      // 主體偏淺色/白銀：背景降至深中性灰 #505050 (R=G=B=80)
      return {
        hex: "#505050",
        rgb: [80, 80, 80],
        rgbStr: "rgb(80, 80, 80)",
        luminance: avgL,
        toneType: "light_dominant",
        toneLabel: "深中性灰（淺色主體反差）",
        reason: "主體偏淺光/白銀色系，採用深中性灰 #505050 防止邊緣過曝，維持乾淨無色偏",
        promptGuide: "深中性灰 #505050 純色背景（淺色主體反差），平光無陰影、無色偏"
      };
    } else {
      // 主體均衡/中彩度：標準 50% 中性灰 #808080 (R=G=B=128)
      return {
        hex: "#808080",
        rgb: [128, 128, 128],
        rgbStr: "rgb(128, 128, 128)",
        luminance: avgL,
        toneType: "balanced",
        toneLabel: "標準中性灰（均衡色系）",
        reason: "主體為標準中彩度色系，採用標準中性灰 #808080，色溫平衡無色偏",
        promptGuide: "純中性灰 #808080 純色背景，平光無陰影、無色偏"
      };
    }
  },

  // ==================== 第 3 輪主立繪場景氛圍矩陣配置 ====================
  SCENE_THEMES: [
    { v: "auto", zh: "🎲 智慧匹配（依文化地區+時空+屬性推演）" },
    { v: "sanctuary", zh: "🏛️ 神殿/古剎/儀式祭壇（莊嚴神秘）" },
    { v: "wild_nature", zh: "🌲 奇幻秘境/原野巨石/深潭瀑布（生機宏偉）" },
    { v: "highlands", zh: "⛰️ 雲海浮島/斷崖絕壁/險峻天峰（遼闊高遠）" },
    { v: "settlement", zh: "🏘️ 古城聚落/市井街巷/古道驛站（人文氛圍）" },
    { v: "cyber_neon", zh: "🏙️ 霓虹雨夜/高架天橋/賽博天台（科幻摩登）" },
    { v: "steampunk", zh: "⚙️ 齒輪工場/以太飛艇甲板/重裝要塞（蒸氣鋼鐵）" },
    { v: "abyss_wasteland", zh: "🌋 熔岩焦土/廢土殘垣/巨神殘骸（末日壓迫）" },
    { v: "frost_glacier", zh: "❄️ 永凍冰河/極光冰谷/霜晶洞窟（寒冽清透）" },
    { v: "cosmic_orbit", zh: "🌌 太空港軌道/星環浮島/星門甲板（星際浩瀚）" }
  ],

  SCENE_LIGHTINGS: [
    { v: "auto", zh: "🎲 智慧光影（依屬性與氛圍自動推演）" },
    { v: "dawn", zh: "🌅 破曉晨曦（柔和金粉朝霞、微逆光剪影輪廓）" },
    { v: "noon_clear", zh: "☀️ 晴空萬里（明朗清澈、高飽和色彩、清晰陰影）" },
    { v: "dusk_twilight", zh: "🌇 晚霞落日（金紅橙紫漸變、壯麗餘暉長影）" },
    { v: "night_aurora", zh: "🌌 幽夜星空/極光流動（深邃冷藍背景、冷光反射）" },
    { v: "storm_thunder", zh: "⚡ 狂風驟雨/雷雲翻湧（低沉陰雲、閃電穿透光）" },
    { v: "particle_glow", zh: "✨ 靈光漫溢/粒子星塵（漂浮微光、夢幻丁達爾光效）" }
  ],

  SCENE_ACTIONS: [
    { v: "auto", zh: "🎲 智慧姿態（依角色性格/宙獸型態判定）" },
    { v: "battle_burst", zh: "💥 招式爆發/戰鬥蓄力（威嚴爆發、屬性特效呼應）" },
    { v: "high_perch", zh: "🦅 登高俯瞰/傲立岩梢（從容威嚴、衣袍/羽翼迎風飄揚）" },
    { v: "dynamic_leap", zh: "⚡ 凌空騰躍/疾速衝刺（極致動感、流線風壓牽引）" },
    { v: "calm_commune", zh: "🍃 靜態共鳴/守護姿態（溫和沉穩、與環境元素交融）" }
  ],

  // 根據文化地區、文化時空、屬性與自選條件，智慧演算第 3 輪主立繪專屬場景
  resolveDynamicScene(concept, isCharacter, opts = {}, curStage = "adult") {
    const region = concept?.region || "未知";
    const timeline = concept?.timeline || "架空";
    const elements = isCharacter ? [] : (concept?.elements || ["light"]);
    const primaryElem = elements[0] || "light";

    // 1. 決定場景主題 (Theme)
    let themeKey = opts.scene_theme || "auto";
    if (themeKey === "auto") {
      const regStr = String(region);
      const timeStr = String(timeline);
      if (/極地/.test(regStr)) themeKey = "frost_glacier";
      else if (/星際|軌道|超弦|殖民/.test(regStr) || /太空|軌道|超弦/.test(timeStr)) themeKey = "cosmic_orbit";
      else if (/後啟示|廢土|末日/.test(timeStr)) themeKey = "abyss_wasteland";
      else if (/賽博|霓虹|義體/.test(timeStr)) themeKey = "cyber_neon";
      else if (/蒸汽|柴油|工業|要塞/.test(timeStr)) themeKey = "steampunk";
      else if (/神話|神代|英雄|古典/.test(timeStr)) {
        if (/西亞|中東|非洲/.test(regStr)) themeKey = "settlement";
        else if (primaryElem === "wind" || primaryElem === "light" || primaryElem === "thunder") themeKey = "highlands";
        else if (primaryElem === "wood" || primaryElem === "water") themeKey = "wild_nature";
        else themeKey = "sanctuary";
      } else {
        if (primaryElem === "ice") themeKey = "frost_glacier";
        else if (primaryElem === "fire") themeKey = "abyss_wasteland";
        else if (primaryElem === "wind" || primaryElem === "thunder") themeKey = "highlands";
        else if (primaryElem === "water" || primaryElem === "wood") themeKey = "wild_nature";
        else themeKey = "sanctuary";
      }
    }

    // 2. 決定具體地貌環境描述
    const sceneDescMap = {
      sanctuary: "懸浮於雲海之上的古代莊嚴儀式神殿，刻滿古老文明符文的石柱殘垣與浮空祭壇，散發著神祕沉靜的歷史底蘊",
      wild_nature: "巨木參天、藤蔓垂掛的奇幻原始秘境，遠處有奔騰的瀑布水霧與青苔巨石，生機盎然",
      highlands: "群峰環抱、雲霧翻騰的險峻斷崖天峰，突出的巨岩孤立於雲海之上，視野遼闊浩瀚",
      settlement: "具有深厚文化印記的古老驛站聚落，石板街道、古典磚石建築拱門與遠方林立的城塔，人文生活氛圍濃郁",
      cyber_neon: "細雨霏霏的賽博摩登高架天台，全息太虛符文投影與交錯的霓虹光條在微濕地面映出彩色倒影",
      steampunk: "蒸氣繚繞的以太重裝機械工坊要塞，巨大的黃銅齒輪、壓力管道與浮空飛艇停泊甲板交織出復古工業感",
      abyss_wasteland: "地表龜裂、地熱微光的黑色玄武岩焦土荒原，遠方斜插著遠古巨神或機械殘骸，充滿末日壓迫感",
      frost_glacier: "泛著幽藍微光的極地永凍冰川裂谷，垂掛著剔透霜晶的冰洞與倒映著蒼穹的如鏡冰原",
      cosmic_orbit: "低軌道太空港的外露觀景甲板，背後是浩瀚深邃的星系星雲與巨大藍色母星的弧線地平線"
    };
    const sceneDesc = sceneDescMap[themeKey] || sceneDescMap.sanctuary;

    // 3. 決定光影氣候 (Lighting)
    let lightKey = opts.scene_lighting || "auto";
    if (lightKey === "auto") {
      if (themeKey === "cyber_neon" || themeKey === "frost_glacier" || primaryElem === "shadow") lightKey = "night_aurora";
      else if (primaryElem === "thunder" || themeKey === "abyss_wasteland") lightKey = "storm_thunder";
      else if (primaryElem === "fire" || themeKey === "settlement") lightKey = "dusk_twilight";
      else if (primaryElem === "light" || primaryElem === "wind") lightKey = "dawn";
      else lightKey = "particle_glow";
    }

    const lightDescMap = {
      dawn: "破曉晨曦柔和灑落，天際呈現淺金與玫瑰色朝霞，主體邊緣泛著細膩的金晨微光（Rim light）",
      noon_clear: "明澈晴空萬里，光影乾淨俐落，色塊對比鮮豔分明，充滿明朗正氣",
      dusk_twilight: "壯麗的晚霞落日餘暉，金紅與深紫交織的天色，投射出修長溫暖的光影拉絲",
      night_aurora: "深邃幽藍夜空，穹頂飄揚著翠綠與淡紫的極光光帶，主體輪廓帶有冷調環境光反照",
      storm_thunder: "雷雲密布的昏暗天空，時不時劃過撕裂雲層的亮紫電光，水氣與風壓逼人，光影戲劇張力極強",
      particle_glow: "夢幻的靈光漫溢氛圍，空氣中浮游著大量與主體屬性呼應的發光微粒與星塵，如詩如畫"
    };
    const lightingDesc = lightDescMap[lightKey] || lightDescMap.particle_glow;

    // 4. 決定動態姿態 (Action)
    let actionKey = opts.scene_action || "auto";
    let actionDesc = "";
    if (isCharacter) {
      const vesselZh = concept?.vessel?.zh || concept?.vessel || "收服道具";
      const styleZh = concept?.style || "冒險姿態";
      if (concept?.pose && concept.pose !== "未知") {
        actionDesc = concept.pose;
      } else if (actionKey === "high_perch") {
        actionDesc = "傲立於突出的岩石頂端，衣袍與髮絲在獵獵作響的狂風中劇烈翻飛，眼神冷靜俯瞰遠方，一手輕撫腰側的【" + vesselZh + "】";
      } else if (actionKey === "dynamic_leap") {
        actionDesc = "凌空側躍而下，身體成舒展的流線動態，一手前伸蓄力，一手緊扣【" + vesselZh + "】，充滿敏捷爆發力";
      } else if (actionKey === "calm_commune") {
        actionDesc = "雙足自然著地，神情專注溫和，雙手捧持泛光的【" + vesselZh + "】，身周環繞著微弱的守護靈光光環";
      } else {
        actionDesc = "呈極具張力的戰鬥迎敵架勢，單手握持【" + vesselZh + "】準備施展，髮絲與服裝披風迎風飄揚，眼神堅定，展現" + styleZh + "的魄力氣場";
      }
    } else {
      if (curStage === "juvenile") {
        actionDesc = "幼態小巧滾圓的身軀好奇地趴伏在岩塊邊緣，小爪探向漂浮的元素微光，回頭露出靈動神采，活潑可愛";
      } else if (curStage === "adolescent") {
        actionDesc = "少年期矯健的身姿踏在突起的地表，四足微屈蓄勢待發，周身隱隱浮現屬性元素氣旋，神情敏銳";
      } else if (curStage === "overload") {
        actionDesc = "戰鬥超載能量極致爆發，裝甲結構與翼羽全面展開，核心聚能光環浮現，高密度粒子流自體表劇烈外溢，展現威懾全場的破壞神魄力";
      } else {
        if (actionKey === "high_perch") {
          actionDesc = "威嚴雄健地傲立於高聳岩梢之巔，胸膛微挺，尾羽在風中徐徐舒展，俯瞰領地展現王者風範";
        } else if (actionKey === "dynamic_leap") {
          actionDesc = "四足離地向前猛烈撲躍衝刺，利爪探出，身形劃出充滿速度感的動態弧線，帶動周遭氣流激盪";
        } else if (actionKey === "calm_commune") {
          actionDesc = "靜穆沉穩地盤踞於自然神殿前，身周元素能量如水波般緩緩蕩漾，神情莊嚴祥和，與天地共鳴";
        } else {
          const elemZh = (concept?.elements || ["light"]).map(e => typeof e === "string" ? (this.ELEMENTS.find(el => el.v === e)?.zh || e) : (e.zh || e)).join("、");
          actionDesc = "傲立於險峻岩石之上，昂首長嘯迎敵，身周環繞奔騰呼嘯的【" + elemZh + "】元素光流與碎石氣浪，魄力十足";
        }
      }
    }

    const themeObj = this.SCENE_THEMES.find(t => t.v === themeKey) || this.SCENE_THEMES[0];
    const lightObj = this.SCENE_LIGHTINGS.find(l => l.v === lightKey) || this.SCENE_LIGHTINGS[0];
    const actionObj = this.SCENE_ACTIONS.find(a => a.v === actionKey) || this.SCENE_ACTIONS[0];

    return {
      theme: themeKey,
      themeZh: themeObj.zh,
      lighting: lightKey,
      lightingZh: lightObj.zh,
      action: actionKey,
      actionZh: actionObj.zh,
      sceneDesc,
      lightingDesc,
      actionDesc,
      fullPromptSection: [
        "## 動態與場景氛圍",
        "- **姿態演繹**：" + actionDesc,
        "- **舞台環境**：" + sceneDesc,
        "- **光影天候**：" + lightingDesc,
        "- **構圖規範**：主體全身完整入鏡（不切頭腳），輪廓分明帶微弱邊緣反光，背景適度留白或景深虛化，杜絕主體與背景融色。無文字、無浮水印。"
      ].join("\n")
    };
  },

  // ==================== 宙獸形態演化與突變模態（完整 13 模態體系） ====================
  EVOLUTION_MODES: [
    {
      id: "eco_adaptation",
      zh: "環境適應·生態異種",
      desc: "為適應極端冷/熱/毒/重力環境，毛皮白化羽化、微氣候器官異化、體表偽裝",
      w: 17.2,
      impact: "med",
      retention: "high",
      transitions: ["stage1_to_2", "stage2_to_3"],
      prompt_guidance: "因地理微氣候隔離演化出的異種生態亞型，毛皮替換為抗寒雪羽或散熱薄膜，局部器官長度異化，五官骨架基因仍與原種完全對應。",
      positive_tokens: "subspecies regional ecological variant, specialized climate-adapted plumage and texture, broadened terrain paws, adapted ear and crest geometry, identical facial proportion and species eye geometry to base archetype",
      negative_tokens: "completely new unrelated animal species, unrecognizable head structure, artificial clothing"
    },
    {
      id: "stance_reconfig",
      zh: "姿態切換·重心重整",
      desc: "四足伏地與雙足立姿切換，或關節展開為高速巡航/防禦圓盾姿，攻防重心重整",
      w: 15.8,
      impact: "high",
      retention: "med",
      transitions: ["stage1_to_2", "stage2_to_3", "stage3_to_overload"],
      prompt_guidance: "極致動態戰鬥架勢轉移，重心下沉或拔高雙足站立，爪刃抓地，展現完全不同之戰略剪影，面部眼眸構造嚴格維持一致。",
      positive_tokens: "dramatic combat stance shift, dynamic bipedal or agile low-center martial posture, tensed muscular anatomy, ready-to-strike silhouette, signature horn and tail shape strictly preserved",
      negative_tokens: "stiff t-pose, broken spine, altered species archetype, extra limbs"
    },
    {
      id: "specialized_hypertrophy",
      zh: "特化重構·器官特化",
      desc: "肢體特化為鋒利刃面、生化管線加粗、空氣動力學整流鰭擴展，局部器官機能極限放大",
      w: 11.4,
      impact: "high",
      retention: "med",
      transitions: ["stage1_to_2", "stage2_to_3"],
      prompt_guidance: "關鍵作戰或生存器官極端發育，利爪伸展為鐮刃、尾部擴展為推進鰭或重錘，骨骼管線粗化，保留幼原種核心頭部與眼眸輪廓。",
      positive_tokens: "anatomical specialized hypertrophy, elongated razor-sharp forelimbs, aerodynamic dorsal fin expansion, reinforced muscular conduits, signature facial DNA retained with heightened predatory focus",
      negative_tokens: "disproportionate deformed tumors, melted anatomy, random unrelated appendages"
    },
    {
      id: "elemental_mantle",
      zh: "元素披覆·屬性外顯",
      desc: "身軀裹覆半透明高溫電漿、低溫霜雲或幾何太晶能量斗篷，以太能量自關節外溢",
      w: 13.1,
      impact: "med",
      retention: "high",
      transitions: ["stage1_to_2", "stage2_to_3", "stage3_to_overload"],
      prompt_guidance: "半透明元素氣場或晶格斗篷自毛皮/鱗甲關節處外溢，體表裂紋隱現流動以太光，主體輪廓透過熱浪或冷霧清晰可辨。",
      positive_tokens: "enveloped in semi-transparent blazing plasma cloak, ethereal particle trails streaming from shoulder joints, cooling magma cracked skin along extremities, interior glow pulsing beneath scales, recognizable facial features visible through heat haze",
      negative_tokens: "flat solid color swap, completely obscured body silhouette, muddy textures, loss of eye contrast"
    },
    {
      id: "mood_metabolic_switch",
      zh: "心緒代謝·雙重本性",
      desc: "作戰激昂或飢餓觸發代謝失衡，眼眸黑化流光、尖齒外露、毛皮倒豎展現掠食狂暴第二本色",
      w: 1.2,
      impact: "med",
      retention: "high",
      transitions: ["stage1_to_2", "stage2_to_3"],
      prompt_guidance: "體內能量代謝突變，原本溫和或警戒之神態轉為銳利戰意，瞳孔收縮閃爍掠食光芒，毛皮倒豎如刺，骨架比例維持不變。",
      positive_tokens: "metabolic battle shift, fierce intense glowing irises, bristled defensive mane, sharp retracted fangs exposed, hyper-focused predator expression, exact underlying bone structure preserved",
      negative_tokens: "completely altered face, comical cartoon rage, melted eyeballs"
    },
    {
      id: "shell_break_core",
      zh: "破殼脫落·真身暴鳴",
      desc: "剝落外層沉重鈍質岩化裝甲，露出內部高精密靈巧晶核或脆弱高能光體，身形輕靈迅捷",
      w: 4.7,
      impact: "high",
      retention: "low",
      transitions: ["stage1_to_2", "stage2_to_3", "stage3_to_overload"],
      prompt_guidance: "外層防護岩層或厚甲碎裂脫落，飄散於身周，裸露出內部半透明高精密發光晶核本體，身形輕靈迅捷，核心面貌保留原始眼紋。",
      positive_tokens: "shattered containment carapace, cracking armor plating revealing incandescent crystal essence beneath, levitating fragments of broken shell, lightweight agile crystalline body, signature facial markings retained on inner core",
      negative_tokens: "empty broken shell without creature, amorphous blob, unreadable silhouette"
    },
    {
      id: "armed_arsenal",
      zh: "武裝著裝·攻防重構",
      desc: "外置機械外骨骼裝甲、背載式以太砲塔或浮游神兵環繞，符文甲冑嵌合",
      w: 14.3,
      impact: "high",
      retention: "high",
      transitions: ["stage2_to_3", "stage3_to_overload"],
      prompt_guidance: "配備符文外骨骼與重型甲冑（50%保留原生骨骼與五官，50%外裝強化），外掛武器或肩載火砲，金屬鉚釘與接縫發光導管。",
      positive_tokens: "equipped with heavy runic exoskeleton armor plating, shoulder-mounted arcane cannons, floating runic blade armaments, interlocking power conduits, 50% retained natural anatomy, 50% armored reinforcement",
      negative_tokens: "random floating metal junk, covering entire face, changing eye color, human hands"
    },
    {
      id: "symbiotic_fusion",
      zh: "合體牽絆·雙生同調",
      desc: "融合宿主器具或共生靈獸，展現嵌合式外肢、多重雙生感知器官",
      w: 6.4,
      impact: "high",
      retention: "med",
      transitions: ["stage2_to_3", "stage3_to_overload"],
      prompt_guidance: "生物與神話器具或第二共生靈獸深度嵌合，共生雙重神經感知鰭羽，外形兼具雙方核心符號，但以主宙獸五官為認知主軸。",
      positive_tokens: "biomechanical symbiotic fusion, dual-entity hybrid features, chimeric integration, secondary neural crest, harmonious chimeric anatomy",
      negative_tokens: "disjointed pasted parts, grotesque tumorous growth, severed floating pieces"
    },
    {
      id: "atavistic_primal",
      zh: "血脈返祖·遠古神威",
      desc: "骨刺穿透外皮逆向生長，體表開裂出流淌古代以太光的古神符文，散發蠻荒巨獸威壓",
      w: 3.2,
      impact: "med",
      retention: "high",
      transitions: ["stage2_to_3", "stage3_to_overload"],
      prompt_guidance: "遠古狂暴基因覺醒，頭頂與背脊粗獷骨刺銳化增生，體表凹槽烙印流動金光的古代幾何符文，散發蠻荒巨獸威壓。",
      positive_tokens: "ancient atavistic reversion, primordial ossified horns erupting from skull, ancestral runic glyphs burning with golden luminescence across dorsal ridge, aggressive bestial posture, weathered fossilized texture",
      negative_tokens: "futuristic neon cyberware, robotic seams, overly cute expression"
    },
    {
      id: "swarm_aggregation",
      zh: "群落聚合·萬生同體",
      desc: "萬千微型自律單體以流體力學集結為單一巨型深海/高空巨獸，共鳴重組為統一巨影",
      w: 2.3,
      impact: "extreme",
      retention: "low",
      transitions: ["stage2_to_3", "stage3_to_overload"],
      prompt_guidance: "本體由無數微型自律發光魚群、納米晶蟲或以太孢子緊密咬合構成，邊緣呈現游移分離之微粒雲，整體剪影維持原種巨獸威容。",
      positive_tokens: "composed of a massive schooling swarm, swirling luminous nano-entities forming collective monolithic beast, fluid-like outer contour, micro-elements swimming within silhouette, cohesive ocular cluster",
      negative_tokens: "static single solid plastic statue, blurry noise texture, unorganized dust cloud"
    },
    {
      id: "possession_assimilation",
      zh: "附身同化·機關寄宿",
      desc: "純能量/等離子靈體侵入人造星艦機關、古代遺物或生活載具，以器具為軀幹異化",
      w: 2.0,
      impact: "extreme",
      retention: "med",
      transitions: ["stage2_to_3", "stage3_to_overload"],
      prompt_guidance: "等離子靈體核心穿透並操控古代遺物機關或高科技機械裝置，機械儀表開合亮起靈魂光暈，原生五官以能量態投射於機關核心。",
      positive_tokens: "spectral technological possession, plasma entity infused into ancient relic mechanism, animated arcane gears and intake vents, spectral eyes glowing through machine chassis, mechanical spirit embodiment",
      negative_tokens: "lifeless pile of scrap, generic robot without ghostly soul, broken immobile junk"
    },
    {
      id: "monument_colossus",
      zh: "地標巨化·天穹異構",
      desc: "百倍巨構化，身體局部異變為浮空神殿、生機森林微地形或吞星黑洞巨口",
      w: 25.0,
      impact: "extreme",
      retention: "low",
      transitions: ["stage3_to_overload"],
      prompt_guidance: "尺度暴增至數十公尺天穹巨神，背部長成古樹小森林微生態，或巨口裂開為黑洞星門，周身環繞螺旋極巨雷雲，微觀細節襯托龐大比例。",
      positive_tokens: "colossal monumental scale, towering behemoth proportions, back transforming into a micro-ecosystem with ancient flora and stone monoliths, swirling atmospheric storm clouds around shoulders, micro-scale details indicating massive scale",
      negative_tokens: "normal creature on small hill, simple closeup, blurry distant background, generic giant with no scale cues"
    },
    {
      id: "hero_reveal",
      zh: "超人現身·神魄覺醒",
      desc: "徹底顛覆平庸無害之日常擬態外觀，展現肌肉爆發、雙足頂立英雄骨架與神威真容",
      w: 20.0,
      impact: "extreme",
      retention: "low",
      transitions: ["stage3_to_overload"],
      prompt_guidance: "卸下弱小無害的幼態偽裝，爆發為傲立天地的英武神靈戰軀，胸膛與四肢神經充盈金光神能，保留原生虹膜神采與標誌性頭冠印記。",
      positive_tokens: "dramatic heroic true form reveal, bipedal majestic demigod physique, surging champion aura, powerful defined muscular anatomy, signature facial iris and crest marking preserved on ascended face",
      negative_tokens: "generic superhero in spandex, human face with human nose, stiff action figure"
    }
  ],

  getEvolutionModesForTransition(key) {
    if (!key) return this.EVOLUTION_MODES;
    const trans = key === "adolescent" ? "stage1_to_2" :
      key === "adult" ? "stage2_to_3" :
      key === "overload" ? "stage3_to_overload" : key;
    return this.EVOLUTION_MODES.filter(m => m.transitions && m.transitions.includes(trans));
  },

  getEvolutionModesWithProbabilities(key, excludeId = null) {
    const trans = key === "adolescent" ? "stage1_to_2" :
      key === "adult" ? "stage2_to_3" :
      key === "overload" ? "stage3_to_overload" : key;
    const modes = this.getEvolutionModesForTransition(trans).filter(m => !excludeId || m.id !== excludeId);
    const getW = m => (m.transition_weights && m.transition_weights[trans]) ?? m.w ?? 1;
    const totalW = modes.reduce((acc, m) => acc + getW(m), 0);
    return modes.map(m => {
      const w = getW(m);
      const pct = totalW > 0 ? (w / totalW * 100).toFixed(1) : "0.0";
      return {
        ...m,
        effectiveWeight: w,
        probPct: pct,
        labelWithPct: `${m.zh}（${m.desc.split("、")[0]} · ${pct}%）`
      };
    });
  },

  resolveEvolutionPrompt(modeKey, stage, concept, subjectId) {
    if (stage === "juvenile") return null; // 第一階段不需要演化模式

    const PREV_STAGE_MAP = {
      adolescent: "juvenile",
      adult: "adolescent",
      overload: "adult"
    };
    const STAGE_ZH_MAP = {
      juvenile: "第一階（幼年）",
      adolescent: "第二階（少年）",
      adult: "第三階（成年）",
      overload: "超載型態"
    };

    const prevStage = PREV_STAGE_MAP[stage];
    if (!prevStage) return null;

    const prevStageZh = STAGE_ZH_MAP[prevStage] || prevStage;
    const S = subjectId || concept?.id || "<id>";
    const prevFrontImg = "images/cr_" + S + "_" + prevStage + "_front.png";

    let targetKey = modeKey;
    if (!targetKey || targetKey === "auto") {
      if (stage === "adolescent") targetKey = concept?.evo_stage1_to_2 || concept?.evolution_flow?.stage1_to_2 || "stance_reconfig";
      else if (stage === "adult") targetKey = concept?.evo_stage2_to_3 || concept?.evolution_flow?.stage2_to_3 || "armed_arsenal";
      else if (stage === "overload") targetKey = concept?.evo_stage3_to_overload || concept?.evolution_flow?.stage3_to_overload || "monument_colossus";
      else targetKey = "elemental_mantle";
    }
    const mode = this.EVOLUTION_MODES.find(m => m.id === targetKey) || this.EVOLUTION_MODES[0];
    const stageTransLabel = stage === "adolescent" ? "【第一階 ➔ 第二階】" :
      stage === "adult" ? "【第二階 ➔ 第三階】" :
      stage === "overload" ? "【第三階 ➔ 超載】" : "";

    return {
      mode,
      prevStage,
      prevStageZh,
      prevFrontImg,
      guideSection: [
        "## 參考圖與演化設定（基於前階正面圖 · " + mode.zh + "）",
        "- **輸入參考圖**：先上傳前一階正面基準圖 `" + prevFrontImg + "`（" + prevStageZh + "正面圖）作為本輪唯一視覺基底（Image-to-Image）。",
        "- **保留特徵（50% 鎖定）**：嚴格保留原生物面部五官結構、眼眸幾何特徵與瞳色、核心標誌特徵與雙色調，確保家族辨識度。",
        "- **本階進化（50% 突變）**：" + mode.prompt_guidance,
        "- **提示詞注入**：`" + mode.positive_tokens + "`",
        "- **負向排除**：`" + mode.negative_tokens + "`"
      ].join("\n")
    };
  },

  get PALETTES() { return this.COLOR_TONES; },

  // 角色性格與宙獸性情合併且共用
  PERSONALITIES: [
    "熱血", "冷靜", "害羞", "毒舌", "樂天", "好奇", "傲嬌", "沉穩", "衝動", "溫柔",
    "腹黑", "迷糊", "正義感強", "憤世嫉俗", "慵懶", "完美主義", "話很多", "寡言", "膽小但堅強", "自信過剩",
    "愛照顧人", "愛惡作劇", "堅毅不拔", "重情重義", "散漫隨性", "不拘小節", "好勝心切", "心軟善良", "謹慎過度", "狂妄不羈",
    "古靈精怪", "熱心腸", "死板認真", "隨遇而安", "護短", "深思熟慮", "機敏狡黠", "率真耿直", "愛操心", "豁達大度",
    "執著專注", "善解人意", "幽默風趣", "孤傲清冷", "自來熟",
    "溫順黏人", "好鬥凶悍", "膽怯機警", "高傲尊貴", "頑皮搗蛋", "沉默孤僻", "暴躁易怒", "警惕敏銳", "忠勇護主", "霸氣威嚴",
    "神秘莫測", "貪吃嗜睡", "狡詐靈動", "嗜好閃耀之物", "暴烈瘋狂", "護巢護崽", "好奇心過剩", "未知"
  ],

  CHARACTER: {
    // 角色人種：純粹外貌生理表型特徵，與文化地區互相獨立
    ethnicity: [
      { v: "東亞體系", w: 10, zh: "東亞體系（黑髮直髮、深褐瞳孔、溫潤黃調膚質、細緻面龐）" },
      { v: "東南亞/南島語族體系", w: 9, zh: "東南亞/南島體系（微卷深褐髮、深色雙瞳、健康小麥古銅膚色）" },
      { v: "南亞/印度河體系", w: 8, zh: "南亞體系（濃密黑鬈髮、大而深邃雙眸、暖棕至古銅膚色）" },
      { v: "中亞/突厥-歐亞體系", w: 7, zh: "中亞/歐亞體系（歐亞融合輪廓、高顴骨、琥珀/深褐眼、淺褐/黑髮）" },
      { v: "西亞/中東-閃米特體系", w: 7, zh: "西亞/中東體系（高挺立體鼻樑、波浪濃髮、橄欖膚色、深色長睫）" },
      { v: "北歐/日耳曼體系", w: 8, zh: "北歐體系（白皙膚色、淺金/白金/銀白髮、淺藍/灰藍眼、立體輪廓）" },
      { v: "凱爾特/不列顛體系", w: 7, zh: "凱爾特體系（火紅/金褐捲髮、明亮綠瞳/灰瞳、白皙膚質帶淺雀斑）" },
      { v: "地中海/南歐體系", w: 8, zh: "地中海體系（溫暖橄欖小麥膚、深褐波浪濃髮、深褐/琥珀眼）" },
      { v: "東歐/斯拉夫體系", w: 7, zh: "東歐/斯拉夫體系（明亮灰藍/淺綠眼、淺棕/金褐髮、清秀柔和輪廓）" },
      { v: "西非/班圖體系", w: 8, zh: "西非/班圖體系（緊緻捲曲黑髮、深邃黑曜瞳孔、飽滿深棕至黑曜石膚色、健美體格）" },
      { v: "東非/庫希特-尼羅特體系", w: 7, zh: "東非/尼羅特體系（修長四肢比例、高挑優雅輪廓、深棕膚色、杏形雙瞳）" },
      { v: "北非/柏柏爾-馬格里布體系", w: 6, zh: "北非/柏柏爾體系（淺褐至小麥膚色、深鬈髮、琥珀或淺褐色雙瞳）" },
      { v: "美洲原住民體系", w: 7, zh: "美洲原住民體系（烏黑濃密直髮、高顴骨、赤銅/暖褐膚色、銳利深褐眼）" },
      { v: "極地/因紐特-薩米體系", w: 6, zh: "極地體系（耐寒結實體型、黑直髮、紅潤小麥面頰、深色靈動雙眼）" },
      { v: "大洋洲/美拉尼西亞-玻里尼西亞體系", w: 6, zh: "大洋洲體系（高大健碩骨架、金色或深色捲髮、暖古銅膚色）" },
      { v: "多元混血/跨洲交融體系", w: 8, zh: "多元混血體系（融合多大洲面貌特徵、獨特氣質與異質面龐）" },
      { v: "奇幻星民特徵", w: 6, zh: "奇幻星民特徵（星痕印記、微光異色雙眸、輕微精靈尖耳、星塵髮色等架空特徵）" },
      { v: "未知", w: 2, zh: "未知（由生成自由決定人種外觀特質）" }
    ],
    gender: [ { v: "男", w: 50 }, { v: "女", w: 50 }, { v: "未知", w: 2 } ],
    age: [
      { v: "兒童", w: 10, min: 9, max: 12 },
      { v: "青少年", w: 50, min: 13, max: 19 },
      { v: "青年", w: 25, min: 20, max: 35 },
      { v: "中年", w: 10, min: 36, max: 55 },
      { v: "長者", w: 5, min: 56, max: 80 },
      { v: "未知", w: 2, min: 16, max: 25 }
    ],
    cup_sizes: [
      { v: "A", w: 12 }, { v: "B", w: 32 }, { v: "C", w: 30 }, { v: "D", w: 16 }, { v: "E", w: 6 }, { v: "F+", w: 3 }, { v: "未知", w: 2 }
    ],
    get outfit_palettes() { return window.COSMI_CATALOG.PALETTES; },
    hair_palettes: [
      { v: "自然黑", w: 16 },
      { v: "深栗褐", w: 14 },
      { v: "亞麻淺金", w: 12 },
      { v: "銀白", w: 12 },
      { v: "白金", w: 8 },
      { v: "石墨灰", w: 8 },
      { v: "薄荷青", w: 6 },
      { v: "海軍深藍", w: 6 },
      { v: "烈焰赤紅", w: 6 },
      { v: "櫻花粉", w: 6 },
      { v: "紫羅蘭", w: 6 },
      { v: "焦糖奶茶", w: 8 },
      { v: "酒紅", w: 6 },
      { v: "青木灰", w: 6 },
      { v: "香檳金", w: 7 },
      { v: "孔雀藍", w: 5 },
      { v: "珊瑚橘", w: 5 },
      { v: "純雪白", w: 8 },
      { v: "天藍", w: 6 },
      { v: "冰晶淡藍", w: 6 },
      { v: "丁香淡紫", w: 6 },
      { v: "挑染天藍", w: 7 },
      { v: "挑染緋紅", w: 7 },
      { v: "挑染白金", w: 6 },
      { v: "挑染薄荷綠", w: 6 },
      { v: "挑染亮紫", w: 5 },
      { v: "漸層粉櫻", w: 6 },
      { v: "漸層琥珀", w: 5 },
      { v: "未知", w: 2 }
    ],
    eye_palettes: [
      { v: "琥珀金", w: 16 },
      { v: "深海藍", w: 15 },
      { v: "黑曜石", w: 15 },
      { v: "翡翠綠", w: 14 },
      { v: "榛果褐", w: 12 },
      { v: "紫羅蘭", w: 8 },
      { v: "赤紅", w: 7 },
      { v: "冰藍", w: 8 },
      { v: "星空灰", w: 7 },
      { v: "石榴紅", w: 6 },
      { v: "青金石藍", w: 6 },
      { v: "蜂蜜茶褐", w: 7 },
      { v: "淡紫丁香", w: 6 },
      { v: "瑪瑙紅", w: 6 },
      { v: "金綠寶石", w: 6 },
      { v: "深墨黑", w: 8 },
      { v: "金 / 藍（異色瞳）", w: 8 },
      { v: "赤紅 / 黑（異色瞳）", w: 7 },
      { v: "翡翠綠 / 琥珀金（異色瞳）", w: 7 },
      { v: "紫羅蘭 / 冰藍（異色瞳）", w: 6 },
      { v: "碧綠 / 赤紅（異色瞳）", w: 6 },
      { v: "深海藍 × 外圈金環（雙色虹膜）", w: 6 },
      { v: "黑曜石 × 金色星芒（星瞳）", w: 6 },
      { v: "深紫 × 外圈銀環", w: 5 },
      { v: "琥珀金 × 外圈深黑", w: 5 },
      { v: "冰藍 × 外圈幽紫", w: 5 },
      { v: "未知", w: 2 }
    ],
    get personality() { return window.COSMI_CATALOG.PERSONALITIES; },
    style: [
      "星際探險裝", "街頭機能", "傳統民族服融合現代剪裁", "學院制服改造", "蒸汽龐克", "太陽龐克", "戶外登山", "復古運動",
      "魔法學徒袍", "機甲駕駛服", "遊牧旅人", "海洋水手", "賽博市集", "田園農作", "考古學者", "祭典華服改良",
      "賽博龐克駭客", "和風羽織機能", "哥德風格改裝", "波西米亞流蘇", "極地抗寒防風裝", "沙漠旅者防沙斗篷", "星宮神官祭袍",
      "復古工裝吊帶", "精靈森林編織", "宮廷華麗輕騎裝", "現代跑酷機能", "暗影夜行衣", "廢土拾荒改裝", "古典英倫偵探",
      "浪漫騎士風衣", "錬金術士大衣", "宇宙採礦防護服", "幻獸學者研究袍", "未知"
    ],
    interests: [
      "天文觀星", "料理", "攝影", "古代遺跡", "機械改裝", "音樂", "繪畫", "釣魚", "園藝", "武術",
      "收集化石", "寫日記", "滑板", "編織", "地圖測繪", "民俗傳說", "跑酷", "電子遊戲", "泡茶/咖啡", "觀察宙獸生態",
      "採集礦石標本", "魔導編程", "烹飪野炊", "修繕古機械", "野外露營", "素描寫生", "打水漂", "拓印碑文", "研究古星圖",
      "滑翔飛行", "收集舊郵票/徽章", "製作植物壓花", "研發奇特道具", "收集羽毛", "攀岩", "製作木雕", "調配香薰草藥",
      "吹奏笛樂", "占卜星象", "尋訪古道", "未知"
    ],
    likes: [
      "甜食", "下雨天", "毛茸茸的生物", "星空", "舊書", "熱湯", "高處的風", "閃亮的礦石", "熱鬧祭典", "安靜的清晨",
      "雷雨", "海浪聲", "手作物", "辣的食物", "老地圖", "乾爽的晴天", "篝火劈啪聲", "剛出爐的麵包香", "晨曦微風", "古代鐘錶的滴答聲",
      "毛茸茸的幼獸", "踩落葉的沙沙聲", "舊羊皮紙氣味", "高空俯瞰地景", "閃閃發光的貝殼", "溫暖的日光浴", "森林的泥土香", "冰涼的泉水", "脆脆的堅果",
      "觀星時的寂靜", "熟透的野果", "機械運轉的齒輪聲", "洗淨曬乾的棉布", "貓咪的呼嚕聲", "爐火旁的熱茶", "未知"
    ],
    dislikes: [
      "蟲子", "吵雜", "謊言", "高處", "黑暗", "苦味", "等待", "被小看", "冰冷的金屬", "濕衣服",
      "早起", "輸", "擁擠人群", "打雷", "濕黏的天氣", "指甲刮黑板的刺耳聲", "背叛與暗算", "毫無意義的爭吵", "停滯不前", "潮濕發霉的地下室",
      "過甜的油膩食物", "粗製濫造的機械", "被打斷思路", "突如其來的巨響", "繁瑣的繁文縟節", "浪費食物", "束縛感", "悶熱的封閉空間", "枯燥的長篇大論",
      "迷路", "苦澀的藥草", "沾到泥巴", "說教", "虛偽的奉承", "嚴寒凍僵的感覺", "未知"
    ],
    role: ["玩家角色預設外觀", "隊友 NPC", "大廳 NPC：研究員", "大廳 NPC：孵蛋師", "大廳 NPC：商人", "星球原住民 NPC", "對手訓練家", "未知"],
    role_poses: {
      "玩家角色預設外觀": [
        "單手握持收服道具準備投擲，身體側轉微屈，衣袍披風在風中飛揚，眼神堅毅自信",
        "手按腰側收服道具，迎風昂首踏在岩石上，另一手遮額遠眺前方未知宙域",
        "雙足分立沉穩戒備，右手自腰間利落抽出收服道具，周身帶有淡淡的蓄勢氣場",
        "側身回眸自信微笑，單手比出大拇指，另一手將收服道具拋接把玩"
      ],
      "隊友 NPC": [
        "背靠背掩護警戒姿態，單手前伸引導輔助法陣，神情專注沉穩支援隊友",
        "半蹲於高處巨岩邊緣，一手握持收服道具，銳利目光搜尋周遭敵蹤",
        "側身展開防護結界手勢，法袍斗篷翻卷，另一手緊握通訊法具回報戰況",
        "躍步向前掩護後方，雙手握持導能長杖點地，腳下浮現防護光環"
      ],
      "大廳 NPC：研究員": [
        "一手托著懸浮的全息數據晶片，另一手推著眼鏡低頭沉思記錄，學術氣息濃厚",
        "專注凝視手中展開的多維星盤儀器，指尖撥動發光的刻度符文，身旁懸浮著掃描光束",
        "側身展示手提箱中的發光宙獸樣本結晶，眼神充滿求知狂熱與自信解說姿態",
        "一手抱著厚重的皮革研究筆記本，另一手握著魔導測量筆在空中記錄光軌"
      ],
      "大廳 NPC：孵蛋師": [
        "雙手輕柔環抱著泛著溫潤微光的巨大宙獸蛋，低頭微笑傾聽蛋殼內的微弱心跳",
        "半蹲於草甸上，一手拿著溫熱奶瓶，另一手溫柔撫摸依偎在身旁的小巧幼獸",
        "腰間繫著保溫育幼袋，手持柔軟的靈絲毛刷，神情慈愛溫柔，周身散發安撫光暈",
        "雙手托起初次破殼的幼生體宙獸，眼中充滿喜悅與驚嘆，微風吹動髮梢"
      ],
      "大廳 NPC：商人": [
        "一手托著裝滿稀有宙晶的黃銅天平，另一手捻著金幣熱情招攬，面帶精明微笑",
        "半掀開掛滿各式收服道具與藥劑的旅行披風內襯，神秘兮兮地展示珍稀商品",
        "單手倚靠在堆滿封印箱的巨型馱獸鞍座旁，一手撥動算盤珠，悠閒抽著蒸氣菸斗",
        "雙手攤開展示掌心璀璨耀眼的罕見宙獸核心，自信滿滿地進行價格交涉"
      ],
      "星球原住民 NPC": [
        "雙手高舉圖騰戰矛，腳踏原始巨岩，昂首仰望蒼穹發出古老敬畏的祈禱長吟",
        "壓低身形如獵豹般伏行於巨木枝椏上，單手反握骨刃，身上圖騰隨呼吸隱隱發光",
        "盤坐於大地古陣中央，雙手貼地與星球地脈能量深度共鳴，自然之風環繞周身",
        "迎風吹響巨大海螺/巨獸犄角號角，眼神野性深邃，披風上的獸齒羽毛隨風劇烈翻卷"
      ],
      "對手訓練家": [
        "雙手插在長風衣口袋中側身佇立，下巴微抬，嘴角掛著狂妄挑釁的冷冽冷笑",
        "單手高高拋起收服道具，眼神銳利如鷹隼直視鏡頭，周身散發強烈壓迫戰意",
        "單手猛力甩動披肩斗篷，另一手指向前方宣告決鬥，身後氣流激盪呼嘯",
        "背對畫面微微側頭，露出一半冷酷眼神，指尖扣在收服道具卡位蓄勢待發"
      ],
      "未知": [
        "呈極具張力的冒險戰鬥架勢，右手握持收服道具，披風髮絲迎風翻卷，眼神冷靜銳利",
        "立足於高處斷崖，側身迎風佇立，單手按住腰側道具，深邃凝視遠方天際"
      ]
    },
    getRolePoses(role) {
      if (!role) return this.role_poses["未知"];
      return this.role_poses[role] || this.role_poses["未知"];
    }
  },

  CREATURE: {
    // 宙獸外觀基底父類別（大幅擴充：拆解植物/古生物、追加星體/珠寶/礦物/積木/兵器/防具、幻想生物按文化分拆）
    base_parents: [
      // 生物類
      { v: "生物·哺乳類", zh: "哺乳類", w: 10 },
      { v: "生物·鳥類", zh: "鳥類", w: 10 },
      { v: "生物·爬蟲類", zh: "爬蟲類", w: 10 },
      { v: "生物·兩棲類", zh: "兩棲類", w: 8 },
      { v: "生物·魚類", zh: "魚類", w: 8 },
      { v: "生物·昆蟲", zh: "昆蟲", w: 8 },
      { v: "生物·甲殼類", zh: "甲殼類", w: 7 },
      { v: "生物·軟體動物", zh: "軟體動物", w: 7 },

      // 植物拆解為更多父類別
      { v: "植物·樹木/神木", zh: "樹木/神木", w: 8 },
      { v: "植物·花卉/多肉", zh: "花卉/多肉", w: 8 },
      { v: "植物·草本/藤蔓", zh: "草本/藤蔓", w: 7 },
      { v: "植物·食蟲/肉食", zh: "食蟲/肉食植物", w: 7 },
      { v: "植物·蕈菇/真菌", zh: "蕈菇/真菌", w: 8 },
      { v: "植物·水生/藻類", zh: "水生植物/藻類", w: 6 },

      // 古生物拆解為更多父類別
      { v: "古生物·獸腳恐龍", zh: "獸腳恐龍（掠食巨獸）", w: 9 },
      { v: "古生物·植食恐龍", zh: "植食恐龍（重裝巨獸）", w: 8 },
      { v: "古生物·翼龍/飛行爬蟲", zh: "翼龍/飛行爬蟲", w: 8 },
      { v: "古生物·古海洋爬蟲/巨魚", zh: "古海洋爬蟲/巨魚", w: 8 },
      { v: "古生物·早古節肢/無脊椎", zh: "早古節肢/無脊椎（寒武紀/古生代）", w: 7 },
      { v: "古生物·新生代史前哺乳", zh: "新生代史前哺乳（冰河巨獸）", w: 8 },

      // 自然與無機物質類
      { v: "自然·星體", zh: "星體（恆星/黑洞/星雲/彗星）", w: 9 },
      { v: "物質·珠寶", zh: "珠寶（鑽石/紅寶/珍珠/歐泊）", w: 8 },
      { v: "物質·礦物", zh: "礦物（黑曜石/水晶/黃鐵/隕鐵）", w: 8 },
      { v: "造物·積木", zh: "積木（卡扣/磁吸/榫卯/發光）", w: 7 },

      // 裝備類（兵器、防具獨立父類別）
      { v: "裝備·兵器", zh: "兵器（劍/斧/矛/弩/法杖）", w: 9 },
      { v: "裝備·防具", zh: "防具（盾牌/重板甲/戰盔/臂鎧）", w: 8 },

      // 器械類
      { v: "器械·工具", zh: "工具", w: 6 },
      { v: "器械·樂器", zh: "樂器", w: 6 },
      { v: "器械·天文/測量儀器", zh: "天文/測量儀器", w: 7 },
      { v: "器械·機關人偶", zh: "機關人偶", w: 7 },
      { v: "器械·燈具/鐘錶", zh: "燈具/鐘錶", w: 6 },

      // 載具類
      { v: "載具·戰車", zh: "戰車", w: 6 },
      { v: "載具·帆船", zh: "帆船", w: 6 },
      { v: "載具·飛行器", zh: "飛行器", w: 7 },
      { v: "載具·列車", zh: "列車", w: 5 },
      { v: "載具·機車", zh: "機車", w: 5 },
      { v: "載具·熱氣球", zh: "熱氣球", w: 5 },
      { v: "載具·雪橇", zh: "雪橇", w: 4 },
      { v: "載具·潛水艇", zh: "潛水艇", w: 6 },

      // 科幻機械類（按技術領域與構裝形態拆分父類別）
      { v: "科幻機械·仿生機獸", zh: "仿生機獸（自律機獸/巡邏機犬/合金猛禽）", w: 8 },
      { v: "科幻機械·機甲/外骨骼", zh: "機甲/外骨骼（戰術機兵/動力骨骼/全覆裝甲）", w: 8 },
      { v: "科幻機械·重工/工程載具", zh: "重工/工程載具（深井盾構/液壓行者/碎岩採礦）", w: 7 },
      { v: "科幻機械·航太/深空探測", zh: "航太/深空探測（行星探測車/軌道光帆/深空探針）", w: 7 },
      { v: "科幻機械·能量/量子構裝", zh: "能量/量子構裝（曲率奇點核/浮游砲陣/相位環）", w: 7 },
      { v: "科幻機械·奈米/液態自律體", zh: "奈米/液態自律體（奈米蜂群/液態金屬核/微塵雲）", w: 7 },
      { v: "科幻機械·賽博/電子終端", zh: "賽博/電子終端（全像伺服矩陣/磁軌發射/電漿塔）", w: 6 },

      // 幻想生物類（不同文化拆不同父類別）
      { v: "幻想生物·東亞神獸", zh: "東亞神獸（青龍/白虎/朱雀/玄武/麒麟）", w: 9 },
      { v: "幻想生物·歐洲奇幻", zh: "歐洲奇幻（巨龍/獨角獸/獅鷲/雙足飛龍）", w: 9 },
      { v: "幻想生物·北歐/塞爾特", zh: "北歐/塞爾特幻獸（塵世巨蟒/芬里爾/水馬）", w: 8 },
      { v: "幻想生物·中東/西亞", zh: "中東/西亞幻獸（不死鳥/斯芬克斯/神鳥）", w: 8 },
      { v: "幻想生物·美洲神話", zh: "美洲神話幻獸（羽蛇神/雷鳥/溫迪戈鹿靈）", w: 7 },
      { v: "幻想生物·海洋/極地", zh: "海洋/極地怪獸（利維坦/北海巨妖/極光鯨）", w: 8 },
      { v: "幻想生物·異界/異形", zh: "異界/異形（虛空蠕蟲/高維幾何/外神子嗣）", w: 7 },

      // 類人奇幻種族（保留相容，舊版人形追溯為精靈族）
      { v: "類人奇幻·精靈族", zh: "精靈族（森/月/高等精靈）", w: 7 },
      { v: "類人奇幻·矮人族", zh: "矮人族（符文鐵匠/山脈氏族）", w: 6 },
      { v: "類人奇幻·獸人族", zh: "獸人族（荒原戰團/薩滿部落）", w: 6 },
      { v: "類人奇幻·龍人/蜥蜴人", zh: "龍人/蜥蜴人（龍脈裔/沼澤鱗戰士）", w: 6 },
      { v: "類人奇幻·妖精/半身人", zh: "妖精/半身人（花精/侏儒/幸運斥候）", w: 6 },
      { v: "類人奇幻·天使/天人", zh: "天使/天人（光翼神使/晨星座天人）", w: 6 },
      { v: "類人奇幻·惡魔/魔人", zh: "惡魔/魔人（深淵角魔/幽火魅魔）", w: 6 },
      { v: "類人奇幻·水棲人/塞壬", zh: "水棲人/塞壬（潮汐鮫人/深淵海歌）", w: 6 },
      { v: "類人奇幻·翼人/天狗", zh: "翼人/天狗（蒼穹鷹羽/風息天狗）", w: 6 },
      { v: "類人奇幻·不死/巫妖", zh: "不死/巫妖（冥魂巫妖/復生骸骨）", w: 5 },
      { v: "類人奇幻·傀儡/魔偶", zh: "傀儡/魔偶（發條機巧/古代符文石偶）", w: 6 },
      { v: "類人奇幻·巨人/泰坦", zh: "巨人/泰坦（山脈風暴/熔岩巨神後裔）", w: 5 },
      { v: "未知", zh: "未知", w: 2 }
    ],
    base_count: [ { n: 1, w: 40 }, { n: 2, w: 45 }, { n: 3, w: 15 } ],

    // 各父類別所屬之單一具體子類別庫（不合併多種生物，各項獨立且鮮明）
    base_sub_map: {
      "生物·哺乳類": [
        "獵豹", "雪豹", "美洲豹", "獅子", "西伯利亞虎", "黑豹", "灰狼", "赤狐", "北極狐",
        "赤鹿", "駝鹿", "羚羊", "野牛", "棕熊", "北極熊", "大貓熊", "虎鯨", "抹香鯨",
        "海獺", "海豹", "海象", "野兔", "果蝠", "吸血蝠", "飛鼠", "黑猩猩", "環尾狐猴",
        "穿山甲", "大食蟻獸", "犰狳", "刺蝟", "鴨嘴獸", "袋鼠", "樹懶"
      ],
      "生物·鳥類": [
        "白頭海鵰", "遊隼", "雪鴞", "倉鴞", "黑天鵝", "綠頭鴨", "帝王企鵝", "冠翠鳥", "蜂鳥",
        "非洲鴕鳥", "澳洲鶴", "大白鷺", "藍孔雀", "大極樂鳥", "紅鶴", "渡鴉", "巨嘴鳥",
        "銀喉長尾山雀", "金雕", "琴鳥"
      ],
      "生物·爬蟲類": [
        "科莫多巨蜥", "綠鬣蜥", "王者石龍子", "眼鏡王蛇", "綠樹蟒", "響尾蛇", "象龜", "綠蠵龜",
        "稜皮龜", "尼羅鱷", "密西西比短吻鱷", "高冠變色龍", "澳洲魔蜥", "傘蜥", "吉拉毒蜥"
      ],
      "生物·兩棲類": [
        "紅眼樹蛙", "黃金箭毒蛙", "南美角蛙", "巨型黑眶蟾蜍", "美西螈（六角恐龍）",
        "中國大鯢", "火蠑螈", "笠頭螈", "洞螈", "虎紋蠑螈"
      ],
      "生物·魚類": [
        "大白鯊", "鯨鯊", "路氏雙髻鯊", "巨型鬼蝠魟", "深海鮟鱇魚", "寬咽吞噬鰻",
        "拉蒂邁腔棘魚", "紅龍金龍魚", "巨骨舌魚", "錦鯉", "大西洋旗魚", "大西洋飛魚",
        "膨腹海馬", "草海龍", "電鰻", "深海帶魚", "翻車魚", "斑馬獅子魚", "小丑魚"
      ],
      "生物·昆蟲": [
        "長戟大兜蟲", "長頸鹿鋸鍬形蟲", "中華獨角仙", "蘭花螳螂", "魔花螳螂", "光明女神閃蝶",
        "透翅蝶", "烏桕大蠶蛾", "大虎頭蜂", "掠食切葉蟻", "子彈蟻", "巨脈蜻蜓", "放屁蟲",
        "黑螢火蟲", "神聖糞金龜", "水黽"
      ],
      "生物·甲殼類": [
        "椰子蟹", "堪察加帝王蟹", "弧邊招潮蟹", "甘氏巨螯蟹", "雀尾螳螂蝦", "美洲螯龍蝦",
        "大王具足蟲", "陸生寄居蟹", "鵝頸藤壺", "南極磷蝦"
      ],
      "生物·軟體動物": [
        "大王烏賊", "藍環章魚", "擬態章魚", "裸海蝶海天使", "大西洋海神海蛞蝓", "庫氏硨磲",
        "黑蝶珍珠貝", "珍珠鸚鵡螺", "非洲大蝸牛", "深海雨傘章魚"
      ],

      // 植物類
      "植物·樹木/神木": [
        "世界樹巨杉", "蒼天古柳", "千年銀杏", "白樺樹", "非洲猴麵包樹", "索科特拉龍血樹",
        "落羽杉", "高山雪松", "金合歡", "古榕樹"
      ],
      "植物·花卉/多肉": [
        "幽谷黑曼陀羅", "彼岸石蒜紅花", "高嶺天山雪蓮", "亞馬遜王蓮", "金琥仙人掌",
        "生石花", "阿諾爾特大花草（大王花）", "黑巴克玫瑰", "紫羅蘭", "鈴蘭"
      ],
      "植物·草本/藤蔓": [
        "熱帶絞殺榕藤", "紫藤花藤", "刺蒺藜蔓草", "發光星月草", "含羞草", "茵陳艾草",
        "蒲公英", "毛竹竹林"
      ],
      "植物·食蟲/肉食": [
        "二齒豬籠草", "捕蠅草", "圓葉茅膏菜", "捕蟲堇", "狂暴食人藤", "南方狸藻"
      ],
      "植物·蕈菇/真菌": [
        "發光夜光蕈", "美味牛肝菌", "毒蠅傘", "長裙竹蓀", "冬蟲夏草", "赤靈芝", "星狀地星菇", "菌絲共生網絡"
      ],
      "植物·水生/藻類": [
        "加州深海巨藻", "水晶鹿角珊瑚草", "發光夜光藻", "水蘊草", "浮萍", "海帶海草", "金魚藻"
      ],

      // 古生物類
      "古生物·獸腳恐龍": [
        "霸王龍/暴龍", "迅猛龍/伶盜龍", "埃及棘龍", "異特龍", "食肉牛龍", "重爪龍", "鐮刀龍", "牛龍"
      ],
      "古生物·植食恐龍": [
        "三角龍", "劍龍", "甲龍", "腕龍", "梁龍", "副櫛龍", "厚頭龍", "禽龍"
      ],
      "古生物·翼龍/飛行爬蟲": [
        "風神翼龍", "無齒翼龍", "翼手龍", "真雙型齒翼龍", "準噶爾翼龍"
      ],
      "古生物·古海洋爬蟲/巨魚": [
        "霍夫曼滄龍", "蛇頸龍", "魚龍", "鄧氏魚", "巨齒鯊", "薄板龍", "泰羅龍"
      ],
      "古生物·早古節肢/無脊椎": [
        "加拿大奇蝦", "三葉蟲", "板足鱟巨型海蠍", "菊石", "直角石", "怪誕蟲", "巨脈古蜻蜓"
      ],
      "古生物·新生代史前哺乳": [
        "真猛獁象", "毀滅劍齒虎", "恐狼", "大地懶", "雕齒獸", "板齒犀", "巨型短面熊", "駭鳥"
      ],

      // 自然與無機物質類
      "自然·星體": [
        "黃矮星太陽", "紅超巨星", "藍超巨星", "白矮星", "月球衛星", "哈雷彗星",
        "熾盛火流星", "史瓦西黑洞", "脈衝中子星", "小行星環帶", "獵戶座發光星雲", "極光電離層"
      ],
      "物質·珠寶": [
        "金剛石鑽石", "鴿血紅寶石", "皇家藍寶石", "哥倫比亞祖母綠", "帝王緬甸翡翠",
        "彩虹黑歐泊", "大溪地黑珍珠", "蜜蠟琥珀", "紅尖晶石", "深紫水晶", "海藍寶石"
      ],
      "物質·礦物": [
        "黑曜石", "石英水晶簇", "黃金硫鐵礦", "磁鐵礦星空隕鐵", "阿富汗青金石", "孔雀石",
        "螢石晶方", "白雲母片岩", "冰洲石方解石", "赤鐵礦", "沙漠玫瑰石", "火山玄武岩"
      ],
      "造物·積木": [
        "卡扣凸點塑膠積木", "微型拼接奈米積木", "釹磁鐵幾何積木", "傳統榫卯木積木",
        "發光導電電子積木", "連動齒輪機械積木", "透明水晶透光積木", "高密度海綿軟積木"
      ],

      // 裝備類（兵器、防具）
      "裝備·兵器": [
        "單手精鋼長劍", "雙手重裝巨劍", "刺劍西洋劍", "長槍騎士矛", "青龍戰戟",
        "雙刃開山斧", "破甲重裝戰錘", "晨星鐵蒺藜錘", "複合反曲長弓", "重型機械床弩",
        "淬毒暗殺匕首", "高速旋轉飛刃輪", "鎖鏈鐮刀流星錘", "古代符文魔導權杖", "重裝魔導手銃火砲"
      ],
      "裝備·防具": [
        "十字軍巨型塔盾", "圓形輕鋼手盾", "中世紀全身板甲", "騎士護心胸甲", "鎖子金屬環甲",
        "全覆式鐵面戰盔", "重裝鍛造臂鎧", "鋼鐵戰靴護腿", "黑龍鱗防護披風", "羽織防護斗篷", "符文重型護肩"
      ],

      // 器械類
      "器械·工具": [
        "鍛鐵重錘", "工匠鐵砧", "工程巨剪", "深井起重滑輪", "牽引絞盤", "鑿岩鑽頭", "挖掘鋼鏟", "精密游標卡尺"
      ],
      "器械·樂器": [
        "絲弦七弦古琴", "琵琶", "神聖古典豎琴", "巨型教堂管風琴", "編鐘排鐘", "青銅戰號", "蘇格蘭風笛", "戰陣太鼓", "陶笛"
      ],
      "器械·天文/測量儀器": [
        "青銅渾天儀", "航海六分儀", "赤道黃道儀", "指南地動儀", "天文折射望遠鏡", "水鐘刻漏", "精密雙擺錘"
      ],
      "器械·機關人偶": [
        "發條自鳴鐘琴人偶", "木牛流馬機關獸", "蒸氣壓力機械偶", "磁力共振懸浮偶", "千手木雕機巧偶"
      ],
      "器械·燈具/鐘錶": [
        "走馬琉璃提燈", "天文重錘擺鐘", "青銅星火燃燈台", "鍊金防爆礦燈", "古青銅神火燭台"
      ],

      // 載具類
      "載具·戰車": [
        "古代雙輪重裝戰車", "履帶蒸汽巡航裝甲車", "發條單輪衝擊戰車", "沙海風帆滑行車", "鑽地掘進工程車"
      ],
      "載具·帆船": [
        "多桅木造風帆戰列艦", "古代龜甲防禦鐵甲船", "雙體風帆水翼舟", "極地破冰明輪船", "靈巧威尼斯貢多拉"
      ],
      "載具·飛行器": [
        "撲翼仿生鳥機", "齊柏林硬式飛艇", "反重力空天浮舟", "螺旋升力雙翼飛機"
      ],
      "載具·列車": [
        "蒸汽火車頭", "重裝鐵甲列車", "山地齒軌登山列車", "懸浮導軌單軌列車", "雪原破冰機關列車"
      ],
      "載具·機車": [
        "復古重型蒸汽機車", "發條單輪陀螺機車", "履帶突擊雪地機車", "反重力懸浮滑行機車"
      ],
      "載具·熱氣球": [
        "蒸汽加熱探測熱氣球", "多氣囊探險吊籃", "發光水母浮空囊", "太陽能聚光浮空艙"
      ],
      "載具·雪橇": [
        "極地犬拉木雪橇", "風帆冰原滑行橇", "發條推力雪原橇", "蒸汽履帶雪橇車"
      ],
      "載具·潛水艇": [
        "早期球形深海觀測艇", "蝠鱝形深海探測潛艇", "發條動力機械潛艦", "透明琉璃深潛器"
      ],

      // 科幻機械類（各領域單一具體子基底）
      "科幻機械·仿生機獸": [
        "自律巡邏四足機犬", "光學迷彩合金黑豹", "合金刃羽仿生戰隼", "重裝履帶防衛機熊",
        "深潛擬態機械蝠鱝", "六足攀爬突擊機蛛", "自律多足機械蜈蚣", "深海合金機械巨鯨",
        "高頻聲吶機械白豚", "雙足迅捷機械奔龍"
      ],
      "科幻機械·機甲/外骨骼": [
        "高機動輕量外骨骼", "重裝液壓動力裝甲", "全天候戰術突擊機兵", "光學匿蹤迷彩防護裝甲",
        "反重力懸浮裝甲行者", "聚能屏障重型堡壘機甲", "神經同調近戰突擊裝甲", "四足重砲支援機兵"
      ],
      "科幻機械·重工/工程載具": [
        "超深層行星盾構掘進機", "重載雙臂液壓行者", "地表礦山巨型輪斗挖掘機", "高溫熔融合金鍛造機怪",
        "廢土防撞重型推土機", "高壓地熱抽取鑽塔核心", "履帶重裝岩層粉碎機", "全地形吊臂救援工程裝甲"
      ],
      "科幻機械·航太/深空探測": [
        "全地形多輪行星漫遊車", "超輕質太陽光帆展開體", "深空引力波觀測探針", "小行星彗星採樣自律機",
        "極端大氣沉降隔熱登陸艙", "軌道穿梭自律對接艦", "低軌星鏈通信矩陣核心"
      ],
      "科幻機械·能量/量子構裝": [
        "曲率躍遷奇點核心", "環形超導強子對撞環", "浮游感應磁軌砲陣列", "相位偏折匿蹤發生器",
        "零點真空能共鳴立方", "反物質磁拘束封印爐", "高維弦震盪能量晶核"
      ],
      "科幻機械·奈米/液態自律體": [
        "自律聚合液態金屬核", "微型自律修復奈米蜂群", "高密度巡飛彈幕微型機群", "自我複製結晶化奈米單元",
        "微塵感測氣溶膠雲體", "磁性流體重構刺球", "分子解構共生奈米雲"
      ],
      "科幻機械·賽博/電子終端": [
        "超導電磁軌道發射器", "全像投影神經伺服中樞", "高頻特斯拉電漿線圈塔", "光子運算晶體矩陣",
        "低溫超導伺服巨塔", "量子加密通訊天線陣"
      ],

      // 幻想生物類（不同文化分拆獨立）
      "幻想生物·東亞神獸": [
        "青龍神龍", "白虎", "朱雀神鳥", "玄武龜蛇", "瑞獸麒麟", "九尾天狐", "納財貔貅", "饕餮",
        "垂天之翼鯤鵬", "三足金烏", "歲除年獸", "知萬物白澤", "龍子囚牛", "龍子睚眥"
      ],
      "幻想生物·歐洲奇幻": [
        "西方噴火巨龍", "雙足飛龍", "純白獨角獸", "獅鷲格里芬", "鷹馬駿鷹", "黃金飛馬天馬",
        "石化蜥蜴蛇怪", "九頭蛇海德拉", "三頭奇美拉", "塞蓮水妖", "蠍尾獅曼提柯爾", "石像鬼"
      ],
      "幻想生物·北歐/塞爾特": [
        "塵世巨蟒耶夢加得", "噬月魔狼芬里爾", "黑龍尼德霍格", "八足神駒斯萊普尼爾",
        "克爾派水馬", "暗影獵犬庫西", "深淵海怪克拉肯", "報喪女妖幽魂"
      ],
      "幻想生物·中東/西亞": [
        "不死鳥菲尼克斯", "斯芬克斯獅身翼獸", "西穆魯格神鳥", "巨鵬洛克鳥",
        "火精靈伊芙利特", "水巨靈瑪里德", "沙暴巨蟲"
      ],
      "幻想生物·美洲神話": [
        "綠羽金星羽蛇神", "雷鳴巨鳥雷鳥", "溫迪戈鹿角靈", "彩虹角蛇",
        "阿維索特爾食人水怪", "卡馬佐茲嗜血蝠神"
      ],
      "幻想生物·海洋/極地": [
        "深海巨獸利維坦", "北海巨妖大王章魚", "極夜極光巨鯨", "冰原猛獁霜靈",
        "極地寒霜巨蜥", "深海發光水母怪", "冰河長牙海象巨靈"
      ],
      "幻想生物·異界/異形": [
        "星界虛空蠕蟲", "多維超幾何晶體靈", "維度裂隙浮水母", "外神黑山羊幼嗣",
        "以太星雲遊走體", "引力坍縮黑洞獸", "超弦振動能量體"
      ],

      // 類人奇幻種族（保留既有相容對照）
      "類人奇幻·精靈族": ["高等月光祭司精靈", "森林巡林遊俠精靈", "暗影潛行夜刃精靈", "冰霜詠雪精靈", "太陽晨曦騎士精靈", "血色魔導精靈"],
      "類人奇幻·矮人族": ["符文鍛造鐵匠矮人", "深地採礦戰士矮人", "重裝盾衛矮人", "烈火狂暴者矮人", "精密工程師矮人"],
      "類人奇幻·獸人族": ["狂暴戰吼督軍獸人", "荒原薩滿長老獸人", "狼騎獵手獸人", "血斧蠻鬥士獸人", "獸骨圖騰衛士獸人"],
      "類人奇幻·龍人/蜥蜴人": ["龍脈吐息戰士龍人", "金龍術士龍人", "深沼毒牙蜥蜴人", "黑曜龍鱗重甲兵", "飛翼龍血斥候"],
      "類人奇幻·妖精/半身人": ["花仙妖精皮克西", "森林小仙靈", "半身人幸運斥候", "地精發明狂", "蒲公英妖精"],
      "類人奇幻·天使/天人": ["六翼熾天使", "白銀審判天人", "黎明琴師天使", "神聖座天使", "晨星引路天人"],
      "類人奇幻·惡魔/魔人": ["深淵赤角戰魔", "幽火魔人術士", "暗影魅魔遊俠", "黑曜石化惡魔", "裂隙虛空魔裔"],
      "類人奇幻·水棲人/塞壬": ["潮汐鮫人海歌者", "深海深淵塞壬", "珊瑚鱗片戰士", "水月人魚祭司", "巨浪馭水客"],
      "類人奇幻·翼人/天狗": ["蒼穹鷹身翼人", "高山黑羽天狗", "白鳥風息羽人", "雷鳴疾風投矛翼人"],
      "類人奇幻·不死/巫妖": ["冥魂白骨死靈", "骸骨黑騎", "幽靈怨女", "長生巫妖法王", "詛咒復生行屍"],
      "類人奇幻·傀儡/魔偶": ["發條齒輪機巧偶", "符文巨石魔像", "黃銅蒸氣魔像", "琉璃晶核人偶", "自律水銀人偶"],
      "類人奇幻·巨人/泰坦": ["風暴泰坦雷神裔", "山脈岩石巨人", "極地霜雪巨人", "熔岩火山巨怪"],

      // 舊版本相容追溯
      "生物·植物/菌類": ["世界樹巨杉", "幽谷黑曼陀羅", "發光夜光蕈", "熱帶絞殺榕藤", "二齒豬籠草"],
      "生物·古生物": ["霸王龍/暴龍", "三角龍", "風神翼龍", "鄧氏魚", "三葉蟲", "真猛獁象"],
      "器械·武器": ["單手精鋼長劍", "雙手重裝巨劍", "青龍戰戟", "破甲重裝戰錘", "複合反曲長弓", "重型機械床弩"],
      "人形·戰士": ["類人奇幻·精靈族·高等月光祭司精靈", "類人奇幻·精靈族·森林巡林遊俠精靈"],
      "人形·術士": ["類人奇幻·精靈族·高等月光祭司精靈", "類人奇幻·精靈族·血色魔導精靈"],
      "人形·工匠": ["類人奇幻·精靈族·森林巡林遊俠精靈"],
      "人形·舞者": ["類人奇幻·精靈族·高等月光祭司精靈"],
      "人形·僧侶/修行者": ["類人奇幻·精靈族·太陽晨曦騎士精靈"],
      "人形·孩童精靈": ["類人奇幻·妖精/半身人·花仙妖精皮克西", "類人奇幻·妖精/半身人·森林小仙靈"],
      "未知": ["自由發揮未知子類"]
    },

    get appearance_palettes() { return window.COSMI_CATALOG.PALETTES; },
    role: [
      "前排肉盾/坦克", "近戰爆發刺客", "遠程火力射手", "群體持續傷害/DOT", "戰術控場/牽制封鎖",
      "輔助治療/生命共鳴", "團隊增益/光環守護", "場地佈署/陣地構築", "空中游擊/截擊", "高速突襲/破陣先鋒",
      "干擾削弱/詛咒削弱", "自爆/致命反傷護衛", "指揮/僕從群體召喚", "未知"
    ],
    get temperament() { return window.COSMI_CATALOG.PERSONALITIES; },

    // 體型變化組合（加入 XS，並擴充多樣化階梯組合）
    size_profile: [
      { v: "XS→XS→S→M", w: 10 },
      { v: "XS→S→S→M",  w: 12 },
      { v: "XS→S→M→M",  w: 15 },
      { v: "XS→S→M→L",  w: 18 },
      { v: "XS→M→L→XL", w: 10 },
      { v: "S→S→M→L",   w: 20 },
      { v: "S→M→M→L",   w: 35 },
      { v: "S→M→L→L",   w: 30 },
      { v: "S→M→L→XL",  w: 25 },
      { v: "S→L→L→XL",  w: 12 },
      { v: "M→M→L→XL",  w: 15 },
      { v: "M→L→L→XL",  w: 18 },
      { v: "M→L→XL→XL", w: 10 },
      { v: "L→L→XL→XL", w: 8 },
      { v: "未知",        w: 2 }
    ],

    // 文化原型庫：全面調整為神祇/英雄/名人對應的「形象/象徵/特徵/意義/神物」，避免生成過度偏向人形
    archetypes: [
      // 東亞
      { region: "東亞", name: "金烏神弓·墜日長炎（后羿意象）", type: "神鳥/神弓/墜日", motifs: "九日金烏赤羽、耀日神弓、貫空長矢、赤金烈陽熔炎", meaning: "破除暗夜、拯救萬物的烈日神箭與不滅意志", sensitivity: "ok" },
      { region: "東亞", name: "銜石赤鳥·翻浪怒濤（精衛意象）", type: "神鳥/填海石/怒潮", motifs: "花首白喙赤足神鳥、玄石彩晶、洶湧深海狂浪", meaning: "至死不渝、誓平怒海的堅毅靈鳥", sensitivity: "ok" },
      { region: "東亞", name: "桃林古木·逐日長杖（夸父意象）", type: "遠古神木/大澤巨靈/烈陽", motifs: "參天巨木權杖、生機桃林神果、乾涸萬里長川、金日長影", meaning: "追逐極致光明、身隕化為豐茂天地的壯烈生機", sensitivity: "ok" },
      { region: "東亞", name: "金箍祥雲·七十二相（齊天意象）", type: "如意金箍/筋斗祥雲/千相靈猴", motifs: "如意金箍神鐵、熾熱火眼金睛、疾馳筋斗雲霞、七十二變金毛", meaning: "掙脫天地桎梏、大鬧天宮的傲骨靈聖", sensitivity: "ok" },
      { region: "東亞", name: "萬里浮槎·星盤神舟（鄭和意象）", type: "寶船巨艦/星盤羅盤/航海瑞獸", motifs: "九桅十二帆古船木甲、青銅水羅盤、牽星星板、長頸麒麟貢獸", meaning: "跨越七海風暴、通好萬邦的遠洋航海開拓精神", sensitivity: "ok" },
      { region: "東亞", name: "候風地動·金龍吐珠（張衡意象）", type: "渾天星儀/地動金龍/承珠蟾蜍", motifs: "青銅渾天雙環儀、青銅八首銜珠金龍、昂首張口承珠蟾蜍、地脈感應機關", meaning: "感應天地脈動、量度寰宇星漢的科學智慧", sensitivity: "ok" },
      { region: "東亞", name: "錦桃破浪·三靈隨行（桃太郎意象）", type: "神桃靈種/犬猿雉三獸", motifs: "裂石破浪仙桃、白犬靈犬牙、智慧靈猿手、彩雉穿雲羽、金黍糰光芒", meaning: "討伐惡鬼、凝聚夥伴正義的討伐遠征", sensitivity: "ok" },
      { region: "東亞", name: "龍宮金龜·玉函青煙（浦島太郎意象）", type: "千年靈龜/深海龍宮/時光玉匣", motifs: "深海發光靈龜背甲、珊瑚珍珠龍宮神殿、玉手箱時空青煙", meaning: "穿越時光深淵、探索深海奧秘的滄桑神性", sensitivity: "ok" },
      { region: "東亞", name: "鐵甲龜甲·鶴翼連環（李舜臣意象）", type: "鐵甲龜甲船/龍頭噴煙/鶴翼戰陣", motifs: "鐵甲覆背鐵刺、龍首噴吐硫磺濃煙、鶴翼陣戰鼓、海潮伏擊之影", meaning: "背水一戰、堅不可摧的鐵甲戰陣與衛國忠魂", sensitivity: "ok" },
      { region: "東亞", name: "玄圭測雨·字韻刻版（世宗大王意象）", type: "測雨銅器/金屬活字/日晷刻度", motifs: "青銅測雨圓筒、天象仰釜日晷、訓民正音幾何活字、天圓地方星象圖", meaning: "敬天恤民、創造符號與測量自然之理的文明創制", sensitivity: "ok" },
      { region: "東亞", name: "南華蝶夢·虛實雙生（莊周意象）", type: "幻彩幻蝶/虛實陰陽/化鯤之鵬", motifs: "深青展翼幻蝶、水擊三千里之鯤鵬、虛實相生漣漪、逍遙浮雲氣流", meaning: "齊物萬生、超脫虛實邊界的逍遙哲思", sensitivity: "ok" },
      { region: "東亞", name: "廣寒冰桂·搗藥白兔（嫦娥意象）", type: "太陰寒月/不死仙桂/搗藥月兔", motifs: "千丈廣寒玄冰月宮、不落玉桂金花、玉杵搗靈藥白兔、冷香雲霓", meaning: "守望人間的清冷高潔與長生神華", sensitivity: "ok" },
      { region: "東亞", name: "巧奪天工·木鳶魯班鎖（魯班意象）", type: "機關木鳶/六柱神鎖/墨斗鋸齒", motifs: "三天三夜飛翔木鳶、交錯無縫魯班鎖、玄青墨線、金屬齒輪連動", meaning: "極致機巧、構建世間建築萬物的匠神道心", sensitivity: "ok" },
      { region: "東亞", name: "斷橋素傘·雷峰雙蛇（白蛇意象）", type: "靈蛇素鱗/青竹傘影/水漫波濤", motifs: "千年白錦蛇鱗、青鱗劇毒游蛇、油紙素傘微光、漫天倒灌滔滔洪峰", meaning: "歷經千劫、水漫金山以撼天條的真情與靈蛇狂瀾", sensitivity: "ok" },
      { region: "東亞", name: "三昧風火·混天靈珠（哪吒意象）", type: "風火雙輪/混天紅綾/靈珠蓮花", motifs: "足踏呼嘯風火雙輪、翻江倒海混天綾、堅不可摧乾坤圈、三頭六臂蓮花靈骨", meaning: "逆天涅槃、粉身碎骨化作烈火蓮花的戰靈豪情", sensitivity: "review" },
      { region: "東亞", name: "天羽羽斬·八岐狂嵐（須佐之男意象）", type: "十拳神劍/八首蛇龍/海陸暴風", motifs: "天羽羽斬十拳劍、八岐巨蛇赤睛、海嘯逆捲狂風、酒氣金芒", meaning: "斬除妖禍、引動天地暴風狂嵐的勇武狂神", sensitivity: "review" },
      { region: "東亞", name: "干戚雙舞·斷首怒目（刑天意象）", type: "雙乳為目/巨斧戰盾/不滅戰意", motifs: "破山巨斧長戚、玄鐵堅盾、常羊山怒岩、永不低頭的斷首戰姿", meaning: "頭斷身死而戰志不竭、與天爭雄的不屈狂戰意象", sensitivity: "review" },
      { region: "東亞", name: "雙日齊現·遠征落日（台灣原住民射日意象）", type: "熾熱雙日/長程遠征/幼木成蔭", motifs: "焦土雙輪酷日、世代接力長弓箭袋、肩負幼子出征的足跡、金黃柚木落蔭", meaning: "跨越數代人的犧牲遠征、還世間清涼天日的部族史詩", sensitivity: "review" },

      // 南亞
      { region: "南亞", name: "四首雄獅·永恆法輪（阿育王意象）", type: "石柱獅首/正義法輪/石刻聖諭", motifs: "阿育王石柱四方咆哮雄獅、二十四輻正義金輪、孔雀帝國蓮花柱頭", meaning: "放下屠刀、以慈悲真理統御四方的神聖威儀", sensitivity: "ok" },
      { region: "南亞", name: "圓極為零·日月星道（阿耶波多意象）", type: "虛空零元/日食星盤/地動旋道", motifs: "象徵虛空與圓滿的「零」之符文、地球自轉軌道環、日月食天象儀", meaning: "洞悉星體自轉與數學虛空奧秘的智慧源泉", sensitivity: "ok" },
      { region: "南亞", name: "雨季甘霖·青雲飛使（迦梨陀娑意象）", type: "雨季青雲/梵音長卷/雪山青蓮", motifs: "雷雲翻湧的信差青雲、梵文金字雨絲、喜馬拉雅雪峰、盛開藍睡蓮", meaning: "寄情天地風雲、傳遞深情至萬里雪原的詩韻之魂", sensitivity: "ok" },
      { region: "南亞", name: "大鵬金翅·降伏龍蛇（迦樓羅意象）", type: "烈日金翅/金翅鳥王/降蛇靈爪", motifs: "萬丈耀眼金色巨羽、吞噬諸天龍蛇之長爪、烈日冠冕、撼動須彌神風", meaning: "焚盡毒邪、翱翔諸天無人能阻的金色守護者", sensitivity: "ok" },
      { region: "南亞", name: "智慧象首·斷牙著典（葛內舍意象）", type: "象神靈首/智慧折牙/吉祥法器", motifs: "靈動象首與單根神聖斷牙、書寫摩訶婆羅多的神筆、套索金斧、甜品甘露", meaning: "破除一切前行障礙、帶來豐裕祥瑞的無邊智慧", sensitivity: "ok" },
      { region: "南亞", name: "破魔神弓·海石長橋（羅摩意象）", type: "天界神弓/浮海萬石/靈猴神軍", motifs: "無上破邪天弓Kodanda、漂浮深海跨洲石橋、破曉金光", meaning: "恪守誓約、蕩滌世間黑暗暴政的光輝正道", sensitivity: "review" },
      { region: "南亞", name: "曼陀羅千手·神螺金輪（那羅延意象）", type: "千手神光/妙見金輪/法螺金杖", motifs: "妙見神輪Sudarshana Chakra、右旋法螺Panchajanya、沉睡於千頭神蛇阿難陀之背", meaning: "維持宇宙秩序輪迴、在毀滅中維繫生機的慈悲守護", sensitivity: "review" },

      // 東南亞
      { region: "東亞/東南亞", name: "七月吞海·巨角海龍（巴庫納瓦意象）", type: "吞月海龍/巨響銅鑼/深海暗潮", motifs: "吞噬七個月亮的黑曜石巨龍、激盪夜空的銅鑼聲波、深海火山熔岩角", meaning: "引發天地日食月食、撼動海陸潮汐的古老巨獸", sensitivity: "ok" },
      { region: "東南亞", name: "鋼筋鐵骨·天空飛翼（加多卡加意象）", type: "鐵骨神將/皮影金翼/雷鳴飛遁", motifs: "刀槍不入黑金身軀、金色飛翔斗篷Antakusuma、震碎地脈的雷鳴重踏", meaning: "無畏犧牲、在空中如同雷霆般保衛同胞的鋼鐵英雄", sensitivity: "ok" },
      { region: "東南亞", name: "雙騎戰象·青銅雄鼓（徵氏姊妹意象）", type: "雙雙巨象/古青銅鼓/起義戰旗", motifs: "披掛金甲並排衝鋒的雙戰象、東山青銅鼓轟鳴、熱帶密林呼嘯風雨", meaning: "巾幗抗敵、喚醒南方民族自尊的自由戰魂", sensitivity: "ok" },
      { region: "東亞/東南亞", name: "鐵馬噴火·拔竹破陣（扶董天王意象）", type: "噴火鐵馬/巨木竹叢/暴長戰靈", motifs: "足踏烈焰噴吐神火的黑鐵戰馬、折斷化為千桿標槍的巨竹叢、如山岳挺拔的威嚴", meaning: "在一夕之間救國於危難、事畢回歸蒼穹的天降守護神", sensitivity: "ok" },
      { region: "東南亞", name: "迷霧翠巒·金果鹿影（瑪麗亞·瑪基林意象）", type: "翠嵐山靈/金光野果/森林鹿群", motifs: "翡翠雲霧環繞的山巒、純金閃爍野生果實、守護山林的白鹿角、甘甜清泉", meaning: "庇護山林動植物生生不息的大自然豐饒精魄", sensitivity: "ok" },
      { region: "東南亞", name: "金光皮影·寶石天鹿（金角金鹿意象）", type: "皮影金光/璀璨寶石角/熱帶幻獸", motifs: "薄如蟬翼的鏤空皮影金光、鑲嵌五彩寶石的七叉角、穿梭於熱帶雨林的幻影足跡", meaning: "誘惑與美麗共存、考驗旅人純真之心的雨林幻影", sensitivity: "ok" },

      // 西亞/中東
      { region: "西亞/中東", name: "天之神牛·遠古雪松靈（吉爾伽美什意象）", type: "金角神牛/雪松古木/黃金板甲", motifs: "踏碎地脈的天之神牛雙角、黎巴嫩雪松古樹林、蘇美楔形泥板、黃金英雄護腕", meaning: "直面死亡恐懼、在尋求永生之旅中覺醒的古老英雄王霸氣", sensitivity: "ok" },
      { region: "西亞/中東", name: "八芒晨星·冥府七門（伊南娜意象）", type: "金星八芒/冥界門扉/天之青金石", motifs: "璀璨金星八角星芒、層層褪去防護的冥界七道深邃門扉、青金石權杖、獵豹戰座", meaning: "從幽冥深淵重生、執掌愛欲與狂暴戰火的拂曉神輝", sensitivity: "ok" },
      { region: "西亞/中東", name: "島嶼巨鯨·天翔大鵬（辛巴達意象）", type: "背負巨樹島鯨/遮天大鵬鳥/海圖羅盤", motifs: "被誤認為綠洲海島的深海巨鯨背脊、巨鵬鳥銜巨蟒雙翼、七次航海的冒險星盤", meaning: "歷經不可思議之海怪與奇境、永不向命運屈服的冒險之魂", sensitivity: "ok" },
      { region: "西亞/中東", name: "醫典長卷·百草萃取（伊本·西那意象）", type: "醫典寶卷/蒸餾草藥/精準星盤", motifs: "厚重羊皮紙《醫典》長卷、蒸餾精油玫瑰水琉璃器、草藥根系金光、阿拉伯星盤", meaning: "融合哲學與自然草木、探究生命健康規律的理性典範", sensitivity: "ok" },
      { region: "西亞/中東", name: "代數幾何·沙盤天星（花拉子米意象）", type: "演算法幾何/星盤經緯/沙盤方圓", motifs: "交織的代數演算法幾何圖紋、精密象限儀弧線、乾涸沙漠中的對稱幾何水渠", meaning: "以數學重塑世界認知、開啟近代科學算法的幾何宗師", sensitivity: "ok" },
      { region: "西亞/中東", name: "千夜天毯·魔燈青煙（天方夜譚意象）", type: "飛翔織毯/神燈藍煙/千夜傳奇", motifs: "波斯紋樣懸浮飛行毛毯、古銅神燈湧出的幽藍巨靈煙雲、永不終結的星空說書卷軸", meaning: "以故事拯救生命、以奇想穿透漫長黑夜的幻想瑰寶", sensitivity: "ok" },
      { region: "西亞/中東", name: "玄武石柱·公平天平（漢摩拉比意象）", type: "黑玄武岩石柱/正義天平/太陽神權杖", motifs: "刻滿楔形文字的黑色玄武岩巨柱、太陽神沙瑪什交予的權杖、以眼還眼的公平天平", meaning: "在蠻荒中樹立第一座正義標尺、確立人間秩序的法典基石", sensitivity: "ok" },
      { region: "西亞/中東", name: "六芒魔戒·黃銅封印壺（所羅門意象）", type: "六芒星戒指/黃銅封魔壺/七十二柱靈", motifs: "鐫刻神聖秘名的金屬魔戒、刻滿封印符文的黃銅壺蓋、駕馭風暴與精靈的神聖律令", meaning: "統御自然萬物萬靈、洞察天地至深奧秘的智慧之王", sensitivity: "review" },

      // 非洲
      { region: "非洲", name: "黑曜胡狼·真理天秤（阿努比斯意象）", type: "黑金胡狼/真實之羽/審判天平", motifs: "黑曜石修長胡狼獸首、稱量心臟的瑪特金色天平、純白真實之羽、防腐黃金裹布", meaning: "穿透靈魂偽裝、守護往生通道的肅穆正義", sensitivity: "ok" },
      { region: "非洲", name: "朝陽神隼·真理神眸（荷魯斯意象）", type: "天空神隼/荷魯斯之眼/金色太陽盤", motifs: "展翅翱翔的天空神隼雙翼、象徵癒合與全知的荷魯斯藍金神眼、雙重紅白天冠", meaning: "戰勝混沌、引領黎明與光明復甦的天界王權", sensitivity: "ok" },
      { region: "非洲", name: "萬絲結網·故事金盒（阿南西意象）", type: "百智巧蛛/金色故事盒/銀色蛛絲", motifs: "編織萬物因果的精巧金蛛絲、裝著天地所有故事的黃金葫蘆、靈巧閃避巨獸的機敏身影", meaning: "以弱勝強、用無窮機智突破困局的傳奇說書者", sensitivity: "ok" },
      { region: "非洲", name: "重鐵長杖·雄獅戰魂（松迪亞塔意象）", type: "開路重鐵杖/荒原雄獅/曼丁琴聲", motifs: "折彎大地撐起身軀的黑鐵神杖、馬利帝國咆哮雄獅鬃毛、科拉琴伴隨的史詩歌謠", meaning: "克服殘缺命運、在荒原上開創黃金盛世的雄獅意志", sensitivity: "ok" },
      { region: "非洲", name: "黃金砂海·萬駝朝聖（曼薩·穆薩意象）", type: "黃金砂丘/千里商隊/泥磚清真寺塔", motifs: "如同河流傾瀉的純金金砂、浩浩蕩蕩千頭駱駝商隊、廷巴克圖日曬泥磚高塔、星光羅盤", meaning: "照亮撒哈拉貿易之路、連通跨大洲文明的富饒極致", sensitivity: "ok" },
      { region: "非洲", name: "談判座石·破陣銀弓（恩津加女王意象）", type: "女王之石/銀弦戰弓/外交羽印", motifs: "不卑不亢的石座印信、射穿侵略者鐵甲的硬木長弓、安哥拉紅土防線、豹皮戰袍", meaning: "誓死捍衛家園土地、絕不屈膝的鐵血尊嚴", sensitivity: "ok" },
      { region: "非洲", name: "獅身人面·永恆謎題（斯芬克斯意象）", type: "黃金巨獅/雄鷹展翼/永恆之謎", motifs: "臥伏於黃沙之中的黃金巨獅身軀、遮蔽日光的鷹羽雙翼、凝視歲月的古埃及石雕輪廓", meaning: "守護法老陵寢與天地奧秘、叩問靈魂智慧的永恆巨獸", sensitivity: "ok" },
      { region: "非洲", name: "黑曜靈貓·歡慶青銅鈴（芭絲特意象）", type: "神聖黑貓/歡慶搖鈴Sistrum/金項圈", motifs: "高貴敏捷的黑曜石靈貓身姿、驅逐瘟疫惡靈的青銅神鈴、保護家庭與母幼的柔和月光", meaning: "在優雅與凶悍間轉換、守護家園免受蛇蠍侵害的靈貓守護神", sensitivity: "ok" },
      { region: "非洲", name: "赤白雙刃·雷霆暴石（尚戈意象）", type: "雙刃雷斧/天降雷石/赤白烈焰", motifs: "雙刃雷霆戰斧Osé、天際落下的通紅隕石、象徵暴烈威能的赤紅白相間戰紋", meaning: "執掌暴雨雷電、對不義降下神聖天罰的熾熱雷神", sensitivity: "review" },
      { region: "非洲", name: "鐵砧重錘·開路砍刀（奧貢意象）", type: "黑鐵巨砧/鍛造重錘/開路短砍刀", motifs: "火星迸射的古老鐵砧、斬斷密林荊棘的重鋼開路刀、冶鐵高爐火焰、青銅原礦", meaning: "開闢道路、驅動技術與金屬文明發展的鐵血先驅", sensitivity: "review" },

      // 歐洲
      { region: "歐洲", name: "雷霆萬鈞·神威天槌（索爾意象）", type: "雷神天槌妙爾尼爾/轟天雙羊/引力電弧", motifs: "短柄雷神重槌Mjölnir、拉動戰車的雷角山羊雙獸、撕裂長空的熾白雷電、力量腰帶Megingjörð", meaning: "守護九界邊界、在風暴中粉碎一切混沌巨怪的狂雷神威", sensitivity: "ok" },
      { region: "歐洲", name: "八足天駒·永恆神矛（奧丁意象）", type: "八足神駿/長矛岡格尼爾/雙思維烏鴉", motifs: "踏空無阻的八足神馬斯萊普尼爾、百發百中盧恩長矛岡格尼爾、雙肩停歇的渡鴉福金與霧尼", meaning: "以一目換取無盡智識、在命運黃昏中昂首向前的全父意匠", sensitivity: "ok" },
      { region: "歐洲", name: "涅墨亞獅皮·十二功業（赫拉克勒斯意象）", type: "刀槍不入獅皮/神木巨棒/十二試煉之印", motifs: "覆蓋身軀的刀槍不入金黃獅皮、粗獷百戰橄欖木巨棒、九頭蛇之血淬毒之箭、群星星座", meaning: "戰勝殘酷宿命、以凡軀完成神蹟的至剛至勇之極致", sensitivity: "ok" },
      { region: "歐洲", name: "美杜莎蛇盾·夜巡靈鴞（雅典娜意象）", type: "蛇髮金盾埃癸斯/智慧夜鴞/橄欖金枝", motifs: "鑲嵌石化魔眼的青銅金盾Aegis、目光洞察長夜的智慧貓頭鷹、象徵和平繁榮的青翠橄欖", meaning: "運籌帷幄的戰略智謀與守護文明城邦的崇高秩序", sensitivity: "ok" },
      { region: "歐洲", name: "石中神劍·湖中金鞘（亞瑟王意象）", type: "王者之劍斷鋼聖劍/圓桌騎士徽章/湖中仙女之霧", motifs: "插於巨石中的璀璨斷鋼聖劍Excalibur、永不流血的黃金劍鞘、圓桌十二騎士星芒徽章", meaning: "天命所歸的王者誓約與崇高騎士精神的浪漫史詩", sensitivity: "ok" },
      { region: "歐洲", name: "荊棘魔槍·赤紅狂暴（庫丘林意象）", type: "死棘之槍Gáe Bulg/忠勇獵犬/赤紅戰狂輪廓", motifs: "一旦命中全身生長倒刺的死棘神槍、獵犬狂嗥、沸騰赤炎氣場、三道光輪戰車", meaning: "為守護誓言而戰狂化、如流星般燃盡璀璨生命的凱爾特之芒", sensitivity: "ok" },
      { region: "歐洲", name: "雞腳木屋·飛天石臼（芭芭雅嘎意象）", type: "巨雞雙足木屋/飛天石臼杵/白骨骷髏提燈", motifs: "能隨意轉動奔跑的巨大雞足林中小屋、飛行穿梭樹海的石臼與鐵杵、籬笆上燃燒幽火的白骨頭顱燈", meaning: "亦正亦邪、連結生界與幽靈深林的斯拉夫古老林野女巫", sensitivity: "ok" },
      { region: "歐洲", name: "大梭魚金琴·三寶神磨（維那莫寧意象）", type: "巨魚骨康特勒琴/旋轉三寶磨坊Sampo/古詠巫言", motifs: "用巨型梭魚下顎骨製成撥弄出萬物之音的古琴、不斷研磨出黃金與穀物的三寶神磨Sampo、蒼茫白鬍", meaning: "以歌聲與咒文呼風喚雨、歌唱創造世界的芬蘭萬物大巫師", sensitivity: "ok" },
      { region: "歐洲", name: "撲翼飛輪·手稿鏡像（達文西意象）", type: "仿生撲翼機/機械連動齒輪/鏡像逆向手稿", motifs: "木製羊皮撲翼滑翔翼、螺旋升力螺旋槳、精密差速齒輪組、維特魯威幾何人像方圓", meaning: "打破藝術與科學界限、窺探未來數百年發明的通才之光", sensitivity: "ok" },
      { region: "歐洲", name: "雙星軌道·深空望遠鏡（伽利略意象）", type: "黃銅天文望遠鏡/木星四大衛星/斜塔雙重落體", motifs: "皮革包裹的金屬長望遠鏡、圍繞木星旋轉的四大光點、重力下同時著地的雙鉛球、凹凸鏡組", meaning: "在教條枷鎖下依然堅持「但它依然在轉動」的科學求真傲骨", sensitivity: "ok" },
      { region: "歐洲", name: "茴香火種·高加索岩鎖（普羅米修斯意象）", type: "空心茴香天火/巨石鐐銬/高加索神鷹", motifs: "茴香枝中不熄的天堂神火、高聳懸崖上的鐵索烙印、每日啄食的巨鷹、不屈火星", meaning: "冒犯神威盜火渡人、照亮人間文明黑夜的無私殉道者", sensitivity: "ok" },
      { region: "歐洲", name: "沼澤龍骨·金鎖重鎧（貝奧武夫意象）", type: "獵殺泥沼巨怪神力/古代巨人之劍/金鎖子甲", motifs: "徒手撕裂泥沼巨怪格倫戴爾臂膀的神力、古巨人鍛造的屠龍金劍、金絲編織鎖子甲", meaning: "直面巨龍與深淵、以老朽殘軀完成最終屠龍的北方勇士悲壯史詩", sensitivity: "ok" },
      { region: "歐洲", name: "綠林百步·紫杉神弓（羅賓漢意象）", type: "雪伍德綠林/百步穿楊紫杉長弓/林中劫富義旗", motifs: "一箭雙雕的深綠紫杉木長弓、羽翎鳴響長箭、隱匿於古橡樹濃蔭的墨綠斗篷、金幣分發之手", meaning: "對抗暴斂、藏身自然深處為平民爭取公義的綠林傳奇", sensitivity: "ok" },
      { region: "歐洲", name: "三棱分光·萬有引力（牛頓意象）", type: "水晶三棱鏡七彩色散/墜落金蘋果/微積分星軌", motifs: "將白光分解為彩虹光譜的透明三棱鏡、劃破夜空的引力天體橢圓軌道、反射式天文望遠鏡", meaning: "以三大定律與萬有引力解構宇宙運轉的現代科學基石", sensitivity: "ok" },
      { region: "歐洲", name: "白百合旗·聖炎鎧甲（聖女貞德意象）", type: "百合花戰旗/精鋼聖女板甲/奧爾良突圍聖炎", motifs: "繡有十字與金百合的白色戰旗、照亮重圍的純潔鎧甲、衝破絕望的信仰戰號、不滅火焰", meaning: "以農家少女之軀扛起國家命運、至死不屈的聖潔愛國烈焰", sensitivity: "review" },

      // 美洲
      { region: "美洲", name: "綠羽晨星·甘霖豐收（羽蛇神意象）", type: "綠翠羽翼飛蛇/金星曉星/青玉玉米豐收", motifs: "披滿鳳尾綠咬鵑翠羽的騰空飛蛇、破曉時分的太白金星、滋養梯田玉米的甘霖甘露、青玉雕像", meaning: "賜予農業、曆法與藝術、帶來重生與豐饒的中美洲創世守護神", sensitivity: "ok" },
      { region: "美洲", name: "吹箭球賽·幽冥闖關（瑪雅雙子英雄意象）", type: "冥界球賽橡膠球/吹箭穿雲/雙星輪轉", motifs: "在幽冥球場彈跳的堅硬橡膠神球、射殺惡鳥的修長吹箭筒、化為太陽與月亮的雙星印記", meaning: "運用智慧與默契擊敗死神巨怪、令天地日月輪迴復興的英雄神話", sensitivity: "ok" },
      { region: "美洲", name: "赤焰紅髮·反踵踏痕（庫魯皮拉意象）", type: "火紅倒生長髮/倒轉腳印/雨林守護神獸", motifs: "燃燒如火的蓬鬆紅髮、腳跟在前腳趾向後的反向足跡、騎乘野豬穿梭雨林、敲擊樹幹警示", meaning: "讓盜獵者在迷魂陣中迷失、誓死保護熱帶原始森林的自然精靈", sensitivity: "ok" },
      { region: "美洲", name: "極星領航·夜行提燈（哈莉特·塔布曼意象）", type: "北極星光芒/夜巡防風提燈/地下鐵路航線", motifs: "指引北方自由之地的北極星芒、破曉前點亮的防風馬燈、穿過沼澤草地的隱密足印", meaning: "如現代摩西般數十次深入險境、引領無數奴隸走向自由的鋼鐵航標", sensitivity: "ok" },
      { region: "美洲", name: "安地斯雪嶺·解放軍刀（玻利瓦意象）", type: "安地斯山脈雪峰/出鞘解放騎兵刀/奔騰白戰馬", motifs: "翻越五千米險峻雪峰的軍隊足跡、揮破殖民枷鎖的銀色馬刀、迎風飄揚的三色解放旗", meaning: "跨越地理天險、解放南美洲多個國家的解放者氣概", sensitivity: "ok" },
      { region: "美洲", name: "雙翼昇空·沙丘逆風（萊特兄弟意象）", type: "雙翼風箏飛行機/自行車輪機關/基蒂霍克沙丘", motifs: "木條與帆布組裝的「飛行者一號」雙翼、木質雙螺旋槳、小石山沙丘強風、風洞測量翼型", meaning: "將人類雙腳從大地解放、開啟天際翺翔新時代的開創性嘗試", sensitivity: "ok" },
      { region: "美洲", name: "碧玉水罐·暴風眼眸（特拉洛克意象）", type: "翡翠水罐/暴風閃電圈眼/蛇形神杖", motifs: "傾倒四方風雨的四色碧玉神罐、由雙蛇盤繞而成的眼眶圈形神目、山頂祭壇之水石", meaning: "既帶來滋潤萬物之甘霖、亦能降下冰雹洪澇的自然天候主宰", sensitivity: "ok" },
      { region: "美洲", name: "四方風色·彩色沙繪（納瓦霍風之靈意象）", type: "四方神風彩色沙畫/神聖鷹羽吹管/綠松石辟邪", motifs: "天然礦石研磨的黑白黃藍四方沙畫曼陀羅、引動微風的祈福神鷹羽毛、驅散邪祟的綠松石神符", meaning: "修復人與宇宙間平衡和諧、化天地萬象為療癒之風的古老薩滿", sensitivity: "ok" },
      { region: "美洲", name: "雷鳴振翅·閃電電眸（雷鳥意象）", type: "巨鳥神鷹/雷雲振翅/眼角射電", motifs: "雙翼展開足以遮蔽整個風暴的遠古巨鷹、振翅間轟鳴作響的萬重雷霆、眼眸開闔迸射的灼目閃電", meaning: "翱翔於雷雲頂端、鎮壓深海凶獸的崇高風暴巨靈", sensitivity: "review" },
      { region: "美洲", name: "萬丈日光·太陽金面（因蒂意象）", type: "純金太陽面具/印加梯田金光/太陽神廟聖火", motifs: "光芒四射的圓形純金太陽神面盤、黃金打造的太陽神殿壁板、向四方延展的印加石砌道路網", meaning: "孕育安地斯文明、賜予萬物生機與帝國榮光的太陽本源", sensitivity: "review" },

      // 大洋洲
      { region: "大洋洲", name: "羽披雙體·破浪萬里（卡美哈梅哈意象）", type: "黃金羽毛斗篷/雙體巨型獨木舟/征服海浪", motifs: "由數萬根蜜雀金羽編織的耀眼戰袍、破開太平洋巨浪的雙體獨木舟隊、火山黑曜石戰矛", meaning: "統一夏威夷群島、捍衛太平洋島嶼主權的傳奇島嶼霸主", sensitivity: "ok" },
      { region: "大洋洲", name: "巨石摩艾·海燕神卵（拉帕努伊鳥人意象）", type: "摩艾巨石雕像/烏燕鷗之卵/懸崖衝浪", motifs: "守望無垠大海的巍峨石雕摩艾像、鳥人勇士自斷崖游向小島帶回的第一枚烏燕鷗聖卵、黑曜石鑿子", meaning: "在極度孤絕的太平洋孤島上代代相傳、向死而生的鳥人試煉", sensitivity: "ok" },
      { region: "大洋洲", name: "深潭巨蜥·綠玉雕紋（塔尼瓦意象）", type: "深海守護巨蜥/毛利綠玉寶石/巨型脊鰭", motifs: "盤踞於海峽激流深潭的巨型水生爬蟲巨靈、鐫刻渦卷波浪紋樣的毛利綠玉石雕、平息怒濤的重尾", meaning: "守護部族渡海航程、懲治冒犯自然禁忌者的水域巨獸守護者", sensitivity: "ok" },
      { region: "大洋洲", name: "套索捕日·神骨魚鉤（毛伊意象）", type: "祖先神骨魚鉤/捕日亞麻套索/釣起大陸", motifs: "釣起北島大陸的神聖魔法魚鉤Manaiakalani、編織緩慢太陽腳步的強力亞麻繩套、偷來人間火種", meaning: "為了人類福祉挑戰太陽與海洋規律的頑皮而偉大的半神拓荒者", sensitivity: "review" },
      { region: "大洋洲", name: "彩虹盤曲·地脈水窪（彩虹蛇意象）", type: "彩虹巨蟒/地表萬水之源/大地岩畫印痕", motifs: "橫跨蒼穹與地表水窪的巨大彩虹斑紋巨蛇、古老紅色赭石岩畫、塑造山川峽谷河流的爬行軌跡", meaning: "澳洲原住民創世「夢世紀」中創造江河地形與生命繁衍的母體之神", sensitivity: "review" },

      // 中亞/北亞
      { region: "中亞/北亞", name: "天山獵鷹·白矛史詩（瑪納斯意象）", type: "天山蒼鷹/雪嶺白纓長矛/十萬行英雄史詩", motifs: "在天山雪峰翱翔的獵鷹、破陣殺敵的精鋼白矛、在穹廬篝火旁代代傳唱的百萬行英雄詩章", meaning: "凝聚遊牧民族部族、誓死抗擊外辱守護草原自由的民族魂魄", sensitivity: "ok" },
      { region: "中亞/北亞", name: "巨象限儀·藍瓷星表（兀魯伯意象）", type: "巨型地下六分儀/撒馬爾罕青花藍磚/恆星星表", motifs: "深鑿於岩層之中的四十米半徑青銅象限儀、鑲嵌璀璨孔雀藍琉璃瓷磚的古天文台、千星精準星表", meaning: "在絲路心臟建立超越時代的天文座標、用星辰指引文明進程的學者君王", sensitivity: "ok" },
      { region: "中亞/北亞", name: "金眸蒼狼·雪山穹廬（阿史那灰狼意象）", type: "雪山蒼狼金瞳/純白鹿角/氈帳金頂", motifs: "在阿爾泰暴風雪中閃爍金光的蒼狼雙眸、奔馳於無垠草原的白鹿、草原金頂大帳", meaning: "在荒原絕境中孕育強悍遊牧帝國的狼圖騰血脈與堅韌生命力", sensitivity: "ok" },
      { region: "中亞/北亞", name: "蘇魯錠長矛·九足白旗（成吉思汗意象）", type: "九足白旄纛神矛/疾風蒙古馬隊/無垠彎弓", motifs: "凝聚九匹戰馬鬃毛的九足白纛長矛、奔射萬里無阻的複合牛角弓、震碎歐亞大地的鐵蹄馬陣", meaning: "以不可思議的戰略席捲歐亞大陸、打通跨大洲貿易網絡的風暴征服者", sensitivity: "review" },
      { region: "中亞/北亞", name: "降魔神駒·降魔金盔（格薩爾王意象）", type: "飛天神駒江嘎佩布/降魔黃金戰盔/雪山百部傳奇", motifs: "能在懸崖如履平地的飛翔神駒、驅散雪域妖魔的神聖黃金甲胄、唐卡上威嚴長嘯的降魔身姿", meaning: "降妖伏魔、解救高原苦難生靈的藏地英雄史詩之王", sensitivity: "review" },

      // 極地
      { region: "極地", name: "極點雪橇·極地羅盤（阿蒙森意象）", type: "抗寒愛斯基摩雪橇/極地指向羅盤/終極極點旗", motifs: "耐寒格陵蘭哈士奇犬隊、深覆積雪的雙軌木雪橇、抵禦零下六十度風暴的狼皮防寒服、南極點旗標", meaning: "以極致準備、尊重極地土著智慧成功征服地球終極盡頭的極限探索", sensitivity: "ok" },
      { region: "極地", name: "萬年玄冰·極光白熊（納努克意象）", type: "北極巨型白熊/呼嘯暴風雪/極光庇護長爪", motifs: "身軀如同巍峨雪丘的萬年雪白巨熊、踏破北冰洋海冰的寬厚肉掌、天際絢爛跳躍的綠紫極光幕", meaning: "考核極地獵人是否遵守自然法則、決定冰原獵物收穫的冰雪主宰", sensitivity: "ok" },
      { region: "極地", name: "深海斷指·海豹海象之母（賽德娜意象）", type: "海底深淵母神/海豹海象長鯨化身/海草長髮", motifs: "居住在冰洋最深處的斷指海靈之母、由其手指幻化成群的海豹與長鬚海象、需由薩滿梳理的海藻長髮", meaning: "掌控極地海洋所有魚獸生殺大權、警示人類不得貪婪過度捕殺的深海古神", sensitivity: "review" },

      // 多元交融/世界都市
      { region: "多元交融/世界都市", name: "萬國星儀·全息印章（萬國天文使意象）", type: "跨文明多面星儀/全息外交印信/百族織錦光帶", motifs: "融合各大古文明符號的懸浮發光多面天球儀、投射各星系和平法規的全息印綬、七彩共鳴光帶", meaning: "在多元文化碰撞與世界都市繁華中搭建理解與和平橋樑的星際使者", sensitivity: "ok" },
      { region: "多元交融/世界都市", name: "琉璃水晶宮·差分齒輪機（水晶宮發明家意象）", type: "通透水晶展覽巨構/銅齒輪差分計算機/自動機械琴", motifs: "由鑄鐵與透明玻璃穹頂構築的水晶宮殿、不斷運轉計算天文潮汐的千枚黃銅齒輪、自動演奏發條管風琴", meaning: "展示人類工業與工程造物極致奇蹟、擁抱科技進步盛宴的時代先鋒", sensitivity: "ok" },

      // 星際宙域/跨星系殖民地
      { region: "星際宙域/跨星系殖民地", name: "曲率羅盤·超光速航線（曲率領航員意象）", type: "重力光譜羅盤/空間折疊曲率泡/引力透鏡光環", motifs: "引力透鏡折射出的超光速航線全息光譜、感測黑洞引力波的重力羅盤、折疊時空的彩虹曲率泡", meaning: "在荒蕪黑暗的宇宙深空中開闢星際航道、連接孤懸殖民地的先驅引路人", sensitivity: "ok" },
      { region: "星際宙域/跨星系殖民地", name: "戴森環軌·磁約束光帆（星門工程師意象）", type: "巨型恆星戴森環/光壓推動光帆/約束等離子體", motifs: "環繞恆星運轉採集無盡能源的幾何巨構戴森環、在太空中張開數公里的超薄反光光帆、約束純白電漿球", meaning: "將恆星偉力化為星際航行動力、重構恆星系宏偉圖景的超級工程造物", sensitivity: "ok" },
      { region: "星際宙域/跨星系殖民地", name: "微隕石補丁·星塵收藏匣（虛空荒原流浪者意象）", type: "微隕石補丁宇航服/離子冷光棒/星塵隕石密封匣", motifs: "歷經數百次微隕石撞擊補丁的防護外甲、照亮冰冷廢船艙的淡藍離子冷光、收集各行星稀有星塵的黃銅晶匣", meaning: "在星系邊界與死寂廢墟中尋找文明殘火、擁有強悍生存意志的深空拾荒者", sensitivity: "ok" },

      // 現代科學
      { region: "現代科學", name: "幽光鐳晶·元素天平（居禮夫人意象）", type: "暗夜發光鐳試管/放射性元素天平/鉛防護手記", motifs: "在幽暗實驗室中散發純淨藍綠幽光的玻璃試管、測定放射性同位素的精確天平、泛黃鉛製防護手稿", meaning: "以身涉險、在無聲射線中揭開物質微觀本質與原子能奧秘的堅毅科學豐碑", sensitivity: "ok" },
      { region: "現代科學", name: "提燈夜巡·極座標統計圖（南丁格爾意象）", type: "夜巡銅提燈/南丁格爾玫瑰圖/潔淨白繃帶", motifs: "在野戰醫院長夜中穿梭的溫暖防風銅提燈、開創性呈現死亡與衛生關係的彩色玫瑰極坐標圖、潔白護理印記", meaning: "用精準統計學與崇高人道關懷拯救無數戰傷生命、開創現代護理學的守護燈塔", sensitivity: "ok" },

      // 未知
      { region: "未知", name: "混沌奇點·自由造化（未知意象）", type: "混沌星雲/幾何裂變/自由原型", motifs: "自由演變的虛空幾何微粒、星雲旋渦、未定型的造化之光", meaning: "由生成自由發揮核心神話意象與非人物質構造", sensitivity: "ok" }
    ]
  },

  // 體型級距設定：加入 XS（手掌/昆蟲級），上限至暴龍 (14.0m, 12000kg)
  SIZE_CLASSES: {
    XS: { zh: "XS（< 0.3 m·手掌/昆蟲級）", tris: "3–5k",   tex: 512,  len_min: 0.05, len_max: 0.30, wt_min: 0.01, wt_max: 0.60, fat_min: 5,  fat_max: 22 },
    S:  { zh: "S（0.3–0.6 m）",           tris: "5–8k",   tex: 1024, len_min: 0.30, len_max: 0.60, wt_min: 0.60, wt_max: 6.0,  fat_min: 6,  fat_max: 24 },
    M:  { zh: "M（0.6–1.4 m）",           tris: "8–15k",  tex: 1024, len_min: 0.60, len_max: 1.40, wt_min: 6.0,  wt_max: 75.0, fat_min: 6,  fat_max: 26 },
    L:  { zh: "L（1.4–2.5 m）",           tris: "15–25k", tex: 2048, len_min: 1.40, len_max: 2.50, wt_min: 75.0, wt_max: 650,  fat_min: 8,  fat_max: 28 },
    XL: { zh: "XL（2.5–14.0 m·暴龍/巨獸級）", tris: "25–35k", tex: 2048, len_min: 2.50, len_max: 14.0, wt_min: 650, wt_max: 12000, fat_min: 10, fat_max: 32 }
  },
  STAGES: [
    { v: "juvenile", zh: "幼年" }, { v: "adolescent", zh: "少年" },
    { v: "adult", zh: "成年" }, { v: "overload", zh: "超載（戰鬥中短暫進化）" }
  ],

  ACTIONS: {
    character: [
      { id: "idle", zh: "待機", f: 60, loop: true },
      { id: "idle_long", zh: "長時間靜止週期動作（深呼吸/極微幅肢體微動/定力循環）", f: 120, loop: true },
      { id: "walk", zh: "走路", f: 32, loop: true, ev: ["ev_footstep@8", "ev_footstep@24"] },
      { id: "run", zh: "奔跑", f: 22, loop: true, ev: ["ev_footstep@5", "ev_footstep@16"] },
      { id: "sneak_idle", zh: "潛行待機", f: 60, loop: true },
      { id: "sneak_move", zh: "潛行移動", f: 40, loop: true },
      { id: "roll_dodge", zh: "翻滾閃避（無敵幀）", f: 20, rm: true, ev: ["ev_end_lock@16"] },
      { id: "jump", zh: "跳躍（起跳/滯空/落地）", f: 30 },
      { id: "block", zh: "格擋（舉起→維持→放下）", f: 30 },
      { id: "hit_react", zh: "受擊", f: 15 },
      { id: "knockdown", zh: "倒地", f: 30 },
      { id: "getup", zh: "起身", f: 30 },
      { id: "command_point", zh: "命令：指向目標", f: 24, ev: ["ev_release@10"] },
      { id: "command_attack", zh: "命令：全力進攻", f: 24, ev: ["ev_release@10"] },
      { id: "command_recall", zh: "命令：後退集合", f: 24, ev: ["ev_release@10"] },
      { id: "summon", zh: "召喚宙獸", f: 36, ev: ["ev_spawn_fx@18"] },
      { id: "recall", zh: "收回宙獸", f: 30, ev: ["ev_spawn_fx@14"] },
      { id: "item_use_self", zh: "使用道具（自身）", f: 40, ev: ["ev_spawn_fx@24"] },
      { id: "item_use_other", zh: "使用道具（他者/宙獸）", f: 40, ev: ["ev_release@20"] },
      { id: "field_deploy", zh: "佈署場地", f: 48, ev: ["ev_spawn_fx@30"] },
      { id: "backpack_open", zh: "使用背包（取下→翻找→收回）", f: 60 },
      { id: "talk_idle", zh: "對話待機", f: 90, loop: true },
      { id: "talk_gesture", zh: "對話手勢", f: 45 },
      { id: "pet_xs", zh: "撫摸 XS 體型（托在掌心輕撫）", f: 60, ev: ["ev_spawn_fx@30"] },
      { id: "pet_s", zh: "撫摸 S 體型（蹲下摸頭）", f: 60, ev: ["ev_spawn_fx@30"] },
      { id: "pet_m", zh: "撫摸 M 體型（彎腰）", f: 60, ev: ["ev_spawn_fx@30"] },
      { id: "pet_l", zh: "撫摸 L 體型（抬手摸頸）", f: 60, ev: ["ev_spawn_fx@30"] },
      { id: "pet_xl", zh: "撫摸 XL 體型（宙獸低頭，角色雙手撫摸）", f: 72, ev: ["ev_spawn_fx@36"] },
      { id: "throw_card", zh: "投擲：符籙卡片（雙指甩出）", f: 24, ev: ["ev_release@12"] },
      { id: "throw_bead", zh: "投擲：琉璃珠（下手拋擲）", f: 28, ev: ["ev_release@15"] },
      { id: "throw_cube", zh: "投擲：魔術方塊（轉動後上手投）", f: 32, ev: ["ev_release@18"] },
      { id: "victory", zh: "勝利", f: 60 },
      { id: "defeated", zh: "戰敗", f: 45 }
    ],
    creature: [
      { id: "idle", zh: "待機", f: 60, loop: true },
      { id: "idle_long", zh: "長時間靜止週期動作（深呼吸/輕微起伏/耳尾微動/靜止定力循環）", f: 120, loop: true },
      { id: "walk", zh: "移動", f: 32, loop: true, ev: ["ev_footstep@8"] },
      { id: "run", zh: "奔跑", f: 20, loop: true, ev: ["ev_footstep@5"] },
      { id: "sneak", zh: "潛行", f: 40, loop: true },
      { id: "block", zh: "格擋", f: 30 },
      { id: "dodge_miss", zh: "閃避（MISS 殘影）", f: 14, rm: true },
      { id: "hit_react", zh: "受擊", f: 15 },
      { id: "faint", zh: "倒下", f: 40 },
      { id: "atk_melee_front", zh: "近戰：正前", f: 26, ev: ["ev_hit@12", "ev_end_lock@20"] },
      { id: "atk_melee_sweep", zh: "近戰：橫掃", f: 30, ev: ["ev_hit@14", "ev_end_lock@24"] },
      { id: "atk_melee_burst", zh: "近戰：擴散", f: 34, ev: ["ev_spawn_fx@16", "ev_hit@18"] },
      { id: "atk_ranged_line", zh: "射擊：直線", f: 30, ev: ["ev_spawn_fx@14"] },
      { id: "atk_ranged_cone", zh: "射擊：扇形", f: 30, ev: ["ev_spawn_fx@14"] },
      { id: "atk_ranged_arc", zh: "射擊：拋物線", f: 34, ev: ["ev_spawn_fx@18"] },
      { id: "sup_self", zh: "輔助：自身", f: 36, ev: ["ev_spawn_fx@18"] },
      { id: "sup_ally", zh: "輔助：他者", f: 36, ev: ["ev_spawn_fx@18"] },
      { id: "field_deploy", zh: "佈署場地", f: 48, ev: ["ev_spawn_fx@28"] },
      { id: "petted", zh: "接受撫摸（依體型對位 Socket_PetTouch）", f: 60 },
      { id: "summon_appear", zh: "被召喚登場", f: 36 },
      { id: "recall_vanish", zh: "被收回", f: 24 },
      { id: "capture_struggle", zh: "被收服時掙扎", f: 45 },
      { id: "overload_enter", zh: "進入超載", f: 60, ev: ["ev_spawn_fx@20"] },
      { id: "overload_exit", zh: "超載結束", f: 36 },
      { id: "hatch", zh: "破蛋而出（僅幼年）", f: 72 },
      { id: "victory", zh: "勝利", f: 60 }
    ]
  },

  VFX: {
    shapes: [
      { v: "melee_front", zh: "近戰：正前" }, { v: "melee_sweep", zh: "近戰：橫掃" }, { v: "melee_burst", zh: "近戰：擴散" },
      { v: "ranged_line", zh: "射擊：直線" }, { v: "ranged_cone", zh: "射擊：扇形" }, { v: "ranged_arc", zh: "射擊：拋物線" },
      { v: "support_self", zh: "輔助：自身" }, { v: "support_ally", zh: "輔助：他者" }, { v: "field", zh: "佈署場地" }
    ],
    tiers: [ { v: "light", zh: "輕" }, { v: "medium", zh: "中" }, { v: "heavy", zh: "重" }, { v: "overload", zh: "超載必殺" } ],
    common: [
      { v: "summon", zh: "召喚光陣" }, { v: "recall", zh: "收回光流" }, { v: "overload_aura", zh: "超載氣場" },
      { v: "miss_afterimage", zh: "MISS 殘影" }, { v: "hit_spark", zh: "屬性命中火花" }, { v: "pet_hearts", zh: "撫摸回饋" },
      { v: "capture_talisman_card", zh: "符籙卡片收服" }, { v: "capture_glass_bead", zh: "琉璃珠收服" }, { v: "capture_magic_cube", zh: "魔術方塊收服" }
    ]
  }
};

window.COSMI_CATALOG.CLIPS = window.COSMI_CATALOG.ACTIONS;
