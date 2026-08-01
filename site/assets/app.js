"use strict";

const app = document.getElementById("app");
const KEY_PREFIX = "encrypted-dashboard-key:";

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function locked() {
  document.title = "Private Dashboard";
  const section = element("section", "locked");
  const mark = element("div", "lock-mark", "\u25cf");
  mark.setAttribute("aria-hidden", "true");
  section.append(
    mark,
    element("p", "eyebrow", "PRIVATE DASHBOARD"),
    element("h1", null, "Locked"),
    element("p", null, "Open the complete link from your authorized email to view this dashboard.")
  );
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

function sessionKeyName() {
  return `${KEY_PREFIX}${location.pathname}`;
}

function keyFromPage() {
  const fromLink = new URLSearchParams(location.hash.slice(1)).get("k");
  if (fromLink) return {keyText: fromLink, fromLink: true};
  return {keyText: sessionStorage.getItem(sessionKeyName()), fromLink: false};
}

async function unlock() {
  const keySource = keyFromPage();
  const keyBytes = decodeBase64Url(keySource.keyText);
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

  if (keySource.fromLink) {
    sessionStorage.setItem(sessionKeyName(), keySource.keyText);
    history.replaceState(null, "", location.pathname + location.search);
  }
  render(payload);
}

function money(value) {
  return typeof value === "number"
    ? new Intl.NumberFormat("en-US", {style: "currency", currency: "USD", maximumFractionDigits: 2}).format(value)
    : "Not shown";
}

function readableDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return value || "Not recorded";
  return date.toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZoneName: "short"
  });
}

function friendlyText(value) {
  return String(value || "").replace(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g,
    timestamp => readableDate(timestamp)
  );
}

function statusClass(value) {
  const text = String(value || "").toLowerCase();
  if (/blocked|stale|unavailable|stop/.test(text)) return "danger";
  if (/caution|due|watch|check/.test(text)) return "warning";
  if (/top|best|ready|available|fresh|confirmed|recommend/.test(text)) return "good";
  return "info";
}

function directLink(row, label = "Open retailer") {
  if (!row.direct_url) return null;
  const parsed = new URL(row.direct_url);
  if (parsed.protocol !== "https:") return null;
  const link = element("a", "direct", label);
  link.href = parsed.href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.referrerPolicy = "no-referrer";
  return link;
}

function badge(text, kind = "info") {
  return element("span", `badge ${kind}`, text);
}

function detailValue(row, name) {
  return Object.prototype.hasOwnProperty.call(row.details || {}, name) ? row.details[name] : null;
}

function recommendationRows(rows) {
  const marked = rows.filter(row => /top|best|ready|recommend/i.test(row.status || ""));
  if (marked.length) return marked.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)).slice(0, 3);
  return rows
    .filter(row => typeof row.price === "number" && !/blocked|stale|unavailable/i.test(row.status || ""))
    .sort((a, b) => a.price - b.price)
    .slice(0, 3);
}

function renderPick(row) {
  const card = element("article", "pick-card");
  const retailer = detailValue(row, "Retailer") || row.status;
  card.append(element("p", "eyebrow", retailer));
  const title = element("h3", null, row.name);
  card.append(title, element("p", "pick-price", money(row.price)));
  const badges = element("div", "badge-row");
  badges.append(badge(row.status, statusClass(row.status)));
  const taps = detailValue(row, "Tap count");
  const complete = detailValue(row, "Complete kit");
  const outdoor = detailValue(row, "Outdoor rated");
  if (taps) badges.append(badge(`${taps} ${String(taps) === "1" ? "tap" : "taps"}`));
  if (complete) badges.append(badge(complete === "Yes" ? "Complete kit" : "Conversion/base", complete === "Yes" ? "good" : "warning"));
  if (outdoor) badges.append(badge(outdoor === "Yes" ? "Outdoor-rated" : "Indoor"));
  card.append(badges);
  const description = detailValue(row, "Description");
  if (description) card.append(element("p", "card-copy", description));
  const link = directLink(row, "View deal");
  if (link) card.append(link);
  return card;
}

