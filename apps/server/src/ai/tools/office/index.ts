/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
export type {
  OfficeEdit,
  DocxStructure,
  XlsxStructure,
  PptxStructure,
  PdfStructure,
  PdfTextResult,
  PdfFormField,
  PdfContentItem,
  PdfTextOverlay,
} from './types'
export { OOXML_NS, detectNamespaces } from './namespaces'
export {
  resolveOfficeFile,
  listZipEntries,
  readZipEntryText,
  readZipEntryBuffer,
  readZipEntries,
  editZip,
  createZip,
} from './streamingZip'
export { applyXmlEdits, xpathReplace } from './xpathEditor'
export {
  parseDocxStructure,
  parseXlsxStructure,
  parsePptxStructure,
} from './structureParser'
export {
  parsePdfStructure,
  extractPdfText,
  extractPdfFormFields,
  createPdf,
  fillPdfForm,
  mergePdfs,
  addTextOverlays,
} from './pdfEngine'
