import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { LOGO_DATA_URI } from './logoDataUri';
import { locale, t } from './i18n';

export interface CertificatePdf {
  holder: string;
  badgeLabel: string;
  number: string;
  score: number;
  issuedAt: string;
  expiresAt: string;
  qr: string; // data URI from the API
  verifyUrl: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

/** A4 landscape certificate in the app's colours, named after its number, opened in the share sheet. */
export async function shareCertificatePdf(c: CertificatePdf) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; margin: 0; }
    body { width: 297mm; height: 210mm; padding: 14mm; background: #F7F5F0; font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #10201E; }
    .card { height: 100%; border: 2px solid #0E8B7F; border-radius: 18px; background: #fff; padding: 14mm 18mm; display: flex; flex-direction: column; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand img { width: 44px; height: 44px; border-radius: 10px; }
    .brand b { font-size: 20px; letter-spacing: 3px; color: #0C5D57; }
    .brand span { display: block; font-size: 11px; color: #5F6F6C; letter-spacing: 0.5px; }
    .main { flex: 1; display: flex; flex-direction: column; justify-content: center; text-align: center; }
    .kicker { font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #0E8B7F; }
    .lead { margin-top: 16px; font-size: 15px; color: #5F6F6C; }
    .holder { margin-top: 6px; font-size: 40px; font-weight: 800; letter-spacing: -0.5px; }
    .course { margin-top: 6px; font-size: 26px; font-weight: 800; color: #0C5D57; }
    .foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
    .facts { display: flex; gap: 32px; }
    .facts div span { display: block; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #5F6F6C; }
    .facts div b { display: block; margin-top: 3px; font-size: 14px; }
    .verify { text-align: center; }
    .verify img { width: 104px; height: 104px; }
    .verify span { display: block; font-size: 10px; color: #5F6F6C; margin-top: 2px; }
    .note { margin-top: 10px; font-size: 9px; color: #8A9794; text-align: center; }
  </style></head><body><div class="card">
    <div class="brand"><img src="${LOGO_DATA_URI}"/><div><b>VITALIS</b><span>${esc(t('First aid training'))}</span></div></div>
    <div class="main">
      <div class="kicker">${esc(t('Certificate of completion'))}</div>
      <div class="lead">${esc(t('This certifies that'))}</div>
      <div class="holder">${esc(c.holder)}</div>
      <div class="lead">${esc(t('has completed'))}</div>
      <div class="course">${esc(c.badgeLabel)}</div>
      <div class="lead">${esc(t('with a score of {n}%', { n: c.score }))}</div>
    </div>
    <div class="foot">
      <div class="facts">
        <div><span>${esc(t('Certificate number'))}</span><b>${esc(c.number)}</b></div>
        <div><span>${esc(t('Issued'))}</span><b>${esc(day(c.issuedAt))}</b></div>
        <div><span>${esc(t('Valid until'))}</span><b>${esc(day(c.expiresAt))}</b></div>
      </div>
      <div class="verify"><img src="${c.qr}"/><span>${esc(t('Scan to verify'))}</span><span>${esc(c.verifyUrl)}</span></div>
    </div>
    <div class="note">${esc(t('Based on Red Cross / ERC guidelines. Educational use only — not a substitute for in-person certified training.'))}</div>
  </div></body></html>`;

  const { uri } = await Print.printToFileAsync({ html, width: 842, height: 595 }); // A4 landscape, points
  // A readable file name in the share sheet and wherever it is saved.
  const named = new File(Paths.cache, `Vitalis ${c.number}.pdf`);
  if (named.exists) named.delete();
  await new File(uri).move(named);
  await Sharing.shareAsync(named.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: c.badgeLabel });
}
