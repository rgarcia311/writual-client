export function calculateRoughTokenEstimate(text: string, tokensPerChar = 0.33): number {
  return Math.ceil(text.length * tokensPerChar);
}
