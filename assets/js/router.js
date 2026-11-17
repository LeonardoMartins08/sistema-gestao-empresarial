const routes = {
    dashboard: { file: "pages/dashboard.html", title: "Visão geral" },
    clientes: { file: "pages/clientes.html", title: "Clientes" },
    produtos: { file: "pages/produtos.html", title: "Produtos" },
    financeiro: { file: "pages/financeiro.html", title: "Financeiro" },
};

let navigationId = 0;

async function loadRoute() {
    const routeName = window.location.hash.slice(1) || "dashboard";
    const route = routes[routeName] ?? routes.dashboard;
    if (!routes[routeName]) {
        window.history.replaceState(null, "", "#dashboard");
    }

    const requestId = ++navigationId;
    const pageView = document.querySelector("#page-view");
    const breadcrumb = document.querySelector("#breadcrumb-title");
    pageView.innerHTML = '<p class="loading-message">Carregando página...</p>';

    try {
        const response = await fetch(route.file);
        if (!response.ok) throw new Error(`Não foi possível abrir ${route.file}`);
        const markup = await response.text();
        if (requestId !== navigationId) return;

        const page = new DOMParser().parseFromString(markup, "text/html");
        pageView.innerHTML = page.body.innerHTML;
        const pageTitle = page.querySelector("[data-page-title]")?.dataset.pageTitle ?? route.title;
        breadcrumb.textContent = pageTitle;
        document.title = `${pageTitle} | Lume ERP`;

        document.querySelectorAll("[data-route]").forEach((link) => {
            const active = link.dataset.route === routeName;
            link.classList.toggle("is-active", active);
            if (active) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });

        window.dispatchEvent(new CustomEvent("erp:page-loaded", { detail: { route: routeName } }));
    } catch (error) {
        if (requestId !== navigationId) return;
        pageView.innerHTML = '<section class="panel page-placeholder"><h1>Não foi possível abrir esta página</h1><p>Confira se o projeto está sendo aberto por um servidor local e se o arquivo da página existe.</p></section>';
        console.error(error);
    }
}

window.addEventListener("hashchange", loadRoute);
window.addEventListener("DOMContentLoaded", loadRoute);
