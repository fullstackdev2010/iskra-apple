// lib/authUtils.ts
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

export async function hashPin(input: string): Promise<string> {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

export async function verifyPin(input: string): Promise<boolean> {
  const hashedInput = await hashPin(input);
  const stored = await SecureStore.getItemAsync('pin_hash');
  return stored === hashedInput;
}

export async function isPinSet(): Promise<boolean> {
  const pin = await SecureStore.getItemAsync('pin_hash');
  return !!pin;
}
