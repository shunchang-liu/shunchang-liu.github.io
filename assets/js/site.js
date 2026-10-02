(function () {
    const root = document.documentElement;

    // ---- Theme ------------------------------------------------------------
    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
        button.addEventListener("click", () => {
            const next = root.getAttribute("data-theme") === "pink" ? "blue" : "pink";
            if (next === "pink") root.setAttribute("data-theme", "pink");
            else root.removeAttribute("data-theme");
            try { localStorage.setItem("theme", next); } catch (e) {}
            document.dispatchEvent(new Event("themechange"));
        });
    });

    // ---- Side panel (#publications, #about, #cv) --------------------------
    const panel = document.querySelector(".panel");
    if (!panel) return;
    const views = Array.from(panel.querySelectorAll(".panel-view"));
    const panelLinks = document.querySelectorAll("[data-panel-link]");
    let lastLink = null;
    let shownView = null;

    function render(fromNavigation) {
        const view = views.find(v => v.dataset.view === location.hash.slice(1)) || null;
        const id = view ? view.dataset.view : "";
        document.body.classList.toggle("panel-open", Boolean(view));
        views.forEach(v => { v.hidden = v !== view; });
        panelLinks.forEach(link => {
            if (link.dataset.panelLink === id) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
        if (view && view.dataset.view === "cv") loadCv(view.querySelector("[data-cv-src]"));
        if (view && view !== shownView) {
            window.scrollTo(0, 0);
            panel.scrollTop = 0;
            if (fromNavigation) {
                const heading = view.querySelector(".panel-title");
                heading.setAttribute("tabindex", "-1");
                heading.focus({ preventScroll: true });
            }
        }
        shownView = view;
    }

    // Render the CV PDF as page images so readers can view it without downloading.
    const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
    let cvLoading = null;

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error("Failed to load " + src));
            document.head.appendChild(s);
        });
    }

    function loadCv(container) {
        if (!container || cvLoading) return;
        const status = container.querySelector(".cv-status");
        const src = container.dataset.cvSrc;
        cvLoading = loadScript(PDFJS + "pdf.min.js")
            .then(() => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
                return pdfjsLib.getDocument(src).promise;
            })
            .then(async pdf => {
                for (let n = 1; n <= pdf.numPages; n++) {
                    const page = await pdf.getPage(n);
                    // Render at a fixed high resolution; CSS scales it to the panel width.
                    const scale = 1600 / page.getViewport({ scale: 1 }).width;
                    const viewport = page.getViewport({ scale });
                    const canvas = document.createElement("canvas");
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    canvas.setAttribute("role", "img");
                    canvas.setAttribute("aria-label", "CV page " + n + " of " + pdf.numPages);
                    container.appendChild(canvas);
                    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
                }
                status.remove();
            })
            .catch(err => {
                console.error(err);
                cvLoading = null;
                status.innerHTML = 'The CV could not be displayed here. <a href="' + src + '" target="_blank" rel="noopener">Open the PDF</a>.';
            });
    }

    function close() {
        history.pushState(null, "", location.pathname + location.search);
        render(false);
        if (lastLink) lastLink.focus();
    }

    panelLinks.forEach(link => link.addEventListener("click", () => { lastLink = link; }));
    panel.querySelectorAll("[data-panel-close]").forEach(b => b.addEventListener("click", close));
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && location.hash) close();
    });
    window.addEventListener("hashchange", () => render(true));
    render(false);

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
