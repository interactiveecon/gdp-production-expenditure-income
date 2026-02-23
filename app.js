/* global generateScenario */

const els = {
  // buttons
  newScenarioBtn: document.getElementById("newScenarioBtn"),
  resetBtn: document.getElementById("resetBtn"),
  checkBtn: document.getElementById("checkBtn"),

  // tabs
  tabProduction: document.getElementById("tabProduction"),
  tabExpenditure: document.getElementById("tabExpenditure"),
  tabIncome: document.getElementById("tabIncome"),

  // panels
  panelProduction: document.getElementById("panelProduction"),
  panelExpenditure: document.getElementById("panelExpenditure"),
  panelIncome: document.getElementById("panelIncome"),

  // pool
  pool: document.getElementById("pool"),

  // totals
  gdpProd: document.getElementById("gdpProd"),
  gdpExp: document.getElementById("gdpExp"),
  gdpInc: document.getElementById("gdpInc"),
  gapVal: document.getElementById("gapVal"),

  // status / feedback
  status: document.getElementById("status"),
  inventoryFeedback: document.getElementById("inventoryFeedback")
};

const BIN_IDS = {
  production: ["P_S_OUT","P_S_INT","P_A_OUT","P_A_INT","P_P_OUT","P_P_INT"],
  expenditure: ["E_C","E_I","E_G","E_X","E_M","E_XCL"],
  income: ["I_W","I_P","I_XCL"]
};

let activeTab = "production";
let scenario = null;

// placements stored per tab: {tab: {cardId: binId}}
let placements = {
  production: {},
  expenditure: {},
  income: {}
};

let draggedId = null;

function setStatus(msg) {
  els.status.textContent = msg;
}

function money(x) {
  return `$${x.toFixed(0)}m`;
}

function clearBins() {
  // pool + all bins
  els.pool.innerHTML = "";
  for (const tab of Object.keys(BIN_IDS)) {
    for (const binId of BIN_IDS[tab]) {
      const z = document.querySelector(`[data-bin="${binId}"]`);
      if (z) z.innerHTML = "";
    }
  }
}

function makeCard(card) {
  const div = document.createElement("div");
  div.className = "card";
  div.draggable = true;
  div.id = `card_${card.id}`;
  div.dataset.cardId = card.id;
  div.dataset.amount = String(card.amount);
  div.dataset.ledger = card.ledger;

  div.innerHTML = `
    <div class="top">
      <span class="money">${money(card.amount)}</span>
    </div>
    <div class="desc">${card.text}</div>
    <div class="feedback"></div>
  `;

  div.addEventListener("dragstart", (e) => {
    draggedId = card.id;
    e.dataTransfer.setData("text/plain", card.id);
    e.dataTransfer.effectAllowed = "move";
  });

  return div;
}

function setupDropzone(zone) {
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragover");
    e.dataTransfer.dropEffect = "move";
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("dragover");
  });

  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");

    const id = e.dataTransfer.getData("text/plain") || draggedId;
    if (!id) return;

    const cardEl = document.getElementById(`card_${id}`);
    if (!cardEl) return;

    // Only allow moving cards belonging to active tab’s ledger
    const ledger = cardEl.dataset.ledger;
    if (ledger !== activeTab) return;

    zone.appendChild(cardEl);

    const bin = zone.dataset.bin;
    placements[activeTab][id] = bin;

    // clear feedback styling on move
    cardEl.classList.remove("good","bad");
    const fb = cardEl.querySelector(".feedback");
    if (fb) fb.textContent = "";

    updateTotals();
  });
}

function initDnD() {
  setupDropzone(els.pool);
  document.querySelectorAll(".dropzone").forEach(setupDropzone);
}

function setActiveTab(tab) {
  activeTab = tab;

  // tab buttons
  [els.tabProduction, els.tabExpenditure, els.tabIncome].forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(btn => btn.setAttribute("aria-selected","false"));
  const btn = document.querySelector(`.tab[data-tab="${tab}"]`);
  btn.classList.add("active");
  btn.setAttribute("aria-selected","true");

  // panels
  els.panelProduction.classList.toggle("hidden", tab !== "production");
  els.panelExpenditure.classList.toggle("hidden", tab !== "expenditure");
  els.panelIncome.classList.toggle("hidden", tab !== "income");

  renderTabPool();
  setStatus(`Active ledger: ${tab}. Drag items into the bins for this ledger.`);
}

function renderTabPool() {
  // Move all cards for this tab back to pool, then re-place according to placements
  els.pool.innerHTML = "";

  // Gather the cards for this ledger
  const cards =
    activeTab === "production" ? scenario.productionCards :
    activeTab === "expenditure" ? scenario.expenditureCards :
    scenario.incomeCards;

  // First put all in pool
  for (const c of cards) {
    const el = document.getElementById(`card_${c.id}`) || makeCard(c);
    els.pool.appendChild(el);
  }

  // Then move any placed cards into their bins
  for (const [cid, binId] of Object.entries(placements[activeTab])) {
    const el = document.getElementById(`card_${cid}`);
    const bin = document.querySelector(`[data-bin="${binId}"]`);
    if (el && bin) bin.appendChild(el);
  }
}

function resetAllPlacements() {
  placements = { production:{}, expenditure:{}, income:{} };
}

function computeGDPProduction() {
  // GDP = sum over firms (Output - Intermediate)
  // We compute based on student placements within production bins.
  const sumBin = (binId) => {
    const bin = document.querySelector(`[data-bin="${binId}"]`);
    if (!bin) return 0;
    let s = 0;
    bin.querySelectorAll(".card").forEach(c => { s += Number(c.dataset.amount); });
    return s;
  };

  const steelVA = sumBin("P_S_OUT") - sumBin("P_S_INT");
  const autoVA  = sumBin("P_A_OUT") - sumBin("P_A_INT");
  const portVA  = sumBin("P_P_OUT") - sumBin("P_P_INT");

  return steelVA + autoVA + portVA;
}

