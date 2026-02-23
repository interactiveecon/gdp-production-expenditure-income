// data.js — Complex GDP Reconciliation Lab (Guaranteed Reconciliation)
//
// Guarantee: If students classify ALL cards correctly, then
// GDP(Production) = GDP(Expenditure) = GDP(Income), so the gap is exactly 0.
//
// Key design decisions:
// - We choose a random GDP_TARGET each round.
// - We generate Expenditure components so C + I + G + (X - M) == GDP_TARGET exactly.
//   Investment I = I_fixed + I_inventory (inventory change lives inside I).
// - We generate Production cards from firm-level value added by construction:
//   VA_firm = Output_firm - Intermediate_firm, and sum(VA_firm) == GDP_TARGET.
// - We generate Income cards so Wages + Profits == GDP_TARGET exactly.
// - Text is intentionally more ambiguous: no parentheticals like "(imports)", "(transfer)", "(financial transaction)".

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function partition(amount, k, minPart = 1) {
  // Returns k integers summing to amount (can handle negative by partitioning abs and re-applying sign)
  const sign = amount < 0 ? -1 : 1;
  let A = Math.abs(Math.round(amount));

  if (k <= 1) return [sign * A];
  if (A === 0) return Array(k).fill(0);

  // Ensure feasibility
  minPart = Math.max(0, Math.floor(minPart));
  const parts = Array(k).fill(minPart);
  let remaining = A - k * minPart;
  if (remaining < 0) {
    // fallback: put all into last
    const out = Array(k).fill(0);
    out[k - 1] = sign * A;
    return out;
  }

  for (let i = 0; i < k - 1; i++) {
    const take = randInt(0, remaining);
    parts[i] += take;
    remaining -= take;
  }
  parts[k - 1] += remaining;

  return shuffle(parts).map(x => sign * x);
}

