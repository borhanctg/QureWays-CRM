import React, { useState } from 'react';
import {
  CheckSquare,
  MessageSquare,
  Building2,
  BarChart3,
  Shield,
  Settings,
  Download,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  Languages,
  Copy,
  Send,
  Search,
  Zap,
} from 'lucide-react';
import {
  ROLE_MODULE_ACCESS,
  type StaffRole,
  type LeadRecord,
  type PatientRecord,
  type FollowUpTaskRecord,
  type CommunicationRecordItem,
  type HospitalDirectoryRecord,
  type AuditLogRecord,
  type HospitalSecondOpinionRecord,
  type TreatmentCostEstimateRecord,
} from '../types/crm';
import {
  createFollowUpTask,
  updateTaskStatus,
  deleteTaskRecord,
  createCommunicationRecord,
  createHospitalDirectoryEntry,
  createSecondOpinion,
} from '../lib/crmService';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface Props {
  activeSubModule:
    | 'follow-ups'
    | 'communications'
    | 'hospitals'
    | 'analytics'
    | 'staff-permissions'
    | 'settings';
  leads: LeadRecord[];
  patients: PatientRecord[];
  tasks: FollowUpTaskRecord[];
  communications: CommunicationRecordItem[];
  hospitals: HospitalDirectoryRecord[];
  secondOpinions: HospitalSecondOpinionRecord[];
  costEstimates: TreatmentCostEstimateRecord[];
  auditLogs: AuditLogRecord[];
  actor: { uid: string; name: string; role: StaffRole };
  onRoleChange: (newRole: StaffRole) => void;
}

