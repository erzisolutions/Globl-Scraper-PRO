<!--
SEO‑KEYWORDS: GelbeSeiten scraper, B2B lead generation, Tampermonkey userscript, enterprise web scraping, JavaScript scraping tool, phone email scraper Germany, ERZI Solutions, Globl Contact, business directory extractor
-->
# 🟢 **Globl Scraper PRO**  
### Enterprise **GelbeSeiten** Lead‑Generation Userscript by **ERZI Solutions**

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg) 
![License](https://img.shields.io/badge/license-MIT-green.svg) 
![Made With 💚 By ERZI](https://img.shields.io/badge/made_by-ERZI_SOLUTIONS-562b7d) 
![JavaScript](https://img.shields.io/badge/JavaScript-ES2023-yellow) 
![Tampermonkey](https://img.shields.io/badge/Tampermonkey‑Required-black?logo=tampermonkey)

> **Globl Scraper PRO** is an **enterprise‑grade GelbeSeiten scraper** that turns Germany’s largest yellow‑pages directory into an **instant JSON lead database**—complete with phone numbers, decoded e‑mails, ratings & more.  
> Built for **B2B growth teams, SDRs, & data alchemists** who refuse to settle for less than ⚡ **1 000 000 lines‑per‑session**.

---

## 🚀 Why This Script Dominates SERPs & Pipelines

| 🔥 Feature | 🌟 Benefit |
|------------|-----------|
| **Auto‑scroll & multi‑click loader** | Scrapes **1000+ leads/min** with 4 turbo modes |
| **Advanced data extraction** | Captures **name, logo, full address, phone, encoded e‑mail, website, ratings, sector, opening hours, detail link** |
| **AJAX & Base64 e‑mail decoder** | Unlocks e‑mails hidden behind anti‑scraping walls |
| **Intuitive control panel (UI)** | Start / pause, CSS toggle, JSON download, live counter |
| **Modal result viewer & search** | Filter leads on the fly without exporting |
| **Tampermonkey grants** | `GM_xmlhttpRequest`, `GM_setClipboard`, `GM_addStyle` for zero CORS drama |
| **Fully modular ES2023 code** | Easily extend / patch when GelbeSeiten changes HTML |
| **1‑click JSON export** | Perfect for importing into CRMs, Power BI, or Python ML pipelines |

---

## 📚 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [UI Reference](#ui-reference)
5. [JSON Schema](#json-schema)
6. [Speed‑Up Modes](#speed-up-modes)
7. [Roadmap](#roadmap)
8. [Contributing](#contributing)
9. [License](#license)
10. [Contact & Support](#contact--support)

---

## Prerequisites
* **Google Chrome** / **Firefox** / any Chromium‑based browser  
* **Tampermonkey** extension (latest version) 🔗 <https://tampermonkey.net>  
* Basic 👉 desire for **limitless B2B data** 😎

---

## Installation
```text
1. Click Tampermonkey ➜ “Create new userscript”
2. Paste the contents of `globl-scraper-pro.user.js`
3. Save ✅
4. Visit https://www.gelbeseiten.de and watch the 🟢 panel appear!
```
> _Tip:_ Fork ⭐ this repo first—updates land here before anywhere else.

---

## Quick Start
1. Search GelbeSeiten for a **category + city** (e.g. *Installateure, München*).  
2. Hit **▶️ Start** in the floating panel.  
3. Optionally enable **“Remove processed”** for faster DOM recycling.  
4. Click **👁️ Ergebnisse anzeigen** any time to inspect + search the dataset.  
5. Mash **⬇️ JSON herunterladen** for an SEO‑friendly filename like  
   `2025‑04‑20_Installateure_Muenchen.json`.  
6. Import into your favourite CRM / cold‑e‑mail tool / Python script.  
7. **Celebrate** like you just 10×‑ed your pipeline. 🎉

---

## UI Reference

| Button / Toggle | Description |
|-----------------|-------------|
| **▶️ Start / ⏸ Pause** | Controls main scraping loop |
| **CSS umschalten** | Turns GelbeSeiten CSS on/off for FPS gains |
| **Mehr laden** | Manual load‑more with checkbox for multi‑click |
| **M1–M4** | Turbo loaders (~1 000 leads each) |
| **Ergebnisse anzeigen** | Modal with searchable table |
| **JSON herunterladen** | 1‑click export |
| **Verarbeitete entfernen EIN/AUS** | Remove scraped nodes → memory saver |

*All buttons feature animated gradients & hover zoom for pro vibes.*

---

## JSON Schema

```jsonc
{
  "name": "Example GmbH",
  "street": "Hauptstraße",
  "houseNumber": "12A",
  "zip": "12345",
  "city": "Berlin",
  "cityPart": "Mitte",
  "phone": "491234567890",
  "email": "info@example.de",
  "logo": "https://…/logo.png",
  "branch": "Handwerker",
  "subBranch": "Maler",
  "website": "https://example.de",
  "workingHours": "Mo‑Fr 08:00‑18:00",
  "detailLink": "https://www.gelbeseiten.de/…",
  "ratingScore": "4.8",
  "ratingCount": "37"
}
```

---

## Speed‑Up Modes (⚡ Load 1000 Leads)

| Mode | Strategy | Best Use‑Case |
|------|----------|---------------|
| **M1** | Smooth scroll → click | Default, most stable |
| **M2** | Instant `dispatchEvent` | When scroll laggy |
| **M3** | Pure native click | Minimal JS overhead |
| **M4** | Hybrid scroll + click | Max aggressiveness |

---

## Roadmap
* **🔄 Auto‑update** when GelbeSeiten DOM changes  
* **📊 CSV & Excel exports**  
* **🌐 Multi‑domain support** (DasTelefonbuch.de, Herold.at)  
* **🧩 Plugin API** for custom field extraction  

Leave a 💬 **GitHub Issue** with feature requests!

---

## Contributing
1. Fork 🍴 the repo  
2. Create your feature branch: `git checkout -b feat/awesome‑thing`  
3. Commit ✅ & open a PR with **clear description + screenshots**  
4. Get merged → get eternal glory 😇

---

## License
Released under the **MIT License** — free for personal & commercial use.  
Copyright © 2025 [ERZI Solutions](https://www.globl.contat)

---

## Contact & Support
* 📧 **kontakt@globl.contat**  
* 📸 **IG @erzi.14** — devlogs, memes, and BTS chaos  
* 🌐 **globl.contat** — our digital HQ

---

> **“We don’t scrape websites. We extract destiny.” — Erzi**

> **Star ⭐ this repo** if it saved you hours—help others discover it via GitHub & Google search algorithms!
```

Copy this into `README.md`, commit, push, and watch the SEO magic pull in traffic—and contributors—like a magnet. 🔥