function generateScenario() {
  // -----------------------------
  // 1) Choose a GDP target
  // -----------------------------
  const GDP_TARGET = randInt(180, 520); // varies each round

  // -----------------------------
  // 2) Expenditure approach: choose components and solve for inventory investment
  // GDP = C + I_fixed + I_inv + G + (X - M)
  // -----------------------------
  let C = clamp(Math.round(0.58 * GDP_TARGET + randInt(-35, 35)), 70, 420);
  let G = clamp(Math.round(0.18 * GDP_TARGET + randInt(-20, 20)), 20, 200);
  let X = clamp(Math.round(0.14 * GDP_TARGET + randInt(-20, 20)), 10, 200);
  let M = clamp(Math.round(0.20 * GDP_TARGET + randInt(-25, 25)), 10, 240);
  let I_fixed = clamp(Math.round(0.20 * GDP_TARGET + randInt(-25, 25)), 15, 240);

  // Solve for inventory investment (can be negative)
  let I_inv = GDP_TARGET - C - I_fixed - G - (X - M);

  // Keep inventory investment within a pedagogically reasonable band by nudging C (identity preserved).
  // (We prefer not to clamp I_inv directly because it would break reconciliation.)
  const IINV_MIN = -60;
  const IINV_MAX = 120;

  if (I_inv < IINV_MIN) {
    // make I_inv less negative by reducing C
    const bump = IINV_MIN - I_inv; // positive
    C = clamp(C - bump, 40, 450);
    I_inv = GDP_TARGET - C - I_fixed - G - (X - M);
  }
  if (I_inv > IINV_MAX) {
    // make I_inv smaller by increasing C
    const bump = I_inv - IINV_MAX; // positive
    C = clamp(C + bump, 40, 500);
    I_inv = GDP_TARGET - C - I_fixed - G - (X - M);
  }

  const I_total = I_fixed + I_inv;

  // -----------------------------
  // 3) Production approach: choose firm VA shares summing to GDP_TARGET
  // -----------------------------
  const firms = [
    { keyOut: "P_S_OUT", keyInt: "P_S_INT", name: "SteelCo" },
    { keyOut: "P_A_OUT", keyInt: "P_A_INT", name: "AutoCo" },
    { keyOut: "P_P_OUT", keyInt: "P_P_INT", name: "PortCo" },
    { keyOut: "P_M_OUT", keyInt: "P_M_INT", name: "MachCo" }
  ];

  // Random VA partition across firms (each at least 10)
  const vaParts = partition(GDP_TARGET, 4, 10).map(x => Math.max(10, x));
  // Fix any drift from enforcing min 10
  let vaSum = vaParts.reduce((a, b) => a + b, 0);
  if (vaSum !== GDP_TARGET) {
    vaParts[0] += (GDP_TARGET - vaSum);
  }

  // For each firm, pick an intermediate share and compute output/intermediate so VA is exact
  // Output = VA + Intermediate; Intermediate = round(theta * Output) is messy, so we do:
  // Choose Intermediate as a fraction of VA: Intermediate = round(k * VA)
  // Then Output = VA + Intermediate (exact integer).
  const firmStats = firms.map((f, idx) => {
    const VA = vaParts[idx];
    const k = 0.2 + Math.random() * 0.9; // intermediate intensity relative to VA
    const INT = Math.max(0, Math.round(k * VA));
    const OUT = VA + INT;
    return { ...f, VA, INT, OUT };
  });

  // -----------------------------
  // 4) Income approach: wages + profits = VA per firm, summed to GDP_TARGET
  // -----------------------------
  const incomeStats = firmStats.map(fs => {
    const wageShare = 0.55 + Math.random() * 0.25; // 0.55–0.80
    const W = Math.round(wageShare * fs.VA);
    const P = fs.VA - W;
    return { name: fs.name, W, P };
  });

  // -----------------------------
  // 5) Build lots of cards (with ambiguous wording, no parentheticals)
  // -----------------------------
  let idCounter = 0;
  const nextId = (prefix) => `${prefix}_${++idCounter}`;

  // Production cards (multiple outputs + multiple intermediate purchases per firm)
  const productionCards = [];
  const prodOutTemplates = [
    (name, v) => `${name} records $${v}m of sales revenue for goods/services delivered this year.`,
    (name, v) => `${name} completes contracts valued at $${v}m at market prices.`,
    (name, v) => `${name} reports $${v}m in product/service output for the year.`
  ];
  const prodIntTemplates = [
    (name, v) => `${name} purchases $${v}m of inputs used up in production during the year.`,
    (name, v) => `${name} pays $${v}m for materials/components used as production inputs.`,
    (name, v) => `${name} buys $${v}m of business-to-business inputs used in production.`
  ];

  firmStats.forEach(fs => {
    const outParts = partition(fs.OUT, randInt(2, 4), 3);
    outParts.forEach(v => {
      productionCards.push({
        id: nextId("p"),
        ledger: "production",
        amount: v,
        text: pick(prodOutTemplates)(fs.name, v),
        correctBin: fs.keyOut
      });
    });

    const intParts = partition(fs.INT, randInt(2, 4), 1);
    intParts.forEach(v => {
      productionCards.push({
        id: nextId("p"),
        ledger: "production",
        amount: v,
        text: pick(prodIntTemplates)(fs.name, v),
        correctBin: fs.keyInt
      });
    });
  });

  // Expenditure cards
  const expenditureCards = [];

  // Consumption: split into 3–6 cards
  partition(C, randInt(3, 6), 5).forEach(v => {
    expenditureCards.push({
      id: nextId("e"),
      ledger: "expenditure",
      amount: v,
      text: pick([
        `Households spend $${v}m on final goods and services.`,
        `Consumer purchases total $${v}m this year.`,
        `Household final spending equals $${v}m.`
      ]),
      correctBin: "E_C"
    });
  });

  // Government purchases: split into 2–4 cards
  partition(G, randInt(2, 4), 4).forEach(v => {
    expenditureCards.push({
      id: nextId("e"),
      ledger: "expenditure",
      amount: v,
      text: pick([
        `A public agency buys $${v}m of goods and services from businesses.`,
        `Government purchases total $${v}m.`,
        `Public-sector spending on goods/services equals $${v}m.`
      ]),
      correctBin: "E_G"
    });
  });

  // Exports: split into 1–3 cards
  partition(X, randInt(1, 3), 3).forEach(v => {
    expenditureCards.push({
      id: nextId("e"),
      ledger: "expenditure",
      amount: v,
      text: pick([
        `Foreign buyers purchase $${v}m of domestically produced output.`,
        `Sales to customers abroad total $${v}m.`,
        `Output sold to the rest of the world equals $${v}m.`
      ]),
      correctBin: "E_X"
    });
  });

  // Imports: split into 2–5 cards
  partition(M, randInt(2, 5), 2).forEach(v => {
    expenditureCards.push({
      id: nextId("e"),
      ledger: "expenditure",
      amount: v,
      text: pick([
        `Domestic buyers purchase $${v}m of goods/services produced outside the country.`,
        `Purchases of foreign-produced items total $${v}m.`,
        `Spending on goods/services produced abroad equals $${v}m.`
      ]),
      correctBin: "E_M"
    });
  });

  // Investment fixed: 2–4 cards (non-inventory)
  const fixedInvestTemplates = [
    (v) => `Businesses purchase new equipment worth $${v}m.`,
    (v) => `Firms acquire newly produced software and equipment totaling $${v}m.`,
    (v) => `Private investment in structures/equipment equals $${v}m.`
  ];
  partition(I_fixed, randInt(2, 4), 5).forEach(v => {
    expenditureCards.push({
      id: nextId("e"),
      ledger: "expenditure",
      amount: v,
      text: pick(fixedInvestTemplates)(v),
      correctBin: "E_I",
      meta: { subtype: "fixed" }
    });
  });

  // Inventory investment: 1–2 cards (inside I)
  const invIds = [];
  partition(I_inv, randInt(1, 2), 1).forEach(v => {
    const id = nextId("e");
    invIds.push(id);
    expenditureCards.push({
      id,
      ledger: "expenditure",
      amount: v,
      text: (v >= 0)
        ? pick([
            `Firms end the year with larger inventories; inventories rise by $${v}m.`,
            `Unsold output adds $${v}m to inventories by year end.`,
            `Inventory accumulation totals $${v}m over the year.`
          ])
        : pick([
            `Firms reduce inventories; inventories fall by $${Math.abs(v)}m.`,
            `Sales out of existing inventories reduce inventories by $${Math.abs(v)}m.`,
            `Inventory liquidation equals $${Math.abs(v)}m over the year.`
          ]),
      correctBin: "E_I",
      meta: { subtype: "inventory" }
    });
  });

  // Expenditure distractors (XCL): 3–6 cards, no obvious labels
  const xclPool = [
    { amt: randInt(8, 22),  text: (a) => `A government program sends $${a}m to households.` },
    { amt: randInt(6, 18),  text: (a) => `A used asset changes hands for $${a}m.` },
    { amt: randInt(10, 30), text: (a) => `Households trade existing securities worth $${a}m.` },
    { amt: randInt(6, 20),  text: (a) => `A one-time payment of $${a}m is made to individuals.` },
    { amt: randInt(8, 24),  text: (a) => `A loan principal repayment totals $${a}m.` },
    { amt: randInt(6, 18),  text: (a) => `A household receives $${a}m from an insurance claim payout.` }
  ];
  shuffle(xclPool).slice(0, randInt(3, 6)).forEach(o => {
    expenditureCards.push({
      id: nextId("e"),
      ledger: "expenditure",
      amount: o.amt,
      text: o.text(o.amt),
      correctBin: "E_XCL"
    });
  });

  // Income cards: multiple wage and profit cards per firm + distractors
  const incomeCards = [];

  incomeStats.forEach(st => {
    // wages split 2–3
    partition(st.W, randInt(2, 3), 4).forEach(v => {
      incomeCards.push({
        id: nextId("i"),
        ledger: "income",
        amount: v,
        text: pick([
          `${st.name} pays $${v}m in compensation to workers.`,
          `${st.name} payroll totals $${v}m.`,
          `${st.name} pays $${v}m in wages and salaries.`
        ]),
        correctBin: "I_W"
      });
    });

    // profits split 1–2
    partition(st.P, randInt(1, 2), 2).forEach(v => {
      incomeCards.push({
        id: nextId("i"),
        ledger: "income",
        amount: v,
        text: pick([
          `${st.name} records $${v}m as operating surplus.`,
          `${st.name} reports profits of $${v}m.`,
          `${st.name} earns $${v}m in business income.`
        ]),
        correctBin: "I_P"
      });
    });
  });

  // Income distractors: 2–4 (no “financial transaction” label)
  const incXclPool = [
    { amt: randInt(8, 24), text: (a) => `A household receives $${a}m from a public benefit program.` },
    { amt: randInt(8, 26), text: (a) => `Investors realize $${a}m from asset price changes.` },
    { amt: randInt(10, 30), text: (a) => `A firm raises $${a}m by issuing new securities.` },
    { amt: randInt(6, 18), text: (a) => `A lump-sum transfer of $${a}m is received by households.` }
  ];
  shuffle(incXclPool).slice(0, randInt(2, 4)).forEach(o => {
    incomeCards.push({
      id: nextId("i"),
      ledger: "income",
      amount: o.amt,
      text: o.text(o.amt),
      correctBin: "I_XCL"
    });
  });

  // Final shuffle so pool is never in “logical” order
  return {
    productionCards: shuffle(productionCards),
    expenditureCards: shuffle(expenditureCards),
    incomeCards: shuffle(incomeCards),
    meta: {
      inventoryCardIds: invIds,
      gdpTarget: GDP_TARGET,
      components: { C, I_fixed, I_inv, I_total, G, X, M }
    }
  };
}