function computeGDPExpenditure() {
  const sumBin = (binId) => {
    const bin = document.querySelector(`[data-bin="${binId}"]`);
    if (!bin) return 0;
    let s = 0;
    bin.querySelectorAll(".card").forEach(c => { s += Number(c.dataset.amount); });
    return s;
  };

  const C = sumBin("E_C");
  const I = sumBin("E_I");
  const G = sumBin("E_G");
  const X = sumBin("E_X");
  const M = sumBin("E_M");

  return C + I + G + (X - M);
}

function computeGDPIncome() {
  const sumBin = (binId) => {
    const bin = document.querySelector(`[data-bin="${binId}"]`);
    if (!bin) return 0;
    let s = 0;
    bin.querySelectorAll(".card").forEach(c => { s += Number(c.dataset.amount); });
    return s;
  };

  const W = sumBin("I_W");
  const P = sumBin("I_P");
  return W + P;
}

function updateTotals() {
  // We compute totals from current DOM bins (all tabs), regardless of activeTab.
  const gdpP = computeGDPProduction();
  const gdpE = computeGDPExpenditure();
  const gdpI = computeGDPIncome();

  els.gdpProd.textContent = isFinite(gdpP) ? money(gdpP) : "—";
  els.gdpExp.textContent  = isFinite(gdpE) ? money(gdpE) : "—";
  els.gdpInc.textContent  = isFinite(gdpI) ? money(gdpI) : "—";

  const gap = Math.max(Math.abs(gdpP - gdpE), Math.abs(gdpP - gdpI), Math.abs(gdpE - gdpI));
  els.gapVal.textContent = isFinite(gap) ? money(gap) : "—";
}

function clearFeedbackStyles() {
  document.querySelectorAll(".card").forEach(c => {
    c.classList.remove("good","bad");
    const fb = c.querySelector(".feedback");
    if (fb) fb.textContent = "";
  });
  els.inventoryFeedback.textContent = "";
}

function checkAnswers() {
  clearFeedbackStyles();

  // For each ledger, check each card placement against correctBin.
  const allCards = [
    ...scenario.productionCards,
    ...scenario.expenditureCards,
    ...scenario.incomeCards
  ];

  let correct = 0;
  let totalPlaced = 0;

  for (const c of allCards) {
    const el = document.getElementById(`card_${c.id}`);
    if (!el) continue;

    const tab = c.ledger;
    const placedBin = placements[tab][c.id];

    if (!placedBin) continue; // not placed
    totalPlaced++;

    if (placedBin === c.correctBin) {
      correct++;
      el.classList.add("good");
      el.querySelector(".feedback").textContent = "✓";
    } else {
      el.classList.add("bad");
      el.querySelector(".feedback").textContent = `✗`;
    }
  }

  // Inventory-specific feedback: make sure inventory item is in Investment (E_I)
  const invCard = scenario.expenditureCards.find(x => x.text.toLowerCase().includes("inventor"));
  if (invCard) {
    const placed = placements.expenditure[invCard.id];
    if (placed === "E_I") {
      els.inventoryFeedback.textContent =
        "Inventory check: ✓ Inventory investment was correctly classified inside Investment (I).";
    } else if (placed) {
      els.inventoryFeedback.textContent =
        "Inventory check: ✗ Inventory investment should be placed in Investment (I), not in another category.";
    } else {
      els.inventoryFeedback.textContent =
        "Inventory check: Place the inventory change item. It belongs in Investment (I).";
    }
  }

  updateTotals();

  // Win condition hint
  const gdpP = computeGDPProduction();
  const gdpE = computeGDPExpenditure();
  const gdpI = computeGDPIncome();
  const gap = Math.max(Math.abs(gdpP - gdpE), Math.abs(gdpP - gdpI), Math.abs(gdpE - gdpI));

  if (totalPlaced === 0) {
    setStatus("Place items in the bins, then click Check.");
  } else if (gap < 0.5) {
    setStatus(`Nice. Your three GDP totals reconcile (gap ≈ ${money(gap)}).`);
  } else {
    setStatus(`Checked: ${correct}/${totalPlaced} items correctly placed. Reconciliation gap: ${money(gap)}.`);
  }
}

function newScenario() {
  scenario = generateScenario();
  resetAllPlacements();
  clearBins();

  // Create all card elements once; they will move between pool/bins as we switch tabs.
  const allCards = [
    ...scenario.productionCards,
    ...scenario.expenditureCards,
    ...scenario.incomeCards
  ];
  for (const c of allCards) {
    if (!document.getElementById(`card_${c.id}`)) {
      // create but don't attach yet
      makeCard(c);
    }
  }

  // Render the pool for the active tab
  renderTabPool();
  clearFeedbackStyles();
  updateTotals();

  setStatus("New round loaded. Start with any tab—then make all three GDP totals match.");
}

function resetRound() {
  resetAllPlacements();
  // move cards of active tab back to pool
  renderTabPool();
  clearFeedbackStyles();
  updateTotals();
  setStatus("Reset placements (current round).");
}

function init() {
  initDnD();

  els.tabProduction.addEventListener("click", () => setActiveTab("production"));
  els.tabExpenditure.addEventListener("click", () => setActiveTab("expenditure"));
  els.tabIncome.addEventListener("click", () => setActiveTab("income"));

  els.newScenarioBtn.addEventListener("click", newScenario);
  els.resetBtn.addEventListener("click", resetRound);
  els.checkBtn.addEventListener("click", checkAnswers);

  // start
  setActiveTab("production");
  newScenario();
}

init();
