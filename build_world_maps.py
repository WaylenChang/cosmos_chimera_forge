import os
import re
import sys
import time
import json
import sqlite3
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from bs4 import BeautifulSoup

# Ensure unbuffered utf-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
    sys.stderr.reconfigure(encoding='utf-8', line_buffering=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://wiki.52poke.com/'
}

WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(WORKSPACE_DIR, 'pokemon_data')
WORLD_MAPS_DIR = os.path.join(OUTPUT_DIR, 'images', 'world_maps')
WORLD_MAPS_JSON_PATH = os.path.join(OUTPUT_DIR, 'world_maps.json')
WORLD_MAPS_DB_PATH = os.path.join(OUTPUT_DIR, 'world_maps.db')
MAIN_MAPS_DB_PATH = os.path.join(OUTPUT_DIR, 'maps.db')

session = requests.Session()
session.headers.update(HEADERS)

def safe_request(url, params=None, max_retries=3, timeout=25):
    for attempt in range(max_retries):
        try:
            r = session.get(url, params=params, timeout=timeout)
            if r.status_code == 200:
                return r
            elif r.status_code == 429:
                time.sleep(2 * (attempt + 1))
        except Exception:
            if attempt == max_retries - 1:
                return None
            time.sleep(1 * (attempt + 1))
    return None

def extract_img_pair(src):
    if not src: return '', ''
    src = src.strip()
    if src.startswith('//'): src = 'https:' + src
    m = re.search(r'//(?:s\d+|media)\.52poke\.com/wiki/thumb/([0-9a-f]/[0-9a-f]{2})/([^/]+)/', src)
    if m:
        orig = f'https://media.52poke.com/wiki/{m.group(1)}/{m.group(2)}'
        return orig, src
    m2 = re.search(r'//(?:s\d+|media)\.52poke\.com/wiki/([0-9a-f]/[0-9a-f]{2})/([^/]+)$', src)
    if m2:
        orig = f'https://media.52poke.com/wiki/{m2.group(1)}/{m2.group(2)}'
        return orig, src
    return src, src