function historyList(row) {
  const list = element("ul", "history-list");
  const entries = (row.history || []).slice(-6).reverse();
  for (const entry of entries) {
    const line = [readableDate(entry.at), entry.value, entry.note].filter(Boolean).join(" · ");
    list.append(element("li", null, line));
  }
  if (!entries.length) list.append(element("li", null, "No price history recorded."));
  return list;
}

function evidenceDetails(row) {
  const disclosure = element("details", "evidence-details");
  disclosure.append(element("summary", null, "Evidence, specifications and history"));
  const content = element("div", "evidence-content");
  const evidence = element("div", "evidence-block");
  evidence.append(element("h4", null, "Validation"));
  const evidenceList = element("dl", "detail-list");
  for (const [label, value] of [
    ["Evidence", row.freshness], ["Confidence", row.confidence], ["Validation", row.validation]
  ]) {
    evidenceList.append(element("dt", null, label), element("dd", null, value));
  }
  evidence.append(evidenceList);

  const specs = element("div", "evidence-block");
  specs.append(element("h4", null, "Specifications"));
  const specList = element("dl", "detail-list");
  for (const [label, value] of Object.entries(row.details || {})) {
    specList.append(element("dt", null, label), element("dd", null, value));
  }
  specs.append(specList);

  const history = element("div", "evidence-block");
  history.append(element("h4", null, "Recent history"), historyList(row));
  content.append(evidence, specs, history);
  disclosure.append(content);
  return disclosure;
}

function renderResult(row) {
  const card = element("article", "result-card");
  const top = element("div", "result-topline");
  top.append(
    element("p", "eyebrow", detailValue(row, "Retailer") || row.availability),
    badge(row.status, statusClass(row.status))
  );
  const heading = element("h3", null, row.name);
  const model = row.model && row.model !== row.name ? element("p", "model", row.model) : null;
  const priceLine = element("div", "price-line");
  priceLine.append(element("strong", "result-price", money(row.price)));
  if (typeof row.change === "number" && row.change !== 0) {
    const direction = row.change < 0 ? "drop" : "rise";
    priceLine.append(element("span", `change ${direction}`, `${row.change < 0 ? "Down" : "Up"} ${money(Math.abs(row.change))}`));
  }
  const badgeRow = element("div", "badge-row");
  badgeRow.append(
    badge(row.availability, statusClass(row.availability)),
    badge(row.confidence, statusClass(row.confidence))
  );
  const garage = detailValue(row, "Garage suitability");
  if (garage) badgeRow.append(badge(garage, statusClass(garage)));
  card.append(top, heading);
  if (model) card.append(model);
  card.append(priceLine, badgeRow);
  const description = detailValue(row, "Description");
  if (description) card.append(element("p", "card-copy", description));
  const actions = element("div", "card-actions");
  const link = directLink(row);
  if (link) actions.append(link);
  card.append(actions, evidenceDetails(row));
  return card;
}

