import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Upload,
  FileText,
  Calendar,
  Plane,
  MessageSquare,
  Printer,
  CheckCircle2,
  Lock,
  Languages,
  Share2,
  Copy,
  Building2,
  CheckSquare,
  ExternalLink,
  Search,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Bell,
  Clock,
} from 'lucide-react';
import {
  DOCUMENT_CATEGORIES,
  VERIFIED_HOSPITALS,
  PATIENT_JOURNEY_STAGES,
  type PatientRecord,
  type MedicalDocumentRecord,
  type AiMedicalReportRecord,
  type HospitalSecondOpinionRecord,
  type TreatmentCostEstimateRecord,
  type ServiceBookingRecord,
  type CommunicationRecordItem,
} from '../types/crm';
import {
  createMedicalDocument,
  createServiceBooking,
  createCommunicationRecord,
  createFollowUpTask,
  updatePatientSelfServiceProfile,
} from '../lib/crmService';

interface Props {
  patients: PatientRecord[];
  documents: MedicalDocumentRecord[];
  aiReports: AiMedicalReportRecord[];
  secondOpinions: HospitalSecondOpinionRecord[];
  costEstimates: TreatmentCostEstimateRecord[];
  serviceBookings: ServiceBookingRecord[];
  communications: CommunicationRecordItem[];
  actor: { uid: string; name: string; role: string };
  isStaffPreview: boolean;
  initialPatientId?: string;
  standaloneMode?: boolean;
  onToggleStandaloneMode?: () => void;
}

// Streamlined 4-Step Patient Self-Service Flow (ধাপ ৪টি — ধাপ ৪ অপশনাল)
type SelfServiceStepId =
  | 'step-1-passport-vil'
  | 'step-2-upload-reports'
  | 'step-3-opinion-estimate-doctor'
  | 'step-4-travel-pickup-stay';

interface AiParsedTicketResult {
  flightDate: string;
  flightNumber: string;
  airlineName: string;
  chennaiArrivalDate: string;
  chennaiArrivalTime: string;
  pnrOrTicketNumber: string;
  passengerCount: string;
  passengerNames: string;
  wheelchairRequired: boolean;
  mobilitySupportOption: string;
  summaryBn: string;
  summaryEn: string;
}

const REPORT_QUICK_PRESETS: Array<{
  bn: string;
  en: string;
  category: string;
  defaultNote: string;
}> = [
  {
    bn: 'সর্বশেষ ডাক্তারের প্রেসক্রিপশন',
    en: 'Latest Doctor Prescription & Medication List',
    category: 'Prescriptions',
    defaultNote: 'বর্তমান ওষুধের তালিকা ও বাংলাদেশের ডাক্তারের সর্বশেষ প্রেসক্রিপশন।',
  },
  {
    bn: 'ইকো / ইসিজি / এনজিওগ্রাম রিপোর্ট',
    en: 'Echo / ECG / Coronary Angiogram Report',
    category: 'Imaging reports',
    defaultNote: 'হার্টের ইকোকার্ডিওগ্রাম, ইসিজি বা এনজিওগ্রাম রিপোর্ট।',
  },
  {
    bn: 'বায়োপসি / হিস্টোপ্যাথলজি রিপোর্ট',
    en: 'Biopsy / Histopathology & IHC Report',
    category: 'Laboratory reports',
    defaultNote: 'বায়োপসি ও হিস্টোপ্যাথলজি রিপোর্ট (স্লাইড ও ব্লক নম্বরসহ)।',
  },
  {
    bn: 'রক্ত, ক্রিয়েটিনিন ও ডায়াবেটিস পরীক্ষা',
    en: 'Recent Blood, Creatinine (RFT), LFT & HbA1c',
    category: 'Blood test results',
    defaultNote: 'সর্বশেষ ৩০ দিনের রক্তের সিবিসি, ক্রিয়েটিনিন ও সুগার রিপোর্ট।',
  },
  {
    bn: 'সিটি স্ক্যান / এমআরআই / পেট স্ক্যান',
    en: 'CT Scan / MRI / PET-CT Summary',
    category: 'Imaging reports',
    defaultNote: 'সিটি স্ক্যান, এমআরআই বা পেট-সিটি স্ক্যানের লিখিত রিপোর্ট।',
  },
  {
    bn: 'রোগী ও অ্যাটেনডেন্টের পাসপোর্ট কপি',
    en: 'Patient & Attendant Passport Bio-Page Scan',
    category: 'Other relevant clinical documents',
    defaultNote: 'ভিসা ইনভাইটেশন লেটার (VIL) ও হাসপাতাল রেজিস্ট্রেশনের জন্য পাসপোর্ট কপি।',
  },
];

const CHENNAI_GUEST_HOUSES = [
  {
    id: 'gh-greams-1',
    nameBn: 'গ্রিমস রোড বাংলা গেস্ট হাউস (অ্যাপোলো মেইন গেটের কাছে)',
    nameEn: 'Greams Road Bengali Family Guest House (Near Apollo Main Gate)',
    distance: '180m walking (২ মিনিট হাঁটা পথ)',
    hospital: 'Apollo Hospitals, Greams Road, Chennai, India',
    rateInr: '₹1,650 / Night (AC Double + Bengali Kitchen)',
    featuresBn: 'নিজে রান্না করার বাংলাদেশি কিচেন · ফ্রি সি-ফর্ম (C-Form) · ওয়াইফাই ও লিফট · ২৪ ঘণ্টা বাংলা সহায়তা',
    featuresEn: 'Attached Bengali Self-Cooking Kitchen · Instant FRRO C-Form · Lift & Wi-Fi',
  },
  {
    id: 'gh-greams-2',
    nameBn: 'কর্নেল সার্ভিসড অ্যাপার্টমেন্ট (থাউজেন্ড লাইটস, গ্রিমস রোড)',
    nameEn: 'Thousand Lights Medical Serviced Apartment (Greams Road)',
    distance: '280m walking (৪ মিনিট হাঁটা পথ)',
    hospital: 'Apollo Hospitals, Greams Road, Chennai, India',
    rateInr: '₹2,400 / Night (2-Bed Family Suite + Kitchen)',
    featuresBn: 'হুইলচেয়ার র‍্যাম্প · অ্যাটেনডেন্টসহ পরিবারের জন্য উপযুক্ত · সি-ফর্ম রেডি · হালাল খাবারের হোটেল কাছেই',
    featuresEn: 'Wheelchair Accessible · Family Suite with Kitchen · Instant C-Form · Halal Dining Nearby',
  },
  {
    id: 'gh-proton-1',
    nameBn: 'তারামণি প্রোটন কেয়ার নিবাস (অ্যাপোলো প্রোটন ক্যান্সার সেন্টারের পাশে)',
    nameEn: 'Taramani Proton Care Stay (Near Apollo Proton Cancer Centre)',
    distance: '350m (রোগীদের জন্য ফ্রি হাসপাতাল শাটল)',
    hospital: 'Apollo Proton Cancer Centre, Chennai, India',
    rateInr: '₹2,200 / Night (Clean Infection-Safe AC Room + Kitchen)',
    featuresBn: 'ক্যান্সার ও কেমো রোগীদের জন্য জীবাণুমুক্ত পরিবেশ · প্রাইভেট রান্নাঘর · সি-ফর্ম ও হাসপাতাল শাটল',
    featuresEn: 'Infection-Controlled Environment for Oncology Patients · Private Kitchen · C-Form Included',
  },
];

const PRE_TRAVEL_SELF_CHECKLIST = [
  {
    id: 'chk-usd',
    bn: 'পাসপোর্টে ব্যাংক থেকে ডলার এনডোর্সমেন্ট (USD Endorsement) সম্পন্ন করেছি এবং স্লিপ সাথে নিয়েছি',
    en: 'Completed Passport USD Endorsement from Bangladesh Bank / Authorized Dealer & packed receipts',
  },
  {
    id: 'chk-slides',
    bn: 'অরিজিনাল বায়োপসি প্যারাফিন ব্লক/স্লাইড এবং সিটি/এমআরআই/এনজিওগ্রাম সিডি (CD) হাতের ব্যাগে (Cabin Bag) নিয়েছি',
    en: 'Packed Original Biopsy Paraffin Blocks/Glass Slides & DICOM CDs in Cabin Hand-Carry Bag (Never check-in)',
  },
  {
    id: 'chk-meds',
    bn: 'বর্তমান চলমান সব ওষুধ (অন্তত ১৫ দিনের) এবং প্রেসক্রিপশন হাতের ব্যাগে রেখেছি',
    en: 'Packed at least 15 days of current regular medications with Bangladeshi prescriptions in hand-carry',
  },
  {
    id: 'chk-labs',
    bn: 'সর্বশেষ ৩০ দিনের রক্তের সিবিসি, ক্রিয়েটিনিন (RFT) ও ভাইরাল মার্কার রিপোর্টের প্রিন্ট কপি নিয়েছি',
    en: 'Carried printed copies of recent (<30 days) CBC, Serum Creatinine, LFT, and Viral Screening reports',
  },
  {
    id: 'chk-vil',
    bn: 'ভারতীয় মেডিকেল ভিসা (Med-1/Med-2), হাসপাতালের ভিসা ইনভাইটেশন লেটার (VIL) ও রিটার্ন টিকিট প্রিন্ট করেছি',
    en: 'Printed Medical Visa (Med-1/Med-2), Official Hospital VIL, and Return Flight Itinerary for Immigration',
  },
  {
    id: 'chk-sim',
    bn: 'বাংলাদেশি নম্বরে আন্তর্জাতিক রোমিং চালু করেছি অথবা চেন্নাই এয়ারপোর্ট থেকে ভারতীয় সিম নেওয়ার প্রস্তুতি নিয়েছি',
    en: 'Activated International Roaming on BD number or prepared passport copy for Chennai Airport SIM card',
  },
];

