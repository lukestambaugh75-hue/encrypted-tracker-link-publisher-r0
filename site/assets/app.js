"use strict";

const app = document.getElementById("app");

function locked() {
  document.title = "Private Dashboard";
  const section = document.createElement("section");
  section.className = "locked";
  const mark = document.createElement("div");
  mark.className = "lock-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "\u25cf";
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "PRIVATE DASHBOARD";
  const heading = document.createElement("h1");
  heading.textContent = "Locked";
  const note = document.createElement("p");
  note.textContent = "This page needs the complete link from its authorized email.";
  section.append(mark, eyebrow, heading, note);
  app.replaceChildren(section);
}

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value || "")) throw new Error("locked");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function unlock() {
  const keyText = new URLSearchParams(location.hash.slice(1)).get("k");
  const keyBytes = decodeBase64Url(keyText);
  if (keyBytes.length !== 32) throw new Error("locked");

  const response = await fetch("./envelope.json", {cache: "no-store", credentials: "omit"});
  if (!response.ok) throw new Error("locked");
  const envelope = await response.json();
  const envelopeKeys = [
    "format", "version", "algorithm", "audience_id", "binding_id",
    "snapshot_id", "generated_at", "nonce", "aad", "ciphertext",
    "ciphertext_sha256"
  ];
  if (!exactKeys(envelope, envelopeKeys)) throw new Error("locked");
  if (envelope.format !== "encrypted-dashboard-envelope" || envelope.version !== 1 || envelope.algorithm !== "A256GCM") {
    throw new Error("locked");
  }

  const nonce = decodeBase64Url(envelope.nonce);
  const aad = decodeBase64Url(envelope.aad);
  const ciphertext = decodeBase64Url(envelope.ciphertext);
  if (nonce.length !== 12 || await sha256Hex(ciphertext) !== envelope.ciphertext_sha256) {
    throw new Error("locked");
  }

  const aadObject = JSON.parse(new TextDecoder().decode(aad));
  if (
    aadObject.audience_id !== envelope.audience_id ||
    aadObject.binding_id !== envelope.binding_id ||
    aadObject.envelope_version !== envelope.version ||
    aadObject.snapshot_id !== envelope.snapshot_id ||
    aadObject.generated_at !== envelope.generated_at
  ) throw new Error("locked");

  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const clear = await crypto.subtle.decrypt(
    {name: "AES-GCM", iv: nonce, additionalData: aad, tagLength: 128},
    key,
    ciphertext
  );
  const payload = JSON.parse(new TextDecoder().decode(clear));
  if (
    payload.schema_version !== 1 ||
    payload.snapshot_id !== envelope.snapshot_id ||
    payload.generated_at !== envelope.generated_at ||
    !Array.isArray(payload.rows)
  ) throw new Error("locked");

  history.replaceState(null, "", location.pathname + location.search);
  render(payload);
}

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function money(value) {
  return typeof value === "number"
    ? new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"}).format(value)
    : "\u2014";
}