# Master definitions of official Pokémon Regions and their World Map metadata
REGION_CONFIGS = [
    {
        'region_id': 'kanto',
        'name': '关都地区',
        'name_ja': 'カントー地方',
        'name_en': 'Kanto Region',
        'gen_introduced': '第一世代 (Gen 1)',
        'description': '以日本關東地方為原型的寶可夢世界發祥地，首見於《紅／綠》。城鎮包括真新鎮、金黃市等。',
        'wiki_page': '关都地区'
    },
    {
        'region_id': 'johto',
        'name': '城都地区',
        'name_ja': 'ジョウト地方',
        'name_en': 'Johto Region',
        'gen_introduced': '第二世代 (Gen 2)',
        'description': '以日本關西與四國為原型，充滿傳統歷史氣息的地區，首見於《金／銀》。',
        'wiki_page': '城都地区'
    },
    {
        'region_id': 'hoenn',
        'name': '丰缘地区',
        'name_ja': 'ホウエン地方',
        'name_en': 'Hoenn Region',
        'gen_introduced': '第三世代 (Gen 3)',
        'description': '以日本九州與琉球群島為原型，擁有豐富水域、熱帶氣候與活火山的地區，首見於《紅寶石／藍寶石》。',
        'wiki_page': '丰缘地区'
    },
    {
        'region_id': 'sinnoh',
        'name': '神奥地区',
        'name_ja': 'シンオウ地方',
        'name_en': 'Sinnoh Region',
        'gen_introduced': '第四世代 (Gen 4)',
        'description': '以日本北海道為原型，天冠山縱貫其中，充滿古老神話與傳說的寒冷地區，首見於《鑽石／珍珠》。',
        'wiki_page': '神奥地区'
    },
    {
        'region_id': 'hisui',
        'name': '洗翠地区',
        'name_ja': 'ヒスイ地方',
        'name_en': 'Hisui Region',
        'gen_introduced': '第八世代 (Gen 8)',
        'description': '神奧地區在遙遠過去的古稱，寶可夢與人類尚未和諧共處的原始蠻荒時代，首見於《寶可夢傳說 阿爾宙斯》。',
        'wiki_page': '洗翠地区'
    },
    {
        'region_id': 'unova',
        'name': '合众地区',
        'name_ja': 'イッシュ地方',
        'name_en': 'Unova Region',
        'gen_introduced': '第五世代 (Gen 5)',
        'description': '首個以日本以外地區（美國紐約市及周邊）為原型的現代化大都市地區，首見於《黑／白》。',
        'wiki_page': '合众地区'
    },
    {
        'region_id': 'kalos',
        'name': '卡洛斯地区',
        'name_ja': 'カロス地方',
        'name_en': 'Kalos Region',
        'gen_introduced': '第六世代 (Gen 6)',
        'description': '以法國北部為原型，呈五角星形狀，充滿浪漫、時尚與百花盛開的地區，首見於《Ｘ／Ｙ》。',
        'wiki_page': '卡洛斯地区'
    },
    {
        'region_id': 'alola',
        'name': '阿罗拉地区',
        'name_ja': 'アローラ地方',
        'name_en': 'Alola Region',
        'gen_introduced': '第七世代 (Gen 7)',
        'description': '以夏威夷群島為原型，由四座天然島嶼與一座人工島組成，擁有獨特的霸主寶可夢與諸島巡禮制度，首見於《太陽／月亮》。',
        'wiki_page': '阿罗拉地区'
    },
    {
        'region_id': 'galar',
        'name': '伽勒尔地区',
        'name_ja': 'ガラル地方',
        'name_en': 'Galar Region',
        'gen_introduced': '第八世代 (Gen 8)',
        'description': '以大不列顛島（英國）為原型，垂直長條形狀，具有工業革命蒸汽都市、遼闊曠野地帶與極巨化對戰的地區，首見於《劍／盾》。',
        'wiki_page': '伽勒尔地区'
    },
    {
        'region_id': 'paldea',
        'name': '帕底亚地区',
        'name_ja': 'パルデア地方',
        'name_en': 'Paldea Region',
        'gen_introduced': '第九世代 (Gen 9)',
        'description': '以伊比利半島（西班牙與葡萄牙）為原型，中心為巨大第零區大坑洞的環形開放世界地區，首見於《朱／紫》。',
        'wiki_page': '帕底亚地区'
    },
    {
        'region_id': 'sevii',
        'name': '七之岛',
        'name_ja': 'ナナシマ',
        'name_en': 'Sevii Islands',
        'gen_introduced': '第三世代 (Gen 3)',
        'description': '位於關都與城都以南的群島海域，由七座主要島嶼及臍之岩、誕生之島組成，首見於《火紅／葉綠》。',
        'wiki_page': '七之岛'
    },
    {
        'region_id': 'kitakami',
        'name': '北上乡',
        'name_ja': 'キタカミの里',
        'name_en': 'Kitakami',
        'gen_introduced': '第九世代 (Gen 9)',
        'description': '以日本東北地方為原型，風景恬靜幽雅的農村聚落與面具祭典之鄉，首見於《朱／紫 零之秘寶 前篇：碧之假面》。',
        'wiki_page': '北上乡'
    },
    {
        'region_id': 'blueberry',
        'name': '蓝莓学园',
        'name_ja': 'ブルーベリー学園',
        'name_en': 'Blueberry Academy',
        'gen_introduced': '第九世代 (Gen 9)',
        'description': '座落於合眾地區海域上的現代水下學園，擁有劃分為四大氣候生態區的巨型人工「生態巨蛋」，首見於《朱／紫 零之秘寶 後篇：藍之圓盤》。',
        'wiki_page': '蓝莓学园'
    },
    {
        'region_id': 'isle_of_armor',
        'name': '铠岛',
        'name_ja': 'ヨロイじま',
        'name_en': 'Isle of Armor',
        'gen_introduced': '第八世代 (Gen 8)',
        'description': '浮於伽勒爾東部海域的大島嶼，擁有馬士德武館與雙拳之塔，首見於《劍／盾 擴充票：鎧之孤島》。',
        'wiki_page': '铠岛'
    },
    {
        'region_id': 'crown_tundra',
        'name': '王冠雪原',
        'name_ja': 'カンムリ雪原',
        'name_en': 'Crown Tundra',
        'gen_introduced': '第八世代 (Gen 8)',
        'description': '以蘇格蘭為原型，白雪皚皚的地貌與極巨巢穴探險之地，首見於《劍／盾 擴充票：冠之雪原》。',
        'wiki_page': '王冠雪原'
    },
    {
        'region_id': 'orre',
        'name': '欧雷地区',
        'name_ja': 'オーレ地方',
        'name_en': 'Orre Region',
        'gen_introduced': '第三世代旁支 (Spin-off)',
        'description': '以美國亞利桑那州鳳凰城為原型的荒蕪沙漠峽谷地區，首見於《寶可夢圓形競技場》與《XD 闇之旋風》。',
        'wiki_page': '欧雷地区'
    },
    {
        'region_id': 'fiore',
        'name': '菲蕾地区',
        'name_ja': 'フィオレ地方',
        'name_en': 'Fiore Region',
        'gen_introduced': '第三世代旁支 (Spin-off)',
        'description': '自然資源豐富、沒有精靈球文化而由巡護員保護的地區，首見於《寶可夢巡護員》。',
        'wiki_page': '菲蕾地区'
    },
    {
        'region_id': 'almia',
        'name': '阿尔米亚地区',
        'name_ja': 'アルミア地方',
        'name_en': 'Almia Region',
        'gen_introduced': '第四世代旁支 (Spin-off)',
        'description': '擁有巡護員學校、多元地形的巡護員守護之鄉，首見於《寶可夢巡護員 風湧篇》。',
        'wiki_page': '阿尔米亚地区'
    },
    {
        'region_id': 'oblivia',
        'name': '奥卜利比亚地区',
        'name_ja': 'オブリビア地方',
        'name_en': 'Oblivia Region',
        'gen_introduced': '第四世代旁支 (Spin-off)',
        'description': '由許多溫暖島嶼組成的和平群島，留存許多古代遺跡與飛行石板傳說，首見於《寶可夢巡護員 光之軌跡》。',
        'wiki_page': '奥卜利比亚地区'
    },
    {
        'region_id': 'ransei',
        'name': '乱世地区',
        'name_ja': 'ランセ地方',
        'name_en': 'Ransei Region',
        'gen_introduced': '第五世代旁支 (Spin-off)',
        'description': '以日本戰國時代與阿爾宙斯輪廓為原型，分為17個國度互相爭霸的地區，首見於《寶可夢＋信長之野望》。',
        'wiki_page': '乱世地区'
    },
    {
        'region_id': 'pasio',
        'name': '帕希欧',
        'name_ja': 'パシオ',
        'name_en': 'Pasio',
        'gen_introduced': '第七世代旁支 (Spin-off)',
        'description': '為了舉辦寶可夢大師賽（PML）而由雷爾拔興建的人工島嶼，聚集來自各地的訓練家，首見於《Pokémon Masters EX》。',
        'wiki_page': '帕希欧'
    },
    {
        'region_id': 'orange_islands',
        'name': '橘子群岛',
        'name_ja': 'オレンジ諸島',
        'name_en': 'Orange Archipelago',
        'gen_introduced': '動畫原創 (Anime)',
        'description': '位於關都南方的亞熱帶群島，擁有熱帶特有體色的寶可夢與橘子聯盟，首見於動畫《橘子群島篇》。',
        'wiki_page': '橘子群岛'
    },
    {
        'region_id': 'lental',
        'name': '蓝蒂尔地区',
        'name_ja': 'レンティル地方',
        'name_en': 'Lental Region',
        'gen_introduced': '第八世代旁支 (Spin-off)',
        'description': '由自然環境迥異的各個島嶼組成，擁有獨特的發光「霓光現象」，首見於《New 寶可夢隨樂拍》。',
        'wiki_page': '藍蒂爾地區'
    },
    {
        'region_id': 'pokemon_world',
        'name': '宝可梦世界',
        'name_ja': 'ポケモンの世界',
        'name_en': 'Pokémon World',
        'gen_introduced': '世界觀總覽',
        'description': '整個寶可夢所在的星球與世界觀總覽大地圖。',
        'wiki_page': '宝可梦世界'
    }
]

