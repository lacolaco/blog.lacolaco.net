export function urlize(value: string): string {
  return value.toLowerCase().replace(/ /g, '-');
}
