/* PIGWATCH 终端页：读取 data/terminal.json，渲染统计卡与 ECharts 图 */
(async function () {
    const $ = (id) => document.getElementById(id);
    const fmt = (v, d = 2) => (v === null || v === undefined || isNaN(v)) ? "--" : Number(v).toFixed(d);
    const C = { text: "#e8eefb", dim: "#93a4c4", line: "rgba(148,178,226,0.14)", red: "#f87171", green: "#34d399", blue: "#4da3ff", amber: "#fbbf24" };
    const baseAxis = {
        axisLine: { lineStyle: { color: C.line } },
        axisLabel: { color: C.dim, fontSize: 11 },
        splitLine: { lineStyle: { color: C.line } },
    };
    const tooltipBase = {
        trigger: "axis",
        backgroundColor: "#16233f",
        borderColor: C.line,
        textStyle: { color: C.text, fontSize: 12 },
    };

    let d;
    try {
        const res = await fetch("data/terminal.json", { cache: "no-store" });
        d = await res.json();
    } catch (e) {
        $("terminal-note").textContent = "数据读取失败，请稍后刷新。";
        return;
    }
    const s = d.stats, ch = d.chart;

    // 顶部总览
    $("terminal-note").textContent = d.note;
    $("footer-asof").textContent = `${s.asof}（生成于 ${d.generated_at}）`;
    const statDefs = [
        ["生猪主力", `${fmt(s.lh_close, 0)} 元/吨`, `近20日 ${s.lh_chg_20d >= 0 ? "+" : ""}${fmt(s.lh_chg_20d)}% · 分位 ${fmt(s.lh_pctile_4y, 1)}%`],
        ["猪粮比", fmt(s.ratio), `${s.ratio_band}`],
        ["玉米", `${fmt(s.c_close, 0)} 元/吨`, "主力连续"],
        ["豆粕", `${fmt(s.m_close, 0)} 元/吨`, "主力连续"],
        ["饲料成本指数", fmt(s.feed_idx), `年初至今 ${s.feed_chg_ytd === null ? "--" : (s.feed_chg_ytd >= 0 ? "+" : "") + fmt(s.feed_chg_ytd) + "%"}`],
    ];
    $("terminal-stats").innerHTML = statDefs.map(([k, v, sub]) =>
        `<div class="terminal-stat"><span>${k}</span><strong>${v}</strong><small>${sub}</small></div>`
    ).join("");

    // 图1：生猪价格周期
    const chartCycle = echarts.init($("chart-cycle"));
    chartCycle.setOption({
        tooltip: { ...tooltipBase, valueFormatter: (v) => `${fmt(v, 0)} 元/吨` },
        grid: { left: 60, right: 20, top: 40, bottom: 60 },
        xAxis: { type: "category", data: ch.dates, ...baseAxis },
        yAxis: { type: "value", scale: true, ...baseAxis, axisLine: { show: false } },
        dataZoom: [{ type: "inside" }, { type: "slider", height: 18, bottom: 12, borderColor: C.line, backgroundColor: "transparent", fillerColor: "rgba(77,163,255,0.12)" }],
        series: [{
            name: "生猪主力", type: "line", data: ch.lh, showSymbol: false,
            lineStyle: { width: 2, color: C.red },
            areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(248,113,113,0.25)" }, { offset: 1, color: "rgba(248,113,113,0)" }] } },
            markLine: {
                symbol: "none", label: { color: C.dim, fontSize: 11 },
                data: [{ yAxis: s.lh_close, label: { formatter: "当前 " + fmt(s.lh_close, 0) }, lineStyle: { color: C.amber, type: "dashed" } }],
            },
        }],
    });
    $("cycle-meta").textContent = `${ch.dates[0]} 至 ${ch.dates[ch.dates.length - 1]} · 周频 · 生猪期货上市以来的完整周期记录`;

    // 图2：猪粮比 + 预警带
    const chartRatio = echarts.init($("chart-ratio"));
    chartRatio.setOption({
        tooltip: { ...tooltipBase, valueFormatter: (v) => fmt(v) },
        grid: { left: 50, right: 20, top: 40, bottom: 60 },
        xAxis: { type: "category", data: ch.dates, ...baseAxis },
        yAxis: { type: "value", min: 4, scale: true, ...baseAxis, axisLine: { show: false } },
        dataZoom: [{ type: "inside" }, { type: "slider", height: 18, bottom: 12, borderColor: C.line, backgroundColor: "transparent", fillerColor: "rgba(77,163,255,0.12)" }],
        series: [
            { name: "猪粮比", type: "line", data: ch.ratio, showSymbol: false, lineStyle: { width: 2, color: C.blue },
              markLine: {
                  symbol: "none", label: { color: C.dim, fontSize: 11 },
                  data: [
                      { yAxis: 6, label: { formatter: "6:1 盈亏线" }, lineStyle: { color: C.green, type: "dashed" } },
                      { yAxis: 5, label: { formatter: "5:1 一级预警" }, lineStyle: { color: C.red, type: "dashed" } },
                      { yAxis: 9, label: { formatter: "9:1 上涨预警" }, lineStyle: { color: C.amber, type: "dashed" } },
                  ],
              },
              markArea: {
                  silent: true,
                  data: [
                      [{ yAxis: 4, itemStyle: { color: "rgba(248,113,113,0.10)" } }, { yAxis: 5 }],
                      [{ yAxis: 5, itemStyle: { color: "rgba(251,191,36,0.06)" } }, { yAxis: 6 }],
                      [{ yAxis: 9, itemStyle: { color: "rgba(251,191,36,0.06)" } }, { yAxis: 12 }],
                  ],
              },
            },
        ],
    });

    // 图3：饲料成本指数 + 生猪价格对比
    const chartFeed = echarts.init($("chart-feed"));
    chartFeed.setOption({
        tooltip: { ...tooltipBase },
        legend: { textStyle: { color: C.dim }, top: 4 },
        grid: { left: 60, right: 60, top: 40, bottom: 60 },
        xAxis: { type: "category", data: ch.dates, ...baseAxis },
        yAxis: [
            { type: "value", name: "成本指数", nameTextStyle: { color: C.dim }, scale: true, ...baseAxis, axisLine: { show: false } },
            { type: "value", name: "生猪 元/吨", nameTextStyle: { color: C.dim }, scale: true, ...baseAxis, axisLine: { show: false }, splitLine: { show: false } },
        ],
        dataZoom: [{ type: "inside" }, { type: "slider", height: 18, bottom: 12, borderColor: C.line, backgroundColor: "transparent", fillerColor: "rgba(77,163,255,0.12)" }],
        series: [
            { name: "饲料成本指数", type: "line", data: ch.feed_idx, showSymbol: false, lineStyle: { width: 2, color: C.amber } },
            { name: "生猪主力", type: "line", data: ch.lh, yAxisIndex: 1, showSymbol: false, lineStyle: { width: 1.5, color: C.red, type: "dashed" } },
        ],
    });
    $("feed-meta").textContent = `当前指数 ${fmt(s.feed_idx)} · 年初至今 ${s.feed_chg_ytd === null ? "--" : fmt(s.feed_chg_ytd) + "%"}`;

    // 图4：期限结构
    const curveEl = $("chart-curve");
    if (curveEl && d.curve && d.curve.length) {
        const chartCurve = echarts.init(curveEl);
        const near = d.curve[0].price;
        const labels = d.curve.map(r => r.contract.replace("LH", ""));
        const chgs = d.curve.map(r => +(((r.price / near) - 1) * 100).toFixed(2));
        const shape = chgs[chgs.length - 1] > 1 ? "远月升水（Contango）" : chgs[chgs.length - 1] < -1 ? "远月贴水（Backwardation）" : "近平水";
        chartCurve.setOption({
            tooltip: { ...tooltipBase, formatter: (ps) => {
                const i = ps[0].dataIndex;
                return `<b>${d.curve[i].contract}</b><br/>价格：${d.curve[i].price} 元/吨<br/>较最低月份：${chgs[i] >= 0 ? "+" : ""}${chgs[i]}%`;
            } },
            grid: { left: 60, right: 60, top: 40, bottom: 40 },
            xAxis: { type: "category", data: labels, name: "合约月份", nameTextStyle: { color: C.dim }, ...baseAxis },
            yAxis: [
                { type: "value", name: "元/吨", nameTextStyle: { color: C.dim }, scale: true, ...baseAxis, axisLine: { show: false } },
                { type: "value", name: "较最低月%", nameTextStyle: { color: C.dim }, scale: true, ...baseAxis, axisLine: { show: false }, splitLine: { show: false } },
            ],
            series: [
                { name: "合约价", type: "bar", data: d.curve.map(r => r.price), barWidth: "45%",
                  itemStyle: { borderRadius: [6, 6, 0, 0], color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#4da3ff" }, { offset: 1, color: "rgba(77,163,255,0.25)" }] } } },
                { name: "较最低月份 %", type: "line", yAxisIndex: 1, data: chgs, showSymbol: true, symbolSize: 7,
                  lineStyle: { width: 2, color: C.amber }, itemStyle: { color: C.amber } },
            ],
        });
        $("curve-meta").textContent = `${shape} · ${d.curve.length} 个挂牌合约 · ${s.asof} 收盘`;
        window.addEventListener("resize", () => chartCurve.resize());
    } else if (curveEl) {
        $("curve-meta").textContent = "非交易时段数据不可用";
    }

    // 图5：季节规律
    const seasonEl = $("chart-season");
    if (seasonEl && d.seasonality && d.seasonality.months) {
        const chartSeason = echarts.init(seasonEl);
        const months = d.seasonality.months;
        chartSeason.setOption({
            tooltip: { ...tooltipBase, formatter: (ps) => {
                const i = ps[0].dataIndex;
                const m = months[i];
                return `<b>${m.month}</b><br/>平均涨跌：${m.avg_chg >= 0 ? "+" : ""}${m.avg_chg}%<br/>上涨胜率：${m.win_rate}%（样本 ${m.n} 年）`;
            } },
            grid: { left: 50, right: 50, top: 40, bottom: 40 },
            xAxis: { type: "category", data: months.map(m => m.month), ...baseAxis },
            yAxis: [
                { type: "value", name: "平均涨跌%", nameTextStyle: { color: C.dim }, scale: true, ...baseAxis, axisLine: { show: false } },
                { type: "value", name: "胜率%", max: 100, nameTextStyle: { color: C.dim }, ...baseAxis, axisLine: { show: false }, splitLine: { show: false } },
            ],
            series: [
                { name: "平均涨跌", type: "bar", barWidth: "50%", data: months.map(m => m.avg_chg),
                  itemStyle: { borderRadius: [6, 6, 0, 0], color: (p) => p.value >= 0 ? "rgba(52,211,153,0.75)" : "rgba(248,113,113,0.75)" } },
                { name: "胜率", type: "line", yAxisIndex: 1, data: months.map(m => m.win_rate),
                  showSymbol: true, symbolSize: 7, lineStyle: { width: 2, color: C.amber }, itemStyle: { color: C.amber } },
            ],
        });
        $("season-meta").textContent = d.seasonality.note;
        window.addEventListener("resize", () => chartSeason.resize());
    } else if (seasonEl) {
        $("season-meta").textContent = "数据不可用";
    }

    window.addEventListener("resize", () => { chartCycle.resize(); chartRatio.resize(); chartFeed.resize(); });
})();