def deduce_map_info(reg_info, alt_text, filename):
    fn_lower = filename.lower()
    alt_lower = alt_text.lower()
    combined = (alt_text + ' ' + filename).lower()
    
    # 1. Determine generation
    gen = 'Official'
    if any(k in combined for k in ['rgby', 'rg', 'red', 'green', '第一世代', '赤绿']): gen = '第一世代 (Gen 1)'
    elif any(k in combined for k in ['gsc', 'gold', 'silver', '第二世代', '金银']): gen = '第二世代 (Gen 2)'
    elif any(k in combined for k in ['frlg', 'rse', 'ruby', 'sapphire', 'emerald', '第三世代', '红蓝宝石', '火红叶绿']): gen = '第三世代 (Gen 3)'
    elif any(k in combined for k in ['hgss', 'dppt', 'dp', 'pt', 'diamond', 'pearl', 'platinum', '第四世代', '心金魂银', '钻石珍珠']): gen = '第四世代 (Gen 4)'
    elif any(k in combined for k in ['b2w2', 'bw', 'black', 'white', '第五世代', '黑白']): gen = '第五世代 (Gen 5)'
    elif any(k in combined for k in ['oras', 'xy', '第六世代', '欧米伽红宝石', '阿尔法蓝宝石']): gen = '第六世代 (Gen 6)'
    elif any(k in combined for k in ['usum', 'sm', 'lple', 'lgpe', '第七世代', '太阳月亮', '究极之日', '皮卡丘伊布']): gen = '第七世代 (Gen 7)'
    elif any(k in combined for k in ['swsh', 'bdsp', 'la', 'sword', 'shield', '第八世代', '剑盾', '晶灿钻石', '传说阿尔宙斯']): gen = '第八世代 (Gen 8)'
    elif any(k in combined for k in ['sv', 'scarlet', 'violet', '第九世代', '朱紫', '零之秘宝', '碧之假面', '蓝之圆盘']): gen = '第九世代 (Gen 9)'
    elif '动画' in combined or '動畫' in combined: gen = '動畫系列 (Anime)'
    elif 'concept' in combined or '膠囊' in combined or '早期' in combined: gen = '早期概念 (Concept)'
    elif reg_info.get('gen_introduced'): gen = reg_info['gen_introduced']

    # 2. Determine game version
    game = '-'
    for g_id, g_name in [
        ('lple', "Let's Go！皮卡丘／Let's Go！伊布"),
        ('lgpe', "Let's Go！皮卡丘／Let's Go！伊布"),
        ('hgss', '心金／魂銀'),
        ('bdsp', '晶燦鑽石／明亮珍珠'),
        ('oras', '歐米伽紅寶石／阿爾法藍寶石'),
        ('usum', '究極之日／究極之月'),
        ('frlg', '火紅／葉綠'),
        ('b2w2', '黑２／白２'),
        ('dppt', '鑽石／珍珠／白金'),
        ('rgby', '紅／綠／藍／皮卡丘'),
        ('swsh', '劍／盾'),
        ('colo', '圓形競技場'),
        ('rse', '紅寶石／藍寶石／綠寶石'),
        ('gsc', '金／銀／水晶版'),
        ('sv', '朱／紫'),
        ('la', '寶可夢傳說 阿爾宙斯'),
        ('bw', '黑／白'),
        ('xy', 'Ｘ／Ｙ'),
        ('sm', '太陽／月亮'),
        ('pt', '白金版'),
        ('dp', '鑽石／珍珠'),
        ('xd', 'XD 闇之旋風'),
        ('ranse', '寶可夢＋信長之野望'),
        ('fiore', '寶可夢巡護員'),
        ('almia', '寶可夢巡護員 風湧篇'),
        ('oblivia', '寶可夢巡護員 光之軌跡'),
        ('masters', 'Pokémon Masters EX')
    ]:
        if g_id in fn_lower or g_id in alt_lower:
            game = g_name
            break

    # 3. Determine category
    cat_type = 'regional_artwork'
    cat_desc = '全景手繪大繪圖'
    if any(k in fn_lower or k in alt_lower for k in ['map', '地图', '地圖']):
        if any(k in fn_lower or k in alt_lower for k in ['城镇地图', '城鎮地圖', 'town']):
            cat_type = 'town_map'
            cat_desc = '官方城鎮大地圖'
        else:
            cat_type = 'in_game_map'
            cat_desc = '遊戲內全域導航大地圖'
    elif '动画' in combined or '動畫' in combined:
        cat_type = 'anime_map'
        cat_desc = '動畫版官方大地圖'
    elif '概念' in combined or '膠囊' in combined:
        cat_type = 'concept_map'
        cat_desc = '早期概念設計地圖'

    # 4. Construct human-readable title
    clean_title = alt_text.strip()
    if not clean_title or clean_title.endswith('.png') or clean_title.endswith('.jpg') or clean_title.endswith('.gif'):
        clean_title = f"{reg_info['name']} {gen} {cat_desc}"
    if game != '-' and game not in clean_title:
        clean_title = f"《{game}》{clean_title}"

    return gen, game, cat_type, cat_desc, clean_title

