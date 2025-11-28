// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname, {
  isCSSEnabled: true,
});
const path = require('path');

module.exports = withNativeWind(config, { input: "./global.css" });

