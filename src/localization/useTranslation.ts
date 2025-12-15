import { useMemo } from 'react';
import { I18nManager } from 'react-native';

import { resources, type SupportedLocale } from './strings';

const DEFAULT_LOCALE: SupportedLocale = 'en';
type TranslationObject = typeof resources;

const resolveLocale = (input?: string): SupportedLocale => {
  if (!input) {
    return DEFAULT_LOCALE;
  }
  const normalized = input.toLowerCase();
  const directMatch = (Object.keys(resources) as SupportedLocale[]).find((locale) => locale === normalized);
  if (directMatch) {
    return directMatch;
  }
  const base = normalized.split('-')[0] as SupportedLocale;
  return (Object.prototype.hasOwnProperty.call(resources, base) ? base : DEFAULT_LOCALE) as SupportedLocale;
};

const getDeviceLocale = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return DEFAULT_LOCALE;
  }
};

const getNestedValue = (locale: SupportedLocale, key: string): string | undefined => {
  const segments = key.split('.');
  return segments.reduce<any>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in acc) {
      return acc[segment];
    }
    return undefined;
  }, resources[locale]);
};

const interpolate = (template: string, params?: Record<string, string | number>) => {
  if (!params) {
    return template;
  }
  return template.replace(/{{(.*?)}}/g, (_, raw) => {
    const key = raw.trim();
    const value = params[key];
    return value != null ? String(value) : '';
  });
};

const pluralKey = (base: string, count: number) => `${base}_${Math.abs(count) === 1 ? 'one' : 'other'}`;

export const useTranslation = () => {
  const locale = useMemo(() => resolveLocale(getDeviceLocale()), []);

  const t = useMemo(
    () =>
      (key: string, params?: Record<string, string | number>) => {
        const value = getNestedValue(locale, key);
        if (typeof value !== 'string') {
          console.warn(`Missing translation for key "${key}" in locale "${locale}"`);
          return key;
        }
        return interpolate(value, params);
      },
    [locale],
  );

  const tp = useMemo(
    () =>
      (key: string, count: number, params?: Record<string, string | number>) => {
        const pluralizedKey = pluralKey(key, count);
        const extendedParams = { ...params, count };
        return t(pluralizedKey, extendedParams);
      },
    [t],
  );

  const formatNumber = useMemo(
    () => (value: number) => {
      try {
        return new Intl.NumberFormat(locale).format(value);
      } catch {
        return String(value);
      }
    },
    [locale],
  );

  const formatDateTime = useMemo(
    () =>
      (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => {
        try {
          return new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
            ...options,
          }).format(new Date(value));
        } catch {
          return new Date(value).toLocaleString();
        }
      },
    [locale],
  );

  return {
    locale,
    isRTL: I18nManager.isRTL,
    t,
    tp,
    formatNumber,
    formatDateTime,
  };
};

