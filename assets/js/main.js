let toastTimer;

function showToast(message) {
    const toast = document.querySelector(".toast");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3200);
}

window.showToast = showToast;

function updateProductPreview() {
    const form = document.querySelector("#product-form");
    if (!form) return;

    const name = form.elements.namedItem("nome").value.trim();
    const price = Number(form.elements.namedItem("preco").value) || 0;
    const quantity = Number.parseInt(form.elements.namedItem("quantidade").value, 10) || 0;
    const minimum = Number.parseInt(form.elements.namedItem("estoque_minimo").value, 10) || 0;
    const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

    document.querySelector("#summary-name").textContent = name || "—";
    document.querySelector("#summary-price").textContent = currency.format(price);
    document.querySelector("#summary-quantity").textContent = String(quantity);
    document.querySelector("#summary-minimum").textContent = String(minimum);
    document.querySelector("#summary-total").textContent = currency.format(price * quantity);

    const lowStock = quantity <= minimum;
    const status = document.querySelector("#stock-status");
    status.dataset.status = lowStock ? "low" : "ok";
    document.querySelector("#stock-status-title").textContent = lowStock ? "Estoque no limite" : "Estoque adequado";
    document.querySelector("#stock-status-description").textContent = lowStock
        ? "A quantidade está no mínimo ou abaixo dele."
        : "Quantidade acima do mínimo informado.";
    status.querySelector(".stock-status-icon").textContent = lowStock ? "!" : "✓";
}

window.addEventListener("erp:page-loaded", (event) => {
    if (event.detail.route !== "produtos") return;
    const form = document.querySelector("#product-form");
    form?.addEventListener("input", updateProductPreview);
    updateProductPreview();
});

document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector("#global-search")?.focus();
    }
    if (event.key === "Escape") closeMobileMenu();
});

document.querySelector("#global-search")?.addEventListener("input", (event) => {
    const query = event.target.value.trim().toLocaleLowerCase("pt-BR");
    const rows = [...document.querySelectorAll("#sales-table-body tr")];
    const emptySearch = document.querySelector(".empty-search");
    if (!rows.length) return;

    let visibleRows = 0;
    rows.forEach((row) => {
        const matches = row.textContent.toLocaleLowerCase("pt-BR").includes(query);
        row.hidden = !matches;
        if (matches) visibleRows += 1;
    });
    if (emptySearch) emptySearch.hidden = visibleRows !== 0;
});

document.addEventListener("click", (event) => {
    const exportButton = event.target.closest(".export-button");
    if (exportButton) exportSummary();

    if (event.target.closest(".date-button")) {
        showToast("Período exibido: 01 a 29 de outubro de 2026.");
    }
    if (event.target.closest(".notification-button")) {
        showToast("Você tem 3 pontos da operação para acompanhar.");
    }
    if (event.target.closest(".logout-button")) {
        showToast("A conexão de autenticação será adicionada quando o login estiver configurado.");
    }

    const messageButton = event.target.closest("[data-message]");
    if (messageButton) showToast(messageButton.dataset.message);

    const storeButton = event.target.closest(".store-switcher");
    if (storeButton) {
        const storeMenu = document.querySelector("#store-menu");
        const expanded = storeButton.getAttribute("aria-expanded") === "true";
        storeButton.setAttribute("aria-expanded", String(!expanded));
        if (storeMenu) storeMenu.hidden = expanded;
    }

    const menuButton = event.target.closest(".mobile-menu");
    if (menuButton) {
        const sidebar = document.querySelector(".sidebar");
        const open = sidebar?.classList.toggle("is-open") ?? false;
        menuButton.setAttribute("aria-expanded", String(open));
    }

    if (event.target.closest("[data-route]")) closeMobileMenu();
    if (window.innerWidth <= 620 && document.querySelector(".sidebar.is-open") &&
        !event.target.closest(".sidebar") && !event.target.closest(".mobile-menu")) closeMobileMenu();
});

function closeMobileMenu() {
    document.querySelector(".sidebar")?.classList.remove("is-open");
    document.querySelector(".mobile-menu")?.setAttribute("aria-expanded", "false");
}

function exportSummary() {
    const rows = [["Indicador", "Resultado"]];
    document.querySelectorAll(".metric-card").forEach((card) => {
        const label = card.querySelector(".metric-label")?.childNodes[0]?.textContent?.trim();
        const value = card.querySelector(".metric-value")?.textContent?.trim();
        if (label && value) rows.push([label, value]);
    });
    if (rows.length === 1) {
        showToast("A exportação está disponível no resumo do dashboard.");
        return;
    }

    const csv = "\uFEFF" + rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(";")).join("\r\n");
    const file = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "resumo-lume-outubro-2026.csv";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Resumo exportado.");
}
