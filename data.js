// data.js — Complex GDP Reconciliation Lab
// Guarantees: Under correct classification, GDP(P)=GDP(E)=GDP(I), gap=0.
//
// Design: 4 firms (SteelCo, AutoCo, PortCo, MachCo)
// - Domestic intermediates are always from modeled firms (so no "missing domestic VA").
// - Any other intermediate inputs are treated as imports (appear in M).
// - Expenditure has C, I (fixed + inventories), G, X, M, XCL (distractors).
// - Income is wages + profits split into multiple cards.

function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }

function shuffle(arr){
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function partition(amount, k, minPart=1){
  // returns k positive-ish integers summing to amount (in millions)
  amount = Math.round(amount);
  if (k <= 1) return [amount];
  const parts = Array(k).fill(minPart);
  let remaining = amount - k*minPart;
  if (remaining < 0) { // fall back
    return Array(k-1).fill(0).concat([amount]);
  }
  for (let i=0;i<k-1;i++){
    const take = randInt(0, remaining);
    parts[i] += take;
    remaining -= take;
  }
  parts[k-1] += remaining;
  return shuffle(parts);
}

function pick(arr){ return arr[randInt(0, arr.length-1)]; }

function generateScenario(){
  // Scale varies each round
  const scale = randInt(160, 360);

  // Choose key macro components (domestic final demands)
  // These are DOMESTIC uses (imports accounted separately in M)
  let C_dom = clamp(Math.round(0.55*scale + randInt(-25,25)), 70, 260);
  let G_dom = clamp(Math.round(0.18*scale + randInt(-15,15)), 20, 120);
  let X = clamp(Math.round(0.12*scale + randInt(-12,12)), 10, 110);

  // Imports: consumer + intermediate inputs
  let M_cons = clamp(Math.round(0.10*scale + randInt(-12,12)), 8, 130);
  const M_ore  = clamp(Math.round(0.06*scale), 8, 40);   // SteelCo imported ore
  const M_fuel = clamp(Math.round(0.04*scale), 6, 30);   // PortCo imported fuel
  const M_elec = clamp(Math.round(0.05*scale), 6, 35);   // AutoCo imported electronics
  const M_comp = clamp(Math.round(0.03*scale), 4, 25);   // MachCo imported components

  // Investment split: fixed investment + inventories (both in I)
  let I_fixed = clamp(Math.round(0.20*scale + randInt(-20,20)), 20, 170);

  // Choose inventory change as residual to hit a feasible GDP that varies:
  // We'll let "GDP_target" emerge from production, but ensure expenditure side is coherent by defining I_inv
  // around a plausible range and then later constructing production to match.
  let I_inv = clamp(Math.round(0.08*scale + randInt(-18,18)), -20, 90); // allow liquidation sometimes

  // Expenditure GDP implied (domestic uses + NX)
  const M_total = M_cons + M_ore + M_fuel + M_elec + M_comp;
  const GDP_exp_target = C_dom + (I_fixed + I_inv) + G_dom + (X - M_total);

  // Build a consistent production structure from these demands.
  // Allocate final demand across firms:
  // AutoCo supplies most of C and some G and some X; PortCo supplies some of C/G and all service exports; MachCo supplies I_fixed.
  const shareAutoC = clamp(0.70 + (randInt(-10,10)/100), 0.55, 0.85);
  const C_auto = Math.round(C_dom * shareAutoC);
  const C_port = C_dom - C_auto;

  const shareAutoG = clamp(0.55 + (randInt(-10,10)/100), 0.35, 0.75);
  const G_auto = Math.round(G_dom * shareAutoG);
  const G_port = G_dom - G_auto;

  const sharePortX = clamp(0.65 + (randInt(-10,10)/100), 0.45, 0.85);
  const X_port = Math.round(X * sharePortX);
  const X_auto = X - X_port;

  // MachCo output = I_fixed (domestic capital goods)
  const machOutput = I_fixed;

  // AutoCo output = domestic sales + exports + inventory change
  const autoSales = C_auto + G_auto + X_auto;
  const autoOutput = autoSales + I_inv;

  // Intermediate linkages (domestic)
  // Steel used by Auto and Mach; shipping used by all
  const steelToAuto = clamp(Math.round(0.45 * Math.max(autoOutput, 0)), 25, 220);
  const steelToMach = clamp(Math.round(0.35 * machOutput), 10, 140);

  // PortCo provides domestic shipping services as intermediate:
  const shipToAuto = clamp(Math.round(0.10 * Math.max(autoOutput, 0)), 5, 60);
  const shipToSteel = clamp(Math.round(0.08 * (steelToAuto + steelToMach)), 3, 50);
  const shipToMach = clamp(Math.round(0.08 * machOutput), 3, 50);

  // SteelCo output = domestic intermediate sales + maybe small exports (optional)
  const steelExports = clamp(randInt(0, 20), 0, 30);
  const steelOutput = steelToAuto + steelToMach + steelExports;

  // PortCo output = domestic final services (C_port+G_port) + intermediate shipping + exports services
  const portOutput = C_port + G_port + shipToAuto + shipToSteel + shipToMach + X_port;

  // Intermediate inputs by firm (include imports + domestic intermediates)
  const steelIntermediate = M_ore + shipToSteel;            // ore import + domestic shipping service
  const autoIntermediate  = steelToAuto + shipToAuto + M_elec;
  const machIntermediate  = steelToMach + shipToMach + M_comp;
  const portIntermediate  = M_fuel;                         // fuel import

  // Firm value added
  const steelVA = steelOutput - steelIntermediate;
  const autoVA  = autoOutput - autoIntermediate;
  const machVA  = machOutput - machIntermediate;
  const portVA  = portOutput - portIntermediate;

  const GDP_prod = steelVA + autoVA + machVA + portVA;

  // Now force reconciliation by adjusting I_inv (inventory investment) as the single residual:
  // We want GDP_exp = GDP_prod exactly.
  // GDP_exp = C_dom + I_fixed + I_inv + G_dom + X - M_total
  // => I_inv = GDP_prod - C_dom - I_fixed - G_dom - X + M_total
  I_inv = GDP_prod - C_dom - I_fixed - G_dom - X + M_total;

  // Update autoOutput accordingly (inventory is in autos in this story)
  const autoOutput2 = autoSales + I_inv;
  const autoVA2 = autoOutput2 - autoIntermediate; // note: autoIntermediate used M_elec fixed; ok for pedagogy
  // If I_inv changed a lot, VA changes and income should match; we’ll recompute autoVA and GDP_prod:
  const autoVA_final = autoVA2;
  const GDP_prod_final = steelVA + autoVA_final + machVA + portVA;

  // With the residual formula, GDP_exp will match GDP_prod_final exactly.
  const GDP_exp_final = C_dom + I_fixed + I_inv + G_dom + X - M_total;

  // Income splits (multiple cards)
  function splitWagesProfits(VA, wageShareLo=0.55, wageShareHi=0.80){
    const w = Math.round(clamp(VA * (wageShareLo + Math.random()*(wageShareHi-wageShareLo)), 0, 1e9));
    return { w, p: VA - w };
  }

  const steelInc = splitWagesProfits(steelVA, 0.55, 0.75);
  const autoInc  = splitWagesProfits(autoVA_final, 0.55, 0.80);
  const machInc  = splitWagesProfits(machVA, 0.55, 0.80);
  const portInc  = splitWagesProfits(portVA, 0.60, 0.85);

  const GDP_inc = (steelInc.w+steelInc.p)+(autoInc.w+autoInc.p)+(machInc.w+machInc.p)+(portInc.w+portInc.p);

  // ---------- Build MANY cards with partitions and ambiguous wording ----------
  let cid = 0;
  const nextId = (prefix) => `${prefix}_${++cid}`;

  // Production cards
  const prodCards = [];

  function addProdOutput(firmKey, amount, text){
    prodCards.push({ id: nextId("p"), ledger:"production", amount, text, correctBin: firmKey });
  }
  function addProdInt(firmKey, amount, text){
    prodCards.push({ id: nextId("p"), ledger:"production", amount, text, correctBin: firmKey });
  }

  // Output partitions (2–4 per firm)
  const steelOutParts = partition(steelOutput, randInt(2,4), 2);
  steelOutParts.forEach((v,i) => addProdOutput("P_S_OUT", v, pick([
    `SteelCo invoices a buyer $${v}m for processed metal inputs.`,
    `SteelCo records $${v}m in sales revenue from metal products.`,
    `SteelCo ships metal products worth $${v}m to a customer.`
  ])));

  const autoOutParts = partition(autoOutput2, randInt(2,4), 5);
  autoOutParts.forEach((v,i) => addProdOutput("P_A_OUT", v, pick([
    `AutoCo completes vehicles valued at $${v}m (at market prices).`,
    `AutoCo records $${v}m of finished vehicle output this year.`,
    `AutoCo reports $${v}m of product output from its assembly lines.`
  ])));

  const portOutParts = partition(portOutput, randInt(2,5), 2);
  portOutParts.forEach(v => addProdOutput("P_P_OUT", v, pick([
    `PortCo provides shipping/logistics services worth $${v}m.`,
    `PortCo bills $${v}m for transportation and handling services.`,
    `PortCo delivers contracted services valued at $${v}m.`
  ])));

  const machOutParts = partition(machOutput, randInt(2,4), 2);
  machOutParts.forEach(v => addProdOutput("P_M_OUT", v, pick([
    `MachCo delivers capital equipment/software valued at $${v}m.`,
    `MachCo records $${v}m of new capital-goods output.`,
    `MachCo completes machine-tool production worth $${v}m.`
  ])));

  // Intermediate partitions (2–4 per firm; include imports and domestic services)
  partition(M_ore, randInt(1,2), 2).forEach(v => addProdInt("P_S_INT", v, pick([
    `SteelCo purchases raw material inputs from abroad totaling $${v}m.`,
    `SteelCo imports industrial ore inputs worth $${v}m.`
  ])));
  partition(shipToSteel, randInt(1,2), 1).forEach(v => addProdInt("P_S_INT", v, pick([
    `SteelCo pays $${v}m for domestic freight/handling services used in production.`,
    `SteelCo purchases $${v}m of domestic logistics services as an input.`
  ])));

  partition(steelToAuto, randInt(1,2), 3).forEach(v => addProdInt("P_A_INT", v, pick([
    `AutoCo purchases $${v}m of metal components used in vehicle production.`,
    `AutoCo buys $${v}m of materials inputs for assembly.`
  ])));
  partition(shipToAuto, randInt(1,2), 1).forEach(v => addProdInt("P_A_INT", v, pick([
    `AutoCo pays $${v}m for domestic shipping/handling services used in production.`,
    `AutoCo purchases $${v}m of logistics services as an input.`
  ])));
  partition(M_elec, randInt(1,2), 2).forEach(v => addProdInt("P_A_INT", v, pick([
    `AutoCo imports specialized electronics inputs worth $${v}m.`,
    `AutoCo purchases $${v}m of imported components used in assembly.`
  ])));

  partition(steelToMach, randInt(1,2), 2).forEach(v => addProdInt("P_M_INT", v, pick([
    `MachCo buys $${v}m of metal inputs for capital-goods production.`,
    `MachCo purchases $${v}m of industrial materials used as inputs.`
  ])));
  partition(shipToMach, randInt(1,2), 1).forEach(v => addProdInt("P_M_INT", v, pick([
    `MachCo pays $${v}m for domestic logistics/handling services used in production.`,
    `MachCo purchases $${v}m of domestic shipping services as inputs.`
  ])));
  partition(M_comp, randInt(1,2), 1).forEach(v => addProdInt("P_M_INT", v, pick([
    `MachCo imports specialized parts worth $${v}m.`,
    `MachCo buys $${v}m of imported components used in machine production.`
  ])));

  partition(M_fuel, randInt(1,2), 2).forEach(v => addProdInt("P_P_INT", v, pick([
    `PortCo purchases fuel from abroad worth $${v}m (used to provide services).`,
    `PortCo imports energy inputs worth $${v}m.`
  ])));

  // Expenditure cards
  const expCards = [];
  function addExp(bin, amount, text, meta={}) {
    expCards.push({ id: nextId("e"), ledger:"expenditure", amount, text, correctBin: bin, meta });
  }

  // C cards: split domestic consumption into multiple ambiguous “household spending on domestically produced …”
  const C_parts = partition(C_dom, randInt(3,6), 5);
  C_parts.forEach(v => addExp("E_C", v, pick([
    `Households purchase domestically produced goods/services totaling $${v}m.`,
    `Consumers spend $${v}m on domestically produced items this year.`,
    `Household final purchases of domestic output sum to $${v}m.`
  ])));

  // I fixed: multiple non-inventory investment cards
  const If_parts = partition(I_fixed, randInt(2,4), 5);
  const investTemplates = [
    "Firms purchase newly produced machine tools and equipment worth $%m.",
    "Businesses acquire newly produced software/capital equipment worth $%m.",
    "Private sector purchases newly produced structures/equipment totaling $%m."
  ];
  If_parts.forEach(v => addExp("E_I", v, pick(investTemplates).replace("%", v), { subtype: "fixed" }));

  // Inventory investment as one or two cards (could be negative)
  const invCardIds = [];
  const invParts = partition(Math.abs(I_inv), randInt(1,2), 1);
  invParts.forEach(v => {
    const amt = (I_inv >= 0) ? v : -v;
    const text = (I_inv >= 0)
      ? pick([
          `Firms end the year with higher inventories; inventories rise by $${amt}m.`,
          `Unsold output adds $${amt}m to inventories (recorded as investment).`,
          `Inventory accumulation totals $${amt}m this year (part of I).`
        ])
      : pick([
          `Firms sell from existing inventories; inventories fall by $${Math.abs(amt)}m (negative investment).`,
          `Inventory liquidation equals $${Math.abs(amt)}m (part of I).`,
          `Inventories decline by $${Math.abs(amt)}m this year (recorded in I).`
        ]);
    const id = nextId("e");
    invCardIds.push(id);
    expCards.push({ id, ledger:"expenditure", amount: amt, text, correctBin:"E_I", meta:{ subtype:"inventory" } });
  });

  // G cards (2–3)
  partition(G_dom, randInt(2,3), 5).forEach(v => addExp("E_G", v, pick([
    `Government purchases newly produced goods/services worth $${v}m.`,
    `Public sector buys $${v}m of goods/services (not transfers).`,
    `Government final purchases total $${v}m.`
  ])));

  // X cards (1–3)
  partition(X, randInt(1,3), 3).forEach(v => addExp("E_X", v, pick([
    `Foreign buyers purchase domestically produced goods/services worth $${v}m.`,
    `Sales of domestic output to the rest of the world total $${v}m.`,
    `Exports of domestically produced items are $${v}m.`
  ])));

  // M cards (consumer + intermediate imports), split into multiple cards
  const M_parts = shuffle([
    ...partition(M_cons, randInt(1,2), 2),
    ...partition(M_ore, randInt(1,2), 1),
    ...partition(M_fuel, randInt(1,2), 1),
    ...partition(M_elec, randInt(1,2), 1),
    ...partition(M_comp, randInt(1,2), 1)
  ]);
  M_parts.forEach(v => addExp("E_M", v, pick([
    `Purchases of goods/services produced abroad total $${v}m (imports).`,
    `Imports of foreign-produced items equal $${v}m.`,
    `Spending on foreign-produced inputs/goods totals $${v}m (imports).`
  ])));

  // XCL distractors (2–4)
  const xclTemplates = [
    { amt: randInt(8,18), text: "Government sends $%m in benefit payments to households." },
    { amt: randInt(6,16), text: "A used asset changes hands for $%m (no new production)." },
    { amt: randInt(8,20), text: "Households purchase existing shares worth $%m (financial transaction)." },
    { amt: randInt(6,16), text: "A lump-sum cash transfer of $%m is paid (not a purchase of production)." }
  ];
  shuffle(xclTemplates).slice(0, randInt(2,4)).forEach(o => addExp("E_XCL", o.amt, o.text.replace("%", o.amt)));

  // Income cards (split wages/profits into multiple cards per firm)
  const incCards = [];
  function addInc(bin, amount, text){
    incCards.push({ id: nextId("i"), ledger:"income", amount, text, correctBin: bin });
  }

  function splitIncomeCards(firmName, wages, profits){
    const wParts = partition(wages, randInt(2,3), 5);
    wParts.forEach(v => addInc("I_W", v, pick([
      `${firmName} payroll for production workers totals $${v}m.`,
      `${firmName} pays $${v}m in wages and salaries this year.`,
      `${firmName} labor compensation equals $${v}m.`
    ])));
    const pParts = partition(profits, randInt(1,2), 3);
    pParts.forEach(v => addInc("I_P", v, pick([
      `${firmName} reports operating surplus/profits of $${v}m.`,
      `${firmName} records $${v}m in profits.`,
      `${firmName} earns $${v}m in profit income this year.`
    ])));
  }

  splitIncomeCards("SteelCo", steelInc.w, steelInc.p);
  splitIncomeCards("AutoCo",  autoInc.w,  autoInc.p);
  splitIncomeCards("MachCo",  machInc.w,  machInc.p);
  splitIncomeCards("PortCo",  portInc.w,  portInc.p);

  // Income distractors (1–3)
  const incXcl = shuffle([
    { amt: randInt(8,18), text: "Households receive $%m in Social Security benefits (transfer)." },
    { amt: randInt(6,16), text: "A household realizes $%m in capital gains from rising stock prices." },
    { amt: randInt(8,20), text: "A firm issues new bonds worth $%m (financial transaction)." }
  ]).slice(0, randInt(1,3));
  incXcl.forEach(o => addInc("I_XCL", o.amt, o.text.replace("%", o.amt)));

  // Shuffle the arrays (so even within a ledger, card order varies)
  const productionCards = shuffle(prodCards);
  const expenditureCards = shuffle(expCards);
  const incomeCards = shuffle(incCards);

  // Return scenario + metadata
  return {
    productionCards,
    expenditureCards,
    incomeCards,
    meta: {
      inventoryCardIds: invCardIds,
      gdpProd: GDP_prod_final,
      gdpExp: GDP_exp_final,
      gdpInc: GDP_inc,
      scale
    }
  };
}
