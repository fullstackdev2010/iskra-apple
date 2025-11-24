// lib/errorHandler.ts
import { Alert } from 'react-native';
import { NetworkUnavailableError } from './network';

/**
 * Centralized error handler with optional user override.
 * This is what the rest of the app should call.
 */
export function handleError(error: any, opts?: { userMessage?: string; context?: string }) {
  const context = opts?.context ?? 'Ошибка';

  // Known: custom network error
  if (error instanceof NetworkUnavailableError) {
    return Alert.alert(context, opts?.userMessage ?? error.message);
  }

  // Fallback: friendly translation flow
  return showFriendlyError(error, context);
}

/**
 * Display user-friendly error messages
 */
export function showFriendlyError(error: any, context: string = 'Ошибка') {
  const message = extractMessage(error);
  const userMessage = translateError(message);
  Alert.alert(context, userMessage);
}

/**
 * Extract raw error message from various sources
 */
function extractMessage(error: any): string {
  if (!error) return 'Неизвестная ошибка';

  if (typeof error === 'string') return error;

  if (error.message) return error.message;

  if (error.response?.data) return JSON.stringify(error.response.data);

  return JSON.stringify(error);
}

/**
 * Map known backend messages to user-friendly phrases
 */
function translateError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('403') && lower.includes('login failed'))
    return 'Доступ запрещён. Подписка приостановлена.';
  if (lower.includes('invalid credentials')) return 'Неверный логин или пароль.';
  if (lower.includes('login failed')) return 'Ошибка авторизации.';
  if (lower.includes('network error')) return 'Ошибка сети. Проверьте подключение.';
  if (lower.includes('timeout')) return 'Время ожидания истекло.';

  return message; // fallback to original
}
