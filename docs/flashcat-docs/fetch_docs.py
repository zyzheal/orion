#!/usr/bin/env python3
"""
FlashCat 文档抓取脚本 v2
通过 llms.txt 获取所有文档的 Markdown 直接链接并下载
"""

import urllib.request
import re
import os
import time
from collections import Counter

BASE_URL = 'https://docs.flashcat.cloud'
SAVE_DIR = '/Users/heal/orion-design/docs/flashcat-docs'

# 分类映射
CATEGORIES = {
    'home': '01-首页',
    'on-call': '02-OnCall告警管理',
    'rum': '03-RUM用户体验监控',
    'monitors': '04-Monitors监控管理',
    'platform': '05-平台通用配置',
    'developer': '06-开发者工具',
    'openapi': '07-API文档',
    'compliance': '08-安全合规',
    'changelog': '09-更新日志'
}

def get_llms_txt():
    """获取 llms.txt 并解析所有文档链接"""
    url = f'{BASE_URL}/llms.txt'
    req = urllib.request.urlopen(url, timeout=15)
    content = req.read().decode('utf-8')

    # 解析 Markdown 链接: [标题](URL): 描述
    pattern = r'- \[([^\]]+)\]\(([^)]+)\): (.+)'
    matches = re.findall(pattern, content)

    docs = []
    for title, url, desc in matches:
        if '/zh/' in url:
            docs.append({
                'title': title,
                'url': url,
                'description': desc
            })

    print(f'从 llms.txt 解析到 {len(docs)} 个中文文档')
    return docs

def get_category(url):
    """根据 URL 返回分类目录名"""
    for key, cat in CATEGORIES.items():
        if f'/zh/{key}' in url or f'/zh/{key}.md' in url:
            return cat
    return '01-首页'

def get_page_filename(url, title):
    """根据 URL 生成本地文件名"""
    # 从 URL 路径提取文件名
    path = url.replace(f'{BASE_URL}/zh/', '').replace('.md', '')
    parts = path.split('/')

    if len(parts) == 1:
        # 单层路径，使用标题或路径名
        return f'{parts[0]}.md'

    # 多层路径，使用最后一段
    return f'{parts[-1]}.md'

def fetch_markdown(url):
    """直接获取 Markdown 内容"""
    try:
        # 将普通 URL 转换为 .md 格式
        if not url.endswith('.md'):
            md_url = url + '.md'
        else:
            md_url = url

        # Mintlify 需要 RSC headers才能返回完整 Markdown 内容
        req = urllib.request.Request(md_url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            'Accept': '*/*',
            'RSC': '1',
            'Next-Router-State-Tree': '1',
        })
        response = urllib.request.urlopen(req, timeout=20)
        content = response.read().decode('utf-8')

        # 如果内容太短，可能是错误响应
        if len(content) < 10:
            return None

        return content
    except Exception as e:
        print(f'  错误: {e}')
        return None

def main():
    print('='*60)
    print('FlashCat 文档抓取工具 v2')
    print('='*60)

    # 创建分类目录
    for cat_dir in CATEGORIES.values():
        os.makedirs(os.path.join(SAVE_DIR, cat_dir), exist_ok=True)

    # 获取所有文档
    docs = get_llms_txt()

    # 统计
    stats = Counter()
    success_count = 0
    fail_count = 0

    # 保存进度日志
    log_file = os.path.join(SAVE_DIR, 'download_log.txt')

    with open(log_file, 'w', encoding='utf-8') as log:
        log.write(f'FlashCat 文档下载日志\n')
        log.write(f'开始时间: {time.strftime("%Y-%m-%d %H:%M:%S")}\n')
        log.write(f'总计: {len(docs)} 个页面\n')
        log.write('='*60 + '\n\n')

        for i, doc in enumerate(docs, 1):
            category = get_category(doc['url'])
            filename = get_page_filename(doc['url'], doc['title'])
            save_path = os.path.join(SAVE_DIR, category, filename)

            print(f'[{i}/{len(docs)}] {doc["title"]}')
            print(f'  URL: {doc["url"]}')
            print(f'  分类: {category}')
            print(f'  保存: {filename}')

            content = fetch_markdown(doc['url'])

            if content:
                # 处理文件名冲突
                if os.path.exists(save_path):
                    base, ext = os.path.splitext(filename)
                    save_path = os.path.join(SAVE_DIR, category, f'{base}_{int(time.time())}{ext}')

                with open(save_path, 'w', encoding='utf-8') as f:
                    f.write(content)

                size = os.path.getsize(save_path)
                print(f'  成功: {size/1024:.1f} KB')
                log.write(f'[成功] {doc['title']} | {doc['url']} -> {category}/{filename} ({size/1024:.1f} KB)\n')
                success_count += 1
                stats[category] += 1
            else:
                print(f'  失败: 无法下载内容')
                log.write(f'[失败] {doc['title']} | {doc['url']}\n')
                fail_count += 1

            # 礼貌延迟
            time.sleep(0.3)

            # 每 10 个页面打印统计
            if i % 10 == 0:
                print(f'\n--- 进度: {i}/{len(docs)} ---')
                print(f'  成功: {success_count}, 失败: {fail_count}\n')

    # 最终统计
    print('\n' + '='*60)
    print('下载完成!')
    print('='*60)
    print(f'\n总计: {len(docs)} 个页面')
    print(f'成功: {success_count}')
    print(f'失败: {fail_count}')
    print(f'\n分类统计:')
    for cat, count in sorted(stats.items()):
        print(f'  {cat}: {count} 页')
    print(f'\n保存目录: {SAVE_DIR}')
    print(f'下载日志: {log_file}')

    # 保存最终统计
    with open(os.path.join(SAVE_DIR, 'README.md'), 'w', encoding='utf-8') as f:
        f.write('# FlashCat 文档库\n\n')
        f.write(f'从 [docs.flashcat.cloud](https://docs.flashcat.cloud) 抓取的中文文档\n\n')
        f.write(f'## 统计信息\n\n')
        f.write(f'- 总页面数: {len(docs)}\n')
        f.write(f'- 成功下载: {success_count}\n')
        f.write(f'- 下载失败: {fail_count}\n')
        f.write(f'- 更新时间: {time.strftime("%Y-%m-%d %H:%M:%S")}\n\n')
        f.write(f'## 分类目录\n\n')
        for cat, count in sorted(stats.items()):
            f.write(f'- {cat}: {count} 页\n')

if __name__ == '__main__':
    main()
