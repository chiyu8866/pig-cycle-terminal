#!/usr/bin/env python3
"""PIGWATCH 数据生成器：抓取生猪/玉米/豆粕期货数据，生成静态站点数据。

用法（ashare 环境）:
    ~/miniconda3/envs/ashare/bin/python scripts/build_data.py

输出:
    site/data/terminal.json   终端页与首页共用的全部数据
"""
import json
import sys
from pathlib import Path

import akshare as ak
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "data" / "terminal.json"

SYMBOLS = {
    "lh": ("LH0", "生猪主力连续"),
    "c": ("C0", "玉米主力连续"),
    "m": ("M0", "豆粕主力连续"),
}

# 猪粮比预警区间（发改委口径，期货口径近似）
RATIO_BANDS = {"deep_loss": 5.0, "loss": 6.0, "high": 9.0}


def fetch(sym: str, key: str) -> pd.DataFrame:
    df = ak.futures_zh_daily_sina(symbol=sym)
    df["date"] = pd.to_datetime(df["date"])
    return df[["date", "close", "volume", "hold"]].rename(
        columns={"close": f"{key}_close", "volume": f"{key}_vol", "hold": f"{key}_hold"}
    )


def pct_change_recent(series: pd.Series, n: int) -> float:
    if len(series) <= n:
        return float("nan")
    return float((series.iloc[-1] / series.iloc[-1 - n] - 1) * 100)


def percentile_rank(series: pd.Series) -> float:
    s = series.dropna()
    if s.empty:
        return float("nan")
    return float((s <= s.iloc[-1]).mean() * 100)


def term_structure() -> list:
    """生猪各合约最新价 → 期限结构。失败返回空列表。"""
    try:
        rt = ak.futures_zh_realtime(symbol="生猪")
        rows = []
        for _, r in rt.iterrows():
            sym = str(r["symbol"])
            if not sym.startswith("LH") or sym == "LH0":
                continue
            price = float(r.get("close") or r.get("trade") or 0)
            if price <= 0:
                continue
            rows.append({"contract": sym, "price": price})
        return sorted(rows, key=lambda x: x["contract"])
    except Exception as e:
        print(f"[warn] term structure fetch failed: {e}")
        return []


def seasonality(daily: pd.DataFrame) -> dict:
    """生猪期货上市以来，各日历月份的平均涨跌幅与胜率（样本仅5年，仅作参考）。"""
    d = daily.copy()
    d["ret"] = d["lh_close"].pct_change()
    g = d.dropna(subset=["ret"]).groupby(d["date"].dt.month)["ret"]
    avg = g.mean() * 100
    win = g.apply(lambda x: (x > 0).mean() * 100)
    months = []
    for m in range(1, 13):
        months.append({
            "month": f"{m}月",
            "avg_chg": round(float(avg.get(m, float("nan"))), 2),
            "win_rate": round(float(win.get(m, float("nan"))), 1),
            "n": int(g.count().get(m, 0)),
        })
    return {"months": months, "note": "样本为生猪期货2021年上市以来约5年数据，月度统计仅作参考"}


