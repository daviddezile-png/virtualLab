export interface FormulationInput {
  stearic_acid: number;
  liquid_paraffin: number;
  glycerin: number;
  potassium_hydroxide: number;
  water: number;
  oil_phase_temperature: number;
  aqueous_phase_temperature: number;
  mixing_order: "aqueous_to_oil" | "oil_to_aqueous";
  mixing_time: number;
  cooling_temperature: number;
  cooling_stirring: boolean;
}

export interface ScoreBreakdown {
  ingredient: number;
  temperature: number;
  emulsification: number;
  cooling: number;
  pH: number;
  viscosity: number;
}

export interface Percentages {
  stearic: number;
  paraffin: number;
  glycerin: number;
  koh: number;
  water: number;
}

export interface EvaluationResult {
  result: "PASS" | "AVERAGE" | "FAIL";
  score: number;
  stability: "stable" | "unstable" | "separation";
  appearance: string;
  predicted_pH: number;
  predicted_viscosity: number;
  feedback: string[];
  scores: ScoreBreakdown;
  percentages: Percentages;
}

function scoreRange(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 1;
  if (value >= min - 3 && value <= max + 3) return 0.5;
  return 0;
}

export function evaluateFormulation(input: FormulationInput): EvaluationResult {
  const total =
    input.stearic_acid +
    input.liquid_paraffin +
    input.glycerin +
    input.potassium_hydroxide +
    input.water;

  if (total === 0) throw new Error("No ingredients added.");

  // Step 1 — Normalise
  const stearic_pct = (input.stearic_acid / total) * 100;
  const paraffin_pct = (input.liquid_paraffin / total) * 100;
  const glycerin_pct = (input.glycerin / total) * 100;
  const koh_pct = (input.potassium_hydroxide / total) * 100;
  const water_pct = (input.water / total) * 100;

  // Step 2 — Ingredient score
  const ingredient_score =
    scoreRange(stearic_pct, 15, 20) +
    scoreRange(paraffin_pct, 5, 10) +
    scoreRange(glycerin_pct, 2, 5) +
    scoreRange(koh_pct, 0.5, 2) +
    scoreRange(water_pct, 60, 75);

  // Step 3 — Temperature score
  const temp_diff = Math.abs(
    input.oil_phase_temperature - input.aqueous_phase_temperature,
  );
  let temperature_score: number;
  if (
    input.oil_phase_temperature >= 70 &&
    input.oil_phase_temperature <= 80 &&
    input.aqueous_phase_temperature >= 70 &&
    input.aqueous_phase_temperature <= 80 &&
    temp_diff <= 5
  ) {
    temperature_score = 1;
  } else if (temp_diff <= 10) {
    temperature_score = 0.5;
  } else {
    temperature_score = 0;
  }

  // Step 4 — Emulsification score
  const order_score = input.mixing_order === "aqueous_to_oil" ? 1 : 0;
  const time_score = input.mixing_time >= 30 ? 1 : 0.5;
  const emulsification_score = (order_score + time_score) / 2;

  // Step 5 — Cooling score
  let cooling_score: number;
  if (input.cooling_temperature <= 40 && input.cooling_stirring) {
    cooling_score = 1;
  } else if (input.cooling_temperature <= 50) {
    cooling_score = 0.5;
  } else {
    cooling_score = 0;
  }

  // Step 6 — Quality prediction
  const predicted_pH = 5 + koh_pct * 0.8;
  const pH_score = predicted_pH >= 5 && predicted_pH <= 7 ? 1 : 0;

  const predicted_viscosity =
    stearic_pct * 70 + paraffin_pct * 45 - water_pct * 5;
  const viscosity_score =
    predicted_viscosity >= 1100 && predicted_viscosity <= 1800 ? 1 : 0.5;

  // Step 7 — Stability
  let stability: "stable" | "unstable" | "separation";
  if (
    temperature_score === 1 &&
    emulsification_score === 1 &&
    ingredient_score >= 4
  ) {
    stability = "stable";
  } else if (temperature_score === 0) {
    stability = "separation";
  } else {
    stability = "unstable";
  }

  // Step 8 — Final score
  let final_score =
    ingredient_score * 2 +
    temperature_score * 2 +
    emulsification_score * 3 +
    cooling_score * 1 +
    pH_score * 1 +
    viscosity_score * 1;

  // Step 9 — Result (strict)
  let result: "PASS" | "FAIL";
  // Only PASS if all critical steps are perfect
  if (
    ingredient_score === 4 &&
    temperature_score === 1 &&
    emulsification_score === 1 &&
    cooling_score === 1 &&
    pH_score === 1 &&
    viscosity_score === 1 &&
    stability === "stable"
  ) {
    result = "PASS";
  } else {
    result = "FAIL";
  }

  // Step 10 — Appearance
  let appearance =
    result === "PASS"
      ? "Smooth white cream"
      : "Phase separation or grainy texture";

  // Critical failure — wrong mixing order forms the WRONG emulsion type.
  // For a vanishing cream (O/W) the aqueous phase must go INTO the oil phase.
  // Reversing it yields a cold cream (W/O) instead, so no vanishing cream is
  // produced → the whole attempt scores zero.
  const wrong_order = input.mixing_order !== "aqueous_to_oil";
  if (wrong_order) {
    final_score = 0;
    result = "FAIL";
    stability = "separation";
    appearance = "Cold cream (W/O) formed — not vanishing cream";
  }

  // Step 11 — Feedback
  const feedback: string[] = [];
  if (wrong_order)
    feedback.push("Vanishing cream NOT formed — the phases were combined in the wrong order, producing a cold cream (W/O emulsion) instead. Add the aqueous phase INTO the oil phase. Score: 0.");
  if (temp_diff > 5)
    feedback.push("Temperature mismatch between phases may cause separation.");
  if (input.mixing_order !== "aqueous_to_oil" && !wrong_order)
    feedback.push("Incorrect mixing order. Add aqueous phase into oil phase.");
  if (input.mixing_time < 30)
    feedback.push("Increase mixing time to at least 30 s for full emulsification.");
  if (predicted_pH > 7)
    feedback.push("High pH detected. Reduce potassium hydroxide quantity.");
  if (ingredient_score < 3)
    feedback.push("Ingredient proportions are outside acceptable ranges.");
  if (cooling_score < 1)
    feedback.push("Cool below 40 °C with continuous stirring for best texture.");

  return {
    result,
    score: Math.round(final_score * 10) / 10,
    stability,
    appearance,
    predicted_pH: Math.round(predicted_pH * 100) / 100,
    predicted_viscosity: Math.round(predicted_viscosity),
    feedback,
    scores: {
      ingredient: ingredient_score,
      temperature: temperature_score,
      emulsification: emulsification_score,
      cooling: cooling_score,
      pH: pH_score,
      viscosity: viscosity_score,
    },
    percentages: {
      stearic: Math.round(stearic_pct * 10) / 10,
      paraffin: Math.round(paraffin_pct * 10) / 10,
      glycerin: Math.round(glycerin_pct * 10) / 10,
      koh: Math.round(koh_pct * 10) / 10,
      water: Math.round(water_pct * 10) / 10,
    },
  };
}

