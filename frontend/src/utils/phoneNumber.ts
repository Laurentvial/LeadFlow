/**
 * Utility functions for phone number formatting
 * - Format phone numbers with spaces for display (e.g., "06 12 34 56 78")
 * - Remove spaces for storage (e.g., "0612345678")
 */

/**
 * Removes all spaces and whitespace from a phone number string
 * @param phoneNumber - The phone number string (may contain spaces)
 * @returns The phone number without any spaces or whitespace
 */
export function removePhoneSpaces(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) return '';
  // Convert to string if not already, trim first to remove leading/trailing whitespace, then remove all spaces
  const str = String(phoneNumber);
  // Remove all whitespace characters (spaces, tabs, newlines, etc.)
  return str.trim().replace(/\s+/g, '');
}

/**
 * Formats a phone number with spaces for DISPLAY ONLY
 * 
 * IMPORTANT: This function adds spaces ONLY for visual display.
 * The actual data stored in the database contains NO spaces (stored as integer).
 * When fetched from the API, phone numbers are returned as strings without spaces.
 * Spaces are added here purely for readability - they are NOT stored in the database.
 * 
 * French phone number format: XX XX XX XX XX (10 digits)
 * International format: +XX X XX XX XX XX (with country code)
 * 
 * @param phoneNumber - The phone number string (without spaces, e.g., "0612345678")
 * @returns The formatted phone number with spaces for display (e.g., "06 12 34 56 78")
 */
export function formatPhoneNumber(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) return '';
  
  // Remove all existing spaces first
  const cleaned = removePhoneSpaces(phoneNumber);
  
  if (!cleaned) return '';
  
  // Handle international format (starts with +)
  if (cleaned.startsWith('+')) {
    const withoutPlus = cleaned.substring(1);
    // Format: +XX X XX XX XX XX
    // For French numbers: +33 X XX XX XX XX
    if (withoutPlus.length >= 10) {
      // Country code (usually 1-3 digits) + number
      // Try to detect French format: +33 followed by 9 digits
      if (withoutPlus.startsWith('33') && withoutPlus.length === 11) {
        // +33 6 12 34 56 78
        return `+33 ${withoutPlus.substring(2, 3)} ${withoutPlus.substring(3, 5)} ${withoutPlus.substring(5, 7)} ${withoutPlus.substring(7, 9)} ${withoutPlus.substring(9)}`;
      }
      // Generic international format
      // Split after country code (assume 1-3 digits)
      const countryCodeLength = withoutPlus.length === 11 ? 2 : (withoutPlus.length === 12 ? 2 : 1);
      const countryCode = withoutPlus.substring(0, countryCodeLength);
      const number = withoutPlus.substring(countryCodeLength);
      // Format number part: X XX XX XX XX
      if (number.length === 9) {
        return `+${countryCode} ${number.substring(0, 1)} ${number.substring(1, 3)} ${number.substring(3, 5)} ${number.substring(5, 7)} ${number.substring(7)}`;
      }
    }
    // If we can't format properly, return with minimal spacing
    return cleaned;
  }
  
  // Handle French format (10 digits): XX XX XX XX XX
  if (cleaned.length === 10) {
    return `${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 6)} ${cleaned.substring(6, 8)} ${cleaned.substring(8)}`;
  }
  
  // Handle 9 digits (mobile without leading 0): X XX XX XX XX
  if (cleaned.length === 9) {
    return `${cleaned.substring(0, 1)} ${cleaned.substring(1, 3)} ${cleaned.substring(3, 5)} ${cleaned.substring(5, 7)} ${cleaned.substring(7)}`;
  }
  
  // Handle 8 digits: XX XX XX XX
  if (cleaned.length === 8) {
    return `${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 6)} ${cleaned.substring(6)}`;
  }
  
  // Handle 11 digits (might be international without +): try to format as XX XX XX XX XX X
  if (cleaned.length === 11 && !cleaned.startsWith('+')) {
    // Could be French number with country code: 33612345678 -> 33 6 12 34 56 78
    if (cleaned.startsWith('33')) {
      return `${cleaned.substring(0, 2)} ${cleaned.substring(2, 3)} ${cleaned.substring(3, 5)} ${cleaned.substring(5, 7)} ${cleaned.substring(7, 9)} ${cleaned.substring(9)}`;
    }
    // Generic 11 digits: format as XX XX XX XX XX X
    return `${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 6)} ${cleaned.substring(6, 8)} ${cleaned.substring(8, 10)} ${cleaned.substring(10)}`;
  }
  
  // For other lengths, try to format with spaces every 2 digits
  if (cleaned.length > 0 && cleaned.length <= 15) {
    // Format as pairs: XX XX XX XX...
    const parts: string[] = [];
    for (let i = 0; i < cleaned.length; i += 2) {
      if (i + 2 <= cleaned.length) {
        parts.push(cleaned.substring(i, i + 2));
      } else {
        parts.push(cleaned.substring(i));
      }
    }
    return parts.join(' ');
  }
  
  // For very long numbers or edge cases, return as-is
  return cleaned;
}

/**
 * Formats phone number as user types (auto-formatting)
 * Adds spaces automatically as the user types
 * @param value - The current input value
 * @returns The formatted value with spaces
 */
export function formatPhoneNumberAsYouType(value: string): string {
  if (!value) return '';
  
  // Remove all spaces first
  const cleaned = value.replace(/\s+/g, '');
  
  // Handle international format (starts with +)
  if (cleaned.startsWith('+')) {
    const withoutPlus = cleaned.substring(1);
    // Don't format until we have enough digits
    if (withoutPlus.length <= 2) {
      return `+${withoutPlus}`;
    }
    // Format: +XX X XX XX XX XX
    if (withoutPlus.length >= 3) {
      // French format: +33 X XX XX XX XX
      if (withoutPlus.startsWith('33') && withoutPlus.length <= 11) {
        const parts: string[] = ['+33'];
        if (withoutPlus.length > 2) parts.push(withoutPlus.substring(2, 3));
        if (withoutPlus.length > 3) parts.push(withoutPlus.substring(3, 5));
        if (withoutPlus.length > 5) parts.push(withoutPlus.substring(5, 7));
        if (withoutPlus.length > 7) parts.push(withoutPlus.substring(7, 9));
        if (withoutPlus.length > 9) parts.push(withoutPlus.substring(9));
        return parts.join(' ');
      }
      // Generic: +X X XX XX XX XX
      const countryCode = withoutPlus.substring(0, Math.min(2, withoutPlus.length));
      const number = withoutPlus.substring(countryCode.length);
      const parts: string[] = [`+${countryCode}`];
      if (number.length > 0) parts.push(number.substring(0, 1));
      if (number.length > 1) parts.push(number.substring(1, 3));
      if (number.length > 3) parts.push(number.substring(3, 5));
      if (number.length > 5) parts.push(number.substring(5, 7));
      if (number.length > 7) parts.push(number.substring(7, 9));
      return parts.join(' ');
    }
  }
  
  // Handle French format (10 digits): XX XX XX XX XX
  if (cleaned.length <= 10) {
    const parts: string[] = [];
    if (cleaned.length > 0) parts.push(cleaned.substring(0, 2));
    if (cleaned.length > 2) parts.push(cleaned.substring(2, 4));
    if (cleaned.length > 4) parts.push(cleaned.substring(4, 6));
    if (cleaned.length > 6) parts.push(cleaned.substring(6, 8));
    if (cleaned.length > 8) parts.push(cleaned.substring(8));
    return parts.join(' ');
  }
  
  // For longer numbers, return cleaned (no spaces)
  return cleaned;
}

