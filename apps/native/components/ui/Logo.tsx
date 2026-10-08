import { Image } from 'react-native';

/** The Vitalis logo tile (brand/logo-tile.png, built by scripts/brand-assets.py). */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/logo.png')}
      style={{ width: size, height: size }}
      accessibilityIgnoresInvertColors
      accessible={false}
    />
  );
}
