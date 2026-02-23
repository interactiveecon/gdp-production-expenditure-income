/* global generateScenario */

const els = {
  newScenarioBtn: document.getElementById("newScenarioBtn"),
  resetBtn: document.getElementById("resetBtn"),
  checkBtn: document.getElementById("checkBtn"),

  tabProduction: document.getElementById("tabProduction"),
  tabExpenditure: document.getElementById("tabExpenditure"),
  tabIncome: document.getElementById("tabIncome"),

  panelProduction: document.getElementById("panelProduction"),
  panelExpenditure: document.getElementById("panelExpenditure"),
  panelIncome: document.getElementById("panelIncome"),

  pool: document.getElementById("pool"),

  gdpProd: document.getElementById("gdpProd"),
  gdpExp: document.getElementById("gdpExp"),
  gdpInc: document.getElementById("gdpInc"),
  gapVal: document.getElementById("gapVal"),

  status: document.getElementById("status"),
  inventoryFeedback: document.getElementById("inventoryFeedback")
};

const BIN_IDS = {
  production: ["P_S_OUT","P_S_INT","P_A_OUT","P_A_INT","P_P_OUT","P_P_INT","P_M_OUT","P_M_INT"],
  expenditure: ["E_C","E_I","E_G","E_X","E_M","E_XCL"],
  income: ["I_W","I_P","I_XCL"]
};

let activeTab = "production";
let scenario = null;
let placements = { production:{}, expenditure:{}, income:{} };
let draggedId = null;

function setStatus(msg){ els.status.textContent = msg; }
function money(x){ return `$${x.toFixed(0)}m`; }

