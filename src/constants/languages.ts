/**
 * Supported language display names (as stored in user profile).
 */
export const SUPPORTED_LANGUAGES = [
    'English',
    'Luganda',
    'Ateso',
    'Acholi',
    'Japadhola',
    'Runyankore',
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

/**
 * Maps a language display name to its BCP-47 / ISO 639 code
 * used by the chat and tips API endpoints (`target_lang` field).
 *
 * Always use this mapping — never send the raw display name to the API.
 */
export const languageToCode: Record<string, string> = {
    English: 'en',
    Luganda: 'lg',
    Ateso: 'at',
    Acholi: 'ac',
    Japadhola: 'jp',
    Runyankore: 'nyn',
};

/**
 * Converts a language display name to its API code.
 * Falls back to 'en' for any unknown language.
 */
export const getLanguageCode = (language: string | undefined | null): string =>
    languageToCode[language ?? ''] ?? 'en';
