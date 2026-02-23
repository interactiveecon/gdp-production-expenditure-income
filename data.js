// GDP Reconciliation Lab
// One consistent economy with small random noise applied to keep it fresh.
// We keep the accounting identities true by construction.

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Create a scenario that always reconciles to GDP = 220 (or nearby) by preserving structure.
// We allow small random variation but recompute dependent pieces to keep identities consistent.
function generateScenario() {
  // Core structure (in millions)
  // Production / Income targets by firm:
  // SteelCo: Output=100, Intermediate=20 => VA=80 (W=50, Pi=30)
  // AutoCo:  Output=220, Intermediate=120 => VA=100 (W=70, Pi=30)
  // PortCo:  Output=50,  Intermediate(import fuel)=10 => VA=40 (W=30, Pi=10)
  //
  // Expenditure:
  // C=140, G=40, I(inventory)=40, X=30, M=20 (consumer) + 10 (fuel) => M=30
  // GDP = 140 + 40 + 40 + 30 - 30 = 220

  // Add small noise to make rounds vary while preserving totals.
  const noiseC = randInt(-10, 10);
  const noiseG = randInt(-5, 5);
  const noiseX = randInt(-5, 5);
  const noiseMcons = randInt(-6, 6);

  let C = 140 + noiseC;
  let G = 40 + noiseG;
  let X = 30 + noiseX;
  let M_cons = 20 + noiseMcons;

  // keep within sensible bounds
  C = Math.max(110, Math.min(170, C));
  G = Math.max(25, Math.min(55, G));
  X = Math.max(15, Math.min(45, X));
  M_cons = Math.max(8, Math.min(35, M_cons));

  // Fixed imports: PortCo fuel import (intermediate import)
  const M_fuel = 10;

  // To keep GDP at 220, choose inventory investment as residual:
  // GDP = C + I + G + X - (M_cons + M_fuel) = 220
  const I_inv = 220 - C - G - X + (M_cons + M_fuel);

  // Keep inventories plausible. If out of range, adjust C slightly.
  let I = I_inv;
  if (I < 10) { C -= (10 - I); I = 10; }
  if (I > 80) { C += (I - 80); I = 80; }

  // Now build a consistent production structure:
  // Auto output is sales (C+G) + inventories I (since no fixed investment purchases of autos here)
  const autoSales = C + G;      // domestic final demand for cars
  const autoOutput = autoSales + I; // cars produced (market value)

  // Keep Auto output near 220-ish; if it drifts, it’s okay: GDP adjusts via our accounting.
  // Keep intermediate inputs fixed proportionally:
  const steelToAuto = 100;      // intermediate steel (fixed for clarity)
  const portToAuto = 20;        // domestic shipping service intermediate
  const autoIntermediate = steelToAuto + portToAuto;

  // Choose Auto wages/profits to match VA
  const autoVA = autoOutput - autoIntermediate;
  const autoW = Math.max(40, Math.min(110, Math.round(0.7 * autoVA)));
  const autoPi = autoVA - autoW;

  // SteelCo output equals steel sold to AutoCo
  const steelOutput = steelToAuto;
  const steelIntermediate = 20;
  const steelVA = steelOutput - steelIntermediate;
  const steelW = 50;
  const steelPi = steelVA - steelW;

  // PortCo output: domestic intermediate (20) + exports X
  const portOutput = portToAuto + X;
  const portIntermediate = M_fuel; // imported fuel as intermediate
  const portVA = portOutput - portIntermediate;
  const portW = Math.max(10, Math.round(0.75 * portVA));
  const portPi = portVA - portW;

  // Assemble cards by ledger (each card only appears in its ledger)
  const productionCards = [
    {
      id: "p1",
      ledger: "production",
      amount: steelOutput,
      text: "SteelCo produces and sells steel worth $" + steelOutput + "m (sold to AutoCo).",
      correctBin: "P_S_OUT"
    },
    {
      id: "p2",
      ledger: "production",
      amount: steelIntermediate,
      text: "SteelCo buys $"+ steelIntermediate +"m of domestic intermediate inputs (e.g., utilities/services).",
      correctBin: "P_S_INT"
    },
    {
      id: "p3",
      ledger: "production",
      amount: autoOutput,
      text: "AutoCo produces cars worth $" + autoOutput + "m this year (including unsold cars added to inventory).",
      correctBin: "P_A_OUT"
    },
    {
      id: "p4",
      ledger: "production",
      amount: autoIntermediate,
      text: "AutoCo purchases $"+ autoIntermediate +"m of intermediate inputs (steel + domestic shipping services).",
      correctBin: "P_A_INT"
    },
    {
      id: "p5",
      ledger: "production",
      amount: portOutput,
      text: "PortCo produces shipping services worth $" + portOutput + "m (domestic + exports).",
      correctBin: "P_P_OUT"
    },
    {
      id: "p6",
      ledger: "production",
      amount: portIntermediate,
      text: "PortCo buys $"+ portIntermediate +"m of imported fuel as an intermediate input.",
      correctBin: "P_P_INT"
    }
  ];

  const expenditureCards = [
    {
      id: "e1",
      ledger: "expenditure",
      amount: C,
      text: "Households buy domestically produced cars worth $" + C + "m.",
      correctBin: "E_C"
    },
    {
      id: "e2",
      ledger: "expenditure",
      amount: G,
      text: "Government purchases domestically produced cars worth $" + G + "m (fleet vehicles).",
      correctBin: "E_G"
    },
    {
      id: "e3",
      ledger: "expenditure",
      amount: I,
      text: "AutoCo produces more cars than it sells; unsold cars worth $" + I + "m are added to inventories (inventory investment).",
      correctBin: "E_I"
    },
    {
      id: "e4",
      ledger: "expenditure",
      amount: X,
      text: "Foreigners purchase U.S. shipping services from PortCo worth $" + X + "m (exports).",
      correctBin: "E_X"
    },
    {
      id: "e5",
      ledger: "expenditure",
      amount: M_cons,
      text: "Households buy imported consumer goods (e.g., phones) worth $" + M_cons + "m.",
      correctBin: "E_M"
    },
    {
      id: "e6",
      ledger: "expenditure",
      amount: M_fuel,
      text: "PortCo buys imported fuel worth $" + M_fuel + "m (an import).",
      correctBin: "E_M"
    },
    // Distractors
    {
      id: "e7",
      ledger: "expenditure",
      amount: 15,
      text: "Government pays $15m in unemployment benefits (a transfer).",
      correctBin: "E_XCL"
    },
    {
      id: "e8",
      ledger: "expenditure",
      amount: 12,
      text: "A used car is resold for $12m (used good).",
      correctBin: "E_XCL"
    }
  ];

  const incomeCards = [
    { id: "i1", ledger: "income", amount: steelW,  text: "SteelCo pays $" + steelW + "m in wages.",  correctBin: "I_W" },
    { id: "i2", ledger: "income", amount: steelPi, text: "SteelCo earns $" + steelPi + "m in profits.", correctBin: "I_P" },

    { id: "i3", ledger: "income", amount: autoW,  text: "AutoCo pays $" + autoW + "m in wages.",  correctBin: "I_W" },
    { id: "i4", ledger: "income", amount: autoPi, text: "AutoCo earns $" + autoPi + "m in profits.", correctBin: "I_P" },

    { id: "i5", ledger: "income", amount: portW,  text: "PortCo pays $" + portW + "m in wages.",  correctBin: "I_W" },
    { id: "i6", ledger: "income", amount: portPi, text: "PortCo earns $" + portPi + "m in profits.", correctBin: "I_P" },

    // Distractor
    { id: "i7", ledger: "income", amount: 10, text: "Households receive $10m in Social Security benefits (a transfer).", correctBin: "I_XCL" }
  ];

  return {
    productionCards,
    expenditureCards,
    incomeCards,
    // ground-truth GDP (all should match)
    gdpTarget: steelVA + autoVA + portVA
  };
}
