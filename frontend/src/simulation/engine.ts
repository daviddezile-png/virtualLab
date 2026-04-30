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
  const final_score =
    ingredient_score * 2 +
    temperature_score * 2 +
    emulsification_score * 3 +
    cooling_score * 1 +
    pH_score * 1 +
    viscosity_score * 1;

  // Step 9 — Result
  let result: "PASS" | "AVERAGE" | "FAIL";
  if (final_score >= 8 && stability === "stable") {
    result = "PASS";
  } else if (final_score >= 5) {
    result = "AVERAGE";
  } else {
    result = "FAIL";
  }

  // Step 10 — Appearance
  const appearance =
    result === "PASS"
      ? "Smooth white cream"
      : result === "AVERAGE"
      ? "Slightly unstable or dull cream"
      : "Phase separation or grainy texture";

  // Step 11 — Feedback
  const feedback: string[] = [];
  if (temp_diff > 5)
    feedback.push("Temperature mismatch between phases may cause separation.");
  if (input.mixing_order !== "aqueous_to_oil")
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
