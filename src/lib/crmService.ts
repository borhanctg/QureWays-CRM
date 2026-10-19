import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  MANDATORY_MEDICAL_DISCLAIMER,
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
} from '../types/crm';

function cleanStr(val: string | undefined, maxLen: number, fallback = ''): string {
  const s = (val ?? fallback).trim();
  return s.slice(0, maxLen);
}

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function logAuditEvent(params: {
  actorUid: string;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  targetId: string;
  targetName: string;
  details: string;
}): Promise<void> {
  const logId = makeId('audit');
  const path = `auditLogs/${logId}`;
  try {
    await setDoc(doc(db, 'auditLogs', logId), {
      actorUid: cleanStr(params.actorUid, 128),
      actorName: cleanStr(params.actorName, 120, 'Staff Member'),
      actorRole: cleanStr(params.actorRole, 80, 'CRM Administrator'),
      action: cleanStr(params.action, 160),
      module: cleanStr(params.module, 80),
      targetId: cleanStr(params.targetId, 128),
      targetName: cleanStr(params.targetName, 160),
      details: cleanStr(params.details, 1000),
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createFollowUpTask(
  task: Omit<FollowUpTaskRecord, 'id' | 'createdAt' | 'updatedAt'>,
  actor?: { uid: string; name: string; role: string }
): Promise<string> {
  const taskId = makeId('task');
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    title: cleanStr(task.title, 200, 'Follow-up Task'),
    relatedType: cleanStr(task.relatedType, 50, 'Lead'),
    relatedId: cleanStr(task.relatedId, 128, 'unlinked'),
    relatedName: cleanStr(task.relatedName, 140, 'Patient'),
    assignedToName: cleanStr(task.assignedToName, 120, 'Coordinator'),
    priority: task.priority || 'High',
    dueDate: cleanStr(task.dueDate, 40, now.slice(0, 10)),
    status: task.status || 'Pending',
    ownerId: cleanStr(task.ownerId, 128),
    createdAt: now,
    updatedAt: now,
  };
  if (task.description) payload.description = cleanStr(task.description, 1000);
  if (task.reminderTime) payload.reminderTime = cleanStr(task.reminderTime, 40);
  if (task.automationTrigger) payload.automationTrigger = cleanStr(task.automationTrigger, 160);
  if (task.escalationRule) payload.escalationRule = cleanStr(task.escalationRule, 200);
  if (task.internalNotes) payload.internalNotes = cleanStr(task.internalNotes, 1000);

  try {
    await setDoc(doc(db, 'tasks', taskId), payload);
    if (actor) {
      await logAuditEvent({
        actorUid: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'Created Follow-up Task',
        module: 'Follow-ups and Tasks',
        targetId: taskId,
        targetName: String(payload.title),
        details: `Assigned to ${payload.assignedToName} (Due: ${payload.dueDate})`,
      });
    }
    return taskId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `tasks/${taskId}`);
  }
}

export async function createLead(
  lead: Omit<LeadRecord, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { uid: string; name: string; role: string }
): Promise<string> {
  const leadId = makeId('lead');
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    leadCode: cleanStr(lead.leadCode, 40, `LD-${Math.floor(1000 + Math.random() * 9000)}`),
    patientName: cleanStr(lead.patientName, 140, 'New Inquiry Patient'),
    phone: cleanStr(lead.phone, 40, '+8801700000000'),
    country: cleanStr(lead.country, 80, 'Bangladesh'),
    city: cleanStr(lead.city, 80, 'Dhaka'),
    preferredLanguage: cleanStr(lead.preferredLanguage, 50, 'Bengali'),
    inquiryDate: cleanStr(lead.inquiryDate, 40, now.slice(0, 10)),
    leadSource: cleanStr(lead.leadSource, 80, 'Website Contact Form'),
    interestedTreatment: cleanStr(lead.interestedTreatment, 160, 'Cardiology & Cardiothoracic Surgery'),
    preferredHospital: cleanStr(lead.preferredHospital, 160, 'Apollo Hospitals, Greams Road, Chennai, India'),
    assignedStaffName: cleanStr(lead.assignedStaffName, 120, actor.name),
    priority: lead.priority || 'High',
    status: cleanStr(lead.status, 80, 'New Inquiry'),
    consentGiven: Boolean(lead.consentGiven),
    ownerId: cleanStr(lead.ownerId, 128, actor.uid),
    createdAt: now,
    updatedAt: now,
  };
  if (lead.whatsapp) payload.whatsapp = cleanStr(lead.whatsapp, 40);
  if (lead.email) payload.email = cleanStr(lead.email, 200);
  if (lead.campaignSource) payload.campaignSource = cleanStr(lead.campaignSource, 120);
  if (lead.preferredCountry) payload.preferredCountry = cleanStr(lead.preferredCountry, 80);
  if (lead.needsDescription) payload.needsDescription = cleanStr(lead.needsDescription, 2000);
  if (lead.nextFollowUpDate) payload.nextFollowUpDate = cleanStr(lead.nextFollowUpDate, 40);
  if (lead.lostReason) payload.lostReason = cleanStr(lead.lostReason, 400);
  if (lead.privacyPreferences) payload.privacyPreferences = cleanStr(lead.privacyPreferences, 300);
  if (lead.convertedPatientId) payload.convertedPatientId = cleanStr(lead.convertedPatientId, 128);
  if (lead.internalNotes) payload.internalNotes = cleanStr(lead.internalNotes, 2000);

  try {
    await setDoc(doc(db, 'leads', leadId), payload);
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'Created Lead Inquiry',
      module: 'Leads and Inquiries',
      targetId: leadId,
      targetName: String(payload.patientName),
      details: `Source: ${payload.leadSource} | Treatment: ${payload.interestedTreatment}`,
    });

    // Section 13 Automation: New lead without contact attempt -> create a contact task
    if (payload.status === 'New Inquiry') {
      await createFollowUpTask({
        title: `Initial Contact & Medical Report Collection: ${payload.patientName}`,
        description: `Inbound inquiry via ${payload.leadSource} for ${payload.interestedTreatment}. Verify consent and request clinical reports.`,
        relatedType: 'Lead',
        relatedId: leadId,
        relatedName: String(payload.patientName),
        assignedToName: String(payload.assignedStaffName),
        priority: lead.priority === 'Urgent' ? 'Urgent' : 'High',
        dueDate: now.slice(0, 10),
        status: 'Pending',
        automationTrigger: 'Auto-Triggered: New Inquiry Without Contact Attempt',
        escalationRule: 'Escalate to Patient Relationship Manager if uncontacted > 4 hours',
        ownerId: actor.uid,
      });
    }
    return leadId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `leads/${leadId}`);
  }
}

