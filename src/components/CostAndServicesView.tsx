import React, { useState } from 'react';
import {
  Calculator,
  Printer,
  Calendar,
  Plane,
  Briefcase,
  AlertCircle,
  Plus,
  FileDown,
  CheckCircle2,
  ShieldCheck,
  Copy,
  Building2,
  FileText,
} from 'lucide-react';
import {
  VERIFIED_HOSPITALS,
  TREATMENT_CATEGORIES,
  SERVICE_STATUSES,
  type PatientRecord,
  type TreatmentCostEstimateRecord,
  type ServiceBookingRecord,
} from '../types/crm';
import {
  createCostEstimate,
  updateCostEstimateStatus,
  createServiceBooking,
  updateServiceBookingStatus,
  logAuditEvent,
} from '../lib/crmService';
import {
  generateVisaTravelPdf,
  generateCostEstimatePdf,
} from '../lib/pdfGenerator';

const IVAC_CHECKLIST_ITEMS = [
  {
    id: 'passport-validity',
    title: '1. Patient (Med-1) & Attendant (Med-2) Passports Valid ≥ 6 Months',
    detail: 'Original passports with at least 6 months validity and 2 blank visa pages.',
  },
  {
    id: 'official-vil',
    title: '2. Official Hospital Visa Invitation Letter (VIL) Issued',
    detail: 'Addressed to High Commission of India in Bangladesh with patient & attendant passport numbers.',
  },
  {
    id: 'local-referral',
    title: '3. Local Bangladesh Specialist Referral & Clinical Dossier',
    detail: 'Local doctor recommendation for specialized treatment in Chennai + diagnostic reports.',
  },
  {
    id: 'financial-proof',
    title: '4. Bank Statement (6 Months) or Passport USD Endorsement',
    detail: 'Solvency proof + dual-currency card international medical quota activation.',
  },
  {
    id: 'utility-nid',
    title: '5. Utility Bill (Electricity/Gas) & National ID (NID) Copies',
    detail: 'Proof of residential address in Bangladesh matching visa application form.',
  },
  {
    id: 'ivac-appointment',
    title: '6. IVAC Online Visa Application & Biometric Submission',
    detail: 'Submitted at IVAC Dhaka (JFP), Chattogram, Sylhet, Rajshahi, or Khulna.',
  },
  {
    id: 'flight-pickup',
    title: '7. Flight Ticket (DAC/CGP → MAA) & Chennai Airport Pickup',
    detail: 'Arrival details shared with Apollo / QureWays Chennai Airport Reception Desk.',
  },
  {
    id: 'accommodation-frro',
    title: '8. Guest House Booking & FRRO Registration Pack Ready',
    detail: 'C-Form accommodation confirmation near Greams Road & FRRO registration within 14 days.',
  },
] as const;

interface Props {
  activeSubModule: 'cost-estimator' | 'services-bookings' | 'appointments' | 'visa-travel';
  patients: PatientRecord[];
  costEstimates: TreatmentCostEstimateRecord[];
  serviceBookings: ServiceBookingRecord[];
  actor: { uid: string; name: string; role: string };
}

const ESTIMATE_TEMPLATES = [
  {
    name: 'Apollo Chennai — Off-Pump CABG (Heart Bypass) 14-Day Package',
    specialty: 'Cardiology & Cardiothoracic Surgery',
    hospital: 'Apollo Hospitals, Greams Road, Chennai, India',
    hospitalConfirmedUsd: 4950,
    travelEstimatedUsd: 640,
    accommodationEstimatedUsd: 560,
    coordinationUsd: 450,
    stayDays: 14,
  },
  {
    name: 'Apollo Proton Centre — Oncology Multidisciplinary Staging & Surgery',
    specialty: 'Medical & Surgical Oncology',
    hospital: 'Apollo Proton Cancer Centre, Chennai, India',
    hospitalConfirmedUsd: 6200,
    travelEstimatedUsd: 680,
    accommodationEstimatedUsd: 840,
    coordinationUsd: 520,
    stayDays: 21,
  },
  {
    name: 'Apollo Greams Road — Bilateral Robotic Total Knee Replacement',
    specialty: 'Orthopedics & Joint Replacement',
    hospital: 'Apollo Hospitals, Greams Road, Chennai, India',
    hospitalConfirmedUsd: 5800,
    travelEstimatedUsd: 640,
    accommodationEstimatedUsd: 480,
    coordinationUsd: 400,
    stayDays: 12,
  },
];

const SERVICE_CATALOG = [
  {
    category: 'Doctor Appointment',
    name: 'In-Person Specialist Outpatient Consultation (Apollo Chennai)',
    feeUsd: 35,
    processingTime: '24 Hours Confirmation',
    requiredDocs: 'Passport Copy, Previous Prescriptions',
  },
  {
    category: 'Online Teleconsultation',
    name: 'Pre-Travel Video Consultation with Apollo Senior Consultant',
    feeUsd: 45,
    processingTime: '24–48 Hours',
    requiredDocs: 'Clinical Reports PDF, Diagnostic Summary',
  },
  {
    category: 'Visa Invitation Letter',
    name: 'Official Indian Medical Visa (Med-1 & Med-2 Attendant) Invitation Letter',
    feeUsd: 0,
    processingTime: '24–48 Hours',
    requiredDocs: 'Patient & Attendant Passports, Local Doctor Referral',
  },
  {
    category: 'AYUSH Documentation',
    name: 'AYUSH / Specialized Treatment Letter Coordination',
    feeUsd: 0,
    processingTime: '48 Hours',
    requiredDocs: 'Passport Copy, Treatment Plan Summary',
  },
  {
    category: 'Airport Pickup & Drop-off',
    name: 'Chennai International Airport (MAA) Wheelchair / Sedan Transfer to Greams Road',
    feeUsd: 35,
    processingTime: '12 Hours Prior to Flight',
    requiredDocs: 'Confirmed Flight Ticket & PNR',
  },
  {
    category: 'Hotel & Accommodation',
    name: 'Serviced Guest House / Hotel Booking near Apollo Greams Road / Taramani',
    feeUsd: 0,
    processingTime: '24 Hours',
    requiredDocs: 'Passport Copy, Arrival Dates',
  },
  {
    category: 'Interpreter Services',
    name: 'Bengali-to-English Clinical Interpreter at Hospital Desk',
    feeUsd: 25,
    processingTime: 'Same Day',
    requiredDocs: 'Appointment Confirmation',
  },
  {
    category: 'Post-Treatment Follow-up',
    name: 'Post-Return Bangladesh Tele-Follow-Up & Medication Review Coordination',
    feeUsd: 30,
    processingTime: '48 Hours',
    requiredDocs: 'Discharge Summary & Follow-up Lab Reports',
  },
];