function render(payload) {
  document.title = payload.title;
  const root = element("section", "dashboard");

  const hero = element("header", "hero");
  const heroCopy = element("div", "hero-copy");
  heroCopy.append(
    badge(payload.overall_status, statusClass(payload.overall_status)),
    element("p", "eyebrow", "PRIVATE DECISION DASHBOARD"),
    element("h1", null, payload.title),
    element("p", "lead", payload.summary.decision)
  );
  const recommendation = element("details", "recommendation-panel");
  recommendation.open = !matchMedia("(max-width: 900px)").matches;
  recommendation.append(element("summary", null, "Current recommendation"));
  const recommendationParts = payload.summary.recommendation.split(";").map(value => value.trim()).filter(Boolean);
  if (recommendationParts.length > 1) {
    const list = element("ul", "recommendation-list");
    for (const part of recommendationParts) list.append(element("li", null, part));
    recommendation.append(list);
  } else {
    recommendation.append(element("p", "recommendation", payload.summary.recommendation));
  }
  hero.append(heroCopy, recommendation);

  const prices = payload.rows.map(row => row.price).filter(value => typeof value === "number");
  const metrics = element("section", "metrics");
  const metricValues = [
    ["Lowest current price", prices.length ? money(Math.min(...prices)) : "Not shown"],
    ["Current price range", prices.length ? `${money(Math.min(...prices))} – ${money(Math.max(...prices))}` : "Not shown"],
    ["Offers compared", payload.rows.length],
    ["Snapshot generated", readableDate(payload.generated_at)]
  ];
  for (const [label, value] of metricValues) {
    const metric = element("div", "metric");
    metric.append(element("span", null, label), element("strong", null, value));
    metrics.append(metric);
  }

  const freshness = element("section", `freshness ${statusClass(payload.overall_status)}`);
  freshness.append(
    badge(payload.overall_status, statusClass(payload.overall_status)),
    element("div", null, null)
  );
  freshness.lastChild.append(
    element("p", "eyebrow", "SOURCE FRESHNESS"),
    element("strong", null, friendlyText(payload.source_freshness))
  );

  const picksSection = element("section", "content-section");
  picksSection.append(
    element("p", "eyebrow", "BEST CURRENT OPTIONS"),
    element("h2", null, "Start with these")
  );
  const picks = element("div", "pick-grid");
  for (const row of recommendationRows(payload.rows)) picks.append(renderPick(row));
  picksSection.append(picks);

  const resultsSection = element("section", "content-section results-section");
  const resultsHeading = element("div", "section-heading");
  const headingCopy = element("div");
  headingCopy.append(element("p", "eyebrow", "ALL VERIFIED RESULTS"), element("h2", null, "Compare every offer"));
  const matchCount = element("p", "match-count", `${payload.rows.length} shown`);
  resultsHeading.append(headingCopy, matchCount);

  const controls = element("div", "controls");
  const search = element("input");
  search.type = "search";
  search.placeholder = "Search models, retailers or specifications";
  search.setAttribute("aria-label", "Search results");
  const status = element("select");
  status.setAttribute("aria-label", "Filter by status");
  status.append(new Option("All statuses", ""));
  for (const value of [...new Set(payload.rows.map(row => row.status))].sort()) status.append(new Option(value, value));
  const sort = element("select");
  sort.setAttribute("aria-label", "Sort results");
  sort.append(new Option("Recommended order", "source"), new Option("Lowest price", "price"), new Option("Largest price drop", "drop"));
  controls.append(search, status, sort);

  const results = element("div", "result-grid");
  function draw() {
    const needle = search.value.trim().toLowerCase();
    const wantedStatus = status.value;
    let rows = payload.rows.filter(row => {
      const history = (row.history || []).flatMap(entry => [entry.at, entry.value, entry.note]);
      const haystack = [row.name, row.model, row.availability, row.freshness, row.confidence, row.validation, row.status, ...history, ...Object.values(row.details || {})].join(" ").toLowerCase();
      return (!needle || haystack.includes(needle)) && (!wantedStatus || row.status === wantedStatus);
    });
    if (sort.value === "price") rows = [...rows].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (sort.value === "drop") rows = [...rows].sort((a, b) => (a.change ?? Infinity) - (b.change ?? Infinity));
    results.replaceChildren();
    for (const row of rows) results.append(renderResult(row));
    if (!rows.length) results.append(element("p", "empty", "No offers match those filters."));
    matchCount.textContent = `${rows.length} shown`;
  }
  search.addEventListener("input", draw);
  status.addEventListener("change", draw);
  sort.addEventListener("change", draw);
  resultsSection.append(resultsHeading, controls, results);

  const technical = element("details", "technical");
  technical.append(element("summary", null, "About this private snapshot"));
  const technicalList = element("dl", "detail-list technical-list");
  for (const [label, value] of [
    ["Dashboard", payload.title], ["Generated", readableDate(payload.generated_at)],
    ["Snapshot ID", payload.snapshot_id], ["Verified changes", payload.summary.verified_changes],
    ["Blocked", payload.summary.blocked], ["Stale", payload.summary.stale], ["Overdue", payload.summary.overdue]
  ]) technicalList.append(element("dt", null, label), element("dd", null, value));
  technical.append(technicalList);

  const footer = element("footer", "footer", "Confirm final price, stock, seller identity, delivery timing and product fit before buying.");
  root.append(hero, metrics, freshness, picksSection, resultsSection, technical, footer);
  app.replaceChildren(root);
  draw();
}

unlock().catch(() => {
  sessionStorage.removeItem(sessionKeyName());
  locked();
});
