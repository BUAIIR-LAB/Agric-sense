/**
 * Image caching and optimization utilities
 */

import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const CACHE_DIR = `${FileSystem.cacheDirectory}image-cache/`;
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedImage {
  uri: string;
  cachedUri: string;
  timestamp: number;
  size: number;
}

/**
 * Initialize cache directory
 */
export const initImageCache = async (): Promise<void> => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to initialize image cache:', error);
    }
  }
};

/**
 * Get cache key from URI
 */
const getCacheKey = (uri: string): string => {
  // Use a hash of the URI as the cache key
  let hash = 0;
  for (let i = 0; i < uri.length; i++) {
    const char = uri.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `img_${Math.abs(hash)}`;
};

/**
 * Check if image is cached and valid
 */
export const getCachedImage = async (uri: string): Promise<string | null> => {
  try {
    const cacheKey = getCacheKey(uri);
    const cachedPath = `${CACHE_DIR}${cacheKey}`;
    
    const fileInfo = await FileSystem.getInfoAsync(cachedPath);
    if (fileInfo.exists) {
      // Check if cache is still valid (not expired)
      const stat = await FileSystem.getInfoAsync(cachedPath);
      if (stat.exists && stat.modificationTime) {
        const age = Date.now() - stat.modificationTime * 1000;
        if (age < MAX_AGE) {
          return cachedPath;
        } else {
          // Remove expired cache
          await FileSystem.deleteAsync(cachedPath, { idempotent: true });
        }
      }
    }
    return null;
  } catch (error) {
    if (__DEV__) {
      console.error('Error checking cache:', error);
    }
    return null;
  }
};

/**
 * Cache an image
 */
export const cacheImage = async (uri: string): Promise<string | null> => {
  try {
    await initImageCache();
    
    const cachedUri = await getCachedImage(uri);
    if (cachedUri) {
      return cachedUri;
    }

    const cacheKey = getCacheKey(uri);
    const cachedPath = `${CACHE_DIR}${cacheKey}`;

    // Download and cache the image
    const downloadResult = await FileSystem.downloadAsync(uri, cachedPath);
    
    if (downloadResult.status === 200) {
      return downloadResult.uri;
    }
    
    return null;
  } catch (error) {
    if (__DEV__) {
      console.error('Error caching image:', error);
    }
    return null;
  }
};

/**
 * Optimize image URI for display
 * For local images, returns as-is
 * For remote images, attempts to cache
 */
export const optimizeImageUri = async (uri: string): Promise<string> => {
  // If it's already a local file, return as-is
  if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('/')) {
    return uri;
  }

  // Check cache first
  const cached = await getCachedImage(uri);
  if (cached) {
    return cached;
  }

  // Try to cache it
  const cachedUri = await cacheImage(uri);
  return cachedUri || uri; // Fallback to original if caching fails
};

/**
 * Clear old cache entries
 */
export const clearOldCache = async (): Promise<void> => {
  try {
    const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = `${CACHE_DIR}${file}`;
      const stat = await FileSystem.getInfoAsync(filePath);
      
      if (stat.exists && stat.modificationTime) {
        const age = now - stat.modificationTime * 1000;
        if (age > MAX_AGE) {
          await FileSystem.deleteAsync(filePath, { idempotent: true });
        }
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Error clearing old cache:', error);
    }
  }
};

/**
 * Get cache size
 */
export const getCacheSize = async (): Promise<number> => {
  try {
    const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
    let totalSize = 0;
    
    for (const file of files) {
      const filePath = `${CACHE_DIR}${file}`;
      const stat = await FileSystem.getInfoAsync(filePath);
      if (stat.exists && stat.size) {
        totalSize += stat.size;
      }
    }
    
    return totalSize;
  } catch (error) {
    if (__DEV__) {
      console.error('Error getting cache size:', error);
    }
    return 0;
  }
};

/**
 * Clear cache if it exceeds max size
 */
export const manageCacheSize = async (): Promise<void> => {
  try {
    const currentSize = await getCacheSize();
    
    if (currentSize > MAX_CACHE_SIZE) {
      // Sort files by modification time and delete oldest
      const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
      const fileStats = await Promise.all(
        files.map(async (file) => {
          const filePath = `${CACHE_DIR}${file}`;
          const stat = await FileSystem.getInfoAsync(filePath);
          return {
            path: filePath,
            modificationTime: stat.modificationTime || 0,
            size: stat.size || 0,
          };
        })
      );
      
      // Sort by modification time (oldest first)
      fileStats.sort((a, b) => a.modificationTime - b.modificationTime);
      
      // Delete oldest files until we're under the limit
      let sizeToDelete = currentSize - MAX_CACHE_SIZE;
      for (const fileStat of fileStats) {
        if (sizeToDelete <= 0) break;
        await FileSystem.deleteAsync(fileStat.path, { idempotent: true });
        sizeToDelete -= fileStat.size;
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Error managing cache size:', error);
    }
  }
};

/**
 * Clear all cache
 */
export const clearAllCache = async (): Promise<void> => {
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    await initImageCache();
  } catch (error) {
    if (__DEV__) {
      console.error('Error clearing all cache:', error);
    }
  }
};

