import React, { useState, useEffect, useMemo } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  FileText,
  Sparkles,
  Scale,
  Calculator,
  Briefcase,
  Calendar,
  Plane,
  CheckSquare,
  MessageSquare,
  Building2,
  BarChart3,
  Shield,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Database,
  ArrowRight,
  Lock,
  ExternalLink,
  UserPlus,
  CalendarPlus,
  X,
  CheckCircle2,
  FileDown,
  Printer,
  Columns3,
  List,
  GripVertical,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './lib/firebase';
import {
  LEAD_PIPELINE_STAGES,
  LEAD_SOURCES,
  TREATMENT_CATEGORIES,
  VERIFIED_HOSPITALS,
  ROLE_MODULE_ACCESS,
  PATIENT_JOURNEY_STAGES,
  type StaffRole,
  type ModuleId,
  type LeadRecord,
  type PatientRecord,
  type MedicalDocumentRecord,
  type AiMedicalReportRecord,
  type HospitalSecondOpinionRecord,
  type TreatmentCostEstimateRecord,
  type ServiceBookingRecord,
  type FollowUpTaskRecord,
  type CommunicationRecordItem,
  type HospitalDirectoryRecord,
  type AuditLogRecord,
} from './types/crm';
import {
  createLead,
  updateLeadStage,
  createPatient,
  updatePatientJourneyStage,
  convertLeadToPatient,
  createServiceBooking,
  createCommunicationRecord,
  seedSyntheticCrmData,
  logAuditEvent,
} from './lib/crmService';
import { generatePatientPartnerPdf } from './lib/pdfGenerator';
import { AiReportAssistantView } from './components/AiReportAssistantView';
import { CostAndServicesView } from './components/CostAndServicesView';
import { OperationsAndAdminView } from './components/OperationsAndAdminView';
import { PatientPortalView } from './components/PatientPortalView';
import { ClinicalIntelligencePanel } from './components/ClinicalIntelligencePanel';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const PIE_COLORS = [
  '#0284c7', // sky-600
  '#059669', // emerald-600
  '#0f172a', // slate-900
  '#d97706', // amber-600
  '#4f46e5', // indigo-600
  '#0d9488', // teal-600
  '#64748b', // slate-500
];

const KANBAN_COLUMNS: Array<{
  id: string;
  title: string;
  defaultStatus: string;
  accentClass: string;
  badgeClass: string;
  matchedStatuses: string[];
}> = [
  {
    id: 'col-new',
    title: '1. New Inquiry',
    defaultStatus: 'New Inquiry',
    accentClass: 'border-t-4 border-t-sky-600',
    badgeClass: 'bg-sky-100 text-sky-900',
    matchedStatuses: [
      'New Inquiry',
      'Contact Attempted',
      'Contacted',
      'Information Requested',
      'On Hold',
      'Lost',
    ],
  },
  {
    id: 'col-docs',
    title: '2. Documents Received',
    defaultStatus: 'Documents Received',
    accentClass: 'border-t-4 border-t-indigo-600',
    badgeClass: 'bg-indigo-100 text-indigo-900',
    matchedStatuses: ['Documents Received', 'AI Report in Preparation'],
  },
  {
    id: 'col-opinion',
    title: '3. Opinion Requested',
    defaultStatus: 'Hospital Opinion Requested',
    accentClass: 'border-t-4 border-t-amber-600',
    badgeClass: 'bg-amber-100 text-amber-900',
    matchedStatuses: ['Hospital Opinion Requested', 'Opinion Received'],
  },
  {
    id: 'col-estimate',
    title: '4. Estimate Shared',
    defaultStatus: 'Estimate Shared',
    accentClass: 'border-t-4 border-t-teal-600',
    badgeClass: 'bg-teal-100 text-teal-900',
    matchedStatuses: [
      'Estimate Shared',
      'Consultation Scheduled',
      'Treatment Planning',
      'Travel Preparation',
    ],
  },
  {
    id: 'col-converted',
    title: '5. Converted',
    defaultStatus: 'Converted to Patient',
    accentClass: 'border-t-4 border-t-emerald-600',
    badgeClass: 'bg-emerald-100 text-emerald-900',
    matchedStatuses: ['Converted to Patient', 'Completed'],
  },
];