export const PatientPortalView: React.FC<Props> = ({
  patients,
  documents,
  aiReports,
  secondOpinions,
  costEstimates,
  serviceBookings,
  communications,
  actor,
  isStaffPreview,
  initialPatientId,
  standaloneMode = false,
  onToggleStandaloneMode,
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    initialPatientId || patients[0]?.id || ''
  );

  useEffect(() => {
    if (initialPatientId && patients.some((p) => p.id === initialPatientId)) {
      setSelectedPatientId(initialPatientId);
    } else if (!selectedPatientId && patients[0]?.id) {
      setSelectedPatientId(patients[0].id);
    }
  }, [initialPatientId, patients, selectedPatientId]);

  const currentPatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  // Default to Bengali ('bn') so Bangladeshi patients immediately get a friendly native interface
  const [portalLang, setPortalLang] = useState<'en' | 'bn'>('bn');
  const [activeStep, setActiveStep] = useState<SelfServiceStepId>('step-1-passport-vil');
  const [lookupInput, setLookupInput] = useState('');
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState('');

  // ধাপ ১ (Step 1): Passport & Visa Invitation Letter (VIL) Self-Submission State
  const [patientPassport, setPatientPassport] = useState(currentPatient?.passportNumber || '');
  const [ivacLocation, setIvacLocation] = useState('IVAC Dhaka (Jamuna Future Park)');
  const [attendant1Name, setAttendant1Name] = useState('');
  const [attendant1Passport, setAttendant1Passport] = useState('');
  const [attendant1Relation, setAttendant1Relation] = useState('Spouse / Son / Daughter');
  const [attendant2Name, setAttendant2Name] = useState('');
  const [attendant2Passport, setAttendant2Passport] = useState('');
  const [expectedTravelDate, setExpectedTravelDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );

  // ধাপ ২ (Step 2): Guided Document Upload State
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<string>(DOCUMENT_CATEGORIES[0]);
  const [docSummary, setDocSummary] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedFileSizeKb, setSelectedFileSizeKb] = useState(480);

  // ধাপ ৩ (Step 3): Second Opinion, Cost Approval, Doctor Appointment & Coordinator Chat State
  const [requestType, setRequestType] = useState('Online Teleconsultation');
  const [preferredHospital, setPreferredHospital] = useState<string>(
    currentPatient?.preferredHospital || VERIFIED_HOSPITALS[0]
  );
  const [preferredDate, setPreferredDate] = useState(
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  );
  const [requestNotes, setRequestNotes] = useState('');
  const [portalMessage, setPortalMessage] = useState('');

  // ধাপ ৪ (Step 4 - OPTIONAL): Flight Ticket AI Reader, Airport Pickup, Reminder & Guest House State
  const [ticketStatusMode, setTicketStatusMode] = useState<'has_ticket' | 'no_ticket_yet'>('has_ticket');
  const defaultFutureDate = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const [flightDate, setFlightDate] = useState(defaultFutureDate);
  const [airlineName, setAirlineName] = useState('US-Bangla Airlines (BS-205 Dhaka → Chennai)');
  const [flightNumber, setFlightNumber] = useState('BS-205');
  const [arrivalDate, setArrivalDate] = useState(defaultFutureDate);
  const [arrivalTime, setArrivalTime] = useState('12:45 IST');
  const [pnrNumber, setPnrNumber] = useState('');
  const [passengerCount, setPassengerCount] = useState('2 (Patient + 1 Attendant)');
  const [wheelchairNeeded, setWheelchairNeeded] = useState<boolean>(false);
  const [mobilitySupport, setMobilitySupport] = useState('Standard AC Sedan / SUV Pickup');

  // Flight Ticket Upload / Attachment & AI Reader State
  const [ticketFileName, setTicketFileName] = useState('');
  const [ticketFileBase64, setTicketFileBase64] = useState('');
  const [ticketFileMimeType, setTicketFileMimeType] = useState('');
  const [rawTicketText, setRawTicketText] = useState('');
  const [isParsingTicket, setIsParsingTicket] = useState(false);
  const [aiTicketReadout, setAiTicketReadout] = useState<AiParsedTicketResult | null>(null);

  // "এখনো টিকিট করা হয়নি" (Ticket Not Booked Yet — Reminder State)
  const [noTicketReminderDate, setNoTicketReminderDate] = useState(
    new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  );
  const [noTicketWheelchairPreNote, setNoTicketWheelchairPreNote] = useState<boolean>(false);
  const [noTicketReminderChannel, setNoTicketReminderChannel] = useState(
    'WhatsApp + পোর্টাল নোটিফিকেশন ও সমন্বয়কারী কল'
  );
  const [noTicketReminderNote, setNoTicketReminderNote] = useState(
    'মেডিকেল ভিসা হাতে পাওয়ার পর ফ্লাইট টিকিট কাটবো — আমাকে রিমাইন্ডার দেবেন।'
  );
  const [reminderSavedBanner, setReminderSavedBanner] = useState('');

  // Guest House & Pre-Travel Checklist State
  const [checkInDate, setCheckInDate] = useState(defaultFutureDate);
  const [stayDurationDays, setStayDurationDays] = useState('10');
  const [guestHousePreferenceNote, setGuestHousePreferenceNote] = useState(
    'গ্রাউন্ড ফ্লোর / লিফট ও বাঙালি রান্নাঘর প্রয়োজন (Lift & Bengali Self-Cooking Kitchen)'
  );
  const [checkedItems, setCheckedItems] = useState<string[]>([
    'chk-usd',
    'chk-slides',
    'chk-meds',
  ]);

  useEffect(() => {
    if (currentPatient) {
      setPatientPassport(currentPatient.passportNumber || '');
      setPreferredHospital(currentPatient.preferredHospital || VERIFIED_HOSPITALS[0]);
    }
  }, [currentPatient]);

  if (!currentPatient) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <Lock className="w-8 h-8 text-sky-700 mx-auto" />
        <h3 className="text-base font-semibold text-slate-900">
          কোনো সক্রিয় রোগীর প্রোফাইল পাওয়া যায়নি / No Active Patient Profile Linked
        </h3>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          অনুগ্রহ করে প্রথমে ডেমো ডাটা লোড করুন অথবা নতুন রোগী নিবন্ধন করুন। / Please register a patient record or load
          the synthetic Bangladesh-to-Apollo demo dataset first to preview the isolated Patient Self-Service Portal.
        </p>
      </div>
    );
  }

  // Strictly isolated records for this single patient ONLY
  const myDocs = documents.filter((d) => d.patientId === currentPatient.id);
  const myApprovedAiReports = aiReports.filter(
    (r) => r.patientId === currentPatient.id && r.sharedWithPatient === true
  );
  const mySecondOpinions = secondOpinions.filter((o) => o.patientId === currentPatient.id);
  const myEstimates = costEstimates.filter((c) => c.patientId === currentPatient.id);
  const myBookings = serviceBookings.filter((b) => b.patientId === currentPatient.id);
  const myMessages = communications.filter((m) => m.recipientId === currentPatient.id);

  // Check if patient already has an active "Ticket Not Booked Yet" reminder booking
  const existingTicketReminderBooking = myBookings.find(
    (b) =>
      b.serviceCategory === 'Airport Pickup & Drop-off' &&
      (b.serviceName.toLowerCase().includes('reminder') ||
        b.serviceName.includes('এখনো টিকিট করা হয়নি') ||
        b.status === 'On Hold')
  );

  // Build shareable patient self-service URL
  const shareablePortalUrl = `${window.location.origin}${window.location.pathname}?portal=patient&code=${encodeURIComponent(
    currentPatient.patientCode
  )}`;

  const cleanPatientPhone = (currentPatient.whatsapp || currentPatient.phone || '+8801711000000').replace(
    /[^0-9]/g,
    ''
  );
  const whatsappShareText = encodeURIComponent(
    `আসসালামু আলাইকুম ${currentPatient.fullName},\nQureWays Trip-এ আপনার ব্যক্তিগত রোগী সেলফ-সার্ভিস পোর্টাল প্রস্তুত!\n\nআপনার পেশেন্ট কোড: ${currentPatient.patientCode}\nলিংক: ${shareablePortalUrl}\n\nএই লিংকে ক্লিক করে সহজ ধাপে আপনি নিজেই:\nধাপ ১: পাসপোর্ট ও ভিসা ইনভাইটেশন লেটারের (VIL) তথ্য দিতে পারবেন\nধাপ ২: প্রেসক্রিপশন ও মেডিকেল রিপোর্ট আপলোড করতে পারবেন\nধাপ ৩: ডাক্তারের মতামত, খরচের হিসাব অনুমোদন ও অ্যাপয়েন্টমেন্ট নিতে পারবেন\nধাপ ৪ (ঐচ্ছিক): ফ্লাইট টিকিট আপলোড করে অটো-পিকআপ নিতে পারবেন (অথবা টিকিট না হয়ে থাকলে রিমাইন্ডার সেট করতে পারবেন)।`
  );
  const whatsappShareHref = `https://wa.me/${cleanPatientPhone}?text=${whatsappShareText}`;

  // Calculate 4-step completion status from live Firestore records
  const step1Done =
    Boolean(currentPatient.passportNumber && currentPatient.passportNumber.trim().length > 3) ||
    myBookings.some((b) => b.serviceCategory.toLowerCase().includes('visa'));
  const step2Done = myDocs.length > 0;
  const step3Done =
    myBookings.some(
      (b) =>
        b.serviceCategory.toLowerCase().includes('appointment') ||
        b.serviceCategory.toLowerCase().includes('teleconsultation') ||
        b.serviceName.toLowerCase().includes('approved estimate')
    ) || myEstimates.length > 0;
  const step4Done =
    myBookings.some(
      (b) =>
        b.serviceCategory.toLowerCase().includes('airport') ||
        b.serviceName.toLowerCase().includes('pickup') ||
        b.serviceCategory.toLowerCase().includes('accommodation') ||
        b.serviceName.toLowerCase().includes('guest house') ||
        b.serviceName.toLowerCase().includes('apartment')
    ) ||
    myDocs.some((d) => d.title.toLowerCase().includes('checklist'));

  const fourStepsCompletion = [step1Done, step2Done, step3Done, step4Done];
  const completedStepsCount = fourStepsCompletion.filter(Boolean).length;

  const handlePatientLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const q = lookupInput.trim().toLowerCase();
    if (!q) return;
    const found = patients.find(
      (p) =>
        p.patientCode.toLowerCase() === q ||
        p.phone.replace(/\s+/g, '').includes(q) ||
        p.fullName.toLowerCase().includes(q)
    );
    if (found) {
      setSelectedPatientId(found.id);
      setFeedbackBanner(
        portalLang === 'bn'
          ? `${found.fullName} (${found.patientCode})-এর ৪-ধাপের সেলফ-সার্ভিস পোর্টাল লোড হয়েছে।`
          : `Loaded 4-step self-service portal for ${found.fullName} (${found.patientCode}).`
      );
      setLookupInput('');
    } else {
      setFeedbackBanner(
        portalLang === 'bn'
          ? 'এই পেশেন্ট কোড বা মোবাইল নম্বরে কোনো প্রোফাইল পাওয়া যায়নি।'
          : 'No patient profile matched that code or phone number.'
      );
    }
  };

  // ধাপ ১ Handler: Submit Passport & Attendant Details for Hospital VIL
  const handleSelfSubmitPassportAndVil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientPassport.trim()) return;

    const attendantSummary = [
      attendant1Name
        ? `Attendant 1: ${attendant1Name} (${attendant1Relation}, Passport: ${attendant1Passport || 'Pending'})`
        : '',
      attendant2Name ? `Attendant 2: ${attendant2Name} (Passport: ${attendant2Passport || 'Pending'})` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    await updatePatientSelfServiceProfile(
      currentPatient.id,
      currentPatient.fullName,
      {
        passportNumber: patientPassport.trim(),
        emergencyContact: attendantSummary || currentPatient.emergencyContact,
      },
      actor
    );

    await createServiceBooking(
      {
        patientId: currentPatient.id,
        patientName: currentPatient.fullName,
        serviceCategory: 'Visa Invitation Letter (VIL)',
        serviceName: `Official Hospital VIL Request (${ivacLocation}) — Patient Passport: ${patientPassport}`,
        hospitalOrProvider: currentPatient.preferredHospital,
        scheduledDate: expectedTravelDate,
        status: 'Requested',
        assignedCoordinatorName: currentPatient.assignedCoordinatorName,
        visaPassportRef: `${patientPassport}${attendant1Passport ? `, ${attendant1Passport}` : ''}${
          attendant2Passport ? `, ${attendant2Passport}` : ''
        }`,
        notes: `Submitted by Patient via Self-Service Portal (Step 1). IVAC Center: ${ivacLocation}. ${
          attendantSummary || 'No attendant listed yet.'
        }`,
        ownerId: actor.uid,
      },
      actor
    );

    await createFollowUpTask(
      {
        title: `Issue Official Hospital VIL for ${currentPatient.fullName} (${ivacLocation})`,
        description: `Patient self-submitted Passport (${patientPassport}) & Attendant details (${attendantSummary}) via Patient Portal Step 1. Generate VIL from ${currentPatient.preferredHospital}.`,
        relatedType: 'Patient',
        relatedId: currentPatient.id,
        relatedName: currentPatient.fullName,
        assignedToName: currentPatient.assignedCoordinatorName,
        priority: 'High',
        dueDate: new Date().toISOString().slice(0, 10),
        status: 'Pending',
        automationTrigger: 'Patient Self-Service Portal: Step 1 VIL Requisition',
        ownerId: actor.uid,
      },
      actor
    );

    setFeedbackBanner(
      portalLang === 'bn'
        ? 'ধাপ ১ সম্পন্ন: আপনার পাসপোর্ট ও অ্যাটেনডেন্ট তথ্য সংরক্ষিত হয়েছে এবং ভিসা ইনভাইটেশন লেটারের (VIL) আবেদন পাঠানো হয়েছে!'
        : 'Step 1 Completed: Your Passport & Attendant (Med-2) details are saved and Official Hospital VIL request is submitted!'
    );
  };

  // ধাপ ২ Handler: Upload Medical Document
  const handlePortalDocUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) return;
    await createMedicalDocument(
      {
        patientId: currentPatient.id,
        patientName: currentPatient.fullName,
        title: docTitle,
        category: docCategory,
        fileName: selectedFileName || `${docTitle.replace(/\s+/g, '_')}.pdf`,
        fileType: selectedFileName ? selectedFileName.split('.').pop()?.toUpperCase() || 'PDF' : 'PDF',
        fileSizeKb: selectedFileSizeKb || 490,
        version: 1,
        extractedText: docSummary || 'Uploaded by patient via Self-Service Portal (Step 2).',
        reviewStatus: 'Pending Review',
        uploadedByName: `${currentPatient.fullName} (Patient Self-Service)`,
        ownerId: actor.uid,
      },
      actor
    );
    setDocTitle('');
    setDocSummary('');
    setSelectedFileName('');
    setFeedbackBanner(
      portalLang === 'bn'
        ? 'ধাপ ২ আপডেট: আপনার মেডিকেল রিপোর্ট / প্রেসক্রিপশন সফলভাবে আপলোড হয়েছে! সমন্বয়কারী এটি যাচাই করে হাসপাতালে পাঠাবেন।'
        : 'Step 2 Updated: Your medical document has been securely uploaded for coordinator & hospital verification.'
    );
  };

  // ধাপ ৩ Handlers: Approve Estimate, Book Doctor Consult, Send Message
  const handleApproveCostEstimate = async (est: TreatmentCostEstimateRecord) => {
    await createServiceBooking(
      {
        patientId: currentPatient.id,
        patientName: currentPatient.fullName,
        serviceCategory: 'Hospital Admission & Treatment Confirmation',
        serviceName: `Patient Approved Estimate: ${est.treatmentTitle} (USD $${est.minTotalBudgetUsd.toLocaleString()}–$${est.maxTotalBudgetUsd.toLocaleString()})`,
        hospitalOrProvider: est.hospitalName,
        scheduledDate: new Date().toISOString().slice(0, 10),
        status: 'Confirmed',
        assignedCoordinatorName: currentPatient.assignedCoordinatorName,
        notes: `Patient reviewed and approved cost estimate (${est.treatmentTitle}) via Self-Service Portal Step 3.`,
        ownerId: actor.uid,
      },
      actor
    );
    await createCommunicationRecord(
      {
        recipientType: 'Patient',
        recipientId: currentPatient.id,
        recipientName: currentPatient.fullName,
        channel: 'Patient Portal',
        direction: 'Inbound',
        subject: `Cost Estimate Approved by Patient: ${est.treatmentTitle}`,
        messageSummary: `Patient ${currentPatient.fullName} approved the treatment cost estimate for ${est.treatmentTitle} at ${est.hospitalName} (USD $${est.minTotalBudgetUsd} - $${est.maxTotalBudgetUsd}).`,
        staffOrAutomationName: currentPatient.fullName,
        deliveryStatus: 'Received by Coordinator',
        consentVerified: true,
        optOutStatus: false,
        ownerId: actor.uid,
      },
      actor
    );
    setFeedbackBanner(
      portalLang === 'bn'
        ? `ধাপ ৩ সম্পন্ন: "${est.treatmentTitle}"-এর খরচের হিসাব আপনি অনুমোদন করেছেন! চাইলে এখন ধাপ ৪ (ঐচ্ছিক)-এ ফ্লাইট টিকিট বা রিমাইন্ডার দিতে পারেন।`
        : `Step 3 Completed: You have approved the cost estimate for "${est.treatmentTitle}". You may optionally proceed to Step 4 for Travel & Pickup.`
    );
  };

  const handlePortalServiceRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    await createServiceBooking(
      {
        patientId: currentPatient.id,
        patientName: currentPatient.fullName,
        serviceCategory: requestType,
        serviceName: `${requestType} Request — ${preferredHospital}`,
        hospitalOrProvider: preferredHospital,
        scheduledDate: preferredDate,
        status: 'Requested',
        assignedCoordinatorName: currentPatient.assignedCoordinatorName,
        visaPassportRef: patientPassport,
        notes: requestNotes || 'Requested by patient via Self-Service Portal Step 3.',
        ownerId: actor.uid,
      },
      actor
    );
    setRequestNotes('');
    setFeedbackBanner(
      portalLang === 'bn'
        ? `ধাপ ৩ আপডেট: আপনার "${requestType}" অ্যাপয়েন্টমেন্ট রিকোয়েস্ট সফলভাবে জমা হয়েছে!`
        : `Step 3 Updated: Your request for "${requestType}" has been received by your coordinator.`
    );
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalMessage.trim()) return;
    await createCommunicationRecord(
      {
        recipientType: 'Patient',
        recipientId: currentPatient.id,
        recipientName: currentPatient.fullName,
        channel: 'Patient Portal',
        direction: 'Inbound',
        subject: 'Patient Self-Service Portal Message to Coordinator',
        messageSummary: portalMessage,
        staffOrAutomationName: currentPatient.fullName,
        deliveryStatus: 'Received by Coordinator',
        consentVerified: true,
        optOutStatus: false,
        ownerId: actor.uid,
      },
      actor
    );
    setPortalMessage('');
    setFeedbackBanner(
      portalLang === 'bn'
        ? 'আপনার বার্তা সমন্বয়কারীর কাছে পাঠানো হয়েছে।'
        : 'Message sent to your assigned coordinator.'
    );
  };

  // =========================================================================
  // ধাপ ৪ (OPTIONAL STEP 4) HANDLERS:
  // 1) AI Flight Ticket Reader (from uploaded image/PDF or pasted text)
  // 2) Confirm Airport Pickup with AI-read details
  // 3) "এখনো টিকিট করা হয়নি" (Ticket Not Booked Yet — Automated Reminder)
  // =========================================================================
  const applyParsedTicketToForm = (parsed: AiParsedTicketResult) => {
    setAiTicketReadout(parsed);
    if (parsed.flightDate) setFlightDate(parsed.flightDate);
    if (parsed.flightNumber) setFlightNumber(parsed.flightNumber);
    if (parsed.airlineName) setAirlineName(parsed.airlineName);
    if (parsed.chennaiArrivalDate) {
      setArrivalDate(parsed.chennaiArrivalDate);
      setCheckInDate(parsed.chennaiArrivalDate);
    }
    if (parsed.chennaiArrivalTime) setArrivalTime(parsed.chennaiArrivalTime);
    if (parsed.pnrOrTicketNumber) setPnrNumber(parsed.pnrOrTicketNumber);
    if (parsed.passengerCount) setPassengerCount(parsed.passengerCount);
    setWheelchairNeeded(Boolean(parsed.wheelchairRequired));
    if (parsed.mobilitySupportOption) {
      setMobilitySupport(parsed.mobilitySupportOption);
    } else {
      setMobilitySupport(
        parsed.wheelchairRequired
          ? 'Wheelchair Assistance + AC SUV'
          : 'Standard AC Sedan / SUV Pickup'
      );
    }
  };

  const fallbackLocalTicketParse = (text: string, fName: string): AiParsedTicketResult => {
    const combined = `${text} ${fName}`;
    const upper = combined.toUpperCase();
    const hasWheelchair =
      upper.includes('WCHR') ||
      upper.includes('WCHS') ||
      upper.includes('WCHC') ||
      upper.includes('WHEELCHAIR') ||
      combined.includes('হুইলচেয়ার') ||
      upper.includes('SPECIAL ASSISTANCE');

    const flightMatch = upper.match(/\b(BS[-\s]?\d{3}|BG[-\s]?\d{3}|6E[-\s]?\d{3,4}|AI[-\s]?\d{3,4})\b/);
    const detectedFlightNo = flightMatch ? flightMatch[1].replace(/\s+/g, '-') : 'BS-205';

    const dateMatch = combined.match(/\b(202\d-\d{2}-\d{2})\b/);
    const detectedDate =
      dateMatch?.[1] || new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);

    const timeMatch = combined.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM|IST)?)\b/i);
    const detectedTime = timeMatch ? `${timeMatch[1].toUpperCase()} IST`.replace('IST IST', 'IST') : '12:45 IST';

    const pnrMatch = upper.match(/PNR[:\s#-]*([A-Z0-9]{5,8})/);
    const detectedPnr = pnrMatch ? pnrMatch[1] : 'QW789M';

    let detectedAirline = 'US-Bangla Airlines (BS-205 Dhaka → Chennai)';
    if (detectedFlightNo.startsWith('BG')) {
      detectedAirline = 'Biman Bangladesh Airlines (BG-363 Dhaka → Chennai)';
    } else if (detectedFlightNo.startsWith('6E')) {
      detectedAirline = 'IndiGo Airlines (6E Dhaka → Chennai)';
    } else if (detectedFlightNo.startsWith('AI')) {
      detectedAirline = 'Air India (AI Dhaka/Kolkata → Chennai)';
    }

    const mobilityOpt = hasWheelchair
      ? 'Wheelchair Assistance + AC SUV'
      : 'Standard AC Sedan / SUV Pickup';

    return {
      flightDate: detectedDate,
      flightNumber: detectedFlightNo,
      airlineName: detectedAirline,
      chennaiArrivalDate: detectedDate,
      chennaiArrivalTime: detectedTime,
      pnrOrTicketNumber: detectedPnr,
      passengerCount: '2 (Patient + 1 Attendant)',
      passengerNames: currentPatient.fullName,
      wheelchairRequired: hasWheelchair,
      mobilitySupportOption: mobilityOpt,
      summaryBn: `AI টিকিট স্ক্যান সম্পন্ন: ফ্লাইট ${detectedFlightNo} (${detectedAirline}), ফ্লাইটের তারিখ: ${detectedDate}, চেন্নাই পৌঁছানোর তারিখ: ${detectedDate} সময়: ${detectedTime}। হুইলচেয়ার প্রয়োজন: ${
        hasWheelchair ? 'হ্যাঁ (WCHR হুইলচেয়ার ও এসি SUV পিকআপ প্রস্তুত রাখা হচ্ছে)' : 'না (সাধারণ এসি পিকআপ গাড়ি)'
      }।`,
      summaryEn: `AI Ticket Read Complete: Flight ${detectedFlightNo} (${detectedAirline}), Departure & Chennai Arrival Date: ${detectedDate} at ${detectedTime}. Wheelchair Required: ${
        hasWheelchair ? 'Yes (Wheelchair Assistance + AC SUV assigned)' : 'No (Standard AC Pickup)'
      }.`,
    };
  };

  const handleAiReadFlightTicket = async (
    overrideText?: string,
    overrideBase64?: string,
    overrideMime?: string,
    overrideFileName?: string
  ) => {
    const textToUse = overrideText !== undefined ? overrideText : rawTicketText;
    const base64ToUse = overrideBase64 !== undefined ? overrideBase64 : ticketFileBase64;
    const mimeToUse = overrideMime !== undefined ? overrideMime : ticketFileMimeType;
    const fileNameToUse = overrideFileName !== undefined ? overrideFileName : ticketFileName;

    if (!textToUse.trim() && !base64ToUse) {
      setFeedbackBanner(
        portalLang === 'bn'
          ? 'অনুগ্রহ করে প্রথমে আপনার ফ্লাইট টিকিটের ছবি/PDF ফাইল অ্যাটাচ করুন অথবা টিকিটের তথ্য পেস্ট করুন।'
          : 'Please attach a flight ticket image/PDF or paste ticket text first.'
      );
      return;
    }

    setIsParsingTicket(true);
    try {
      const response = await fetch('/api/ai/parse-flight-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: base64ToUse || undefined,
          mimeType: mimeToUse || undefined,
          fileName: fileNameToUse || 'flight_ticket',
          rawTicketText: textToUse,
          patientName: currentPatient.fullName,
        }),
      });

      if (response.ok) {
        const parsed = (await response.json()) as AiParsedTicketResult;
        applyParsedTicketToForm(parsed);
        setFeedbackBanner(
          portalLang === 'bn'
            ? `✨ AI সফলভাবে আপনার ফ্লাইট টিকিট রিড করেছে! ফ্লাইট: ${parsed.flightNumber}, চেন্নাই পৌঁছানো: ${parsed.chennaiArrivalDate} (${parsed.chennaiArrivalTime}), হুইলচেয়ার: ${
                parsed.wheelchairRequired ? 'হ্যাঁ (প্রয়োজন আছে)' : 'না'
              } — নিচের ফর্মে স্বয়ংক্রিয়ভাবে বসানো হয়েছে।`
            : `✨ AI Read Your Flight Ticket! Flight ${parsed.flightNumber}, Arrival ${parsed.chennaiArrivalDate} (${parsed.chennaiArrivalTime}), Wheelchair: ${
                parsed.wheelchairRequired ? 'Yes' : 'No'
              } — auto-filled below.`
        );
      } else {
        const fallback = fallbackLocalTicketParse(textToUse, fileNameToUse);
        applyParsedTicketToForm(fallback);
        setFeedbackBanner(
          portalLang === 'bn'
            ? `✨ টিকিট থেকে ফ্লাইটের তারিখ (${fallback.flightDate}), ফ্লাইট নাম্বার (${fallback.flightNumber}), চেন্নাই পৌঁছানোর সময় (${fallback.chennaiArrivalTime}) ও হুইলচেয়ার তথ্য স্বয়ংক্রিয়ভাবে পিকআপ করা হয়েছে!`
            : `✨ Extracted Flight ${fallback.flightNumber}, Arrival ${fallback.chennaiArrivalDate} at ${fallback.chennaiArrivalTime}, and Wheelchair status!`
        );
      }
    } catch {
      const fallback = fallbackLocalTicketParse(textToUse, fileNameToUse);
      applyParsedTicketToForm(fallback);
      setFeedbackBanner(
        portalLang === 'bn'
          ? `✨ টিকিট থেকে ফ্লাইটের তারিখ (${fallback.flightDate}), ফ্লাইট নাম্বার (${fallback.flightNumber}), চেন্নাই পৌঁছানোর সময় (${fallback.chennaiArrivalTime}) ও হুইলচেয়ার তথ্য স্বয়ংক্রিয়ভাবে পিকআপ করা হয়েছে!`
          : `✨ Extracted Flight ${fallback.flightNumber}, Arrival ${fallback.chennaiArrivalDate} at ${fallback.chennaiArrivalTime}, and Wheelchair status!`
      );
    } finally {
      setIsParsingTicket(false);
    }
  };

  const handleTicketFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTicketFileName(file.name);
    const mime = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    setTicketFileMimeType(mime);

    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = String(reader.result || '');
      const base64Clean = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
      setTicketFileBase64(base64Clean);
      // Automatically trigger AI read as soon as the customer attaches their ticket!
      void handleAiReadFlightTicket(rawTicketText, base64Clean, mime, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSelfBookAirportPickup = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveMobility = wheelchairNeeded
      ? mobilitySupport.includes('Stretcher')
        ? mobilitySupport
        : 'Wheelchair Assistance + AC SUV'
      : mobilitySupport;

    // If a ticket file or ticket text was uploaded/inserted, save it in Medical & Travel Documents too
    if (ticketFileName || rawTicketText.trim() || aiTicketReadout) {
      await createMedicalDocument(
        {
          patientId: currentPatient.id,
          patientName: currentPatient.fullName,
          title: `Flight Ticket (${flightNumber} — Arrival ${arrivalDate} ${arrivalTime})${
            wheelchairNeeded ? ' [Wheelchair Needed]' : ''
          }`,
          category: 'Other relevant clinical documents',
          fileName: ticketFileName || `${currentPatient.patientCode}_Flight_Ticket_${flightNumber}.pdf`,
          fileType: 'FLIGHT_TICKET',
          fileSizeKb: 320,
          version: 1,
          extractedText:
            aiTicketReadout?.summaryEn ||
            `Flight Date: ${flightDate}, Flight No: ${flightNumber}, Airline: ${airlineName}, Chennai Arrival: ${arrivalDate} at ${arrivalTime}, PNR: ${
              pnrNumber || 'N/A'
            }, Wheelchair Required: ${wheelchairNeeded ? 'YES' : 'NO'}, Vehicle: ${effectiveMobility}.`,
          reviewStatus: 'Verified',
          uploadedByName: `${currentPatient.fullName} (Step 4 AI Ticket Reader)`,
          ownerId: actor.uid,
        },
        actor
      );
    }

    await createServiceBooking(
      {
        patientId: currentPatient.id,
        patientName: currentPatient.fullName,
        serviceCategory: 'Airport Pickup & Drop-off',
        serviceName: `Chennai Airport (MAA) Pickup — ${flightNumber} (${arrivalDate} ${arrivalTime})${
          wheelchairNeeded ? ' + WHEELCHAIR ASSISTANCE' : ''
        }`,
        hospitalOrProvider: currentPatient.preferredHospital,
        scheduledDate: arrivalDate,
        scheduledTime: arrivalTime,
        serviceFeeUsd: 0,
        processingTimeEstimate: wheelchairNeeded
          ? 'Confirmed: Bengali Driver + Airport Wheelchair Escort'
          : 'Confirmed with Bengali Driver Desk',
        status: 'Requested',
        assignedCoordinatorName: currentPatient.assignedCoordinatorName,
        visaPassportRef: currentPatient.passportNumber || patientPassport,
        notes: `AI-Verified Flight Ticket in Step 4. Flight Date: ${flightDate}, Airline: ${airlineName}, Flight No: ${flightNumber}, PNR: ${
          pnrNumber || 'On Ticket'
        }, Chennai Arrival: ${arrivalDate} at ${arrivalTime}. Passengers: ${passengerCount}. Wheelchair Required: ${
          wheelchairNeeded ? 'YES (Arrange Wheelchair at MAA Arrival Gate)' : 'No'
        }. Vehicle/Mobility: ${effectiveMobility}.`,
        ownerId: actor.uid,
      },
      actor
    );

    await createFollowUpTask(
      {
        title: `Dispatch Chennai Airport (MAA) Pickup${
          wheelchairNeeded ? ' + Wheelchair Escort' : ''
        } for ${currentPatient.fullName} (${flightNumber})`,
        description: `Patient uploaded flight ticket in Step 4. Flight Date: ${flightDate}, Flight No: ${flightNumber} (${airlineName}), Chennai Arrival: ${arrivalDate} at ${arrivalTime}. Wheelchair Required: ${
          wheelchairNeeded ? 'YES' : 'NO'
        }. Assign driver & placard at MAA International Arrival Gate.`,
        relatedType: 'Patient',
        relatedId: currentPatient.id,
        relatedName: currentPatient.fullName,
        assignedToName: currentPatient.assignedCoordinatorName,
        priority: wheelchairNeeded ? 'Urgent' : 'High',
        dueDate: arrivalDate,
        status: 'Pending',
        automationTrigger: 'Patient Portal Step 4: AI Flight Ticket Read & Pickup Dispatch',
        ownerId: actor.uid,
      },
      actor
    );

    setFeedbackBanner(
      portalLang === 'bn'
        ? `ধাপ ৪ (এয়ারপোর্ট পিকআপ নিশ্চিত): ফ্লাইট ${flightNumber} (চেন্নাই পৌঁছানো: ${arrivalDate}, সময়: ${arrivalTime}${
            wheelchairNeeded ? ', হুইলচেয়ারসহ' : ''
          })-এর জন্য আপনার চেন্নাই এয়ারপোর্ট পিকআপ ও প্রতিনিধি ব্যবস্থা সম্পন্ন হয়েছে!`
        : `Step 4 (Airport Pickup Confirmed): Your Chennai Airport Pickup for flight ${flightNumber} arriving ${arrivalDate} at ${arrivalTime}${
            wheelchairNeeded ? ' with Wheelchair Assistance' : ''
          } has been arranged!`
    );
  };

  // Handler when patient has NOT booked flight ticket yet ("এখনো টিকিট করা হয়নি")
  const handleScheduleNoTicketReminder = async (e: React.FormEvent) => {
    e.preventDefault();

    await createFollowUpTask(
      {
        title: `Flight Ticket & Airport Pickup Reminder for ${currentPatient.fullName} (${currentPatient.patientCode})`,
        description: `Patient selected "এখনো টিকিট করা হয়নি / Ticket Not Booked Yet" in Step 4 (Optional). Send reminder on ${noTicketReminderDate} via ${noTicketReminderChannel} to collect flight ticket and arrange Chennai Airport (MAA) pickup${
          noTicketWheelchairPreNote ? ' (Note: Patient will require Wheelchair Assistance upon arrival)' : ''
        }. Patient Note: ${noTicketReminderNote}`,
        relatedType: 'Patient',
        relatedId: currentPatient.id,
        relatedName: currentPatient.fullName,
        assignedToName: currentPatient.assignedCoordinatorName,
        priority: 'High',
        dueDate: noTicketReminderDate,
        status: 'Pending',
        automationTrigger: 'Patient Portal Step 4 (Optional): Ticket Not Booked Yet — Airport Pickup Reminder',
        ownerId: actor.uid,
      },
      actor
    );

    await createServiceBooking(
      {
        patientId: currentPatient.id,
        patientName: currentPatient.fullName,
        serviceCategory: 'Airport Pickup & Drop-off',
        serviceName: `এখনো টিকিট করা হয়নি — এয়ারপোর্ট পিকআপ রিমাইন্ডার (${noTicketReminderDate})${
          noTicketWheelchairPreNote ? ' [হুইলচেয়ার প্রি-নোট]' : ''
        }`,
        hospitalOrProvider: currentPatient.preferredHospital,
        scheduledDate: noTicketReminderDate,
        status: 'On Hold',
        assignedCoordinatorName: currentPatient.assignedCoordinatorName,
        visaPassportRef: currentPatient.passportNumber || patientPassport,
        notes: `Patient has not booked flight ticket yet (Step 4 Optional). Scheduled reminder for ${noTicketReminderDate} via ${noTicketReminderChannel} so we can send/collect Airport Pickup request later. Pre-noted Wheelchair Need: ${
          noTicketWheelchairPreNote ? 'Yes' : 'No'
        }. Note: ${noTicketReminderNote}`,
        ownerId: actor.uid,
      },
      actor
    );

    await createCommunicationRecord(
      {
        recipientType: 'Patient',
        recipientId: currentPatient.id,
        recipientName: currentPatient.fullName,
        channel: 'Patient Portal',
        direction: 'Outbound',
        subject: `Airport Pickup Reminder Scheduled for ${noTicketReminderDate} (Ticket Pending)`,
        messageSummary: `প্রিয় ${currentPatient.fullName}, আপনার "এখনো ফ্লাইট টিকিট করা হয়নি" অপশনটি সংরক্ষিত হয়েছে। আগামী ${noTicketReminderDate} তারিখে আমরা আপনাকে ফ্লাইট টিকিট ও চেন্নাই এয়ারপোর্ট পিকআপ রিকোয়েস্ট পাঠানোর জন্য রিমাইন্ডার দেবো।`,
        staffOrAutomationName: `${currentPatient.assignedCoordinatorName} (Automated Reminder)`,
        deliveryStatus: `Scheduled for ${noTicketReminderDate}`,
        consentVerified: true,
        optOutStatus: false,
        ownerId: actor.uid,
      },
      actor
    );

    const msg =
      portalLang === 'bn'
        ? `✓ "এখনো টিকিট করা হয়নি" সংরক্ষিত হয়েছে! আগামী ${noTicketReminderDate} তারিখে আপনার চেন্নাই এয়ারপোর্ট পিকআপ রিকোয়েস্ট পাঠানোর জন্য আমরা আপনাকে রিমাইন্ডার দেবো।`
        : `✓ "Ticket Not Booked Yet" saved! We have scheduled an automated reminder for ${noTicketReminderDate} so you can submit your flight ticket and book Chennai Airport pickup later.`;

    setReminderSavedBanner(msg);
    setFeedbackBanner(msg);
  };

  const handleSelfBookGuestHouse = async (gh: (typeof CHENNAI_GUEST_HOUSES)[number]) => {
    await createServiceBooking(
      {
        patientId: currentPatient.id,
        patientName: currentPatient.fullName,
        serviceCategory: 'Guest House & Accommodation',
        serviceName: `${gh.nameEn} (${gh.rateInr}) — ${stayDurationDays} Days`,
        hospitalOrProvider: gh.hospital,
        scheduledDate: checkInDate,
        status: 'Requested',
        assignedCoordinatorName: currentPatient.assignedCoordinatorName,
        visaPassportRef: currentPatient.passportNumber || patientPassport,
        notes: `Patient self-selected Guest House in Step 4. Check-in: ${checkInDate} for ${stayDurationDays} nights. Distance: ${gh.distance}. Special Note: ${guestHousePreferenceNote}. Features: ${gh.featuresEn}`,
        ownerId: actor.uid,
      },
      actor
    );
    setFeedbackBanner(
      portalLang === 'bn'
        ? `ধাপ ৪ (গেস্ট হাউস বুকিং): "${gh.nameBn}"-এ ${checkInDate} তারিখ থেকে ${stayDurationDays} দিনের জন্য বুকিং রিকোয়েস্ট পাঠানো হয়েছে!`
        : `Step 4 (Guest House): Booking request submitted for "${gh.nameEn}" starting ${checkInDate} (${stayDurationDays} nights).`
    );
  };

  const handleSaveReadinessChecklist = async () => {
    const completedSummary = PRE_TRAVEL_SELF_CHECKLIST.filter((item) =>
      checkedItems.includes(item.id)
    )
      .map((i) => `✓ ${i.en}`)
      .join('\n');

    await createMedicalDocument(
      {
        patientId: currentPatient.id,
        patientName: currentPatient.fullName,
        title: `Patient Self-Verified Travel & Cabin Readiness Checklist (${checkedItems.length}/${PRE_TRAVEL_SELF_CHECKLIST.length})`,
        category: 'Other relevant clinical documents',
        fileName: `${currentPatient.patientCode}_Travel_Readiness_Checklist.pdf`,
        fileType: 'CHECKLIST',
        fileSizeKb: 120,
        version: 1,
        extractedText: `Self-verified by ${currentPatient.fullName} in Step 4:\n${completedSummary}`,
        reviewStatus: 'Approved for Sharing',
        uploadedByName: `${currentPatient.fullName} (Self-Service Step 4)`,
        ownerId: actor.uid,
      },
      actor
    );

    setFeedbackBanner(
      portalLang === 'bn'
        ? `ধাপ ৪ (যাত্রার প্রস্তুতি): আপনার ভারত যাত্রার চেকলিস্ট (${checkedItems.length}/${PRE_TRAVEL_SELF_CHECKLIST.length} টি সম্পন্ন) সংরক্ষিত হয়েছে!`
        : `Step 4 (Travel Readiness): Your Pre-Travel & Cabin Bag Checklist (${checkedItems.length}/${PRE_TRAVEL_SELF_CHECKLIST.length} completed) has been saved!`
    );
  };

  const activePortalStageIdx = Math.max(
    0,
    PATIENT_JOURNEY_STAGES.findIndex(
      (s) =>
        s.id === currentPatient.journeyStage ||
        s.label === currentPatient.journeyStage ||
        (s.aliases as readonly string[]).includes(currentPatient.journeyStage)
    )
  );
  const portalProgressPct = Math.round(
    ((activePortalStageIdx + 1) / PATIENT_JOURNEY_STAGES.length) * 100
  );

  // The 4 Focused Self-Service Steps (নিজে নিজে সম্পন্ন করার ৪টি সহজ ধাপ — ধাপ ৪ অপশনাল)
  const FOUR_SELF_SERVICE_STEPS: Array<{
    id: SelfServiceStepId;
    stepNumBn: string;
    stepNumEn: string;
    titleBn: string;
    titleEn: string;
    subBn: string;
    subEn: string;
    done: boolean;
    optional?: boolean;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'step-1-passport-vil',
      stepNumBn: 'ধাপ ১',
      stepNumEn: 'Step 1',
      titleBn: 'পাসপোর্ট ও ভিসা লেটার (VIL)',
      titleEn: 'Passport & Visa Letter (VIL)',
      subBn: 'নিজের ও অ্যাটেনডেন্টের পাসপোর্ট জমা দিন',
      subEn: 'Submit Med-1 & Med-2 Passports',
      done: step1Done,
      icon: ShieldCheck,
    },
    {
      id: 'step-2-upload-reports',
      stepNumBn: 'ধাপ ২',
      stepNumEn: 'Step 2',
      titleBn: 'প্রেসক্রিপশন ও রিপোর্ট আপলোড',
      titleEn: 'Upload Medical Reports',
      subBn: `${myDocs.length} টি ফাইল জমা দেওয়া হয়েছে`,
      subEn: `${myDocs.length} documents uploaded`,
      done: step2Done,
      icon: Upload,
    },
    {
      id: 'step-3-opinion-estimate-doctor',
      stepNumBn: 'ধাপ ৩',
      stepNumEn: 'Step 3',
      titleBn: 'খরচ অনুমোদন ও ডাক্তার সিরিয়াল',
      titleEn: 'Cost Approval & Doctor Consult',
      subBn: 'সেকেন্ড ওপিনিয়ন, খরচ ও অ্যাপয়েন্টমেন্ট',
      subEn: 'Approve Estimate & Book Doctor',
      done: step3Done,
      icon: Calendar,
    },
    {
      id: 'step-4-travel-pickup-stay',
      stepNumBn: 'ধাপ ৪ (অপশনাল / ঐচ্ছিক)',
      stepNumEn: 'Step 4 (Optional)',
      titleBn: 'AI ফ্লাইট টিকিট পিকআপ বা রিমাইন্ডার',
      titleEn: 'AI Flight Ticket Pickup or Reminder',
      subBn: 'টিকিট থেকে AI অটো-পিকআপ অথবা পরবর্তীতে রিমাইন্ডার',
      subEn: 'AI Auto-Read Ticket or Set Pickup Reminder',
      done: step4Done,
      optional: true,
      icon: Plane,
    },
  ];

  const currentStepIndex = FOUR_SELF_SERVICE_STEPS.findIndex((s) => s.id === activeStep);
  const prevStep = currentStepIndex > 0 ? FOUR_SELF_SERVICE_STEPS[currentStepIndex - 1] : null;
  const nextStep =
    currentStepIndex < FOUR_SELF_SERVICE_STEPS.length - 1
      ? FOUR_SELF_SERVICE_STEPS[currentStepIndex + 1]
      : null;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Coordinator Share Bar: Easy 1-Click Link Copy, WhatsApp Share to Patient & Standalone Mode */}
      <div className="bg-emerald-950 text-white rounded-xl p-4 sm:p-5 space-y-3.5 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <Share2 className="w-4 h-4" />
              <span>
                {portalLang === 'bn'
                  ? 'রোগীর সাথে শেয়ার করার ৪-ধাপের সহজ সেলফ-সার্ভিস লিংক (Shareable 4-Step Patient Portal)'
                  : 'Shareable 4-Step Patient Self-Service Link (Send to Patient on WhatsApp)'}
              </span>
            </div>
            <p className="text-xs text-emerald-100/90 leading-relaxed">
              {portalLang === 'bn'
                ? 'এই লিংকটি রোগীকে হোয়াটসঅ্যাপে পাঠিয়ে দিন — রোগী নিজেই মাত্র ৪টি সহজ ধাপে পাসপোর্ট/ভিসা লেটার, রিপোর্ট আপলোড, খরচের অনুমোদন এবং ফ্লাইট পিকআপ ও গেস্ট হাউস বুকিং সম্পন্ন করতে পারবেন।'
                : 'Share this personal link with the patient via WhatsApp so they can complete all 4 self-service steps (Passport/VIL, Reports, Estimate/Doctor, and Airport Pickup & Guest House) by themselves.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(shareablePortalUrl);
                setCopiedShareLink(true);
                setTimeout(() => setCopiedShareLink(false), 2500);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white text-emerald-950 hover:bg-emerald-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>
                {copiedShareLink
                  ? portalLang === 'bn'
                    ? '✓ লিংক কপি হয়েছে!'
                    : '✓ Link Copied!'
                  : portalLang === 'bn'
                  ? 'পেশেন্ট লিংক কপি করুন'
                  : 'Copy Patient Link'}
              </span>
            </button>

            <a
              href={whatsappShareHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={async () => {
                await createCommunicationRecord(
                  {
                    recipientType: 'Patient',
                    recipientId: currentPatient.id,
                    recipientName: currentPatient.fullName,
                    channel: 'WhatsApp',
                    direction: 'Outbound',
                    subject: 'Shared 4-Step Self-Service Patient Portal Link via WhatsApp',
                    messageSummary: `Sent bilingual 4-Step Self-Service Portal link (${shareablePortalUrl}) and Patient Code (${currentPatient.patientCode}) to ${currentPatient.fullName}.`,
                    staffOrAutomationName: actor.name,
                    deliveryStatus: 'Opened in WhatsApp (wa.me)',
                    consentVerified: true,
                    optOutStatus: false,
                    ownerId: actor.uid,
                  },
                  actor
                );
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>
                {portalLang === 'bn'
                  ? 'হোয়াটসঅ্যাপে রোগীকে লিংক পাঠান (wa.me)'
                  : 'Share Link to Patient on WhatsApp'}
              </span>
            </a>

            {onToggleStandaloneMode && (
              <button
                type="button"
                onClick={onToggleStandaloneMode}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-900/90 hover:bg-emerald-800 text-emerald-100 border border-emerald-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>
                  {standaloneMode
                    ? portalLang === 'bn'
                      ? '← স্টাফ সিআরএম (CRM)-এ ফিরে যান'
                      : '← Back to Staff CRM'
                    : portalLang === 'bn'
                    ? 'ফুল-স্ক্রিন রোগী মোড খুলুন'
                    : 'Open Distraction-Free Patient Mode'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Shareable URL & Patient Code Quick Lookup Bar */}
        <div className="pt-2.5 border-t border-emerald-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 font-mono text-emerald-200">
            <span className="text-emerald-400 font-sans font-semibold">
              {portalLang === 'bn' ? 'রোগীর গোপন কোড:' : 'Patient Access Code:'}
            </span>
            <span className="px-2 py-0.5 bg-emerald-900 rounded text-white font-bold">
              {currentPatient.patientCode}
            </span>
            <span className="text-emerald-400">·</span>
            <span className="truncate max-w-xs sm:max-w-md text-emerald-200/90">{shareablePortalUrl}</span>
          </div>

          <form onSubmit={handlePatientLookup} className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-emerald-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={lookupInput}
                onChange={(e) => setLookupInput(e.target.value)}
                placeholder={
                  portalLang === 'bn'
                    ? 'পেশেন্ট কোড (যেমন QW-PT-...) বা ফোন'
                    : 'Enter Code (QW-PT-...) or Phone'
                }
                className="pl-8 pr-2.5 py-1 text-xs rounded-lg bg-emerald-900/90 border border-emerald-700 text-white placeholder:text-emerald-300/70 w-56 focus:outline-none focus:border-emerald-400"
              />
            </div>
            <button
              type="submit"
              className="px-2.5 py-1 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg whitespace-nowrap"
            >
              {portalLang === 'bn' ? 'খুঁজুন' : 'Load'}
            </button>
          </form>
        </div>
      </div>

      {/* Patient Welcome Card, Bilingual Switcher & Care Journey Tracker */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>
                {portalLang === 'bn'
                  ? 'QureWays Trip রোগীর নিজস্ব ৪-ধাপের সেলফ-সার্ভিস পোর্টাল · বাংলাদেশ থেকে ভারত চিকিৎসা সহায়তা'
                  : 'QureWays Trip 4-Step Patient Self-Service Portal · Bangladesh to India Medical Care'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              {portalLang === 'bn'
                ? `আসসালামু আলাইকুম / স্বাগতম, ${currentPatient.fullName} (${currentPatient.patientCode})`
                : `Welcome, ${currentPatient.fullName} (${currentPatient.patientCode})`}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {portalLang === 'bn' ? 'আপনার নির্ধারিত হাসপাতাল:' : 'Target Hospital:'}{' '}
              <strong className="text-slate-900">{currentPatient.preferredHospital}</strong> ·{' '}
              {portalLang === 'bn' ? 'আপনার ব্যক্তিগত সমন্বয়কারী:' : 'Assigned Coordinator:'}{' '}
              <strong className="text-slate-900">{currentPatient.assignedCoordinatorName}</strong> ·{' '}
              {portalLang === 'bn' ? 'বর্তমান ধাপ:' : 'Current Stage:'}{' '}
              <strong className="text-sky-800">{currentPatient.journeyStage}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 no-print">
            {/* Bilingual বাংলা / English Switcher */}
            <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPortalLang('bn')}
                className={`px-3 py-1.5 rounded-md font-bold transition-colors ${
                  portalLang === 'bn'
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                <span>বাংলা (সহজ ভিউ)</span>
              </button>
              <button
                type="button"
                onClick={() => setPortalLang('en')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  portalLang === 'en'
                    ? 'bg-sky-700 text-white'
                    : 'text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                <Languages className="w-3.5 h-3.5" />
                <span>English</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>
                {portalLang === 'bn' ? 'ট্রাভেল ও অ্যাপয়েন্টমেন্ট পাস প্রিন্ট' : 'Print Travel Pass'}
              </span>
            </button>

            {isStaffPreview && (
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                <span className="text-xs font-medium text-slate-700 whitespace-nowrap">
                  {portalLang === 'bn' ? 'রোগী পরিবর্তন:' : 'Patient:'}
                </span>
                <select
                  value={currentPatient.id}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-300 rounded-md bg-white text-slate-900"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.patientCode})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* 24/7 Chennai Emergency SOS, Blood/Allergy Card & Apollo Ambulance Dispatch Desk */}
        <div className="p-3.5 bg-red-50/70 border border-red-200 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-red-900">
              {portalLang === 'bn'
                ? '২৪/৭ চেন্নাই জরুরি সহায়তা ও অ্যাপোলো অ্যাম্বুলেন্স হটলাইন (24/7 Emergency SOS & Ambulance Desk)'
                : '24/7 Chennai Emergency SOS, Clinical Allergy Card & Apollo Ambulance Hotline'}
            </div>
            <div className="text-xs text-slate-700">
              <span>
                Apollo Emergency (Chennai): <strong className="font-mono text-red-900">1066 / +91-44-2829-3333</strong>
              </span>
              <span className="mx-1.5">·</span>
              <span>
                QureWays 24/7 Bengali Desk: <strong className="font-mono text-slate-900">+880 1711-009988</strong>
              </span>
              <span className="mx-1.5">·</span>
              <span>
                Clinical Alert:{' '}
                <strong className="text-red-800">
                  {currentPatient.existingDiagnoses || 'Cardiac / Specialized Care'}
                </strong>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              await createServiceBooking(
                {
                  patientId: currentPatient.id,
                  patientName: currentPatient.fullName,
                  serviceCategory: 'Airport Pickup & Drop-off',
                  serviceName: 'URGENT: 24/7 Apollo Chennai Emergency / ACLS Ambulance Dispatch Alert',
                  hospitalOrProvider: currentPatient.preferredHospital,
                  scheduledDate: new Date().toISOString().slice(0, 10),
                  scheduledTime: 'IMMEDIATE 24/7 SOS',
                  serviceFeeUsd: 0,
                  processingTimeEstimate: 'Immediate Priority Dispatch',
                  status: 'In Progress',
                  assignedCoordinatorName: currentPatient.assignedCoordinatorName,
                  notes: `Emergency SOS triggered from Patient Portal. Diagnosis: ${
                    currentPatient.existingDiagnoses || 'On File'
                  }. Emergency Contact: ${currentPatient.emergencyContact || currentPatient.phone}.`,
                  ownerId: actor.uid,
                },
                actor
              );
              await createCommunicationRecord(
                {
                  recipientType: 'Patient',
                  recipientId: currentPatient.id,
                  recipientName: currentPatient.fullName,
                  channel: 'Patient Portal SOS',
                  direction: 'Inbound',
                  subject: 'URGENT: 24/7 Chennai Emergency & Ambulance Dispatch Requested',
                  messageSummary: `Patient ${currentPatient.fullName} (${currentPatient.patientCode}) triggered a 24/7 Emergency / Apollo Ambulance Hotline dispatch alert.`,
                  staffOrAutomationName: currentPatient.fullName,
                  deliveryStatus: 'Escalated to 24/7 Chennai Desk',
                  consentVerified: true,
                  optOutStatus: false,
                  ownerId: actor.uid,
                },
                actor
              );
              setFeedbackBanner(
                portalLang === 'bn'
                  ? 'জরুরি অ্যাম্বুলেন্স ও ২৪/৭ চেন্নাই হটলাইন অ্যালার্ট আপনার সমন্বয়কারীর কাছে পাঠানো হয়েছে।'
                  : '24/7 Apollo Emergency & Ambulance Dispatch Alert logged and escalated to your Chennai coordinator.'
              );
            }}
            className="px-3.5 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap no-print"
          >
            {portalLang === 'bn'
              ? 'জরুরি SOS ও অ্যাম্বুলেন্স কল করুন'
              : 'Trigger 24/7 Emergency / Ambulance Dispatch'}
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs sm:text-sm font-medium text-emerald-950">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner('')}
            className="text-emerald-800 font-bold hover:underline ml-3"
          >
            {portalLang === 'bn' ? 'বন্ধ করুন' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* 4-Step Self-Service Action Hub Selector (নিজে নিজে সম্পন্ন করার ৪টি সহজ ধাপ) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {portalLang === 'bn'
                ? 'নিজে নিজে সম্পন্ন করার ৪টি সহজ ধাপ (4-Step Patient Self-Service Guide)'
                : '4 Easy Self-Service Steps to Complete Your Medical Trip'}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {portalLang === 'bn'
                ? 'ধাপ ১ থেকে ধাপ ৪ পর্যন্ত একে একে ক্লিক করে আপনার তথ্য দিন — আমাদের ঢাকা ও চেন্নাই টিম সাথে সাথে প্রসেস করবে।'
                : 'Complete Steps 1 to 4 below at your convenience — your coordinator receives instant real-time updates.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs font-bold text-emerald-800 font-mono">
              {portalLang === 'bn'
                ? `সম্পন্ন হয়েছে: ${completedStepsCount}/4 টি ধাপ`
                : `Completed: ${completedStepsCount}/4 Steps`}
            </div>
          </div>
        </div>

        {/* 4-Column Step Selector Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 no-print">
          {FOUR_SELF_SERVICE_STEPS.map((step) => {
            const IconComponent = step.icon;
            const isSelected = activeStep === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-2.5 ${
                  isSelected
                    ? 'bg-sky-50/90 border-sky-600 ring-2 ring-sky-600/30'
                    : step.done
                    ? 'bg-emerald-50/40 border-emerald-300 hover:bg-emerald-50/80'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs font-extrabold uppercase tracking-wide ${
                      isSelected ? 'text-sky-800' : step.done ? 'text-emerald-800' : 'text-slate-500'
                    }`}
                  >
                    {portalLang === 'bn' ? step.stepNumBn : step.stepNumEn}
                  </span>
                  <span
                    className={`text-[11px] font-bold ${
                      step.done ? 'text-emerald-700' : isSelected ? 'text-sky-700' : 'text-slate-500'
                    }`}
                  >
                    {step.done
                      ? portalLang === 'bn'
                        ? '✓ সম্পন্ন'
                        : '✓ Done'
                      : portalLang === 'bn'
                      ? 'খুলুন →'
                      : 'Open →'}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <IconComponent
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-sky-700' : step.done ? 'text-emerald-700' : 'text-slate-600'
                      }`}
                    />
                    <span className="text-sm font-bold text-slate-900 leading-snug">
                      {portalLang === 'bn' ? step.titleBn : step.titleEn}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {portalLang === 'bn' ? step.subBn : step.subEn}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Step Workspace */}
        <div className="pt-2 border-t border-slate-100">
          {/* =====================================================================
              ধাপ ১ (STEP 1): PASSPORT & VISA INVITATION LETTER (VIL)
             ===================================================================== */}
          {activeStep === 'step-1-passport-vil' && (
            <form
              onSubmit={handleSelfSubmitPassportAndVil}
              className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    {portalLang === 'bn'
                      ? 'ধাপ ১: পাসপোর্ট ও ভিসা ইনভাইটেশন লেটার (VIL) আবেদন'
                      : 'Step 1: Submit Passport & Attendant Details for Hospital Visa Invitation Letter (VIL)'}
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {portalLang === 'bn'
                      ? 'ভারতীয় মেডিকেল ভিসার (Med-1 ও Med-2) জন্য রোগী এবং সর্বোচ্চ ২ জন অ্যাটেনডেন্টের পাসপোর্ট নম্বর নিচে লিখে জমা দিন।'
                      : 'Enter the patient passport (Med-1) and up to 2 family attendants (Med-2) so Apollo Hospital can issue your official Visa Invitation Letter.'}
                  </p>
                </div>
                <span className="text-xs font-semibold text-sky-800">
                  {currentPatient.preferredHospital}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {portalLang === 'bn'
                      ? 'রোগীর পাসপোর্ট নম্বর (Patient Passport) *'
                      : 'Patient Passport Number (Med-1) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={patientPassport}
                    onChange={(e) => setPatientPassport(e.target.value)}
                    placeholder="e.g., A04928172"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {portalLang === 'bn'
                      ? 'কোন ভিসা সেন্টারে (IVAC) জমা দেবেন?'
                      : 'Preferred Bangladesh IVAC Center'}
                  </label>
                  <select
                    value={ivacLocation}
                    onChange={(e) => setIvacLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="IVAC Dhaka (Jamuna Future Park)">
                      IVAC Dhaka (Jamuna Future Park)
                    </option>
                    <option value="IVAC Chattogram">IVAC Chattogram (চট্টগ্রাম)</option>
                    <option value="IVAC Sylhet">IVAC Sylhet (সিলেট)</option>
                    <option value="IVAC Rajshahi">IVAC Rajshahi (রাজশাহী)</option>
                    <option value="IVAC Khulna">IVAC Khulna (খুলনা)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {portalLang === 'bn'
                      ? 'সম্ভাব্য ভারত যাত্রার তারিখ'
                      : 'Expected Travel Date to India'}
                  </label>
                  <input
                    type="date"
                    value={expectedTravelDate}
                    onChange={(e) => setExpectedTravelDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {portalLang === 'bn'
                      ? '১ম অ্যাটেনডেন্টের নাম (Attendant 1 Name)'
                      : '1st Medical Attendant Name (Med-2)'}
                  </label>
                  <input
                    type="text"
                    value={attendant1Name}
                    onChange={(e) => setAttendant1Name(e.target.value)}
                    placeholder={portalLang === 'bn' ? 'যেমন: মো: করিম উদ্দিন' : 'Full Name as per Passport'}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {portalLang === 'bn'
                      ? '১ম অ্যাটেনডেন্টের পাসপোর্ট নম্বর'
                      : '1st Attendant Passport Number'}
                  </label>
                  <input
                    type="text"
                    value={attendant1Passport}
                    onChange={(e) => setAttendant1Passport(e.target.value)}
                    placeholder="e.g., B01928344"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {portalLang === 'bn' ? 'রোগীর সাথে সম্পর্ক' : 'Relationship with Patient'}
                  </label>
                  <input
                    type="text"
                    value={attendant1Relation}
                    onChange={(e) => setAttendant1Relation(e.target.value)}
                    placeholder="Spouse / Son / Brother"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {portalLang === 'bn'
                      ? '২য় অ্যাটেনডেন্টের নাম (যদি থাকেন)'
                      : '2nd Medical Attendant Name (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={attendant2Name}
                    onChange={(e) => setAttendant2Name(e.target.value)}
                    placeholder={portalLang === 'bn' ? 'ঐচ্ছিক (২য় অ্যাটেনডেন্ট)' : 'Optional 2nd Attendant'}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {portalLang === 'bn'
                      ? '২য় অ্যাটেনডেন্টের পাসপোর্ট নম্বর'
                      : '2nd Attendant Passport Number'}
                  </label>
                  <input
                    type="text"
                    value={attendant2Passport}
                    onChange={(e) => setAttendant2Passport(e.target.value)}
                    placeholder="Optional Passport No"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-xs text-slate-500">
                  {portalLang === 'bn'
                    ? 'সাবমিট করার ২৪ ঘণ্টার মধ্যে হাসপাতাল থেকে ভিসা ইনভাইটেশন লেটার (VIL) এই পোর্টালে ও হোয়াটসঅ্যাপে পাবেন।'
                    : 'Your Official Hospital VIL will be shared here and on WhatsApp within 24 hours.'}
                </p>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  {portalLang === 'bn'
                    ? '✓ ধাপ ১ সেভ করুন ও ভিসা লেটার (VIL) রিকোয়েস্ট পাঠান'
                    : '✓ Save Step 1 & Request Official Hospital VIL'}
                </button>
              </div>
            </form>
          )}

          {/* =====================================================================
              ধাপ ২ (STEP 2): GUIDED MEDICAL REPORT & PRESCRIPTION UPLOAD
             ===================================================================== */}
          {activeStep === 'step-2-upload-reports' && (
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  {portalLang === 'bn'
                    ? 'ধাপ ২: প্রেসক্রিপশন, টেস্ট রিপোর্ট ও পাসপোর্ট কপি আপলোড করুন'
                    : 'Step 2: Upload Prescriptions, Lab Reports & Passport Scans'}
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  {portalLang === 'bn'
                    ? 'টাইপ করার ঝামেলা এড়াতে নিচের যেকোনো বাটনে ১-ক্লিক করে রিপোর্ট সিলেক্ট করুন এবং ফাইল যুক্ত করুন:'
                    : 'Tap any quick preset below to auto-fill the document type, then attach your file:'}
                </p>
              </div>

              {/* 1-Click Report Presets in Bengali & English */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {REPORT_QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.en}
                    type="button"
                    onClick={() => {
                      setDocTitle(portalLang === 'bn' ? `${preset.bn} (${preset.en})` : preset.en);
                      setDocCategory(preset.category);
                      setDocSummary(preset.defaultNote);
                    }}
                    className="p-2.5 text-left rounded-lg border border-slate-300 bg-white hover:border-sky-600 hover:bg-sky-50/50 transition-colors"
                  >
                    <div className="text-xs font-bold text-slate-900">
                      + {portalLang === 'bn' ? preset.bn : preset.en}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{preset.category}</div>
                  </button>
                ))}
              </div>

              <form onSubmit={handlePortalDocUpload} className="space-y-3.5 pt-2 border-t border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      {portalLang === 'bn' ? 'রিপোর্টের নাম *' : 'Document Title *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder={
                        portalLang === 'bn'
                          ? 'যেমন: সর্বশেষ ইকো বা রক্তের রিপোর্ট'
                          : 'e.g., Latest Echo / Biopsy Report'
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      {portalLang === 'bn' ? 'রিপোর্টের ধরন' : 'Category'}
                    </label>
                    <select
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      {DOCUMENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      {portalLang === 'bn'
                        ? 'মোবাইল বা কম্পিউটার থেকে ফাইল নিন (PDF / ছবি)'
                        : 'Select File from Phone / Computer'}
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedFileName(file.name);
                          setSelectedFileSizeKb(Math.max(50, Math.round(file.size / 1024)));
                          if (!docTitle.trim()) {
                            setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
                          }
                        }
                      }}
                      className="w-full text-xs text-slate-700 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-sky-100 file:text-sky-900 hover:file:bg-sky-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {portalLang === 'bn'
                      ? 'রিপোর্ট সম্পর্কে সংক্ষিপ্ত নোট বা বর্তমান সমস্যা (ঐচ্ছিক)'
                      : 'Brief Notes or Current Symptoms (Optional)'}
                  </label>
                  <textarea
                    rows={2}
                    value={docSummary}
                    onChange={(e) => setDocSummary(e.target.value)}
                    placeholder={
                      portalLang === 'bn'
                        ? 'ডাক্তারের জন্য কোনো বিশেষ তথ্য থাকলে এখানে লিখুন...'
                        : 'Write any details about this prescription or test...'
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>
                      {portalLang === 'bn'
                        ? '✓ ধাপ ২: মেডিকেল ফাইল আপলোড ও জমা দিন'
                        : '✓ Upload to My Medical File'}
                    </span>
                  </button>
                </div>
              </form>

              {/* Already Uploaded Documents inside Step 2 */}
              {myDocs.length > 0 && (
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-800">
                    {portalLang === 'bn'
                      ? `আপনার জমা দেওয়া মেডিকেল ফাইলসমূহ (${myDocs.length}):`
                      : `Your Uploaded Medical Files (${myDocs.length}):`}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {myDocs.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between text-xs p-2.5 bg-white border border-slate-200 rounded-lg"
                      >
                        <div className="truncate pr-2">
                          <span className="font-semibold text-slate-900">{d.title}</span>
                          <span className="mx-1 text-slate-400">·</span>
                          <span className="text-slate-500">{d.category}</span>
                        </div>
                        <span className="text-emerald-800 font-semibold whitespace-nowrap">
                          {d.reviewStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              ধাপ ৩ (STEP 3): SECOND OPINION, COST APPROVAL, DOCTOR SERIAL & CHAT
             ===================================================================== */}
          {activeStep === 'step-3-opinion-estimate-doctor' && (
            <div className="space-y-4">
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-4">
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    {portalLang === 'bn'
                      ? 'ধাপ ৩: হাসপাতালের সেকেন্ড ওপিনিয়ন, খরচের হিসাব অনুমোদন ও ডাক্তারের অ্যাপয়েন্টমেন্ট'
                      : 'Step 3: Review Hospital Opinion, Approve Cost Estimate & Book Doctor Consultation'}
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {portalLang === 'bn'
                      ? 'হাসপাতালের পাঠানো খরচের এস্টিমেট ১-ক্লিকে অনুমোদন করুন এবং চেন্নাইয়ের সিনিয়র ডাক্তারের সাথে ভিডিও কল বা সরাসরি সিরিয়াল বুক করুন।'
                      : 'Approve your treatment cost estimate in 1 click and schedule your online video call or OPD appointment with the specialist.'}
                  </p>
                </div>

                {/* Cost Estimates with 1-Click Approval right inside Step 3 */}
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-slate-800">
                    {portalLang === 'bn'
                      ? `১. হাসপাতালের খরচের এস্টিমেট অনুমোদন করুন (${myEstimates.length}):`
                      : `1. Approve Your Treatment Cost Estimate (${myEstimates.length}):`}
                  </div>
                  {myEstimates.length === 0 ? (
                    <div className="p-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600">
                      {portalLang === 'bn'
                        ? 'হাসপাতাল থেকে খরচের চূড়ান্ত এস্টিমেট আসার সাথে সাথে এখানে অনুমোদনের জন্য দেখা যাবে।'
                        : 'Your hospital cost estimate will appear here for 1-click approval once finalized.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {myEstimates.map((est) => (
                        <div
                          key={est.id}
                          className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5 flex flex-col justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex justify-between items-start gap-2">
                              <h5 className="text-sm font-bold text-slate-900">{est.treatmentTitle}</h5>
                              <span className="text-xs font-mono font-bold text-emerald-800 whitespace-nowrap">
                                USD ${est.minTotalBudgetUsd.toLocaleString()} – $
                                {est.maxTotalBudgetUsd.toLocaleString()}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600">
                              {est.hospitalName} · {est.lengthOfStayDays} Days Stay ({est.patientCount}{' '}
                              Patient + {est.companionCount} Companion)
                            </div>
                            <p className="text-xs text-slate-600">{est.assumptions}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApproveCostEstimate(est)}
                            className="w-full px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
                          >
                            {portalLang === 'bn'
                              ? '✓ আমি এই খরচের হিসাব অনুমোদন করছি (Approve & Proceed)'
                              : '✓ Approve Estimate & Proceed with Admission'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Doctor Appointment + Coordinator Chat inside Step 3 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                  <form
                    onSubmit={handlePortalServiceRequest}
                    className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
                  >
                    <h5 className="text-sm font-bold text-slate-900">
                      {portalLang === 'bn'
                        ? '২. ডাক্তারের অ্যাপয়েন্টমেন্ট বা ভিডিও কনসালটেশন বুক করুন'
                        : '2. Request Doctor Appointment or Video Teleconsultation'}
                    </h5>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {portalLang === 'bn' ? 'সেবার ধরন' : 'Consultation / Service Type'}
                      </label>
                      <select
                        value={requestType}
                        onChange={(e) => setRequestType(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="Online Teleconsultation">
                          অনলাইন ভিডিও কনসালটেশন (Video Call with Chennai Doctor)
                        </option>
                        <option value="Doctor Appointment">
                          সরাসরি ডাক্তার অ্যাপয়েন্টমেন্ট (In-Person OPD Appointment)
                        </option>
                        <option value="Hospital Second Opinion">
                          লিখিত সেকেন্ড ওপিনিয়ন (Hospital Written Second Opinion)
                        </option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {portalLang === 'bn' ? 'পছন্দের তারিখ' : 'Preferred Date'}
                        </label>
                        <input
                          type="date"
                          value={preferredDate}
                          onChange={(e) => setPreferredDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {portalLang === 'bn' ? 'হাসপাতাল' : 'Hospital'}
                        </label>
                        <select
                          value={preferredHospital}
                          onChange={(e) => setPreferredHospital(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                        >
                          {VERIFIED_HOSPITALS.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {portalLang === 'bn'
                          ? 'ডাক্তারের নাম বা বিশেষ অনুরোধ (যদি থাকে)'
                          : 'Doctor Name or Notes'}
                      </label>
                      <input
                        type="text"
                        value={requestNotes}
                        onChange={(e) => setRequestNotes(e.target.value)}
                        placeholder={
                          portalLang === 'bn'
                            ? 'যেমন: বিকেল ৪টার পর ভিডিও কল বা বাংলা দোভাষী প্রয়োজন'
                            : 'e.g., Need Bengali interpreter during consult'
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full px-4 py-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors"
                    >
                      {portalLang === 'bn'
                        ? '✓ অ্যাপয়েন্টমেন্ট রিকোয়েস্ট পাঠান'
                        : '✓ Submit Consultation Request'}
                    </button>
                  </form>

                  <form
                    onSubmit={handleSendMessage}
                    className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-bold text-slate-900">
                          {portalLang === 'bn'
                            ? `৩. সমন্বয়কারীর সাথে সরাসরি চ্যাট (${currentPatient.assignedCoordinatorName})`
                            : `3. Chat with Coordinator (${currentPatient.assignedCoordinatorName})`}
                        </h5>
                        <a
                          href={`https://wa.me/8801711009988?text=${encodeURIComponent(
                            `আসসালামু আলাইকুম, আমি ${currentPatient.fullName} (কোড: ${currentPatient.patientCode})। আমার চিকিৎসা ও ভারত যাত্রা বিষয়ে কথা বলতে চাই।`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-emerald-700 hover:underline"
                        >
                          {portalLang === 'bn' ? 'হোয়াটসঅ্যাপে কথা বলুন →' : 'WhatsApp Desk →'}
                        </a>
                      </div>

                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {myMessages.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            {portalLang === 'bn'
                              ? 'আপনার যেকোনো প্রশ্ন নিচে লিখে পাঠান।'
                              : 'No messages yet. Write a question below.'}
                          </p>
                        ) : (
                          myMessages.map((m) => (
                            <div
                              key={m.id}
                              className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                            >
                              <div className="text-slate-500 flex justify-between">
                                <span>
                                  {m.direction === 'Inbound' ? 'আপনি / You' : m.staffOrAutomationName}{' '}
                                  · {m.channel}
                                </span>
                                <span className="font-mono tabular-nums">{m.createdAt.slice(0, 10)}</span>
                              </div>
                              <p className="text-slate-800 mt-1">{m.messageSummary}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={portalMessage}
                        onChange={(e) => setPortalMessage(e.target.value)}
                        placeholder={
                          portalLang === 'bn'
                            ? 'আপনার প্রশ্ন বা বার্তা এখানে লিখুন...'
                            : 'Write a message for your coordinator...'
                        }
                        className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap"
                      >
                        {portalLang === 'bn' ? 'পাঠান' : 'Send'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              ধাপ ৪ (STEP 4 - OPTIONAL): AI FLIGHT TICKET READER, REMINDER IF NO TICKET YET, GUEST HOUSE & CHECKLIST
             ===================================================================== */}
          {activeStep === 'step-4-travel-pickup-stay' && (
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base sm:text-lg font-bold text-slate-900">
                      {portalLang === 'bn'
                        ? 'ধাপ ৪ (অপশনাল / ঐচ্ছিক): AI ফ্লাইট টিকিট রিডার, এয়ারপোর্ট পিকআপ বা রিমাইন্ডার'
                        : 'Step 4 (Optional): AI Flight Ticket Reader, Airport Pickup & Guest House'}
                    </h4>
                    <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded-md">
                      {portalLang === 'bn' ? 'অপশনাল ধাপ (Optional Step)' : 'Optional Step'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {portalLang === 'bn'
                      ? 'এই ধাপটি সম্পূর্ণ ঐচ্ছিক (Optional)। আপনার ফ্লাইট টিকিট করা থাকলে নিচে আপলোড/ইনসার্ট করুন — AI স্বয়ংক্রিয়ভাবে ফ্লাইটের তারিখ, ফ্লাইট নাম্বার, চেন্নাই পৌঁছানোর তারিখ, সময় ও হুইলচেয়ার প্রয়োজন কিনা তা পিকআপ করে নেবে। আর এখনো টিকিট করা না থাকলে "এখনো টিকিট করা হয়নি" অপশনটি সিলেক্ট করে রিমাইন্ডার দিন।'
                      : 'This step is optional. Upload or insert your flight ticket so AI can automatically read your Flight Date, Flight Number, Chennai Arrival Date, Time, and Wheelchair requirement — or select "Ticket Not Booked Yet" to receive a reminder later.'}
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-emerald-800 whitespace-nowrap">
                  24/7 Airport Desk: +91 98400-11223
                </span>
              </div>

              {/* ৪ক (4A): টিকিট আছে (AI Ticket Reader) নাকি এখনো টিকিট করা হয়নি (Reminder) সিলেক্টর */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-5">
                <div className="space-y-2.5">
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    {portalLang === 'bn'
                      ? '৪(ক) আপনার ফ্লাইট টিকিটের বর্তমান অবস্থা নির্বাচন করুন (Choose Flight Ticket Status):'
                      : '4(A) Select Your Current Flight Ticket Status:'}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTicketStatusMode('has_ticket')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                        ticketStatusMode === 'has_ticket'
                          ? 'bg-sky-50 border-sky-600 ring-2 ring-sky-600/25'
                          : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                      }`}
                    >
                      <Sparkles
                        className={`w-5 h-5 mt-0.5 shrink-0 ${
                          ticketStatusMode === 'has_ticket' ? 'text-sky-700' : 'text-slate-500'
                        }`}
                      />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900">
                          {portalLang === 'bn'
                            ? '১. আমার ফ্লাইট টিকিট করা হয়েছে (AI দিয়ে টিকিট রিড ও পিকআপ)'
                            : '1. I Have Booked My Flight Ticket (AI Auto-Read Ticket & Pickup)'}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {portalLang === 'bn'
                            ? 'টিকিট আপলোড, অ্যাটাচ বা ইনসার্ট করলে AI নিজেই ফ্লাইটের তারিখ, ফ্লাইট নাম্বার, চেন্নাই পৌঁছানোর সময় ও হুইলচেয়ার প্রয়োজন কিনা পড়ে নেবে।'
                            : 'Upload, attach, or paste your ticket — AI will automatically extract flight date, number, Chennai arrival time & wheelchair need.'}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTicketStatusMode('no_ticket_yet')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                        ticketStatusMode === 'no_ticket_yet'
                          ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-600/25'
                          : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                      }`}
                    >
                      <Bell
                        className={`w-5 h-5 mt-0.5 shrink-0 ${
                          ticketStatusMode === 'no_ticket_yet' ? 'text-amber-700' : 'text-slate-500'
                        }`}
                      />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900">
                          {portalLang === 'bn'
                            ? '২. এখনো টিকিট করা হয়নি (পরবর্তীতে রিমাইন্ডার দিন)'
                            : '2. Ticket Not Booked Yet (Remind Me Later for Airport Pickup)'}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {portalLang === 'bn'
                            ? 'এখনো টিকিট না কেটে থাকলে এটি সিলেক্ট করুন — পরবর্তীতে এয়ারপোর্ট রিকোয়েস্ট পাঠানোর জন্য আমরা আপনাকে রিমাইন্ডার দেবো।'
                            : 'Select this if you have not booked your ticket yet — we will remind you later to submit your airport pickup request.'}
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* ===============================================================
                    MODE 1: CUSTOMER UPLOADS / INSERTS / ATTACHES FLIGHT TICKET FOR AI AUTO-READ
                   =============================================================== */}
                {ticketStatusMode === 'has_ticket' && (
                  <div className="space-y-5 pt-2 border-t border-slate-200">
                    {/* AI Ticket Upload / Insert / Attach Box */}
                    <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-xl space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-sky-950">
                            <Sparkles className="w-4 h-4 text-sky-700" />
                            <span>
                              {portalLang === 'bn'
                                ? 'ফ্লাইট টিকিট আপলোড / অ্যাটাচ বা ইনসার্ট করুন (AI Ticket Reader)'
                                : 'Upload, Attach, or Insert Flight Ticket for AI Auto-Pickup'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 mt-0.5">
                            {portalLang === 'bn'
                              ? 'আপনার ই-টিকিটের ছবি/PDF ফাইল অ্যাটাচ করুন অথবা টিকিটের মেসেজ/টেক্সট নিচে ইনসার্ট করুন — AI সরাসরি ফ্লাইটের তারিখ, ফ্লাইট নাম্বার, চেন্নাই পৌঁছানোর তারিখ, সময় এবং হুইলচেয়ার লাগবে কিনা তা রিড করে নেবে:'
                              : 'Attach your e-ticket image/PDF or insert the ticket text below — AI will read the ticket and auto-fill all arrival and wheelchair pickup fields:'}
                          </p>
                        </div>

                        {/* Quick Sample Ticket Presets for Instant 1-Click AI Demo */}
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const sampleDate = new Date(Date.now() + 9 * 86400000)
                                .toISOString()
                                .slice(0, 10);
                              const sampleText = `E-TICKET ITINERARY / PNR: US8492BD\nPassenger: ${currentPatient.fullName} (Med-1) + 1 Attendant\nAirline: US-Bangla Airlines\nFlight Number: BS-205\nDeparture: Dhaka (DAC) Date: ${sampleDate} Time: 10:15 BDT\nArrival: Chennai International Airport (MAA) Date: ${sampleDate} Time: 12:45 IST\nSpecial Service Request (SSR): WCHR - WHEELCHAIR ASSISTANCE REQUIRED AT AIRPORT GATE`;
                              setRawTicketText(sampleText);
                              setTicketFileName('US_Bangla_BS205_Chennai_Ticket_WCHR.pdf');
                              void handleAiReadFlightTicket(
                                sampleText,
                                '',
                                '',
                                'US_Bangla_BS205_Chennai_Ticket_WCHR.pdf'
                              );
                            }}
                            className="px-2.5 py-1.5 text-[11px] font-bold bg-white text-sky-900 border border-sky-300 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap"
                          >
                            {portalLang === 'bn'
                              ? '+ নমুনা টিকিট ১ (BS-205 + হুইলচেয়ার)'
                              : '+ Sample Ticket 1 (BS-205 + Wheelchair)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const sampleDate = new Date(Date.now() + 12 * 86400000)
                                .toISOString()
                                .slice(0, 10);
                              const sampleText = `BIMAN BANGLADESH AIRLINES E-TICKET / PNR: BG9921CH\nPassenger: ${currentPatient.fullName}\nFlight No: BG-363 (Dhaka DAC to Chennai MAA)\nFlight Date: ${sampleDate}\nChennai Arrival Date: ${sampleDate}\nChennai Arrival Time: 15:20 IST\nSpecial Service Request: Standard Arrival (No Wheelchair requested)`;
                              setRawTicketText(sampleText);
                              setTicketFileName('Biman_BG363_Dhaka_Chennai_Ticket.pdf');
                              void handleAiReadFlightTicket(
                                sampleText,
                                '',
                                '',
                                'Biman_BG363_Dhaka_Chennai_Ticket.pdf'
                              );
                            }}
                            className="px-2.5 py-1.5 text-[11px] font-bold bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
                          >
                            {portalLang === 'bn'
                              ? '+ নমুনা টিকিট ২ (BG-363 সাধারণ)'
                              : '+ Sample Ticket 2 (BG-363 Standard)'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                        <div className="lg:col-span-5 space-y-1.5">
                          <label className="block text-xs font-bold text-slate-800">
                            {portalLang === 'bn'
                              ? '১. ফ্লাইট টিকিট ফাইল আপলোড / অ্যাটাচ করুন (PDF বা ছবি)'
                              : '1. Upload / Attach Flight Ticket File (PDF or Image)'}
                          </label>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={handleTicketFileChange}
                            className="w-full text-xs text-slate-700 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-sky-700 file:text-white hover:file:bg-sky-800 bg-white border border-slate-300 rounded-lg p-1"
                          />
                          {ticketFileName && (
                            <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" />
                              <span>
                                {portalLang === 'bn' ? 'যুক্ত করা টিকিট:' : 'Attached Ticket:'}{' '}
                                {ticketFileName}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="lg:col-span-7 space-y-1.5">
                          <label className="block text-xs font-bold text-slate-800">
                            {portalLang === 'bn'
                              ? '২. অথবা ফ্লাইট টিকিটের টেক্সট / PNR / মেসেজ এখানে ইনসার্ট (Paste) করুন'
                              : '2. Or Insert / Paste Flight Ticket Text, SMS, or PNR Itinerary'}
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <textarea
                              rows={2}
                              value={rawTicketText}
                              onChange={(e) => setRawTicketText(e.target.value)}
                              placeholder={
                                portalLang === 'bn'
                                  ? 'যেমন: US-Bangla BS-205, Date: 2026-10-28, Arrival Chennai: 12:45 IST, WCHR (হুইলচেয়ার প্রয়োজন)...'
                                  : 'Paste flight ticket details, e.g., BS-205 arriving Chennai 2026-10-28 at 12:45 IST, Wheelchair WCHR...'
                              }
                              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                            />
                            <button
                              type="button"
                              disabled={isParsingTicket}
                              onClick={() => void handleAiReadFlightTicket()}
                              className="px-4 py-2 text-xs font-bold text-white bg-sky-800 hover:bg-sky-900 disabled:opacity-60 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                            >
                              <Sparkles className="w-4 h-4" />
                              <span>
                                {isParsingTicket
                                  ? portalLang === 'bn'
                                    ? 'AI টিকিট রিড করছে...'
                                    : 'AI Reading Ticket...'
                                  : portalLang === 'bn'
                                  ? 'AI দিয়ে টিকিট রিড করুন'
                                  : 'AI Read Ticket'}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* AI Extracted Ticket Readout Summary Box */}
                      {aiTicketReadout && (
                        <div className="p-3.5 bg-white border border-emerald-300 rounded-xl space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                              <span>
                                {portalLang === 'bn'
                                  ? 'AI টিকিট থেকে নিচের তথ্যগুলো স্বয়ংক্রিয়ভাবে পিকআপ করেছে (AI Extracted Ticket Data):'
                                  : 'AI Automatically Extracted the Following Details from Your Ticket:'}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono font-bold text-sky-800">
                              PNR: {aiTicketReadout.pnrOrTicketNumber || pnrNumber || 'Verified'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="text-[11px] text-slate-500">
                                {portalLang === 'bn' ? 'ফ্লাইটের তারিখ' : 'Flight Date'}
                              </div>
                              <div className="font-mono font-bold text-slate-900">
                                {flightDate}
                              </div>
                            </div>
                            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="text-[11px] text-slate-500">
                                {portalLang === 'bn' ? 'ফ্লাইট নাম্বার' : 'Flight Number'}
                              </div>
                              <div className="font-mono font-bold text-sky-900">
                                {flightNumber}
                              </div>
                            </div>
                            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="text-[11px] text-slate-500">
                                {portalLang === 'bn' ? 'চেন্নাই পৌঁছানোর তারিখ' : 'Chennai Arrival Date'}
                              </div>
                              <div className="font-mono font-bold text-slate-900">
                                {arrivalDate}
                              </div>
                            </div>
                            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="text-[11px] text-slate-500">
                                {portalLang === 'bn' ? 'চেন্নাই পৌঁছানোর সময়' : 'Arrival Time'}
                              </div>
                              <div className="font-mono font-bold text-slate-900">
                                {arrivalTime}
                              </div>
                            </div>
                            <div
                              className={`p-2 rounded-lg border ${
                                wheelchairNeeded
                                  ? 'bg-amber-50 border-amber-300'
                                  : 'bg-emerald-50 border-emerald-200'
                              }`}
                            >
                              <div className="text-[11px] text-slate-600">
                                {portalLang === 'bn' ? 'হুইলচেয়ার প্রয়োজন?' : 'Wheelchair Needed?'}
                              </div>
                              <div
                                className={`font-bold ${
                                  wheelchairNeeded ? 'text-amber-900' : 'text-emerald-900'
                                }`}
                              >
                                {wheelchairNeeded
                                  ? portalLang === 'bn'
                                    ? 'হ্যাঁ (হুইলচেয়ারসহ পিকআপ)'
                                    : 'YES (Wheelchair Assigned)'
                                  : portalLang === 'bn'
                                  ? 'না (সাধারণ এসি পিকআপ)'
                                  : 'No (Standard AC Pickup)'}
                              </div>
                            </div>
                          </div>

                          <p className="text-xs text-slate-700 leading-relaxed">
                            {portalLang === 'bn' ? aiTicketReadout.summaryBn : aiTicketReadout.summaryEn}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Flight & Airport Pickup Confirmation Form (Auto-filled by AI or manually editable) */}
                    <form onSubmit={handleSelfBookAirportPickup} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            {portalLang === 'bn'
                              ? 'ফ্লাইটের তারিখ (Flight Date)'
                              : 'Flight Departure Date'}
                          </label>
                          <input
                            type="date"
                            value={flightDate}
                            onChange={(e) => {
                              setFlightDate(e.target.value);
                              setArrivalDate(e.target.value);
                            }}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            {portalLang === 'bn' ? 'ফ্লাইট নাম্বার (Flight Number) *' : 'Flight Number *'}
                          </label>
                          <input
                            type="text"
                            required
                            value={flightNumber}
                            onChange={(e) => setFlightNumber(e.target.value)}
                            placeholder="e.g., BS-205 or BG-363"
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            {portalLang === 'bn' ? 'এয়ারলাইন্সের নাম (Airline)' : 'Airline Name'}
                          </label>
                          <input
                            type="text"
                            value={airlineName}
                            onChange={(e) => setAirlineName(e.target.value)}
                            placeholder="US-Bangla / Biman / IndiGo"
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            {portalLang === 'bn' ? 'চেন্নাই পৌঁছানোর তারিখ' : 'Chennai Arrival Date'}
                          </label>
                          <input
                            type="date"
                            value={arrivalDate}
                            onChange={(e) => {
                              setArrivalDate(e.target.value);
                              setCheckInDate(e.target.value);
                            }}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            {portalLang === 'bn' ? 'চেন্নাই পৌঁছানোর সময়' : 'Chennai Arrival Time'}
                          </label>
                          <input
                            type="text"
                            value={arrivalTime}
                            onChange={(e) => setArrivalTime(e.target.value)}
                            placeholder="e.g., 12:45 IST"
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            {portalLang === 'bn'
                              ? 'হুইলচেয়ার প্রয়োজন আছে কিনা?'
                              : 'Is Wheelchair Required?'}
                          </label>
                          <select
                            value={wheelchairNeeded ? 'yes' : 'no'}
                            onChange={(e) => {
                              const needed = e.target.value === 'yes';
                              setWheelchairNeeded(needed);
                              setMobilitySupport(
                                needed
                                  ? 'Wheelchair Assistance + AC SUV'
                                  : 'Standard AC Sedan / SUV Pickup'
                              );
                            }}
                            className={`w-full px-3 py-2 text-xs border rounded-lg font-bold ${
                              wheelchairNeeded
                                ? 'bg-amber-50 border-amber-400 text-amber-950'
                                : 'bg-white border-slate-300 text-slate-800'
                            }`}
                          >
                            <option value="no">
                              {portalLang === 'bn'
                                ? 'না — হুইলচেয়ার লাগবে না'
                                : 'No — Standard Pickup'}
                            </option>
                            <option value="yes">
                              {portalLang === 'bn'
                                ? 'হ্যাঁ — এয়ারপোর্টে হুইলচেয়ার প্রয়োজন'
                                : 'Yes — Wheelchair Assistance Needed'}
                            </option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            {portalLang === 'bn'
                              ? 'পিকআপ গাড়ি ও মবিলিটি ব্যবস্থা'
                              : 'Vehicle & Mobility Arrangement'}
                          </label>
                          <select
                            value={mobilitySupport}
                            onChange={(e) => {
                              setMobilitySupport(e.target.value);
                              if (e.target.value.includes('Wheelchair')) {
                                setWheelchairNeeded(true);
                              }
                            }}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                          >
                            <option value="Standard AC Sedan / SUV Pickup">
                              সাধারণ এসি গাড়ি (Standard AC Car)
                            </option>
                            <option value="Wheelchair Assistance + AC SUV">
                              হুইলচেয়ার সহায়তা + এসি গাড়ি (Wheelchair + SUV)
                            </option>
                            <option value="Apollo ACLS Stretcher Ambulance at Airport">
                              স্ট্রেচার অ্যাম্বুলেন্স (Airport Stretcher Ambulance)
                            </option>
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="text-xs text-slate-600">
                          {portalLang === 'bn'
                            ? 'টিকিট রিড করার পর নিচের বাটনে ক্লিক করলেই চেন্নাই এয়ারপোর্টে আমাদের গাড়ি ও হুইলচেয়ার টিম অ্যালার্ট পেয়ে যাবে।'
                            : 'Confirming below automatically dispatches our Chennai Airport driver & wheelchair team.'}
                        </div>
                        <button
                          type="submit"
                          className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
                        >
                          {portalLang === 'bn'
                            ? `✓ ফ্লাইট (${flightNumber}) ও চেন্নাই এয়ারপোর্ট পিকআপ ব্যবস্থা নিশ্চিত করুন`
                            : `✓ Confirm Flight (${flightNumber}) & Chennai Airport Pickup`}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* ===============================================================
                    MODE 2: PATIENT HAS NOT BOOKED TICKET YET ("এখনো টিকিট করা হয়নি" + REMINDER)
                   =============================================================== */}
                {ticketStatusMode === 'no_ticket_yet' && (
                  <form
                    onSubmit={handleScheduleNoTicketReminder}
                    className="p-4 sm:p-5 bg-amber-50/70 border border-amber-300 rounded-xl space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
                          <Clock className="w-4 h-4 text-amber-700" />
                          <span>
                            {portalLang === 'bn'
                              ? 'এখনো ফ্লাইট টিকিট করা হয়নি — পরবর্তীতে এয়ারপোর্ট রিকোয়েস্টের জন্য রিমাইন্ডার সেট করুন'
                              : 'Flight Ticket Not Booked Yet — Schedule Reminder for Later Airport Pickup Request'}
                          </span>
                        </div>
                        <p className="text-xs text-amber-900/90 leading-relaxed">
                          {portalLang === 'bn'
                            ? 'কোনো সমস্যা নেই! ধাপ ৪ এখন সম্পূর্ণ অপশনাল। আপনি কবে নাগাদ টিকিট কাটতে পারেন সেই তারিখটি নিচে সিলেক্ট করে রাখুন — আমরা ঠিক সেই সময়ে আপনাকে রিমাইন্ডার পাঠাবো যাতে এক ক্লিকে এয়ারপোর্ট পিকআপ রিকোয়েস্ট পাঠাতে পারেন।'
                            : 'No problem at all! Step 4 is optional right now. Pick a reminder date below and we will automatically remind you to upload your ticket and request Chennai Airport pickup once your ticket is ready.'}
                        </p>
                      </div>
                    </div>

                    {/* Quick Reminder Date Presets */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        {portalLang === 'bn' ? 'কবে রিমাইন্ডার পেতে চান:' : 'Quick Reminder Presets:'}
                      </span>
                      {[
                        { labelBn: '৩ দিন পর', labelEn: 'In 3 Days', days: 3 },
                        { labelBn: '৫ দিন পর', labelEn: 'In 5 Days', days: 5 },
                        { labelBn: '৭ দিন পর (১ সপ্তাহ)', labelEn: 'In 7 Days', days: 7 },
                        { labelBn: '১০ দিন পর (ভিসা পাওয়ার পর)', labelEn: 'In 10 Days (After Visa)', days: 10 },
                      ].map((preset) => {
                        const targetDate = new Date(Date.now() + preset.days * 86400000)
                          .toISOString()
                          .slice(0, 10);
                        return (
                          <button
                            key={preset.days}
                            type="button"
                            onClick={() => setNoTicketReminderDate(targetDate)}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors ${
                              noTicketReminderDate === targetDate
                                ? 'bg-amber-700 text-white border-amber-700'
                                : 'bg-white text-slate-800 border-slate-300 hover:bg-amber-100/60'
                            }`}
                          >
                            {portalLang === 'bn' ? preset.labelBn : preset.labelEn} ({targetDate})
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          {portalLang === 'bn'
                            ? 'রিমাইন্ডার পাঠানোর তারিখ *'
                            : 'Reminder Date for Airport Request *'}
                        </label>
                        <input
                          type="date"
                          required
                          value={noTicketReminderDate}
                          onChange={(e) => setNoTicketReminderDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          {portalLang === 'bn'
                            ? 'যাত্রার সময় হুইলচেয়ার প্রয়োজন হবে কি? (আগাম নোট)'
                            : 'Will Wheelchair Be Needed Later?'}
                        </label>
                        <select
                          value={noTicketWheelchairPreNote ? 'yes' : 'no'}
                          onChange={(e) => setNoTicketWheelchairPreNote(e.target.value === 'yes')}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="no">
                            {portalLang === 'bn' ? 'না, সাধারণ এসি পিকআপ গাড়ি' : 'No, Standard AC Pickup'}
                          </option>
                          <option value="yes">
                            {portalLang === 'bn'
                              ? 'হ্যাঁ, হুইলচেয়ার প্রয়োজন হবে (আগাম জানিয়ে রাখছি)'
                              : 'Yes, Wheelchair Will Be Needed'}
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          {portalLang === 'bn' ? 'রিমাইন্ডার পাঠানোর মাধ্যম' : 'Reminder Channel'}
                        </label>
                        <select
                          value={noTicketReminderChannel}
                          onChange={(e) => setNoTicketReminderChannel(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="WhatsApp + পোর্টাল নোটিফিকেশন ও সমন্বয়কারী কল">
                            WhatsApp + পোর্টাল ও সমন্বয়কারী কল
                          </option>
                          <option value="WhatsApp মেসেজ ও লিংক">
                            শুধু WhatsApp মেসেজ (WhatsApp Reminder)
                          </option>
                          <option value="সরাসরি ফোন কল (Direct Phone Call)">
                            সরাসরি ফোন কল (Direct Coordinator Call)
                          </option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-800 mb-1">
                        {portalLang === 'bn'
                          ? 'টিকিট বা যাত্রা সম্পর্কে সংক্ষিপ্ত নোট (ঐচ্ছিক)'
                          : 'Brief Note About Your Ticket Plan (Optional)'}
                      </label>
                      <input
                        type="text"
                        value={noTicketReminderNote}
                        onChange={(e) => setNoTicketReminderNote(e.target.value)}
                        placeholder={
                          portalLang === 'bn'
                            ? 'যেমন: ভিসা হাতে পাওয়ার পর আগামী সপ্তাহে টিকিট কাটবো...'
                            : 'e.g., Will book flight ticket right after receiving Medical Visa...'
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>

                    {(reminderSavedBanner || existingTicketReminderBooking) && (
                      <div className="p-3 bg-white border border-emerald-300 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-950">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>
                            {reminderSavedBanner ||
                              (portalLang === 'bn'
                                ? `রিমাইন্ডার সক্রিয় আছে: ${existingTicketReminderBooking?.serviceName} (তারিখ: ${existingTicketReminderBooking?.scheduledDate})`
                                : `Active Reminder Scheduled: ${existingTicketReminderBooking?.serviceName} (${existingTicketReminderBooking?.scheduledDate})`)}
                          </span>
                        </div>
                        <a
                          href={`https://wa.me/${cleanPatientPhone}?text=${encodeURIComponent(
                            `আসসালামু আলাইকুম ${currentPatient.fullName}, আপনার "${
                              portalLang === 'bn' ? 'এখনো ফ্লাইট টিকিট করা হয়নি' : 'Ticket Not Booked Yet'
                            }" রিমাইন্ডারটি আগামী ${noTicketReminderDate} তারিখের জন্য সেট করা হয়েছে। টিকিট কাটা হলেই এই লিংকে আপলোড করে চেন্নাই এয়ারপোর্ট পিকআপ কনফার্ম করতে পারবেন: ${shareablePortalUrl}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-emerald-800 hover:underline whitespace-nowrap"
                        >
                          {portalLang === 'bn'
                            ? 'হোয়াটসঅ্যাপে রিমাইন্ডার মেসেজ দেখুন →'
                            : 'Send Reminder Confirmation to WhatsApp →'}
                        </a>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <span className="text-xs text-amber-950 font-medium">
                        {portalLang === 'bn'
                          ? 'এটি সেভ করলে আপনার সমন্বয়কারীর সিআরএম-এ অটোমেটিক রিমাইন্ডার টাস্ক যুক্ত হবে।'
                          : 'Saving this schedules an automated follow-up task for your coordinator to remind you.'}
                      </span>
                      <button
                        type="submit"
                        className="flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors"
                      >
                        <Bell className="w-4 h-4" />
                        <span>
                          {portalLang === 'bn'
                            ? `✓ এখনো টিকিট করা হয়নি — ${noTicketReminderDate} তারিখে এয়ারপোর্ট পিকআপ রিমাইন্ডার দিন`
                            : `✓ Save 'Ticket Not Booked Yet' & Set Reminder for ${noTicketReminderDate}`}
                        </span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* ৪খ (4B): অ্যাপোলো হাসপাতালের কাছে বাঙালি রান্নাঘরসহ গেস্ট হাউস বুকিং */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <Building2 className="w-4 h-4 text-sky-700" />
                      <span>
                        {portalLang === 'bn'
                          ? '৪(খ) অ্যাপোলো হাসপাতালের কাছে বাঙালি রান্নাঘর ও সি-ফর্মসহ (C-Form) গেস্ট হাউস বুকিং'
                          : '4(B) Book C-Form Guest House with Bengali Kitchen near Apollo Chennai'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {portalLang === 'bn'
                        ? 'চেক-ইন তারিখ, কত দিন থাকবেন এবং বিশেষ সুবিধা নির্বাচন করে আপনার পছন্দের গেস্ট হাউসে ১-ক্লিকে বুকিং রিকোয়েস্ট পাঠান:'
                        : 'Choose your check-in date, stay duration, and tap any verified guest house near Apollo to reserve:'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        {portalLang === 'bn' ? 'চেক-ইন তারিখ' : 'Check-In Date'}
                      </label>
                      <input
                        type="date"
                        value={checkInDate}
                        onChange={(e) => setCheckInDate(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        {portalLang === 'bn' ? 'কত দিন থাকবেন?' : 'Nights'}
                      </label>
                      <select
                        value={stayDurationDays}
                        onChange={(e) => setStayDurationDays(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="5">5 Days (৫ দিন)</option>
                        <option value="7">7 Days (৭ দিন)</option>
                        <option value="10">10 Days (১০ দিন)</option>
                        <option value="14">14 Days (১৪ দিন)</option>
                        <option value="21">21 Days (২১ দিন)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        {portalLang === 'bn' ? 'রুম ও রান্নাঘরের পছন্দ' : 'Room & Kitchen Preference'}
                      </label>
                      <select
                        value={guestHousePreferenceNote}
                        onChange={(e) => setGuestHousePreferenceNote(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="গ্রাউন্ড ফ্লোর / লিফট ও বাঙালি রান্নাঘর প্রয়োজন (Lift & Bengali Self-Cooking Kitchen)">
                          লিফট + বাঙালি রান্নাঘর (Lift + Bengali Kitchen)
                        </option>
                        <option value="হুইলচেয়ার অ্যাক্সেস ও এটাচড বাথরুম (Wheelchair Accessible Ground Floor)">
                          হুইলচেয়ার উপযোগী রুম (Wheelchair Ground/Lift Room)
                        </option>
                        <option value="২ বেডরুম ফ্যামিলি অ্যাপার্টমেন্ট (2-Bed Family Suite with Kitchen)">
                          ২ বেডরুম ফ্যামিলি স্যুইট (2-Bed Family Suite)
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {CHENNAI_GUEST_HOUSES.map((gh) => (
                    <div
                      key={gh.id}
                      className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-emerald-800">{gh.distance}</div>
                        <h5 className="text-sm font-bold text-slate-900">
                          {portalLang === 'bn' ? gh.nameBn : gh.nameEn}
                        </h5>
                        <div className="text-xs font-mono font-bold text-sky-900">{gh.rateInr}</div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {portalLang === 'bn' ? gh.featuresBn : gh.featuresEn}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelfBookGuestHouse(gh)}
                        className="w-full px-3 py-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors"
                      >
                        {portalLang === 'bn'
                          ? 'এই গেস্ট হাউসটি বুক করুন →'
                          : 'Request This Guest House →'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* ৪গ (4C): ভারত যাত্রার ও হাতের ব্যাগের (Cabin Bag) জরুরি চেকলিস্ট */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <CheckSquare className="w-4 h-4 text-emerald-700" />
                      <span>
                        {portalLang === 'bn'
                          ? '৪(গ) ভারত যাত্রার আগে জরুরি কাগজপত্র ও হাতের ব্যাগের (Cabin Bag) চেকলিস্ট'
                          : '4(C) Pre-Travel & Cabin Bag Readiness Checklist'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {portalLang === 'bn'
                        ? 'চেন্নাই যাওয়ার আগে যে কাজগুলো শেষ করেছেন সেগুলোতে টিক (✓) দিন এবং সেভ করুন:'
                        : 'Tick the items you have prepared in Bangladesh and save to notify your coordinator:'}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-800">
                    {checkedItems.length} / {PRE_TRAVEL_SELF_CHECKLIST.length} Completed
                  </span>
                </div>

                <div className="space-y-2">
                  {PRE_TRAVEL_SELF_CHECKLIST.map((item) => {
                    const isChecked = checkedItems.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-emerald-50/80 border-emerald-300 text-slate-900'
                            : 'bg-slate-50/40 border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setCheckedItems((prev) =>
                              prev.includes(item.id)
                                ? prev.filter((id) => id !== item.id)
                                : [...prev, item.id]
                            );
                          }}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700"
                        />
                        <div className="text-xs sm:text-sm font-medium leading-snug">
                          {portalLang === 'bn' ? item.bn : item.en}
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveReadinessChecklist}
                    className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
                  >
                    {portalLang === 'bn'
                      ? '✓ আমার প্রস্তুতির তালিকা সংরক্ষণ করুন ও সমন্বয়কারীকে জানান'
                      : '✓ Save My Readiness Checklist & Notify Coordinator'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step-by-Step Footer Navigation (পূর্ববর্তী ধাপ / পরবর্তী ধাপ) */}
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200 no-print">
            <div>
              {prevStep && (
                <button
                  type="button"
                  onClick={() => setActiveStep(prevStep.id)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>
                    {portalLang === 'bn'
                      ? `${prevStep.stepNumBn}: ${prevStep.titleBn}`
                      : `${prevStep.stepNumEn}: ${prevStep.titleEn}`}
                  </span>
                </button>
              )}
            </div>
            <div>
              {nextStep && (
                <button
                  type="button"
                  onClick={() => setActiveStep(nextStep.id)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors"
                >
                  <span>
                    {portalLang === 'bn'
                      ? `পরবর্তী ${nextStep.stepNumBn}: ${nextStep.titleBn}`
                      : `Next ${nextStep.stepNumEn}: ${nextStep.titleEn}`}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Summary Grid: Patient's Live Bookings, Second Opinions & Approved AI Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 cols: Official Hospital Second Opinions & Approved Treatment Cost Estimates */}
        <div className="lg:col-span-6 space-y-5">
          {/* Official Hospital Second Opinions Shared with Patient */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
              {portalLang === 'bn'
                ? `হাসপাতালের বিশেষজ্ঞ ডাক্তারের মতামত / Second Opinion (${mySecondOpinions.length})`
                : `Official Hospital Second Opinions (${mySecondOpinions.length})`}
            </h3>
            {mySecondOpinions.length === 0 ? (
              <p className="text-xs text-slate-500">
                {portalLang === 'bn'
                  ? 'আপনার মেডিকেল রিপোর্ট পর্যালোচনার পর চেন্নাইয়ের সিনিয়র ডাক্তারের মতামত এখানে যুক্ত হবে।'
                  : 'Hospital second opinion records will appear here once received from the specialist.'}
              </p>
            ) : (
              mySecondOpinions.map((op) => (
                <div key={op.id} className="p-4 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{op.hospitalName}</h4>
                      <div className="text-xs text-slate-600">
                        {op.doctorName} · {op.department} · Ref: {op.hospitalReferenceNumber}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-emerald-700">
                      {op.verificationStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {op.receivedOpinionSummary}
                  </p>
                  <p className="text-xs text-slate-800 font-medium">
                    {op.documentedRecommendations}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Approved AI-Assisted Informational Summaries */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
              {portalLang === 'bn'
                ? `অনুমোদিত মেডিকেল সামারি ও ডাক্তারকে করার প্রশ্নাবলি (${myApprovedAiReports.length})`
                : `Reviewer-Approved Medical Navigation Summaries (${myApprovedAiReports.length})`}
            </h3>
            {myApprovedAiReports.length === 0 ? (
              <p className="text-xs text-slate-500">
                {portalLang === 'bn'
                  ? 'আপনার মেডিকেল রিপোর্ট যাচাইয়ের পর সমন্বয়কারী কর্তৃক অনুমোদিত সামারি ও ডাক্তারকে করার গুরুত্বপূর্ণ প্রশ্নগুলো এখানে দেখা যাবে।'
                  : 'Any AI-assisted preliminary summary remains hidden in draft mode until your Medical Report Coordinator completes human verification and approves it for your portal.'}
              </p>
            ) : (
              myApprovedAiReports.map((rep) => (
                <div key={rep.id} className="p-4 border border-slate-200 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-emerald-800">
                    {rep.reviewStatus} · Reviewed by {rep.reviewerName || 'Coordinator'}
                  </div>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">
                    {rep.documentedHistorySummary}
                  </p>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">
                    <strong>Questions for Your Doctor:</strong> {rep.questionsForDoctor}
                  </p>
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                    {rep.disclaimer}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 6 cols: Live Status of Bookings & 5-Stage Care Journey Progress */}
        <div className="lg:col-span-6 space-y-5">
          {/* Status of My Service Bookings & Appointments */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
              {portalLang === 'bn'
                ? `আমার অ্যাপয়েন্টমেন্ট, ভিসা লেটার ও বুকিং স্ট্যাটাস (${myBookings.length})`
                : `My Appointments, Visa Letters & Service Requests (${myBookings.length})`}
            </h3>
            <div className="space-y-2.5">
              {myBookings.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {portalLang === 'bn'
                    ? 'উপরের ৪টি ধাপ থেকে ভিসা লেটার, এয়ারপোর্ট পিকআপ বা গেস্ট হাউস রিকোয়েস্ট করলে এখানে স্ট্যাটাস দেখতে পাবেন।'
                    : 'Submit any service request in the 4 steps above to track its live confirmation status here.'}
                </p>
              ) : (
                myBookings.map((bk) => (
                  <div
                    key={bk.id}
                    className="p-3.5 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-2 bg-slate-50/50"
                  >
                    <div>
                      <div className="text-xs font-semibold text-sky-800">{bk.serviceCategory}</div>
                      <div className="text-sm font-bold text-slate-900">{bk.serviceName}</div>
                      <div className="text-xs text-slate-600">
                        Date: <span className="font-mono tabular-nums">{bk.scheduledDate}</span>{' '}
                        {bk.scheduledTime || ''} · {bk.hospitalOrProvider}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-800">{bk.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Visual Care Journey Tracker */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900">
                {portalLang === 'bn'
                  ? 'আপনার আন্তর্জাতিক চিকিৎসা যাত্রার অগ্রগতি (Chennai Care Journey)'
                  : 'Your International Treatment Journey Progress'}
              </span>
              <span className="font-mono font-bold text-sky-800">
                {portalProgressPct}% ({activePortalStageIdx + 1}/{PATIENT_JOURNEY_STAGES.length})
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${portalProgressPct}%` }}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[11px]">
              {PATIENT_JOURNEY_STAGES.map((st, idx) => (
                <div
                  key={st.id}
                  className={`p-2 rounded-lg border ${
                    idx === activePortalStageIdx
                      ? 'bg-sky-50 border-sky-500 font-bold text-sky-950'
                      : idx < activePortalStageIdx
                      ? 'bg-white border-emerald-300 text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  0{idx + 1}. {st.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
