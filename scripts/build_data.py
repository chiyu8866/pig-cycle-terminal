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
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"[write] {OUT} ({OUT.stat().st_size/1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
