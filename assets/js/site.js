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

    // Overlay the PDF's own hyperlinks on a rendered page so they stay clickable.
    // Positions are percentages of the page, so they track the canvas as CSS scales it.
    async function addCvLinks(page, viewport, pageEl) {
        const annotations = await page.getAnnotations();
        annotations
            .filter(a => a.subtype === "Link" && a.url && /^(https?:|mailto:)/i.test(a.url))
            .forEach(a => {
                const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(a.rect);
                const link = document.createElement("a");
                link.className = "cv-link";
                link.href = a.url;
                if (!a.url.startsWith("mailto:")) {
                    link.target = "_blank";
                    link.rel = "noopener";
                }
                link.title = a.url;
                link.setAttribute("aria-label", a.url);
                link.style.left = (Math.min(x1, x2) / viewport.width * 100) + "%";
                link.style.top = (Math.min(y1, y2) / viewport.height * 100) + "%";
                link.style.width = (Math.abs(x2 - x1) / viewport.width * 100) + "%";
                link.style.height = (Math.abs(y2 - y1) / viewport.height * 100) + "%";
                pageEl.appendChild(link);
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
                    const pageEl = document.createElement("div");
                    pageEl.className = "cv-page";
                    pageEl.appendChild(canvas);
                    container.appendChild(pageEl);
                    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
                    await addCvLinks(page, viewport, pageEl);
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
    // Labels need real text sizes, so place them once the chart is visible and fonts are in.
    const placeLabelsWhenVisible = () => document.fonts.ready.then(placeChartLabels);
    window.addEventListener("hashchange", () => render(true));
    window.addEventListener("hashchange", placeLabelsWhenVisible);
    let labelResizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(labelResizeTimer);
        labelResizeTimer = setTimeout(() => { chartLabelsPlaced = false; placeLabelsWhenVisible(); }, 200);
    });
    render(false);
    placeLabelsWhenVisible();

    // ---- Publication chart labels ------------------------------------------
    // Each label tries above, below, right, then left of its dot and keeps the first
    // spot that overlaps no other dot or already placed label and stays inside the chart.
    let chartLabelsPlaced = false;

    function placeChartLabels() {
        const svg = document.querySelector(".pub-chart svg");
        if (!svg || chartLabelsPlaced || !svg.getBoundingClientRect().width) return;
        const view = svg.viewBox.baseVal;
        const points = Array.from(svg.querySelectorAll(".pub-chart-point")).map(el => {
            const dot = el.querySelector(".dot");
            return { el, text: el.querySelector("text"), x: dot.cx.baseVal.value, y: dot.cy.baseVal.value };
        }).sort((a, b) => a.x - b.x);
        const pad = 3;
        const boxes = points.map(p => ({ owner: p, x: p.x - 7, y: p.y - 7, width: 14, height: 14 }));
        const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        const spots = [
            { dx: 0, dy: -12, anchor: "middle" },
            { dx: 0, dy: 22, anchor: "middle" },
            { dx: 11, dy: 4, anchor: "start" },
            { dx: -11, dy: 4, anchor: "end" },
        ];
        points.forEach(p => {
            let best = null;
            for (const spot of spots) {
                p.text.setAttribute("x", p.x + spot.dx);
                p.text.setAttribute("y", p.y + spot.dy);
                p.text.setAttribute("text-anchor", spot.anchor);
                const b = p.text.getBBox();
                const box = { owner: p, x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad };
                const inside = box.x >= view.x && box.y >= view.y && box.x + box.width <= view.x + view.width;
                const clashes = boxes.filter(o => o.owner !== p && overlaps(box, o)).length;
                const score = clashes + (inside ? 0 : 1);
                if (!best || score < best.score) best = { spot, box, score };
                if (score === 0) break;
            }
            p.text.setAttribute("x", p.x + best.spot.dx);
            p.text.setAttribute("y", p.y + best.spot.dy);
            p.text.setAttribute("text-anchor", best.spot.anchor);
            boxes.push(best.box);
        });
        chartLabelsPlaced = true;
    }

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
