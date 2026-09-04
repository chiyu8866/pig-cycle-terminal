/* PWA 安装触发：捕获 beforeinstallprompt，未触发则隐藏按钮 */
(function () {
    const btn = document.getElementById("pwa-install-trigger");
    if (!btn) return;
    let deferred = null;
    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        deferred = e;
        btn.hidden = false;
    });
    if (!window.matchMedia("(display-mode: standalone)").matches) {
        // 已安装则隐藏
        btn.addEventListener("click", async () => {
            if (!deferred) return;
            deferred.prompt();
            await deferred.userChoice;
            deferred = null;
            btn.hidden = true;
        });
    } else {
        btn.hidden = true;
    }
    // 桌面 Chrome 若从不触发 beforeinstallprompt，10 秒后给个提示态
    setTimeout(() => { if (!deferred) btn.textContent = "浏览器菜单可安装"; }, 10000);
})();