def collect_world_maps_for_region(reg_info):
    rname = reg_info['wiki_page']
    url = f'https://wiki.52poke.com/wiki/{urllib.parse.quote(rname)}'
    res = safe_request(url)
    if not res:
        return []
        
    soup = BeautifulSoup(res.text, 'html.parser')
    content = soup.find('div', id='mw-content-text')
    if not content:
        return []

    found_maps = []
    seen = set()

    # 1. Check infobox
    infobox = content.find('table', class_='roundy')
    if infobox:
        for img in infobox.find_all('img'):
            src = img.get('src') or ''
            alt = img.get('alt') or ''
            orig, thumb = extract_img_pair(src)
            fname = urllib.parse.unquote(orig).split('/')[-1]
            if not any(b in fname.lower() for b in ['icon', 'logo', 'badge', 'button', 'none.png', 'license']):
                if orig not in seen:
                    seen.add(orig)
                    gen, game, cat_type, cat_desc, title = deduce_map_info(reg_info, alt or f"{reg_info['name']} 全景大繪圖", fname)
                    found_maps.append({
                        'orig_url': orig,
                        'thumb_url': thumb,
                        'filename': fname,
                        'alt': alt,
                        'generation': gen,
                        'game': game,
                        'category': cat_type,
                        'category_desc': cat_desc,
                        'title': title
                    })

    # 2. Check sections: 地图, 各世代, 图册, 概述
    for h in content.find_all(['h2', 'h3']):
        htext = h.get_text(strip=True)
        if any(k in htext for k in ['地图', '地圖', '各世代', '图册', '圖冊', '画廊', '畫像', '全景', '设计']):
            node = h.find_next_sibling()
            while node and node.name not in ['h2']:
                for img in (node.find_all('img') if hasattr(node, 'find_all') else []):
                    src = img.get('src') or ''
                    alt = img.get('alt') or ''
                    orig, thumb = extract_img_pair(src)
                    fname = urllib.parse.unquote(orig).split('/')[-1]
                    if any(b in fname.lower() for b in ['icon', 'logo', 'badge', 'button', 'none.png', 'license', 'spr_', 'bag_']):
                        continue
                    # Must be a map-like asset or named after the region
                    is_map_asset = any(k in fname.lower() or k in alt.lower() for k in ['map', '地图', '地圖', '全景', '绘图', '繪圖', '俯视', '俯視'])
                    is_region_named = any(reg_sub in fname for reg_sub in ['关都', '關都', '城都', '丰缘', '豐緣', '神奥', '神奧', '洗翠', '合众', '合眾', '卡洛斯', '阿罗拉', '阿羅拉', '伽勒尔', '伽勒爾', '帕底亚', '帕底亞', '七之岛', '七之島', '北上', '蓝莓', '藍莓', '铠岛', '鎧島', '王冠', '欧雷', '歐雷', '菲蕾', '阿尔米亚', '阿爾米亞', '奥卜利比亚', '奧卜利比亞', '乱世', '亂世', '帕希欧', '帕希歐', '橘子', '世界', 'Fiore', 'Ransemap', 'Almia', 'Oblivia'])
                    if is_map_asset or is_region_named:
                        # Exclude small local route / shop icons
                        if any(bad in fname for bad in ['道路', '市_', '市.', '镇_', '镇.', '村_', '村.']) and 'map' not in fname.lower():
                            continue
                        if orig not in seen:
                            seen.add(orig)
                            gen, game, cat_type, cat_desc, title = deduce_map_info(reg_info, alt or fname, fname)
                            found_maps.append({
                                'orig_url': orig,
                                'thumb_url': thumb,
                                'filename': fname,
                                'alt': alt,
                                'generation': gen,
                                'game': game,
                                'category': cat_type,
                                'category_desc': cat_desc,
                                'title': title
                            })
                node = node.find_next_sibling()

    return found_maps