export async function updateLeadStage(
  leadId: string,
  updates: Partial<LeadRecord>,
  actor: { uid: string; name: string; role: string }
): Promise<void> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = { updatedAt: now };
  if (updates.status !== undefined) payload.status = cleanStr(updates.status, 80);
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.assignedStaffName !== undefined) payload.assignedStaffName = cleanStr(updates.assignedStaffName, 120);
  if (updates.nextFollowUpDate !== undefined) payload.nextFollowUpDate = cleanStr(updates.nextFollowUpDate, 40);
  if (updates.lostReason !== undefined) payload.lostReason = cleanStr(updates.lostReason, 400);
  if (updates.internalNotes !== undefined) payload.internalNotes = cleanStr(updates.internalNotes, 2000);
  if (updates.convertedPatientId !== undefined) payload.convertedPatientId = cleanStr(updates.convertedPatientId, 128);

  try {
    await updateDoc(doc(db, 'leads', leadId), payload);
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'Updated Lead Record',
      module: 'Leads and Inquiries',
      targetId: leadId,
      targetName: updates.patientName || leadId,
      details: `Updated status to ${updates.status || 'current'}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `leads/${leadId}`);
  }
}

export async function createPatient(
  patient: Omit<PatientRecord, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { uid: string; name: string; role: string }
): Promise<string> {
  const patientId = makeId('pat');
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    patientCode: cleanStr(patient.patientCode, 40, `QW-PT-${Math.floor(1000 + Math.random() * 9000)}`),
    fullName: cleanStr(patient.fullName, 140, 'Patient'),
    age: Number(patient.age) || 45,
    gender: cleanStr(patient.gender, 30, 'Male'),
    phone: cleanStr(patient.phone, 40, '+8801700000000'),
    country: cleanStr(patient.country, 80, 'Bangladesh'),
    city: cleanStr(patient.city, 80, 'Dhaka'),
    preferredLanguage: cleanStr(patient.preferredLanguage, 50, 'Bengali'),
    preferredHospital: cleanStr(patient.preferredHospital, 160, 'Apollo Hospitals, Greams Road, Chennai, India'),
    preferredDestination: cleanStr(patient.preferredDestination, 120, 'Chennai, India'),
    assignedCoordinatorName: cleanStr(patient.assignedCoordinatorName, 120, actor.name),
    journeyStage: cleanStr(patient.journeyStage, 80, 'Medical Documents Collection'),
    dataProcessingConsent: Boolean(patient.dataProcessingConsent),
    marketingConsent: Boolean(patient.marketingConsent),
    ownerId: cleanStr(patient.ownerId, 128, actor.uid),
    createdAt: now,
    updatedAt: now,
  };
  if (patient.whatsapp) payload.whatsapp = cleanStr(patient.whatsapp, 40);
  if (patient.email) payload.email = cleanStr(patient.email, 200);
  if (patient.passportNumber) payload.passportNumber = cleanStr(patient.passportNumber, 50);
  if (patient.preferredChannel) payload.preferredChannel = cleanStr(patient.preferredChannel, 50);
  if (patient.emergencyContact) payload.emergencyContact = cleanStr(patient.emergencyContact, 200);
  if (patient.medicalHistorySummary) payload.medicalHistorySummary = cleanStr(patient.medicalHistorySummary, 3000);
  if (patient.existingDiagnoses) payload.existingDiagnoses = cleanStr(patient.existingDiagnoses, 1500);
  if (patient.reportedSymptoms) payload.reportedSymptoms = cleanStr(patient.reportedSymptoms, 1500);
  if (patient.previousTreatments) payload.previousTreatments = cleanStr(patient.previousTreatments, 1500);
  if (patient.treatmentRequirements) payload.treatmentRequirements = cleanStr(patient.treatmentRequirements, 1500);

  try {
    await setDoc(doc(db, 'patients', patientId), payload);
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'Registered Unified Patient Profile',
      module: 'Patients',
      targetId: patientId,
      targetName: String(payload.fullName),
      details: `Code: ${payload.patientCode} | Destination: ${payload.preferredHospital}`,
    });
    return patientId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `patients/${patientId}`);
  }
}

export async function updatePatientJourneyStage(
  patientId: string,
  journeyStage: string,
  patientName: string,
  actor: { uid: string; name: string; role: string }
): Promise<void> {
  const now = new Date().toISOString();
  const cleanStage = cleanStr(journeyStage, 80, 'Documents Collected');
  try {
    await updateDoc(doc(db, 'patients', patientId), {
      journeyStage: cleanStage,
      updatedAt: now,
    });
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'Updated Patient Journey Stage',
      module: 'Patients',
      targetId: patientId,
      targetName: cleanStr(patientName, 140, patientId),
      details: `Journey stage updated to: ${cleanStage}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `patients/${patientId}`);
  }
}

export async function updatePatientSelfServiceProfile(
  patientId: string,
  patientName: string,
  updates: {
    passportNumber?: string;
    emergencyContact?: string;
    city?: string;
    whatsapp?: string;
    reportedSymptoms?: string;
    preferredHospital?: string;
    journeyStage?: string;
  },
  actor: { uid: string; name: string; role: string }
): Promise<void> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = { updatedAt: now };
  if (updates.passportNumber !== undefined) {
    payload.passportNumber = cleanStr(updates.passportNumber, 50);
  }
  if (updates.emergencyContact !== undefined) {
    payload.emergencyContact = cleanStr(updates.emergencyContact, 200);
  }
  if (updates.city !== undefined) {
    payload.city = cleanStr(updates.city, 80);
  }
  if (updates.whatsapp !== undefined) {
    payload.whatsapp = cleanStr(updates.whatsapp, 40);
  }
  if (updates.reportedSymptoms !== undefined) {
    payload.reportedSymptoms = cleanStr(updates.reportedSymptoms, 1500);
  }
  if (updates.preferredHospital !== undefined) {
    payload.preferredHospital = cleanStr(updates.preferredHospital, 160);
  }
  if (updates.journeyStage !== undefined) {
    payload.journeyStage = cleanStr(updates.journeyStage, 80);
  }

  try {
    await updateDoc(doc(db, 'patients', patientId), payload);
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'Patient Self-Service Profile Update',
      module: 'Patient Portal',
      targetId: patientId,
      targetName: cleanStr(patientName, 140, patientId),
      details: `Patient self-updated profile fields (${Object.keys(updates).join(', ')})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `patients/${patientId}`);
  }
}

export async function convertLeadToPatient(
  lead: LeadRecord,
  existingPatients: PatientRecord[],
  actor: { uid: string; name: string; role: string }
): Promise<{ patientId: string; deduplicated: boolean }> {
  // Duplicate check by phone or email
  const normPhone = lead.phone.replace(/\s+/g, '');
  const duplicate = existingPatients.find(
    (p) =>
      p.phone.replace(/\s+/g, '') === normPhone ||
      (lead.email && p.email && p.email.toLowerCase() === lead.email.toLowerCase())
  );

  if (duplicate) {
    await updateLeadStage(
      lead.id,
      {
        status: 'Converted to Patient',
        convertedPatientId: duplicate.id,
        patientName: lead.patientName,
      },
      actor
    );
    return { patientId: duplicate.id, deduplicated: true };
  }

  const newPatientId = await createPatient(
    {
      patientCode: `QW-PT-${lead.leadCode.replace(/[^0-9]/g, '') || Math.floor(1000 + Math.random() * 9000)}`,
      fullName: lead.patientName,
      age: 48,
      gender: 'Not Specified',
      phone: lead.phone,
      whatsapp: lead.whatsapp || lead.phone,
      email: lead.email || '',
      country: lead.country,
      city: lead.city,
      preferredLanguage: lead.preferredLanguage,
      preferredChannel: 'WhatsApp',
      medicalHistorySummary: lead.needsDescription || 'Converted from inbound inquiry.',
      reportedSymptoms: lead.needsDescription || '',
      treatmentRequirements: lead.interestedTreatment,
      preferredHospital: lead.preferredHospital,
      preferredDestination: lead.preferredCountry || 'Chennai, India',
      assignedCoordinatorName: lead.assignedStaffName,
      journeyStage: 'Medical Documents Collection',
      dataProcessingConsent: lead.consentGiven,
      marketingConsent: false,
      ownerId: actor.uid,
    },
    actor
  );

  await updateLeadStage(
    lead.id,
    {
      status: 'Converted to Patient',
      convertedPatientId: newPatientId,
      patientName: lead.patientName,
    },
    actor
  );

  await createFollowUpTask({
    title: `Collect Clinical Documents & Prescriptions: ${lead.patientName}`,
    description: `Lead converted to Patient. Collect discharge summary, lab reports, and imaging for ${lead.interestedTreatment}.`,
    relatedType: 'Patient',
    relatedId: newPatientId,
    relatedName: lead.patientName,
    assignedToName: lead.assignedStaffName,
    priority: 'High',
    dueDate: new Date().toISOString().slice(0, 10),
    status: 'Pending',
    automationTrigger: 'Auto-Triggered: Lead Converted to Patient',
    ownerId: actor.uid,
  });

  return { patientId: newPatientId, deduplicated: false };
}

export async function createMedicalDocument(
  docInput: Omit<MedicalDocumentRecord, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { uid: string; name: string; role: string }
): Promise<string> {
  const docId = makeId('doc');
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    patientId: cleanStr(docInput.patientId, 128),
    patientName: cleanStr(docInput.patientName, 140),
    title: cleanStr(docInput.title, 200),
    category: cleanStr(docInput.category, 80),
    fileName: cleanStr(docInput.fileName, 200),
    fileType: cleanStr(docInput.fileType, 40, 'PDF'),
    fileSizeKb: Number(docInput.fileSizeKb) || 420,
    version: Number(docInput.version) || 1,
    extractedText: cleanStr(docInput.extractedText, 5000, 'No text extracted.'),
    reviewStatus: cleanStr(docInput.reviewStatus, 60, 'Pending Review'),
    uploadedByName: cleanStr(docInput.uploadedByName, 120, actor.name),
    ownerId: cleanStr(docInput.ownerId, 128, actor.uid),
    createdAt: now,
    updatedAt: now,
  };
  if (docInput.reviewerNotes) payload.reviewerNotes = cleanStr(docInput.reviewerNotes, 1000);
  if (docInput.retentionPolicy) payload.retentionPolicy = cleanStr(docInput.retentionPolicy, 100);

  try {
    await setDoc(doc(db, 'medicalDocuments', docId), payload);
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'Uploaded Medical Document',
      module: 'Medical Documents',
      targetId: docId,
      targetName: String(payload.title),
      details: `Patient: ${payload.patientName} | Category: ${payload.category} | Status: ${payload.reviewStatus}`,
    });
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `medicalDocuments/${docId}`);
  }
}

export async function updateMedicalDocumentStatus(
  docId: string,
  reviewStatus: string,
  reviewerNotes: string,
  actor: { uid: string; name: string; role: string }
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'medicalDocuments', docId), {
      reviewStatus: cleanStr(reviewStatus, 60),
      reviewerNotes: cleanStr(reviewerNotes, 1000),
      updatedAt: now,
    });
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: `Document Review Status -> ${reviewStatus}`,
      module: 'Medical Documents',
      targetId: docId,
      targetName: docId,
      details: reviewerNotes || 'Document reviewed by coordinator',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `medicalDocuments/${docId}`);
  }
}

export async function saveAiMedicalReport(
  report: Omit<AiMedicalReportRecord, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { uid: string; name: string; role: string }
): Promise<string> {
  const reportId = makeId('airep');
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    patientId: cleanStr(report.patientId, 128),
    patientName: cleanStr(report.patientName, 140),
    preferredHospital: cleanStr(report.preferredHospital, 160),
    sourceDocumentsSummary: cleanStr(report.sourceDocumentsSummary, 1000),
    documentedHistorySummary: cleanStr(report.documentedHistorySummary, 3000),
    reportedSymptomsAndFindings: cleanStr(report.reportedSymptomsAndFindings, 3000),
    currentDocumentedStatus: cleanStr(report.currentDocumentedStatus, 2000),
    missingInformation: cleanStr(report.missingInformation, 2000),
    questionsForDoctor: cleanStr(report.questionsForDoctor, 2000),
    recommendedSpecialty: cleanStr(report.recommendedSpecialty, 300),
    potentialTreatmentPathways: cleanStr(report.potentialTreatmentPathways, 2500),
    suggestedNextSteps: cleanStr(report.suggestedNextSteps, 1500),
    disclaimer: cleanStr(report.disclaimer, 1500, MANDATORY_MEDICAL_DISCLAIMER),
    reviewStatus: 'DRAFT — NOT CLINICIAN-APPROVED',
    modelVersion: cleanStr(report.modelVersion, 80, 'gemini-3.8-flash'),
    sharedWithPatient: false,
    ownerId: cleanStr(report.ownerId, 128, actor.uid),
    createdAt: now,
    updatedAt: now,
  };
  if (report.age !== undefined) payload.age = Number(report.age);
  if (report.gender) payload.gender = cleanStr(report.gender, 30);
  if (report.preferredDestination) payload.preferredDestination = cleanStr(report.preferredDestination, 120);
  if (report.currencyPreference) payload.currencyPreference = cleanStr(report.currencyPreference, 20);
  if (report.secondOpinionWorkflow) payload.secondOpinionWorkflow = cleanStr(report.secondOpinionWorkflow, 1500);
  if (report.estimatedBudgetRange) payload.estimatedBudgetRange = cleanStr(report.estimatedBudgetRange, 1000);
  if (report.travelConsiderations) payload.travelConsiderations = cleanStr(report.travelConsiderations, 1500);
  if (report.emergencyWarningDetected !== undefined) {
    payload.emergencyWarningDetected = Boolean(report.emergencyWarningDetected);
  }
  if (report.emergencyWarningText) payload.emergencyWarningText = cleanStr(report.emergencyWarningText, 1000);

  try {
    await setDoc(doc(db, 'aiReports', reportId), payload);
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'Generated AI Preliminary Medical Report (DRAFT)',
      module: 'AI Medical Report Assistant',
      targetId: reportId,
      targetName: String(payload.patientName),
      details: `Model: ${payload.modelVersion} | Status: DRAFT — NOT CLINICIAN-APPROVED`,
    });

    // Section 13 Automation: AI report generated -> assign a human review task
    await createFollowUpTask({
      title: `Human Review Required: AI Preliminary Report for ${payload.patientName}`,
      description: `Verify extracted source facts against original documents before sharing or requesting hospital opinion.`,
      relatedType: 'AI Report',
      relatedId: reportId,
      relatedName: String(payload.patientName),
      assignedToName: actor.name,
      priority: 'High',
      dueDate: now.slice(0, 10),
      status: 'Pending',
      automationTrigger: 'Auto-Triggered: AI Report Generated (Awaiting Human Review)',
      ownerId: actor.uid,
    });
    return reportId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `aiReports/${reportId}`);
  }
}

export async function updateAiReportReview(
  reportId: string,
  updates: {
    reviewStatus: string;
    reviewerName: string;
    reviewNotes: string;
    sharedWithPatient: boolean;
  },
  actor: { uid: string; name: string; role: string }
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'aiReports', reportId), {
      reviewStatus: cleanStr(updates.reviewStatus, 80),
      reviewerName: cleanStr(updates.reviewerName, 120),
      reviewNotes: cleanStr(updates.reviewNotes, 1500),
      sharedWithPatient: Boolean(updates.sharedWithPatient),
      updatedAt: now,
    });
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: `AI Report Review -> ${updates.reviewStatus}`,
      module: 'AI Medical Report Assistant',
      targetId: reportId,
      targetName: reportId,
      details: `Reviewer: ${updates.reviewerName} | Shared with patient: ${updates.sharedWithPatient}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `aiReports/${reportId}`);
  }
}