const NAV_ITEMS: Array<{
  id: ModuleId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: '1. Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: '2. Leads & Inquiries', icon: Users },
  { id: 'patients', label: '3. Patients', icon: UserCheck },
  { id: 'documents', label: '4. Medical Documents', icon: FileText },
  { id: 'ai-assistant', label: '5. AI Medical Report Assistant', icon: Sparkles },
  { id: 'second-opinions', label: '6. Hospital Second Opinions', icon: Scale },
  { id: 'cost-estimator', label: '7. Treatment Cost Estimator', icon: Calculator },
  { id: 'services-bookings', label: '8. Services & Bookings', icon: Briefcase },
  { id: 'appointments', label: '9. Appointments & Teleconsults', icon: Calendar },
  { id: 'visa-travel', label: '10. Visa & Travel Coordination', icon: Plane },
  { id: 'follow-ups', label: '11. Follow-ups & Tasks', icon: CheckSquare },
  { id: 'communications', label: '12. Communications', icon: MessageSquare },
  { id: 'hospitals', label: '13. Hospitals & Doctors', icon: Building2 },
  { id: 'analytics', label: '14. Reports & Analytics', icon: BarChart3 },
  { id: 'staff-permissions', label: '15. Staff & Permissions', icon: Shield },
  { id: 'settings', label: '16. Settings & Integrations', icon: Settings },
  { id: 'patient-portal', label: 'Patient Portal View', icon: ExternalLink },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentRole, setCurrentRole] = useState<StaffRole>('CRM Administrator');
  const [activeModule, setActiveModule] = useState<ModuleId>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('portal') === 'patient' ? 'patient-portal' : 'dashboard';
  });
  const [standalonePatientMode, setStandalonePatientMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('portal') === 'patient';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string>('');

  // Firestore Real-Time State
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [documents, setDocuments] = useState<MedicalDocumentRecord[]>([]);
  const [aiReports, setAiReports] = useState<AiMedicalReportRecord[]>([]);
  const [secondOpinions, setSecondOpinions] = useState<HospitalSecondOpinionRecord[]>([]);
  const [costEstimates, setCostEstimates] = useState<TreatmentCostEstimateRecord[]>([]);
  const [serviceBookings, setServiceBookings] = useState<ServiceBookingRecord[]>([]);
  const [tasks, setTasks] = useState<FollowUpTaskRecord[]>([]);
  const [communications, setCommunications] = useState<CommunicationRecordItem[]>([]);
  const [hospitals, setHospitals] = useState<HospitalDirectoryRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  // Dashboard Filters
  const [filterTreatment, setFilterTreatment] = useState<string>('ALL');
  const [filterSource, setFilterSource] = useState<string>('ALL');
  const [filterStaff, setFilterStaff] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // New Lead Form State
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('+88017');
  const [leadWhatsapp, setLeadWhatsapp] = useState('+88017');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadCity, setLeadCity] = useState('Dhaka');
  const [leadSource, setLeadSource] = useState<string>(LEAD_SOURCES[0]);
  const [leadCampaign, setLeadCampaign] = useState('Apollo Chennai Cardiac & Oncology Campaign BD');
  const [leadTreatment, setLeadTreatment] = useState<string>(TREATMENT_CATEGORIES[0]);
  const [leadHospital, setLeadHospital] = useState<string>(VERIFIED_HOSPITALS[0]);
  const [leadPriority, setLeadPriority] = useState<'Urgent' | 'High' | 'Medium' | 'Low'>('High');
  const [leadNeeds, setLeadNeeds] = useState('');
  const [leadConsent, setLeadConsent] = useState(true);
  const [leadsViewMode, setLeadsViewMode] = useState<'kanban' | 'list'>('kanban');
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [showLeadCaptureModal, setShowLeadCaptureModal] = useState(false);

  // Selected Patient for Unified 13-Section Profile Inspector
  const [selectedPatientProfileId, setSelectedPatientProfileId] = useState<string>('');
  // New Patient Form State
  const [patName, setPatName] = useState('');
  const [patAge, setPatAge] = useState(52);
  const [patGender, setPatGender] = useState('Male');
  const [patPhone, setPatPhone] = useState('+88018');
  const [patCity, setPatCity] = useState('Chattogram');
  const [patPassport, setPatPassport] = useState('');
  const [patHospital, setPatHospital] = useState<string>(VERIFIED_HOSPITALS[0]);
  const [patHistory, setPatHistory] = useState('');
  const [patDiagnoses, setPatDiagnoses] = useState('');
  const [patSymptoms, setPatSymptoms] = useState('');
  const [patRequirements, setPatRequirements] = useState('');
  const [patDataConsent, setPatDataConsent] = useState(true);
  const [patMarketingConsent, setPatMarketingConsent] = useState(false);

  // Dashboard Quick Actions State ('Add New Patient' | 'Log New Lead' | 'Schedule Appointment')
  const [quickActionDrawer, setQuickActionDrawer] = useState<
    null | 'add-patient' | 'log-lead' | 'schedule-appointment'
  >(null);
  const [quickApptPatientId, setQuickApptPatientId] = useState('');
  const [quickApptCategory, setQuickApptCategory] = useState(
    'Doctor Appointment Booking'
  );
  const [quickApptServiceName, setQuickApptServiceName] = useState(
    'Senior Cardiothoracic / Specialist Consultation'
  );
  const [quickApptHospital, setQuickApptHospital] = useState<string>(VERIFIED_HOSPITALS[0]);
  const [quickApptDoctor, setQuickApptDoctor] = useState('Dr. M. Kathiresan / Specialist Team');
  const [quickApptDate, setQuickApptDate] = useState(
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  );
  const [quickApptTime, setQuickApptTime] = useState('11:00 AM IST');
  const [quickApptNotes, setQuickApptNotes] = useState('');

  // Auth Listener & User Profile Bootstrap
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        try {
          const userRef = doc(db, 'users', u.uid);
          const snap = await getDoc(userRef);
          const isDefaultAdmin = u.email === 'borhanctg@gmail.com';
          if (!snap.exists()) {
            const assignedRole: StaffRole = isDefaultAdmin
              ? 'CRM Administrator'
              : 'Patient Relationship Manager';
            const now = new Date().toISOString();
            await setDoc(userRef, {
              uid: u.uid,
              email: u.email || 'staff@qurewaystrip.com',
              displayName: (u.displayName || 'QureWays Coordinator').slice(0, 120),
              role: assignedRole,
              department: 'International Patient Coordination (Bangladesh - India)',
              active: true,
              createdAt: now,
              updatedAt: now,
            });
            setCurrentRole(assignedRole);
          } else {
            const data = snap.data();
            if (data?.role) {
              setCurrentRole(data.role as StaffRole);
            }
          }
        } catch (err) {
          console.error('Profile bootstrap check:', err);
        }
      }
    });
    return () => unsub();
  }, []);

  // Real-Time Firestore Listeners (Only attach when authReady && user)
  useEffect(() => {
    if (!authReady || !user) return;

    const uid = user.uid;

    const unsubLeads = onSnapshot(
      query(collection(db, 'leads'), where('ownerId', '==', uid)),
      (snap) => {
        setLeads(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<LeadRecord, 'id'>) }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'leads')
    );

    const unsubPatients = onSnapshot(
      query(collection(db, 'patients'), where('ownerId', '==', uid)),
      (snap) => {
        setPatients(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<PatientRecord, 'id'>) }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'patients')
    );

    const unsubDocs = onSnapshot(
      query(collection(db, 'medicalDocuments'), where('ownerId', '==', uid)),
      (snap) => {
        setDocuments(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<MedicalDocumentRecord, 'id'>) }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'medicalDocuments')
    );

    const unsubAi = onSnapshot(
      query(collection(db, 'aiReports'), where('ownerId', '==', uid)),
      (snap) => {
        setAiReports(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<AiMedicalReportRecord, 'id'>) }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'aiReports')
    );

    const unsubOpinions = onSnapshot(
      query(collection(db, 'secondOpinions'), where('ownerId', '==', uid)),
      (snap) => {
        setSecondOpinions(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<HospitalSecondOpinionRecord, 'id'>) }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'secondOpinions')
    );

    const unsubEstimates = onSnapshot(
      query(collection(db, 'costEstimates'), where('ownerId', '==', uid)),
      (snap) => {
        setCostEstimates(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<TreatmentCostEstimateRecord, 'id'>) }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'costEstimates')
    );

    const unsubBookings = onSnapshot(
      query(collection(db, 'serviceBookings'), where('ownerId', '==', uid)),
      (snap) => {
        setServiceBookings(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<ServiceBookingRecord, 'id'>) }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'serviceBookings')
    );

    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), where('ownerId', '==', uid)),
      (snap) => {
        setTasks(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<FollowUpTaskRecord, 'id'>) }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'tasks')
    );

    const unsubComms = onSnapshot(
      query(collection(db, 'communications'), where('ownerId', '==', uid)),
      (snap) => {
        setCommunications(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<CommunicationRecordItem, 'id'>) }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'communications')
    );

    const unsubHospitals = onSnapshot(
      query(collection(db, 'hospitals'), where('ownerId', '==', uid)),
      (snap) => {
        setHospitals(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<HospitalDirectoryRecord, 'id'>) }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'hospitals')
    );

    const unsubAudits = onSnapshot(
      query(collection(db, 'auditLogs'), where('actorUid', '==', uid)),
      (snap) => {
        setAuditLogs(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogRecord, 'id'>) }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
    );

    return () => {
      unsubLeads();
      unsubPatients();
      unsubDocs();
      unsubAi();
      unsubOpinions();
      unsubEstimates();
      unsubBookings();
      unsubTasks();
      unsubComms();
      unsubHospitals();
      unsubAudits();
    };
  }, [authReady, user]);

  // Auto-select patient from shareable URL query parameter (?portal=patient&code=QW-PT-...)
  useEffect(() => {
    if (patients.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam) {
      const matched = patients.find(
        (p) => p.patientCode.toLowerCase() === codeParam.toLowerCase() || p.id === codeParam
      );
      if (matched) {
        setSelectedPatientProfileId(matched.id);
      }
    }
  }, [patients]);

  const actor = useMemo(
    () => ({
      uid: user?.uid || 'anonymous',
      name: user?.displayName || user?.email?.split('@')[0] || 'QureWays Coordinator',
      role: currentRole,
    }),
    [user, currentRole]
  );

  const allowedModules = ROLE_MODULE_ACCESS[currentRole] || ['dashboard'];

  const handleRoleChange = (newRole: StaffRole) => {
    setCurrentRole(newRole);
    const nextAllowed = ROLE_MODULE_ACCESS[newRole];
    if (!nextAllowed.includes(activeModule)) {
      setActiveModule(nextAllowed[0]);
    }
  };

  const handleSeedDemoData = async () => {
    if (!user) return;
    setIsSeeding(true);
    setStatusNotice('');
    try {
      await seedSyntheticCrmData(actor);
      setStatusNotice(
        'Synthetic Bangladesh-to-Apollo Chennai medical tourism records loaded into Firestore.'
      );
    } catch (err) {
      setStatusNotice(err instanceof Error ? err.message : 'Failed to seed data');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleCreateLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    await createLead(
      {
        leadCode: `LD-${Math.floor(1000 + Math.random() * 9000)}`,
        patientName: leadName,
        phone: leadPhone,
        whatsapp: leadWhatsapp,
        email: leadEmail,
        country: 'Bangladesh',
        city: leadCity,
        preferredLanguage: 'Bengali',
        inquiryDate: today,
        leadSource,
        campaignSource: leadCampaign,
        interestedTreatment: leadTreatment,
        preferredHospital: leadHospital,
        preferredCountry: 'India',
        needsDescription: leadNeeds,
        assignedStaffName: actor.name,
        priority: leadPriority,
        nextFollowUpDate: today,
        status: 'New Inquiry',
        consentGiven: leadConsent,
        privacyPreferences: 'Explicit care coordination consent verified.',
        ownerId: actor.uid,
      },
      actor
    );
    setLeadName('');
    setLeadNeeds('');
    setQuickActionDrawer(null);
    setShowLeadCaptureModal(false);
    setStatusNotice('New lead inquiry created and initial follow-up task assigned.');
  };

  const handleDropLeadOnKanbanColumn = async (
    columnId: string,
    targetDefaultStatus: string
  ) => {
    setDragOverColumnId(null);
    if (!draggedLeadId) return;

    const leadObj = leads.find((l) => l.id === draggedLeadId);
    setDraggedLeadId(null);
    if (!leadObj) return;

    if (columnId === 'col-converted') {
      if (leadObj.status === 'Converted to Patient') return;
      const res = await convertLeadToPatient(leadObj, patients, actor);
      setSelectedPatientProfileId(res.patientId);
      setStatusNotice(
        res.deduplicated
          ? `Kanban Drop: Matched existing patient profile (Duplicate avoided) for ${leadObj.patientName}.`
          : `Kanban Drop: Converted ${leadObj.patientName} to unified patient profile.`
      );
      return;
    }

    if (leadObj.status !== targetDefaultStatus) {
      await updateLeadStage(
        leadObj.id,
        { status: targetDefaultStatus, patientName: leadObj.patientName },
        actor
      );
      setStatusNotice(
        `Moved ${leadObj.patientName} (${leadObj.leadCode}) to "${targetDefaultStatus}".`
      );
    }
  };

  const handleCreatePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patName.trim()) return;
    const id = await createPatient(
      {
        patientCode: `QW-PT-${Math.floor(1000 + Math.random() * 9000)}`,
        fullName: patName,
        age: Number(patAge),
        gender: patGender,
        phone: patPhone,
        whatsapp: patPhone,
        country: 'Bangladesh',
        city: patCity,
        passportNumber: patPassport,
        preferredLanguage: 'Bengali',
        preferredChannel: 'WhatsApp',
        medicalHistorySummary: patHistory,
        existingDiagnoses: patDiagnoses,
        reportedSymptoms: patSymptoms,
        treatmentRequirements: patRequirements,
        preferredHospital: patHospital,
        preferredDestination: 'Chennai, India',
        assignedCoordinatorName: actor.name,
        journeyStage: 'Medical Documents Collection',
        dataProcessingConsent: patDataConsent,
        marketingConsent: patMarketingConsent,
        ownerId: actor.uid,
      },
      actor
    );
    setSelectedPatientProfileId(id);
    setPatName('');
    setPatHistory('');
    setPatDiagnoses('');
    setPatSymptoms('');
    setPatRequirements('');
    setQuickActionDrawer(null);
    setStatusNotice('Unified patient profile registered.');
  };

  const handleQuickScheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPatient =
      patients.find((p) => p.id === quickApptPatientId) || patients[0];
    const patientIdToUse = targetPatient?.id || 'unlinked_patient';
    const patientNameToUse = targetPatient?.fullName || 'Walk-In / New International Patient';

    await createServiceBooking(
      {
        patientId: patientIdToUse,
        patientName: patientNameToUse,
        serviceCategory: quickApptCategory,
        serviceName: quickApptServiceName,
        hospitalOrProvider: quickApptHospital,
        doctorName: quickApptDoctor,
        scheduledDate: quickApptDate,
        scheduledTime: quickApptTime,
        status: 'Confirmed',
        serviceFeeUsd: quickApptCategory.includes('Teleconsultation') ? 85 : 120,
        processingTimeEstimate: 'Confirmed within 24 hours',
        assignedCoordinatorName: actor.name,
        notes: quickApptNotes || 'Scheduled via Dashboard Quick Actions.',
        ownerId: actor.uid,
      },
      actor
    );
    setQuickApptNotes('');
    setQuickActionDrawer(null);
    setStatusNotice(
      `Appointment scheduled for ${patientNameToUse} at ${quickApptHospital} on ${quickApptDate} (${quickApptTime}).`
    );
  };

  // Sign-In Screen
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700 text-sm">
        Initializing QureWays Trip Medical Tourism CRM...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        {/* Top Bar Contract */}
        <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white border-b border-slate-200">
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            QureWays Trip
          </span>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <span className="whitespace-nowrap shrink-0">Patient Coordination</span>
            <span className="whitespace-nowrap shrink-0">Apollo Hospitals Chennai</span>
            <span className="whitespace-nowrap shrink-0">Second Opinions</span>
            <span className="whitespace-nowrap shrink-0">Visa & Travel Desk</span>
          </nav>
          <button
            type="button"
            onClick={() => signInWithPopup(auth, googleProvider)}
            className="px-4 py-2 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Staff & Patient Sign In
          </button>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-16 text-center space-y-6">
          <p className="text-xs font-medium text-sky-800">
            International Patient Coordination · Bangladesh to Apollo Hospitals, Chennai & Partner Centers
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight max-w-2xl mx-auto">
            AI-Powered Medical Tourism CRM & Unified Patient Journey Platform
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Manage inbound inquiries from Bangladesh, encrypted medical documents, human-reviewed AI preliminary
            summaries, verbatim hospital second opinions, transparent USD/BDT/INR treatment estimates, and Med-1/Med-2
            visa coordination in one secure workspace.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => signInWithPopup(auth, googleProvider)}
              className="px-6 py-3 text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-xl shadow-sm transition-colors whitespace-nowrap"
            >
              Sign In with Google to Access QureWays Trip CRM
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 text-left">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-sm font-bold text-slate-900">15-Section AI Medical Assistant</div>
              <p className="text-xs text-slate-600 mt-1">
                Extracts documented clinical facts with source references and enforces a mandatory human review gate.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-sm font-bold text-slate-900">Apollo Chennai Second Opinions</div>
              <p className="text-xs text-slate-600 mt-1">
                Preserves original hospital opinions without alteration and compares treatment pathways side by side.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-sm font-bold text-slate-900">Role-Based Privacy & Portal</div>
              <p className="text-xs text-slate-600 mt-1">
                Granular access across 6 staff roles plus an isolated single-patient portal experience.
              </p>
            </div>
          </div>
        </main>

        <footer className="px-6 py-4 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
          QureWays Trip (qurewaystrip.com) · International Patient Coordination & Medical Tourism CRM
        </footer>
      </div>
    );
  }

  // Filtered Dashboard Records
  const todayStr = new Date().toISOString().slice(0, 10);
  const filteredLeads = leads.filter((l) => {
    if (filterTreatment !== 'ALL' && l.interestedTreatment !== filterTreatment) return false;
    if (filterSource !== 'ALL' && l.leadSource !== filterSource) return false;
    if (filterStaff !== 'ALL' && l.assignedStaffName !== filterStaff) return false;
    if (
      searchQuery &&
      !`${l.patientName} ${l.leadCode} ${l.phone} ${l.city} ${l.interestedTreatment}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  // 16 Required Operational Dashboard Metrics (Section 5)
  const totalLeadsCount = filteredLeads.length;
  const newInquiriesTodayCount = filteredLeads.filter((l) => l.inquiryDate === todayStr).length;
  const leadsRequiringFollowUpCount = filteredLeads.filter(
    (l) => l.status === 'New Inquiry' || l.status === 'Contact Attempted' || l.status === 'Information Requested'
  ).length;
  const overdueFollowUpsCount = tasks.filter(
    (t) => t.status === 'Overdue' || (t.status !== 'Completed' && t.dueDate < todayStr)
  ).length;
  const patientsWaitingForDocsCount = patients.filter(
    (p) => !documents.some((d) => d.patientId === p.id)
  ).length;
  const aiReportsAwaitingReviewCount = aiReports.filter(
    (r) => r.reviewStatus === 'DRAFT — NOT CLINICIAN-APPROVED'
  ).length;
  const secondOpinionsPendingCount = secondOpinions.filter(
    (o) => o.status !== 'Opinion Received' && o.status !== 'Shared With Patient'
  ).length;
  const estimatesPendingCount = costEstimates.filter((c) => c.status === 'Draft').length;
  const appointmentsScheduledCount = serviceBookings.filter(
    (b) =>
      (b.serviceCategory.includes('Appointment') || b.serviceCategory.includes('Teleconsultation')) &&
      b.status === 'Confirmed'
  ).length;
  const visaInProgressCount = serviceBookings.filter(
    (b) => b.serviceCategory.includes('Visa') || b.serviceCategory.includes('AYUSH')
  ).length;
  const upcomingTripsCount = serviceBookings.filter(
    (b) => b.flightDetails || b.serviceCategory.includes('Airport')
  ).length;
  const completedCasesCount = leads.filter(
    (l) => l.status === 'Converted to Patient' || l.status === 'Completed'
  ).length;
  const conversionRatePct =
    totalLeadsCount > 0 ? ((completedCasesCount / totalLeadsCount) * 100).toFixed(1) : '0.0';
  const totalServiceRevenueUsd = serviceBookings.reduce(
    (sum, b) => sum + (Number(b.serviceFeeUsd) || 0),
    0
  );

  // 30-Day Lead Conversion Rate Trend Series (Calculated from filteredLeads)
  const conversionTrend30Days = useMemo(() => {
    const points: Array<{
      dateIso: string;
      dateLabel: string;
      conversionRate: number;
      qualifiedProgressionRate: number;
      cumulativeLeads: number;
      cumulativeConverted: number;
    }> = [];

    const nowMs = Date.now();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(nowMs - i * 86400000);
      const dateIso = d.toISOString().slice(0, 10);
      const dateLabel = d.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
      });

      const leadsUpToDay = filteredLeads.filter(
        (l) => (l.inquiryDate || l.createdAt.slice(0, 10)) <= dateIso
      );
      const totalUpToDay = leadsUpToDay.length;
      const convertedUpToDay = leadsUpToDay.filter(
        (l) => l.status === 'Converted to Patient' || l.status === 'Completed'
      ).length;
      const progressedUpToDay = leadsUpToDay.filter(
        (l) =>
          l.status === 'Converted to Patient' ||
          l.status === 'Completed' ||
          l.status === 'Opinion Received' ||
          l.status === 'Estimate Shared' ||
          l.status === 'Documents Received'
      ).length;

      const conversionRate =
        totalUpToDay > 0
          ? Number(((convertedUpToDay / totalUpToDay) * 100).toFixed(1))
          : 0;
      const qualifiedProgressionRate =
        totalUpToDay > 0
          ? Number(((progressedUpToDay / totalUpToDay) * 100).toFixed(1))
          : 0;

      points.push({
        dateIso,
        dateLabel,
        conversionRate,
        qualifiedProgressionRate,
        cumulativeLeads: totalUpToDay,
        cumulativeConverted: convertedUpToDay,
      });
    }
    return points;
  }, [filteredLeads]);

  // Lead Volume by Acquisition Source for Recharts PieChart
  const leadsBySourceData = useMemo(() => {
    const sourceMap = new Map<
      string,
      { name: string; fullSource: string; value: number; convertedCount: number }
    >();

    const normalizeShortSource = (src: string): string => {
      const s = (src || '').toLowerCase();
      if (s.includes('website')) return 'Website';
      if (s.includes('whatsapp')) return 'WhatsApp';
      if (s.includes('referral') || s.includes('hospital') || s.includes('doctor'))
        return 'Referral';
      if (s.includes('facebook')) return 'Facebook';
      if (s.includes('google')) return 'Google Business';
      if (s.includes('phone')) return 'Phone Call';
      if (s.includes('email')) return 'Email';
      return src || 'Direct';
    };

    filteredLeads.forEach((lead) => {
      const shortName = normalizeShortSource(lead.leadSource);
      const existing = sourceMap.get(shortName) || {
        name: shortName,
        fullSource: lead.leadSource,
        value: 0,
        convertedCount: 0,
      };
      existing.value += 1;
      if (lead.status === 'Converted to Patient' || lead.status === 'Completed') {
        existing.convertedCount += 1;
      }
      sourceMap.set(shortName, existing);
    });

    const total = filteredLeads.length || 1;
    return Array.from(sourceMap.values())
      .sort((a, b) => b.value - a.value)
      .map((item) => ({
        ...item,
        sharePct: Number(((item.value / total) * 100).toFixed(1)),
      }));
  }, [filteredLeads]);

  const inspectedPatient =
    patients.find((p) => p.id === selectedPatientProfileId) || patients[0];

  const currentJourneyStageIndex = useMemo(() => {
    if (!inspectedPatient) return 0;
    const rawStage = (inspectedPatient.journeyStage || '').toLowerCase();
    const matchedIdx = PATIENT_JOURNEY_STAGES.findIndex((s) =>
      s.aliases.some((alias) => alias.toLowerCase() === rawStage)
    );
    if (matchedIdx !== -1) return matchedIdx;
    if (rawStage.includes('trip') || rawStage.includes('post-care')) return 4;
    if (rawStage.includes('visa') || rawStage.includes('travel')) return 3;
    if (rawStage.includes('opinion') || rawStage.includes('estimate')) return 2;
    if (rawStage.includes('ai') || rawStage.includes('report')) return 1;
    return 0;
  }, [inspectedPatient]);

  const journeyProgressPercent = Math.round(
    ((currentJourneyStageIndex + 1) / PATIENT_JOURNEY_STAGES.length) * 100
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Collapsible Sidebar (Hidden when in distraction-free Standalone Patient Self-Service Mode) */}
      {!standalonePatientMode && (
      <aside
        className={`no-print bg-slate-900 text-slate-200 flex flex-col shrink-0 transition-all duration-150 border-r border-slate-800 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
          {!sidebarCollapsed && (
            <span className="text-base font-bold tracking-tight text-white whitespace-nowrap truncate">
              QureWays Trip
            </span>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const hasAccess = allowedModules.includes(item.id);
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!hasAccess}
                onClick={() => setActiveModule(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-600 text-white'
                    : hasAccess
                    ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    : 'text-slate-600 cursor-not-allowed'
                }`}
                title={item.label}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                {!sidebarCollapsed && !hasAccess && <Lock className="w-3 h-3 ml-auto text-slate-600" />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-2">
          {!sidebarCollapsed && (
            <div className="px-2 py-1 text-xs text-slate-400 truncate">
              <div className="font-semibold text-white truncate">{actor.name}</div>
              <div className="truncate text-sky-400">{currentRole}</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
      )}

      {/* Main Content Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract (3 Zones: Breadcrumb / Role Switcher / Primary Demo Seed Action) */}
        <header className="no-print flex items-center justify-between gap-4 px-6 py-3.5 bg-white border-b border-slate-200">
          <div className="text-sm font-semibold text-slate-900 whitespace-nowrap shrink-0">
            {standalonePatientMode
              ? 'QureWays Trip · রোগীর নিজস্ব সেলফ-সার্ভিস পোর্টাল (Patient Self-Service Portal)'
              : `QureWays Trip CRM / ${NAV_ITEMS.find((n) => n.id === activeModule)?.label.replace(/^\d+\.\s*/, '')}`}
          </div>

          {!standalonePatientMode && (
            <div className="hidden xl:flex items-center gap-4 text-xs text-slate-600">
              <label className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <span>Role Access Mode:</span>
                <select
                  value={currentRole}
                  onChange={(e) => handleRoleChange(e.target.value as StaffRole)}
                  className="px-2 py-1 border border-slate-300 rounded-md bg-slate-50 font-semibold text-slate-900"
                >
                  {(Object.keys(ROLE_MODULE_ACCESS) as StaffRole[]).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (standalonePatientMode) {
                  setStandalonePatientMode(false);
                } else {
                  setActiveModule('patient-portal');
                  setStandalonePatientMode(true);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>
                {standalonePatientMode
                  ? '← স্টাফ সিআরএম (CRM)-এ ফিরে যান'
                  : 'রোগীর সেলফ-সার্ভিস পোর্টাল (Patient Self-Service)'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleSeedDemoData}
              disabled={isSeeding}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Database className="w-3.5 h-3.5" />
              {isSeeding ? 'Loading Synthetic Records...' : 'Load Synthetic Demo Records'}
            </button>
          </div>
        </header>

        {statusNotice && (
          <div className="no-print mx-6 mt-4 p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between text-xs text-sky-950">
            <span>{statusNotice}</span>
            <button
              type="button"
              onClick={() => setStatusNotice('')}
              className="font-semibold text-sky-800 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* MODULE 1: OPERATIONAL DASHBOARD */}
          {activeModule === 'dashboard' && (
            <div className="space-y-6">
              {/* Filter Bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">
                    International Patient Coordination Operational Dashboard
                  </h1>
                  <p className="text-xs text-slate-600">
                    Real-time operational metrics calculated directly from Firestore records for Bangladesh → Apollo
                    Hospitals, Chennai & verified centers.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={filterTreatment}
                    onChange={(e) => setFilterTreatment(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="ALL">All Treatment Categories</option>
                    {TREATMENT_CATEGORIES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterSource}
                    onChange={(e) => setFilterSource(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="ALL">All Lead Sources</option>
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Actions Section */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Quick Actions</h2>
                    <p className="text-xs text-slate-600">
                      Execute high-frequency patient intake, lead logging, and Apollo Chennai appointment scheduling directly from the dashboard.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setQuickActionDrawer(
                          quickActionDrawer === 'add-patient' ? null : 'add-patient'
                        )
                      }
                      className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                        quickActionDrawer === 'add-patient'
                          ? 'bg-sky-800 text-white'
                          : 'bg-sky-700 text-white hover:bg-sky-800'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add New Patient</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setQuickActionDrawer(
                          quickActionDrawer === 'log-lead' ? null : 'log-lead'
                        )
                      }
                      className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                        quickActionDrawer === 'log-lead'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 text-sky-700" />
                      <span>Log New Lead</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setQuickActionDrawer(
                          quickActionDrawer === 'schedule-appointment'
                            ? null
                            : 'schedule-appointment'
                        )
                      }
                      className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                        quickActionDrawer === 'schedule-appointment'
                          ? 'bg-emerald-800 text-white border-emerald-800'
                          : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <CalendarPlus className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Schedule Appointment</span>
                    </button>
                  </div>
                </div>

                {/* Inline Quick Action Form: Add New Patient */}
                {quickActionDrawer === 'add-patient' && (
                  <form
                    onSubmit={handleCreatePatientSubmit}
                    className="pt-3 border-t border-slate-200 space-y-3 bg-slate-50/70 p-4 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        Quick Action: Register Unified Patient Profile
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveModule('patients')}
                          className="text-xs text-sky-700 hover:underline font-medium"
                        >
                          Open Full Patients Module →
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickActionDrawer(null)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <input
                        type="text"
                        required
                        value={patName}
                        onChange={(e) => setPatName(e.target.value)}
                        placeholder="Patient Full Name *"
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                      <input
                        type="text"
                        required
                        value={patPhone}
                        onChange={(e) => setPatPhone(e.target.value)}
                        placeholder="Phone (+880...) *"
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                      />
                      <input
                        type="text"
                        required
                        value={patCity}
                        onChange={(e) => setPatCity(e.target.value)}
                        placeholder="City in Bangladesh *"
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                      <select
                        value={patHospital}
                        onChange={(e) => setPatHospital(e.target.value)}
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        {VERIFIED_HOSPITALS.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                      <input
                        type="text"
                        value={patDiagnoses}
                        onChange={(e) => setPatDiagnoses(e.target.value)}
                        placeholder="Existing Diagnoses / Clinical Summary"
                        className="sm:col-span-2 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Save New Patient Profile
                      </button>
                    </div>
                  </form>
                )}

                {/* Inline Quick Action Form: Log New Lead */}
                {quickActionDrawer === 'log-lead' && (
                  <form
                    onSubmit={handleCreateLeadSubmit}
                    className="pt-3 border-t border-slate-200 space-y-3 bg-slate-50/70 p-4 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        Quick Action: Log New Patient Inquiry / Lead
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveModule('leads')}
                          className="text-xs text-sky-700 hover:underline font-medium"
                        >
                          Open Full Leads Pipeline →
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickActionDrawer(null)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <input
                        type="text"
                        required
                        value={leadName}
                        onChange={(e) => setLeadName(e.target.value)}
                        placeholder="Lead Patient Name *"
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                      <input
                        type="text"
                        required
                        value={leadPhone}
                        onChange={(e) => setLeadPhone(e.target.value)}
                        placeholder="Phone (+880...) *"
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                      />
                      <select
                        value={leadSource}
                        onChange={(e) => setLeadSource(e.target.value)}
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        {LEAD_SOURCES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <select
                        value={leadTreatment}
                        onChange={(e) => setLeadTreatment(e.target.value)}
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        {TREATMENT_CATEGORIES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                      <input
                        type="text"
                        value={leadNeeds}
                        onChange={(e) => setLeadNeeds(e.target.value)}
                        placeholder="Clinical needs, symptoms, or requested hospital service..."
                        className="sm:col-span-2 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Log Lead & Auto-Assign Task
                      </button>
                    </div>
                  </form>
                )}

                {/* Inline Quick Action Form: Schedule Appointment */}
                {quickActionDrawer === 'schedule-appointment' && (
                  <form
                    onSubmit={handleQuickScheduleAppointment}
                    className="pt-3 border-t border-slate-200 space-y-3 bg-slate-50/70 p-4 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        Quick Action: Schedule Specialist Appointment or Teleconsultation
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveModule('appointments')}
                          className="text-xs text-sky-700 hover:underline font-medium"
                        >
                          Open Full Appointments Module →
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickActionDrawer(null)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <select
                        value={quickApptPatientId || patients[0]?.id || ''}
                        onChange={(e) => setQuickApptPatientId(e.target.value)}
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
                      >
                        {patients.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.fullName} ({p.patientCode})
                          </option>
                        ))}
                      </select>

                      <select
                        value={quickApptCategory}
                        onChange={(e) => setQuickApptCategory(e.target.value)}
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="Doctor Appointment Booking">In-Person Doctor Appointment</option>
                        <option value="Teleconsultation Arrangement">Video Teleconsultation</option>
                      </select>

                      <select
                        value={quickApptHospital}
                        onChange={(e) => setQuickApptHospital(e.target.value)}
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        {VERIFIED_HOSPITALS.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        required
                        value={quickApptDoctor}
                        onChange={(e) => setQuickApptDoctor(e.target.value)}
                        placeholder="Specialist Doctor Name *"
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                      <input
                        type="date"
                        required
                        value={quickApptDate}
                        onChange={(e) => setQuickApptDate(e.target.value)}
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                      />
                      <input
                        type="text"
                        required
                        value={quickApptTime}
                        onChange={(e) => setQuickApptTime(e.target.value)}
                        placeholder="Time Slot (e.g., 11:00 AM IST)"
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                      />
                      <input
                        type="text"
                        value={quickApptServiceName}
                        onChange={(e) => setQuickApptServiceName(e.target.value)}
                        placeholder="Consultation Title"
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Confirm Appointment Slot
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Empty State Prompt to Load Synthetic Demo Data */}
              {leads.length === 0 && patients.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
                  <Database className="w-8 h-8 text-sky-700 mx-auto" />
                  <h2 className="text-base font-bold text-slate-900">
                    Your QureWays Trip CRM Database is Ready
                  </h2>
                  <p className="text-xs text-slate-600 max-w-lg mx-auto">
                    Click &ldquo;Load Synthetic Demo Records&rdquo; to populate realistic synthetic Bangladesh-to-Apollo
                    Hospitals Chennai cases (leads, unified patients, NICVD angiogram & lab documents, 15-section AI
                    preliminary report, side-by-side hospital second opinions, and itemized USD/BDT/INR cost estimates).
                  </p>
                  <button
                    type="button"
                    onClick={handleSeedDemoData}
                    disabled={isSeeding}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {isSeeding ? 'Populating Firestore...' : 'Load Synthetic Demo Records Now'}
                  </button>
                </div>
              )}

              {/* 16 Operational KPIs Grid (Section 5) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">1. Total Leads</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {totalLeadsCount}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    New today: <span className="font-mono tabular-nums font-semibold">{newInquiriesTodayCount}</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">2. Leads Requiring Follow-up</div>
                  <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
                    {leadsRequiringFollowUpCount}
                  </div>
                  <div className="text-xs text-red-700 mt-1">
                    Overdue tasks: <span className="font-mono tabular-nums font-semibold">{overdueFollowUpsCount}</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">3. AI Reports Awaiting Review</div>
                  <div className="text-2xl font-bold text-sky-800 font-mono tabular-nums mt-1">
                    {aiReportsAwaitingReviewCount}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Waiting for medical docs:{' '}
                    <span className="font-mono tabular-nums font-semibold">{patientsWaitingForDocsCount}</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">4. Hospital Opinions & Estimates</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {secondOpinions.length} / {costEstimates.length}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Opinions pending: {secondOpinionsPendingCount} · Draft est: {estimatesPendingCount}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">5. Appointments & Teleconsults</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {appointmentsScheduledCount}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Confirmed specialist slots</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">6. Visa Letters & Upcoming Trips</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {visaInProgressCount} / {upcomingTripsCount}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Med-1/Med-2 letters & flight transfers</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">7. Lead-to-Patient Conversion</div>
                  <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
                    {conversionRatePct}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Converted / Completed cases: {completedCasesCount}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">8. Coordinated Service Revenue</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    ${totalServiceRevenueUsd.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Active registered patients: {patients.length}</div>
                </div>
              </div>

              {/* Operational Analytics Row: 30-Day Conversion LineChart + Lead Volume by Source PieChart */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* 30-Day Lead Conversion Rate Recharts Line Chart */}
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        30-Day Lead-to-Patient Conversion Rate Trend
                      </h2>
                      <p className="text-xs text-slate-600">
                        Rolling 30-day cumulative conversion rate (%) and clinical pipeline progression rate.
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                      <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                        30d Conversion: <strong>{conversionRatePct}%</strong> ({completedCasesCount}/{totalLeadsCount})
                      </div>
                    </div>
                  </div>

                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={conversionTrend30Days}
                        margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="dateLabel"
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickMargin={8}
                          minTickGap={20}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tickFormatter={(val) => `${val}%`}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          width={44}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderColor: '#e2e8f0',
                            borderRadius: '0.5rem',
                            fontSize: '12px',
                          }}
                          formatter={(value: unknown, name: unknown) => [
                            `${Number(value ?? 0).toFixed(1)}%`,
                            String(name),
                          ]}
                          labelFormatter={(label, payload) => {
                            const item = payload?.[0]?.payload;
                            if (item) {
                              return `${label} (${item.dateIso}) — Converted: ${item.cumulativeConverted} of ${item.cumulativeLeads} leads`;
                            }
                            return String(label);
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                        <Line
                          type="monotone"
                          dataKey="conversionRate"
                          name="Lead-to-Patient Conversion Rate (%)"
                          stroke="#047857"
                          strokeWidth={2.5}
                          dot={{ r: 2.5, fill: '#047857' }}
                          activeDot={{ r: 5 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="qualifiedProgressionRate"
                          name="Clinical Document / Opinion Progression (%)"
                          stroke="#0369a1"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Lead Volume by Acquisition Source Recharts PieChart */}
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        Lead Volume by Acquisition Source
                      </h2>
                      <p className="text-xs text-slate-600">
                        Channel distribution (Website, WhatsApp, Referral, Social) and converted cases per source.
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                      {totalLeadsCount} total
                    </span>
                  </div>

                  {leadsBySourceData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-xs text-slate-500">
                      No leads match the current filter. Load demo records or log a new lead to view channel breakdown.
                    </div>
                  ) : (
                    <>
                      <div className="h-52 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={leadsBySourceData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={44}
                              outerRadius={76}
                              paddingAngle={2}
                            >
                              {leadsBySourceData.map((entry, idx) => (
                                <Cell
                                  key={`cell-${entry.name}`}
                                  fill={PIE_COLORS[idx % PIE_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#ffffff',
                                borderColor: '#e2e8f0',
                                borderRadius: '0.5rem',
                                fontSize: '12px',
                              }}
                              formatter={(value: unknown, _name: unknown, props: any) => {
                                const payload = props?.payload;
                                return [
                                  `${value} lead(s) (${payload?.sharePct ?? 0}% share · ${payload?.convertedCount ?? 0} converted)`,
                                  payload?.name || 'Source',
                                ];
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                        {leadsBySourceData.slice(0, 4).map((src, idx) => (
                          <div
                            key={src.name}
                            className="flex items-center justify-between py-1 px-2 rounded bg-slate-50"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor: PIE_COLORS[idx % PIE_COLORS.length],
                                }}
                              />
                              <span className="font-semibold text-slate-800">{src.name}</span>
                            </div>
                            <div className="font-mono tabular-nums text-slate-600">
                              <strong>{src.value}</strong> ({src.sharePct}%) ·{' '}
                              <span className="text-emerald-700 font-semibold">
                                {src.convertedCount} converted
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Operational Tables: Active Patient Journey Queue & Priority Tasks */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-base font-semibold text-slate-900">
                      Unified Patient Journey Tracker (Bangladesh → Apollo Chennai)
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveModule('patients')}
                      className="text-xs font-medium text-sky-700 hover:underline flex items-center gap-1"
                    >
                      <span>View All Patients</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                          <th className="py-2.5 px-3">Patient</th>
                          <th className="py-2.5 px-3">Origin</th>
                          <th className="py-2.5 px-3">Preferred Hospital</th>
                          <th className="py-2.5 px-3">Current Journey Stage</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {patients.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{p.fullName}</div>
                              <div className="font-mono tabular-nums text-slate-500">
                                {p.patientCode} · {p.age}y {p.gender}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              {p.city}, {p.country}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">{p.preferredHospital}</td>
                            <td className="py-2.5 px-3 font-medium text-sky-800">{p.journeyStage}</td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPatientProfileId(p.id);
                                  setActiveModule('patients');
                                }}
                                className="px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50 rounded-md whitespace-nowrap"
                              >
                                Open Dossier
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-base font-semibold text-slate-900">Priority Follow-ups & Review Tasks</h2>
                    <button
                      type="button"
                      onClick={() => setActiveModule('follow-ups')}
                      className="text-xs font-medium text-sky-700 hover:underline"
                    >
                      Manage Tasks
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-80 overflow-y-auto">
                    {tasks.slice(0, 6).map((t) => (
                      <div key={t.id} className="p-3 border border-slate-200 rounded-lg space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-900">{t.title}</span>
                          <span className="font-mono tabular-nums text-slate-500">{t.dueDate}</span>
                        </div>
                        <div className="text-xs text-slate-600">
                          {t.relatedType}: {t.relatedName} · Priority: <strong>{t.priority}</strong> · Status:{' '}
                          <span className="text-sky-800 font-medium">{t.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Clinical Assistant, Voice Dictation & Biomedical Evidence Hub */}
              <ClinicalIntelligencePanel
                patients={patients}
                leads={leads}
                secondOpinions={secondOpinions}
              />
            </div>
          )}

          {/* MODULE 2: LEADS AND INQUIRIES (SECTION 6 — KANBAN BOARD + 14-STAGE PIPELINE) */}
          {activeModule === 'leads' && (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Lead Capture & Interactive Kanban Inquiry Pipeline
                  </h2>
                  <p className="text-sm text-slate-600">
                    Drag and drop leads across stages (New Inquiry → Documents Received → Opinion Requested → Estimate
                    Shared → Converted) with duplicate-safe patient conversion.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search leads by name, phone, city..."
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  {/* View Switcher: Kanban vs List */}
                  <div className="flex items-center rounded-lg border border-slate-300 bg-white p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setLeadsViewMode('kanban')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap ${
                        leadsViewMode === 'kanban'
                          ? 'bg-sky-700 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Columns3 className="w-3.5 h-3.5" />
                      <span>Kanban Board</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeadsViewMode('list')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap ${
                        leadsViewMode === 'list'
                          ? 'bg-sky-700 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>List & Form View</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowLeadCaptureModal(!showLeadCaptureModal)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showLeadCaptureModal ? 'Hide New Lead Form' : 'Capture New Lead'}</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Capture New Lead Drawer when in Kanban Mode */}
              {showLeadCaptureModal && leadsViewMode === 'kanban' && (
                <form
                  onSubmit={handleCreateLeadSubmit}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="text-sm font-bold text-slate-900">
                      Capture New Patient Inquiry / Lead
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowLeadCaptureModal(false)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <input
                      type="text"
                      required
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      placeholder="Patient Full Name *"
                      className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      required
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      placeholder="Phone (+880) *"
                      className="px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                    />
                    <input
                      type="text"
                      required
                      value={leadCity}
                      onChange={(e) => setLeadCity(e.target.value)}
                      placeholder="City in Bangladesh *"
                      className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                    <select
                      value={leadSource}
                      onChange={(e) => setLeadSource(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      {LEAD_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <select
                      value={leadTreatment}
                      onChange={(e) => setLeadTreatment(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      {TREATMENT_CATEGORIES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <select
                      value={leadPriority}
                      onChange={(e) =>
                        setLeadPriority(e.target.value as 'Urgent' | 'High' | 'Medium' | 'Low')
                      }
                      className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Urgent">Urgent Priority</option>
                      <option value="High">High Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="Low">Low Priority</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                    <select
                      value={leadHospital}
                      onChange={(e) => setLeadHospital(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      {VERIFIED_HOSPITALS.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={leadNeeds}
                      onChange={(e) => setLeadNeeds(e.target.value)}
                      placeholder="Describe symptoms, local diagnoses, and requested Apollo Chennai service..."
                      className="sm:col-span-2 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Save Lead to Kanban Board
                    </button>
                  </div>
                </form>
              )}

              {/* VIEW 1: DRAG-AND-DROP 5-COLUMN KANBAN BOARD */}
              {leadsViewMode === 'kanban' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
                  {KANBAN_COLUMNS.map((col, colIdx) => {
                    const colLeads = filteredLeads.filter((l) =>
                      col.matchedStatuses.includes(l.status)
                    );
                    const isDropActive = dragOverColumnId === col.id;

                    return (
                      <div
                        key={col.id}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverColumnId !== col.id) {
                            setDragOverColumnId(col.id);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverColumnId === col.id) {
                            setDragOverColumnId(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDropLeadOnKanbanColumn(col.id, col.defaultStatus);
                        }}
                        className={`bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 min-h-[540px] flex flex-col transition-all ${
                          col.accentClass
                        } ${
                          isDropActive
                            ? 'ring-2 ring-sky-600 bg-sky-50/50'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <h3 className="text-xs font-bold text-slate-900">{col.title}</h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold tabular-nums ${col.badgeClass}`}
                          >
                            {colLeads.length}
                          </span>
                        </div>

                        <div className="space-y-2.5 flex-1">
                          {colLeads.length === 0 ? (
                            <div className="h-36 border border-dashed border-slate-200 rounded-lg flex items-center justify-center p-4 text-center text-[11px] text-slate-400">
                              Drag a lead card here to move to{' '}
                              <strong className="ml-1 text-slate-600">{col.defaultStatus}</strong>
                            </div>
                          ) : (
                            colLeads.map((l) => (
                              <div
                                key={l.id}
                                draggable
                                onDragStart={(e) => {
                                  setDraggedLeadId(l.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                  e.dataTransfer.setData('text/plain', l.id);
                                }}
                                onDragEnd={() => {
                                  setDraggedLeadId(null);
                                  setDragOverColumnId(null);
                                }}
                                className={`p-3 bg-slate-50/70 hover:bg-white border border-slate-200 rounded-lg space-y-2 cursor-grab active:cursor-grabbing shadow-2xs transition-all ${
                                  draggedLeadId === l.id ? 'opacity-50 scale-[0.98]' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                                    <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>{l.leadCode}</span>
                                  </div>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      l.priority === 'Urgent'
                                        ? 'bg-red-100 text-red-800'
                                        : l.priority === 'High'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {l.priority}
                                  </span>
                                </div>

                                <div>
                                  <div className="text-xs font-bold text-slate-900 leading-snug">
                                    {l.patientName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between gap-1">
                                    <span>
                                      {l.city}, {l.country} · <span className="font-mono">{l.phone}</span>
                                    </span>
                                    <a
                                      href={`https://wa.me/${(l.whatsapp || l.phone || '+8801711009988').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`আসসালামু আলাইকুম ${l.patientName}, QureWays Trip থেকে যোগাযোগ করছি। আপনার ${l.preferredHospital}-এ চিকিৎসা ও রিপোর্ট পর্যালোচনার জন্য অনুগ্রহ করে রিপোর্টগুলো WhatsApp-এ পাঠান। / Dear ${l.patientName}, Greetings from QureWays Trip.`)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void createCommunicationRecord(
                                          {
                                            recipientType: 'Lead',
                                            recipientId: l.id,
                                            recipientName: l.patientName,
                                            channel: 'WhatsApp',
                                            direction: 'Outbound',
                                            subject: 'WhatsApp Quick Reachout (wa.me)',
                                            messageSummary: `Launched bilingual WhatsApp reachout to ${l.patientName} (${l.whatsapp || l.phone}) for ${l.preferredHospital}.`,
                                            staffOrAutomationName: actor.name,
                                            deliveryStatus: 'Launched via wa.me Deep-Link',
                                            consentVerified: true,
                                            optOutStatus: false,
                                            ownerId: actor.uid,
                                          },
                                          actor
                                        );
                                      }}
                                      className="px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded transition-colors shrink-0"
                                      title="Launch WhatsApp (wa.me) & Log Outbound Reachout"
                                    >
                                      wa.me ↗
                                    </a>
                                  </div>
                                </div>

                                <div className="text-[11px] text-slate-700 space-y-0.5">
                                  <div className="font-semibold text-sky-900 truncate">
                                    {l.interestedTreatment}
                                  </div>
                                  <div className="text-slate-500 truncate">
                                    {l.preferredHospital}
                                  </div>
                                </div>

                                {l.needsDescription && (
                                  <p className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200/80 line-clamp-2">
                                    {l.needsDescription}
                                  </p>
                                )}

                                <div className="pt-1.5 border-t border-slate-200/80 flex items-center justify-between gap-1.5">
                                  <select
                                    value={l.status}
                                    onChange={(e) =>
                                      updateLeadStage(
                                        l.id,
                                        { status: e.target.value, patientName: l.patientName },
                                        actor
                                      )
                                    }
                                    className="px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white text-slate-800 max-w-[130px] truncate"
                                  >
                                    {LEAD_PIPELINE_STAGES.map((st) => (
                                      <option key={st} value={st}>
                                        {st}
                                      </option>
                                    ))}
                                  </select>

                                  {colIdx < KANBAN_COLUMNS.length - 1 ? (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const nextCol = KANBAN_COLUMNS[colIdx + 1];
                                        if (nextCol.id === 'col-converted') {
                                          const res = await convertLeadToPatient(l, patients, actor);
                                          setSelectedPatientProfileId(res.patientId);
                                          setStatusNotice(
                                            res.deduplicated
                                              ? `Matched existing patient profile for ${l.patientName}.`
                                              : `Converted ${l.patientName} to unified patient profile.`
                                          );
                                        } else {
                                          await updateLeadStage(
                                            l.id,
                                            {
                                              status: nextCol.defaultStatus,
                                              patientName: l.patientName,
                                            },
                                            actor
                                          );
                                          setStatusNotice(
                                            `Advanced ${l.patientName} to ${nextCol.defaultStatus}.`
                                          );
                                        }
                                      }}
                                      className="px-2 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-100 rounded transition-colors whitespace-nowrap"
                                      title={`Advance to ${KANBAN_COLUMNS[colIdx + 1].title}`}
                                    >
                                      Next →
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (l.convertedPatientId) {
                                          setSelectedPatientProfileId(l.convertedPatientId);
                                        }
                                        setActiveModule('patients');
                                      }}
                                      className="px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 rounded transition-colors whitespace-nowrap"
                                    >
                                      Dossier →
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* VIEW 2: DETAILED 14-STAGE LIST & SIDE-BY-SIDE FORM VIEW */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Create Lead Form */}
                  <form
                    onSubmit={handleCreateLeadSubmit}
                    className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-3.5 h-fit"
                  >
                    <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
                      Capture New Inquiry / Lead
                    </h3>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Patient Full Name *</label>
                      <input
                        type="text"
                        required
                        value={leadName}
                        onChange={(e) => setLeadName(e.target.value)}
                        placeholder="e.g., Md. Anisur Rahman"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Phone (+880) *</label>
                        <input
                          type="text"
                          required
                          value={leadPhone}
                          onChange={(e) => setLeadPhone(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">City in Bangladesh *</label>
                        <input
                          type="text"
                          required
                          value={leadCity}
                          onChange={(e) => setLeadCity(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Lead Source *</label>
                        <select
                          value={leadSource}
                          onChange={(e) => setLeadSource(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                        >
                          {LEAD_SOURCES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                        <select
                          value={leadPriority}
                          onChange={(e) => setLeadPriority(e.target.value as 'Urgent' | 'High' | 'Medium' | 'Low')}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="Urgent">Urgent</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Interested Treatment *</label>
                      <select
                        value={leadTreatment}
                        onChange={(e) => setLeadTreatment(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        {TREATMENT_CATEGORIES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Preferred Hospital *</label>
                      <select
                        value={leadHospital}
                        onChange={(e) => setLeadHospital(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        {VERIFIED_HOSPITALS.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Patient Needs & Clinical Summary
                      </label>
                      <textarea
                        rows={3}
                        value={leadNeeds}
                        onChange={(e) => setLeadNeeds(e.target.value)}
                        placeholder="Describe symptoms, local diagnoses, and requested Apollo Chennai service..."
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={leadConsent}
                        onChange={(e) => setLeadConsent(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <span>Patient consent for medical coordination verified</span>
                    </label>
                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      Save Lead & Create Contact Task
                    </button>
                  </form>

                  {/* Lead Pipeline Table */}
                  <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="text-base font-semibold text-slate-900">Active Leads Pipeline</h3>
                      <span className="text-xs text-slate-500 font-mono tabular-nums">
                        {filteredLeads.length} leads
                      </span>
                    </div>

                    <div className="space-y-3">
                      {filteredLeads.map((l) => (
                        <div key={l.id} className="p-4 border border-slate-200 rounded-lg space-y-2.5 hover:bg-slate-50/50">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="text-xs text-slate-500 font-mono tabular-nums">
                                {l.leadCode} · {l.inquiryDate} · Source: {l.leadSource} · Priority:{' '}
                                <strong className="text-slate-800">{l.priority}</strong>
                              </div>
                              <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                                {l.patientName} ({l.city}, {l.country})
                              </h4>
                              <div className="text-xs text-slate-600">
                                Phone: <span className="font-mono tabular-nums">{l.phone}</span> · Treatment:{' '}
                                <strong className="text-slate-800">{l.interestedTreatment}</strong> · Target:{' '}
                                {l.preferredHospital}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <select
                                value={l.status}
                                onChange={(e) =>
                                  updateLeadStage(l.id, { status: e.target.value, patientName: l.patientName }, actor)
                                }
                                className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-800"
                              >
                                {LEAD_PIPELINE_STAGES.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>

                              {l.status !== 'Converted to Patient' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const res = await convertLeadToPatient(l, patients, actor);
                                    setSelectedPatientProfileId(res.patientId);
                                    setStatusNotice(
                                      res.deduplicated
                                        ? `Matched existing patient profile (Duplicate avoided) for ${l.patientName}.`
                                        : `Converted ${l.patientName} to unified patient profile.`
                                    );
                                  }}
                                  className="px-3 py-1 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors whitespace-nowrap"
                                >
                                  Convert to Patient
                                </button>
                              )}
                            </div>
                          </div>

                          {l.needsDescription && (
                            <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200/80">
                              {l.needsDescription}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODULE 3: UNIFIED PATIENTS PROFILE (SECTION 7 - ALL 13 SECTIONS A TO M) */}
          {activeModule === 'patients' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Unified International Patient Profiles (Sections A–M)
                  </h2>
                  <p className="text-sm text-slate-600">
                    One unified dossier per patient containing personal details, medical history, documents, AI reports,
                    hospital opinions, estimates, bookings, and consent history.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-700">Inspect Unified Profile:</label>
                  <select
                    value={inspectedPatient?.id || ''}
                    onChange={(e) => setSelectedPatientProfileId(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} ({p.patientCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Register New Patient Form */}
                <form
                  onSubmit={handleCreatePatientSubmit}
                  className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-3.5 h-fit"
                >
                  <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
                    Register Unified Patient Profile
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={patName}
                      onChange={(e) => setPatName(e.target.value)}
                      placeholder="e.g., Mrs. Tahmina Akter"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Age *</label>
                      <input
                        type="number"
                        required
                        value={patAge}
                        onChange={(e) => setPatAge(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
                      <select
                        value={patGender}
                        onChange={(e) => setPatGender(e.target.value)}
                        className="w-full px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Passport No.</label>
                      <input
                        type="text"
                        value={patPassport}
                        onChange={(e) => setPatPassport(e.target.value)}
                        placeholder="A0..."
                        className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Phone *</label>
                      <input
                        type="text"
                        required
                        value={patPhone}
                        onChange={(e) => setPatPhone(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">City *</label>
                      <input
                        type="text"
                        required
                        value={patCity}
                        onChange={(e) => setPatCity(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Preferred Hospital *</label>
                    <select
                      value={patHospital}
                      onChange={(e) => setPatHospital(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      {VERIFIED_HOSPITALS.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      B. Medical History & Existing Diagnoses
                    </label>
                    <textarea
                      rows={2}
                      value={patDiagnoses}
                      onChange={(e) => setPatDiagnoses(e.target.value)}
                      placeholder="Documented diagnoses, comorbidities..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      C. Treatment Requirements & Symptoms
                    </label>
                    <textarea
                      rows={2}
                      value={patRequirements}
                      onChange={(e) => setPatRequirements(e.target.value)}
                      placeholder="Requested procedure, second opinion, or evaluation..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-700">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={patDataConsent}
                        onChange={(e) => setPatDataConsent(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <span>Explicit consent for medical record processing (Required)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={patMarketingConsent}
                        onChange={(e) => setPatMarketingConsent(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <span>Separate marketing communication consent (Optional)</span>
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Create Unified Patient Profile
                  </button>
                </form>

                {/* Right: 13-Section Unified Patient Dossier (Sections A–M) */}
                <div className="lg:col-span-8">
                  {inspectedPatient ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                        <div>
                          <div className="text-xs text-slate-500 font-mono tabular-nums">
                            Unified Patient ID: {inspectedPatient.patientCode} · Coordinator:{' '}
                            {inspectedPatient.assignedCoordinatorName}
                          </div>
                          <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                            {inspectedPatient.fullName} ({inspectedPatient.age}y · {inspectedPatient.gender})
                          </h3>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {inspectedPatient.city}, {inspectedPatient.country} · Phone:{' '}
                            <span className="font-mono tabular-nums">{inspectedPatient.phone}</span> · Passport:{' '}
                            <span className="font-mono tabular-nums">{inspectedPatient.passportNumber || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 no-print">
                          <button
                            type="button"
                            onClick={async () => {
                              const patientDocs = documents.filter(
                                (d) => d.patientId === inspectedPatient.id
                              );
                              const patientAiReports = aiReports.filter(
                                (r) => r.patientId === inspectedPatient.id
                              );
                              const patientOpinions = secondOpinions.filter(
                                (o) => o.patientId === inspectedPatient.id
                              );
                              const patientEstimates = costEstimates.filter(
                                (c) => c.patientId === inspectedPatient.id
                              );
                              const patientBookings = serviceBookings.filter(
                                (b) => b.patientId === inspectedPatient.id
                              );

                              const fileName = generatePatientPartnerPdf({
                                patient: inspectedPatient,
                                currentStageIndex: currentJourneyStageIndex,
                                journeyProgressPercent,
                                documents: patientDocs,
                                aiReports: patientAiReports,
                                secondOpinions: patientOpinions,
                                costEstimates: patientEstimates,
                                serviceBookings: patientBookings,
                                generatedBy: {
                                  name: actor.name,
                                  role: actor.role,
                                },
                              });

                              await logAuditEvent({
                                actorUid: actor.uid,
                                actorName: actor.name,
                                actorRole: actor.role,
                                action: 'Generated Partner Referral PDF Report',
                                module: 'Patients',
                                targetId: inspectedPatient.id,
                                targetName: inspectedPatient.fullName,
                                details: `Exported ${fileName} (Stage: ${
                                  PATIENT_JOURNEY_STAGES[currentJourneyStageIndex]?.label ||
                                  inspectedPatient.journeyStage
                                })`,
                              });

                              setStatusNotice(
                                `Generated and downloaded Hospital Partner PDF Dossier: ${fileName}`
                              );
                            }}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            <span>Generate Partner PDF Report</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print Summary</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveModule('patient-portal');
                              setStandalonePatientMode(true);
                            }}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap"
                          >
                            রোগীর সেলফ-সার্ভিস পোর্টাল ও শেয়ার লিংক →
                          </button>
                        </div>
                      </div>

                      {/* Visual Patient Journey Progress Bar & Milestone Timeline */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              International Patient Care Journey Timeline
                            </div>
                            <p className="text-xs text-slate-600">
                              Current Stage:{' '}
                              <strong className="text-sky-800">
                                {PATIENT_JOURNEY_STAGES[currentJourneyStageIndex]?.label ||
                                  inspectedPatient.journeyStage}
                              </strong>{' '}
                              · Click any milestone step below to update stage in Firestore
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono tabular-nums font-bold text-sky-800 bg-sky-100/80 px-2.5 py-1 rounded-md">
                              Stage {currentJourneyStageIndex + 1} of {PATIENT_JOURNEY_STAGES.length} ({journeyProgressPercent}%)
                            </span>
                            {currentJourneyStageIndex < PATIENT_JOURNEY_STAGES.length - 1 && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const nextStage =
                                    PATIENT_JOURNEY_STAGES[currentJourneyStageIndex + 1].id;
                                  await updatePatientJourneyStage(
                                    inspectedPatient.id,
                                    nextStage,
                                    inspectedPatient.fullName,
                                    actor
                                  );
                                  setStatusNotice(
                                    `Advanced ${inspectedPatient.fullName} to stage: ${nextStage}`
                                  );
                                }}
                                className="px-3 py-1 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-md transition-colors whitespace-nowrap"
                              >
                                Advance Stage →
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Horizontal Progress Bar Track */}
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-600 transition-all duration-300 rounded-full"
                            style={{ width: `${journeyProgressPercent}%` }}
                          />
                        </div>

                        {/* Interactive 5-Stage Milestone Nodes */}
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                          {PATIENT_JOURNEY_STAGES.map((stage, idx) => {
                            const isCompleted = idx < currentJourneyStageIndex;
                            const isCurrent = idx === currentJourneyStageIndex;
                            return (
                              <button
                                key={stage.id}
                                type="button"
                                onClick={async () => {
                                  await updatePatientJourneyStage(
                                    inspectedPatient.id,
                                    stage.id,
                                    inspectedPatient.fullName,
                                    actor
                                  );
                                  setStatusNotice(
                                    `Updated ${inspectedPatient.fullName} journey stage to: ${stage.label}`
                                  );
                                }}
                                className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                                  isCurrent
                                    ? 'bg-sky-50 border-sky-600 ring-1 ring-sky-600'
                                    : isCompleted
                                    ? 'bg-white border-emerald-300 hover:border-emerald-400'
                                    : 'bg-white border-slate-200 opacity-75 hover:opacity-100 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1.5 mb-1">
                                  <span
                                    className={`text-[11px] font-mono font-bold ${
                                      isCurrent
                                        ? 'text-sky-800'
                                        : isCompleted
                                        ? 'text-emerald-700'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    0{idx + 1}
                                  </span>
                                  {isCompleted ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  ) : isCurrent ? (
                                    <span className="w-2 h-2 rounded-full bg-sky-600 shrink-0" />
                                  ) : (
                                    <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                                  )}
                                </div>
                                <div>
                                  <div
                                    className={`text-xs font-bold leading-snug ${
                                      isCurrent
                                        ? 'text-sky-950'
                                        : isCompleted
                                        ? 'text-slate-900'
                                        : 'text-slate-600'
                                    }`}
                                  >
                                    {stage.label}
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                    {stage.description}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                          <div className="font-bold text-slate-900">A. Personal & Contact Information</div>
                          <div>Language: {inspectedPatient.preferredLanguage} · Channel: {inspectedPatient.preferredChannel || 'WhatsApp'}</div>
                          <div>Emergency Contact: {inspectedPatient.emergencyContact || 'On File'}</div>
                        </div>
                        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                          <div className="font-bold text-slate-900">M. Consent & Privacy Preferences</div>
                          <div>
                            Medical Record Processing Consent:{' '}
                            <strong className="text-emerald-700">
                              {inspectedPatient.dataProcessingConsent ? 'Granted' : 'Pending'}
                            </strong>
                          </div>
                          <div>
                            Separate Marketing Consent:{' '}
                            <strong>{inspectedPatient.marketingConsent ? 'Opted In' : 'Opted Out (Care Only)'}</strong>
                          </div>
                        </div>
                        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                          <div className="font-bold text-slate-900">B. Medical History & Diagnoses</div>
                          <p className="text-slate-700">{inspectedPatient.medicalHistorySummary}</p>
                          <p className="text-slate-600">
                            <strong>Diagnoses:</strong> {inspectedPatient.existingDiagnoses}
                          </p>
                        </div>
                        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                          <div className="font-bold text-slate-900">C. Treatment Requirements & Destination</div>
                          <p className="text-slate-700">{inspectedPatient.treatmentRequirements}</p>
                          <p className="text-sky-800 font-medium">{inspectedPatient.preferredHospital}</p>
                        </div>
                      </div>

                      {/* Linked D–L Summary Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => setActiveModule('documents')}
                          className="p-3 border border-slate-200 rounded-lg text-left hover:bg-slate-50"
                        >
                          <div className="text-slate-500">D. Medical Documents</div>
                          <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                            {documents.filter((d) => d.patientId === inspectedPatient.id).length} files
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveModule('ai-assistant')}
                          className="p-3 border border-slate-200 rounded-lg text-left hover:bg-slate-50"
                        >
                          <div className="text-slate-500">E. AI Preliminary Reports</div>
                          <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                            {aiReports.filter((r) => r.patientId === inspectedPatient.id).length} reports
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveModule('second-opinions')}
                          className="p-3 border border-slate-200 rounded-lg text-left hover:bg-slate-50"
                        >
                          <div className="text-slate-500">F. Second Opinions</div>
                          <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                            {secondOpinions.filter((o) => o.patientId === inspectedPatient.id).length} opinions
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveModule('cost-estimator')}
                          className="p-3 border border-slate-200 rounded-lg text-left hover:bg-slate-50"
                        >
                          <div className="text-slate-500">G. Cost Estimates</div>
                          <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                            {costEstimates.filter((c) => c.patientId === inspectedPatient.id).length} estimates
                          </div>
                        </button>
                      </div>

                      {/* Step 12: Post-Return Bangladesh Tele-Follow-Up & Discharge Medication Continuity Tracker */}
                      <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3 no-print">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              N. Post-Return Bangladesh Tele-Follow-Up & Discharge Medication Continuity
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">
                              Coordinate 14-day & 30-day post-discharge teleconsultations with{' '}
                              <strong className="text-slate-800">{inspectedPatient.preferredHospital}</strong> after
                              returning to {inspectedPatient.city}, Bangladesh.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const followUpDate = new Date(Date.now() + 14 * 86400000)
                                  .toISOString()
                                  .slice(0, 10);
                                await createServiceBooking(
                                  {
                                    patientId: inspectedPatient.id,
                                    patientName: inspectedPatient.fullName,
                                    serviceCategory: 'Post-Treatment Follow-up',
                                    serviceName: `14-Day Post-Discharge Bangladesh Video Review & Lab Check (${inspectedPatient.city})`,
                                    hospitalOrProvider: inspectedPatient.preferredHospital,
                                    doctorName: 'Treating Senior Consultant',
                                    scheduledDate: followUpDate,
                                    scheduledTime: '16:30 BST (Dhaka) / 16:00 IST (Chennai)',
                                    serviceFeeUsd: 30,
                                    processingTimeEstimate: '48 Hours',
                                    status: 'Confirmed',
                                    assignedCoordinatorName: actor.name,
                                    notes:
                                      'Review post-op CBC, Creatinine, ECG/Echo & discharge medication titration from Bangladesh.',
                                    ownerId: actor.uid,
                                  },
                                  actor
                                );
                                setStatusNotice(
                                  `Scheduled 14-day Post-Return Bangladesh Tele-Follow-Up for ${inspectedPatient.fullName} on ${followUpDate}.`
                                );
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
                            >
                              + Schedule 14-Day Post-Return Tele-Review
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveModule('appointments')}
                              className="px-3 py-1.5 text-xs font-medium text-emerald-900 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap"
                            >
                              View Follow-Up Bookings →
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await createServiceBooking(
                                  {
                                    patientId: inspectedPatient.id,
                                    patientName: inspectedPatient.fullName,
                                    serviceCategory: 'Airport Pickup & Drop-off',
                                    serviceName: `24/7 Apollo Emergency Hotline (1066) & ACLS Ambulance Dispatch — ${inspectedPatient.preferredHospital}`,
                                    hospitalOrProvider: inspectedPatient.preferredHospital,
                                    doctorName: 'Apollo 24/7 Emergency Triage',
                                    scheduledDate: new Date().toISOString().slice(0, 10),
                                    scheduledTime: 'IMMEDIATE 24/7 DISPATCH',
                                    serviceFeeUsd: 0,
                                    processingTimeEstimate: 'Immediate Priority',
                                    status: 'In Progress',
                                    assignedCoordinatorName: actor.name,
                                    notes: `Medical Notes: ${inspectedPatient.medicalHistorySummary || 'None'} | Emergency Contact: ${inspectedPatient.emergencyContact || inspectedPatient.phone}`,
                                    ownerId: actor.uid,
                                  },
                                  actor
                                );
                                setStatusNotice(
                                  `Logged 24/7 Apollo Emergency Hotline (1066) & Ambulance Dispatch for ${inspectedPatient.fullName}.`
                                );
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap"
                            >
                              24/7 Apollo Emergency Dispatch (1066)
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* MODULES 4, 5, 6: DOCUMENTS, AI MEDICAL REPORT ASSISTANT, SECOND OPINIONS */}
          {(activeModule === 'documents' ||
            activeModule === 'ai-assistant' ||
            activeModule === 'second-opinions') && (
            <AiReportAssistantView
              activeSubModule={activeModule}
              patients={patients}
              documents={documents}
              aiReports={aiReports}
              secondOpinions={secondOpinions}
              actor={actor}
            />
          )}

          {/* MODULES 7, 8, 9, 10: COST ESTIMATOR, SERVICES, APPOINTMENTS, VISA & TRAVEL */}
          {(activeModule === 'cost-estimator' ||
            activeModule === 'services-bookings' ||
            activeModule === 'appointments' ||
            activeModule === 'visa-travel') && (
            <CostAndServicesView
              activeSubModule={activeModule}
              patients={patients}
              costEstimates={costEstimates}
              serviceBookings={serviceBookings}
              actor={actor}
            />
          )}

          {/* MODULES 11, 12, 13, 14, 15, 16: FOLLOW-UPS, COMMUNICATIONS, HOSPITALS, ANALYTICS, STAFF, SETTINGS */}
          {(activeModule === 'follow-ups' ||
            activeModule === 'communications' ||
            activeModule === 'hospitals' ||
            activeModule === 'analytics' ||
            activeModule === 'staff-permissions' ||
            activeModule === 'settings') && (
            <OperationsAndAdminView
              activeSubModule={activeModule}
              leads={leads}
              patients={patients}
              tasks={tasks}
              communications={communications}
              hospitals={hospitals}
              secondOpinions={secondOpinions}
              costEstimates={costEstimates}
              auditLogs={auditLogs}
              actor={actor}
              onRoleChange={handleRoleChange}
            />
          )}

          {/* PATIENT PORTAL VIEW (SECTION 7) */}
          {activeModule === 'patient-portal' && (
            <PatientPortalView
              patients={patients}
              documents={documents}
              aiReports={aiReports}
              secondOpinions={secondOpinions}
              costEstimates={costEstimates}
              serviceBookings={serviceBookings}
              communications={communications}
              actor={actor}
              isStaffPreview={currentRole !== 'Patient'}
              initialPatientId={selectedPatientProfileId}
              standaloneMode={standalonePatientMode}
              onToggleStandaloneMode={() => setStandalonePatientMode((prev) => !prev)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
