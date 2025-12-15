/**
 * Input sanitization utilities
 */

/**
 * Sanitize text input to prevent XSS and injection attacks
 */
export function sanitizeText(input: string): string {
  if (!input) return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .slice(0, 10000); // Limit length
}

/**
 * Sanitize phone number input
 */
export function sanitizePhone(input: string): string {
  if (!input) return '';
  
  // Only allow digits, spaces, dashes, and plus sign
  return input.replace(/[^\d\s\-+]/g, '');
}

/**
 * Sanitize email input
 */
export function sanitizeEmail(input: string): string {
  if (!input) return '';
  
  return input
    .trim()
    .toLowerCase()
    .replace(/[<>]/g, '')
    .slice(0, 255);
}

/**
 * Sanitize general string input
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (!input) return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, maxLength);
}