export async function createSecondOpinion(
  opinion: Omit<HospitalSecondOpinionRecord, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { uid: string; name: string; role: string }
): Promise<string> {
  const opinionId = makeId('opin');
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    patientId: cleanStr(opinion.patientId, 128),
    patientName: cleanStr(opinion.patientName, 140),
    specialty: cleanStr(opinion.specialty, 120),
    hospitalName: cleanStr(opinion.hospitalName, 160),
    department: cleanStr(opinion.department, 120),
    doctorName: cleanStr(opinion.doctorName, 140),
    submissionDate: cleanStr(opinion.submissionDate, 40, now.slice(0, 10)),
    hospitalReferenceNumber: cleanStr(
      opinion.hospitalReferenceNumber,
      80,
      `APL-CHN-${Math.floor(10000 + Math.random() * 90000)}`
    ),
    assignedCoordinatorName: cleanStr(opinion.assignedCoordinatorName, 120, actor.name),
    status: cleanStr(opinion.status, 80, 'Opinion Pending'),
    verificationStatus: cleanStr(opinion.verificationStatus, 80, 'Awaiting Hospital Document'),
    ownerId: cleanStr(opinion.ownerId, 128, actor.uid),
    createdAt: now,
    updatedAt: now,
  };
  if (opinion.submittedDocuments) payload.submittedDocuments = cleanStr(opinion.submittedDocuments, 1000);
  if (opinion.followUpDate) payload.followUpDate = cleanStr(opinion.followUpDate, 40);
  if (opinion.quotedFeeUsd !== undefined) payload.quotedFeeUsd = Number(opinion.quotedFeeUsd);
  if (opinion.expectedResponseDate) payload.expectedResponseDate = cleanStr(opinion.expectedResponseDate, 40);
  if (opinion.receivedOpinionSummary) payload.receivedOpinionSummary = cleanStr(opinion.receivedOpinionSummary, 3000);
  if (opinion.documentedRecommendations) {
    payload.documentedRecommendations = cleanStr(opinion.documentedRecommendations, 3000);
  }
  if (opinion.originalDocumentTitle) payload.originalDocumentTitle = cleanStr(opinion.originalDocumentTitle, 200);
  if (opinion.issuingInstitution) payload.issuingInstitution = cleanStr(opinion.issuingInstitution, 160);
  if (opinion.documentIssuedDate) payload.documentIssuedDate = cleanStr(opinion.documentIssuedDate, 40);
  if (opinion.estimatedCostInr !== undefined) payload.estimatedCostInr = Number(opinion.estimatedCostInr);
  if (opinion.estimatedCostUsd !== undefined) payload.estimatedCostUsd = Number(opinion.estimatedCostUsd);
  if (opinion.estimatedTimeline) payload.estimatedTimeline = cleanStr(opinion.estimatedTimeline, 200);
  if (opinion.clinicianDiscussionPoints) {
    payload.clinicianDiscussionPoints = cleanStr(opinion.clinicianDiscussionPoints, 1500);
  }

  try {
    await setDoc(doc(db, 'secondOpinions', opinionId), payload);
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'Logged Hospital Second Opinion Case',
      module: 'Hospital Second Opinions',
      targetId: opinionId,
      targetName: String(payload.patientName),
      details: `${payload.hospitalName} (${payload.doctorName}) | Ref: ${payload.hospitalReferenceNumber}`,
    });

    await createFollowUpTask({
      title: `Follow up Hospital Second Opinion: ${payload.patientName}`,
      description: `Track response from ${payload.hospitalName} (${payload.doctorName}), Ref: ${payload.hospitalReferenceNumber}.`,
      relatedType: 'Second Opinion',
      relatedId: opinionId,
      relatedName: String(payload.patientName),
      assignedToName: String(payload.assignedCoordinatorName),
      priority: 'High',
      dueDate: opinion.expectedResponseDate || now.slice(0, 10),
      status: 'Pending',
      automationTrigger: 'Auto-Triggered: Hospital Second Opinion Requested',
      ownerId: actor.uid,
    });
    return opinionId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `secondOpinions/${opinionId}`);
  }
}