function render(payload) {
  document.title = payload.title;
  const root = element("section", "dashboard");
  const hero = element("header", "hero");
  const copy = element("div");
  copy.append(
    element("p", "eyebrow", payload.overall_status),
    element("h1", null, payload.summary.decision),
    element("p", "recommendation", payload.summary.recommendation)
  );
  const metadata = element("div", "metadata");
  for (const [label, value] of [
    ["Dashboard", payload.title],
    ["Generated", payload.generated_at],
    ["Source freshness", payload.source_freshness],
    ["Snapshot", payload.snapshot_id]
  ]) {
    const card = element("div");
    card.append(element("span", null, label), element("strong", null, value));
    metadata.append(card);
  }
  hero.append(copy, metadata);

  const kpis = element("div", "kpis");
  for (const [label, value] of [
    ["Results", payload.rows.length],
    ["Verified changes", payload.summary.verified_changes],
    ["Blocked", payload.summary.blocked],
    ["Stale", payload.summary.stale],
    ["Overdue", payload.summary.overdue]
  ]) {
    const card = element("div", "kpi");
    card.append(element("span", null, label), element("strong", null, value));
    kpis.append(card);
  }

  const controls = element("div", "controls");
  const search = element("input");
  search.type = "search";
  search.placeholder = "Search every result";
  search.setAttribute("aria-label", "Search results");
  const status = element("select");
  status.setAttribute("aria-label", "Filter by status");
  status.append(new Option("All statuses", ""));
  for (const value of [...new Set(payload.rows.map(row => row.status))].sort()) {
    status.append(new Option(value, value));
  }
  const sort = element("button", null, "Sort lowest price");
  sort.type = "button";
  controls.append(search, status, sort);

  const tableWrap = element("div", "table-wrap");
  const table = element("table");
  const head = element("thead");
  const headRow = element("tr");
  for (const label of ["Item", "Price", "Change", "Availability", "Evidence", "Confidence", "Validation", "History", "Status", "Direct link"]) {
    headRow.append(element("th", null, label));
  }
  head.append(headRow);
  const body = element("tbody");
  table.append(head, body);
  tableWrap.append(table);

  let priceAscending = false;
  function draw() {
    const needle = search.value.trim().toLowerCase();
    const wantedStatus = status.value;
    let rows = payload.rows.filter(row => {
      const history = (row.history || []).flatMap(entry => [entry.at, entry.value, entry.note]);
      const haystack = [row.name, row.model, row.availability, row.freshness, row.confidence, row.validation, row.status, ...history, ...Object.values(row.details || {})].join(" ").toLowerCase();
      return (!needle || haystack.includes(needle)) && (!wantedStatus || row.status === wantedStatus);
    });
    if (priceAscending) {
      rows = [...rows].sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY));
    }
    body.replaceChildren();
    for (const row of rows) body.append(renderRow(row));
    if (!rows.length) {
      const emptyRow = element("tr");
      const cell = element("td", "empty", "No results match the current filters.");
      cell.colSpan = 10;
      emptyRow.append(cell);
      body.append(emptyRow);
    }
  }
  search.addEventListener("input", draw);
  status.addEventListener("change", draw);
  sort.addEventListener("click", () => {
    priceAscending = !priceAscending;
    sort.textContent = priceAscending ? "Use source order" : "Sort lowest price";
    draw();
  });

  root.append(hero, kpis, controls, tableWrap);
  app.replaceChildren(root);
  draw();
}

function renderRow(row) {
  const tr = element("tr");
  const item = element("td");
  item.dataset.label = "Item";
  item.append(element("strong", null, row.name));
  if (row.model) item.append(element("div", "details", row.model));
  const details = Object.entries(row.details || {}).map(([key, value]) => `${key}: ${value}`).join(" \u00b7 ");
  if (details) item.append(element("div", "details", details));
  tr.append(item);
  const price = element("td", "price", money(row.price));
  price.dataset.label = "Price";
  tr.append(price);
  const change = element("td", row.change < 0 ? "negative" : row.change > 0 ? "positive" : "", row.change == null ? "\u2014" : money(row.change));
  change.dataset.label = "Change";
  tr.append(change);
  const availability = element("td", null, row.availability);
  availability.dataset.label = "Availability";
  tr.append(availability);
  const freshness = element("td", null, row.freshness);
  freshness.dataset.label = "Evidence";
  tr.append(freshness);
  const confidence = element("td", null, row.confidence);
  confidence.dataset.label = "Confidence";
  tr.append(confidence);
  const validation = element("td", null, row.validation);
  validation.dataset.label = "Validation";
  tr.append(validation);
  const historyText = (row.history || []).map(entry => {
    return [entry.at, entry.value, entry.note].filter(Boolean).join(" · ");
  }).filter(Boolean).join(" | ");
  const history = element("td", "history", historyText || "No history");
  history.dataset.label = "History";
  tr.append(history);
  const status = element("td");
  status.dataset.label = "Status";
  status.append(element("span", "pill", row.status));
  tr.append(status);
  const direct = element("td");
  direct.dataset.label = "Direct link";
  if (row.direct_url) {
    const parsed = new URL(row.direct_url);
    if (parsed.protocol === "https:") {
      const link = element("a", "direct", "Open retailer");
      link.href = parsed.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.referrerPolicy = "no-referrer";
      direct.append(link);
    }
  }
  tr.append(direct);
  return tr;
}

unlock().catch(locked);
