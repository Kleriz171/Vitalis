const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
const nativewindRoot = path.dirname(require.resolve('nativewind/package.json'));

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  nativewind: nativewindRoot,
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
  'react-native-css-interop': path.resolve(__dirname, 'node_modules/react-native-css-interop'),
};

module.exports = withNativeWind(config, { input: './global.css' });