export async function updateSecondOpinionCase(
  opinionId: string,
  updates: Partial<HospitalSecondOpinionRecord>,
  actor: { uid: string; name: string; role: string }
): Promise<void> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = { updatedAt: now };
  if (updates.status !== undefined) payload.status = cleanStr(updates.status, 80);
  if (updates.verificationStatus !== undefined) {
    payload.verificationStatus = cleanStr(updates.verificationStatus, 80);
  }
  if (updates.receivedOpinionSummary !== undefined) {
    payload.receivedOpinionSummary = cleanStr(updates.receivedOpinionSummary, 3000);
  }
  if (updates.documentedRecommendations !== undefined) {
    payload.documentedRecommendations = cleanStr(updates.documentedRecommendations, 3000);
  }
  if (updates.originalDocumentTitle !== undefined) {
    payload.originalDocumentTitle = cleanStr(updates.originalDocumentTitle, 200);
  }
  if (updates.issuingInstitution !== undefined) {
    payload.issuingInstitution = cleanStr(updates.issuingInstitution, 160);
  }
  if (updates.documentIssuedDate !== undefined) {
    payload.documentIssuedDate = cleanStr(updates.documentIssuedDate, 40);
  }
  if (updates.estimatedCostInr !== undefined) payload.estimatedCostInr = Number(updates.estimatedCostInr);
  if (updates.estimatedCostUsd !== undefined) payload.estimatedCostUsd = Number(updates.estimatedCostUsd);
  if (updates.estimatedTimeline !== undefined) payload.estimatedTimeline = cleanStr(updates.estimatedTimeline, 200);
  if (updates.clinicianDiscussionPoints !== undefined) {
    payload.clinicianDiscussionPoints = cleanStr(updates.clinicianDiscussionPoints, 1500);
  }

  try {
    await updateDoc(doc(db, 'secondOpinions', opinionId), payload);
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: `Updated Second Opinion -> ${updates.status || 'Modified'}`,
      module: 'Hospital Second Opinions',
      targetId: opinionId,
      targetName: opinionId,
      details: `Verification: ${updates.verificationStatus || 'Checked'}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `secondOpinions/${opinionId}`);
  }
}

export async function createCostEstimate(
  estimate: Omit<TreatmentCostEstimateRecord, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { uid: string; name: string; role: string }
): Promise<string> {
  const estimateId = makeId('est');
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    patientId: cleanStr(estimate.patientId, 128),
    patientName: cleanStr(estimate.patientName, 140),
    destinationCity: cleanStr(estimate.destinationCity, 100, 'Chennai, India'),
    hospitalName: cleanStr(estimate.hospitalName, 160),
    specialty: cleanStr(estimate.specialty, 120),
    treatmentTitle: cleanStr(estimate.treatmentTitle, 200),
    patientCount: Number(estimate.patientCount) || 1,
    companionCount: Number(estimate.companionCount) || 1,
    lengthOfStayDays: Number(estimate.lengthOfStayDays) || 14,
    currency: cleanStr(estimate.currency, 10, 'USD'),
    minTotalBudgetUsd: Number(estimate.minTotalBudgetUsd) || 0,
    maxTotalBudgetUsd: Number(estimate.maxTotalBudgetUsd) || 0,
    quotationSource: cleanStr(estimate.quotationSource, 160, 'Official Hospital Tariff + Planning Assumptions'),
    status: cleanStr(estimate.status, 60, 'Draft'),
    ownerId: cleanStr(estimate.ownerId, 128, actor.uid),
    createdAt: now,
    updatedAt: now,
  };
  if (estimate.accommodationCategory) payload.accommodationCategory = cleanStr(estimate.accommodationCategory, 80);
  if (estimate.exchangeRateBdtPerUsd !== undefined) payload.exchangeRateBdtPerUsd = Number(estimate.exchangeRateBdtPerUsd);
  if (estimate.exchangeRateInrPerUsd !== undefined) payload.exchangeRateInrPerUsd = Number(estimate.exchangeRateInrPerUsd);
  if (estimate.exchangeRateTimestamp) payload.exchangeRateTimestamp = cleanStr(estimate.exchangeRateTimestamp, 60);
  if (estimate.exchangeRateSource) payload.exchangeRateSource = cleanStr(estimate.exchangeRateSource, 120);
  if (estimate.hospitalConfirmedTotalUsd !== undefined) {
    payload.hospitalConfirmedTotalUsd = Number(estimate.hospitalConfirmedTotalUsd);
  }
  if (estimate.estimatedTravelTotalUsd !== undefined) {
    payload.estimatedTravelTotalUsd = Number(estimate.estimatedTravelTotalUsd);
  }
  if (estimate.estimatedAccommodationTotalUsd !== undefined) {
    payload.estimatedAccommodationTotalUsd = Number(estimate.estimatedAccommodationTotalUsd);
  }
  if (estimate.coordinationAndOtherTotalUsd !== undefined) {
    payload.coordinationAndOtherTotalUsd = Number(estimate.coordinationAndOtherTotalUsd);
  }
  if (estimate.lineItemsSummary) payload.lineItemsSummary = cleanStr(estimate.lineItemsSummary, 4000);
  if (estimate.assumptions) payload.assumptions = cleanStr(estimate.assumptions, 1500);
  if (estimate.exclusions) payload.exclusions = cleanStr(estimate.exclusions, 1500);
  if (estimate.validityPeriodDays !== undefined) payload.validityPeriodDays = Number(estimate.validityPeriodDays);

  try {
    await setDoc(doc(db, 'costEstimates', estimateId), payload);
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'Created Treatment & Travel Cost Estimate',
      module: 'Treatment Cost Estimator',
      targetId: estimateId,
      targetName: String(payload.patientName),
      details: `${payload.treatmentTitle} | Range: $${payload.minTotalBudgetUsd} - $${payload.maxTotalBudgetUsd} USD`,
    });
    return estimateId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `costEstimates/${estimateId}`);
  }
}

export async function updateCostEstimateStatus(
  estimateId: string,
  status: string,
  actor: { uid: string; name: string; role: string }
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'costEstimates', estimateId), {
      status: cleanStr(status, 60),
      updatedAt: now,
    });
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: `Cost Estimate Status -> ${status}`,
      module: 'Treatment Cost Estimator',
      targetId: estimateId,
      targetName: estimateId,
      details: `Updated status to ${status}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `costEstimates/${estimateId}`);
  }
}

export async function createServiceBooking(
  booking: Omit<ServiceBookingRecord, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { uid: string; name: string; role: string }
): Promise<string> {
  const bookingId = makeId('srv');
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    patientId: cleanStr(booking.patientId, 128),
    patientName: cleanStr(booking.patientName, 140),
    serviceCategory: cleanStr(booking.serviceCategory, 80),
    serviceName: cleanStr(booking.serviceName, 160),
    hospitalOrProvider: cleanStr(booking.hospitalOrProvider, 160),
    scheduledDate: cleanStr(booking.scheduledDate, 40, now.slice(0, 10)),
    status: cleanStr(booking.status, 60, 'Requested'),
    assignedCoordinatorName: cleanStr(booking.assignedCoordinatorName, 120, actor.name),
    ownerId: cleanStr(booking.ownerId, 128, actor.uid),
    createdAt: now,
    updatedAt: now,
  };
  if (booking.doctorName) payload.doctorName = cleanStr(booking.doctorName, 140);
  if (booking.scheduledTime) payload.scheduledTime = cleanStr(booking.scheduledTime, 40);
  if (booking.serviceFeeUsd !== undefined) payload.serviceFeeUsd = Number(booking.serviceFeeUsd);
  if (booking.processingTimeEstimate) payload.processingTimeEstimate = cleanStr(booking.processingTimeEstimate, 100);
  if (booking.visaPassportRef) payload.visaPassportRef = cleanStr(booking.visaPassportRef, 120);
  if (booking.flightDetails) payload.flightDetails = cleanStr(booking.flightDetails, 300);
  if (booking.accommodationDetails) payload.accommodationDetails = cleanStr(booking.accommodationDetails, 300);
  if (booking.notes) payload.notes = cleanStr(booking.notes, 1500);

  try {
    await setDoc(doc(db, 'serviceBookings', bookingId), payload);
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: `Created Service Booking (${payload.serviceCategory})`,
      module: 'Services and Bookings',
      targetId: bookingId,
      targetName: String(payload.patientName),
      details: `${payload.serviceName} at ${payload.hospitalOrProvider} (${payload.status})`,
    });
    return bookingId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `serviceBookings/${bookingId}`);
  }
}

