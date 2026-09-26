// Expo's defaults already understand the pnpm workspace (watch folders, symlinked packages).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Local database migrations are .sql files, inlined by babel (see babel.config.js).
config.resolver.sourceExts.push('sql');

module.exports = config;