// ── Cold Cream (W/O Emulsion) Engine ─────────────────────────────────────────

export interface ColdCreamInput {
  beeswax: number;           // grams
  liquid_paraffin: number;   // mL
  borax: number;             // mL
  water: number;             // mL
  oil_phase_temperature: number;
  aqueous_phase_temperature: number;
  mixing_order: "aqueous_to_oil" | "oil_to_aqueous";
  mixing_time: number;
  cooling_temperature: number;
  cooling_stirring: boolean;
}

export interface ColdCreamPercentages {
  beeswax: number;
  paraffin: number;
  borax: number;
  water: number;
}

export interface ColdCreamResult {
  result: "PASS" | "AVERAGE" | "FAIL";
  score: number;
  stability: "stable" | "unstable" | "separation";
  appearance: string;
  predicted_pH: number;
  predicted_viscosity: number;
  feedback: string[];
  scores: ScoreBreakdown;
  percentages: ColdCreamPercentages;
}

export function evaluateColdCream(input: ColdCreamInput): ColdCreamResult {
  const total = input.beeswax + input.liquid_paraffin + input.borax + input.water;
  if (total === 0) throw new Error("No ingredients added.");

  // Percentages
  const beeswax_pct  = (input.beeswax        / total) * 100;
  const paraffin_pct = (input.liquid_paraffin / total) * 100;
  const borax_pct    = (input.borax           / total) * 100;
  const water_pct    = (input.water           / total) * 100;

  // Ingredient score — W/O needs much more oil (paraffin) than water
  const ingredient_score =
    scoreRange(beeswax_pct,  10, 16) +   // target ~13%
    scoreRange(paraffin_pct, 34, 46) +   // target ~39%
    scoreRange(borax_pct,     2,  5) +   // target ~3.3%
    scoreRange(water_pct,    38, 52);    // target ~44%

  // Temperature score — slightly lower than vanishing cream (65–75°C)
  const temp_diff = Math.abs(input.oil_phase_temperature - input.aqueous_phase_temperature);
  let temperature_score: number;
  if (
    input.oil_phase_temperature >= 65 && input.oil_phase_temperature <= 75 &&
    input.aqueous_phase_temperature >= 65 && input.aqueous_phase_temperature <= 75 &&
    temp_diff <= 5
  ) {
    temperature_score = 1;
  } else if (temp_diff <= 10) {
    temperature_score = 0.5;
  } else {
    temperature_score = 0;
  }

  // Emulsification — same rule: aqueous into oil (W/O)
  const order_score = input.mixing_order === "aqueous_to_oil" ? 1 : 0;
  const time_score  = input.mixing_time >= 20 ? 1 : 0.5;
  const emulsification_score = (order_score + time_score) / 2;

  // Cooling — cold cream needs to cool to ≤35°C (colder than vanishing cream)
  let cooling_score: number;
  if (input.cooling_temperature <= 35 && input.cooling_stirring) {
    cooling_score = 1;
  } else if (input.cooling_temperature <= 45) {
    cooling_score = 0.5;
  } else {
    cooling_score = 0;
  }

  // pH prediction — borax buffers to slightly alkaline
  const predicted_pH = 6.5 + (borax_pct / 5) * 1.0;
  const pH_score = predicted_pH >= 6.0 && predicted_pH <= 7.5 ? 1 : 0;

  // Viscosity prediction — W/O is much thicker than O/W
  const predicted_viscosity = Math.round(
    beeswax_pct * 220 + paraffin_pct * 55 - water_pct * 10
  );
  const viscosity_score = predicted_viscosity >= 2000 && predicted_viscosity <= 6000 ? 1 : 0.5;

  // Stability
  let stability: "stable" | "unstable" | "separation";
  if (temperature_score === 1 && emulsification_score === 1 && ingredient_score >= 3) {
    stability = "stable";
  } else if (temperature_score === 0) {
    stability = "separation";
  } else {
    stability = "unstable";
  }

  // Final score (max 18)
  const final_score =
    ingredient_score * 2 +
    temperature_score * 2 +
    emulsification_score * 3 +
    cooling_score * 1 +
    pH_score * 1 +
    viscosity_score * 1;

  let final_score_out = final_score;
  let result: "PASS" | "AVERAGE" | "FAIL";
  if (final_score >= 8 && stability === "stable") {
    result = "PASS";
  } else if (final_score >= 5) {
    result = "AVERAGE";
  } else {
    result = "FAIL";
  }

  let appearance =
    result === "PASS"    ? "Thick white cold cream"
    : result === "AVERAGE" ? "Soft but slightly greasy cream"
    : "Phase separation or watery texture";

  // Critical failure — wrong mixing order forms the WRONG emulsion type.
  // A cold cream (W/O) needs the aqueous phase added INTO the oil phase.
  // Reversing it yields a vanishing cream (O/W) instead → scores zero.
  const wrong_order = input.mixing_order !== "aqueous_to_oil";
  if (wrong_order) {
    final_score_out = 0;
    result = "FAIL";
    stability = "separation";
    appearance = "Vanishing cream (O/W) formed — not cold cream";
  }

  const feedback: string[] = [];
  if (wrong_order)
    feedback.push("Cold cream NOT formed — the phases were combined in the wrong order, producing a vanishing cream (O/W emulsion) instead. Add the aqueous (borax+water) phase INTO the oil phase. Score: 0.");
  if (temp_diff > 5)
    feedback.push("Temperature mismatch between phases — keep both at 65–75°C.");
  if (input.mixing_order !== "aqueous_to_oil" && !wrong_order)
    feedback.push("Incorrect mixing order. Add aqueous (borax+water) into the oil phase.");
  if (input.mixing_time < 20)
    feedback.push("Increase stirring time to at least 20 s for full emulsification.");
  if (predicted_pH > 7.5)
    feedback.push("pH too high — reduce borax quantity.");
  if (beeswax_pct < 10 || beeswax_pct > 16)
    feedback.push("Beeswax proportion out of range (target 10–16%).");
  if (paraffin_pct < 34 || paraffin_pct > 46)
    feedback.push("Liquid paraffin proportion out of range (target 34–46%).");
  if (cooling_score < 1)
    feedback.push("Cool to ≤35°C with continuous stirring for best cold cream texture.");

  return {
    result,
    score: Math.round(final_score_out * 10) / 10,
    stability,
    appearance,
    predicted_pH:       Math.round(predicted_pH * 100) / 100,
    predicted_viscosity,
    feedback,
    scores: {
      ingredient: ingredient_score,
      temperature: temperature_score,
      emulsification: emulsification_score,
      cooling: cooling_score,
      pH: pH_score,
      viscosity: viscosity_score,
    },
    percentages: {
      beeswax:  Math.round(beeswax_pct  * 10) / 10,
      paraffin: Math.round(paraffin_pct * 10) / 10,
      borax:    Math.round(borax_pct    * 10) / 10,
      water:    Math.round(water_pct    * 10) / 10,
    },
  };
}
