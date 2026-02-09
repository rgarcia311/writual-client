export const toTitleCase = (str: string) => {
  return str.replace(/\b\w/g, char => char.toUpperCase());
}