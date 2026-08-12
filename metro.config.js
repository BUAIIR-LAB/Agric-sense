const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Required for expo-sqlite web support (wa-sqlite.wasm)
config.resolver.assetExts.push('wasm');

module.exports = config;
