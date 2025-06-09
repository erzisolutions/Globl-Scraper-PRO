// ==UserScript==
// @name           🟢 Globl Scraper PRO
// @namespace      https://www.globl.contat
// @version        2.1.0
// @description    Enterprise-grade GelbeSeiten Scraper with modular architecture, enhanced error handling, JSON export, and intuitive UI.
// @author         Globl Contact
// @match          https://www.gelbeseiten.de/*
// @match          https://www.dastelefonbuch.de/*
// @match          https://www.herold.at/*
// @grant          GM_addStyle
// @grant          GM_setClipboard
// @grant          GM_xmlhttpRequest
// ==/UserScript==


(async function () {
    'use strict';

    logger.info("🚀 Globl Scraper gestartet!");

    /*******************************
     * KONFIGURATION & GLOBALE VARIABLEN
     *******************************/
    const SCRAPE_DELAY = 300;      // ms zwischen Iterationen
    const MAX_ENTRIES = 1000000;   // Maximale Anzahl Einträge
    const LOAD_MORE_DELAY = 500;   // ms nach Klick auf "Mehr laden"

    let isPaused = true;
    let leads = [];
    let scrapeInProgress = false;
    let REMOVE_PROCESSED_ENTRIES = true;
    let cssEnabled = true;
    let loadMultiple = true;

    const LOGIN_USER = 'admin';
    const LOGIN_PASS = 'propass';

    /*******************************
     * PLUGIN-ARCHITEKTUR & LOGGER
     *******************************/
    const plugins = {
        beforeAddLead: [],
        afterAddLead: [],
        afterScrape: []
    };

    function registerPlugin(event, fn) {
        if (plugins[event]) {
            plugins[event].push(fn);
        } else {
            logger.warn(`Unbekanntes Plugin-Event: ${event}`);
        }
    }

    function runPlugins(event, payload) {
        if (!plugins[event]) return true;
        for (const fn of plugins[event]) {
            const res = fn(payload);
            if (res === false) return false;
        }
        return true;
    }

    const logger = {
        info: (...args) => console.log('%c[INFO]', 'color:green', ...args),
        warn: (...args) => console.warn('%c[WARN]', 'color:orange', ...args),
        error: (...args) => console.error('%c[ERROR]', 'color:red', ...args),
        group: (...args) => console.group(...args),
        groupEnd: () => console.groupEnd()
    };

    // Einfaches Deduplizierungs-Plugin
    const dedupSet = new Set();
    registerPlugin('beforeAddLead', ({ lead }) => {
        const key = `${lead.name}|${lead.phone}|${lead.detailLink}`;
        if (dedupSet.has(key)) {
            logger.info('Duplikat übersprungen:', key);
            return false; // Lead nicht erneut hinzufügen
        }
        dedupSet.add(key);
        return true;
    });

    /*******************************
     * HILFSFUNKTIONEN
     *******************************/
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    const toggleCSS = () => {
        cssEnabled = !cssEnabled;
        const styles = document.querySelectorAll("link[rel='stylesheet'], style");
        styles.forEach(el => {
            if (el.id === "gs-scraper-style") return;
            el.disabled = !cssEnabled;
        });
        logger.info(`🎨 CSS ist jetzt ${cssEnabled ? "eingeschaltet" : "ausgeschaltet"}.`);
    };

    // Entfernt Leerzeichen und Bindestriche; ersetzt führende "0" mit "49"
    function transformPhoneNumber(phoneRaw) {
        if (!phoneRaw || phoneRaw === "Not Available") return "";
        const digits = phoneRaw.replace(/\s+/g, "").replace(/-/g, "");
        return digits.startsWith("0") ? "49" + digits.substring(1) : digits;
    }

    function updateLeadCount() {
        const btn = document.getElementById("gs-scrapeButton");
        if (btn) {
            btn.innerHTML = `
                <div style="font-size: 28px; font-weight: bold;">${leads.length}</div>
                <small>${isPaused ? "Scraping fortsetzen" : "Scraping pausieren"}</small>
            `;
            btn.classList.toggle("active", !isPaused);
            btn.classList.toggle("scrape", isPaused);
        }
    }

    function downloadDataAsJSON() {
        if (leads.length === 0) {
            alert("🚨 Keine Daten zum Herunterladen!");
            return;
        }
        const jsonStr = JSON.stringify(leads, null, 2);
        const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, ":");
        const whatInput = document.getElementById("what_search");
        const whereInput = document.getElementById("where_search");
        const searchWhat = whatInput ? whatInput.value.trim() : "what";
        const searchCity = whereInput ? whereInput.value.trim() : "city";
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dateStr} ${searchWhat} ${searchCity}.json`;
        a.click();
        URL.revokeObjectURL(url);
        logger.info("📊 Daten erfolgreich als JSON heruntergeladen!");
    }

    function convertToCSV(items) {
        const headers = Object.keys(items[0] || {});
        const escape = (str) => '"' + String(str).replace(/"/g, '""') + '"';
        const rows = items.map(itm => headers.map(h => escape(itm[h] ?? '')).join(','));
        return headers.join(',') + '\n' + rows.join('\n');
    }

    function downloadDataAsCSV() {
        if (leads.length === 0) {
            alert("🚨 Keine Daten zum Herunterladen!");
            return;
        }
        const csvStr = convertToCSV(leads);
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, ':');
        const blob = new Blob([csvStr], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dateStr} leads.csv`;
        a.click();
        URL.revokeObjectURL(url);
        logger.info('📊 Daten erfolgreich als CSV heruntergeladen!');
    }

    function downloadDataAsExcel() {
        if (leads.length === 0) {
            alert('🚨 Keine Daten zum Herunterladen!');
            return;
        }
        const csvStr = convertToCSV(leads);
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, ':');
        const blob = new Blob([csvStr], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dateStr} leads.xls`;
        a.click();
        URL.revokeObjectURL(url);
        logger.info('📊 Daten erfolgreich als Excel heruntergeladen!');
    }

    // Umhüllung von GM_xmlhttpRequest in ein Promise
    function fetchEmail(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                onload: function(response) {
                    if (response.status === 200) {
                        resolve(response.responseText.trim());
                    } else {
                        reject(new Error("HTTP-Status " + response.status));
                    }
                },
                onerror: function(err) {
                    reject(err);
                }
            });
        });
    }

    /*******************************
     * SCRAPING-FUNKTIONEN
     *******************************/
    async function scrapeData() {
        if (scrapeInProgress) return;
        scrapeInProgress = true;
        let totalScraped = 0;
        logger.group("Scraping");
        logger.info("🚀 Scraping gestartet...");

        while (!isPaused && totalScraped < MAX_ENTRIES) {
            const entries = Array.from(document.querySelectorAll('.mod-Treffer:not([data-scraped="true"])'));
            if (entries.length === 0) {
                const loadMoreButton = document.querySelector("#mod-LoadMore--button");
                if (loadMoreButton) {
                    loadMoreButton.scrollIntoView({ behavior: "smooth", block: "center" });
                    await delay(LOAD_MORE_DELAY);
                    loadMoreButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                    logger.info("📡 Lade neue Einträge...");
                    await delay(SCRAPE_DELAY);
                    continue;
                } else {
                    logger.warn("🛑 Keine weiteren Einträge zum Laden.");
                    break;
                }
            }

            for (const entry of entries) {
                if (isPaused || totalScraped >= MAX_ENTRIES) break;

                const name = entry.querySelector('h2.mod-Treffer__name')?.textContent.trim() || "Not Available";

                // Adresse
                const addressText = entry.querySelector('.mod-AdresseKompakt__adress-text')?.textContent.trim() || "Not Available";
                let street = "", houseNumber = "", zip = "", city = "", cityPart = "";
                if (addressText !== "Not Available") {
                    const parts = addressText.split(', ');
                    const streetAddress = parts[0] || "";
                    const match = streetAddress.match(/^(.*\D)(\d+\w*)$/);
                    if (match) {
                        street = match[1].trim();
                        houseNumber = match[2].trim();
                    } else {
                        street = streetAddress.trim();
                    }
                    if (parts[1]) {
                        const regex = /^(\d{5})\s+(.+)/;
                        const match2 = parts[1].match(regex);
                        if (match2) {
                            zip = match2[1].trim();
                            city = match2[2].trim();
                        } else {
                            const tokens = parts[1].split(' ');
                            zip = tokens[0]?.trim() || "";
                            city = tokens.slice(1).join(' ').trim();
                        }
                        const cityMatch = city.match(/(.*?)\s*\((.*?)\)/);
                        if (cityMatch) {
                            city = cityMatch[1].trim();
                            cityPart = cityMatch[2].trim();
                            // Falls cityPart nur Zahlen und "km" oder "m" enthält, setze es auf einen leeren String
                            if (/^[\d\s]*(km|m)$/i.test(cityPart)) {
                                cityPart = "";
                            } else {
                                // Entferne eventuelle Vorkommen von "km" und "m"
                                cityPart = cityPart.replace(/(\d+\s*km)/gi, "").replace(/(\d+\s*m)/gi, "").replace(/\b(km|m)\b/gi, "").trim();
                            }
                        }
                    }
                }

                // Telefon
                const phoneRaw = entry.querySelector('a.mod-TelefonnummerKompakt__phoneNumber')?.textContent.trim() || "Not Available";
                const phone = transformPhoneNumber(phoneRaw);

                // E-Mail – AJAX-Abruf, falls data-email-url vorhanden
                let email = "Not Available";
                const emailElem = entry.querySelector('span.contains-icon-email');
                if (emailElem) {
                    const emailUrl = emailElem.getAttribute('data-email-url');
                    if (emailUrl) {
                        try {
                            let fullUrl = new URL(emailUrl, location.origin).href;
                            logger.info("Abrufe E-Mail via GM_xmlhttpRequest von:", fullUrl);
                            email = await fetchEmail(fullUrl);
                            if (!email) {
                                logger.warn("Leere Antwort, nutze Fallback.");
                                const encodedEmail = emailElem.getAttribute('data-prg');
                                email = encodedEmail ? atob(encodedEmail) : emailElem.textContent.trim();
                            }
                        } catch (e) {
                            logger.error("Fehler beim Abrufen der E-Mail:", e);
                            const encodedEmail = emailElem.getAttribute('data-prg');
                            email = encodedEmail ? atob(encodedEmail) : emailElem.textContent.trim();
                        }
                    } else {
                        const encodedEmail = emailElem.getAttribute('data-prg');
                        if (encodedEmail) {
                            try {
                                email = atob(encodedEmail);
                            } catch (e) {
                                logger.error("Fehler beim Dekodieren der E-Mail:", e);
                                email = emailElem.textContent.trim();
                            }
                        } else {
                            email = emailElem.textContent.trim();
                        }
                    }
                }

                // Logo
                let logo = "Not Available";
                const logoElem = entry.querySelector('img.mod-Treffer__logo');
                if (logoElem) {
                    logo = logoElem.getAttribute('src') || "Not Available";
                }

                // Branche
                const branchRaw = entry.querySelector('p.mod-Treffer--besteBranche')?.textContent.trim() || "Not Available";
                let mainBranch = branchRaw, subBranch = "";
                const branchMatch = branchRaw.match(/(.*?)\s*\((.*?)\)/);
                if (branchMatch) {
                    mainBranch = branchMatch[1].trim();
                    subBranch = branchMatch[2].trim();
                }

                // Öffnungszeiten
                const workingHours = entry.querySelector('.oeffnungszeitKompakt__text')?.textContent.trim() || "Not Available";

                // Webseite
                let website = "Not Available";
                const websiteElem = entry.querySelector('.mod-WebseiteKompakt__text');
                if (websiteElem) {
                    const websiteEncoded = websiteElem.getAttribute('data-webseitelink');
                    if (websiteEncoded) {
                        try {
                            website = atob(websiteEncoded);
                        } catch (e) {
                            logger.error("Fehler beim Dekodieren der Webseite:", e);
                            website = websiteElem.textContent.trim();
                        }
                    } else {
                        website = websiteElem.textContent.trim();
                    }
                }

                // Detail-Link
                let detailLink = "Not Available";
                const detailElem = entry.querySelector('a.mod-Treffer__name');
                if (detailElem) {
                    detailLink = detailElem.getAttribute('href') || "Not Available";
                    if (detailLink !== "Not Available") {
                        detailLink = new URL(detailLink, location.origin).href;
                    }
                }

                // Bewertungen: ratingScore und ratingCount
                let ratingScore = "Not Available";
                let ratingCount = "Not Available";
                const ratingContainer = entry.querySelector('div[data-bewertungen="bewertungen"]');
                if (ratingContainer) {
                    const scoreElem = ratingContainer.querySelector('span[class*="mod-BewertungKompakt__number"]');
                    const countElem = ratingContainer.querySelector('span[class*="mod-BewertungKompakt__text"]');
                    if (scoreElem) {
                        ratingScore = scoreElem.textContent.trim();
                    }
                    if (countElem) {
                        const m = countElem.textContent.trim().match(/(\d+)/);
                        ratingCount = m ? m[1] : countElem.textContent.trim();
                    }
                }

                const newLead = {
                    name,
                    street,
                    houseNumber,
                    zip,
                    city,
                    cityPart,
                    phone,
                    email,
                    logo,
                    branch: mainBranch,
                    subBranch,
                    website,
                    workingHours,
                    detailLink,
                    ratingScore,
                    ratingCount
                };
                if (runPlugins('beforeAddLead', { lead: newLead }) !== false) {
                    leads.push(newLead);
                    runPlugins('afterAddLead', { lead: newLead });
                }
                entry.setAttribute("data-scraped", "true");
                totalScraped++;

                if (REMOVE_PROCESSED_ENTRIES) {
                    entry.remove();
                }
            }

            updateLeadCount();
            await delay(SCRAPE_DELAY);
        }

        scrapeInProgress = false;
        logger.info("✅ Scraping-Zyklus abgeschlossen. Insgesamt Einträge:", totalScraped);
        runPlugins('afterScrape', { total: totalScraped });
        logger.groupEnd();
    }

    async function loadMoreEntries() {
        logger.info("📡 Lade weitere Einträge...");
        const loadMoreButton = document.querySelector("#mod-LoadMore--button");
        if (loadMoreButton) {
            loadMoreButton.scrollIntoView({ behavior: "smooth", block: "center" });
            await delay(LOAD_MORE_DELAY);
            if (loadMultiple) {
                for (let i = 0; i < 5; i++) {
                    loadMoreButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                    await delay(LOAD_MORE_DELAY);
                }
            } else {
                loadMoreButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
            }
            logger.info("📡 Klick auf 'Mehr laden'.");
            await delay(SCRAPE_DELAY);
        } else {
            logger.warn("🛑 Button 'Mehr laden' nicht gefunden.");
        }
    }

    /*******************************
     * ANZEIGE DER ERGEBNISSE (MODAL)
     *******************************/
    function displayResults() {
        const container = document.getElementById('gs-scraper-table-container');
        container.innerHTML = "";
        const searchInput = document.createElement("input");
        searchInput.placeholder = "Suchen...";
        searchInput.style.width = "calc(100% - 20px)";
        searchInput.style.margin = "10px";
        container.appendChild(searchInput);

        const table = document.createElement('table');
        table.id = 'gs-scraper-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Logo</th>
                    <th>Name</th>
                    <th>Straße</th>
                    <th>Hausnummer</th>
                    <th>PLZ</th>
                    <th>Stadt</th>
                    <th>Stadtteil</th>
                    <th>Telefon</th>
                    <th>E-Mail</th>
                    <th>Bewertung</th>
                    <th>Anzahl Bewertungen</th>
                    <th>Branche</th>
                    <th>Unterbranche</th>
                    <th>Website</th>
                    <th>Öffnungszeiten</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        leads.forEach((item, index) => {
            const emailHtml = item.email !== "Not Available"
                ? `<a href="mailto:${encodeURIComponent(item.email)}">${item.email}</a>`
                : "Nicht verfügbar";
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.logo !== "Not Available" ? `<img src="${item.logo}" alt="${item.name} logo" style="max-width:50px; max-height:50px;">` : "N/V"}</td>
                <td>${item.name}</td>
                <td>${item.street}</td>
                <td>${item.houseNumber}</td>
                <td>${item.zip}</td>
                <td>${item.city}</td>
                <td>${item.cityPart}</td>
                <td>${item.phone}</td>
                <td>${emailHtml}</td>
                <td>${item.ratingScore}</td>
                <td>${item.ratingCount}</td>
                <td>${item.branch}</td>
                <td>${item.subBranch}</td>
                <td>${item.website}</td>
                <td>${item.workingHours}</td>
                <td>
                  ${item.detailLink !== "Not Available" ? `<button class="detail-btn" data-link="${item.detailLink}">Details anzeigen</button>` : "N/V"}
                </td>
            `;
            tbody.appendChild(tr);
        });
        container.appendChild(table);
        document.getElementById("gs-scraper-modal-overlay").style.display = "block";

        searchInput.addEventListener("input", function() {
            const filter = searchInput.value.toLowerCase();
            const rows = tbody.getElementsByTagName("tr");
            Array.from(rows).forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(filter) ? "" : "none";
            });
        });

        document.querySelectorAll('.detail-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const link = this.getAttribute('data-link');
                if(link && link !== "Not Available") {
                    showLeadDetails(link);
                } else {
                    alert("Details sind nicht verfügbar.");
                }
            });
        });
    }

    async function showLeadDetails(detailLink) {
        try {
            const response = await fetch(detailLink);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            let detailContent = doc.querySelector('.container--flexbox');
            if (!detailContent) {
                detailContent = doc.body;
            }
            const detailModal = document.createElement('div');
            detailModal.id = "gs-detail-modal-overlay";
            detailModal.style.position = "fixed";
            detailModal.style.top = "0";
            detailModal.style.left = "0";
            detailModal.style.width = "100%";
            detailModal.style.height = "100%";
            detailModal.style.backgroundColor = "rgba(0,0,0,0.8)";
            detailModal.style.zIndex = "10003";
            detailModal.innerHTML = `
                <div style="background:#f3f3f3; margin:50px auto; padding:20px; max-width:900px; max-height:90vh; overflow:auto; position:relative;">
                    <span id="gs-close-detail-btn" style="position:absolute; top:10px; right:10px; cursor:pointer; font-size:24px;">&times;</span>
                    ${detailContent.innerHTML}
                </div>
            `;
            document.body.appendChild(detailModal);
            document.getElementById("gs-close-detail-btn").addEventListener("click", function() {
                document.body.removeChild(detailModal);
            });
            detailModal.addEventListener("click", function(e) {
                if(e.target === detailModal){
                    document.body.removeChild(detailModal);
                }
            });
        } catch (err) {
            logger.error("Fehler beim Abrufen der Details:", err);
            alert("Fehler beim Abrufen der Details.");
        }
    }

    /*******************************
     * UI: STEUERUNGSPANEL & MODAL-ERSTELLUNG
     *******************************/
    const gsStyle = GM_addStyle(`
    /* --- Globl Scraper UI Styles --- */
    #gs-scraper-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #f3f3f3;
        padding: 10px;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        z-index: 9999;
        font-family: Arial, sans-serif;
        color: #333;
        width: 320px;
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    #gs-scraper-container h3 {
        margin: 0 0 10px 0;
        font-size: 20px;
        text-align: center;
    }
    .gs-scraper-button {
        padding: 12px 16px;
        margin: 5px 0;
        min-width: 200px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        text-align: center;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: block;
    }
    .gs-scraper-button:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 8px rgba(0,0,0,0.5);
    }
    .gs-scraper-button:active {
        transform: scale(0.98);
        box-shadow: 0 2px 4px rgba(0,0,0,0.4);
    }
    .gs-scraper-button.scrape {
        background: linear-gradient(135deg, #de7227, #c85f1f);
        color: white;
    }
    .gs-scraper-button.active {
        background: linear-gradient(135deg, #562b7d, #4e256c);
        color: white;
    }
    .gs-scraper-button.download {
        background: linear-gradient(135deg, #68a138, #5f9e30);
        color: white;
    }
    .gs-scraper-button.toggle {
        background: linear-gradient(135deg, #562b7d, #4e256c);
        color: white;
    }
    .gs-scraper-button.reset {
        background: linear-gradient(135deg, #de7227, #c85f1f);
        color: white;
    }
    /* --- Button "Mehr laden" mit integriertem Checkbox --- */
    #gs-loadMoreButton {
        position: relative;
        padding-right: 50px;
    }
    #gs-loadMoreButton input[type="checkbox"] {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        width: 18px;
        height: 18px;
        cursor: pointer;
    }
    /* --- Speed‑up Buttons Container --- */
    #gs-speedup-container {
        display: flex;
        justify-content: space-around;
        gap: 10px;
        width: 100%;
        margin-top: 5px;
    }
    #gs-speedup-container .gs-scraper-button.load1000 {
        background: linear-gradient(135deg, #68a138, #5f9e30);
        color: white;
        width: 40px;
        height: 40px;
        min-width: 40px;
        min-height: 40px;
        padding: 0;
        font-size: 14px;
        margin: 0;
        border-radius: 8px;
        text-align: center;
        line-height: 40px;
    }
    /* --- Modal Overlay & Container --- */
    #gs-scraper-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.6);
        z-index: 10001;
        display: none;
    }
    #gs-scraper-modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #f3f3f3;
        z-index: 10002;
        width: 95%;
        max-width: 1000px;
        max-height: 80vh;
        overflow-y: auto;
        border: 1px solid #ccc;
        border-radius: 5px;
        padding: 20px;
        font-family: Arial, sans-serif;
        box-shadow: 0 0 20px rgba(0,0,0,0.5);
    }
    #gs-scraper-modal h2 {
        margin-top: 0;
        font-size: 1.8em;
        border-bottom: 2px solid #562b7d;
        padding-bottom: 10px;
    }
    #gs-scraper-modal .close-btn {
        position: absolute;
        top: 10px;
        right: 15px;
        font-size: 28px;
        font-weight: bold;
        color: #aaa;
        cursor: pointer;
    }
    #gs-scraper-modal .close-btn:hover {
        color: #562b7d;
    }
    #gs-scraper-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
    }
    #gs-scraper-table th, #gs-scraper-table td {
        border: 1px solid #ddd;
        padding: 8px;
        font-size: 14px;
        text-align: center;
    }
    #gs-scraper-table th {
        background-color: #562b7d;
        color: white;
        position: sticky;
        top: 0;
    }
    #gs-scraper-table tr:nth-child(even) {
        background-color: #f9f9f9;
    }
    /* --- Modal Buttons oben --- */
    #gs-scraper-modal .modal-buttons {
        text-align: center;
        margin-bottom: 10px;
    }
    #gs-scraper-modal .modal-buttons button {
        margin: 5px;
        background: linear-gradient(135deg, #de7227, #c85f1f);
        color: #fff;
        border: none;
        padding: 8px 12px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s ease;
    }
    #gs-scraper-modal .modal-buttons button:hover {
        transform: scale(1.05);
        background: linear-gradient(135deg, #562b7d, #4e256c);
    }
    /* --- Login Overlay --- */
    #gs-login-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 10004;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    #gs-login-modal {
        background: #f3f3f3;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        text-align: center;
    }
    #gs-login-modal input {
        display: block;
        width: 200px;
        margin: 10px auto;
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
    }
    #gs-login-modal button {
        background: linear-gradient(135deg, #562b7d, #4e256c);
        color: #fff;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    }
    #gs-login-modal button:hover {
        background: linear-gradient(135deg, #de7227, #c85f1f);
    }
    `);
    gsStyle.id = "gs-scraper-style";

    /*******************************
     * UI: STEUERUNGSPANEL & MODAL-ERSTELLUNG
     *******************************/
    function createControlPanel() {
        let container = document.getElementById("gs-scraper-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "gs-scraper-container";
            container.innerHTML = `<h3>Globl Scraper</h3>`;
            document.body.appendChild(container);
        }

        const createButton = (id, classes, htmlContent, clickHandler) => {
            let btn = document.getElementById(id);
            if (!btn) {
                btn = document.createElement("button");
                btn.id = id;
                btn.className = `gs-scraper-button ${classes}`;
                btn.innerHTML = htmlContent;
                btn.addEventListener("click", clickHandler);
                container.appendChild(btn);
            }
            return btn;
        };

        let scrapeBtn = document.getElementById("gs-scrapeButton");
        if (!scrapeBtn) {
            scrapeBtn = document.createElement("button");
            scrapeBtn.id = "gs-scrapeButton";
            scrapeBtn.className = "gs-scraper-button scrape";
            scrapeBtn.innerHTML = `
                <div style="font-size: 28px; font-weight: bold;">${leads.length}</div>
                <small>Scraping fortsetzen</small>
            `;
            scrapeBtn.addEventListener("click", () => {
                isPaused = !isPaused;
                updateLeadCount();
                if (!isPaused) {
                    scrapeData().catch(err => logger.error("Fehler während des Scrapings:", err));
                } else {
                    logger.info("⏸️ Scraping pausiert.");
                }
            });
            container.appendChild(scrapeBtn);
        }

        createButton("gs-toggleCSSButton", "toggle", "CSS umschalten", toggleCSS);

        let loadMoreBtn = document.getElementById("gs-loadMoreButton");
        if (!loadMoreBtn) {
            loadMoreBtn = document.createElement("button");
            loadMoreBtn.id = "gs-loadMoreButton";
            loadMoreBtn.className = "gs-scraper-button load";
            loadMoreBtn.innerHTML = `Mehr laden <input type="checkbox" id="gs-load-multiple-checkbox">`;
            loadMoreBtn.querySelector('input').addEventListener("click", e => {
                e.stopPropagation();
                loadMultiple = e.target.checked;
                logger.info("Load Multiple ist jetzt", loadMultiple);
            });
            loadMoreBtn.addEventListener("click", async () => {
                await loadMoreEntries();
            });
            container.appendChild(loadMoreBtn);
        }

        createButton("gs-showResultsButton", "view", "Ergebnisse anzeigen", displayResults);
        createButton("gs-downloadJSONButton", "download", "JSON herunterladen", downloadDataAsJSON);
        createButton("gs-downloadCSVButton", "download", "CSV herunterladen", downloadDataAsCSV);
        createButton("gs-downloadXLSButton", "download", "Excel herunterladen", downloadDataAsExcel);
        createButton("gs-toggleRemoveButton", "toggle", `Verarbeitete entfernen: ${REMOVE_PROCESSED_ENTRIES ? "EIN" : "AUS"}`, () => {
            REMOVE_PROCESSED_ENTRIES = !REMOVE_PROCESSED_ENTRIES;
            const btn = document.getElementById("gs-toggleRemoveButton");
            btn.textContent = `Verarbeitete entfernen: ${REMOVE_PROCESSED_ENTRIES ? "EIN" : "AUS"}`;
            logger.info(`Verarbeitete entfernen ist jetzt ${REMOVE_PROCESSED_ENTRIES ? "aktiviert" : "deaktiviert"}.`);
        });

        let speedupContainer = document.getElementById("gs-speedup-container");
        if (!speedupContainer) {
            speedupContainer = document.createElement("div");
            speedupContainer.id = "gs-speedup-container";
            container.appendChild(speedupContainer);
        }
        speedupContainer.innerHTML = "";
        for (let method = 1; method <= 4; method++) {
            const btn = document.createElement("button");
            btn.id = `gs-load1000Button${method}`;
            btn.className = "gs-scraper-button load1000";
            btn.textContent = `M${method}`;
            btn.title = `Lade 1000 Leads (Methode ${method})`;
            btn.addEventListener("click", () => load1000Leads(method));
            speedupContainer.appendChild(btn);
        }
    }

    function createModalViewer() {
        let modalOverlay = document.getElementById("gs-scraper-modal-overlay");
        if (!modalOverlay) {
            modalOverlay = document.createElement("div");
            modalOverlay.id = "gs-scraper-modal-overlay";
            modalOverlay.innerHTML = `
                <div id="gs-scraper-modal">
                    <span class="close-btn" title="Schließen">&times;</span>
                    <h2>Erfasste Ergebnisse</h2>
                    <div class="modal-buttons">
                        <button class="copy-btn">JSON in Zwischenablage kopieren</button>
                        <button class="open-view-btn">Ansicht in neuem Tab öffnen</button>
                        <button class="download-json-btn">JSON herunterladen</button>
                        <button class="download-csv-btn">CSV herunterladen</button>
                        <button class="download-xls-btn">Excel herunterladen</button>
                    </div>
                    <div id="gs-scraper-table-container"></div>
                </div>
            `;
            document.body.appendChild(modalOverlay);
        }
        modalOverlay.querySelector('.close-btn').addEventListener("click", () => {
            modalOverlay.style.display = "none";
        });
        modalOverlay.addEventListener("click", (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.style.display = "none";
            }
        });
        modalOverlay.querySelector('.copy-btn').addEventListener("click", () => {
            GM_setClipboard(JSON.stringify(leads, null, 2), "text");
            alert("JSON in die Zwischenablage kopiert!");
        });
        modalOverlay.querySelector('.open-view-btn').addEventListener("click", () => {
            const tableContainer = document.getElementById("gs-scraper-table-container").innerHTML;
            const newWindowHtml = `
                <html>
                <head>
                  <title>Erfasste Ergebnisse</title>
                  <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
                    th { background-color: #562b7d; color: white; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                  </style>
                </head>
                <body>
                  <h2>Erfasste Ergebnisse</h2>
                  <div>${tableContainer}</div>
                </body>
                </html>
            `;
            const newWindow = window.open("", "_blank");
            newWindow.document.open();
            newWindow.document.write(newWindowHtml);
            newWindow.document.close();
        });
        modalOverlay.querySelector('.download-json-btn').addEventListener("click", downloadDataAsJSON);
        modalOverlay.querySelector('.download-csv-btn').addEventListener("click", downloadDataAsCSV);
        modalOverlay.querySelector('.download-xls-btn').addEventListener("click", downloadDataAsExcel);
    }

    async function load1000Leads(method) {
        logger.info(`🚀 Speed‑up Methode ${method} gestartet, um 1000 Leads zu laden...`);
        for (let i = 0; i < 100; i++) {
            const loadMoreButton = document.querySelector("#mod-LoadMore--button");
            if (loadMoreButton) {
                switch (method) {
                    case 1:
                        loadMoreButton.scrollIntoView({ behavior: "smooth", block: "center" });
                        await delay(70);
                        loadMoreButton.click();
                        await delay(50);
                        break;
                    case 2:
                        loadMoreButton.scrollIntoView({ behavior: "instant", block: "center" });
                        loadMoreButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                        await delay(50);
                        break;
                    case 3:
                        loadMoreButton.click();
                        await delay(100);
                        break;
                    case 4:
                        loadMoreButton.scrollIntoView({ behavior: "smooth", block: "center" });
                        await delay(50);
                        loadMoreButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                        await delay(50);
                        break;
                    default:
                        loadMoreButton.click();
                        await delay(50);
                }
            } else {
                logger.warn("🛑 Button 'Mehr laden' nicht gefunden.");
                break;
            }
        }
        logger.info(`✅ Speed‑up Methode ${method} abgeschlossen (ca. 1000 Leads geladen).`);
    }

    function showLogin() {
        if (localStorage.getItem('gsLoggedIn') === 'true') {
            init();
            return;
        }
        const overlay = document.createElement('div');
        overlay.id = 'gs-login-overlay';
        overlay.innerHTML = `
            <div id="gs-login-modal">
                <h2>Login</h2>
                <input type="text" id="gs-login-user" placeholder="Benutzername">
                <input type="password" id="gs-login-pass" placeholder="Passwort">
                <button id="gs-login-btn">Login</button>
            </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#gs-login-btn').addEventListener('click', () => {
            const u = overlay.querySelector('#gs-login-user').value.trim();
            const p = overlay.querySelector('#gs-login-pass').value.trim();
            if (u === LOGIN_USER && p === LOGIN_PASS) {
                localStorage.setItem('gsLoggedIn', 'true');
                overlay.remove();
                init();
            } else {
                alert('Login fehlgeschlagen.');
            }
        });
    }

    /*******************************
     * INITIALISIERUNG
     *******************************/
    function init() {
        createControlPanel();
        createModalViewer();
        logger.info("🚀 Globl Scraper UI bereit!");
    }
    showLogin();

    logger.info("Initialisiert und wartet auf Benutzeraktion.");
})();
