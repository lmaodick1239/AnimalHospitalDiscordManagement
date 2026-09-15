(() => {
  const root = document.querySelector("main[data-events]");
  if (!root) return;
  const tz = root.dataset.tz || "UTC";
  const eventsUrl = root.dataset.events || "";
  const postUrl = root.dataset.post || "";
  const csrf = root.dataset.csrf || "";
  const closed = root.dataset.closed === "1";
  const log = document.querySelector("#log");
  const error = document.querySelector("#err");
  const modeButton = document.querySelector("#mode");
  let mode = "ANOMALY";
  let source = null;
  let polling = null;

  const time = (iso) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  const pin = () => log && log.scrollHeight - log.scrollTop - log.clientHeight < 32;
  const occupancy = (map) => Object.entries(map).forEach(([room, kind]) => { const button = document.querySelector(`button[data-room="${room}"]`); if (button) button.classList.remove("occ-ANOMALY", "occ-MAYBE"); if (button && kind) button.classList.add(`occ-${kind}`); });
  const append = (report) => { if (!log || document.querySelector(`[data-report-id="${report.id}"]`)) return; const keep = pin(); const row = document.createElement("li"); row.dataset.reportId = report.id; row.className = `row-${report.kind}`; row.textContent = `${time(report.createdAt)} ${report.room} ${report.kind} ${report.displayName}`; log.append(row); if (keep) log.scrollTop = log.scrollHeight; };
  const tick = (report) => { const row = document.querySelector(`[data-report-id="${report.id}"]`); if (row) { row.classList.add("row-ticked"); if (!row.textContent.endsWith(" ✅")) row.textContent += " ✅"; } };
  const apply = (data) => { if (data.occupancy) occupancy(data.occupancy); if (data.rows) data.rows.filter((row) => row.type === "report").forEach((row) => { append(row.report); if (row.report.tickedAt) tick(row.report); }); if (data.type === "report") append(data.report); if (data.type === "tick") tick(data.report); if (data.type === "closed" || data.closed) { root.dataset.closed = "1"; document.querySelectorAll("#pad button").forEach((button) => { button.disabled = true; }); const heading = root.querySelector("h1"); if (heading && !heading.textContent.includes("Closed")) heading.textContent += " · Closed"; } };
  const poll = async () => { try { const response = await fetch(`${location.pathname}/poll`, { headers: { Accept: "application/json" } }); if (!response.ok) throw new Error("poll failed"); apply(await response.json()); if (polling !== null) { clearInterval(polling); polling = null; connect(); } } catch { /* keep fallback polling */ } };
  const connect = () => { if (closed || !eventsUrl) return; source?.close(); source = new EventSource(eventsUrl); source.onmessage = (event) => apply(JSON.parse(event.data)); source.onerror = () => { source?.close(); source = null; if (polling === null) polling = window.setInterval(() => void poll(), 2000); }; };
  modeButton?.addEventListener("click", () => { mode = mode === "ANOMALY" ? "MAYBE" : "ANOMALY"; modeButton.textContent = `Mode: ${mode}`; });
  if (!closed) document.querySelectorAll("button[data-room]").forEach((button) => button.addEventListener("click", async () => { button.disabled = true; try { const response = await fetch(postUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ csrf, room: button.dataset.room, kind: mode }) }); const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || "Report failed."); apply(data); } catch (caught) { if (error) error.textContent = caught instanceof Error ? caught.message : String(caught); } finally { if (root.dataset.closed !== "1") button.disabled = false; } }));
  connect();
})();
