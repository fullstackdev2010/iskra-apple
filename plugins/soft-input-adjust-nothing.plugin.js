// plugins/soft-input-adjust-nothing.plugin.js
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAdjustNothing(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (!app) return cfg;
    const activity = app.activity?.find((a) => a.$['android:name'] === '.MainActivity');
    if (!activity) return cfg;
    activity.$['android:windowSoftInputMode'] = 'adjustNothing';
    return cfg;
  });
};