export async function updateServiceBookingStatus(
  bookingId: string,
  updates: Partial<ServiceBookingRecord>,
  actor: { uid: string; name: string; role: string }
): Promise<void> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = { updatedAt: now };
  if (updates.status !== undefined) payload.status = cleanStr(updates.status, 60);
  if (updates.scheduledDate !== undefined) payload.scheduledDate = cleanStr(updates.scheduledDate, 40);
  if (updates.scheduledTime !== undefined) payload.scheduledTime = cleanStr(updates.scheduledTime, 40);
  if (updates.visaPassportRef !== undefined) payload.visaPassportRef = cleanStr(updates.visaPassportRef, 120);
  if (updates.flightDetails !== undefined) payload.flightDetails = cleanStr(updates.flightDetails, 300);
  if (updates.accommodationDetails !== undefined) {
    payload.accommodationDetails = cleanStr(updates.accommodationDetails, 300);
  }
  if (updates.notes !== undefined) payload.notes = cleanStr(updates.notes, 1500);

  try {
    await updateDoc(doc(db, 'serviceBookings', bookingId), payload);
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: `Updated Service Booking -> ${updates.status || 'Modified'}`,
      module: 'Services and Bookings',
      targetId: bookingId,
      targetName: bookingId,
      details: updates.notes || `Status set to ${updates.status}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `serviceBookings/${bookingId}`);
  }
}

export async function updateTaskStatus(
  taskId: string,
  status: 'Pending' | 'In Progress' | 'Overdue' | 'Completed',
  actor: { uid: string; name: string; role: string }
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'tasks', taskId), {
      status,
      updatedAt: now,
    });
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: `Task Status -> ${status}`,
      module: 'Follow-ups and Tasks',
      targetId: taskId,
      targetName: taskId,
      details: `Marked task as ${status}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
  }
}

export async function deleteTaskRecord(taskId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'tasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
  }
}

export async function createCommunicationRecord(
  comm: Omit<CommunicationRecordItem, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { uid: string; name: string; role: string }
): Promise<string> {
  const commId = makeId('comm');
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    recipientType: cleanStr(comm.recipientType, 40, 'Patient'),
    recipientId: cleanStr(comm.recipientId, 128),
    recipientName: cleanStr(comm.recipientName, 140),
    channel: cleanStr(comm.channel, 60, 'WhatsApp'),
    direction: comm.direction || 'Outbound',
    messageSummary: cleanStr(comm.messageSummary, 2000),
    staffOrAutomationName: cleanStr(comm.staffOrAutomationName, 120, actor.name),
    deliveryStatus: cleanStr(comm.deliveryStatus, 60, 'Logged (Manual Entry)'),
    consentVerified: Boolean(comm.consentVerified),
    optOutStatus: Boolean(comm.optOutStatus),
    ownerId: cleanStr(comm.ownerId, 128, actor.uid),
    createdAt: now,
    updatedAt: now,
  };
  if (comm.subject) payload.subject = cleanStr(comm.subject, 200);

  try {
    await setDoc(doc(db, 'communications', commId), payload);
    await logAuditEvent({
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: `Logged ${payload.direction} ${payload.channel} Communication`,
      module: 'Communications',
      targetId: commId,
      targetName: String(payload.recipientName),
      details: String(payload.messageSummary).slice(0, 120),
    });
    return commId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `communications/${commId}`);
  }
}

export async function createHospitalDirectoryEntry(
  hosp: Omit<HospitalDirectoryRecord, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { uid: string; name: string; role: string }
): Promise<string> {
  const hospId = makeId('hosp');
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    name: cleanStr(hosp.name, 160),
    city: cleanStr(hosp.city, 80),
    country: cleanStr(hosp.country, 80),
    accreditation: cleanStr(hosp.accreditation, 120),
    keySpecialties: cleanStr(hosp.keySpecialties, 500),
    leadDoctors: cleanStr(hosp.leadDoctors, 800),
    internationalDeskContact: cleanStr(hosp.internationalDeskContact, 200),
    averageOpinionTurnaroundHours: Number(hosp.averageOpinionTurnaroundHours) || 24,
    verifiedPartner: Boolean(hosp.verifiedPartner),
    ownerId: cleanStr(hosp.ownerId, 128, actor.uid),
    createdAt: now,
    updatedAt: now,
  };
  if (hosp.notes) payload.notes = cleanStr(hosp.notes, 1000);

  try {
    await setDoc(doc(db, 'hospitals', hospId), payload);
    return hospId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `hospitals/${hospId}`);
  }
}

/**
 * Seeds realistic synthetic medical tourism records for QureWays Trip (Bangladesh -> Apollo Hospitals Chennai).
 */
