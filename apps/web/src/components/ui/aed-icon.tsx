import { forwardRef, createElement, Fragment, type ReactElement } from 'react';
import { IconBase, type Icon, type IconWeight } from '@phosphor-icons/react';

/**
 * The defibrillator sign people know from station and mall walls (ILCOR): a heart with a
 * lightning bolt through it. Drawn on Phosphor's 256 grid so it sits beside the other icons.
 */
const HEART_OUTLINE = 'M178,40c-20.65,0-38.73,8.88-50,23.89C116.73,48.88,98.65,40,78,40a62.07,62.07,0,0,0-62,62c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,228.66,240,172,240,102A62.07,62.07,0,0,0,178,40ZM128,214.8C109.74,204.16,32,155.69,32,102A46.06,46.06,0,0,1,78,56c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,155.61,146.24,204.15,128,214.8Z';
const HEART_BOLD = 'M178,36c-20.09,0-37.92,7.93-50,21.56C115.92,43.93,98.09,36,78,36a66.08,66.08,0,0,0-66,66c0,72.34,105.81,130.14,110.31,132.57a12,12,0,0,0,11.38,0C138.19,232.14,244,174.34,244,102A66.08,66.08,0,0,0,178,36Zm-5.49,142.36A328.69,328.69,0,0,1,128,210.16a328.69,328.69,0,0,1-44.51-31.8C61.82,159.77,36,131.42,36,102A42,42,0,0,1,78,60c17.8,0,32.7,9.4,38.89,24.54a12,12,0,0,0,22.22,0C145.3,69.4,160.2,60,178,60a42,42,0,0,1,42,42C220,131.42,194.18,159.77,172.51,178.36Z';
const HEART_FILL = 'M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z';
export const AED_BOLT = 'M151,74 L96,150 H127 L112,198 L168,120 H137 Z';

const path = (d: string, extra?: Record<string, string>) => createElement('path', { d, ...extra });
const outline = createElement(Fragment, null, path(HEART_OUTLINE), path(AED_BOLT));
const weights = new Map<IconWeight, ReactElement>([
  ['thin', outline],
  ['light', outline],
  ['regular', outline],
  ['bold', createElement(Fragment, null, path(HEART_BOLD), path(AED_BOLT))],
  ['duotone', createElement(Fragment, null, path(HEART_FILL, { opacity: '0.2' }), path(HEART_OUTLINE), path(AED_BOLT))],
  // Solid heart with the bolt cut out of it.
  ['fill', path(`${HEART_FILL} ${AED_BOLT}`, { fillRule: 'evenodd' })],
]);

export const Defibrillator = forwardRef((props, ref) => createElement(IconBase, { ref, ...props, weights })) as Icon;
(Defibrillator as { displayName?: string }).displayName = 'Defibrillator';
export const DEFIB_HEART_FILL = HEART_FILL;
