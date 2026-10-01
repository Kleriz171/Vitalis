import QRCode from 'qrcode';

export const generateQR = (payload: object) =>
  QRCode.toDataURL(JSON.stringify(payload), { errorCorrectionLevel: 'M', margin: 1, width: 320 });

/** Plain-text QR for anything a phone camera should show as readable text (low density, no margin:
 *  the app frames it in its own white tile). */
export const generateTextQR = (text: string) =>
  QRCode.toDataURL(text, { errorCorrectionLevel: 'L', margin: 0, width: 320 });
