import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
// Firebase is used only when VITE_USE_FIREBASE=true. Otherwise the app runs in test-login mode (any phone + OTP 123456).
export const firebaseEnabled = !!import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_USE_FIREBASE === 'true';
const app = firebaseEnabled ? initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID,
}) : null;
const fbAuth = app ? getAuth(app) : null;
let confirmation: ConfirmationResult | null = null;
let verifier: RecaptchaVerifier | null = null;
export async function sendOtp(phone: string, containerId: string) {
  if (!fbAuth) throw new Error('Firebase is not configured');
  verifier ??= new RecaptchaVerifier(fbAuth, containerId, { size: 'invisible' });
  confirmation = await signInWithPhoneNumber(fbAuth, phone, verifier);
}
export async function confirmOtp(code: string) {
  if (!confirmation) throw new Error('Request an OTP first');
  const cred = await confirmation.confirm(code);
  return cred.user.getIdToken();
}
