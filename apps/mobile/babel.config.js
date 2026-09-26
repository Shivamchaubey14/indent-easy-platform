// babel-preset-expo also adds the Reanimated worklets plugin. inline-import turns the local
// database's .sql migrations into strings (drizzle-kit writes them for the expo driver).
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
