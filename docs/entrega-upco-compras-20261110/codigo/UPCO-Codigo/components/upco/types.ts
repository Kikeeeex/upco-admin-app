export type Vendor = {
  id: string;
  code?: string;
  rif: string;
  name: string;
  address: string;
  taxpayerType: 'especial' | 'ordinario' | 'formal';
  personType: 'natural' | 'juridica';
  residency: 'residente' | 'domiciliada' | 'no_residente' | 'no_domiciliada';
  ivaRetentionRate: 0 | 75 | 100;
  usesFiscalMachine?: boolean;
  fiscalMachineNumbers?: string[];
  email?: string;
  phone?: string;
  active: boolean;
  needsReview?: boolean;
  importConfidence?: string;
  importReview?: string;
  sourceDate?: string;
  sourcePdf?: string;
};

export type PurchaseDocument = {
  id: string;
  type: 'factura' | 'nota_credito' | 'nota_debito';
  vendorId: string;
  issuedAt: string;
  eventAt: string;
  period: string;
  half: 1 | 2;
  periodOverrideReason?: string;
  number: string;
  controlNumber: string;
  affectedDocumentId?: string | null;
  exempt: number;
  base16: number;
  base8: number;
  ivaRetentionRate: 0 | 75 | 100;
  ivaRetentionReason?: string;
  igtfApplies: boolean;
  igtfBase: number;
  igtfAmount?: number;
  islrApplies: boolean;
  islrConceptCode?: string;
  islrBase: number;
  islrManual?: boolean;
  islrManualReason?: string;
  islrRate?: number;
  islrSubtraction?: number;
  islrAmount?: number;
  ceco?: string;
  cecoAllocations: { cecoId: number; percentage: number }[];
  paymentAccountId: number | null;
  description: string;
  status: 'draft' | 'issued' | 'void';
  iva16?: number;
  iva8?: number;
  subtotal?: number;
  total?: number;
  ivaRetentionAmount?: number;
  ivaCertificateNumber?: string | null;
  islrCertificateNumber?: string | null;
  islrSubtract?: number;
  netPayable?: number;
  attachmentUrl?: string;
  attachmentName?: string | null;
  hasAttachment?: boolean;
  historicalImport?: boolean;
  updatedAt?: string;
};

export type CatalogItem = {
  id: number;
  code: string;
  name: string;
  active: boolean;
};

export type CertificateSequence = {
  period: string;
  nextNumber: number;
  suggestedNextNumber: number;
  configured: boolean;
};

export type IslrConcept = {
  code: string;
  description: string;
  beneficiary: string | null;
  ratePercent: number | null;
  taxableBasePercent: number | null;
  calculation: string;
  subtractionApplies: boolean;
};

export type Settings = {
  companyName: string;
  companyRif: string;
  companyAddress: string;
  unitTaxValue: number;
  unitTaxEffectiveAt: string;
  unitTaxHistory: { effectiveAt: string; value: number }[];
  ivaGeneralRate: number;
  ivaReducedRate: number;
  ivaLegalReference: string;
  islrLegalReference: string;
  conceptOverrides: Record<string, { ratePercent?: number; taxableBasePercent?: number; subtractionApplies?: boolean }>;
  islrConcepts: IslrConcept[];
  cecos: CatalogItem[];
  paymentAccounts: CatalogItem[];
  certificateSequences: { iva: CertificateSequence; islr: CertificateSequence };
};

export type Summary = {
  vendors: number;
  documents: number;
  period: string;
  half: number;
  invoiceTotal: number;
  ivaRetained: number;
  islrRetained: number;
};
