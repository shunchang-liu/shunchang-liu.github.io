(function () {
    const root = document.documentElement;

    // ---- Theme ------------------------------------------------------------
    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
        button.addEventListener("click", () => {
            const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
            root.setAttribute("data-theme", next);
            try { localStorage.setItem("theme", next); } catch (e) {}
            document.dispatchEvent(new Event("themechange"));
        });
    });

    // ---- Side panel (#publications, #about) -------------------------------
    const panel = document.querySelector(".panel");
    if (!panel) return;
    const views = Array.from(panel.querySelectorAll(".panel-view"));
    const panelLinks = document.querySelectorAll("[data-panel-link]");
    let lastLink = null;

    function render() {
        const id = location.hash.slice(1);
        const view = views.find(v => v.dataset.view === id);
        document.body.classList.toggle("panel-open", Boolean(view));
        views.forEach(v => { v.hidden = v !== view; });
        panelLinks.forEach(link => {
            if (link.dataset.panelLink === id) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
        if (view) {
            window.scrollTo(0, 0);
            panel.scrollTop = 0;
            const heading = view.querySelector(".panel-title");
            heading.setAttribute("tabindex", "-1");
            heading.focus({ preventScroll: true });
        }
    }

    function close() {
        history.pushState(null, "", location.pathname + location.search);
        render();
        if (lastLink) lastLink.focus();
    }

    panelLinks.forEach(link => link.addEventListener("click", () => { lastLink = link; }));
    panel.querySelectorAll("[data-panel-close]").forEach(b => b.addEventListener("click", close));
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && document.body.classList.contains("panel-open")) close();
    });
    window.addEventListener("hashchange", render);
    render();

    // ---- Publication filters ----------------------------------------------
    const items = Array.from(document.querySelectorAll(".pub"));
    const topicButtons = document.querySelectorAll("[data-topic]");
    const search = document.getElementById("pub-search");
    const status = document.querySelector(".pub-status");
    const empty = document.querySelector(".pub-empty");
    if (!items.length || !search) return;

    let topic = "selected";

    function matchesTopic(item) {
        if (topic === "all") return true;
        if (topic === "selected") return item.dataset.selected === "true";
        return item.dataset.topics.split("|").includes(topic);
    }

    function apply() {
        const terms = search.value.toLowerCase().split(/\s+/).filter(Boolean);
        let shown = 0;
        items.forEach(item => {
            const visible = matchesTopic(item) && terms.every(t => item.dataset.search.includes(t));
            item.hidden = !visible;
            if (visible) shown += 1;
        });
        topicButtons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.topic === topic)));
        status.textContent = shown + (shown === 1 ? " paper" : " papers") + " · newest first";
        empty.hidden = shown > 0;
    }

    topicButtons.forEach(button => button.addEventListener("click", () => {
        topic = button.dataset.topic === topic && topic !== "all" ? "all" : button.dataset.topic;
        apply();
    }));
    search.addEventListener("input", apply);
    apply();
})();
