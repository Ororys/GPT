/** Future extraction boundary. No provider, OCR or model runs in sprint 01. */
export interface DocumentRegion {
  page: number;
  /** Normalized page coordinates; omitted when an extractor cannot supply them. */
  bounds?: { x: number; y: number; width: number; height: number };
  sourceText: string;
}
export interface ExtractionCandidate {
  id: string;
  documentId: string;
  personId: string;
  region: DocumentRegion;
  originalValue: string;
  originalUnit: string | null;
  measuredAt: string | null;
  processedAt: string;
  extractionMethod: string;
  extractionVersion: string;
  /** Null until a reproducible calibration protocol is available. */
  confidence: number | null;
  calibrationVersion: string | null;
  validationStatus: 'proposed' | 'needs-review' | 'accepted' | 'rejected';
  replacesCandidateId: string | null;
}
export interface DocumentExtractor {
  readonly provider: string;
  readonly processingLocation: 'local' | 'external';
  extract(document: { privateObjectId: string; sha256: string }): Promise<ExtractionCandidate[]>;
}
