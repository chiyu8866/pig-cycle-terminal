/* 产能跟踪页：读取 data/capacity.json 渲染存栏图与统计卡 */
(async function () {
    const $ = (id) => document.getElementById(id);
    const C = { text: "#e8eefb", dim: "#93a4c4", line: "rgba(148,178,226,0.14)", green: "#34d399", blue: "#4da3ff", red: "#f87171" };

    let d;
    try {
        const res = await fetch("data/capacity.json", { cache: "no-store" });
        d = await res.json();
    } catch (e) {
        $("capacity-meta").textContent = "数据读取失败";
        return;
    }
    const pts = d.points;
    const latest = pts[pts.length - 1];
    const dev = ((latest.value / d.normal_level - 1) * 100);

    const stats = [
        ["最新读数", `${latest.value} ${d.unit}`, `${latest.date} 口径`],
        ["距正常保有量目标", `${dev >= 0 ? "+" : ""}${dev.toFixed(1)}%`, `目标 ${d.normal_level} ${d.unit}`],
        ["上轮峰值", `${pts[0].value} ${d.unit}`, pts[0].date.slice(0, 7)],
        ["区间最低", `${Math.min(...pts.map(p => p.value))} ${d.unit}`, "记录以来"],
    ];
    $("capacity-stats").innerHTML = stats.map(([k, v, sub]) =>
        `<div class="terminal-stat"><span>${k}</span><strong>${v}</strong><small>${sub}</small></div>`
    ).join("");
    $("capacity-meta").textContent = `${pts[0].date.slice(0, 7)} 至 ${latest.date.slice(0, 7)} · ${d.source}`;
    $("footer-capacity-asof").textContent = latest.date;

    const chart = echarts.init($("chart-capacity"));
    chart.setOption({
        tooltip: {
            trigger: "axis", backgroundColor: "#16233f", borderColor: C.line,
            textStyle: { color: C.text, fontSize: 12 },
            formatter: (ps) => {
                const i = ps[0].dataIndex;
                const p = pts[i];
                return `<b>${p.date}</b><br/>能繁母猪：${p.value} ${d.unit}${p.tag ? "<br/>" + p.tag : ""}`;
            },
        },
        grid: { left: 60, right: 20, top: 40, bottom: 60 },
        xAxis: {
            type: "category", data: pts.map(p => p.date.slice(0, 7)),
            axisLine: { lineStyle: { color: C.line } }, axisLabel: { color: C.dim, fontSize: 11 },
        },
        yAxis: {
            type: "value", scale: true,
            axisLabel: { color: C.dim, fontSize: 11 }, splitLine: { lineStyle: { color: C.line } },
        },
        dataZoom: [{ type: "inside" }, { type: "slider", height: 18, bottom: 12, borderColor: C.line, backgroundColor: "transparent", fillerColor: "rgba(77,163,255,0.12)" }],
        series: [{
            name: "能繁母猪存栏", type: "line", data: pts.map(p => p.value),
            showSymbol: true, symbolSize: 8,
            lineStyle: { width: 2.5, color: C.green },
            itemStyle: { color: C.green },
            areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(52,211,153,0.25)" }, { offset: 1, color: "rgba(52,211,153,0)" }] } },
            markLine: {
                symbol: "none",
                data: [{
                    yAxis: d.normal_level,
                    label: { formatter: `正常保有量目标 ${d.normal_level}`, color: C.blue, fontSize: 11 },
                    lineStyle: { color: C.blue, type: "dashed" },
                }],
            },
            markPoint: {
                symbolSize: 52, label: { fontSize: 11, color: "#06101f" },
                data: pts.filter(p => p.tag).map(p => ({
                    coord: [p.date.slice(0, 7), p.value], value: p.value,
                    itemStyle: { color: p.value >= d.normal_level ? C.red : C.blue },
                })),
            },
        }],
    });
    window.addEventListener("resize", () => chart.resize());
})();
