/**
 * Phone number formatting and validation utilities
 */

/**
 * Format phone number to standard format (e.g., 0701234567 -> 0701 234 567)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Format based on length
  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 6) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  } else if (digits.length <= 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  } else {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
}

/**
 * Validate phone number format (Ugandan format: 10 digits starting with 0)
 */
export function validatePhoneNumber(phone: string): { isValid: boolean; error?: string } {
  const digits = phone.replace(/\D/g, '');
  
  if (!digits) {
    return { isValid: false, error: 'Phone number is required' };
  }
  
  if (digits.length < 10) {
    return { isValid: false, error: 'Phone number must be at least 10 digits' };
  }
  
  if (digits.length > 10) {
    return { isValid: false, error: 'Phone number must be exactly 10 digits' };
  }
  
  if (!digits.startsWith('0')) {
    return { isValid: false, error: 'Phone number must start with 0' };
  }
  
  // Check if it's a valid Ugandan mobile prefix
  const validPrefixes = ['070', '071', '072', '073', '074', '075', '076', '077', '078', '079'];
  const prefix = digits.slice(0, 3);
  
  if (!validPrefixes.includes(prefix)) {
    return { isValid: false, error: 'Invalid phone number prefix' };
  }
  
  return { isValid: true };
}

/**
 * Sanitize phone number (remove all non-digit characters)
 */
export function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