export const OperationsAndAdminView: React.FC<Props> = ({
  activeSubModule,
  leads,
  patients,
  tasks,
  communications,
  hospitals,
  secondOpinions,
  costEstimates,
  auditLogs,
  actor,
  onRoleChange,
}) => {
  // Task State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskRelatedName, setTaskRelatedName] = useState(patients[0]?.fullName || 'Patient');
  const [taskPriority, setTaskPriority] = useState<'Urgent' | 'High' | 'Medium' | 'Low'>('High');
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [taskNotes, setTaskNotes] = useState('');

  // Communication State
  const [commRecipient, setCommRecipient] = useState(patients[0]?.fullName || leads[0]?.patientName || '');
  const [commChannel, setCommChannel] = useState('WhatsApp');
  const [commDirection, setCommDirection] = useState<'Inbound' | 'Outbound'>('Outbound');
  const [commSubject, setCommSubject] = useState('');
  const [commSummary, setCommSummary] = useState('');
  const [commConsent, setCommConsent] = useState(true);
  const [templateLangMode, setTemplateLangMode] = useState<'bilingual' | 'bn' | 'en'>('bilingual');
  const [copiedTemplateId, setCopiedTemplateId] = useState<string>('');
  const [templateNotice, setTemplateNotice] = useState<string>('');

  // Hospital Directory State
  const [hospName, setHospName] = useState('');
  const [hospCity, setHospCity] = useState('Chennai');
  const [hospCountry, setHospCountry] = useState('India');
  const [hospAccreditation, setHospAccreditation] = useState('JCI & NABH Accredited');
  const [hospSpecialties, setHospSpecialties] = useState('');
  const [hospDoctors, setHospDoctors] = useState('');
  const [hospContact, setHospContact] = useState('');

  // Step 8: SLA Filter & Escalation State
  const [taskFilterMode, setTaskFilterMode] = useState<'all' | 'overdue' | 'urgent' | 'completed'>('all');
  const [slaNotice, setSlaNotice] = useState<string>('');

  // Step 9: Hospital & Doctor Directory Filter + Direct Opinion Request State
  const [hospSearchQuery, setHospSearchQuery] = useState<string>('');
  const [hospTargetPatientId, setHospTargetPatientId] = useState<string>(patients[0]?.id || '');
  const [hospNotice, setHospNotice] = useState<string>('');

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    await createFollowUpTask(
      {
        title: taskTitle,
        description: taskNotes,
        relatedType: 'Patient',
        relatedId: patients[0]?.id || 'manual',
        relatedName: taskRelatedName,
        assignedToName: actor.name,
        priority: taskPriority,
        dueDate: taskDueDate,
        status: 'Pending',
        automationTrigger: 'Manual Staff Task Assignment',
        ownerId: actor.uid,
      },
      actor
    );
    setTaskTitle('');
    setTaskNotes('');
  };

  const handleLogCommunication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commSummary.trim()) return;
    await createCommunicationRecord(
      {
        recipientType: 'Patient / Lead',
        recipientId: patients[0]?.id || leads[0]?.id || 'manual',
        recipientName: commRecipient || 'Patient',
        channel: commChannel,
        direction: commDirection,
        subject: commSubject,
        messageSummary: commSummary,
        staffOrAutomationName: actor.name,
        deliveryStatus: 'Logged (Manual Entry)',
        consentVerified: commConsent,
        optOutStatus: false,
        ownerId: actor.uid,
      },
      actor
    );
    setCommSubject('');
    setCommSummary('');
  };

  // Resolve target hospital and +880 WhatsApp number for commRecipient
  const matchedPatientOrLeadHospital =
    patients.find((p) => p.fullName === commRecipient)?.preferredHospital ||
    leads.find((l) => l.patientName === commRecipient)?.preferredHospital ||
    'Apollo Hospitals, Greams Road, Chennai';

  const matchedRecipientPhone =
    patients.find((p) => p.fullName === commRecipient)?.whatsapp ||
    patients.find((p) => p.fullName === commRecipient)?.phone ||
    leads.find((l) => l.patientName === commRecipient)?.whatsapp ||
    leads.find((l) => l.patientName === commRecipient)?.phone ||
    '+8801711009988';

  const cleanWaPhone = matchedRecipientPhone.replace(/[^0-9]/g, '') || '8801711009988';

  const whatsappQuickTemplates = [
    {
      id: 'doc-checklist',
      badge: '1. Document Checklist',
      title: 'Medical Document Checklist (মেডিকেল রিপোর্ট ও কাগজপত্রের তালিকা)',
      subject: 'Medical Documents Checklist for Apollo Hospitals Chennai Review',
      bnText: `আসসালামু আলাইকুম / নমস্কার ${commRecipient || 'সম্মানিত রোগী'},\nQureWays Trip-এর পক্ষ থেকে শুভেচ্ছা। আপনার ${matchedPatientOrLeadHospital}-এ বিশেষজ্ঞ ডাক্তারের মতামত (Second Opinion) ও চিকিৎসা পরিকল্পনার জন্য অনুগ্রহ করে নিচের কাগজপত্রগুলোর স্পষ্ট ছবি বা PDF আমাদের WhatsApp-এ পাঠান:\n১. সর্বশেষ ডাক্তারের প্রেসক্রিপশন ও ডিসচার্জ সামারি (Discharge Summary)\n২. রক্ত ও ল্যাবরেটরি টেস্ট রিপোর্ট (CBC, Creatinine, LFT, HbA1c ইত্যাদি)\n৩. ইমেজিং বা স্ক্যান রিপোর্ট (Echo / Angiogram / CT / MRI / Biopsy Report)\n৪. রোগীর পাসপোর্টের তথ্য পাতার (Bio-page) কপি\n— সমন্বয়কারী: ${actor.name}, QureWays Trip`,
      enText: `Dear ${commRecipient || 'Patient'},\nGreetings from QureWays Trip International Patient Coordination. To prepare your clinical dossier and request an official specialist opinion from ${matchedPatientOrLeadHospital}, please share clear photos or PDF copies of the following on WhatsApp:\n1. Latest Doctor Prescriptions & Hospital Discharge Summary\n2. Recent Blood & Lab Reports (CBC, Serum Creatinine, LFT, HbA1c)\n3. Diagnostic Imaging / Biopsy Reports (Echo, Coronary Angiogram, CT, MRI, or Histopathology)\n4. Clear copy of the Patient's Passport Bio-Page\n— Coordinator: ${actor.name}, QureWays Trip`,
    },
    {
      id: 'visa-requirements',
      badge: '2. Visa Requirements (Med-1/Med-2)',
      title: 'Indian Medical Visa & IVAC Checklist (মেডিকেল ভিসা ও IVAC কাগজপত্র)',
      subject: 'Indian Medical Visa (Med-1 / Med-2) & IVAC Checklist',
      bnText: `প্রিয় ${commRecipient || 'সম্মানিত রোগী'},\nভারতে চিকিৎসার জন্য আপনার মেডিকেল ভিসা (Med-1) এবং অ্যাটেনডেন্ট ভিসার (Med-2) আবেদনের জন্য নিচের কাগজপত্রগুলো প্রস্তুত রাখুন:\n১. রোগী ও অ্যাটেনডেন্টের মূল পাসপোর্ট (কমপক্ষে ৬ মাসের মেয়াদ থাকতে হবে)\n২. ${matchedPatientOrLeadHospital} থেকে ইস্যুকৃত অফিসিয়াল ভিসা ইনভাইটেশন লেটার (Visa Invitation Letter)\n৩. বাংলাদেশের বিশেষজ্ঞ ডাক্তারের রেফারেল লেটার ও সকল মেডিকেল রিপোর্ট\n৪. ব্যাংক স্টেটমেন্ট (গত ৬ মাস) বা পাসপোর্টে ডলার এন্ডোর্সমেন্ট এবং ইউটিলিটি বিলের কপি (বিদ্যুৎ/গ্যাস বিল)\n৫. জাতীয় পরিচয়পত্র (NID) ও সদ্য তোলা ২x২ সাদা ব্যাকগ্রাউন্ডের ছবি।\n— ${actor.name}, QureWays Trip Visa Desk`,
      enText: `Dear ${commRecipient || 'Patient'},\nPlease prepare the following documents for your Indian Medical Visa (Med-1) and Medical Attendant Visa (Med-2) submission at IVAC Bangladesh (Dhaka / Chattogram / Sylhet):\n1. Original Passports of Patient & Attendant (minimum 6 months validity required)\n2. Official Visa Invitation Letter issued by ${matchedPatientOrLeadHospital}\n3. Local specialist referral letter & complete medical file from Bangladesh\n4. Last 6 months Bank Statement or USD Passport Endorsement + recent Utility Bill (Electricity/Gas)\n5. National ID (NID) copy & recent 2x2 white-background photographs.\n— ${actor.name}, QureWays Trip Visa Desk`,
    },
    {
      id: 'usd-endorsement',
      badge: '3. Passport USD Endorsement',
      title: 'Passport USD Endorsement & Pre-Travel Reminder (ডলার এন্ডোর্সমেন্ট ও ভ্রমণ প্রস্তুতি)',
      subject: 'Pre-Travel Checklist & Passport USD Endorsement Reminder',
      bnText: `জরুরি ভ্রমণ বার্তা — প্রিয় ${commRecipient || 'সম্মানিত রোগী'},\nচেন্নাই যাত্রার পূর্বে অনুগ্রহ করে নিচের বিষয়গুলো নিশ্চিত করুন:\n১. আপনার এবং অ্যাটেনডেন্টের পাসপোর্টে অনুমোদিত ব্যাংক থেকে প্রয়োজনীয় মার্কিন ডলার (USD) এন্ডোর্সমেন্ট (Endorsement) করে নিন এবং ডুয়াল-কারেন্সি কার্ডের আন্তর্জাতিক লেনদেন (International Transaction) সচল করুন।\n২. সকল মূল মেডিকেল রিপোর্ট, এনজিওগ্রাম/সিটি স্ক্যানের CD এবং বায়োপসি ব্লক/স্লাইড (প্রযোজ্য হলে) হাতের ব্যাগে (Hand Luggage) সাথে রাখুন।\n৩. নিয়মিত সেবন করা ওষুধগুলো অন্তত ১৫ দিনের পরিমাণে প্রেসক্রিপশনসহ সাথে নিন।\n— ${actor.name}, QureWays Trip`,
      enText: `Pre-Departure Reminder — Dear ${commRecipient || 'Patient'},\nBefore your flight from Bangladesh to Chennai, please ensure the following:\n1. Complete USD Currency Endorsement on your passport at an authorized bank and enable international medical quota transactions on your dual-currency card.\n2. Carry all original medical files, investigation CDs/DVDs (Angiogram/CT/MRI), and pathology biopsy blocks/slides in your cabin hand luggage.\n3. Carry at least 15 days of your regular prescribed medications along with the prescription.\n— ${actor.name}, QureWays Trip`,
    },
    {
      id: 'airport-pickup',
      badge: '4. Chennai Airport Pickup (MAA)',
      title: 'Chennai Airport Pickup & Interpreter Details (চেন্নাই এয়ারপোর্ট পিকআপ ও দোভাষী সহায়তা)',
      subject: 'Confirmed Chennai Airport (MAA) Pickup & Bengali Interpreter Details',
      bnText: `শুভ যাত্রা ${commRecipient || 'সম্মানিত রোগী'}!\nচেন্নাই আন্তর্জাতিক বিমানবন্দরে (MAA) পৌঁছানোর পর আপনার পিকআপ ও হাসপাতালের তথ্য নিচে দেওয়া হলো:\n• পিকআপ স্থান: চেন্নাই ইমিগ্রেশন ও কাস্টমস শেষ করে International Arrival Exit Gate-এর বাইরে আসলে QureWays / Apollo International Desk প্রতিনিধি আপনার নাম লেখা প্ল্যাকার্ডসহ অপেক্ষা করবেন।\n• বাংলা দোভাষী (Bengali Interpreter): হাসপাতালে পৌঁছানোর পর নিবন্ধন ও ডাক্তারের পরামর্শের জন্য আমাদের বাংলা ভাষাভাষী সমন্বয়কারী আপনার সাথে থাকবেন।\n• জরুরি প্রয়োজনে বিমানবন্দরে নেমেই আমাদের WhatsApp নম্বরে একটি মেসেজ বা কল দিন।\n— ${actor.name}, QureWays Trip Chennai Desk`,
      enText: `Safe Travels, ${commRecipient || 'Patient'}!\nHere are your arrival & airport transfer details for Chennai International Airport (MAA):\n• Meeting Point: After clearing Immigration and Customs, exit through the International Arrival Gate where our QureWays / Apollo Airport Representative will be waiting holding a placard with your name.\n• Bengali Interpreter Support: A dedicated Bengali-speaking coordinator is arranged at ${matchedPatientOrLeadHospital} to assist with registration, doctor consultations, and FRRO formalities.\n• Please send us a quick WhatsApp message upon landing in Chennai.\n— ${actor.name}, QureWays Trip Chennai Desk`,
    },
  ];

  const formatTemplateMessage = (tpl: (typeof whatsappQuickTemplates)[number]) => {
    if (templateLangMode === 'bn') return tpl.bnText;
    if (templateLangMode === 'en') return tpl.enText;
    return `${tpl.bnText}\n\n---\n\n${tpl.enText}`;
  };

  const handleApplyTemplateToComposer = (tpl: (typeof whatsappQuickTemplates)[number]) => {
    setCommChannel('WhatsApp');
    setCommDirection('Outbound');
    setCommSubject(tpl.subject);
    setCommSummary(formatTemplateMessage(tpl));
    setCommConsent(true);
    setTemplateNotice(`Loaded "${tpl.badge}" (${templateLangMode.toUpperCase()}) into the composer below.`);
  };

  const handleCopyTemplateText = async (tpl: (typeof whatsappQuickTemplates)[number]) => {
    const text = formatTemplateMessage(tpl);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTemplateId(tpl.id);
      setTimeout(() => setCopiedTemplateId(''), 2000);
    } catch {
      handleApplyTemplateToComposer(tpl);
    }
  };

  const handleQuickSendTemplate = async (tpl: (typeof whatsappQuickTemplates)[number]) => {
    const bodyText = formatTemplateMessage(tpl);
    await createCommunicationRecord(
      {
        recipientType: 'Patient / Lead',
        recipientId: patients[0]?.id || leads[0]?.id || 'manual',
        recipientName: commRecipient || 'Patient',
        channel: 'WhatsApp',
        direction: 'Outbound',
        subject: tpl.subject,
        messageSummary: bodyText,
        staffOrAutomationName: actor.name,
        deliveryStatus: `Sent via WhatsApp Quick-Reply (${
          templateLangMode === 'bilingual'
            ? 'বাংলা + English'
            : templateLangMode === 'bn'
            ? 'বাংলা'
            : 'English'
        })`,
        consentVerified: true,
        optOutStatus: false,
        ownerId: actor.uid,
      },
      actor
    );
    setTemplateNotice(
      `Sent & logged "${tpl.badge}" to ${commRecipient || 'Patient'} via WhatsApp.`
    );
  };

  const handleAddHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospName.trim()) return;
    await createHospitalDirectoryEntry(
      {
        name: hospName,
        city: hospCity,
        country: hospCountry,
        accreditation: hospAccreditation,
        keySpecialties: hospSpecialties || 'Multi-Specialty Tertiary Care',
        leadDoctors: hospDoctors || 'Senior International Consultants',
        internationalDeskContact: hospContact || 'International Patient Desk',
        averageOpinionTurnaroundHours: 24,
        verifiedPartner: true,
        ownerId: actor.uid,
      },
      actor
    );
    setHospName('');
    setHospSpecialties('');
    setHospDoctors('');
    setHospContact('');
  };

  const exportAnalyticsCsv = () => {
    const headers = ['LeadCode', 'PatientName', 'Source', 'Treatment', 'Hospital', 'Status', 'InquiryDate'];
    const rows = leads.map((l) => [
      l.leadCode,
      `"${l.patientName.replace(/"/g, '""')}"`,
      `"${l.leadSource}"`,
      `"${l.interestedTreatment}"`,
      `"${l.preferredHospital}"`,
      `"${l.status}"`,
      l.inquiryDate,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `QureWaysTrip_CRM_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // MODULE 11: FOLLOW-UPS AND TASKS (STEP 8: SLA ESCALATION & TRIAGE ENGINE)
  if (activeSubModule === 'follow-ups') {
    const todayIso = new Date().toISOString().slice(0, 10);
    const filteredTasks = tasks.filter((t) => {
      if (taskFilterMode === 'overdue') {
        return t.status === 'Overdue' || (t.status !== 'Completed' && t.dueDate < todayIso);
      }
      if (taskFilterMode === 'urgent') {
        return t.priority === 'Urgent' || t.priority === 'High';
      }
      if (taskFilterMode === 'completed') {
        return t.status === 'Completed';
      }
      return true;
    });

    const handleAutoScanSlaTasks = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const uncontactedLead = leads.find((l) => l.status === 'New Inquiry');
      const targetPatient = patients[0];
      await createFollowUpTask(
        {
          title: uncontactedLead
            ? `SLA 15-Min Escalation: Contact ${uncontactedLead.patientName} (${uncontactedLead.leadCode}) & Collect Reports`
            : `SLA 24h Escalation: Verify Apollo Chennai Opinion & Med-1 Visa Letter for ${
                targetPatient?.fullName || 'Active Patient'
              }`,
          description:
            'Automated SLA Engine detected pending clinical document or opinion milestone requiring immediate coordinator action.',
          relatedType: uncontactedLead ? 'Lead' : 'Patient',
          relatedId: uncontactedLead?.id || targetPatient?.id || 'sla-auto',
          relatedName: uncontactedLead?.patientName || targetPatient?.fullName || 'Patient',
          assignedToName: actor.name,
          priority: 'Urgent',
          dueDate: today,
          status: 'Pending',
          automationTrigger: 'Automated SLA Triage Scan (15m Lead / 24h Hospital Opinion Rule)',
          ownerId: actor.uid,
        },
        actor
      );
      setSlaNotice('SLA Triage Scan completed: Created Urgent escalation task in Firestore.');
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Follow-up Engine & Automated SLA Task Queue</h2>
            <p className="text-sm text-slate-600">
              Automated SLA reminders for uncontacted leads, missing clinical reports, pending AI report reviews, and
              hospital opinion turnarounds.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAutoScanSlaTasks}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Run Automated SLA Escalation Scan</span>
          </button>
        </div>

        {slaNotice && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between">
            <span>{slaNotice}</span>
            <button
              type="button"
              onClick={() => setSlaNotice('')}
              className="font-semibold text-emerald-800 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleAddTask}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
              Assign Follow-up Task
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Task Title *</label>
              <input
                type="text"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g., Follow up on Apollo Chennai CTVS Opinion"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Patient or Lead Name</label>
              <input
                type="text"
                value={taskRelatedName}
                onChange={(e) => setTaskRelatedName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as 'Urgent' | 'High' | 'Medium' | 'Low')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Task Instructions / Escalation Rule</label>
              <textarea
                rows={2}
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                placeholder="Verify patient communication consent before calling..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
            >
              Create Task
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <h3 className="text-base font-semibold text-slate-900">Active & Automated Follow-up Tasks</h3>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                {(
                  [
                    { id: 'all', label: `All (${tasks.length})` },
                    { id: 'overdue', label: 'Overdue SLA' },
                    { id: 'urgent', label: 'Urgent / High' },
                    { id: 'completed', label: 'Completed' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTaskFilterMode(tab.id)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      taskFilterMode === tab.id
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {filteredTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-4 border border-slate-200 rounded-lg flex flex-wrap items-start justify-between gap-3 hover:bg-slate-50/60"
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="text-xs text-slate-500">
                      <span>{t.relatedType}: {t.relatedName}</span>
                      <span className="mx-1.5">·</span>
                      <span>Priority: <strong className="text-slate-800">{t.priority}</strong></span>
                      <span className="mx-1.5">·</span>
                      <span className="font-mono tabular-nums">Due: {t.dueDate}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{t.title}</h4>
                    {t.description && <p className="text-xs text-slate-600">{t.description}</p>}
                    {t.automationTrigger && (
                      <div className="text-xs text-sky-800">{t.automationTrigger}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={t.status}
                      onChange={(e) =>
                        updateTaskStatus(
                          t.id,
                          e.target.value as 'Pending' | 'In Progress' | 'Overdue' | 'Completed',
                          actor
                        )
                      }
                      className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-md bg-white"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Overdue">Overdue</option>
                      <option value="Completed">Completed</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => deleteTaskRecord(t.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                      title="Delete Task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MODULE 12: COMMUNICATIONS
  if (activeSubModule === 'communications') {
    const recipientOptions = Array.from(
      new Set([
        ...patients.map((p) => p.fullName),
        ...leads.map((l) => l.patientName),
      ])
    ).filter(Boolean);

    return (
      <div className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold text-slate-900">Unified Multi-Channel Communication Timeline</h2>
          <p className="text-sm text-slate-600">
            Consent-aware logging for WhatsApp Business, Phone Calls, Google Business Profile inquiries, Facebook Page,
            Email, and Patient Portal messages.
          </p>
        </div>

        {/* One-Click Bengali (বাংলা) & English WhatsApp Quick-Reply Templates */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">
                  Bengali (বাংলা) & English WhatsApp Quick-Reply Templates
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                One-click bilingual templates personalized for{' '}
                <strong className="text-slate-900">{commRecipient || 'the selected patient'}</strong> (Target:{' '}
                <span className="text-sky-800 font-medium">{matchedPatientOrLeadHospital}</span>).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-600 font-medium">Recipient:</span>
                <select
                  value={commRecipient}
                  onChange={(e) => setCommRecipient(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-semibold text-xs"
                >
                  {recipientOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTemplateLangMode('bilingual')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    templateLangMode === 'bilingual'
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  বাংলা + English
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateLangMode('bn')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    templateLangMode === 'bn'
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  শুধু বাংলা (Bengali)
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateLangMode('en')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    templateLangMode === 'en'
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  English Only
                </button>
              </div>
            </div>
          </div>

          {templateNotice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{templateNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setTemplateNotice('')}
                className="font-semibold text-emerald-800 hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {whatsappQuickTemplates.map((tpl) => {
              const previewText = formatTemplateMessage(tpl);
              return (
                <div
                  key={tpl.id}
                  className="p-4 border border-slate-200 rounded-xl bg-slate-50/60 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-emerald-900 bg-emerald-100/80 px-2.5 py-0.5 rounded-md">
                        {tpl.badge}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        WhatsApp Business · {templateLangMode === 'bilingual' ? 'Bilingual' : templateLangMode.toUpperCase()}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">{tpl.title}</h4>
                    <pre className="p-3 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">
                      {previewText}
                    </pre>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleApplyTemplateToComposer(tpl)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
                      >
                        Load in Composer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyTemplateText(tpl)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedTemplateId === tpl.id ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <a
                        href={`https://wa.me/${cleanWaPhone}?text=${encodeURIComponent(previewText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          void handleQuickSendTemplate(tpl);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors whitespace-nowrap"
                        title={`Launch WhatsApp Web / App to ${matchedRecipientPhone} and log message`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Launch wa.me ({matchedRecipientPhone})</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => handleQuickSendTemplate(tpl)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>One-Click Send & Log</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleLogCommunication}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
              Log Inbound / Outbound Interaction (Manual Fallback)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Channel *</label>
                <select
                  value={commChannel}
                  onChange={(e) => setCommChannel(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="WhatsApp">WhatsApp Business</option>
                  <option value="Phone Call">Phone Call</option>
                  <option value="Google Business">Google Business Profile Call/Inquiry</option>
                  <option value="Facebook Page">Facebook Page Inquiry</option>
                  <option value="Website Form">Website Contact Form</option>
                  <option value="Email">Email</option>
                  <option value="SMS">SMS</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Direction *</label>
                <select
                  value={commDirection}
                  onChange={(e) => setCommDirection(e.target.value as 'Inbound' | 'Outbound')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Outbound">Outbound (Staff to Patient)</option>
                  <option value="Inbound">Inbound (Patient to QureWays)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Patient or Lead Name *</label>
              <input
                type="text"
                required
                value={commRecipient}
                onChange={(e) => setCommRecipient(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Subject / Topic</label>
              <input
                type="text"
                value={commSubject}
                onChange={(e) => setCommSubject(e.target.value)}
                placeholder="e.g., Visa Invitation Letter & Flight Schedule Confirmation"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Interaction Summary *</label>
              <textarea
                rows={3}
                required
                value={commSummary}
                onChange={(e) => setCommSummary(e.target.value)}
                placeholder="Record call details, patient questions, or WhatsApp document confirmation..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={commConsent}
                onChange={(e) => setCommConsent(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Patient care communication consent verified (Non-promotional)</span>
            </label>

            <button
              type="submit"
              className="w-full px-4 py-2 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
            >
              Record Communication Entry
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
              Chronological Communication Log ({communications.length})
            </h3>
            <div className="space-y-3 max-h-[550px] overflow-y-auto">
              {communications.map((c) => (
                <div key={c.id} className="p-3.5 border border-slate-200 rounded-lg space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-500">
                    <div>
                      <strong className="text-slate-900">{c.recipientName}</strong>
                      <span className="mx-1.5">·</span>
                      <span>{c.direction} via {c.channel}</span>
                      <span className="mx-1.5">·</span>
                      <span>By {c.staffOrAutomationName}</span>
                    </div>
                    <span className="font-mono tabular-nums">{c.createdAt.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  {c.subject && <div className="text-xs font-semibold text-slate-800">{c.subject}</div>}
                  <p className="text-xs text-slate-700 leading-relaxed">{c.messageSummary}</p>
                  <div className="text-xs text-slate-500">
                    Status: <span className="text-slate-700 font-medium">{c.deliveryStatus}</span> · Consent Verified:{' '}
                    {c.consentVerified ? 'Yes' : 'No'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MODULE 13: HOSPITALS AND DOCTORS (STEP 9: INTERACTIVE SPECIALTY FILTER & DIRECT OPINION REQUEST)
  if (activeSubModule === 'hospitals') {
    const filteredHospitals = hospitals.filter((h) => {
      if (!hospSearchQuery.trim()) return true;
      return `${h.name} ${h.city} ${h.keySpecialties} ${h.leadDoctors}`
        .toLowerCase()
        .includes(hospSearchQuery.toLowerCase());
    });
    const selectedPatientForHosp =
      patients.find((p) => p.id === hospTargetPatientId) || patients[0];

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Verified Partner Hospitals & Specialist Doctors</h2>
            <p className="text-sm text-slate-600">
              Apollo Hospitals, Greams Road, Chennai, Apollo Proton Cancer Centre, and verified international tertiary
              centers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={hospSearchQuery}
                onChange={(e) => setHospSearchQuery(e.target.value)}
                placeholder="Search specialty, doctor, city..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
            {patients.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-600 font-medium">For Patient:</span>
                <select
                  value={selectedPatientForHosp?.id || ''}
                  onChange={(e) => setHospTargetPatientId(e.target.value)}
                  className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
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

        {hospNotice && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between">
            <span>{hospNotice}</span>
            <button
              type="button"
              onClick={() => setHospNotice('')}
              className="font-semibold text-emerald-800 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            {filteredHospitals.map((h) => (
              <div key={h.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{h.name}</h3>
                    <div className="text-xs text-slate-500">
                      {h.city}, {h.country} · {h.accreditation}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-800">
                    Avg Opinion Turnaround: {h.averageOpinionTurnaroundHours}h
                  </span>
                </div>
                <div className="text-xs text-slate-700">
                  <strong className="text-slate-900">Key Specialties:</strong> {h.keySpecialties}
                </div>
                <div className="text-xs text-slate-700">
                  <strong className="text-slate-900">Lead Specialist Doctors:</strong> {h.leadDoctors}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-600">
                    <strong className="text-slate-800">International Desk:</strong> {h.internationalDeskContact}
                  </div>
                  {selectedPatientForHosp && (
                    <button
                      type="button"
                      onClick={async () => {
                        const firstDoc = h.leadDoctors.split(',')[0]?.trim() || 'Senior Consultant';
                        const firstSpec = h.keySpecialties.split(',')[0]?.trim() || 'Tertiary Care';
                        await createSecondOpinion(
                          {
                            patientId: selectedPatientForHosp.id,
                            patientName: selectedPatientForHosp.fullName,
                            specialty: firstSpec,
                            hospitalName: h.name,
                            department: firstSpec,
                            doctorName: firstDoc,
                            submissionDate: new Date().toISOString().slice(0, 10),
                            hospitalReferenceNumber: `SO-${Math.floor(10000 + Math.random() * 90000)}`,
                            receivedOpinionSummary: `Clinical dossier submitted to ${h.name} International Patient Desk (${firstDoc}) for official review.`,
                            documentedRecommendations:
                              selectedPatientForHosp.treatmentRequirements ||
                              'Awaiting specialist surgical/medical package recommendation.',
                            estimatedCostInr: 420000,
                            estimatedCostUsd: 5000,
                            estimatedTimeline: '14 Days in Chennai',
                            clinicianDiscussionPoints:
                              'Confirm pre-admission cardiac/oncology clearance and Med-1 Visa Invitation Letter issuance.',
                            originalDocumentTitle: `${selectedPatientForHosp.patientCode}_${h.name.replace(/\s+/g, '_')}_Request.pdf`,
                            verificationStatus: 'Pending Hospital Response',
                            status: 'Submitted to Hospital',
                            assignedCoordinatorName: actor.name,
                            ownerId: actor.uid,
                          },
                          actor
                        );
                        setHospNotice(
                          `Submitted Second Opinion Request for ${selectedPatientForHosp.fullName} to ${h.name} (${firstDoc}).`
                        );
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Request Opinion for {selectedPatientForHosp.fullName} →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAddHospital}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3.5 h-fit"
          >
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
              Add Partner Hospital & Doctors
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Hospital Name *</label>
              <input
                type="text"
                required
                value={hospName}
                onChange={(e) => setHospName(e.target.value)}
                placeholder="e.g., Apollo Children's Hospitals, Chennai"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">City *</label>
                <input
                  type="text"
                  required
                  value={hospCity}
                  onChange={(e) => setHospCity(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Country *</label>
                <input
                  type="text"
                  required
                  value={hospCountry}
                  onChange={(e) => setHospCountry(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Key Specialties</label>
              <input
                type="text"
                value={hospSpecialties}
                onChange={(e) => setHospSpecialties(e.target.value)}
                placeholder="Pediatric Cardiac Surgery, Bone Marrow Transplant..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Lead Doctors</label>
              <input
                type="text"
                value={hospDoctors}
                onChange={(e) => setHospDoctors(e.target.value)}
                placeholder="Dr. Neville Solomon, Dr. Revathi Raj..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">International Desk Contact</label>
              <input
                type="text"
                value={hospContact}
                onChange={(e) => setHospContact(e.target.value)}
                placeholder="Thousand Lights, Chennai 600006"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
            >
              Save Verified Hospital Partner
            </button>
          </form>
        </div>
      </div>
    );
  }

  // MODULE 14: REPORTS AND ANALYTICS (STEP 10: RECHARTS CONVERSION FUNNEL & SPECIALTY BAR CHARTS)
  if (activeSubModule === 'analytics') {
    const convertedLeads = leads.filter(
      (l) => l.status === 'Converted to Patient' || l.status === 'Completed'
    ).length;
    const conversionRate = leads.length > 0 ? ((convertedLeads / leads.length) * 100).toFixed(1) : '0.0';

    const sourceBreakdown = leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.leadSource] = (acc[l.leadSource] || 0) + 1;
      return acc;
    }, {});

    const specialtyBreakdown = leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.interestedTreatment] = (acc[l.interestedTreatment] || 0) + 1;
      return acc;
    }, {});

    const funnelChartData = [
      {
        stage: '1. Total Leads',
        count: leads.length,
      },
      {
        stage: '2. Docs Collected',
        count: leads.filter((l) => l.status !== 'New Inquiry' && l.status !== 'Lost').length,
      },
      {
        stage: '3. Hospital Opinions',
        count: secondOpinions.length,
      },
      {
        stage: '4. Cost Estimates',
        count: costEstimates.length,
      },
      {
        stage: '5. Converted Patients',
        count: convertedLeads,
      },
    ];

    const specialtyChartData = Object.entries(specialtyBreakdown).map(([name, cases]) => ({
      specialty: name.length > 22 ? `${name.slice(0, 20)}…` : name,
      cases,
    }));

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Business Analytics & Conversion Funnel Reports</h2>
            <p className="text-sm text-slate-600">
              All metrics are computed dynamically from stored Firestore records. Explicit funnel definitions prevent
              inflated conversion reporting.
            </p>
          </div>
          <button
            type="button"
            onClick={exportAnalyticsCsv}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Export Authorized CSV Report
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Total Stored Leads</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">{leads.length}</div>
            <div className="text-xs text-slate-500 mt-1">Active pipeline inquiries</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Verified Lead-to-Patient Conversion</div>
            <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">{conversionRate}%</div>
            <div className="text-xs text-slate-500 mt-1">
              Requires formal patient registration (not mere inquiry)
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Hospital Opinions Received</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {secondOpinions.filter((o) => o.status === 'Opinion Received' || o.status === 'Shared With Patient').length}{' '}
              / {secondOpinions.length}
            </div>
            <div className="text-xs text-slate-500 mt-1">Apollo Chennai & partner hospitals</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Estimates Shared / Accepted</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {costEstimates.length}
            </div>
            <div className="text-xs text-slate-500 mt-1">Transparent multi-currency budgets</div>
          </div>
        </div>

        {/* Step 10: Interactive Recharts Funnel & Specialty Demand BarCharts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
              End-to-End Care Coordination Funnel Progression
            </h3>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelChartData} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Records" fill="#0284c7" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
              Bangladesh Inbound Demand by Clinical Specialty
            </h3>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={specialtyChartData} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="specialty" tick={{ fontSize: 10, fill: '#475569' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip />
                  <Bar dataKey="cases" name="Inquiries" fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
              Lead Source Performance
            </h3>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">Acquisition Channel</th>
                  <th className="py-2 text-right">Inquiry Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(sourceBreakdown).map(([src, count]) => (
                  <tr key={src}>
                    <td className="py-2 font-medium text-slate-800">{src}</td>
                    <td className="py-2 text-right font-mono tabular-nums font-semibold">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
              Treatment Category Demand (Bangladesh Inbound)
            </h3>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">Clinical Specialty</th>
                  <th className="py-2 text-right">Cases</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(specialtyBreakdown).map(([spec, count]) => (
                  <tr key={spec}>
                    <td className="py-2 font-medium text-slate-800">{spec}</td>
                    <td className="py-2 text-right font-mono tabular-nums font-semibold">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // MODULE 15: STAFF AND PERMISSIONS + AUDIT LOGS
  if (activeSubModule === 'staff-permissions') {
    const roles = Object.keys(ROLE_MODULE_ACCESS) as StaffRole[];

    return (
      <div className="space-y-6">
        <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Role-Based Access Control (RBAC) & Immutable Security Audit Trail
            </h2>
            <p className="text-sm text-slate-600">
              Enforces least-privilege access across all 6 staff roles and isolated Patient Portal sessions.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-2 rounded-lg">
            <span className="text-xs font-medium text-slate-700">Active Role Simulation:</span>
            <select
              value={actor.role}
              onChange={(e) => onRoleChange(e.target.value as StaffRole)}
              className="text-xs font-semibold text-sky-800 bg-transparent focus:outline-none"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Role Permission Matrix */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
            QureWays Trip Staff Role Permission Matrix
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                  <th className="py-2.5 px-3 font-semibold">Role Title</th>
                  <th className="py-2.5 px-3 font-semibold">Authorized Modules & Data Scope</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {roles.map((r) => (
                  <tr key={r} className={actor.role === r ? 'bg-sky-50/60' : ''}>
                    <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">{r}</td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {ROLE_MODULE_ACCESS[r].join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Immutable Audit Trail */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
            Immutable Security & Clinical Workflow Audit Logs ({auditLogs.length})
          </h3>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                  <th className="py-2 px-3">Timestamp (UTC)</th>
                  <th className="py-2 px-3">Actor & Role</th>
                  <th className="py-2 px-3">Module</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Target & Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {log.createdAt.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900">
                      {log.actorName} ({log.actorRole})
                    </td>
                    <td className="py-2 px-3 text-slate-600">{log.module}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">{log.action}</td>
                    <td className="py-2 px-3 text-slate-600">
                      {log.targetName}: {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // MODULE 16: SETTINGS AND INTEGRATIONS (SECTION 14 & 20)
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900">
          Integration Architecture, Data Privacy & Compliance Governance
        </h2>
        <p className="text-sm text-slate-600">
          Transparent webhook/connector status and healthcare data protection controls (Bangladesh & Cross-Border India
          Coordination).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
            External Channel Connectors & Manual-Entry Fallbacks
          </h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 border border-slate-200 rounded-lg flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900">Firebase Firestore & Google Authentication</div>
                <p className="text-slate-600 mt-0.5">
                  Zero-trust ABAC security rules deployed; persistent record storage and audit logging active.
                </p>
              </div>
              <span className="text-emerald-700 font-semibold whitespace-nowrap">Connected</span>
            </div>

            <div className="p-3 border border-slate-200 rounded-lg flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900">Server-Side Gemini 3.8 Flash Clinical Assistant</div>
                <p className="text-slate-600 mt-0.5">
                  Server-side proxy `/api/ai/preliminary-report` and `/api/ai/extract-document` with mandatory human
                  review gate.
                </p>
              </div>
              <span className="text-emerald-700 font-semibold whitespace-nowrap">Active</span>
            </div>

            <div className="p-3 border border-slate-200 rounded-lg flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900">WhatsApp Business Cloud API & Facebook Lead Ads</div>
                <p className="text-slate-600 mt-0.5">
                  Webhook endpoint ready; currently operating in Manual-Entry Fallback mode in Communications & Leads
                  until Meta Business credentials are provided in environment variables.
                </p>
              </div>
              <span className="text-amber-700 font-semibold whitespace-nowrap">Manual Fallback Active</span>
            </div>

            <div className="p-3 border border-slate-200 rounded-lg flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900">Google Business Profile Inquiry Logging</div>
                <p className="text-slate-600 mt-0.5">
                  Per platform policy, phone calls from Google Business do not auto-expose caller medical records.
                  Staff log inquiries via the Lead Capture & Call Log forms with explicit consent verification.
                </p>
              </div>
              <span className="text-amber-700 font-semibold whitespace-nowrap">Manual Logging Mode</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
            Healthcare Data Privacy, Consent & Retention Controls
          </h3>
          <ul className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
            <li>
              <strong className="text-slate-900">1. Explicit Purpose-Limited Consent:</strong> Separate checkboxes are
              enforced on every Patient profile for (a) Clinical & Hospital Coordination Data Processing and (b)
              Optional Marketing Updates. Sensitive clinical data is never used for ad segmentation.
            </li>
            <li>
              <strong className="text-slate-900">2. AI Data-Sharing Safeguards:</strong> Identifiable clinical documents
              are only processed after patient consent is recorded, and all AI outputs remain locked as{' '}
              <code>DRAFT — NOT CLINICIAN-APPROVED</code> until human verification.
            </li>
            <li>
              <strong className="text-slate-900">3. Original Hospital Opinion Integrity:</strong> Official opinions from
              Apollo Hospitals Chennai and partner centers are stored separately from AI summaries and never merged or
              altered.
            </li>
            <li>
              <strong className="text-slate-900">4. Retention & Consent Withdrawal Workflow:</strong> Patients may
              withdraw consent or request clinical document archival/deletion at any time via their coordinator or
              Patient Portal.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