function shuffle(arr){
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function clearBins(){
  els.pool.innerHTML = "";
  for (const tab of Object.keys(BIN_IDS)) {
    for (const binId of BIN_IDS[tab]) {
      const z = document.querySelector(`[data-bin="${binId}"]`);
      if (z) z.innerHTML = "";
    }
  }
}

function makeCard(card){
  const div = document.createElement("div");
  div.className = "card";
  div.draggable = true;
  div.id = `card_${card.id}`;
  div.dataset.cardId = card.id;
  div.dataset.amount = String(card.amount);
  div.dataset.ledger = card.ledger;

  div.innerHTML = `
    <div class="top"><span class="money">${money(card.amount)}</span></div>
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

function setupDropzone(zone){
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragover");
    e.dataTransfer.dropEffect = "move";
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");

    const id = e.dataTransfer.getData("text/plain") || draggedId;
    if (!id) return;

    const cardEl = document.getElementById(`card_${id}`);
    if (!cardEl) return;

    if (cardEl.dataset.ledger !== activeTab) return;

    zone.appendChild(cardEl);
    placements[activeTab][id] = zone.dataset.bin;

    cardEl.classList.remove("good","bad");
    const fb = cardEl.querySelector(".feedback");
    if (fb) fb.textContent = "";

    updateTotals();
  });
}

function initDnD(){
  document.querySelectorAll(".dropzone").forEach(setupDropzone);
}

function setActiveTab(tab){
  activeTab = tab;

  [els.tabProduction, els.tabExpenditure, els.tabIncome].forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(btn => btn.setAttribute("aria-selected","false"));
  const btn = document.querySelector(`.tab[data-tab="${tab}"]`);
  btn.classList.add("active");
  btn.setAttribute("aria-selected","true");

  els.panelProduction.classList.toggle("hidden", tab !== "production");
  els.panelExpenditure.classList.toggle("hidden", tab !== "expenditure");
  els.panelIncome.classList.toggle("hidden", tab !== "income");

  renderTabPool();
  setStatus(`Active ledger: ${tab}.`);
}

function ledgerCards(){
  return activeTab === "production" ? scenario.productionCards
       : activeTab === "expenditure" ? scenario.expenditureCards
       : scenario.incomeCards;
}

function renderTabPool(){
  els.pool.innerHTML = "";

  // Ensure all cards exist in DOM
  const cards = ledgerCards();
  const order = shuffle(cards.map(c => c.id)); // SHUFFLED pool order each time

  for (const id of order) {
    const c = cards.find(x => x.id === id);
    const el = document.getElementById(`card_${c.id}`) || makeCard(c);
    els.pool.appendChild(el);
  }

  // Apply placements for active ledger
  for (const [cid, binId] of Object.entries(placements[activeTab])) {
    const el = document.getElementById(`card_${cid}`);
    const bin = document.querySelector(`[data-bin="${binId}"]`);
    if (el && bin) bin.appendChild(el);
  }
}

function resetAllPlacements(){
  placements = { production:{}, expenditure:{}, income:{} };
}

function sumBin(binId){
  const bin = document.querySelector(`[data-bin="${binId}"]`);
  if (!bin) return 0;
  let s = 0;
  bin.querySelectorAll(".card").forEach(c => { s += Number(c.dataset.amount); });
  return s;
}

function computeGDPProduction(){
  const steelVA = sumBin("P_S_OUT") - sumBin("P_S_INT");
  const autoVA  = sumBin("P_A_OUT") - sumBin("P_A_INT");
  const portVA  = sumBin("P_P_OUT") - sumBin("P_P_INT");
  const machVA  = sumBin("P_M_OUT") - sumBin("P_M_INT");
  return steelVA + autoVA + portVA + machVA;
}

function computeGDPExpenditure(){
  const C = sumBin("E_C");
  const I = sumBin("E_I");
  const G = sumBin("E_G");
  const X = sumBin("E_X");
  const M = sumBin("E_M");
  return C + I + G + (X - M);
}

function computeGDPIncome(){
  const W = sumBin("I_W");
  const P = sumBin("I_P");
  return W + P;
}

function updateTotals(){
  const gdpP = computeGDPProduction();
  const gdpE = computeGDPExpenditure();
  const gdpI = computeGDPIncome();

  els.gdpProd.textContent = money(gdpP);
  els.gdpExp.textContent  = money(gdpE);
  els.gdpInc.textContent  = money(gdpI);

  const gap = Math.max(Math.abs(gdpP-gdpE), Math.abs(gdpP-gdpI), Math.abs(gdpE-gdpI));
  els.gapVal.textContent = money(gap);
}

function clearFeedbackStyles(){
  document.querySelectorAll(".card").forEach(c => {
    c.classList.remove("good","bad");
    const fb = c.querySelector(".feedback");
    if (fb) fb.textContent = "";
  });
  els.inventoryFeedback.textContent = "";
}

function checkAnswers(){
  clearFeedbackStyles();

  const allCards = [...scenario.productionCards, ...scenario.expenditureCards, ...scenario.incomeCards];
  let correct = 0;
  let placed = 0;

  for (const c of allCards){
    const el = document.getElementById(`card_${c.id}`);
    if (!el) continue;

    const tab = c.ledger;
    const bin = placements[tab][c.id];
    if (!bin) continue;

    placed++;
    if (bin === c.correctBin){
      correct++;
      el.classList.add("good");
      el.querySelector(".feedback").textContent = "✓";
    } else {
      el.classList.add("bad");
      el.querySelector(".feedback").textContent = "✗";
    }
  }

  // Inventory check: any card flagged inventoryInvestment must be in E_I
  const invIds = scenario.meta.inventoryCardIds || [];
  if (invIds.length){
    const ok = invIds.every(id => placements.expenditure[id] === "E_I");
    els.inventoryFeedback.textContent = ok
      ? "Inventory check: ✓ Inventory investment is correctly placed inside Investment (I)."
      : "Inventory check: ✗ At least one inventory-change item is not in Investment (I).";
  }

  updateTotals();

  const gap = Math.max(
    Math.abs(computeGDPProduction() - computeGDPExpenditure()),
    Math.abs(computeGDPProduction() - computeGDPIncome()),
    Math.abs(computeGDPExpenditure() - computeGDPIncome())
  );

  if (placed === 0) setStatus("Place items in bins, then click Check.");
  else if (gap < 1e-6) setStatus(`Perfect. GDP totals reconcile exactly (gap = ${money(gap)}).`);
  else setStatus(`Checked: ${correct}/${placed} correct. Gap: ${money(gap)}.`);
}

function newScenario(){
  scenario = generateScenario();
  resetAllPlacements();
  clearBins();

  // Create all card DOM nodes once
  for (const c of [...scenario.productionCards, ...scenario.expenditureCards, ...scenario.incomeCards]) {
    if (!document.getElementById(`card_${c.id}`)) makeCard(c);
  }

  renderTabPool();
  clearFeedbackStyles();
  updateTotals();
  setStatus("New round loaded. Make all three GDP totals match.");
}

function resetRound(){
  resetAllPlacements();
  renderTabPool();
  clearFeedbackStyles();
  updateTotals();
  setStatus("Reset placements (this round).");
}

function init(){
  initDnD();

  els.tabProduction.addEventListener("click", () => setActiveTab("production"));
  els.tabExpenditure.addEventListener("click", () => setActiveTab("expenditure"));
  els.tabIncome.addEventListener("click", () => setActiveTab("income"));

  els.newScenarioBtn.addEventListener("click", newScenario);
  els.resetBtn.addEventListener("click", resetRound);
  els.checkBtn.addEventListener("click", checkAnswers);

  setActiveTab("production");
  newScenario();
}

init();
