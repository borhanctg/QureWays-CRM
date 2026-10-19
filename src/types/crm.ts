export type StaffRole =
  | 'CRM Administrator'
  | 'Patient Relationship Manager'
  | 'Medical Report Coordinator'
  | 'Hospital Coordination Officer'
  | 'Travel and Visa Coordinator'
  | 'Authorized Management Staff'
  | 'Patient';

export type ModuleId =
  | 'dashboard'
  | 'leads'
  | 'patients'
  | 'documents'
  | 'ai-assistant'
  | 'second-opinions'
  | 'cost-estimator'
  | 'services-bookings'
  | 'appointments'
  | 'visa-travel'
  | 'follow-ups'
  | 'communications'
  | 'hospitals'
  | 'analytics'
  | 'staff-permissions'
  | 'settings'
  | 'patient-portal';

export const LEAD_PIPELINE_STAGES = [
  'New Inquiry',
  'Contact Attempted',
  'Contacted',
  'Information Requested',
  'Documents Received',
  'AI Report in Preparation',
  'Hospital Opinion Requested',
  'Opinion Received',
  'Estimate Shared',
  'Consultation Scheduled',
  'Treatment Planning',
  'Travel Preparation',
  'Converted to Patient',
  'Completed',
  'Lost',
  'On Hold',
] as const;

export const LEAD_SOURCES = [
  'Website Contact Form',
  'Facebook Page',
  'WhatsApp Business',
  'Google Business Profile',
  'Phone Call',
  'Email Inquiry',
  'Staff-Created Record',
  'Hospital / Doctor Referral',
] as const;

export const TREATMENT_CATEGORIES = [
  'Cardiology & Cardiothoracic Surgery',
  'Medical & Surgical Oncology',
  'Hepatobiliary & Liver Transplant',
  'Orthopedics & Joint Replacement',
  'Neurosurgery & Neurology',
  'Nephrology & Renal Transplant',
  'Gastroenterology',
  'Spine Surgery',
  'Fertility & Reproductive Medicine',
  'Comprehensive Health Check & Diagnostics',
] as const;

export const VERIFIED_HOSPITALS = [
  'Apollo Hospitals, Greams Road, Chennai, India',
  'Apollo Proton Cancer Centre, Chennai, India',
  'Apollo Children’s Hospitals, Chennai, India',
  'Apollo Specialty Hospitals, Vanagaram, Chennai, India',
  'Indraprastha Apollo Hospitals, New Delhi, India',
  'Apollo Hospitals, Bannerghatta Road, Bengaluru, India',
  'Bumrungrad International Hospital, Bangkok, Thailand',
] as const;

export const DOCUMENT_CATEGORIES = [
  'Prescriptions',
  'Discharge summaries',
  'Laboratory reports',
  'Blood test results',
  'Imaging reports',
  'Referral letters',
  'Previous medical opinions',
  'Hospital correspondence',
  'Other relevant clinical documents',
] as const;

export const SECOND_OPINION_STAGES = [
  'Prepare Documents',
  'Patient Consent Verified',
  'Documents Submitted',
  'Hospital Acknowledgment',
  'Opinion Pending',
  'Follow-up Due',
  'Opinion Received',
  'Authenticity Checked',
  'Shared With Patient',
  'Consultation Planning',
] as const;

export const SERVICE_STATUSES = [
  'Requested',
  'Information Required',
  'In Progress',
  'Awaiting External Confirmation',
  'Confirmed',
  'Completed',
  'Cancelled',
  'On Hold',
] as const;

export const PATIENT_JOURNEY_STAGES = [
  {
    id: 'Documents Collected',
    label: 'Documents Collected',
    description: 'Clinical reports, prescriptions & passport uploaded',
    aliases: ['Medical Documents Collection', 'Documents Collected'],
  },
  {
    id: 'AI Report Reviewed',
    label: 'AI Report Reviewed',
    description: '15-section preliminary summary human-verified',
    aliases: ['AI Preliminary Report Review', 'AI Report Reviewed'],
  },
  {
    id: 'Second Opinion Received',
    label: 'Second Opinion Received',
    description: 'Hospital specialist opinion & cost estimate received',
    aliases: ['Hospital Second Opinion & Estimate Review', 'Second Opinion Received'],
  },
  {
    id: 'Visa Approved',
    label: 'Visa Approved',
    description: 'Med-1/Med-2 invitation letter & visa clearance',
    aliases: ['Visa & Travel Preparation', 'Visa Approved'],
  },
  {
    id: 'Trip Confirmed',
    label: 'Trip Confirmed',
    description: 'Flights, airport pickup & hospital admission confirmed',
    aliases: ['Trip Confirmed', 'Treatment & Post-Care Follow-up'],
  },
] as const;

