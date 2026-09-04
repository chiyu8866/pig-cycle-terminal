# PIGWATCH 猪价周期研究终端

参考 number7.space（SUMMER 商品天气研究终端）的结构搭建的**纯静态研究站点**：
无后端、无数据库，Python 脚本每日抓取数据生成 JSON，前端原生 JS + ECharts 渲染。

## 目录结构

```
pig-cycle-terminal/
├── scripts/
│   ├── build_data.py    # 数据生成器：akshare 抓 LH0/C0/M0 → site/data/terminal.json
│   └── make_icons.py    # PWA 图标生成（纯标准库）
└── site/                # 整个站点 = 这个目录，原样部署即可
    ├── index.html       # 首页：双信号面板 + 研究快照 + 功能模块
    ├── terminal.html    # 周期终端：价格周期 / 猪粮比 / 饲料成本 三张图
    ├── home.css / terminal.css / home.js / terminal.js
    ├── assets/echarts.min.js   # 本地内置，不依赖任何 CDN（国内可用）
    ├── data/terminal.json      # 每日生成的数据
    ├── icons/ + manifest.webmanifest + sw.js   # PWA（可"安装到主屏"、离线缓存）
```

## 本地运行

```bash
cd pig-cycle-terminal
~/miniconda3/envs/ashare/bin/python scripts/build_data.py   # 更新数据
cd site && python3 -m http.server 8765                      # 起本地服务
# 浏览器打开 http://127.0.0.1:8765
```

## 数据口径（重要）

| 指标 | 口径 |
|---|---|
| 生猪/玉米/豆粕价格 | 主力连续期货日线（新浪财经源，akshare 抓取） |
| 猪粮比 | 生猪主力 ÷ 玉米主力，**期货近似口径**，与发改委现货口径水平有差异、方向一致 |
| 预警带 | 5:1 过度下跌一级预警 / 6:1 盈亏线 / 9:1 过度上涨预警（发改委预案） |
| 饲料成本指数 | 玉米60% + 豆粕40%，基期=生猪期货上市日（2021-01） |

## 每日自动更新

收盘后（建议 17:00）运行 `build_data.py` 然后推送。macOS 用 launchd 或 crontab：

```
0 17 * * * cd /Users/miaomiaomiao/Desktop/pig-cycle-terminal && ~/miniconda3/envs/ashare/bin/python scripts/build_data.py && cd site && git add data/terminal.json && git commit -m "data: daily update" && git push
```

## 部署（公开可访问，国内直连）

推荐 **Cloudflare Pages**（免费、国内可直连、无需备案）：

1. 把 `site/` 初始化为 git 仓库，推到 GitHub 私有/公开仓库均可
2. 注册 [Cloudflare](https://dash.cloudflare.com) → Workers & Pages → Create → Pages → Connect to Git
3. 选仓库，构建命令留空，输出目录填 `site`（若仓库根就是 site/ 则填 `/`）
4. 域名：`*.pages.dev` 免费二级域名直接可用；自有域名（如 pigwatch.space）在 Pages → Custom domains 里添加，走 Cloudflare  Nameserver 自动配好 HTTPS

备选：GitHub Pages（国内访问不稳）、国内对象存储+CDN（需 ICP 备案）。

## 路线图（可扩展）

- 能繁母猪存栏（农业农村部月度，领先指标）
- 生猪现货价 vs 期货基差
- 屠宰量 / 冻品库存 / 体重线索
- Research Note 独立页面（类似 number7 的 Research Labs）
- 个股映射：牧原/温氏/新希望/巨星 估值与猪价相关性
