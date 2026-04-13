export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function standardize(values: number[]): number[] {
  if (values.length === 0) {
    return [];
  }

  const mean = average(values);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const deviation = Math.sqrt(variance);

  if (deviation === 0) {
    return values.map(() => 0);
  }

  return values.map((value) => (value - mean) / deviation);
}

export function logistic(value: number, scale = 150): number {
  return 1 / (1 + Math.exp(-value / scale));
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function normalize(weights: number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0) {
    const fallback = 1 / Math.max(1, weights.length);
    return weights.map(() => fallback);
  }

  return weights.map((weight) => weight / total);
}

export function pickIndexByWeight(weights: number[], randomValue = Math.random()): number {
  const normalized = normalize(weights);
  let cursor = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    cursor += normalized[index];
    if (randomValue <= cursor) {
      return index;
    }
  }

  return normalized.length - 1;
}
