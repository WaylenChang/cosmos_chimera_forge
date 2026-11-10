import json
import os
import re
import sys
from PIL import Image

WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(WORKSPACE_DIR, 'pokemon_data')
RAW_PATH = os.path.join(DATA_DIR, 'characters.raw.json')
OUTPUT_PATH = os.path.join(DATA_DIR, 'characters.json')
IMG_DIR = os.path.join(DATA_DIR, 'images', 'characters')

def slugify(text: str) -> str:
    slug = re.sub(r'[^a-zA-Z0-9]+', '_', text.strip()).strip('_').lower()
    return slug

def structure_characters():
    src_file = RAW_PATH if os.path.exists(RAW_PATH) else OUTPUT_PATH
    with open(src_file, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    structured = []
    
    for c in raw_data:
        item = {}
        cid = c.get('id', len(structured) + 1)
        
        # 1. Standard snake_case ID matching ^[a-z][a-z0-9]*(_[a-z0-9]+)*$
        en_name = c.get('name_en', '') or ''
        en_slug = slugify(en_name)
        if en_slug and en_slug[0].isalpha():
            item['id'] = f"chr_{cid:04d}_{en_slug}"
        else:
            item['id'] = f"chr_{cid:04d}"
            
        # 2. Chinese name & optional variant (e.g. 动画, 特别篇)
        raw_title = (c.get('title') or '').strip()
        m_var = re.search(r'^(.+?)[（\(](.+?)[）\)]$', raw_title)
        if m_var:
            item['name_zh'] = m_var.group(1).strip()
            variant_str = m_var.group(2).strip()
            if variant_str and variant_str not in ['', '未知', '不明']:
                item['variant'] = variant_str
        elif raw_title:
            item['name_zh'] = raw_title
            
        # 3. Japanese & English names
        name_ja = (c.get('name_ja') or '').strip()
        if name_ja and name_ja not in ['', '未知', '不明']:
            item['name_ja'] = name_ja
            
        name_en = (c.get('name_en') or '').strip()
        if name_en and name_en not in ['', '未知', '不明']:
            item['name_en'] = name_en
            
        # 4. Gender (only valid binary / recognized gender)
        gender = (c.get('gender') or '').strip()
        if gender in ['男', '女']:
            item['gender'] = gender
            
        # 5. Lore attributes (only when real data exists)
        region = (c.get('region') or '').strip()
        if region and region not in ['', '未知', '不明']:
            item['region'] = region
            
        hometown = (c.get('hometown') or '').strip()
        if hometown and hometown not in ['', '未知', '不明']:
            item['hometown'] = hometown
            
        specialty = (c.get('specialty_type') or '').strip()
        if specialty and specialty not in ['', '未知', '不明']:
            item['specialty_type'] = specialty
            
        # 6. Tags & Roles
        tags = [t.strip() for t in c.get('tags', []) if t.strip()]
        if tags:
            item['tags'] = tags
            
        # 7. Narrative description
        desc = (c.get('description') or '').strip()
        if desc:
            item['description'] = desc
            
        # 8. Visual / Image metadata
        img_info = {}
        img_file = c.get('image_file')
        if img_file:
            img_path = os.path.join(IMG_DIR, img_file)
            if os.path.exists(img_path):
                img_info['file'] = img_file
                img_info['local_path'] = f"images/characters/{img_file}"
                try:
                    with Image.open(img_path) as im:
                        img_info['width'], img_info['height'] = im.size
                        img_info['format'] = im.mode
                except Exception:
                    pass
        if c.get('image_url'):
            img_info['url'] = c['image_url']
            
        if img_info:
            item['image'] = img_info
            
        # 9. Reference source
        if c.get('wiki_url'):
            item['wiki_url'] = c['wiki_url']
            
        structured.append(item)

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(structured, f, ensure_ascii=False, indent=2)

    print(f"Successfully structured {len(structured)} characters -> {OUTPUT_PATH}")

if __name__ == '__main__':
    structure_characters()
