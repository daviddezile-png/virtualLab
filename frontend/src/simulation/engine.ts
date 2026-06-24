export interface FormulationInput {
  stearic_acid: number;
  liquid_paraffin: number;
  glycerin: number;
  potassium_hydroxide: number;
  water: number;
  oil_phase_temperature: number;
  aqueous_phase_temperature: number;
  // "none" = the two phases were never combined into the main beaker (step not
  // performed). "oil_to_aqueous" = combined, but in the reversed order.
  mixing_order: "aqueous_to_oil" | "oil_to_aqueous" | "none";
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
  // 0 s of stirring earns nothing — only a partial attempt (<30 s) earns half.
  const time_score = input.mixing_time >= 30 ? 1 : input.mixing_time > 0 ? 0.5 : 0;
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

  // Two distinct procedural situations, reported separately so the feedback
  // matches what the student ACTUALLY did:
  //   • not_combined — the two phases were never combined; no emulsion was ever
  //     formed. This is an incomplete attempt, NOT a wrong-order mistake, so the
  //     student keeps the partial marks earned on the steps they did complete.
  //   • wrong_order  — the phases WERE combined, but reversed (oil into aqueous),
  //     which forms a cold cream (W/O) instead of a vanishing cream. No valid
  //     product was made → the whole attempt scores zero.
  const not_combined = input.mixing_order === "none";
  const wrong_order  = input.mixing_order === "oil_to_aqueous";
  if (wrong_order) {
    final_score = 0;
    result = "FAIL";
    stability = "separation";
    appearance = "Cold cream (W/O) formed — not vanishing cream";
  } else if (not_combined) {
    result = "FAIL";
    stability = "separation";
    appearance = "Phases not combined — no emulsion formed";
  }

  // Step 11 — Feedback (describe the real condition, not a generic checklist)
  const feedback: string[] = [];
  if (not_combined)
    feedback.push("The two phases were never combined, so no emulsion formed. Pour the oil phase into the main beaker, then add the aqueous phase INTO it and stir. (Partial marks given for the steps you completed.)");
  else if (wrong_order)
    feedback.push("Vanishing cream NOT formed — the phases were combined in the wrong order, producing a cold cream (W/O emulsion) instead. Add the aqueous phase INTO the oil phase. Score: 0.");

  // Heating — distinguish "never heated" from "heated to the wrong temperature".
  const oil_not_heated = input.oil_phase_temperature <= 30;
  const aq_not_heated  = input.aqueous_phase_temperature <= 30;
  if (oil_not_heated || aq_not_heated)
    feedback.push(`You did not heat the ${oil_not_heated && aq_not_heated ? "oil and aqueous phases" : oil_not_heated ? "oil phase" : "aqueous phase"} to 70–80 °C before mixing.`);
  else if (temp_diff > 5)
    feedback.push("Temperature mismatch between phases may cause separation — keep both at 70–80 °C.");

  // Stirring — "never stirred" vs "stirred too briefly".
  if (input.mixing_time === 0)
    feedback.push("You did not stir the mixture. Stir continuously for at least 30 s to emulsify.");
  else if (input.mixing_time < 30)
    feedback.push("Increase mixing time to at least 30 s for full emulsification.");

  if (predicted_pH > 7)
    feedback.push("High pH detected. Reduce potassium hydroxide quantity.");
  if (ingredient_score < 3)
    feedback.push("Ingredient proportions are outside acceptable ranges.");

  // Cooling — only mention it once the emulsion stage is reached; distinguish
  // "not cooled at all" from "not cooled far enough".
  if (cooling_score < 1) {
    if (input.cooling_temperature > 50)
      feedback.push("The cream was not cooled. Cool it below 40 °C in the ice bath while stirring.");
    else
      feedback.push("Cool below 40 °C with continuous stirring for best texture.");
  }

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
  // "none" = phases never combined (step not performed).
  mixing_order: "aqueous_to_oil" | "oil_to_aqueous" | "none";
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
  // 0 s of stirring earns nothing — only a partial attempt (<20 s) earns half.
  const time_score  = input.mixing_time >= 20 ? 1 : input.mixing_time > 0 ? 0.5 : 0;
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

  // Two distinct procedural situations (see vanishing-cream engine for rationale):
  //   • not_combined — phases never combined; incomplete attempt, keeps partial marks.
  //   • wrong_order  — combined in reverse, forms a vanishing cream (O/W) → scores zero.
  const not_combined = input.mixing_order === "none";
  const wrong_order  = input.mixing_order === "oil_to_aqueous";
  if (wrong_order) {
    final_score_out = 0;
    result = "FAIL";
    stability = "separation";
    appearance = "Vanishing cream (O/W) formed — not cold cream";
  } else if (not_combined) {
    result = "FAIL";
    stability = "separation";
    appearance = "Phases not combined — no emulsion formed";
  }

  const feedback: string[] = [];
  if (not_combined)
    feedback.push("The two phases were never combined, so no emulsion formed. Pour the oil phase into the main beaker, then add the aqueous (borax+water) phase INTO it and stir. (Partial marks given for the steps you completed.)");
  else if (wrong_order)
    feedback.push("Cold cream NOT formed — the phases were combined in the wrong order, producing a vanishing cream (O/W emulsion) instead. Add the aqueous (borax+water) phase INTO the oil phase. Score: 0.");

  const oil_not_heated = input.oil_phase_temperature <= 30;
  const aq_not_heated  = input.aqueous_phase_temperature <= 30;
  if (oil_not_heated || aq_not_heated)
    feedback.push(`You did not heat the ${oil_not_heated && aq_not_heated ? "oil and aqueous phases" : oil_not_heated ? "oil phase" : "aqueous phase"} to 65–75 °C before mixing.`);
  else if (temp_diff > 5)
    feedback.push("Temperature mismatch between phases — keep both at 65–75 °C.");

  if (input.mixing_time === 0)
    feedback.push("You did not stir the mixture. Stir continuously for at least 20 s to emulsify.");
  else if (input.mixing_time < 20)
    feedback.push("Increase stirring time to at least 20 s for full emulsification.");

  if (predicted_pH > 7.5)
    feedback.push("pH too high — reduce borax quantity.");
  if (beeswax_pct < 10 || beeswax_pct > 16)
    feedback.push("Beeswax proportion out of range (target 10–16%).");
  if (paraffin_pct < 34 || paraffin_pct > 46)
    feedback.push("Liquid paraffin proportion out of range (target 34–46%).");

  if (cooling_score < 1) {
    if (input.cooling_temperature > 45)
      feedback.push("The cream was not cooled. Cool it to ≤35 °C in the ice bath while stirring.");
    else
      feedback.push("Cool to ≤35 °C with continuous stirring for best cold cream texture.");
  }

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