export const MANDATORY_MEDICAL_DISCLAIMER =
  'This report is an AI-assisted informational summary based on the medical documents and information provided. It is not a definitive diagnosis, a substitute for an examination by a qualified medical professional, or a guarantee of treatment suitability or outcome. All clinical interpretations and treatment decisions must be reviewed and confirmed by an appropriately qualified healthcare professional. Medical records may be incomplete or inaccurate. Do not delay urgent medical care while awaiting this report.';

export interface UserProfileRecord {
  id?: string;
  uid: string;
  email: string;
  displayName: string;
  role: StaffRole;
  department?: string;
  phone?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadRecord {
  id: string;
  leadCode: string;
  patientName: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  country: string;
  city: string;
  preferredLanguage: string;
  inquiryDate: string;
  leadSource: string;
  campaignSource?: string;
  interestedTreatment: string;
  preferredHospital: string;
  preferredCountry?: string;
  needsDescription?: string;
  assignedStaffName: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  nextFollowUpDate?: string;
  status: string;
  lostReason?: string;
  consentGiven: boolean;
  privacyPreferences?: string;
  convertedPatientId?: string;
  internalNotes?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientRecord {
  id: string;
  patientCode: string;
  fullName: string;
  age: number;
  gender: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  country: string;
  city: string;
  passportNumber?: string;
  preferredLanguage: string;
  preferredChannel?: string;
  emergencyContact?: string;
  medicalHistorySummary?: string;
  existingDiagnoses?: string;
  reportedSymptoms?: string;
  previousTreatments?: string;
  treatmentRequirements?: string;
  preferredHospital: string;
  preferredDestination: string;
  assignedCoordinatorName: string;
  journeyStage: string;
  dataProcessingConsent: boolean;
  marketingConsent: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicalDocumentRecord {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  category: string;
  fileName: string;
  fileType: string;
  fileSizeKb: number;
  version: number;
  extractedText: string;
  reviewStatus: string;
  reviewerNotes?: string;
  uploadedByName: string;
  retentionPolicy?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiMedicalReportRecord {
  id: string;
  patientId: string;
  patientName: string;
  age?: number;
  gender?: string;
  preferredHospital: string;
  preferredDestination?: string;
  currencyPreference?: string;
  sourceDocumentsSummary: string;
  documentedHistorySummary: string;
  reportedSymptomsAndFindings: string;
  currentDocumentedStatus: string;
  missingInformation: string;
  questionsForDoctor: string;
  recommendedSpecialty: string;
  secondOpinionWorkflow?: string;
  potentialTreatmentPathways: string;
  suggestedNextSteps: string;
  estimatedBudgetRange?: string;
  travelConsiderations?: string;
  emergencyWarningDetected?: boolean;
  emergencyWarningText?: string;
  disclaimer: string;
  reviewStatus: string;
  modelVersion: string;
  reviewerName?: string;
  reviewNotes?: string;
  sharedWithPatient: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface HospitalSecondOpinionRecord {
  id: string;
  patientId: string;
  patientName: string;
  specialty: string;
  hospitalName: string;
  department: string;
  doctorName: string;
  submittedDocuments?: string;
  submissionDate: string;
  hospitalReferenceNumber: string;
  assignedCoordinatorName: string;
  followUpDate?: string;
  status: string;
  quotedFeeUsd?: number;
  expectedResponseDate?: string;
  receivedOpinionSummary?: string;
  documentedRecommendations?: string;
  originalDocumentTitle?: string;
  issuingInstitution?: string;
  documentIssuedDate?: string;
  verificationStatus: string;
  estimatedCostInr?: number;
  estimatedCostUsd?: number;
  estimatedTimeline?: string;
  clinicianDiscussionPoints?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentCostEstimateRecord {
  id: string;
  patientId: string;
  patientName: string;
  destinationCity: string;
  hospitalName: string;
  specialty: string;
  treatmentTitle: string;
  patientCount: number;
  companionCount: number;
  lengthOfStayDays: number;
  accommodationCategory?: string;
  currency: string;
  exchangeRateBdtPerUsd?: number;
  exchangeRateInrPerUsd?: number;
  exchangeRateTimestamp?: string;
  exchangeRateSource?: string;
  hospitalConfirmedTotalUsd?: number;
  estimatedTravelTotalUsd?: number;
  estimatedAccommodationTotalUsd?: number;
  coordinationAndOtherTotalUsd?: number;
  minTotalBudgetUsd: number;
  maxTotalBudgetUsd: number;
  lineItemsSummary?: string;
  assumptions?: string;
  exclusions?: string;
  validityPeriodDays?: number;
  quotationSource: string;
  status: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceBookingRecord {
  id: string;
  patientId: string;
  patientName: string;
  serviceCategory: string;
  serviceName: string;
  hospitalOrProvider: string;
  doctorName?: string;
  scheduledDate: string;
  scheduledTime?: string;
  serviceFeeUsd?: number;
  processingTimeEstimate?: string;
  status: string;
  assignedCoordinatorName: string;
  visaPassportRef?: string;
  flightDetails?: string;
  accommodationDetails?: string;
  notes?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpTaskRecord {
  id: string;
  title: string;
  description?: string;
  relatedType: string;
  relatedId: string;
  relatedName: string;
  assignedToName: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  dueDate: string;
  reminderTime?: string;
  status: 'Pending' | 'In Progress' | 'Overdue' | 'Completed';
  automationTrigger?: string;
  escalationRule?: string;
  internalNotes?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationRecordItem {
  id: string;
  recipientType: string;
  recipientId: string;
  recipientName: string;
  channel: string;
  direction: 'Inbound' | 'Outbound';
  subject?: string;
  messageSummary: string;
  staffOrAutomationName: string;
  deliveryStatus: string;
  consentVerified: boolean;
  optOutStatus: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface HospitalDirectoryRecord {
  id: string;
  name: string;
  city: string;
  country: string;
  accreditation: string;
  keySpecialties: string;
  leadDoctors: string;
  internationalDeskContact: string;
  averageOpinionTurnaroundHours: number;
  verifiedPartner: boolean;
  notes?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRecord {
  id: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  targetId: string;
  targetName: string;
  details: string;
  createdAt: string;
}

export const ROLE_MODULE_ACCESS: Record<StaffRole, ModuleId[]> = {
  'CRM Administrator': [
    'dashboard',
    'leads',
    'patients',
    'documents',
    'ai-assistant',
    'second-opinions',
    'cost-estimator',
    'services-bookings',
    'appointments',
    'visa-travel',
    'follow-ups',
    'communications',
    'hospitals',
    'analytics',
    'staff-permissions',
    'settings',
    'patient-portal',
  ],
  'Patient Relationship Manager': [
    'dashboard',
    'leads',
    'patients',
    'documents',
    'cost-estimator',
    'services-bookings',
    'appointments',
    'follow-ups',
    'communications',
    'hospitals',
    'patient-portal',
  ],
  'Medical Report Coordinator': [
    'dashboard',
    'patients',
    'documents',
    'ai-assistant',
    'second-opinions',
    'follow-ups',
    'hospitals',
  ],
  'Hospital Coordination Officer': [
    'dashboard',
    'patients',
    'documents',
    'ai-assistant',
    'second-opinions',
    'cost-estimator',
    'appointments',
    'hospitals',
    'communications',
  ],
  'Travel and Visa Coordinator': [
    'dashboard',
    'patients',
    'services-bookings',
    'appointments',
    'visa-travel',
    'follow-ups',
    'communications',
  ],
  'Authorized Management Staff': [
    'dashboard',
    'leads',
    'patients',
    'second-opinions',
    'cost-estimator',
    'analytics',
    'hospitals',
    'staff-permissions',
  ],
  Patient: ['patient-portal'],
};
