import { jsPDF } from 'jspdf';
import {
  MANDATORY_MEDICAL_DISCLAIMER,
  PATIENT_JOURNEY_STAGES,
  type PatientRecord,
  type MedicalDocumentRecord,
  type AiMedicalReportRecord,
  type HospitalSecondOpinionRecord,
  type TreatmentCostEstimateRecord,
  type ServiceBookingRecord,
} from '../types/crm';

export interface PatientPdfReportParams {
  patient: PatientRecord;
  currentStageIndex: number;
  journeyProgressPercent: number;
  documents: MedicalDocumentRecord[];
  aiReports: AiMedicalReportRecord[];
  secondOpinions: HospitalSecondOpinionRecord[];
  costEstimates: TreatmentCostEstimateRecord[];
  serviceBookings: ServiceBookingRecord[];
  generatedBy: {
    name: string;
    role: string;
  };
}

export function generatePatientPartnerPdf(params: PatientPdfReportParams): string {
  const {
    patient,
    currentStageIndex,
    journeyProgressPercent,
    documents,
    aiReports,
    secondOpinions,
    costEstimates,
    serviceBookings,
    generatedBy,
  } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 20) {
      doc.addPage();
      y = 16;
    }
  };

  const addSectionHeader = (title: string) => {
    ensureSpace(14);
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(margin, y, contentWidth, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(title.toUpperCase(), margin + 2.5, y + 5.2);
    y += 11;
  };

  const addWrappedParagraph = (label: string, value: string) => {
    const safeVal = (value || 'Not documented').trim();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    ensureSpace(10);
    doc.text(label, margin, y);
    y += 4.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(safeVal, contentWidth);
    ensureSpace(lines.length * 4.2 + 3);
    doc.text(lines, margin, y);
    y += lines.length * 4.2 + 2.5;
  };

  // Top Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('QUREWAYS TRIP — HOSPITAL PARTNER PATIENT DOSSIER', margin, 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(186, 230, 253); // sky-200
  doc.text(
    'International Patient Coordination Summary · Bangladesh to Apollo Hospitals, Chennai & Partner Centers',
    margin,
    17.5
  );

  const generatedTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Patient ID: ${patient.patientCode}  |  Generated: ${generatedTimestamp}  |  Coordinator: ${generatedBy.name} (${generatedBy.role})`,
    margin,
    23.5
  );

  y = 35;

  // Section 1: Patient Identification & Demographics
  addSectionHeader('1. Patient Identification, Demographics & Consent');

  const leftColX = margin;
  const rightColX = margin + contentWidth / 2 + 2;

  const drawKeyValueRow = (
    leftLabel: string,
    leftVal: string,
    rightLabel: string,
    rightVal: string
  ) => {
    ensureSpace(7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`${leftLabel}:`, leftColX, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(leftVal || 'N/A').slice(0, 42), leftColX + 32, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(`${rightLabel}:`, rightColX, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(rightVal || 'N/A').slice(0, 42), rightColX + 34, y);
    y += 5.5;
  };

  drawKeyValueRow(
    'Full Name',
    patient.fullName,
    'Patient Code',
    patient.patientCode
  );
  drawKeyValueRow(
    'Age / Gender',
    `${patient.age} yrs / ${patient.gender}`,
    'Passport Number',
    patient.passportNumber || 'Pending Upload'
  );
  drawKeyValueRow(
    'Origin City',
    `${patient.city}, ${patient.country}`,
    'Phone / WhatsApp',
    patient.phone
  );
  drawKeyValueRow(
    'Language',
    patient.preferredLanguage,
    'Data Consent',
    patient.dataProcessingConsent ? 'Verified & Granted' : 'Pending'
  );
  drawKeyValueRow(
    'Target Hospital',
    patient.preferredHospital,
    'Destination',
    patient.preferredDestination || 'Chennai, India'
  );
  y += 2;

  // Section 2: Current Journey Stage & Milestone Progress
  addSectionHeader('2. Patient Care Journey Status & Milestone Progress');

  const activeStageObj = PATIENT_JOURNEY_STAGES[currentStageIndex];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(3, 105, 161); // sky-700
  doc.text(
    `Active Stage: ${activeStageObj?.label || patient.journeyStage} (Stage ${currentStageIndex + 1} of ${PATIENT_JOURNEY_STAGES.length} — ${journeyProgressPercent}% Complete)`,
    margin,
    y
  );
  y += 5;

  // Draw visual progress bar in PDF
  doc.setFillColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 3.5, 1.5, 1.5, 'F');
  doc.setFillColor(2, 132, 199);
  doc.roundedRect(
    margin,
    y,
    Math.max(6, (contentWidth * journeyProgressPercent) / 100),
    3.5,
    1.5,
    1.5,
    'F'
  );
  y += 7.5;

  PATIENT_JOURNEY_STAGES.forEach((st, idx) => {
    ensureSpace(6);
    const statusTag =
      idx < currentStageIndex
        ? '[COMPLETED]'
        : idx === currentStageIndex
        ? '[CURRENT STAGE]'
        : '[UPCOMING]';

    doc.setFont('helvetica', idx <= currentStageIndex ? 'bold' : 'normal');
    doc.setFontSize(8);
    if (idx < currentStageIndex) {
      doc.setTextColor(4, 120, 87); // emerald-700
    } else if (idx === currentStageIndex) {
      doc.setTextColor(3, 105, 161); // sky-700
    } else {
      doc.setTextColor(100, 116, 139); // slate-500
    }
    doc.text(
      `0${idx + 1}. ${st.label} ${statusTag} — ${st.description}`,
      margin + 2,
      y
    );
    y += 4.8;
  });
  y += 2;

  // Section 3: Medical History, Diagnoses & Treatment Requirements
  addSectionHeader('3. Clinical History, Diagnoses & Treatment Requirements');

  addWrappedParagraph(
    'Documented Medical History Summary:',
    patient.medicalHistorySummary || 'No medical history summary recorded.'
  );
  addWrappedParagraph(
    'Existing Diagnoses & Comorbidities:',
    patient.existingDiagnoses || 'No existing diagnoses recorded.'
  );
  addWrappedParagraph(
    'Reported Symptoms & Clinical Presentation:',
    patient.reportedSymptoms || 'Not specified.'
  );
  addWrappedParagraph(
    'Requested Treatment / Hospital Evaluation:',
    patient.treatmentRequirements || 'Specialist evaluation and treatment plan requested.'
  );

  // Section 4: Uploaded Clinical Documents & AI Preliminary Summary
  addSectionHeader('4. Clinical Documents, AI Summary & Hospital Second Opinions');

  if (documents.length === 0) {
    addWrappedParagraph('Uploaded Medical Documents:', 'No clinical documents attached yet.');
  } else {
    const docLines = documents.map(
      (d, idx) =>
        `${idx + 1}. [${d.category}] ${d.title} (${d.fileName}, v${d.version}) — Status: ${d.reviewStatus}`
    );
    addWrappedParagraph(
      `Uploaded Medical Documents (${documents.length}):`,
      docLines.join('\n')
    );
  }

  if (aiReports.length > 0) {
    const latestAi = aiReports[0];
    addWrappedParagraph(
      `Latest AI Preliminary Summary (${latestAi.reviewStatus}):`,
      `${latestAi.documentedHistorySummary}\nCurrent Status: ${latestAi.currentDocumentedStatus}\nRecommended Specialty: ${latestAi.recommendedSpecialty}`
    );
  }

  if (secondOpinions.length > 0) {
    const opLines = secondOpinions.map(
      (o, idx) =>
        `${idx + 1}. ${o.hospitalName} — ${o.doctorName} (${o.specialty}) | Ref: ${o.hospitalReferenceNumber} | Status: ${o.status}${
          o.documentedRecommendations ? `\n   Recommendation: ${o.documentedRecommendations}` : ''
        }`
    );
    addWrappedParagraph(
      `Hospital Second Opinion Records (${secondOpinions.length}):`,
      opLines.join('\n')
    );
  }

  if (costEstimates.length > 0) {
    const est = costEstimates[0];
    const bdtRate = est.exchangeRateBdtPerUsd || 120;
    const inrRate = est.exchangeRateInrPerUsd || 84;
    const minBdt = Math.round(est.minTotalBudgetUsd * bdtRate);
    const maxBdt = Math.round(est.maxTotalBudgetUsd * bdtRate);
    const minInr = Math.round(est.minTotalBudgetUsd * inrRate);
    const maxInr = Math.round(est.maxTotalBudgetUsd * inrRate);
    addWrappedParagraph(
      'Latest Treatment & Travel Cost Estimate Range:',
      `${est.treatmentTitle} at ${est.hospitalName}: $${est.minTotalBudgetUsd.toLocaleString()} – $${est.maxTotalBudgetUsd.toLocaleString()} USD (Approx. BDT ${minBdt.toLocaleString()} – ${maxBdt.toLocaleString()} | INR ${minInr.toLocaleString()} – ${maxInr.toLocaleString()})`
    );
  }

  if (serviceBookings.length > 0) {
    const srvLines = serviceBookings.map(
      (b, idx) =>
        `${idx + 1}. ${b.serviceCategory}: ${b.serviceName} (${b.hospitalOrProvider}) — Date: ${b.scheduledDate} — Status: ${b.status}`
    );
    addWrappedParagraph(
      `Coordinated Appointments, Visa & Travel Bookings (${serviceBookings.length}):`,
      srvLines.join('\n')
    );
  }

  // Mandatory Clinical & Coordination Disclaimer Box
  ensureSpace(26);
  y += 2;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentWidth, 22, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('MANDATORY CLINICAL COORDINATION DISCLAIMER:', margin + 2.5, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const disclaimerLines = doc.splitTextToSize(
    MANDATORY_MEDICAL_DISCLAIMER,
    contentWidth - 5
  );
  doc.text(disclaimerLines, margin + 2.5, y + 8.5);

  const safeCode = (patient.patientCode || 'Patient').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `QureWays_Partner_Dossier_${safeCode}.pdf`;
  doc.save(fileName);
  return fileName;
}

export interface VisaTravelPackInput {
  patient: PatientRecord;
  targetHospital: string;
  consultingDoctor: string;
  department: string;
  ivacCenter: string;
  patientPassportNumber: string;
  attendantName: string;
  attendantRelation: string;
  attendantPassportNumber: string;
  vilReferenceNumber: string;
  expectedTravelDate: string;
  flightPnr: string;
  accommodationDetails: string;
  completedChecklistLabels: string[];
  pendingChecklistLabels: string[];
  coordinatorName: string;
}

export function generateVisaTravelPdf(input: VisaTravelPackInput): string {
  const {
    patient,
    targetHospital,
    consultingDoctor,
    department,
    ivacCenter,
    patientPassportNumber,
    attendantName,
    attendantRelation,
    attendantPassportNumber,
    vilReferenceNumber,
    expectedTravelDate,
    flightPnr,
    accommodationDetails,
    completedChecklistLabels,
    pendingChecklistLabels,
    coordinatorName,
  } = input;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  // Top Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('QUREWAYS TRIP — MEDICAL VISA (MED-1/MED-2) & IVAC TRAVEL PACK', margin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    'Bangladesh-to-India Medical Visa Coordination · IVAC Checklist & Chennai Arrival Dossier',
    margin,
    17
  );
  doc.text(
    `Patient Code: ${patient.patientCode} | VIL Ref: ${vilReferenceNumber || 'Pending'} | Coordinator: ${coordinatorName}`,
    margin,
    22.5
  );

  y = 35;

  const addSection = (title: string) => {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(title.toUpperCase(), margin + 2.5, y + 4.8);
    y += 10.5;
  };

  const addRow = (l1: string, v1: string, l2: string, v2: string) => {
    const colW = contentWidth / 2 - 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(l1, margin, y);
    doc.text(l2, margin + colW + 4, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(v1 || '—', margin, y);
    doc.text(v2 || '—', margin + colW + 4, y);
    y += 6.5;
  };

  addSection('1. Patient (Med-1) & Medical Attendant (Med-2) Details');
  addRow(
    'Principal Patient Name (Med-1)',
    `${patient.fullName} (${patient.age}y / ${patient.gender})`,
    'Patient Passport Number',
    patientPassportNumber || patient.passportNumber || 'Pending'
  );
  addRow(
    'Origin City & Contact (Bangladesh)',
    `${patient.city}, ${patient.country} (${patient.phone})`,
    'Selected IVAC Submission Center',
    ivacCenter
  );
  addRow(
    'Medical Attendant Name (Med-2)',
    `${attendantName || 'Not Assigned'} (${attendantRelation || 'Companion'})`,
    'Attendant Passport Number',
    attendantPassportNumber || 'Pending'
  );

  addSection('2. Treating Hospital & Official Visa Invitation Letter (VIL)');
  addRow(
    'Destination Hospital in India',
    targetHospital,
    'Official Hospital VIL Reference',
    vilReferenceNumber || 'Requested from International Desk'
  );
  addRow(
    'Treating Specialist & Department',
    `${consultingDoctor} (${department})`,
    'Proposed Travel / Appointment Date',
    expectedTravelDate
  );

  addSection('3. Chennai Arrival, Airport Transfer & FRRO Logistics');
  addRow(
    'Flight / PNR Schedule (DAC/CGP -> MAA)',
    flightPnr || 'Awaiting Visa Stamp',
    'Accommodation near Hospital',
    accommodationDetails || 'Guest House near Apollo Greams Road'
  );

  addSection(
    `4. IVAC Document & Pre-Departure Readiness (${completedChecklistLabels.length}/${
      completedChecklistLabels.length + pendingChecklistLabels.length
    } Verified)`
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(5, 150, 105);
  doc.text('Verified & Ready Items:', margin, y);
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  if (completedChecklistLabels.length === 0) {
    doc.text('• None marked complete yet.', margin + 2, y);
    y += 5;
  } else {
    completedChecklistLabels.forEach((item) => {
      const lines = doc.splitTextToSize(`[VERIFIED] ${item}`, contentWidth - 4);
      doc.text(lines, margin + 2, y);
      y += lines.length * 4 + 1;
    });
  }

  if (pendingChecklistLabels.length > 0) {
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(180, 83, 9);
    doc.text('Pending Action Items Prior to IVAC Submission / Flight:', margin, y);
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    pendingChecklistLabels.forEach((item) => {
      const lines = doc.splitTextToSize(`[PENDING] ${item}`, contentWidth - 4);
      doc.text(lines, margin + 2, y);
      y += lines.length * 4 + 1;
    });
  }

  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentWidth, 20, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('VISA & TRAVEL COORDINATION POLICY NOTICE:', margin + 2.5, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const policyLines = doc.splitTextToSize(
    'QureWays Trip coordinates official hospital Visa Invitation Letters (Med-1/Med-2) and Chennai arrival support. Visa approval and issuance timelines are at the sole discretion of the High Commission of India / IVAC Bangladesh. All international patients must complete FRRO registration within 14 days of arrival in India if required by visa endorsement.',
    contentWidth - 5
  );
  doc.text(policyLines, margin + 2.5, y + 9.5);

  const safeCode = (patient.patientCode || 'Patient').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `QureWays_Visa_Travel_Pack_${safeCode}.pdf`;
  doc.save(fileName);
  return fileName;
}

export function generateCostEstimatePdf(
  estimate: TreatmentCostEstimateRecord,
  rateBdt: number,
  rateInr: number
): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('QUREWAYS TRIP — MULTI-CURRENCY TREATMENT & TRAVEL ESTIMATE', margin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Patient: ${estimate.patientName} | Target Hospital: ${estimate.hospitalName}`,
    margin,
    17
  );
  doc.text(
    `Exchange Rate Basis: 1 USD = ${rateBdt} BDT = ${rateInr} INR (${estimate.exchangeRateTimestamp})`,
    margin,
    22.5
  );

  y = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(estimate.treatmentTitle, margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Specialty: ${estimate.specialty} | Expected Length of Stay: ${estimate.lengthOfStayDays} Days | Companions: ${estimate.companionCount}`,
    margin,
    y
  );
  y += 8;

  const rows = [
    [
      '1. Hospital-Confirmed Clinical Package',
      'Official Hospital Quotation',
      estimate.hospitalConfirmedTotalUsd,
    ],
    [
      '2. Round-Trip Flights & Local Transport',
      'Planning Estimate',
      estimate.estimatedTravelTotalUsd,
    ],
    [
      `3. Guest House / Hotel (${estimate.lengthOfStayDays} Nights)`,
      'Planning Estimate',
      estimate.estimatedAccommodationTotalUsd,
    ],
    [
      '4. Diagnostics, Visa & Coordination Buffer',
      'Planning Estimate',
      estimate.coordinationAndOtherTotalUsd,
    ],
  ] as const;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Cost Component', margin + 2, y + 5.2);
  doc.text('Source Basis', margin + 78, y + 5.2);
  doc.text('USD ($)', margin + 122, y + 5.2);
  doc.text('BDT (Tk)', margin + 145, y + 5.2);
  doc.text('INR (Rs)', margin + 168, y + 5.2);
  y += 12;

  doc.setFont('helvetica', 'normal');
  rows.forEach(([label, basis, usd]) => {
    const numUsd = Number(usd) || 0;
    doc.setTextColor(15, 23, 42);
    doc.text(label, margin + 2, y);
    doc.setTextColor(71, 85, 105);
    doc.text(basis, margin + 78, y);
    doc.setTextColor(15, 23, 42);
    doc.text(`$${numUsd.toLocaleString()}`, margin + 122, y);
    doc.text(`${Math.round(numUsd * rateBdt).toLocaleString()}`, margin + 145, y);
    doc.text(`${Math.round(numUsd * rateInr).toLocaleString()}`, margin + 168, y);
    y += 7;
  });

  y += 3;
  doc.setFillColor(240, 249, 255);
  doc.rect(margin, y, contentWidth, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(3, 105, 161);
  doc.text(
    `Estimated Total Budget Range: USD $${estimate.minTotalBudgetUsd.toLocaleString()} – $${estimate.maxTotalBudgetUsd.toLocaleString()}`,
    margin + 3,
    y + 5
  );
  doc.setFontSize(8);
  doc.text(
    `Approx. BDT ${Math.round(estimate.minTotalBudgetUsd * rateBdt).toLocaleString()} – ${Math.round(
      estimate.maxTotalBudgetUsd * rateBdt
    ).toLocaleString()} | INR ${Math.round(estimate.minTotalBudgetUsd * rateInr).toLocaleString()} – ${Math.round(
      estimate.maxTotalBudgetUsd * rateInr
    ).toLocaleString()}`,
    margin + 3,
    y + 9.8
  );

  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Planning Assumptions & Exclusions:', margin, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const assumpLines = doc.splitTextToSize(
    `Assumptions: ${estimate.assumptions}\nExclusions: ${estimate.exclusions}\nMandatory Disclaimer: Final hospital charges depend on physical clinical evaluation and inpatient admission tariff at the treating hospital.`,
    contentWidth
  );
  doc.text(assumpLines, margin, y);

  const safeName = (estimate.patientName || 'Patient').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `QureWays_Cost_Estimate_${safeName}.pdf`;
  doc.save(fileName);
  return fileName;
}