def main() -> int:
    frames = []
    for key, (sym, _) in SYMBOLS.items():
        df = fetch(sym, key)
        frames.append(df)
        print(f"[ok] {sym}: {len(df)} rows, last={df.iloc[-1,1]}")

    df = frames[0]
    for other in frames[1:]:
        df = df.merge(other, on="date", how="inner")
    df = df.sort_values("date").reset_index(drop=True)

    df["ratio"] = df["lh_close"] / df["c_close"]  # 猪粮比（期货近似）
    # 饲料成本指数：玉米 60% + 豆粕 40%，以 LH 上市首日=100
    df["feed"] = df["c_close"] * 0.6 + df["m_close"] * 0.4
    base = df["feed"].iloc[0]
    df["feed_idx"] = df["feed"] / base * 100

    last = df.iloc[-1]

    # 图表序列：取周频（每周最后交易日），控制 JSON 体积
    weekly = df.set_index("date").resample("W-FRI").last().dropna(subset=["lh_close"])
    chart = {
        "dates": [d.strftime("%Y-%m-%d") for d in weekly.index],
        "lh": [round(float(v), 0) for v in weekly["lh_close"]],
        "c": [round(float(v), 0) for v in weekly["c_close"]],
        "m": [round(float(v), 0) for v in weekly["m_close"]],
        "ratio": [round(float(v), 2) for v in weekly["ratio"]],
        "feed_idx": [round(float(v), 2) for v in weekly["feed_idx"]],
    }

    stats = {
        "asof": last["date"].strftime("%Y-%m-%d"),
        "lh_close": round(float(last["lh_close"]), 0),
        "lh_chg_20d": round(pct_change_recent(df["lh_close"], 20), 2),
        "lh_chg_250d": round(pct_change_recent(df["lh_close"], 250), 2),
        "lh_pctile_4y": round(percentile_rank(df["lh_close"].tail(1000)), 1),
        "c_close": round(float(last["c_close"]), 0),
        "m_close": round(float(last["m_close"]), 0),
        "ratio": round(float(last["ratio"]), 2),
        "ratio_chg_20d": round(float(last["ratio"] - df["ratio"].iloc[-21]), 2),
        "ratio_pctile_4y": round(percentile_rank(df["ratio"].tail(1000)), 1),
        "ratio_band": (
            "过度下跌一级预警" if last["ratio"] < RATIO_BANDS["deep_loss"]
            else "养殖亏损区" if last["ratio"] < RATIO_BANDS["loss"]
            else "盈利区" if last["ratio"] <= RATIO_BANDS["high"]
            else "价格过度上涨预警"
        ),
        "feed_idx": round(float(last["feed_idx"]), 2),
        "feed_chg_ytd": None,
    }
    # YTD 饲料成本变动
    y = last["date"].year
    ytd_base = df[df["date"].dt.year == y]
    if not ytd_base.empty:
        stats["feed_chg_ytd"] = round(float((last["feed_idx"] / ytd_base["feed_idx"].iloc[0] - 1) * 100), 2)

    # 波动率：20日年化
    ret = df["lh_close"].pct_change().dropna()
    vol20 = float(ret.tail(20).std() * (252 ** 0.5) * 100) if len(ret) >= 20 else float("nan")
    # 最大回撤（近一年）
    tail250 = df["lh_close"].tail(250)
    dd = (tail250 / tail250.cummax() - 1).min() * 100
    stats["vol20_ann"] = round(vol20, 1)
    stats["max_dd_1y"] = round(float(dd), 1)
    stats["lh_chg_ytd"] = None
    if not ytd_base.empty:
        stats["lh_chg_ytd"] = round(float((last["lh_close"] / ytd_base["lh_close"].iloc[0] - 1) * 100), 2)

    note = (
        f"截至 {stats['asof']}，生猪主力收盘 {stats['lh_close']:.0f} 元/吨，"
        f"近20日{'上涨' if stats['lh_chg_20d']>=0 else '下跌'} {abs(stats['lh_chg_20d'])}%，"
        f"处于近4年 {stats['lh_pctile_4y']}% 分位。"
        f"期货口径猪粮比 {stats['ratio']}（{stats['ratio_band']}），"
        f"玉米 {stats['c_close']:.0f}、豆粕 {stats['m_close']:.0f}，"
        f"饲料成本指数 {stats['feed_idx']}。"
    )

    payload = {
        "generated_at": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
        "units": {"lh": "元/吨", "c": "元/吨", "m": "元/吨", "ratio": "猪粮比(倍)"},
        "ratio_bands": RATIO_BANDS,
        "stats": stats,
        "note": note,
        "chart": chart,
        "curve": term_structure(),
        "seasonality": seasonality(df),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[write] {OUT} ({OUT.stat().st_size/1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
