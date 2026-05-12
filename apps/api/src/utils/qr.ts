import QRCode from 'qrcode';

export const generateQR = (payload: object) =>
  QRCode.toDataURL(JSON.stringify(payload), { errorCorrectionLevel: 'M', margin: 1, width: 320 });
