/**
 * 把渲染好的 DOM 节点生成为真实可下载的 PDF 文件。
 * 采用 html-to-image（同浏览器引擎栅格化，正确渲染 oklch 颜色并内联 KaTeX 字体）
 * + jsPDF 组装。支持：单节点 → 单文件；多节点 → 合并为一个多页文件。
 */
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

/** 节点 → PNG dataURL（2x 清晰度，白底） */
const nodeToPng = async (node: HTMLElement): Promise<string> => {
  return await toPng(node, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    cacheBust: true,
  });
};

const loadImg = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('栅格化图片加载失败'));
    img.src = dataUrl;
  });

/**
 * 把一个节点的图片按 A4 页面宽度适配并分页绘制到 pdf。
 * 返回更新后的"是否已开始绘制"标记（用于节点间是否 addPage）。
 */
const addNodePaginated = (
  pdf: jsPDF,
  dataUrl: string,
  img: HTMLImageElement,
  availW: number,
  availH: number,
  pageStarted: boolean,
): boolean => {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = availW / iw;
  const totalH = ih * scale;
  const pages = Math.max(1, Math.ceil((totalH - 0.5) / availH));
  for (let p = 0; p < pages; p++) {
    if (pageStarted) pdf.addPage();
    pageStarted = true;
    // 以整图高度绘制、向上偏移，利用 PDF 裁剪只显示当前页切片
    pdf.addImage(dataUrl, 'PNG', 0, -p * availH, availW, totalH, undefined, 'FAST');
  }
  return pageStarted;
};

const A4 = { unit: 'pt' as const, format: 'a4' as const };

/** 单个节点 → 单文件 PDF Blob */
export const elementToPdfBlob = async (node: HTMLElement): Promise<Blob> => {
  const pdf = new jsPDF(A4);
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const dataUrl = await nodeToPng(node);
  const img = await loadImg(dataUrl);
  addNodePaginated(pdf, dataUrl, img, pw - margin * 2, ph - margin * 2, false);
  return pdf.output('blob');
};

/** 多个节点 → 合并为一个多页 PDF Blob */
export const elementsToMergedPdfBlob = async (
  nodes: HTMLElement[],
): Promise<Blob> => {
  const pdf = new jsPDF(A4);
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const margin = 28;
  let started = false;
  for (const node of nodes) {
    const dataUrl = await nodeToPng(node);
    const img = await loadImg(dataUrl);
    started = addNodePaginated(
      pdf,
      dataUrl,
      img,
      pw - margin * 2,
      ph - margin * 2,
      started,
    );
  }
  return pdf.output('blob');
};
