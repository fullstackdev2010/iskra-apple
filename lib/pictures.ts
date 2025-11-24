// lib/pictures.ts
import { API_HOST } from '../lib/constants';

export function getProfileUriByFileName(fileName: string): string {
  return `${API_HOST}/managers/${encodeURIComponent(fileName)}`;
}