def sanitize_filename(name):
    clean = re.sub(r'[\\/*?:"<>|]', '_', name)
    clean = re.sub(r'\s+', '_', clean)
    return clean[:120]

def download_file(task):
    url, thumb_url, dest_path = task
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 1000:
        return 'skipped'
        
    if url:
        try:
            r = safe_request(url, timeout=25)
            if r and r.status_code == 200 and len(r.content) > 1000:
                with open(dest_path, 'wb') as f:
                    f.write(r.content)
                return 'downloaded'
        except Exception:
            pass
            
    if thumb_url and thumb_url != url:
        try:
            r = safe_request(thumb_url, timeout=25)
            if r and r.status_code == 200 and len(r.content) > 1000:
                with open(dest_path, 'wb') as f:
                    f.write(r.content)
                return 'downloaded'
        except Exception:
            pass
            
    return 'failed'

def main():
    print("=" * 65)
    print("  寶可夢全世代【大地圖】專用建檔與資料庫生成系統")
    print("=" * 65)
    
    os.makedirs(WORLD_MAPS_DIR, exist_ok=True)
    start_time = time.time()
    
    # 1. Collect world maps for all major regions
    print(f"\n[1/4] 正在檢索全系列 {len(REGION_CONFIGS)} 大地區的官方大地圖與全景圖資...", flush=True)
    all_world_maps = []
    reg_summaries = []
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_reg = {executor.submit(collect_world_maps_for_region, reg): reg for reg in REGION_CONFIGS}
        for future in as_completed(future_to_reg):
            reg = future_to_reg[future]
            maps = future.result()
            print(f" -> [{reg['name']}] 檢索到 {len(maps)} 張官方大地圖", flush=True)
            for m in maps:
                m['region_id'] = reg['region_id']
                m['region_name'] = reg['name']
                m['region_name_ja'] = reg['name_ja']
                m['region_name_en'] = reg['name_en']
                m['wiki_url'] = f"https://wiki.52poke.com/wiki/{urllib.parse.quote(reg['wiki_page'])}"
                all_world_maps.append(m)
                
            reg_summaries.append({
                'region_id': reg['region_id'],
                'name': reg['name'],
                'name_ja': reg['name_ja'],
                'name_en': reg['name_en'],
                'generation_introduced': reg['gen_introduced'],
                'description': reg['description'],
                'wiki_url': f"https://wiki.52poke.com/wiki/{urllib.parse.quote(reg['wiki_page'])}",
                'maps_count': len(maps)
            })

    # Sort maps logically by region order and generation
    reg_order = {reg['region_id']: idx for idx, reg in enumerate(REGION_CONFIGS, 1)}
    all_world_maps.sort(key=lambda x: (reg_order.get(x['region_id'], 99), x['generation'], x['title']))
    reg_summaries.sort(key=lambda x: reg_order.get(x['region_id'], 99))

    # Assign sequential IDs and standardized local filenames
    print(f"\n[2/4] 規範化大地圖命名與資產檔案結構 (共 {len(all_world_maps)} 張大地圖)...", flush=True)
    download_tasks = []
    for idx, m in enumerate(all_world_maps, 1):
        m['id'] = idx
        r_prefix = f"{reg_order.get(m['region_id'], 99):02d}_{m['region_name']}"
        safe_title = sanitize_filename(m['title'])
        ext = '.png'
        if '.jpg' in m['filename'].lower(): ext = '.jpg'
        elif '.gif' in m['filename'].lower(): ext = '.gif'
        elif '.webp' in m['filename'].lower(): ext = '.webp'
        
        fname = f"{idx:03d}_{r_prefix}_{safe_title}{ext}"
        m['local_filename'] = fname
        m['local_path'] = os.path.join('images', 'world_maps', fname).replace('\\', '/')
        dest_full = os.path.join(WORLD_MAPS_DIR, fname)
        download_tasks.append((m['orig_url'], m['thumb_url'], dest_full))

    # 3. Save JSON Library
    print(f"\n[*] 儲存獨立大地圖 JSON 總庫: {WORLD_MAPS_JSON_PATH} ...", flush=True)
    with open(WORLD_MAPS_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(all_world_maps, f, ensure_ascii=False, indent=2)
    print(f" -> 已儲存 {len(all_world_maps)} 筆大地圖資料！", flush=True)

    # 4. Build SQLite Databases (Dedicated world_maps.db AND sync to main maps.db)
    print(f"\n[3/4] 建置獨立 SQLite 大地圖資料庫: {WORLD_MAPS_DB_PATH} ...", flush=True)
    for db_path in [WORLD_MAPS_DB_PATH, MAIN_MAPS_DB_PATH]:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        
        cur.execute('''
            CREATE TABLE IF NOT EXISTS world_regions (
                id INTEGER PRIMARY KEY,
                region_id TEXT UNIQUE,
                name TEXT,
                name_ja TEXT,
                name_en TEXT,
                generation_introduced TEXT,
                description TEXT,
                wiki_url TEXT,
                maps_count INTEGER
            )
        ''')
        
        cur.execute('''
            CREATE TABLE IF NOT EXISTS world_maps (
                id INTEGER PRIMARY KEY,
                region_id TEXT,
                region_name TEXT,
                name_ja TEXT,
                name_en TEXT,
                generation TEXT,
                game TEXT,
                map_category TEXT,
                map_category_desc TEXT,
                title TEXT,
                image_url TEXT,
                thumb_url TEXT,
                local_filename TEXT,
                local_path TEXT,
                wiki_url TEXT,
                FOREIGN KEY(region_id) REFERENCES world_regions(region_id)
            )
        ''')
        
        # Populate world_regions
        for idx, r in enumerate(reg_summaries, 1):
            cur.execute('''
                INSERT OR REPLACE INTO world_regions (id, region_id, name, name_ja, name_en, generation_introduced, description, wiki_url, maps_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                idx, r['region_id'], r['name'], r['name_ja'], r['name_en'], r['generation_introduced'], r['description'], r['wiki_url'], r['maps_count']
            ))
            
        # Populate world_maps
        for m in all_world_maps:
            cur.execute('''
                INSERT OR REPLACE INTO world_maps (id, region_id, region_name, name_ja, name_en, generation, game, map_category, map_category_desc, title, image_url, thumb_url, local_filename, local_path, wiki_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                m['id'], m['region_id'], m['region_name'], m['region_name_ja'], m['region_name_en'], m['generation'], m['game'], m['category'], m['category_desc'], m['title'], m['orig_url'], m['thumb_url'], m['local_filename'], m['local_path'], m['wiki_url']
            ))
            
        conn.commit()
        conn.close()
    print(" -> SQLite 雙資料庫 (world_maps.db & maps.db) 已同步寫入！", flush=True)

    # 5. Download Physical World Map Images
    print(f"\n[4/4] 下載 {len(download_tasks)} 張高解析度大地圖實體資產至 {WORLD_MAPS_DIR} (12 線程)...", flush=True)
    dl_downloaded = 0
    dl_skipped = 0
    dl_failed = 0
    
    with ThreadPoolExecutor(max_workers=12) as executor:
        future_to_task = {executor.submit(download_file, task): task for task in download_tasks}
        for future in as_completed(future_to_task):
            status = future.result()
            if status == 'downloaded': dl_downloaded += 1
            elif status == 'skipped': dl_skipped += 1
            else: dl_failed += 1
            
    print(f" -> 下載完成: 下載 {dl_downloaded} 張, 既有跳過 {dl_skipped} 張, 失敗 {dl_failed} 張")
    total_time = time.time() - start_time
    print(f"\n[完成] 寶可夢歷代大地圖獨立庫建置完畢！總耗時: {total_time:.1f} 秒")
    print(f" - 大地圖獨立 JSON 總庫: {WORLD_MAPS_JSON_PATH}")
    print(f" - 大地圖獨立 SQLite 庫: {WORLD_MAPS_DB_PATH}")
    print(f" - 大地圖專屬圖片目錄: {WORLD_MAPS_DIR}")

if __name__ == '__main__':
    main()
