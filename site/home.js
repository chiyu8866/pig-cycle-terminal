/* PIGWATCH 首页数据填充：读取 data/terminal.json */
(async function () {
    const $ = (id) => document.getElementById(id);
    const fmt = (v, d = 2) => (v === null || v === undefined || isNaN(v)) ? "--" : Number(v).toFixed(d);
    const chgHtml = (v, unit = "%") => {
        if (v === null || v === undefined || isNaN(v)) return "--";
        const cls = v >= 0 ? "up" : "down";
        const sign = v >= 0 ? "+" : "";
        return `<b class="${cls}">${sign}${fmt(v)}${unit}</b>`;
    };

    let d;
    try {
        const res = await fetch("data/terminal.json", { cache: "no-store" });
        d = await res.json();
    } catch (e) {
        $("home-ai-summary").textContent = "数据读取失败，请稍后刷新。";
        return;
    }
    const s = d.stats;

    // 双信号面板
    $("hero-lh-price").textContent = `${fmt(s.lh_close, 0)} 元/吨`;
    $("hero-lh-price").className = s.lh_chg_20d >= 0 ? "up" : "down";
    $("hero-lh-note").textContent = `近20日${s.lh_chg_20d >= 0 ? "上涨" : "下跌"} ${fmt(Math.abs(s.lh_chg_20d))}% · 近4年分位 ${fmt(s.lh_pctile_4y, 1)}% · 数据截至 ${s.asof}`;

    $("hero-ratio").textContent = fmt(s.ratio);
    $("hero-ratio-note").textContent = `${s.ratio_band} · 近4年分位 ${fmt(s.ratio_pctile_4y, 1)}% · 20日变动 ${fmt(s.ratio_chg_20d)}`;

    // 研究快照
    $("home-ai-summary").textContent = d.note;

    // 信号卡
    $("sig-lh-updated").textContent = s.asof;
    $("sig-lh-value").textContent = fmt(s.lh_close, 0);
    $("sig-lh-pctile").textContent = fmt(s.lh_pctile_4y, 1) + "%";
    $("sig-lh-chg").innerHTML = chgHtml(s.lh_chg_20d);

    $("sig-ratio-updated").textContent = s.asof;
    $("sig-ratio-value").textContent = fmt(s.ratio);
    $("sig-ratio-band").textContent = s.ratio_band;

    $("sig-feed-updated").textContent = s.asof;
    $("sig-feed-value").textContent = fmt(s.feed_idx);
    $("sig-feed-chg").innerHTML = chgHtml(s.feed_chg_ytd);

    const volEl = $("sig-vol-value");
    if (volEl) {
        $("sig-vol-updated").textContent = s.asof;
        volEl.textContent = fmt(s.vol20_ann, 1) + "%";
        $("sig-dd").textContent = fmt(s.max_dd_1y, 1) + "%";
    }

    $("footer-asof").textContent = `${s.asof}（生成于 ${d.generated_at}）`;
})();