export const CostAndServicesView: React.FC<Props> = ({
  activeSubModule,
  patients,
  costEstimates,
  serviceBookings,
  actor,
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0]?.id || '');
  const activePatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  // Cost Estimator Form State
  const [estHospital, setEstHospital] = useState<string>(VERIFIED_HOSPITALS[0]);
  const [estSpecialty, setEstSpecialty] = useState<string>(TREATMENT_CATEGORIES[0]);
  const [estTitle, setEstTitle] = useState('Beating-Heart CABG Package + 14-Day Chennai Medical Travel Budget');
  const [patientCount, setPatientCount] = useState(1);
  const [companionCount, setCompanionCount] = useState(1);
  const [stayDays, setStayDays] = useState(14);
  const [accommCategory, setAccommCategory] = useState('Serviced Guest House near Apollo Greams Road ($28/night)');
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'BDT' | 'INR'>('USD');
  const [rateBdt, setRateBdt] = useState(120.0);
  const [rateInr, setRateInr] = useState(84.0);
  const [hospConfirmedUsd, setHospConfirmedUsd] = useState(4950);
  const [travelEstUsd, setTravelEstUsd] = useState(640);
  const [accommEstUsd, setAccommEstUsd] = useState(560);
  const [coordOtherUsd, setCoordOtherUsd] = useState(450);
  const [quotationSource, setQuotationSource] = useState(
    'Official Apollo Chennai International Tariff + Planning Assumptions'
  );
  const [selectedEstimateId, setSelectedEstimateId] = useState<string>('');

  // Service / Appointment / Visa Booking State
  const [srvCatalogIdx, setSrvCatalogIdx] = useState(0);
  const [srvHospital, setSrvHospital] = useState<string>(VERIFIED_HOSPITALS[0]);
  const [srvDoctor, setSrvDoctor] = useState('Dr. M. M. Yusuf');
  const [srvDate, setSrvDate] = useState(new Date().toISOString().slice(0, 10));
  const [srvTime, setSrvTime] = useState('16:30 BST');
  const [srvPassportRef, setSrvPassportRef] = useState('');
  const [srvFlightDetails, setSrvFlightDetails] = useState('');
  const [srvAccommDetails, setSrvAccommDetails] = useState('');
  const [srvNotes, setSrvNotes] = useState('');

  // Medical Visa (Med-1 / Med-2) & IVAC Readiness Hub State
  const [ivacCenter, setIvacCenter] = useState('IVAC Dhaka (Jamuna Future Park)');
  const [vilRefNumber, setVilRefNumber] = useState('APL-MAA-VIL-2026-8841');
  const [vilDepartment, setVilDepartment] = useState('Cardiothoracic & Vascular Surgery (CTVS)');
  const [attendantName, setAttendantName] = useState('Md. Tariqul Rahman');
  const [attendantRelation, setAttendantRelation] = useState('Son / Medical Attendant (Med-2)');
  const [attendantPassport, setAttendantPassport] = useState('B02948172');
  const [checkedVisaItems, setCheckedVisaItems] = useState<string[]>([
    'passport-validity',
    'official-vil',
    'local-referral',
    'financial-proof',
    'utility-nid',
  ]);
  const [visaHubNotice, setVisaHubNotice] = useState<string>('');

  // Step 4: Passport USD Endorsement & Bangladesh Bank Medical Quota State
  const [patientEndorsedUsd, setPatientEndorsedUsd] = useState<number>(5000);
  const [companionEndorsedUsd, setCompanionEndorsedUsd] = useState<number>(3000);

  // Step 6: BST (Dhaka UTC+6) <-> IST (Chennai UTC+5:30) Dual-Timezone Teleconsult State
  const [teleSlotBst, setTeleSlotBst] = useState<string>('16:30 BST (Dhaka) / 16:00 IST (Chennai)');
  const [needsBengaliInterpreter, setNeedsBengaliInterpreter] = useState<boolean>(true);
  const [teleNotice, setTeleNotice] = useState<string>('');

  // Step 7: Chennai Airport (MAA) Pickup & FRRO 14-Day Registration Tracker State
  const [maaPickupMode, setMaaPickupMode] = useState<string>('Wheelchair Assisted Sedan (Terminal 4 International)');
  const [maaRepName, setMaaRepName] = useState<string>('Mr. S. Karthik (Apollo MAA Airport Desk +91-98400-11223)');
  const [frroStatus, setFrroStatus] = useState<string>('Pending Arrival (Required within 14 Days of Landing)');
  const [cFormHotel, setCFormHotel] = useState<string>('Greams Road Serviced Guest House (C-Form Ready)');

  // Next-Level Feature 1: Official Hospital VIL Draft & 2nd Attendant (Med-2) State
  const [attendant2Name, setAttendant2Name] = useState<string>('Mrs. Rahima Begum');
  const [attendant2Relation, setAttendant2Relation] = useState<string>('Spouse / 2nd Attendant (Med-2)');
  const [attendant2Passport, setAttendant2Passport] = useState<string>('A09918273');
  const [showVilLetterPreview, setShowVilLetterPreview] = useState<boolean>(true);
  const [copiedVilDraft, setCopiedVilDraft] = useState<boolean>(false);

  // Next-Level Feature 2: Bangladesh-to-Chennai Flight & Fit-to-Fly (MEDIF) Clearance State
  const [flightRoute, setFlightRoute] = useState<string>('US-Bangla Airlines BS-205 (Dhaka DAC 10:15 -> Chennai MAA 12:45 Direct)');
  const [wheelchairCode, setWheelchairCode] = useState<string>('WCHR — Ramp Wheelchair (Can walk cabin steps)');
  const [needsMedifClearance, setNeedsMedifClearance] = useState<boolean>(false);
  const [patientSpo2Pct, setPatientSpo2Pct] = useState<number>(97);
  const [patientHbLevel, setPatientHbLevel] = useState<number>(11.8);

  // Next-Level Feature 3: Hospital Bank Telegraphic Transfer (TT) & SWIFT Wire State
  const [ttCopyNotice, setTtCopyNotice] = useState<string>('');

  // Next-Level Feature 4: Chennai C-Form Guest House & Bengali Kitchen Proximity Directory State
  const [guestHouseNotice, setGuestHouseNotice] = useState<string>('');

  const toggleVisaChecklistItem = (id: string) => {
    setCheckedVisaItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const applyTemplate = (idx: number) => {
    const t = ESTIMATE_TEMPLATES[idx];
    if (!t) return;
    setEstTitle(t.name);
    setEstSpecialty(t.specialty);
    setEstHospital(t.hospital);
    setHospConfirmedUsd(t.hospitalConfirmedUsd);
    setTravelEstUsd(t.travelEstimatedUsd);
    setAccommEstUsd(t.accommodationEstimatedUsd);
    setCoordOtherUsd(t.coordinationUsd);
    setStayDays(t.stayDays);
  };

  const formatCurr = (usdAmount: number) => {
    if (displayCurrency === 'BDT') {
      return `BDT ৳${Math.round(usdAmount * rateBdt).toLocaleString()}`;
    }
    if (displayCurrency === 'INR') {
      return `INR ₹${Math.round(usdAmount * rateInr).toLocaleString()}`;
    }
    return `USD $${Math.round(usdAmount).toLocaleString()}`;
  };

  const handleSaveEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) return;
    const baseTotal =
      Number(hospConfirmedUsd) + Number(travelEstUsd) + Number(accommEstUsd) + Number(coordOtherUsd);
    const minTotal = Math.round(baseTotal * 0.96);
    const maxTotal = Math.round(baseTotal * 1.12);

    const id = await createCostEstimate(
      {
        patientId: activePatient.id,
        patientName: activePatient.fullName,
        destinationCity: 'Chennai, India',
        hospitalName: estHospital,
        specialty: estSpecialty,
        treatmentTitle: estTitle,
        patientCount: Number(patientCount),
        companionCount: Number(companionCount),
        lengthOfStayDays: Number(stayDays),
        accommodationCategory: accommCategory,
        currency: displayCurrency,
        exchangeRateBdtPerUsd: Number(rateBdt),
        exchangeRateInrPerUsd: Number(rateInr),
        exchangeRateTimestamp: `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
        exchangeRateSource: 'Bangladesh Bank & RBI Indicative Reference Rate',
        hospitalConfirmedTotalUsd: Number(hospConfirmedUsd),
        estimatedTravelTotalUsd: Number(travelEstUsd),
        estimatedAccommodationTotalUsd: Number(accommEstUsd),
        coordinationAndOtherTotalUsd: Number(coordOtherUsd),
        minTotalBudgetUsd: minTotal,
        maxTotalBudgetUsd: maxTotal,
        assumptions: `Includes ${patientCount} patient + ${companionCount} companion(s) for ${stayDays} days in Chennai (${accommCategory}).`,
        exclusions:
          'Excludes extended ICU stay beyond package days, emergency complications, or unrelated specialty procedures.',
        validityPeriodDays: 30,
        quotationSource,
        status: 'Shared With Patient',
        ownerId: actor.uid,
      },
      actor
    );
    setSelectedEstimateId(id);
  };

  const handleCreateServiceBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) return;
    const chosen = SERVICE_CATALOG[srvCatalogIdx] || SERVICE_CATALOG[0];
    await createServiceBooking(
      {
        patientId: activePatient.id,
        patientName: activePatient.fullName,
        serviceCategory: chosen.category,
        serviceName: chosen.name,
        hospitalOrProvider: srvHospital,
        doctorName: srvDoctor,
        scheduledDate: srvDate,
        scheduledTime: srvTime,
        serviceFeeUsd: chosen.feeUsd,
        processingTimeEstimate: chosen.processingTime,
        status: 'Requested',
        assignedCoordinatorName: actor.name,
        visaPassportRef: srvPassportRef,
        flightDetails: srvFlightDetails,
        accommodationDetails: srvAccommDetails,
        notes: srvNotes,
        ownerId: actor.uid,
      },
      actor
    );
    setSrvNotes('');
    setSrvPassportRef('');
    setSrvFlightDetails('');
    setSrvAccommDetails('');
  };

  // MODULE 7: TREATMENT COST ESTIMATOR
  if (activeSubModule === 'cost-estimator') {
    const activeEstimate =
      costEstimates.find((c) => c.id === selectedEstimateId) ||
      costEstimates.find((c) => activePatient && c.patientId === activePatient.id) ||
      costEstimates[0];

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Treatment Cost & Medical Tourism Budget Estimator
            </h2>
            <p className="text-sm text-slate-600">
              Separates Hospital-Confirmed Quotations from third-party travel/accommodation planning assumptions across
              USD, BDT, and INR.
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            {(['USD', 'BDT', 'INR'] as const).map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => setDisplayCurrency(curr)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  displayCurrency === curr
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Display in {curr}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Builder Form */}
          <form
            onSubmit={handleSaveEstimate}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4 no-print"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">Build Patient Budget Estimate</h3>
              <Calculator className="w-4 h-4 text-sky-700" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Apply Reusable Destination Template</label>
              <select
                onChange={(e) => applyTemplate(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50"
              >
                {ESTIMATE_TEMPLATES.map((t, i) => (
                  <option key={t.name} value={i}>
                    Template: {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Patient *</label>
                <select
                  value={activePatient?.id || ''}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Hospital *</label>
                <select
                  value={estHospital}
                  onChange={(e) => setEstHospital(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
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
              <label className="block text-xs font-medium text-slate-700 mb-1">Package / Treatment Title *</label>
              <input
                type="text"
                required
                value={estTitle}
                onChange={(e) => setEstTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Patients</label>
                <input
                  type="number"
                  min={1}
                  value={patientCount}
                  onChange={(e) => setPatientCount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Companions</label>
                <input
                  type="number"
                  min={0}
                  value={companionCount}
                  onChange={(e) => setCompanionCount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Stay (Days)</label>
                <input
                  type="number"
                  min={1}
                  value={stayDays}
                  onChange={(e) => setStayDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  A. Hospital-Confirmed Quote (USD)
                </label>
                <input
                  type="number"
                  value={hospConfirmedUsd}
                  onChange={(e) => setHospConfirmedUsd(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  B. Flights & Transfers Assumption (USD)
                </label>
                <input
                  type="number"
                  value={travelEstUsd}
                  onChange={(e) => setTravelEstUsd(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  C. Hotel & Meals Assumption (USD)
                </label>
                <input
                  type="number"
                  value={accommEstUsd}
                  onChange={(e) => setAccommEstUsd(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  D. Visa, Interpreter & 10% Buffer (USD)
                </label>
                <input
                  type="number"
                  value={coordOtherUsd}
                  onChange={(e) => setCoordOtherUsd(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Exchange Rate (BDT / 1 USD)</label>
                <input
                  type="number"
                  step="0.5"
                  value={rateBdt}
                  onChange={(e) => setRateBdt(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Exchange Rate (INR / 1 USD)</label>
                <input
                  type="number"
                  step="0.5"
                  value={rateInr}
                  onChange={(e) => setRateInr(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
            >
              Generate & Save Itemized Budget Estimate
            </button>
          </form>

          {/* Right Printable Estimate Sheet */}
          <div className="lg:col-span-7">
            {activeEstimate ? (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <div className="text-xs text-slate-500">
                      QureWays Trip · Transparent Medical Tourism Budget Estimate · Validity:{' '}
                      {activeEstimate.validityPeriodDays || 30} Days
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">{activeEstimate.treatmentTitle}</h3>
                    <div className="text-xs text-slate-600 mt-0.5">
                      <span>Patient: {activeEstimate.patientName}</span>
                      <span className="mx-1.5">·</span>
                      <span>Hospital: {activeEstimate.hospitalName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 no-print">
                    <select
                      value={activeEstimate.status}
                      onChange={(e) => updateCostEstimateStatus(activeEstimate.id, e.target.value, actor)}
                      className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Shared With Patient">Shared With Patient</option>
                      <option value="Accepted">Accepted by Patient</option>
                      <option value="Revision Requested">Revision Requested</option>
                    </select>
                    <button
                      type="button"
                      onClick={async () => {
                        const fileName = generateCostEstimatePdf(
                          activeEstimate,
                          Number(rateBdt) || 120,
                          Number(rateInr) || 84
                        );
                        await logAuditEvent({
                          actorUid: actor.uid,
                          actorName: actor.name,
                          actorRole: actor.role,
                          action: 'EXPORT_COST_ESTIMATE_PDF',
                          module: 'Cost Estimator',
                          targetId: activeEstimate.id,
                          targetName: activeEstimate.patientName,
                          details: `Exported multi-currency treatment cost estimate PDF (${fileName}).`,
                        });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      Download PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print
                    </button>
                  </div>
                </div>

                {/* Summary KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-500">A. Hospital-Confirmed</div>
                    <div className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                      {formatCurr(activeEstimate.hospitalConfirmedTotalUsd || 0)}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-500">B. Travel (Assumed)</div>
                    <div className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                      {formatCurr(activeEstimate.estimatedTravelTotalUsd || 0)}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-500">C. Stay ({activeEstimate.lengthOfStayDays}d)</div>
                    <div className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                      {formatCurr(activeEstimate.estimatedAccommodationTotalUsd || 0)}
                    </div>
                  </div>
                  <div className="p-3 bg-sky-50 rounded-lg border border-sky-200">
                    <div className="text-xs text-sky-900 font-medium">Estimated Total Range</div>
                    <div className="text-sm font-bold text-sky-950 font-mono tabular-nums mt-0.5">
                      {formatCurr(activeEstimate.minTotalBudgetUsd)} – {formatCurr(activeEstimate.maxTotalBudgetUsd)}
                    </div>
                  </div>
                </div>

                {/* Category Breakdown Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-2.5 px-3 font-semibold">Cost Category & Description</th>
                        <th className="py-2.5 px-3 font-semibold">Classification & Source</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Amount ({displayCurrency})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          A. Hospital & Medical Package (Consultation, Investigations, Procedure, Admission)
                        </td>
                        <td className="py-2.5 px-3 text-emerald-700 font-medium">
                          Hospital-Confirmed Quotation · {activeEstimate.quotationSource}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                          {formatCurr(activeEstimate.hospitalConfirmedTotalUsd || 0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          B. Travel Costs (Return Flights DAC↔MAA + Chennai Airport Pickup/Drop-off)
                        </td>
                        <td className="py-2.5 px-3 text-amber-800">
                          Planning Assumption · Live Airline Quote Required at Ticketing
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                          {formatCurr(activeEstimate.estimatedTravelTotalUsd || 0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          C. Accommodation & Living ({activeEstimate.lengthOfStayDays} Days for{' '}
                          {activeEstimate.patientCount} Patient + {activeEstimate.companionCount} Companion)
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          Planning Assumption · {activeEstimate.accommodationCategory || 'Standard Guest House'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                          {formatCurr(activeEstimate.estimatedAccommodationTotalUsd || 0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          D. Coordination, Visa Fees, Bengali Interpreter & 10% Contingency Buffer
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          Estimated Cost & Recommended Clinical Contingency
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                          {formatCurr(activeEstimate.coordinationAndOtherTotalUsd || 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-900 block mb-1">Planning Assumptions & Exchange Rate:</span>
                    <p className="text-slate-600">{activeEstimate.assumptions}</p>
                    <p className="text-slate-500 mt-1 font-mono tabular-nums">
                      1 USD = {rateBdt} BDT = {rateInr} INR ({activeEstimate.exchangeRateSource} ·{' '}
                      {activeEstimate.exchangeRateTimestamp})
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-900 block mb-1">
                      Exclusions & Mandatory Financial Disclaimer:
                    </span>
                    <p className="text-slate-600">{activeEstimate.exclusions}</p>
                    <p className="text-slate-700 font-medium mt-1">
                      Disclaimer: Final treatment costs depend on the treating hospital&apos;s physical clinical
                      assessment and official inpatient tariff upon admission.
                    </p>
                  </div>
                </div>

                {/* Step 4: Bangladesh Bank Passport USD Endorsement & Medical Quota Remittance Planner */}
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3 no-print">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Passport USD Endorsement & Bangladesh Bank Medical Remittance Planner
                      </h4>
                      <p className="text-[11px] text-slate-600">
                        Calculate how much of the estimated Chennai treatment budget is covered by Patient + Companion
                        passport USD endorsement vs. direct hospital bank remittance (TT).
                      </p>
                    </div>
                    <span className="text-[11px] font-mono font-semibold text-emerald-900 bg-white px-2.5 py-1 rounded border border-emerald-200">
                      Max Budget: USD ${activeEstimate.maxTotalBudgetUsd.toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Patient Passport Endorsement (USD)
                      </label>
                      <input
                        type="number"
                        value={patientEndorsedUsd}
                        onChange={(e) => setPatientEndorsedUsd(Number(e.target.value))}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-mono"
                      />
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Companion Passport Endorsement (USD)
                      </label>
                      <input
                        type="number"
                        value={companionEndorsedUsd}
                        onChange={(e) => setCompanionEndorsedUsd(Number(e.target.value))}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-mono"
                      />
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="block text-[11px] text-slate-500">Total Endorsed Carry/Card Limit</span>
                      <span className="text-sm font-bold text-emerald-800 font-mono tabular-nums">
                        USD ${(patientEndorsedUsd + companionEndorsedUsd).toLocaleString()}
                      </span>
                      <span className="block text-[10px] text-slate-500 font-mono">
                        BDT ৳{Math.round((patientEndorsedUsd + companionEndorsedUsd) * rateBdt).toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="block text-[11px] text-slate-500">Hospital Bank TT / Excess Needed</span>
                      {activeEstimate.maxTotalBudgetUsd > patientEndorsedUsd + companionEndorsedUsd ? (
                        <>
                          <span className="text-sm font-bold text-amber-800 font-mono tabular-nums">
                            USD $
                            {(
                              activeEstimate.maxTotalBudgetUsd -
                              (patientEndorsedUsd + companionEndorsedUsd)
                            ).toLocaleString()}
                          </span>
                          <span className="block text-[10px] text-amber-700">
                            Requires Hospital Estimate Letter for Bank Medical TT
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-bold text-emerald-700 font-mono tabular-nums">
                            USD $0 (Fully Covered)
                          </span>
                          <span className="block text-[10px] text-emerald-700">
                            Covered within Dual-Currency Card & Cash Endorsement
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Next-Level Feature 3: Official Hospital SWIFT Wire / Telegraphic Transfer (TT) Instruction Generator */}
                  <div className="p-3.5 bg-white border border-emerald-200 rounded-lg space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Bangladesh Bank Medical Quota TT & Hospital SWIFT Wire Instruction Sheet
                        </span>
                        <span className="text-[11px] text-slate-600">
                          For Authorized Dealer (AD) Bank medical remittance under Bangladesh Bank Foreign Exchange Guidelines (Purpose Code: S1303 — Medical Treatment Abroad).
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const excessUsd = Math.max(
                              0,
                              activeEstimate.maxTotalBudgetUsd - (patientEndorsedUsd + companionEndorsedUsd)
                            );
                            const wireText = `OFFICIAL MEDICAL REMITTANCE (TT / SWIFT) INSTRUCTION SHEET\nPatient Name: ${activeEstimate.patientName}\nHospital: ${activeEstimate.hospitalName}\nBeneficiary Account Name: Apollo Hospitals Enterprise Limited — International Patient Remittance\nBeneficiary Bank: HDFC Bank Ltd., ITC Centre, Anna Salai, Chennai 600002, India\nSWIFT / BIC Code: HDFCINBBCHE\nIFSC Code: HDFC0000004\nRemittance Purpose Code: S1303 (Medical Treatment of Foreign National / Bangladesh Bank Medical Quota)\nTotal Estimated Treatment Budget: USD $${activeEstimate.maxTotalBudgetUsd.toLocaleString()}\nEndorsed on Passports (Patient + Companion): USD $${(patientEndorsedUsd + companionEndorsedUsd).toLocaleString()}\nRecommended AD Bank TT Wire Amount: USD $${(excessUsd > 0 ? excessUsd : activeEstimate.hospitalConfirmedTotalUsd || 0).toLocaleString()} (Approx. BDT ৳${Math.round((excessUsd > 0 ? excessUsd : activeEstimate.hospitalConfirmedTotalUsd || 0) * rateBdt).toLocaleString()})`;
                            try {
                              await navigator.clipboard.writeText(wireText);
                            } catch {
                              // Fallback if clipboard blocked
                            }
                            await logAuditEvent({
                              actorUid: actor.uid,
                              actorName: actor.name,
                              actorRole: actor.role,
                              action: 'GENERATE_HOSPITAL_SWIFT_TT_SHEET',
                              module: 'Cost Estimator',
                              targetId: activeEstimate.id,
                              targetName: activeEstimate.patientName,
                              details: `Generated & copied Hospital SWIFT/TT Wire Instruction Sheet for ${activeEstimate.patientName} (${activeEstimate.hospitalName}).`,
                            });
                            setTtCopyNotice(
                              'Copied Official Hospital SWIFT / AD Bank Medical TT Instruction Sheet to clipboard & logged audit event.'
                            );
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy SWIFT / Bank TT Sheet</span>
                        </button>
                      </div>
                    </div>

                    {ttCopyNotice && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 flex items-center justify-between">
                        <span>{ttCopyNotice}</span>
                        <button
                          type="button"
                          onClick={() => setTtCopyNotice('')}
                          className="font-semibold hover:underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] bg-slate-50 p-2.5 rounded border border-slate-200 font-mono">
                      <div>
                        <span className="text-slate-500 block font-sans">Beneficiary & SWIFT Code:</span>
                        <strong className="text-slate-900">Apollo Hospitals Enterprise Ltd.</strong>
                        <span className="block text-sky-800">SWIFT: HDFCINBBCHE · IFSC: HDFC0000004</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block font-sans">Bangladesh Bank AD Purpose:</span>
                        <strong className="text-slate-900">Code S1303 — Medical Treatment</strong>
                        <span className="block text-slate-600">Requires Visa + VIL + Estimate PDF</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block font-sans">Suggested TT Wire Transfer:</span>
                        <strong className="text-emerald-800">
                          USD $
                          {Math.max(
                            activeEstimate.hospitalConfirmedTotalUsd || 0,
                            activeEstimate.maxTotalBudgetUsd - (patientEndorsedUsd + companionEndorsedUsd)
                          ).toLocaleString()}
                        </strong>
                        <span className="block text-slate-600">
                          Direct to Hospital International Desk
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // MODULES 8, 9, 10: SERVICES, APPOINTMENTS & TELECONSULTATIONS, VISA & TRAVEL COORDINATION
  const filteredBookings = serviceBookings.filter((b) => {
    if (activeSubModule === 'appointments') {
      return (
        b.serviceCategory.includes('Appointment') ||
        b.serviceCategory.includes('Teleconsultation')
      );
    }
    if (activeSubModule === 'visa-travel') {
      return (
        b.serviceCategory.includes('Visa') ||
        b.serviceCategory.includes('AYUSH') ||
        b.serviceCategory.includes('Airport') ||
        b.serviceCategory.includes('Hotel') ||
        b.serviceCategory.includes('Transportation')
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {activeSubModule === 'appointments'
              ? 'Appointments & Specialist Teleconsultations'
              : activeSubModule === 'visa-travel'
              ? 'Visa Invitation Letters (Med-1/Med-2), Flights & Chennai Travel Coordination'
              : 'Medical Tourism Service Catalog & Booking Lifecycle'}
          </h2>
          <p className="text-sm text-slate-600">
            End-to-end coordination with Apollo International Desk, High Commission Visa Application Centre (IVAC), and
            Chennai ground reception.
          </p>
        </div>
      </div>

      {/* Important Non-Guarantee Compliance Notice (Section 12) */}
      <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-xl flex items-center gap-3 text-xs text-slate-700">
        <AlertCircle className="w-4 h-4 text-slate-700 shrink-0" />
        <span>
          <strong className="text-slate-900">Service Coordination Policy:</strong> QureWays Trip coordinates appointment
          requests, teleconsultations, and official hospital visa invitation letters. Visa issuance is at the sole
          discretion of the High Commission of India, and hospital admission/appointment slots are subject to treating
          clinician confirmation.
        </span>
      </div>

      {/* Interactive Indian Medical Visa (Med-1/Med-2) & IVAC Bangladesh Readiness Hub */}
      {activeSubModule === 'visa-travel' && activePatient && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-700" />
                <h3 className="text-base font-bold text-slate-900">
                  Indian Medical Visa (Med-1 / Med-2) & IVAC Bangladesh Readiness Checklist
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Track mandatory IVAC documents, attendant passport details, official Hospital Visa Invitation Letter
                (VIL), and generate a downloadable Visa & Travel Pack PDF for{' '}
                <strong className="text-slate-900">
                  {activePatient.fullName} ({activePatient.patientCode})
                </strong>
                .
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-sky-900 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-lg">
                Readiness: {checkedVisaItems.length} / {IVAC_CHECKLIST_ITEMS.length} (
                {Math.round((checkedVisaItems.length / IVAC_CHECKLIST_ITEMS.length) * 100)}%)
              </span>

              <button
                type="button"
                onClick={async () => {
                  const completedLabels = IVAC_CHECKLIST_ITEMS.filter((i) =>
                    checkedVisaItems.includes(i.id)
                  ).map((i) => i.title);
                  const pendingLabels = IVAC_CHECKLIST_ITEMS.filter(
                    (i) => !checkedVisaItems.includes(i.id)
                  ).map((i) => i.title);

                  const fileName = generateVisaTravelPdf({
                    patient: activePatient,
                    targetHospital: srvHospital,
                    consultingDoctor: srvDoctor,
                    department: vilDepartment,
                    ivacCenter,
                    patientPassportNumber: activePatient.passportNumber || srvPassportRef || 'Pending',
                    attendantName,
                    attendantRelation,
                    attendantPassportNumber: attendantPassport,
                    vilReferenceNumber: vilRefNumber,
                    expectedTravelDate: srvDate,
                    flightPnr: srvFlightDetails || 'US-Bangla Airlines BS-205 (DAC -> MAA)',
                    accommodationDetails:
                      srvAccommDetails || 'Serviced Guest House near Apollo Greams Road, Chennai',
                    completedChecklistLabels: completedLabels,
                    pendingChecklistLabels: pendingLabels,
                    coordinatorName: actor.name,
                  });

                  await logAuditEvent({
                    actorUid: actor.uid,
                    actorName: actor.name,
                    actorRole: actor.role,
                    action: 'GENERATE_VISA_TRAVEL_PACK_PDF',
                    module: 'Visa & Travel Coordination',
                    targetId: activePatient.id,
                    targetName: activePatient.fullName,
                    details: `Generated Medical Visa (Med-1/Med-2) & IVAC Travel Pack PDF (${fileName}) with ${completedLabels.length}/${IVAC_CHECKLIST_ITEMS.length} verified items.`,
                  });

                  setVisaHubNotice(
                    `Downloaded "${fileName}" and recorded export in the immutable audit log.`
                  );
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Download Visa & IVAC Travel Pack PDF</span>
              </button>
            </div>
          </div>

          {/* Visual Readiness Progress Bar */}
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{
                width: `${Math.round(
                  (checkedVisaItems.length / IVAC_CHECKLIST_ITEMS.length) * 100
                )}%`,
              }}
            />
          </div>

          {visaHubNotice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{visaHubNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setVisaHubNotice('')}
                className="font-semibold text-emerald-800 hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* VIL & Attendant Metadata Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                IVAC Submission Center
              </label>
              <select
                value={ivacCenter}
                onChange={(e) => setIvacCenter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="IVAC Dhaka (Jamuna Future Park)">IVAC Dhaka (JFP)</option>
                <option value="IVAC Chattogram">IVAC Chattogram</option>
                <option value="IVAC Sylhet">IVAC Sylhet</option>
                <option value="IVAC Rajshahi">IVAC Rajshahi</option>
                <option value="IVAC Khulna">IVAC Khulna</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Hospital VIL Ref Number
              </label>
              <input
                type="text"
                value={vilRefNumber}
                onChange={(e) => setVilRefNumber(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Attendant Name (Med-2)
              </label>
              <input
                type="text"
                value={attendantName}
                onChange={(e) => setAttendantName(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Attendant Passport #
              </label>
              <input
                type="text"
                value={attendantPassport}
                onChange={(e) => setAttendantPassport(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Treating Department
              </label>
              <input
                type="text"
                value={vilDepartment}
                onChange={(e) => setVilDepartment(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          {/* 8-Point Interactive Checklist Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {IVAC_CHECKLIST_ITEMS.map((item) => {
              const isChecked = checkedVisaItems.includes(item.id);
              return (
                <label
                  key={item.id}
                  onClick={() => toggleVisaChecklistItem(item.id)}
                  className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                    isChecked
                      ? 'bg-emerald-50/60 border-emerald-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="mt-0.5 rounded border-slate-300 text-emerald-700"
                  />
                  <div className="text-xs">
                    <div
                      className={`font-bold ${
                        isChecked ? 'text-emerald-950' : 'text-slate-900'
                      }`}
                    >
                      {item.title}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">{item.detail}</p>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Patient Passport: <strong className="font-mono text-slate-800">{activePatient.passportNumber || 'Pending'}</strong> ·
              Attendant Passport: <strong className="font-mono text-slate-800">{attendantPassport || 'Pending'}</strong>
            </span>

            <button
              type="button"
              onClick={async () => {
                await createServiceBooking(
                  {
                    patientId: activePatient.id,
                    patientName: activePatient.fullName,
                    serviceCategory: 'Visa Invitation Letter',
                    serviceName: `Med-1/Med-2 Visa & IVAC Readiness (${checkedVisaItems.length}/${IVAC_CHECKLIST_ITEMS.length} Verified) — ${ivacCenter}`,
                    hospitalOrProvider: srvHospital,
                    doctorName: srvDoctor,
                    scheduledDate: srvDate,
                    scheduledTime: srvTime,
                    serviceFeeUsd: 0,
                    processingTimeEstimate: '24–48 Hours',
                    status:
                      checkedVisaItems.length === IVAC_CHECKLIST_ITEMS.length
                        ? 'Confirmed'
                        : 'In Progress',
                    assignedCoordinatorName: actor.name,
                    visaPassportRef: `Patient: ${activePatient.passportNumber || 'Pending'} | Attendant 1 (${attendantName}): ${attendantPassport} | Attendant 2 (${attendant2Name}): ${attendant2Passport} | VIL: ${vilRefNumber}`,
                    flightDetails: srvFlightDetails || flightRoute,
                    accommodationDetails: srvAccommDetails || 'Near Apollo Greams Road, Chennai',
                    notes: `IVAC Center: ${ivacCenter}. Verified ${checkedVisaItems.length}/${IVAC_CHECKLIST_ITEMS.length} checklist items.`,
                    ownerId: actor.uid,
                  },
                  actor
                );
                setVisaHubNotice(
                  `Saved Med-1/Med-2 Visa & IVAC Readiness record for ${activePatient.fullName} to the Active Bookings Queue.`
                );
              }}
              className="px-4 py-2 text-xs font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors whitespace-nowrap"
            >
              Save Visa & IVAC Readiness to Booking Queue
            </button>
          </div>

          {/* Next-Level Feature 1: Official Hospital Visa Invitation Letter (VIL) Draft & Request Generator */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-700" />
                  <h4 className="text-sm font-bold text-slate-900">
                    Official Hospital Visa Invitation Letter (VIL) Draft & High Commission Request Builder
                  </h4>
                </div>
                <p className="text-xs text-slate-600">
                  Auto-generates the formal VIL requisition addressed to the High Commission of India ({ivacCenter}) for Principal Patient (Med-1) and up to 2 Medical Attendants (Med-2).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowVilLetterPreview((p) => !p)}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  {showVilLetterPreview ? 'Hide VIL Draft' : 'Show VIL Draft'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const draftText = `TO,\nTHE VISA OFFICER,\nHIGH COMMISSION OF INDIA (${ivacCenter.toUpperCase()}),\nBANGLADESH.\n\nSUBJECT: OFFICIAL MEDICAL VISA INVITATION LETTER (MED-1 & MED-2 ATTENDANTS)\nHOSPITAL VIL REF: ${vilRefNumber}\nDATE: ${new Date().toISOString().slice(0, 10)}\n\nDear Sir/Madam,\nThis is to certify that ${activePatient.fullName} (${activePatient.age}y / ${activePatient.gender}, Nationality: Bangladeshi, Passport No: ${activePatient.passportNumber || 'A04928174'}) has been reviewed for specialized medical evaluation and inpatient care under ${srvDoctor}, Department of ${vilDepartment} at ${srvHospital}.\n\n1. PRINCIPAL PATIENT (MED-1 VISA):\n   • Full Name: ${activePatient.fullName}\n   • Passport Number: ${activePatient.passportNumber || 'A04928174'}\n   • Clinical Summary / Diagnosis: ${activePatient.existingDiagnoses || activePatient.reportedSymptoms || 'Specialized Multidisciplinary Evaluation'}\n\n2. MEDICAL ATTENDANT #1 (MED-2 VISA):\n   • Full Name: ${attendantName}\n   • Relationship: ${attendantRelation}\n   • Passport Number: ${attendantPassport}\n\n3. MEDICAL ATTENDANT #2 (MED-2 VISA):\n   • Full Name: ${attendant2Name}\n   • Relationship: ${attendant2Relation}\n   • Passport Number: ${attendant2Passport}\n\nTentative Appointment / Admission Date: ${srvDate} | Expected Stay in Chennai: ${stayDays} Days.\nWe kindly request the High Commission of India to grant Priority Medical Visa (Med-1) to the patient and Medical Attendant Visas (Med-2) to the accompanying family members.\n\nSincerely,\nInternational Patient Services Desk — ${srvHospital}\nCoordinated via QureWays Trip (${actor.name})`;
                    try {
                      await navigator.clipboard.writeText(draftText);
                      setCopiedVilDraft(true);
                      setTimeout(() => setCopiedVilDraft(false), 2500);
                    } catch {
                      // ignore
                    }
                    await logAuditEvent({
                      actorUid: actor.uid,
                      actorName: actor.name,
                      actorRole: actor.role,
                      action: 'COPY_OFFICIAL_VIL_DRAFT',
                      module: 'Visa & Travel Coordination',
                      targetId: activePatient.id,
                      targetName: activePatient.fullName,
                      details: `Generated & copied Official Hospital VIL Request Letter (${vilRefNumber}) for ${activePatient.fullName} + 2 Med-2 Attendants.`,
                    });
                    setVisaHubNotice(
                      `Copied Official VIL Letter (${vilRefNumber}) addressed to High Commission of India (${ivacCenter}).`
                    );
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedVilDraft ? 'Copied VIL Letter!' : 'Copy Official VIL Draft'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  2nd Medical Attendant Name (Med-2)
                </label>
                <input
                  type="text"
                  value={attendant2Name}
                  onChange={(e) => setAttendant2Name(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  2nd Attendant Relationship
                </label>
                <input
                  type="text"
                  value={attendant2Relation}
                  onChange={(e) => setAttendant2Relation(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  2nd Attendant Passport #
                </label>
                <input
                  type="text"
                  value={attendant2Passport}
                  onChange={(e) => setAttendant2Passport(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white font-mono"
                />
              </div>
            </div>

            {showVilLetterPreview && (
              <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
{`TO: THE VISA OFFICER, HIGH COMMISSION OF INDIA — ${ivacCenter.toUpperCase()}
HOSPITAL VIL REF: ${vilRefNumber} | TARGET HOSPITAL: ${srvHospital}
--------------------------------------------------------------------------------
1. PRINCIPAL PATIENT (MED-1): ${activePatient.fullName} (${activePatient.age}y/${activePatient.gender}) · Passport: ${activePatient.passportNumber || 'A04928174'}
   Clinical Diagnosis: ${activePatient.existingDiagnoses || activePatient.reportedSymptoms || 'Specialized Evaluation'}
   Treating Specialist: ${srvDoctor} (${vilDepartment}) · Appointment Date: ${srvDate}
2. ATTENDANT #1 (MED-2): ${attendantName} (${attendantRelation}) · Passport: ${attendantPassport}
3. ATTENDANT #2 (MED-2): ${attendant2Name} (${attendant2Relation}) · Passport: ${attendant2Passport}`}
              </pre>
            )}
          </div>

          {/* Next-Level Feature 2: Bangladesh-to-Chennai Flight & Fit-to-Fly (MEDIF) Medical Clearance Planner */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-emerald-700" />
                  <h4 className="text-sm font-bold text-slate-900">
                    Bangladesh-to-Chennai (DAC/CGP → MAA) Flight & Airline MEDIF Fit-to-Fly Clearance Planner
                  </h4>
                </div>
                <p className="text-xs text-slate-600">
                  Assess airline medical clearance (MEDIF), cabin wheelchair code (WCHR/WCHS/WCHC), Hemoglobin (≥8.5 g/dL), and SpO2 readiness prior to ticketing.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const medifStatus =
                    needsMedifClearance || patientSpo2Pct < 94 || patientHbLevel < 9.0
                      ? 'Airline MEDIF Doctor Form Required (48h Prior to Flight)'
                      : 'Standard Fit-to-Fly (No Oxygen / Stretcher Required)';
                  await createServiceBooking(
                    {
                      patientId: activePatient.id,
                      patientName: activePatient.fullName,
                      serviceCategory: 'Airport Pickup & Drop-off',
                      serviceName: `Flight & Fit-to-Fly Clearance: ${flightRoute}`,
                      hospitalOrProvider: srvHospital,
                      doctorName: srvDoctor,
                      scheduledDate: srvDate,
                      scheduledTime: srvTime,
                      serviceFeeUsd: 0,
                      processingTimeEstimate: '24 Hours Airline Desk',
                      status: 'Confirmed',
                      assignedCoordinatorName: actor.name,
                      flightDetails: `${flightRoute} | Wheelchair: ${wheelchairCode}`,
                      notes: `SpO2: ${patientSpo2Pct}% | Hb: ${patientHbLevel} g/dL | Status: ${medifStatus}`,
                      ownerId: actor.uid,
                    },
                    actor
                  );
                  setVisaHubNotice(
                    `Logged Flight (${flightRoute}) & Fit-to-Fly MEDIF Clearance (${wheelchairCode}) for ${activePatient.fullName}.`
                  );
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
              >
                Log Flight & Fit-to-Fly Clearance
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Preferred Route (Bangladesh → Chennai MAA)
                </label>
                <select
                  value={flightRoute}
                  onChange={(e) => {
                    setFlightRoute(e.target.value);
                    setSrvFlightDetails(e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="US-Bangla Airlines BS-205 (Dhaka DAC 10:15 -> Chennai MAA 12:45 Direct)">
                    US-Bangla BS-205 (DAC → MAA Direct)
                  </option>
                  <option value="Biman Bangladesh BG-363 (Dhaka DAC 12:30 -> Chennai MAA 15:00 Direct)">
                    Biman Bangladesh BG-363 (DAC → MAA Direct)
                  </option>
                  <option value="IndiGo 6E-1116 (Dhaka DAC -> Chennai MAA Direct)">
                    IndiGo 6E-1116 (DAC → MAA Direct)
                  </option>
                  <option value="US-Bangla BS-205 Feeder (Chattogram CGP -> DAC -> Chennai MAA)">
                    US-Bangla (Chattogram CGP → DAC → MAA)
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  IATA Airline Wheelchair Assistance Code
                </label>
                <select
                  value={wheelchairCode}
                  onChange={(e) => setWheelchairCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="WCHR — Ramp Wheelchair (Can walk cabin steps)">
                    WCHR — Ramp Distance Wheelchair
                  </option>
                  <option value="WCHS — Steps Wheelchair (Cannot ascend aircraft stairs)">
                    WCHS — Steps & Ramp Wheelchair
                  </option>
                  <option value="WCHC — Cabin Seat Wheelchair (Immobilized / Aisles)">
                    WCHC — Full Cabin Seat Assistance
                  </option>
                  <option value="STCR — Airline In-Flight Stretcher + Medical Escort">
                    STCR — In-Flight Stretcher + Escort
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Pre-Flight Room Air SpO2 (%) & Hb (g/dL)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={patientSpo2Pct}
                    onChange={(e) => setPatientSpo2Pct(Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg font-mono"
                    title="Room Air SpO2 %"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={patientHbLevel}
                    onChange={(e) => setPatientHbLevel(Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg font-mono"
                    title="Hemoglobin g/dL"
                  />
                </div>
              </div>
              <div className="flex flex-col justify-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needsMedifClearance}
                    onChange={(e) => setNeedsMedifClearance(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Requires Airline MEDIF / Oxygen</span>
                </label>
                <span className="text-[11px] mt-1 font-mono text-slate-600">
                  {patientSpo2Pct < 94 || patientHbLevel < 8.5 || needsMedifClearance
                    ? '⚠️ MEDIF Form Mandatory (Submit 48h prior)'
                    : '✓ Cleared for Standard Commercial Cabin'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 6: BST (Dhaka UTC+6) <-> IST (Chennai UTC+5:30) Dual-Timezone Teleconsultation Scheduler */}
      {activeSubModule === 'appointments' && activePatient && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-700" />
                <h3 className="text-base font-bold text-slate-900">
                  Cross-Border BST (Dhaka UTC+6:00) ↔ IST (Chennai UTC+5:30) Teleconsultation Slot Planner
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Eliminate 30-minute Bangladesh-to-India timezone confusion when scheduling pre-travel video
                consultations or OPD appointments for{' '}
                <strong className="text-slate-900">{activePatient.fullName}</strong>.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-800 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-lg">
              <input
                type="checkbox"
                checked={needsBengaliInterpreter}
                onChange={(e) => setNeedsBengaliInterpreter(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Include Bengali-to-English Clinical Interpreter on Call</span>
            </label>
          </div>

          {teleNotice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between">
              <span>{teleNotice}</span>
              <button
                type="button"
                onClick={() => setTeleNotice('')}
                className="font-semibold text-emerald-800 hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: 'Morning OPD Slot',
                bst: '11:00 AM BST (Dhaka)',
                ist: '10:30 AM IST (Chennai)',
                combined: '11:00 BST (Dhaka) / 10:30 IST (Chennai)',
              },
              {
                label: 'Midday Specialist Slot',
                bst: '02:00 PM BST (Dhaka)',
                ist: '01:30 PM IST (Chennai)',
                combined: '14:00 BST (Dhaka) / 13:30 IST (Chennai)',
              },
              {
                label: 'Afternoon Teleconsult Slot',
                bst: '04:30 PM BST (Dhaka)',
                ist: '04:00 PM IST (Chennai)',
                combined: '16:30 BST (Dhaka) / 16:00 IST (Chennai)',
              },
              {
                label: 'Evening Senior Consultant Slot',
                bst: '07:00 PM BST (Dhaka)',
                ist: '06:30 PM IST (Chennai)',
                combined: '19:00 BST (Dhaka) / 18:30 IST (Chennai)',
              },
            ].map((slot) => {
              const selected = teleSlotBst === slot.combined;
              return (
                <div
                  key={slot.label}
                  onClick={() => {
                    setTeleSlotBst(slot.combined);
                    setSrvTime(slot.combined);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selected
                      ? 'bg-sky-50 border-sky-600 ring-1 ring-sky-600'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900">{slot.label}</div>
                  <div className="text-xs font-mono font-semibold text-sky-800 mt-1">
                    🇧🇩 {slot.bst}
                  </div>
                  <div className="text-xs font-mono text-slate-600">
                    🇮🇳 {slot.ist}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-600">
              Selected Slot: <strong className="font-mono text-slate-900">{teleSlotBst}</strong> · Doctor:{' '}
              <strong className="text-slate-900">{srvDoctor}</strong> ({srvHospital})
            </div>
            <button
              type="button"
              onClick={async () => {
                await createServiceBooking(
                  {
                    patientId: activePatient.id,
                    patientName: activePatient.fullName,
                    serviceCategory: 'Online Teleconsultation',
                    serviceName: `Synchronized BST/IST Video Teleconsultation (${teleSlotBst})`,
                    hospitalOrProvider: srvHospital,
                    doctorName: srvDoctor,
                    scheduledDate: srvDate,
                    scheduledTime: teleSlotBst,
                    serviceFeeUsd: needsBengaliInterpreter ? 60 : 45,
                    processingTimeEstimate: '24 Hours Confirmation',
                    status: 'Confirmed',
                    assignedCoordinatorName: actor.name,
                    notes: `${
                      needsBengaliInterpreter
                        ? 'Bengali Clinical Interpreter assigned to bridge call. '
                        : ''
                    }Dual-Timezone verified: ${teleSlotBst}.`,
                    ownerId: actor.uid,
                  },
                  actor
                );
                setTeleNotice(
                  `Scheduled synchronized BST/IST Teleconsultation for ${activePatient.fullName} at ${teleSlotBst}.`
                );
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
            >
              One-Click Confirm BST/IST Teleconsult Slot
            </button>
          </div>
        </div>
      )}

      {/* Step 7: Chennai Airport (MAA Terminal 4) Ground Reception & Mandatory 14-Day FRRO Registration Tracker */}
      {(activeSubModule === 'visa-travel' || activeSubModule === 'services-bookings') && activePatient && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">
                  Chennai Airport (MAA Terminal 4) Ground Reception & 14-Day FRRO Compliance Tracker
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Coordinate airport wheelchair/ambulance triage, Apollo International Desk placard pickup, C-Form guest
                house check-in, and mandatory e-FRRO registration for{' '}
                <strong className="text-slate-900">{activePatient.fullName}</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={async () => {
                await createServiceBooking(
                  {
                    patientId: activePatient.id,
                    patientName: activePatient.fullName,
                    serviceCategory: 'Airport Pickup & Drop-off',
                    serviceName: `MAA Airport Reception (${maaPickupMode}) & FRRO Compliance`,
                    hospitalOrProvider: srvHospital,
                    doctorName: srvDoctor,
                    scheduledDate: srvDate,
                    scheduledTime: srvTime,
                    serviceFeeUsd: 35,
                    processingTimeEstimate: 'Confirmed for Arrival',
                    status: 'Confirmed',
                    assignedCoordinatorName: actor.name,
                    flightDetails: srvFlightDetails || 'DAC/CGP -> MAA International Terminal 4',
                    accommodationDetails: cFormHotel,
                    notes: `Airport Rep: ${maaRepName} | FRRO Status: ${frroStatus} | Bengali Interpreter: Assigned.`,
                    ownerId: actor.uid,
                  },
                  actor
                );
                setVisaHubNotice(
                  `Logged Chennai Airport (MAA) Pickup & FRRO Registration plan for ${activePatient.fullName}.`
                );
              }}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
            >
              Confirm MAA Airport Pickup & FRRO Record
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                MAA Airport Transfer Vehicle & Triage
              </label>
              <select
                value={maaPickupMode}
                onChange={(e) => setMaaPickupMode(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="Wheelchair Assisted Sedan (Terminal 4 International)">
                  Wheelchair Assisted Sedan (Terminal 4)
                </option>
                <option value="Cardiac ACLS Ambulance Direct to Apollo Greams Road ER">
                  Cardiac ACLS Ambulance Direct to ER
                </option>
                <option value="MPV Family Van (Patient + 2 Companions + Luggage)">
                  MPV Family Van (Patient + Companions)
                </option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Assigned MAA Airport Representative
              </label>
              <input
                type="text"
                value={maaRepName}
                onChange={(e) => setMaaRepName(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                C-Form Verified Accommodation (Chennai)
              </label>
              <input
                type="text"
                value={cFormHotel}
                onChange={(e) => setCFormHotel(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                e-FRRO Registration Status (14-Day Rule)
              </label>
              <select
                value={frroStatus}
                onChange={(e) => setFrroStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="Pending Arrival (Required within 14 Days of Landing)">
                  Pending Arrival (14-Day Window)
                </option>
                <option value="C-Form & Hospital Bonafide Certificate Uploaded to e-FRRO">
                  C-Form & Bonafide Uploaded
                </option>
                <option value="e-FRRO Registration Certificate Approved">
                  e-FRRO Approved & Verified
                </option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Next-Level Feature 4: Chennai C-Form Guest House & Bengali Kitchen / Pharmacy Proximity Directory */}
      {activeSubModule === 'services-bookings' && activePatient && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-700" />
                <h3 className="text-base font-bold text-slate-900">
                  Verified Chennai C-Form Guest Houses & Bengali Kitchen Proximity Directory
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Pre-vetted patient accommodations near Apollo Greams Road & Apollo Proton Cancer Centre (Taramani) with instant Foreigners Regional Registration Office (C-Form) issuance, wheelchair elevators, and Bengali/Halal self-cooking kitchens.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-600">
              1 USD = ৳{rateBdt} BDT = ₹{rateInr} INR
            </span>
          </div>

          {guestHouseNotice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between">
              <span>{guestHouseNotice}</span>
              <button
                type="button"
                onClick={() => setGuestHouseNotice('')}
                className="font-semibold text-emerald-800 hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                name: 'Greams Road Heritage Patient Suites',
                distance: '180m walk to Apollo Main Gate (Greams Lane)',
                campus: 'Apollo Hospitals, Greams Road, Chennai',
                rateUsd: 26,
                rateInr: 2200,
                features: 'Instant C-Form · Attached Bengali Kitchen · Wheelchair Lift · 24/7 Pharmacy 50m',
              },
              {
                name: 'Thousand Lights Medical Serviced Apartments',
                distance: '350m to Apollo Greams Road & Heart Institute',
                campus: 'Apollo Hospitals, Greams Road, Chennai',
                rateUsd: 38,
                rateInr: 3200,
                features: '2-Bedroom Family Suite · C-Form Desk · Halal/Bengali Dining · Backup Generator',
              },
              {
                name: 'Taramani OMR Oncology Care Residency',
                distance: '400m to Apollo Proton Cancer Centre (Taramani)',
                campus: 'Apollo Proton Cancer Centre, Chennai',
                rateUsd: 34,
                rateInr: 2850,
                features: 'HEPA-Filtered Neutropenic Rooms · C-Form Ready · Hospital Shuttle · Private Kitchen',
              },
            ].map((gh) => (
              <div
                key={gh.name}
                className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{gh.name}</h4>
                    <span className="text-xs font-mono font-bold text-sky-900 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 shrink-0">
                      ${gh.rateUsd}/night
                    </span>
                  </div>
                  <div className="text-xs font-medium text-emerald-800">{gh.distance}</div>
                  <p className="text-[11px] text-slate-600">{gh.features}</p>
                  <div className="text-[11px] font-mono text-slate-500">
                    Approx. ₹{gh.rateInr.toLocaleString()} INR · ৳{Math.round(gh.rateUsd * rateBdt).toLocaleString()} BDT / night
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    setCFormHotel(`${gh.name} (${gh.distance})`);
                    setSrvAccommDetails(`${gh.name} — $${gh.rateUsd}/night`);
                    await createServiceBooking(
                      {
                        patientId: activePatient.id,
                        patientName: activePatient.fullName,
                        serviceCategory: 'Hotel & Accommodation',
                        serviceName: `${gh.name} (${stayDays} Nights C-Form Verified Stay)`,
                        hospitalOrProvider: gh.campus,
                        doctorName: srvDoctor,
                        scheduledDate: srvDate,
                        scheduledTime: '12:00 PM Check-In',
                        serviceFeeUsd: gh.rateUsd * stayDays,
                        processingTimeEstimate: 'Instant C-Form Reservation',
                        status: 'Confirmed',
                        assignedCoordinatorName: actor.name,
                        accommodationDetails: `${gh.name} (${gh.distance}) — $${gh.rateUsd}/night x ${stayDays} nights`,
                        notes: gh.features,
                        ownerId: actor.uid,
                      },
                      actor
                    );
                    setGuestHouseNotice(
                      `Reserved "${gh.name}" ($${gh.rateUsd}/night, C-Form ready) for ${activePatient.fullName}.`
                    );
                  }}
                  className="w-full px-3 py-1.5 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors"
                >
                  One-Click Reserve C-Form Stay
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: New Booking Request Form */}
        <form
          onSubmit={handleCreateServiceBooking}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Book Service / Appointment / Visa Letter
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Select Patient *</label>
            <select
              value={activePatient?.id || ''}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.patientCode}) — Passport: {p.passportNumber || 'Pending'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Service from Catalog *</label>
            <select
              value={srvCatalogIdx}
              onChange={(e) => setSrvCatalogIdx(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {SERVICE_CATALOG.map((item, idx) => (
                <option key={item.name} value={idx}>
                  [{item.category}] {item.name} (${item.feeUsd})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Required Documents: {SERVICE_CATALOG[srvCatalogIdx]?.requiredDocs} · Est. Turnaround:{' '}
              {SERVICE_CATALOG[srvCatalogIdx]?.processingTime}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Hospital or Provider *</label>
              <select
                value={srvHospital}
                onChange={(e) => setSrvHospital(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {VERIFIED_HOSPITALS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Consulting Doctor / Desk</label>
              <input
                type="text"
                value={srvDoctor}
                onChange={(e) => setSrvDoctor(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Target Date *</label>
              <input
                type="date"
                required
                value={srvDate}
                onChange={(e) => setSrvDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Preferred Time Slot</label>
              <input
                type="text"
                value={srvTime}
                onChange={(e) => setSrvTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Patient & Attendant Passport Ref (For Visa Letter)
              </label>
              <input
                type="text"
                value={srvPassportRef}
                onChange={(e) => setSrvPassportRef(e.target.value)}
                placeholder="e.g., Patient: A04928174 | Attendant: B0192831"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Flight PNR & Accommodation Details
              </label>
              <input
                type="text"
                value={srvFlightDetails}
                onChange={(e) => setSrvFlightDetails(e.target.value)}
                placeholder="e.g., US-Bangla BS-205 DAC->MAA"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Coordination Notes</label>
            <textarea
              rows={2}
              value={srvNotes}
              onChange={(e) => setSrvNotes(e.target.value)}
              placeholder="Bengali interpreter needed, wheelchair pickup at Chennai Airport Terminal 4..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Create Service Booking
          </button>
        </form>

        {/* Right: Active Bookings & Lifecycle Tracker */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-semibold text-slate-900">Active Bookings & Coordination Queue</h3>
            <span className="text-xs text-slate-500 font-mono tabular-nums">{filteredBookings.length} bookings</span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {filteredBookings.map((bk) => (
              <div key={bk.id} className="p-4 border border-slate-200 rounded-lg space-y-2 hover:bg-slate-50/60">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-sky-800 font-semibold">{bk.serviceCategory}</div>
                    <h4 className="text-sm font-bold text-slate-900">{bk.serviceName}</h4>
                    <div className="text-xs text-slate-600 mt-0.5">
                      <span>Patient: {bk.patientName}</span>
                      <span className="mx-1.5">·</span>
                      <span>{bk.hospitalOrProvider}</span>
                      {bk.doctorName && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span>{bk.doctorName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <select
                    value={bk.status}
                    onChange={(e) => updateServiceBookingStatus(bk.id, { status: e.target.value }, actor)}
                    className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-800"
                  >
                    {SERVICE_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded border border-slate-200/70">
                  <div>
                    <span className="text-slate-500 block">Scheduled Date/Time:</span>
                    <span className="font-mono tabular-nums font-medium text-slate-900">
                      {bk.scheduledDate} {bk.scheduledTime || ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Service Fee:</span>
                    <span className="font-mono tabular-nums font-medium text-slate-900">
                      ${bk.serviceFeeUsd ?? 0} USD
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Coordinator:</span>
                    <span className="font-medium text-slate-900">{bk.assignedCoordinatorName}</span>
                  </div>
                </div>

                {(bk.visaPassportRef || bk.flightDetails || bk.accommodationDetails || bk.notes) && (
                  <div className="text-xs text-slate-600 space-y-1 pt-1">
                    {bk.visaPassportRef && (
                      <div>
                        <strong className="text-slate-800">Visa / Passports:</strong> {bk.visaPassportRef}
                      </div>
                    )}
                    {bk.flightDetails && (
                      <div>
                        <strong className="text-slate-800">Flight / Transfer:</strong> {bk.flightDetails}
                      </div>
                    )}
                    {bk.accommodationDetails && (
                      <div>
                        <strong className="text-slate-800">Accommodation:</strong> {bk.accommodationDetails}
                      </div>
                    )}
                    {bk.notes && (
                      <div>
                        <strong className="text-slate-800">Notes:</strong> {bk.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