export async function seedSyntheticCrmData(actor: {
  uid: string;
  name: string;
  role: string;
}): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // 1. Seed Verified Partner Hospitals
  await createHospitalDirectoryEntry(
    {
      name: 'Apollo Hospitals, Greams Road, Chennai',
      city: 'Chennai',
      country: 'India',
      accreditation: 'JCI & NABH Accredited Flagship Tertiary Center',
      keySpecialties: 'Cardiothoracic Surgery, Interventional Cardiology, Liver & Renal Transplant, Neurosurgery, Orthopedics',
      leadDoctors: 'Dr. Refai Showkathali (Interventional Cardiology), Dr. Joy Varghese (Hepatology & Liver Transplant), Dr. Sajan K Hegde (Spine Surgery)',
      internationalDeskContact: 'International Patient Division, Gate 4, Greams Lane, Thousand Lights, Chennai 600006',
      averageOpinionTurnaroundHours: 24,
      verifiedPartner: true,
      notes: 'Primary destination for Bangladesh patients; direct Dhaka-Chennai flight connectivity & Bengali interpreters on-site.',
      ownerId: actor.uid,
    },
    actor
  );

  await createHospitalDirectoryEntry(
    {
      name: 'Apollo Proton Cancer Centre (APCC), Chennai',
      city: 'Chennai',
      country: 'India',
      accreditation: 'JCI Accredited — South Asia First Proton Therapy Center',
      keySpecialties: 'Proton Beam Therapy, Neuro-Oncology, Head & Neck Oncology, Pediatric Oncology, Robotic Surgical Oncology',
      leadDoctors: 'Dr. Rakesh Jalali (Radiation Oncology), Dr. Sapna Nangia (Radiation Oncology), Dr. Ajit Pai (Surgical Oncology)',
      internationalDeskContact: '4/661, Dr Vikram Sarabhai Instronic Estate 7th St, Taramani, Chennai 600113',
      averageOpinionTurnaroundHours: 36,
      verifiedPartner: true,
      notes: 'Specialized multidisciplinary tumor board opinions for complex oncology cases from Bangladesh.',
      ownerId: actor.uid,
    },
    actor
  );

  // 2. Seed Synthetic Patients
  const pat1Id = await createPatient(
    {
      patientCode: 'QW-PT-2041',
      fullName: 'Md. Mahbubur Rahman',
      age: 58,
      gender: 'Male',
      phone: '+8801711458920',
      whatsapp: '+8801711458920',
      email: 'mahbub.rahman.dhk@example.com',
      country: 'Bangladesh',
      city: 'Dhaka',
      passportNumber: 'A04928174',
      preferredLanguage: 'Bengali',
      preferredChannel: 'WhatsApp',
      emergencyContact: 'Farhana Rahman (Spouse) +8801711458921',
      medicalHistorySummary: '58-year-old male from Dhanmondi, Dhaka with history of hypertension (8 years) and Type 2 Diabetes Mellitus. Recent coronary angiogram at NICVD Dhaka showed triple vessel coronary artery disease (TVD) with LVEF 46%.',
      existingDiagnoses: 'Triple Vessel Coronary Artery Disease (LAD 85%, LCX 80%, RCA 90% stenosis), Type 2 Diabetes Mellitus, Hypertension.',
      reportedSymptoms: 'Exertional angina (CCS Class II-III) on climbing 1 flight of stairs, mild dyspnea on exertion; no resting chest pain.',
      previousTreatments: 'Medical management with Ecospirin 75mg, Rosuvastatin 20mg, Metoprolol 50mg, Empagliflozin 10mg.',
      treatmentRequirements: 'Coronary Artery Bypass Grafting (CABG) vs Complex Multivessel PCI Second Opinion & Treatment Package at Apollo Greams Road.',
      preferredHospital: 'Apollo Hospitals, Greams Road, Chennai, India',
      preferredDestination: 'Chennai, India',
      assignedCoordinatorName: actor.name,
      journeyStage: 'Hospital Second Opinion & Estimate Review',
      dataProcessingConsent: true,
      marketingConsent: false,
      ownerId: actor.uid,
    },
    actor
  );

  const pat2Id = await createPatient(
    {
      patientCode: 'QW-PT-2042',
      fullName: 'Nasrin Sultana Chowdhury',
      age: 46,
      gender: 'Female',
      phone: '+8801819334102',
      whatsapp: '+8801819334102',
      email: 'nasrin.ctg@example.com',
      country: 'Bangladesh',
      city: 'Chattogram',
      passportNumber: 'B01984312',
      preferredLanguage: 'Bengali',
      preferredChannel: 'WhatsApp',
      emergencyContact: 'Tariqul Chowdhury (Brother) +8801819334105',
      medicalHistorySummary: '46-year-old female from Nasirabad, Chattogram with biopsy-proven infiltrating ductal carcinoma of left breast (ER+, PR+, HER2-). Seeking multidisciplinary oncology review and surgical/radiation planning at Apollo Proton Cancer Centre, Chennai.',
      existingDiagnoses: 'Infiltrating Ductal Carcinoma Left Breast (cT2N1M0), Grade II, ER/PR Positive.',
      reportedSymptoms: 'Palpable painless lump in upper outer quadrant of left breast noticed 7 weeks ago.',
      previousTreatments: 'Core needle biopsy & IHC panel completed in Chattogram; PET-CT pending in Chennai.',
      treatmentRequirements: 'Multidisciplinary Tumor Board Second Opinion, Staging PET-CT, and Breast-Conserving Surgery + Adjuvant Plan.',
      preferredHospital: 'Apollo Proton Cancer Centre, Chennai, India',
      preferredDestination: 'Chennai, India',
      assignedCoordinatorName: actor.name,
      journeyStage: 'Visa & Travel Preparation',
      dataProcessingConsent: true,
      marketingConsent: true,
      ownerId: actor.uid,
    },
    actor
  );

  const daysAgo = (n: number) =>
    new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

  // 3. Seed Leads across the last 30 days (including converted leads)
  await createLead(
    {
      leadCode: 'LD-8790',
      patientName: 'Md. Mahbubur Rahman',
      phone: '+8801711458920',
      whatsapp: '+8801711458920',
      email: 'mahbub.rahman.dhk@example.com',
      country: 'Bangladesh',
      city: 'Dhaka',
      preferredLanguage: 'Bengali',
      inquiryDate: daysAgo(24),
      leadSource: 'WhatsApp Business',
      campaignSource: 'Apollo Chennai Cardiac Care BD',
      interestedTreatment: 'Cardiology & Cardiothoracic Surgery',
      preferredHospital: 'Apollo Hospitals, Greams Road, Chennai, India',
      preferredCountry: 'India',
      needsDescription: 'Triple Vessel Coronary Artery Disease (TVD) evaluated at NICVD Dhaka; converted to unified patient dossier.',
      assignedStaffName: actor.name,
      priority: 'Urgent',
      nextFollowUpDate: today,
      status: 'Converted to Patient',
      convertedPatientId: pat1Id,
      consentGiven: true,
      privacyPreferences: 'Explicit care coordination consent verified.',
      ownerId: actor.uid,
    },
    actor
  );

  await createLead(
    {
      leadCode: 'LD-8794',
      patientName: 'Alhaj Abdul Karim Mia',
      phone: '+8801814902114',
      whatsapp: '+8801814902114',
      email: 'karim.mia.rajshahi@example.com',
      country: 'Bangladesh',
      city: 'Rajshahi',
      preferredLanguage: 'Bengali',
      inquiryDate: daysAgo(19),
      leadSource: 'Phone Call',
      campaignSource: 'Direct Helpline Inquiry BD',
      interestedTreatment: 'Nephrology & Renal Transplant',
      preferredHospital: 'Apollo Hospitals, Greams Road, Chennai, India',
      preferredCountry: 'India',
      needsDescription: 'CKD Stage 5 on maintenance hemodialysis; evaluating living related donor transplant.',
      assignedStaffName: actor.name,
      priority: 'High',
      nextFollowUpDate: today,
      status: 'Estimate Shared',
      consentGiven: true,
      privacyPreferences: 'Explicit care coordination consent verified.',
      ownerId: actor.uid,
    },
    actor
  );

  await createLead(
    {
      leadCode: 'LD-8798',
      patientName: 'Nasrin Sultana Chowdhury',
      phone: '+8801819334102',
      whatsapp: '+8801819334102',
      email: 'nasrin.ctg@example.com',
      country: 'Bangladesh',
      city: 'Chattogram',
      preferredLanguage: 'Bengali',
      inquiryDate: daysAgo(12),
      leadSource: 'Hospital / Doctor Referral',
      campaignSource: 'Chattogram Oncology Referral Network',
      interestedTreatment: 'Medical & Surgical Oncology',
      preferredHospital: 'Apollo Proton Cancer Centre, Chennai, India',
      preferredCountry: 'India',
      needsDescription: 'Infiltrating Ductal Carcinoma Left Breast; converted to unified patient dossier for APCC Chennai.',
      assignedStaffName: actor.name,
      priority: 'Urgent',
      nextFollowUpDate: today,
      status: 'Converted to Patient',
      convertedPatientId: pat2Id,
      consentGiven: true,
      privacyPreferences: 'Explicit care coordination consent verified.',
      ownerId: actor.uid,
    },
    actor
  );

  await createLead(
    {
      leadCode: 'LD-8800',
      patientName: 'Kamrul Hasan Talukder',
      phone: '+8801712664390',
      whatsapp: '+8801712664390',
      email: 'kamrul.khulna@example.com',
      country: 'Bangladesh',
      city: 'Khulna',
      preferredLanguage: 'Bengali',
      inquiryDate: daysAgo(6),
      leadSource: 'Google Business Profile',
      campaignSource: 'Spine Surgery Search BD',
      interestedTreatment: 'Spine Surgery',
      preferredHospital: 'Apollo Hospitals, Greams Road, Chennai, India',
      preferredCountry: 'India',
      needsDescription: 'L4-L5 disc prolapse with radiculopathy; completed teleconsultation and confirmed surgical trip.',
      assignedStaffName: actor.name,
      priority: 'High',
      nextFollowUpDate: today,
      status: 'Completed',
      consentGiven: true,
      privacyPreferences: 'Explicit care coordination consent verified.',
      ownerId: actor.uid,
    },
    actor
  );

  await createLead(
    {
      leadCode: 'LD-8801',
      patientName: 'Engr. Shafiqul Islam',
      phone: '+8801715882310',
      whatsapp: '+8801715882310',
      email: 'shafiqul.sylhet@example.com',
      country: 'Bangladesh',
      city: 'Sylhet',
      preferredLanguage: 'Bengali',
      inquiryDate: today,
      leadSource: 'Website Contact Form',
      campaignSource: 'Apollo Chennai Liver Care Guide BD',
      interestedTreatment: 'Hepatobiliary & Liver Transplant',
      preferredHospital: 'Apollo Hospitals, Greams Road, Chennai, India',
      preferredCountry: 'India',
      needsDescription: 'Patient has decompensated chronic liver disease (MELD 17) with portal hypertension. Family has a willing related donor and wants Apollo Chennai Hepatology opinion and living-donor liver transplant cost estimate.',
      assignedStaffName: actor.name,
      priority: 'Urgent',
      nextFollowUpDate: today,
      status: 'Documents Received',
      consentGiven: true,
      privacyPreferences: 'Medical processing consent granted; WhatsApp coordination only.',
      internalNotes: 'Fibroscan, LFT, and CT Triphasic Abdomen reports uploaded by son.',
      ownerId: actor.uid,
    },
    actor
  );

  await createLead(
    {
      leadCode: 'LD-8802',
      patientName: 'Begum Rokeya Khatun',
      phone: '+8801911220495',
      whatsapp: '+8801911220495',
      email: 'rokeya.family@example.com',
      country: 'Bangladesh',
      city: 'Dhaka',
      preferredLanguage: 'Bengali',
      inquiryDate: today,
      leadSource: 'Facebook Page',
      campaignSource: 'Orthopedic Spine & Knee Awareness BD',
      interestedTreatment: 'Orthopedics & Joint Replacement',
      preferredHospital: 'Apollo Hospitals, Greams Road, Chennai, India',
      preferredCountry: 'India',
      needsDescription: 'Bilateral Grade IV osteoarthritis of knees. Seeking robotic total knee replacement estimate and visa invitation letter for patient + 1 attendant.',
      assignedStaffName: actor.name,
      priority: 'High',
      nextFollowUpDate: today,
      status: 'New Inquiry',
      consentGiven: true,
      privacyPreferences: 'Standard care coordination consent.',
      ownerId: actor.uid,
    },
    actor
  );

  // 4. Seed Medical Documents
  await createMedicalDocument(
    {
      patientId: pat1Id,
      patientName: 'Md. Mahbubur Rahman',
      title: 'Coronary Angiogram Report & DVD Summary — NICVD Dhaka',
      category: 'Imaging reports',
      fileName: 'Mahbubur_Rahman_CAG_Report_Dhaka.pdf',
      fileType: 'PDF',
      fileSizeKb: 1480,
      version: 1,
      extractedText:
        '[Source: Page 1 - Cath Lab Summary] Left Main: Normal. LAD: Proximal 85% diffuse calcific stenosis. LCX: Mid 80% tubular lesion. RCA: Dominant, proximal 90% critical lesion. [Source: Page 2 - Echocardiogram] LVEF 46%, mild concentric LVH, mild mitral regurgitation. Impression: Triple Vessel Coronary Artery Disease; advised myocardial revascularization evaluation.',
      reviewStatus: 'Verified',
      reviewerNotes: 'Clear PDF scan; CAG lesions and LVEF verified against Echo sheet.',
      uploadedByName: actor.name,
      retentionPolicy: 'Standard 5-Year Clinical Coordination Retention',
      ownerId: actor.uid,
    },
    actor
  );

  await createMedicalDocument(
    {
      patientId: pat1Id,
      patientName: 'Md. Mahbubur Rahman',
      title: 'Biochemistry Panel (HbA1c, Creatinine, Lipid Profile)',
      category: 'Laboratory reports',
      fileName: 'Mahbubur_Rahman_Blood_Panel.pdf',
      fileType: 'PDF',
      fileSizeKb: 540,
      version: 1,
      extractedText:
        '[Source: Lab Sheet] HbA1c: 7.4%, Serum Creatinine: 1.12 mg/dL, eGFR: 71 mL/min, Fasting Blood Glucose: 136 mg/dL, LDL Cholesterol: 88 mg/dL, Hemoglobin: 13.4 g/dL.',
      reviewStatus: 'Verified',
      reviewerNotes: 'Renal function within acceptable range for contrast/surgical planning.',
      uploadedByName: actor.name,
      retentionPolicy: 'Standard 5-Year Clinical Coordination Retention',
      ownerId: actor.uid,
    },
    actor
  );

  // 5. Seed AI-Assisted Preliminary Medical Report (Section 9)
  await saveAiMedicalReport(
    {
      patientId: pat1Id,
      patientName: 'Md. Mahbubur Rahman',
      age: 58,
      gender: 'Male',
      preferredHospital: 'Apollo Hospitals, Greams Road, Chennai, India',
      preferredDestination: 'Chennai, India',
      currencyPreference: 'USD / BDT / INR',
      sourceDocumentsSummary:
        '1. [Doc #1] Coronary Angiogram Report & Echocardiogram — NICVD Dhaka (Mahbubur_Rahman_CAG_Report_Dhaka.pdf)\n2. [Doc #2] Biochemistry Panel — HbA1c, Creatinine, Lipid Profile (Mahbubur_Rahman_Blood_Panel.pdf)',
      documentedHistorySummary:
        '[Documented Fact - Doc #1 & #2]: 58-year-old male with documented Triple Vessel Coronary Artery Disease (LAD 85%, LCX 80%, RCA 90% stenosis), LVEF 46%, HbA1c 7.4%, and Serum Creatinine 1.12 mg/dL.\n[Patient-Reported]: 8-year history of hypertension and Type 2 Diabetes Mellitus currently on antiplatelet, statin, beta-blocker, and SGLT2 inhibitor therapy.',
      reportedSymptomsAndFindings:
        '[Patient-Reported]: Exertional angina (CCS Class II-III) on climbing stairs and mild dyspnea on exertion; denies resting chest pain.\n[Documented Fact - Doc #1]: Calcific proximal LAD 85%, mid-LCX 80%, proximal RCA 90% stenosis with LVEF 46%.',
      currentDocumentedStatus:
        '[AI Summary]: Stable documented triple vessel coronary artery disease with moderately preserved left ventricular systolic function (LVEF 46%) and borderline glycemic control (HbA1c 7.4%). Requires formal Cardiothoracic & Interventional Cardiology Heart Team review.',
      missingInformation:
        '1. Original DICOM CD/DVD of the Coronary Angiogram film frames (required by Apollo Chennai Cardiac team to assess distal vessel target caliber).\n2. Carotid Doppler ultrasound and Pulmonary Function Test (PFT) if surgical revascularization is considered.\n3. Current 12-lead resting ECG tracing.',
      questionsForDoctor:
        '1. Based on the angiogram cine loops, is Beating-Heart Off-Pump CABG (OPCAB) or Protected Multivessel PCI with IVUS/FFR guidance recommended?\n2. What pre-operative glycemic optimization target is needed given HbA1c of 7.4%?\n3. What is the expected ICU stay, ward stay, and post-discharge local stay in Chennai before fitness-to-fly clearance back to Dhaka?',
      recommendedSpecialty:
        'Department of Cardiothoracic & Vascular Surgery (CTVS) and Department of Interventional Cardiology — Apollo Heart Institute, Greams Road, Chennai.',
      secondOpinionWorkflow:
        'Step 1: Verify patient consent and upload DICOM CAG cine loop link.\nStep 2: Submit case dossier to Apollo Heart Institute Chennai International Desk.\nStep 3: Obtain written opinions from both Senior CTVS Surgeon and Senior Interventional Cardiologist for side-by-side Heart Team comparison.',
      potentialTreatmentPathways:
        '[Clinician Assessment Required]:\nPathway A: Off-Pump Coronary Artery Bypass Grafting (OPCABG) using LIMA-to-LAD and saphenous vein/radial grafts.\nPathway B: Intravascular Ultrasound (IVUS)-guided Complex Multivessel Drug-Eluting Stent (DES) Angioplasty if surgical risk is deemed high by the Heart Team.',
      suggestedNextSteps:
        '1. Coordinator to review and approve this draft summary.\n2. Collect CAG DICOM cine video from patient.\n3. Review received Apollo Chennai Heart Team opinions with patient and family via teleconsultation.',
      estimatedBudgetRange:
        'Indicative Planning Range (Subject to Official Hospital Assessment & Quotation): USD $5,200 – $7,400 (approx. INR 4,35,000 – 6,20,000 / BDT 6,24,000 – 8,88,000) inclusive of hospital package, 14-day Chennai accommodation, and return Dhaka-Chennai travel for patient + 1 companion.',
      travelConsiderations:
        'Requires Indian Medical Visa (Med-1) for patient and Medical Attendant Visa (Med-2) for spouse. Recommend wheelchair assistance at Hazrat Shahjalal International Airport (DAC) and Chennai International Airport (MAA).',
      emergencyWarningDetected: false,
      emergencyWarningText:
        'Important Safety Notice: If the patient experiences chest pain at rest, pain radiating to jaw/left arm, diaphoresis, or acute shortness of breath, seek immediate emergency cardiac care at a local hospital in Dhaka rather than waiting for international travel.',
      disclaimer: MANDATORY_MEDICAL_DISCLAIMER,
      reviewStatus: 'DRAFT — NOT CLINICIAN-APPROVED',
      modelVersion: 'gemini-3.8-flash',
      sharedWithPatient: false,
      ownerId: actor.uid,
    },
    actor
  );

  // 6. Seed Two Hospital Second Opinions for Side-by-Side Comparison (Section 10)
  await createSecondOpinion(
    {
      patientId: pat1Id,
      patientName: 'Md. Mahbubur Rahman',
      specialty: 'Cardiothoracic & Vascular Surgery (CTVS)',
      hospitalName: 'Apollo Hospitals, Greams Road, Chennai, India',
      department: 'Apollo Heart Institute — CTVS',
      doctorName: 'Dr. M. M. Yusuf (Senior Consultant Cardiothoracic Surgeon)',
      submittedDocuments: 'CAG Report PDF, Echo Summary, HbA1c & Renal Panel',
      submissionDate: today,
      hospitalReferenceNumber: 'APL-CHN-CTVS-89412',
      assignedCoordinatorName: actor.name,
      followUpDate: today,
      status: 'Opinion Received',
      quotedFeeUsd: 0,
      expectedResponseDate: today,
      receivedOpinionSummary:
        'Reviewed CAG report and echocardiography findings. In view of diabetic status (HbA1c 7.4%), proximal LAD 85% calcific lesion, LCX 80%, and RCA 90% stenosis with LVEF 46%, complete surgical revascularization provides superior long-term graft patency.',
      documentedRecommendations:
        'Recommended Procedure: Beating-Heart Off-Pump Coronary Artery Bypass Grafting (OPCABG x 3 grafts) after 2 days of pre-operative cardiac, carotid, and glycemic workup in Chennai. Expected hospital stay: 7 days (2 days CTVS ICU + 5 days twin-sharing/single room) followed by 7 days local recovery in Chennai before suture review and fit-to-fly certificate.',
      originalDocumentTitle: 'Apollo_Chennai_CTVS_Opinion_APL89412.pdf',
      issuingInstitution: 'Apollo Hospitals Enterprise Ltd, Greams Road, Chennai',
      documentIssuedDate: today,
      verificationStatus: 'Verified Authentic Hospital Document',
      estimatedCostInr: 415000,
      estimatedCostUsd: 4950,
      estimatedTimeline: '7 Days In-Hospital + 7 Days Local Recovery in Chennai (Total 14 Days)',
      clinicianDiscussionPoints:
        'Discuss conduit selection (LIMA + Radial vs SVG), pre-op antiplatelet hold timing (5 days prior for Clopidogrel if taken), and diabetic wound care protocol.',
      ownerId: actor.uid,
    },
    actor
  );

  await createSecondOpinion(
    {
      patientId: pat1Id,
      patientName: 'Md. Mahbubur Rahman',
      specialty: 'Interventional Cardiology',
      hospitalName: 'Apollo Specialty Hospitals, Vanagaram, Chennai, India',
      department: 'Department of Interventional Cardiology',
      doctorName: 'Dr. Refai Showkathali (Senior Interventional Cardiologist)',
      submittedDocuments: 'CAG Report PDF, Echo Summary, Biochemistry Panel',
      submissionDate: today,
      hospitalReferenceNumber: 'APL-VNG-CARD-44109',
      assignedCoordinatorName: actor.name,
      followUpDate: today,
      status: 'Opinion Received',
      quotedFeeUsd: 0,
      expectedResponseDate: today,
      receivedOpinionSummary:
        'Reviewed coronary angiogram findings showing triple vessel disease in a 58-year-old diabetic patient. While CABG is the standard first-line option for diabetic TVD, if the patient declines open surgery, IVUS-guided staged multivessel PCI with 3 Drug-Eluting Stents (DES) and Rota-ablation standby is technically feasible upon reviewing cine loops.',
      documentedRecommendations:
        'Alternative Option: Repeat check angiography with Fractional Flow Reserve (FFR) & IVUS-guided Multivessel PCI (3 FDA-approved DES stents). Expected hospital stay: 3–4 days + 4 days local observation in Chennai.',
      originalDocumentTitle: 'Apollo_Interventional_Cardiology_Opinion_44109.pdf',
      issuingInstitution: 'Apollo Specialty Hospitals, Chennai',
      documentIssuedDate: today,
      verificationStatus: 'Verified Authentic Hospital Document',
      estimatedCostInr: 465000,
      estimatedCostUsd: 5540,
      estimatedTimeline: '4 Days In-Hospital + 4 Days Local Follow-up in Chennai (Total 8 Days)',
      clinicianDiscussionPoints:
        'Compare long-term repeat revascularization rate of CABG vs 3-stent PCI in diabetic TVD; confirm whether calcific LAD lesion requires intravascular lithotripsy/rotablation.',
      ownerId: actor.uid,
    },
    actor
  );

  // 7. Seed Transparent Treatment Cost Estimate (Section 11)
  await createCostEstimate(
    {
      patientId: pat1Id,
      patientName: 'Md. Mahbubur Rahman',
      destinationCity: 'Chennai, India',
      hospitalName: 'Apollo Hospitals, Greams Road, Chennai, India',
      specialty: 'Cardiothoracic & Vascular Surgery (CTVS)',
      treatmentTitle: 'Beating-Heart CABG Package + 14-Day Chennai Medical Travel Budget',
      patientCount: 1,
      companionCount: 1,
      lengthOfStayDays: 14,
      accommodationCategory: 'Serviced Apartment near Greams Road (Walkable to Apollo Gate 4)',
      currency: 'USD',
      exchangeRateBdtPerUsd: 120.0,
      exchangeRateInrPerUsd: 84.0,
      exchangeRateTimestamp: `${today} 09:00 UTC`,
      exchangeRateSource: 'Bangladesh Bank & RBI Indicative Mid-Market Reference Rate',
      hospitalConfirmedTotalUsd: 4950,
      estimatedTravelTotalUsd: 640,
      estimatedAccommodationTotalUsd: 560,
      coordinationAndOtherTotalUsd: 450,
      minTotalBudgetUsd: 6250,
      maxTotalBudgetUsd: 7150,
      lineItemsSummary: JSON.stringify([
        {
          category: 'A. Hospital and Medical Costs',
          item: 'Pre-op Cardiac & Carotid Investigations + CTVS Consultation',
          statusType: 'Hospital-Confirmed Quote',
          source: 'Apollo Chennai Ref #APL-CHN-CTVS-89412',
          costUsd: 220,
        },
        {
          category: 'A. Hospital and Medical Costs',
          item: 'Off-Pump CABG Procedure Package (7 Days: 2 ICU + 5 Twin-Sharing Room)',
          statusType: 'Hospital-Confirmed Quote',
          source: 'Apollo Chennai International Tariff Sheet (Valid 30 Days)',
          costUsd: 4650,
        },
        {
          category: 'A. Hospital and Medical Costs',
          item: 'Post-Discharge Suture Removal & Fit-to-Fly Review',
          statusType: 'Hospital-Confirmed Quote',
          source: 'Apollo Outpatient Tariff',
          costUsd: 80,
        },
        {
          category: 'B. Travel Costs',
          item: 'Return Flights (Dhaka DAC ↔ Chennai MAA) for Patient + 1 Companion',
          statusType: 'Planning Assumption (Quote Required at Booking)',
          source: 'Indicative Airline Range (US-Bangla / IndiGo)',
          costUsd: 560,
        },
        {
          category: 'B. Travel Costs',
          item: 'Chennai Airport Pickup, Hospital Transfers & Drop-off',
          statusType: 'Confirmed Service Rate',
          source: 'QureWays Trip Chennai Ground Desk',
          costUsd: 80,
        },
        {
          category: 'C. Accommodation and Living Costs',
          item: 'Serviced Guest House near Greams Road (14 Nights @ $28/night)',
          statusType: 'Planning Assumption',
          source: 'Partner Guest House Indicative Tariff',
          costUsd: 392,
        },
        {
          category: 'C. Accommodation and Living Costs',
          item: 'Companion Meals & Daily Living Allowance (14 Days @ $12/day)',
          statusType: 'Planning Assumption',
          source: 'Standard Chennai Patient Companion Estimate',
          costUsd: 168,
        },
        {
          category: 'D. Coordination and Other Costs',
          item: 'Indian Medical Visa Application & Documentation Assistance',
          statusType: 'Estimated Cost',
          source: 'IVAC Bangladesh Standard Processing',
          costUsd: 50,
        },
        {
          category: 'D. Coordination and Other Costs',
          item: '10% Medical Contingency Buffer (Extended ICU / Additional Consumables)',
          statusType: 'Optional / Contingency Buffer',
          source: 'Clinical Financial Prudence Guideline',
          costUsd: 400,
        },
      ]),
      assumptions:
        '1. Assumes uncomplicated 7-day hospital stay (2 days CTVS ICU + 5 days standard room).\n2. Includes 1 patient and 1 attendant travelling from Dhaka to Chennai for 14 days total.',
      exclusions:
        'Excludes extended ICU stay beyond 2 days, Intra-Aortic Balloon Pump (IABP), blood products beyond package limit, or treatment of unrelated co-morbidities.',
      validityPeriodDays: 30,
      quotationSource: 'Apollo Hospitals Chennai Official International Estimate #APL-CHN-CTVS-89412',
      status: 'Shared With Patient',
      ownerId: actor.uid,
    },
    actor
  );

  // 8. Seed Service Bookings (Appointments, Teleconsultation, Visa Invitation Letter, Airport Pickup)
  await createServiceBooking(
    {
      patientId: pat1Id,
      patientName: 'Md. Mahbubur Rahman',
      serviceCategory: 'Online Teleconsultation',
      serviceName: 'Pre-Travel Video Consultation with Dr. M. M. Yusuf (Apollo CTVS)',
      hospitalOrProvider: 'Apollo Hospitals, Greams Road, Chennai, India',
      doctorName: 'Dr. M. M. Yusuf',
      scheduledDate: today,
      scheduledTime: '16:30 BST (16:00 IST)',
      serviceFeeUsd: 45,
      processingTimeEstimate: '24 Hours Confirmation',
      status: 'Confirmed',
      assignedCoordinatorName: actor.name,
      notes: 'Bengali medical interpreter requested on zoom bridge for family Q&A.',
      ownerId: actor.uid,
    },
    actor
  );

  await createServiceBooking(
    {
      patientId: pat2Id,
      patientName: 'Nasrin Sultana Chowdhury',
      serviceCategory: 'Visa Invitation Letter',
      serviceName: 'Official Medical Visa Invitation Letter (High Commission of India, Chattogram)',
      hospitalOrProvider: 'Apollo Proton Cancer Centre, Chennai, India',
      doctorName: 'Dr. Sapna Nangia',
      scheduledDate: today,
      scheduledTime: '11:00 BST',
      serviceFeeUsd: 0,
      processingTimeEstimate: '24–48 Hours',
      status: 'Confirmed',
      assignedCoordinatorName: actor.name,
      visaPassportRef: 'Patient Passport: B01984312 | Attendant Passport: A08841209',
      flightDetails: 'Planned Travel: Dhaka (DAC) to Chennai (MAA) via US-Bangla BS-205',
      accommodationDetails: 'Taramani Serviced Suites near Apollo Proton Centre (Booked 10 Nights)',
      notes: 'Visa invitation letter issued by Apollo International Desk and uploaded to patient portal.',
      ownerId: actor.uid,
    },
    actor
  );

  // 9. Seed Communication Timeline Logs
  await createCommunicationRecord(
    {
      recipientType: 'Patient',
      recipientId: pat1Id,
      recipientName: 'Md. Mahbubur Rahman',
      channel: 'WhatsApp',
      direction: 'Outbound',
      subject: 'Apollo Chennai CTVS vs Interventional Cardiology Second Opinions Shared',
      messageSummary:
        'Shared both official Apollo Chennai opinions and itemized USD/BDT/INR cost estimate PDF. Confirmed video teleconsultation slot for 4:30 PM BST.',
      staffOrAutomationName: actor.name,
      deliveryStatus: 'Logged (Manual Entry)',
      consentVerified: true,
      optOutStatus: false,
      ownerId: actor.uid,
    },
    actor
  );
}
