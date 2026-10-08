import { invoke, isTauri } from '@tauri-apps/api/core';

/**
 * Opens the print dialog for the current page; the print styles (index.css) lay it out as a report.
 * The page title becomes the suggested PDF file name, e.g. "Vitalis report 2026-10-06".
 */
export const exportPdf = async (name: string) => {
  const title = document.title;
  document.title = `Vitalis ${name} ${new Date().toISOString().slice(0, 10)}`;
  const restore = () => { document.title = title; };
  window.addEventListener('afterprint', restore, { once: true });
  try {
    if (isTauri()) await invoke('print_page');
    else window.print();
  } finally {
    // Tauri's print does not always fire afterprint.
    setTimeout(restore, 3000);
  }
};
