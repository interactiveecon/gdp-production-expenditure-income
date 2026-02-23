// data.js
// GDP Reconciliation Lab — internally consistent by construction
// Guarantees: if students classify correctly, GDP(Production)=GDP(Expenditure)=GDP(Income) and gap=0.
//
// Key design choices to ensure reconciliation:
// 1) Any intermediate input not produced by an explicit domestic firm is treated as an IMPORT (shows up in M).
// 2) Household consumption C is TOTAL consumption (domestic + imported). Imports are recorded separately in M.
//    Domestic production sold to households is therefore C_dom = C_total - M_cons.
// 3) Inventory investment is inside Investment (I). We set inventory investment as a residual so GDPexp hits GDP_TARGET.
// 4) Firm VA matches Wages+Profits exactly by construction (profits are residual).

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function generateScenario() {
  // Target GDP level (millions)
  const GDP_TARGET = 220;

  // Random noise to keep rounds fresh (but identities preserved)
  const noiseC = randInt(-10, 10);
  const noiseG = randInt(-5, 5);
  const noiseX = randInt(-5, 5);
  const noiseMcons = randInt(-6, 6);

  // Imports (intermediate imports are crucial for reconciliation)
  const M_ore = 20;   // SteelCo imported ore (intermediate import)
  const M_fuel = 10;  // PortCo imported fuel (intermediate import)

  // Total household consumption (includes imported consumption goods)
  let C_total = clamp(140 + noiseC, 130, 190);

  // Imported portion of household consumption
  let M_cons = clamp(20 + noiseMcons, 8, 35);

  // Ensure domestic consumption is nonnegative and not tiny
  // If imported share is too large relative to total C, bump C_total up.
  if (C_total - M_cons < 60) {
    C_total = clamp(M_cons + 60, 130, 190);
  }

  // Government purchases of domestically produced goods/services
  let G = clamp(40 + noiseG, 25, 55);

  // Exports (domestically produced services)
  let X = clamp(30 + noiseX, 15, 45);

  // Inventory investment as residual so GDP identity holds:
  // GDP = C + I + G + X - M_total  =>  I = GDP - C - G - X + M_total
  const M_total = M_cons + M_ore + M_fuel;

  let I = GDP_TARGET - C_total - G - X + M_total;

  // Keep inventories plausible; adjust C_total to preserve identity
  if (I < 10) {
    // reduce C_total so I rises to 10
    const bump = 10 - I;
    C_total = clamp(C_total - bump, 90, 220);
    I = 10;
  }
  if (I > 80) {
    // increase C_total so I falls to 80
    const bump = I - 80;
    C_total = clamp(C_total + bump, 90, 240);
    I = 80;
  }

  // Domestic consumption of domestically produced output
  const C_dom = C_total - M_cons;

  // Production structure (3 domestic firms)
  // AutoCo produces cars/services worth autoOutput = domestic sales (C_dom+G) + inventories (I).
  const autoSales = C_dom + G;
  const autoOutput = autoSales + I;

  // Intermediate inputs between domestic firms
  const steelToAuto = 100; // intermediate steel produced domestically
  const portToAuto = 20;   // domestic shipping service used as intermediate by AutoCo

  const autoIntermediate = steelToAuto + portToAuto;

  // AutoCo value added
  const autoVA = autoOutput - autoIntermediate;

  // Income split for AutoCo: choose wages as ~70% of VA; profits are residual to match VA exactly
  const autoW = clamp(Math.round(0.7 * autoVA), 40, 130);
  const autoPi = autoVA - autoW;

  // SteelCo: output equals steel sold to AutoCo; intermediate is imported ore
  const steelOutput = steelToAuto;
  const steelIntermediate = M_ore;
  const steelVA = steelOutput - steelIntermediate;

  // Choose steel wages as fixed 50; profits residual (can be negative if scenario extreme, but should not be here)
  const steelW = 50;
  const steelPi = steelVA - steelW;

  // PortCo: output = domestic intermediate (portToAuto) + exports (X); intermediate is imported fuel
  const portOutput = portToAuto + X;
  const portIntermediate = M_fuel;
  const portVA = portOutput - portIntermediate;

  const portW = clamp(Math.round(0.75 * portVA), 10, 120);
  const portPi = portVA - portW;

  // Ground truth GDP from production (value added)
  const gdpProdTrue = steelVA + autoVA + portVA;

  // Ground truth GDP from expenditure
  const gdpExpTrue = C_total + I + G + (X - M_total);

  // Ground truth GDP from income
  const gdpIncTrue = (steelW + autoW + portW) + (steelPi + autoPi + portPi);

  // Final safety reconciliation adjustment (should be zero already).
  // If not, patch inventory investment slightly and keep AutoCo output consistent.
  const diff = gdpProdTrue - gdpExpTrue;
  if (Math.abs(diff) > 1e-9) {
    I += diff;
    // Update AutoCo output and VA accordingly
    // (Domestic sales unchanged; inventories absorb the adjustment)
    // Recompute dependent pieces
    const autoOutput2 = autoSales + I;
    const autoVA2 = autoOutput2 - autoIntermediate;
    const autoW2 = clamp(Math.round(0.7 * autoVA2), 40, 130);
    const autoPi2 = autoVA2 - autoW2;

    // overwrite
    // (keep other firms the same)
    // eslint-disable-next-line no-unused-vars
    // assign updated values
    // We'll just overwrite variables via new const blocks is not allowed; so instead set via let copies.
    // But we kept most as const; so this patch block is effectively a no-op in normal operation.
  }

  // Cards by ledger
  const productionCards = [
    {
      id: "p1",
      ledger: "production",
      amount: steelOutput,
      text: `SteelCo produces and sells steel worth $${steelOutput}m (sold to AutoCo).`,
      correctBin: "P_S_OUT"
    },
    {
      id: "p2",
      ledger: "production",
      amount: steelIntermediate,
      text: `SteelCo buys imported ore worth $${steelIntermediate}m as an intermediate input.`,
      correctBin: "P_S_INT"
    },
    {
      id: "p3",
      ledger: "production",
      amount: autoOutput,
      text: `AutoCo produces cars worth $${autoOutput}m this year (including unsold cars added to inventory).`,
      correctBin: "P_A_OUT"
    },
    {
      id: "p4",
      ledger: "production",
      amount: autoIntermediate,
      text: `AutoCo purchases $${autoIntermediate}m of intermediate inputs (steel + domestic shipping services).`,
      correctBin: "P_A_INT"
    },
    {
      id: "p5",
      ledger: "production",
      amount: portOutput,
      text: `PortCo produces shipping services worth $${portOutput}m (domestic + exports).`,
      correctBin: "P_P_OUT"
    },
    {
      id: "p6",
      ledger: "production",
      amount: portIntermediate,
      text: `PortCo buys imported fuel worth $${portIntermediate}m as an intermediate input.`,
      correctBin: "P_P_INT"
    }
  ];

  const expenditureCards = [
    {
      id: "e1",
      ledger: "expenditure",
      amount: C_total,
      text: `Households spend $${C_total}m on consumption (includes imported items).`,
      correctBin: "E_C"
    },
    {
      id: "e2",
      ledger: "expenditure",
      amount: G,
      text: `Government purchases domestically produced goods/services worth $${G}m.`,
      correctBin: "E_G"
    },
    {
      id: "e3",
      ledger: "expenditure",
      amount: I,
      text: `Firms add $${I}m to inventories this year (inventory investment; part of Investment, I).`,
      correctBin: "E_I"
    },
    {
      id: "e4",
      ledger: "expenditure",
      amount: X,
      text: `Foreigners purchase U.S. shipping services worth $${X}m (exports).`,
      correctBin: "E_X"
    },
    {
      id: "e5",
      ledger: "expenditure",
      amount: M_cons,
      text: `Households buy imported consumer goods worth $${M_cons}m (imports).`,
      correctBin: "E_M"
    },
    {
      id: "e6",
      ledger: "expenditure",
      amount: M_ore,
      text: `SteelCo buys imported ore worth $${M_ore}m (imports; intermediate input).`,
      correctBin: "E_M"
    },
    {
      id: "e7",
      ledger: "expenditure",
      amount: M_fuel,
      text: `PortCo buys imported fuel worth $${M_fuel}m (imports; intermediate input).`,
      correctBin: "E_M"
    },

    // Distractors (not in GDP)
    {
      id: "e8",
      ledger: "expenditure",
      amount: 15,
      text: "Government pays $15m in unemployment benefits (a transfer).",
      correctBin: "E_XCL"
    },
    {
      id: "e9",
      ledger: "expenditure",
      amount: 12,
      text: "A used car is resold for $12m (used good).",
      correctBin: "E_XCL"
    }
  ];

  const incomeCards = [
    { id: "i1", ledger: "income", amount: steelW,  text: `SteelCo pays $${steelW}m in wages.`,  correctBin: "I_W" },
    { id: "i2", ledger: "income", amount: steelPi, text: `SteelCo earns $${steelPi}m in profits.`, correctBin: "I_P" },

    { id: "i3", ledger: "income", amount: autoW,  text: `AutoCo pays $${autoW}m in wages.`,  correctBin: "I_W" },
    { id: "i4", ledger: "income", amount: autoPi, text: `AutoCo earns $${autoPi}m in profits.`, correctBin: "I_P" },

    { id: "i5", ledger: "income", amount: portW,  text: `PortCo pays $${portW}m in wages.`,  correctBin: "I_W" },
    { id: "i6", ledger: "income", amount: portPi, text: `PortCo earns $${portPi}m in profits.`, correctBin: "I_P" },

    // Distractor
    { id: "i7", ledger: "income", amount: 10, text: "Households receive $10m in Social Security benefits (a transfer).", correctBin: "I_XCL" }
  ];

  return {
    productionCards,
    expenditureCards,
    incomeCards,
    gdpTarget: gdpProdTrue,
    debug: {
      GDP_TARGET,
      gdpProdTrue,
      gdpExpTrue,
      gdpIncTrue,
      C_total, C_dom, I, G, X,
      M_cons, M_ore, M_fuel, M_total,
      steelVA, autoVA, portVA
    }
  };
}
