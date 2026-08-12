export function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (!password || password.trim().length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' };
  }
  return { isValid: true };
}
