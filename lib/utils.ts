// lib/utils.ts
export function stripHtmlTags(text: string): string {
  return text.replace(/<\/?[^>]+(>|$)/g, '').trim();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
