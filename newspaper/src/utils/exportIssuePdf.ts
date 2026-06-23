import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const PAGE_SELECTOR = '.page-layout, .cover-page';

const waitForImages = async (root: HTMLElement) => {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    }),
  );
};

const capturePageElement = async (element: HTMLElement): Promise<string> => {
  await waitForImages(element);
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });
  return canvas.toDataURL('image/jpeg', 0.92);
};

export async function exportPagesToPdf(
  getPageElement: () => HTMLElement | null,
  pageCount: number,
  onPageChange: (pageIndex: number) => void,
): Promise<jsPDF> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pageCount; i += 1) {
    onPageChange(i);
    await new Promise((resolve) => setTimeout(resolve, 350));

    const element = getPageElement();
    if (!element) {
      throw new Error(`Не удалось отрендерить страницу ${i + 1}`);
    }

    const imgData = await capturePageElement(element);
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  }

  return pdf;
}

export function findLayoutPageElement(root: ParentNode | null): HTMLElement | null {
  if (!root) return null;
  return root.querySelector(PAGE_SELECTOR) as HTMLElement | null;
}
