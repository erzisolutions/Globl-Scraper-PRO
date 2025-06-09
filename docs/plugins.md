# Plugin System

Globl Scraper PRO ships with a lightweight event-based plugin API. Plugins can
hook into different stages of the scraping process without modifying the core
script.

## Registering a Plugin

```javascript
registerPlugin('beforeAddLead', ({ lead }) => {
    // inspect or modify the lead
    return true; // return false to skip saving
});
```

## Available Events

- `beforeAddLead` – called before a lead is stored
- `afterAddLead` – called after a lead is stored
- `afterScrape` – fired when the scraping loop finishes

 A simple deduplication plugin is included in the source code. Built-in export
 functions allow JSON, CSV, and Excel downloads. You can add your own modules
 for further enrichment or upload workflows by registering new callbacks.
