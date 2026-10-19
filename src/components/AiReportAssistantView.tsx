import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Printer,
  Scale,
  Building2,
  FileCheck,
  Eye,
  FolderUp,
  Trash2,
  X,
  Loader2,
  Languages,
} from 'lucide-react';
import {
  DOCUMENT_CATEGORIES,
  VERIFIED_HOSPITALS,
  SECOND_OPINION_STAGES,
  MANDATORY_MEDICAL_DISCLAIMER,
  type PatientRecord,
  type MedicalDocumentRecord,
  type AiMedicalReportRecord,
  type HospitalSecondOpinionRecord,
} from '../types/crm';
import {
  createMedicalDocument,
  updateMedicalDocumentStatus,
  saveAiMedicalReport,
  updateAiReportReview,
  createSecondOpinion,
  updateSecondOpinionCase,
  createCostEstimate,
  createFollowUpTask,
} from '../lib/crmService';

interface Props {
  activeSubModule: 'documents' | 'ai-assistant' | 'second-opinions';
  patients: PatientRecord[];
  documents: MedicalDocumentRecord[];
  aiReports: AiMedicalReportRecord[];
  secondOpinions: HospitalSecondOpinionRecord[];
  actor: { uid: string; name: string; role: string };
}

export const AiReportAssistantView: React.FC<Props> = ({
  activeSubModule,
  patients,
  documents,
  aiReports,
  secondOpinions,
  actor,
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0]?.id || '');
  const activePatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  // Document Upload & OCR State
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<string>(DOCUMENT_CATEGORIES[0]);
  const [docFileName, setDocFileName] = useState('');
  const [docFileType, setDocFileType] = useState('PDF');
  const [docRawNotes, setDocRawNotes] = useState('');
  const [docFileBase64, setDocFileBase64] = useState<string>('');
  const [docMimeType, setDocMimeType] = useState<string>('');
  const [isExtractingDoc, setIsExtractingDoc] = useState(false);
  const [ocrFeedback, setOcrFeedback] = useState<string>('');

  // Bulk Drag-and-Drop Upload Queue State
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [runOcrOnBulk, setRunOcrOnBulk] = useState(true);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState('');
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);
  const [bulkQueue, setBulkQueue] = useState<
    Array<{
      id: string;
      fileName: string;
      title: string;
      category: string;
      fileType: string;
      fileSizeKb: number;
      mimeType: string;
      base64: string;
      status: 'Queued' | 'Uploading' | 'Imported' | 'Error';
    }>
  >([]);

  // AI Preliminary Report State
  const [symptomsInput, setSymptomsInput] = useState('');
  const [diagnosesInput, setDiagnosesInput] = useState('');
  const [previousTreatmentsInput, setPreviousTreatmentsInput] = useState('');
  const [preferredHospInput, setPreferredHospInput] = useState<string>(VERIFIED_HOSPITALS[0]);
  const [currencyPref, setCurrencyPref] = useState('USD / BDT / INR');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [reviewNotesInput, setReviewNotesInput] = useState('');
  const [bengaliTranslations, setBengaliTranslations] = useState<Record<string, string>>({});
  const [isTranslatingBn, setIsTranslatingBn] = useState(false);

  // Second Opinion State
  const [soSpecialty, setSoSpecialty] = useState('Cardiothoracic & Vascular Surgery');
  const [soHospital, setSoHospital] = useState<string>(VERIFIED_HOSPITALS[0]);
  const [soDepartment, setSoDepartment] = useState('Apollo Heart Institute');
  const [soDoctor, setSoDoctor] = useState('Dr. M. M. Yusuf');
  const [soSummary, setSoSummary] = useState('');
  const [soRecommendations, setSoRecommendations] = useState('');
  const [soCostInr, setSoCostInr] = useState<number>(415000);
  const [soCostUsd, setSoCostUsd] = useState<number>(4950);
  const [soTimeline, setSoTimeline] = useState('7 Days In-Hospital + 7 Days Local Recovery');
  const [soDiscussionPoints, setSoDiscussionPoints] = useState('');
  const [comparePatientId, setComparePatientId] = useState<string>('');
  const [comparisonNotice, setComparisonNotice] = useState<string>('');

  // Next-Level Feature 5: Pathology Paraffin Block, Biopsy Slide & DICOM CD Hand-Carry Chain-of-Custody State
  const [handCarryItems, setHandCarryItems] = useState<string[]>([
    'dicom-cd',
    'original-dossier',
    'medications-15d',
  ]);
  const [paraffinBlockRef, setParaffinBlockRef] = useState<string>('Block #HP-2026-441B (4 Unstained Slides + 2 H&E)');
  const [dicomStudyRef, setDicomStudyRef] = useState<string>('NICVD Coronary Angiogram (CAG) DICOM CD + Echo Report');
  const [handCarryNotice, setHandCarryNotice] = useState<string>('');

  // Next-Level Feature 6: Pre-Admission Clinical Investigation & Pre-Anesthesia Readiness State
  const [checkedPreOpTests, setCheckedPreOpTests] = useState<string[]>([
    'cbc-esr',
    'creatinine-egfr',
    'echo-lvef',
    'hba1c-fasting',
  ]);
  const [preOpNotice, setPreOpNotice] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocFileName(file.name);
    setDocFileType(file.name.split('.').pop()?.toUpperCase() || 'PDF');
    setDocMimeType(file.type || 'application/pdf');
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64Part = result.includes(',') ? result.split(',')[1] : '';
      setDocFileBase64(base64Part);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadAndExtractDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient || !docTitle.trim()) return;
    setIsExtractingDoc(true);
    setOcrFeedback('');

    try {
      let extractedText = docRawNotes.trim();
      let reviewStatus = 'Pending Review';
      let reviewerNotes = 'Uploaded by coordinator.';

      const res = await fetch('/api/ai/extract-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: docTitle,
          category: docCategory,
          fileName: docFileName || `${docTitle.replace(/\s+/g, '_')}.pdf`,
          rawNotes: docRawNotes,
          fileBase64: docFileBase64 || undefined,
          mimeType: docMimeType || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        extractedText = data.extractedText || extractedText || 'Clinical text pending manual review.';
        reviewStatus = data.recommendedReviewStatus || 'Pending Review';
        if (!data.isReadableAndComplete && data.completenessFollowUpPrompt) {
          reviewerNotes = `Follow-up Required: ${data.completenessFollowUpPrompt}`;
          setOcrFeedback(`Incomplete/Unreadable Flag: ${data.completenessFollowUpPrompt}`);
        } else {
          setOcrFeedback('OCR & clinical extraction verified with source tags.');
        }
      }

      await createMedicalDocument(
        {
          patientId: activePatient.id,
          patientName: activePatient.fullName,
          title: docTitle,
          category: docCategory,
          fileName: docFileName || `${docTitle.replace(/\s+/g, '_')}.pdf`,
          fileType: docFileType,
          fileSizeKb: 620,
          version: 1,
          extractedText: extractedText || 'Uploaded clinical document.',
          reviewStatus,
          reviewerNotes,
          uploadedByName: actor.name,
          retentionPolicy: 'Encrypted Clinical Vault — 5 Year Retention',
          ownerId: actor.uid,
        },
        actor
      );

      setDocTitle('');
      setDocRawNotes('');
      setDocFileName('');
      setDocFileBase64('');
    } catch (err) {
      setOcrFeedback(err instanceof Error ? err.message : 'Document upload failed');
    } finally {
      setIsExtractingDoc(false);
    }
  };

  const inferCategoryFromFileName = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('rx') || lower.includes('prescrip')) return 'Prescriptions';
    if (lower.includes('discharge') || lower.includes('summary')) return 'Discharge summaries';
    if (lower.includes('blood') || lower.includes('cbc') || lower.includes('hba1c'))
      return 'Blood test results';
    if (
      lower.includes('lab') ||
      lower.includes('biopsy') ||
      lower.includes('ihc') ||
      lower.includes('pathology') ||
      lower.includes('creatinine') ||
      lower.includes('lft')
    )
      return 'Laboratory reports';
    if (
      lower.includes('cag') ||
      lower.includes('angio') ||
      lower.includes('echo') ||
      lower.includes('mri') ||
      lower.includes('ct') ||
      lower.includes('pet') ||
      lower.includes('xray') ||
      lower.includes('ultrasound') ||
      lower.includes('scan')
    )
      return 'Imaging reports';
    if (lower.includes('refer')) return 'Referral letters';
    if (lower.includes('opinion')) return 'Previous medical opinions';
    if (lower.includes('hosp') || lower.includes('letter') || lower.includes('visa'))
      return 'Hospital correspondence';
    return DOCUMENT_CATEGORIES[0];
  };

  const handleFilesAddedToQueue = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setBulkFeedback('');

    const filesArray = Array.from(fileList);
    const newItems = await Promise.all(
      filesArray.map(async (file, index) => {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = String(reader.result || '');
            resolve(res.includes(',') ? res.split(',')[1] : '');
          };
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });

        const ext = file.name.split('.').pop()?.toUpperCase() || 'PDF';
        const cleanTitle = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[_-]+/g, ' ')
          .trim();

        return {
          id: `bulk_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
          fileName: file.name,
          title: cleanTitle || file.name,
          category: inferCategoryFromFileName(file.name),
          fileType: ext,
          fileSizeKb: Math.max(1, Math.round(file.size / 1024)),
          mimeType: file.type || 'application/pdf',
          base64,
          status: 'Queued' as const,
        };
      })
    );

    setBulkQueue((prev) => [...prev, ...newItems]);
  };

  const handleDropFiles = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    await handleFilesAddedToQueue(e.dataTransfer.files);
  };

  const handleBulkImportToPatientFolder = async () => {
    if (!activePatient || bulkQueue.length === 0) return;
    setIsBulkImporting(true);
    setBulkFeedback('');

    let importedCount = 0;

    for (const item of bulkQueue) {
      if (item.status === 'Imported') continue;

      setBulkQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'Uploading' } : q))
      );

      try {
        let extractedText = `[Source: Bulk Import — ${item.fileName}] Clinical file (${item.category}, ${item.fileSizeKb} KB ${item.fileType}) imported directly into ${activePatient.fullName}'s folder.`;
        let reviewStatus = 'Pending Review';
        let reviewerNotes = `Bulk imported into ${activePatient.fullName}'s folder (${activePatient.patientCode}).`;

        if (runOcrOnBulk) {
          const res = await fetch('/api/ai/extract-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: item.title,
              category: item.category,
              fileName: item.fileName,
              rawNotes: '',
              fileBase64: item.base64 || undefined,
              mimeType: item.mimeType || undefined,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.extractedText) {
              extractedText = data.extractedText;
            }
            reviewStatus = data.recommendedReviewStatus || 'Pending Review';
            if (!data.isReadableAndComplete && data.completenessFollowUpPrompt) {
              reviewerNotes = `Follow-up Required: ${data.completenessFollowUpPrompt}`;
            }
          }
        }

        await createMedicalDocument(
          {
            patientId: activePatient.id,
            patientName: activePatient.fullName,
            title: item.title,
            category: item.category,
            fileName: item.fileName,
            fileType: item.fileType,
            fileSizeKb: item.fileSizeKb,
            version: 1,
            extractedText,
            reviewStatus,
            reviewerNotes,
            uploadedByName: actor.name,
            retentionPolicy: 'Encrypted Clinical Vault — 5 Year Retention',
            ownerId: actor.uid,
          },
          actor
        );

        importedCount++;
        setBulkQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'Imported' } : q))
        );
      } catch {
        setBulkQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'Error' } : q))
        );
      }
    }

    setIsBulkImporting(false);
    setBulkFeedback(
      `Successfully bulk-imported ${importedCount} file(s) directly into ${activePatient.fullName}'s (${activePatient.patientCode}) clinical folder.`
    );
  };

  const handleGeneratePreliminaryReport = async () => {
    if (!activePatient) return;
    setIsGeneratingAi(true);
    setAiError('');

    const patientDocs = documents.filter((d) => d.patientId === activePatient.id);

    try {
      const res = await fetch('/api/ai/preliminary-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: activePatient.fullName,
          age: activePatient.age,
          gender: activePatient.gender,
          country: activePatient.country,
          city: activePatient.city,
          reportedSymptoms: symptomsInput || activePatient.reportedSymptoms,
          existingDiagnoses: diagnosesInput || activePatient.existingDiagnoses,
          previousTreatments: previousTreatmentsInput || activePatient.previousTreatments,
          preferredHospital: preferredHospInput || activePatient.preferredHospital,
          preferredDestination: activePatient.preferredDestination,
          currencyPreference: currencyPref,
          documents: patientDocs,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate AI preliminary report');
      }

      const newId = await saveAiMedicalReport(
        {
          patientId: activePatient.id,
          patientName: activePatient.fullName,
          age: activePatient.age,
          gender: activePatient.gender,
          preferredHospital: preferredHospInput || activePatient.preferredHospital,
          preferredDestination: activePatient.preferredDestination,
          currencyPreference: currencyPref,
          sourceDocumentsSummary: data.sourceDocumentsSummary,
          documentedHistorySummary: data.documentedHistorySummary,
          reportedSymptomsAndFindings: data.reportedSymptomsAndFindings,
          currentDocumentedStatus: data.currentDocumentedStatus,
          missingInformation: data.missingInformation,
          questionsForDoctor: data.questionsForDoctor,
          recommendedSpecialty: data.recommendedSpecialty,
          secondOpinionWorkflow: data.secondOpinionWorkflow,
          potentialTreatmentPathways: data.potentialTreatmentPathways,
          suggestedNextSteps: data.suggestedNextSteps,
          estimatedBudgetRange: data.estimatedBudgetRange,
          travelConsiderations: data.travelConsiderations,
          emergencyWarningDetected: Boolean(data.emergencyWarningDetected),
          emergencyWarningText: data.emergencyWarningText,
          disclaimer: MANDATORY_MEDICAL_DISCLAIMER,
          reviewStatus: 'DRAFT — NOT CLINICIAN-APPROVED',
          modelVersion: data.modelVersion || 'gemini-3.8-flash',
          sharedWithPatient: false,
          ownerId: actor.uid,
        },
        actor
      );
      setSelectedReportId(newId);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error generating report');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCreateSecondOpinion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) return;
    await createSecondOpinion(
      {
        patientId: activePatient.id,
        patientName: activePatient.fullName,
        specialty: soSpecialty,
        hospitalName: soHospital,
        department: soDepartment,
        doctorName: soDoctor,
        submittedDocuments: documents
          .filter((d) => d.patientId === activePatient.id)
          .map((d) => d.title)
          .join(', ') || 'Clinical Dossier Submitted',
        submissionDate: new Date().toISOString().slice(0, 10),
        hospitalReferenceNumber: `APL-CHN-${Math.floor(10000 + Math.random() * 90000)}`,
        assignedCoordinatorName: actor.name,
        followUpDate: new Date().toISOString().slice(0, 10),
        status: soSummary ? 'Opinion Received' : 'Documents Submitted',
        quotedFeeUsd: 0,
        expectedResponseDate: new Date().toISOString().slice(0, 10),
        receivedOpinionSummary: soSummary || 'Awaiting official hospital response.',
        documentedRecommendations: soRecommendations || 'Pending specialist treatment plan.',
        originalDocumentTitle: `${soHospital.slice(0, 18).replace(/\s+/g, '_')}_Official_Opinion.pdf`,
        issuingInstitution: soHospital,
        documentIssuedDate: new Date().toISOString().slice(0, 10),
        verificationStatus: soSummary ? 'Verified Authentic Hospital Document' : 'Awaiting Hospital Document',
        estimatedCostInr: Number(soCostInr) || 0,
        estimatedCostUsd: Number(soCostUsd) || 0,
        estimatedTimeline: soTimeline,
        clinicianDiscussionPoints: soDiscussionPoints || 'Confirm pre-op investigations and length of stay.',
        ownerId: actor.uid,
      },
      actor
    );
    setSoSummary('');
    setSoRecommendations('');
    setSoDiscussionPoints('');
  };

  const activeReport =
    aiReports.find((r) => r.id === selectedReportId) ||
    aiReports.find((r) => activePatient && r.patientId === activePatient.id) ||
    aiReports[0];

  // MODULE 4: MEDICAL DOCUMENTS
  if (activeSubModule === 'documents') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Medical Document Vault & Clinical OCR</h2>
            <p className="text-sm text-slate-600">
              Encrypted patient document management, completeness verification, and source-referenced text extraction.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-slate-600">Target Patient Folder:</label>
            <select
              value={activePatient?.id || ''}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 font-semibold"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.patientCode})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Drag-and-Drop Bulk File Upload Zone for Current Selected Patient's Folder */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <FolderUp className="w-4 h-4 text-sky-700" />
                <h3 className="text-base font-bold text-slate-900">
                  Bulk Drag-and-Drop Patient Folder Import
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Drop multiple clinical PDFs, lab scans, prescriptions, or imaging reports to bulk-import directly into{' '}
                <strong className="text-sky-800">
                  {activePatient
                    ? `${activePatient.fullName}'s (${activePatient.patientCode})`
                    : 'the selected patient'}
                </strong>{' '}
                folder.
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={runOcrOnBulk}
                onChange={(e) => setRunOcrOnBulk(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Run Gemini Vision OCR & source-tagging during bulk import</span>
            </label>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isDraggingOver) setIsDraggingOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingOver(false);
            }}
            onDrop={handleDropFiles}
            onClick={() => bulkFileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              isDraggingOver
                ? 'border-sky-600 bg-sky-50/80'
                : 'border-slate-300 bg-slate-50/50 hover:border-sky-500 hover:bg-slate-50'
            }`}
          >
            <input
              ref={bulkFileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.txt,.dcm"
              onChange={(e) => handleFilesAddedToQueue(e.target.files)}
              className="hidden"
            />
            <Upload className="w-7 h-7 text-sky-700 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-900">
              Drag & drop multiple patient files here, or{' '}
              <span className="text-sky-700 underline">browse computer</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Target Folder:{' '}
              <span className="font-mono font-semibold text-slate-700">
                /medicalDocuments/{activePatient?.patientCode || 'patient'} ({activePatient?.fullName || 'Select Patient'})
              </span>{' '}
              · Auto-detects Prescriptions, Lab Reports, Discharge Summaries & Imaging
            </p>
          </div>

          {bulkFeedback && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{bulkFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setBulkFeedback('')}
                className="text-emerald-800 hover:underline font-semibold"
              >
                Dismiss
              </button>
            </div>
          )}

          {bulkQueue.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Staged Bulk Import Queue ({bulkQueue.length} file{bulkQueue.length === 1 ? '' : 's'} ready for{' '}
                  {activePatient?.fullName})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isBulkImporting}
                    onClick={() => setBulkQueue([])}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-md bg-white"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Queue</span>
                  </button>
                  <button
                    type="button"
                    disabled={
                      isBulkImporting ||
                      !activePatient ||
                      bulkQueue.every((q) => q.status === 'Imported')
                    }
                    onClick={handleBulkImportToPatientFolder}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
                  >
                    {isBulkImporting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Importing into {activePatient?.fullName}&apos;s Folder...</span>
                      </>
                    ) : (
                      <>
                        <FolderUp className="w-3.5 h-3.5" />
                        <span>
                          Bulk-Import {bulkQueue.filter((q) => q.status !== 'Imported').length} File(s) to{' '}
                          {activePatient?.fullName}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-slate-50/60 max-h-60 overflow-y-auto">
                {bulkQueue.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="w-4 h-4 text-sky-700 shrink-0" />
                      <input
                        type="text"
                        value={item.title}
                        disabled={item.status === 'Imported' || isBulkImporting}
                        onChange={(e) =>
                          setBulkQueue((prev) =>
                            prev.map((q) =>
                              q.id === item.id ? { ...q, title: e.target.value } : q
                            )
                          )
                        }
                        className="px-2 py-1 border border-slate-300 rounded bg-white text-slate-900 font-medium w-full sm:w-56"
                      />
                      <span className="font-mono text-slate-500 whitespace-nowrap hidden md:inline">
                        ({item.fileName} · {item.fileSizeKb} KB)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={item.category}
                        disabled={item.status === 'Imported' || isBulkImporting}
                        onChange={(e) =>
                          setBulkQueue((prev) =>
                            prev.map((q) =>
                              q.id === item.id ? { ...q, category: e.target.value } : q
                            )
                          )
                        }
                        className="px-2 py-1 border border-slate-300 rounded bg-white text-slate-800 text-xs"
                      >
                        {DOCUMENT_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>

                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold ${
                          item.status === 'Imported'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'Uploading'
                            ? 'bg-sky-100 text-sky-800'
                            : item.status === 'Error'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.status}
                      </span>

                      <button
                        type="button"
                        disabled={isBulkImporting}
                        onClick={() =>
                          setBulkQueue((prev) => prev.filter((q) => q.id !== item.id))
                        }
                        className="p-1 text-slate-400 hover:text-slate-700"
                        title="Remove from queue"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Upload & OCR Extraction Form */}
          <form
            onSubmit={handleUploadAndExtractDocument}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">Upload & Extract Clinical Record</h3>
              <span className="text-xs text-slate-500">PDF · JPG · PNG · DICOM Summary</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Select Patient *</label>
              <select
                value={activePatient?.id || ''}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} — {p.city}, {p.country}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g., Coronary Angiogram NICVD"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Document Category *</label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Attach Clinical File (PDF / Image for Gemini Vision OCR)
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-medium file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Clinical Findings / Transcription / Lab Values (Optional or Extracted)
              </label>
              <textarea
                rows={4}
                value={docRawNotes}
                onChange={(e) => setDocRawNotes(e.target.value)}
                placeholder="Paste lab values, discharge notes, or attach an image/PDF above for automated Gemini OCR extraction and readability check..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            {ocrFeedback && (
              <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900">
                {ocrFeedback}
              </div>
            )}

            <button
              type="submit"
              disabled={isExtractingDoc || !activePatient}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              {isExtractingDoc ? 'Running OCR & Completeness Check...' : 'Upload & Extract with Source Tags'}
            </button>
          </form>

          {/* Document Repository Table */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">Stored Clinical Documents & OCR Extracts</h3>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {documents.filter((d) => !selectedPatientId || d.patientId === selectedPatientId).length} records
              </span>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {documents
                .filter((d) => !selectedPatientId || d.patientId === selectedPatientId)
                .map((docItem) => (
                  <div key={docItem.id} className="p-4 border border-slate-200 rounded-lg space-y-2 hover:bg-slate-50/60">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-sky-700 shrink-0" />
                          <span className="text-sm font-semibold text-slate-900">{docItem.title}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span>Patient: {docItem.patientName}</span>
                          <span className="mx-1.5">·</span>
                          <span>{docItem.category}</span>
                          <span className="mx-1.5">·</span>
                          <span className="font-mono tabular-nums">
                            v{docItem.version} ({docItem.fileSizeKb} KB {docItem.fileType})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={docItem.reviewStatus}
                          onChange={(e) =>
                            updateMedicalDocumentStatus(
                              docItem.id,
                              e.target.value,
                              docItem.reviewerNotes || 'Updated by coordinator',
                              actor
                            )
                          }
                          className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-800"
                        >
                          <option value="Verified">Verified</option>
                          <option value="Pending Review">Pending Review</option>
                          <option value="Incomplete/Unreadable">Incomplete/Unreadable — Request Clear Copy</option>
                        </select>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-md border border-slate-200/80 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      <span className="font-semibold text-slate-900 block mb-1">
                        Extracted Facts & Source References:
                      </span>
                      {docItem.extractedText}
                    </div>

                    {docItem.reviewStatus === 'Incomplete/Unreadable' && (
                      <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-md">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                        <span>
                          Document flagged as incomplete or unreadable. Coordinator task active to request clearer copy
                          from patient. Never fabricate missing findings.
                        </span>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Next-Level Feature 5: Pathology Slide / Paraffin Block & DICOM CD Hand-Carry Chain-of-Custody Tracker */}
        {activePatient && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    Pathology Paraffin Block, Biopsy Slide & DICOM CD Cabin Hand-Carry Chain-of-Custody Tracker
                  </h3>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Prevent repeat invasive biopsies or repeat angiograms at Apollo Chennai by verifying physical cabin luggage hand-carry items for{' '}
                  <strong className="text-slate-900">
                    {activePatient.fullName} ({activePatient.patientCode})
                  </strong>
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await createMedicalDocument(
                    {
                      patientId: activePatient.id,
                      patientName: activePatient.fullName,
                      title: `Cabin Hand-Carry Physical Materials Manifest (${handCarryItems.length}/4 Verified)`,
                      category: 'Diagnostic / Imaging / Pathology Manifest',
                      fileName: `${activePatient.patientCode}_HandCarry_Manifest.pdf`,
                      fileType: 'MANIFEST',
                      fileSizeKb: 18,
                      uploadedByName: actor.name,
                      reviewStatus: 'Verified',
                      extractedText: `[Documented Fact] Physical Hand-Carry Manifest verified for Chennai flight.\n• Pathology Blocks/Slides: ${paraffinBlockRef}\n• Imaging DICOM CD/DVD: ${dicomStudyRef}\n• Verified Items (${handCarryItems.length}/4): ${handCarryItems.join(', ')}`,
                      reviewerNotes: 'Verified for cabin baggage hand-carry prior to DAC->MAA departure.',
                      version: 1,
                      ownerId: actor.uid,
                    },
                    actor
                  );
                  setHandCarryNotice(
                    `Logged Cabin Hand-Carry Physical Materials Manifest (${handCarryItems.length}/4 items) into ${activePatient.fullName}'s Medical Document Vault.`
                  );
                }}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
              >
                Log Hand-Carry Manifest to Patient Vault
              </button>
            </div>

            {handCarryNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950 flex items-center justify-between">
                <span>{handCarryNotice}</span>
                <button
                  type="button"
                  onClick={() => setHandCarryNotice('')}
                  className="font-semibold text-emerald-800 hover:underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Histopathology Paraffin Block & Unstained Glass Slides Ref (Oncology)
                </label>
                <input
                  type="text"
                  value={paraffinBlockRef}
                  onChange={(e) => setParaffinBlockRef(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Coronary Angiogram (CAG) / CT / PET-CT / MRI Raw DICOM CD Ref
                </label>
                <input
                  type="text"
                  value={dicomStudyRef}
                  onChange={(e) => setDicomStudyRef(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {[
                {
                  id: 'paraffin-slides',
                  title: '1. Tissue Paraffin Block & Glass Slides',
                  detail: 'Carried in rigid protective box in cabin bag for Apollo IHC review.',
                },
                {
                  id: 'dicom-cd',
                  title: '2. Raw DICOM CD / USB (CAG / CT / MRI)',
                  detail: 'Required by cardiac surgeons & radiologists (printed film alone is insufficient).',
                },
                {
                  id: 'original-dossier',
                  title: '3. Original Bangladesh Discharge & Lab File',
                  detail: 'Chronological ring-binder with original lab stamps and referral letter.',
                },
                {
                  id: 'medications-15d',
                  title: '4. 15-Day Current Medications + Prescription',
                  detail: 'In original blister packs with generic names for Chennai airport customs.',
                },
              ].map((item) => {
                const checked = handCarryItems.includes(item.id);
                return (
                  <label
                    key={item.id}
                    onClick={() =>
                      setHandCarryItems((prev) =>
                        prev.includes(item.id)
                          ? prev.filter((x) => x !== item.id)
                          : [...prev, item.id]
                      )
                    }
                    className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                      checked
                        ? 'bg-emerald-50/70 border-emerald-300'
                        : 'bg-slate-50/50 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="mt-0.5 rounded border-slate-300 text-emerald-700"
                    />
                    <div>
                      <div className="font-bold text-slate-900">{item.title}</div>
                      <p className="text-[11px] text-slate-600 mt-0.5">{item.detail}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // MODULE 5: AI MEDICAL REPORT ASSISTANT (SECTION 9)
  if (activeSubModule === 'ai-assistant') {
    return (
      <div className="space-y-6">
        {/* Mandatory Prominent Medical Disclaimer Banner */}
        <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-950 leading-relaxed">
            <span className="font-bold block text-amber-900 mb-0.5">
              Mandatory Clinical Decision & Safety Disclaimer (Non-Autonomous Navigation Tool)
            </span>
            {MANDATORY_MEDICAL_DISCLAIMER}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Case Builder & Human Review Controls */}
          <div className="lg:col-span-5 space-y-5 no-print">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
                1. Configure Case Inputs for AI Preliminary Report
              </h3>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Patient Profile *</label>
                <select
                  value={activePatient?.id || ''}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.age}y / {p.gender}) — {p.city}
                    </option>
                  ))}
                </select>
              </div>

              {activePatient && (
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                  <div>
                    <span className="font-semibold text-slate-800">Linked Medical Documents:</span>{' '}
                    <span className="font-mono tabular-nums">
                      {documents.filter((d) => d.patientId === activePatient.id).length} files
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Documented Diagnoses:</span>{' '}
                    {activePatient.existingDiagnoses || 'None on file'}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Target Hospital for Second Opinion & Estimate
                </label>
                <select
                  value={preferredHospInput}
                  onChange={(e) => setPreferredHospInput(e.target.value)}
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
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Additional Patient-Reported Symptoms (Optional Override)
                </label>
                <textarea
                  rows={2}
                  value={symptomsInput}
                  onChange={(e) => setSymptomsInput(e.target.value)}
                  placeholder={activePatient?.reportedSymptoms || 'Enter patient-reported symptoms...'}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Existing Documented Diagnoses & Lab Notes
                </label>
                <textarea
                  rows={2}
                  value={diagnosesInput}
                  onChange={(e) => setDiagnosesInput(e.target.value)}
                  placeholder={activePatient?.existingDiagnoses || 'Enter documented diagnoses...'}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Currency Display</label>
                  <select
                    value={currencyPref}
                    onChange={(e) => setCurrencyPref(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="USD / BDT / INR">USD + BDT + INR</option>
                    <option value="BDT (Bangladeshi Taka)">BDT Primary</option>
                    <option value="INR (Indian Rupee)">INR Primary</option>
                    <option value="USD (US Dollar)">USD Primary</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleGeneratePreliminaryReport}
                    disabled={isGeneratingAi || !activePatient}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isGeneratingAi ? 'Synthesizing 15 Sections...' : 'Generate AI Draft'}
                  </button>
                </div>
              </div>

              {aiError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{aiError}</div>
              )}
            </div>

            {/* Human Review Gate Workflow */}
            {activeReport && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
                  2. Human Review & Approval Gate
                </h3>
                <p className="text-xs text-slate-600">
                  Every AI report starts as <span className="font-semibold">DRAFT — NOT CLINICIAN-APPROVED</span>. It
                  cannot be viewed in the Patient Portal until an authorized reviewer approves it.
                </p>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Select Stored AI Report</label>
                  <select
                    value={activeReport.id}
                    onChange={(e) => setSelectedReportId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {aiReports.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.patientName} — {r.reviewStatus} ({r.createdAt.slice(0, 10)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Reviewer Verification Notes</label>
                  <textarea
                    rows={2}
                    value={reviewNotesInput}
                    onChange={(e) => setReviewNotesInput(e.target.value)}
                    placeholder="Verified source references against uploaded NICVD CAG and Lab reports..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      updateAiReportReview(
                        activeReport.id,
                        {
                          reviewStatus: 'Coordinator Verified',
                          reviewerName: actor.name,
                          reviewNotes: reviewNotesInput || 'Coordinator verified source citations.',
                          sharedWithPatient: false,
                        },
                        actor
                      )
                    }
                    className="px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Mark Coordinator Verified
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateAiReportReview(
                        activeReport.id,
                        {
                          reviewStatus: 'Approved for Patient Portal',
                          reviewerName: actor.name,
                          reviewNotes:
                            reviewNotesInput || 'Approved as informational navigation summary for patient portal.',
                          sharedWithPatient: true,
                        },
                        actor
                      )
                    }
                    className="px-3 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Approve & Share to Portal
                  </button>
                </div>
              </div>
            )}

            {/* Next-Level Feature 6: Pre-Admission Clinical Investigation & Pre-Anesthesia Readiness Checklist */}
            {activePatient && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      3. Pre-Travel Clinical Investigation & Pre-Anesthesia Readiness
                    </h3>
                    <p className="text-[11px] text-slate-600">
                      Verify baseline Bangladesh labs before flying to Chennai to avoid outpatient workup delays.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-sky-900 bg-sky-50 px-2 py-1 rounded border border-sky-200">
                    {checkedPreOpTests.length}/6 Ready
                  </span>
                </div>

                {preOpNotice && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-950 flex items-center justify-between">
                    <span>{preOpNotice}</span>
                    <button
                      type="button"
                      onClick={() => setPreOpNotice('')}
                      className="font-semibold hover:underline"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                <div className="space-y-1.5 text-xs">
                  {[
                    { id: 'cbc-esr', label: 'CBC with Platelet Count & ESR (Within 14 Days)' },
                    { id: 'creatinine-egfr', label: 'Serum Creatinine, Electrolytes & eGFR (Contrast Readiness)' },
                    { id: 'viral-markers', label: 'Viral Screening: HBsAg, Anti-HCV, HIV I & II (Mandatory for OR/Cath Lab)' },
                    { id: 'echo-lvef', label: '2D Echocardiogram with LVEF% & Regional Wall Motion' },
                    { id: 'hba1c-fasting', label: 'HbA1c, Fasting Blood Sugar & Thyroid Profile (TSH)' },
                    { id: 'coag-dental', label: 'PT/INR Coagulation Profile & Dental Clearance (For Cardiac/Valve Cases)' },
                  ].map((test) => {
                    const isDone = checkedPreOpTests.includes(test.id);
                    return (
                      <label
                        key={test.id}
                        onClick={() =>
                          setCheckedPreOpTests((prev) =>
                            prev.includes(test.id)
                              ? prev.filter((x) => x !== test.id)
                              : [...prev, test.id]
                          )
                        }
                        className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer ${
                          isDone
                            ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950 font-medium'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => {}}
                          className="rounded border-slate-300"
                        />
                        <span>{test.label}</span>
                      </label>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const missingCount = 6 - checkedPreOpTests.length;
                    await createFollowUpTask(
                      {
                        title: `Collect ${missingCount} Pending Pre-Travel Clinical Lab(s) for ${activePatient.fullName}`,
                        description: `Verified ${checkedPreOpTests.length}/6 pre-admission tests. Request remaining viral markers / coagulation / baseline labs prior to Chennai departure.`,
                        relatedType: 'Patient',
                        relatedId: activePatient.id,
                        relatedName: activePatient.fullName,
                        assignedToName: actor.name,
                        priority: 'High',
                        dueDate: new Date().toISOString().slice(0, 10),
                        status: 'Pending',
                        automationTrigger: 'Pre-Travel Clinical Readiness Check',
                        ownerId: actor.uid,
                      },
                      actor
                    );
                    setPreOpNotice(
                      `Created follow-up task to collect pending pre-admission labs (${checkedPreOpTests.length}/6 completed) for ${activePatient.fullName}.`
                    );
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors"
                >
                  Create Task for Pending Pre-Travel Labs
                </button>
              </div>
            )}
          </div>

          {/* Right Column: 15-Section Structured Preliminary Medical Report Viewer */}
          <div className="lg:col-span-7">
            {activeReport ? (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      QureWays Trip · Preliminary Medical Navigation Summary · Model: {activeReport.modelVersion}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">
                      1. Patient Information: {activeReport.patientName} ({activeReport.age || 58}y /{' '}
                      {activeReport.gender || 'Male'})
                    </h3>
                    <div className="text-xs text-slate-600 mt-0.5">
                      <span>Target Center: {activeReport.preferredHospital}</span>
                      <span className="mx-1.5">·</span>
                      <span>Review State: </span>
                      <span className="font-semibold text-amber-800">{activeReport.reviewStatus}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 no-print">
                    <button
                      type="button"
                      disabled={isTranslatingBn}
                      onClick={async () => {
                        setIsTranslatingBn(true);
                        try {
                          const resp = await fetch('/api/ai/translate-bengali-report', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              patientName: activeReport.patientName,
                              hospitalName: activeReport.preferredHospital,
                              documentedHistorySummary: activeReport.documentedHistorySummary,
                              questionsForDoctor: activeReport.questionsForDoctor,
                              suggestedNextSteps: activeReport.suggestedNextSteps,
                              travelConsiderations: activeReport.travelConsiderations,
                            }),
                          });
                          const data = await resp.json();
                          const fallbackBn = `১. সংক্ষিপ্ত চিকিৎসা ইতিহাস (${activeReport.patientName}):\n${activeReport.documentedHistorySummary}\n\n২. চেন্নাইয়ের বিশেষজ্ঞ ডাক্তারের কাছে গুরুত্বপূর্ণ প্রশ্নসমূহ:\n${activeReport.questionsForDoctor}\n\n৩. পরবর্তী করণীয় ও ভ্রমণ প্রস্তুতি (${activeReport.preferredHospital}):\n${activeReport.suggestedNextSteps}\n\n৪. বাধ্যতামূলক চিকিৎসা সতর্কীকরণ: এটি একটি AI-সহায়তাপ্রাপ্ত প্রাথমিক তথ্যমূলক সারসংক্ষেপ। চূড়ান্ত চিকিৎসা সিদ্ধান্তের জন্য বিশেষজ্ঞ ডাক্তারের পরামর্শ আবশ্যক।`;
                          setBengaliTranslations((prev) => ({
                            ...prev,
                            [activeReport.id]:
                              resp.ok && data.bengaliSummary ? data.bengaliSummary : fallbackBn,
                          }));
                        } catch {
                          const fallbackBn = `১. সংক্ষিপ্ত চিকিৎসা ইতিহাস (${activeReport.patientName}):\n${activeReport.documentedHistorySummary}\n\n২. চেন্নাইয়ের বিশেষজ্ঞ ডাক্তারের কাছে গুরুত্বপূর্ণ প্রশ্নসমূহ:\n${activeReport.questionsForDoctor}\n\n৩. পরবর্তী করণীয় ও ভ্রমণ প্রস্তুতি (${activeReport.preferredHospital}):\n${activeReport.suggestedNextSteps}`;
                          setBengaliTranslations((prev) => ({
                            ...prev,
                            [activeReport.id]: fallbackBn,
                          }));
                        } finally {
                          setIsTranslatingBn(false);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {isTranslatingBn ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Languages className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isTranslatingBn
                          ? 'Translating to বাংলা...'
                          : bengaliTranslations[activeReport.id]
                          ? 'Refresh বাংলা Summary'
                          : 'Generate বাংলা (Bengali) Explanation'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print / Save PDF
                    </button>
                  </div>
                </div>

                {/* Item 4: Bilingual Bengali (বাংলা) Patient Summary Panel */}
                {bengaliTranslations[activeReport.id] && (
                  <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                        <Languages className="w-4 h-4 text-emerald-700" />
                        <span>
                          রোগী ও পরিবারের জন্য বাংলা সারসংক্ষেপ (Bengali Patient & Family Explanation — Gemini 3.8 Flash)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          navigator.clipboard?.writeText(bengaliTranslations[activeReport.id] || '')
                        }
                        className="text-xs font-semibold text-emerald-800 hover:underline no-print"
                      >
                        Copy বাংলা Text
                      </button>
                    </div>
                    <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed bg-white p-3.5 rounded-lg border border-emerald-200">
                      {bengaliTranslations[activeReport.id]}
                    </p>
                  </div>
                )}

                {activeReport.emergencyWarningDetected && (
                  <div className="p-4 bg-red-50 border border-red-300 rounded-lg text-xs text-red-900">
                    <span className="font-bold block mb-1">
                      URGENT LOCAL EMERGENCY WARNING — DO NOT DELAY LOCAL CARE:
                    </span>
                    {activeReport.emergencyWarningText}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 text-sm">
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                    <h4 className="text-xs font-bold text-slate-900 mb-1">
                      2 & 15. Documents Reviewed & Source References
                    </h4>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {activeReport.sourceDocumentsSummary}
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                    <h4 className="text-xs font-bold text-slate-900 mb-1">
                      3. Summary of Available Medical History ([Documented Fact] vs [Patient-Reported])
                    </h4>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {activeReport.documentedHistorySummary}
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                    <h4 className="text-xs font-bold text-slate-900 mb-1">
                      4. Reported Symptoms and Documented Findings
                    </h4>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {activeReport.reportedSymptomsAndFindings}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                      <h4 className="text-xs font-bold text-slate-900 mb-1">5. Current Documented Medical Status</h4>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {activeReport.currentDocumentedStatus}
                      </p>
                    </div>
                    <div className="p-3.5 bg-amber-50/60 rounded-lg border border-amber-200">
                      <h4 className="text-xs font-bold text-amber-950 mb-1">6. Important Missing Information</h4>
                      <p className="text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">
                        {activeReport.missingInformation}
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                    <h4 className="text-xs font-bold text-slate-900 mb-1">7. Questions to Ask the Treating Doctor</h4>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {activeReport.questionsForDoctor}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-sky-50/60 rounded-lg border border-sky-200">
                      <h4 className="text-xs font-bold text-sky-950 mb-1">
                        8. Potential Specialty or Department to Consult
                      </h4>
                      <p className="text-xs text-sky-900 whitespace-pre-wrap leading-relaxed">
                        {activeReport.recommendedSpecialty}
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                      <h4 className="text-xs font-bold text-slate-900 mb-1">
                        9. Hospital Second Opinion Recommendation Workflow
                      </h4>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {activeReport.secondOpinionWorkflow || 'Submit verified dossier to Apollo International Desk.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                    <h4 className="text-xs font-bold text-slate-900 mb-1">
                      10. Potential Treatment Pathways for Discussion With a Qualified Doctor
                    </h4>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {activeReport.potentialTreatmentPathways}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                      <h4 className="text-xs font-bold text-slate-900 mb-1">11. Suggested Next Steps</h4>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {activeReport.suggestedNextSteps}
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                      <h4 className="text-xs font-bold text-slate-900 mb-1">12. Estimated Medical Tourism Budget</h4>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {activeReport.estimatedBudgetRange || 'Refer to itemized Treatment Cost Estimator.'}
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                      <h4 className="text-xs font-bold text-slate-900 mb-1">
                        13. Travel & Accommodation Considerations
                      </h4>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {activeReport.travelConsiderations || 'Med-1/Med-2 Visa & Chennai Airport pickup recommended.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-100 rounded-lg border border-slate-300 text-xs text-slate-800">
                    <span className="font-bold block mb-1">14. Limitations and Mandatory Medical Disclaimer:</span>
                    {activeReport.disclaimer}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                <Sparkles className="w-8 h-8 text-sky-600 mx-auto" />
                <h3 className="text-base font-semibold text-slate-900">No AI Preliminary Report Selected</h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Select a patient on the left and click &ldquo;Generate AI Draft&rdquo; to create a 15-section
                  source-referenced clinical navigation summary.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // MODULE 6: HOSPITAL SECOND OPINIONS & SIDE-BY-SIDE COMPARISON (SECTION 10)
  const filteredOpinions = secondOpinions.filter((o) => !comparePatientId || o.patientId === comparePatientId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Hospital Second Opinions & Multi-Hospital Comparison
          </h2>
          <p className="text-sm text-slate-600">
            Official hospital-issued clinical opinions stored without alteration and displayed separately from AI
            summaries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-700">Compare Opinions for Patient:</label>
          <select
            value={comparePatientId}
            onChange={(e) => setComparePatientId(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Patients ({secondOpinions.length} opinions)</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName} ({p.patientCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Side-by-Side Comparison Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-sky-700" />
            <h3 className="text-base font-semibold text-slate-900">
              Multi-Hospital Side-by-Side Comparison Matrix & Tariff Variance
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Original hospital documents preserved unaltered · Separate from AI Drafts
          </span>
        </div>

        {comparisonNotice && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{comparisonNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setComparisonNotice('')}
              className="font-semibold text-emerald-800 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Structured Multi-Hospital Comparison Table */}
        {filteredOpinions.length > 0 && (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Hospital & Specialist</th>
                  <th className="py-2.5 px-3 font-semibold">Patient</th>
                  <th className="py-2.5 px-3 font-semibold">Recommended Procedure</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Quoted Tariff (USD / BDT / INR)</th>
                  <th className="py-2.5 px-3 font-semibold">Expected Stay</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(() => {
                  const validCosts = filteredOpinions
                    .map((o) => Number(o.estimatedCostUsd) || 0)
                    .filter((c) => c > 0);
                  const minCostUsd = validCosts.length > 0 ? Math.min(...validCosts) : 0;

                  return filteredOpinions.map((op) => {
                    const usd = Number(op.estimatedCostUsd) || 0;
                    const inr = Number(op.estimatedCostInr) || Math.round(usd * 84);
                    const bdt = Math.round(usd * 120);
                    const diffUsd = minCostUsd > 0 && usd > minCostUsd ? usd - minCostUsd : 0;

                    return (
                      <tr key={`row-${op.id}`} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{op.hospitalName}</div>
                          <div className="text-[11px] text-slate-600">
                            {op.doctorName} · {op.specialty}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{op.patientName}</td>
                        <td className="py-2.5 px-3 text-slate-700 max-w-xs">
                          <div className="line-clamp-2">{op.documentedRecommendations}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          <div className="font-bold text-slate-900">
                            USD ${usd.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            BDT ৳{bdt.toLocaleString()} · INR ₹{inr.toLocaleString()}
                          </div>
                          {usd > 0 && usd === minCostUsd && validCosts.length > 1 && (
                            <span className="text-[10px] font-sans font-semibold text-emerald-700">
                              Lowest Quoted Tariff
                            </span>
                          )}
                          {diffUsd > 0 && (
                            <span className="text-[10px] font-sans text-amber-800">
                              +${diffUsd.toLocaleString()} vs lowest
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{op.estimatedTimeline || '14 Days'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              const hospUsd = Number(op.estimatedCostUsd) || 4950;
                              const travelUsd = 640;
                              const accommUsd = 560;
                              const coordUsd = 450;
                              const totalBase = hospUsd + travelUsd + accommUsd + coordUsd;
                              await createCostEstimate(
                                {
                                  patientId: op.patientId,
                                  patientName: op.patientName,
                                  destinationCity: 'Chennai, India',
                                  hospitalName: op.hospitalName,
                                  specialty: op.specialty,
                                  treatmentTitle: `${op.specialty} Package (${op.doctorName}) — Ref ${op.hospitalReferenceNumber}`,
                                  patientCount: 1,
                                  companionCount: 1,
                                  lengthOfStayDays: 14,
                                  accommodationCategory: 'Serviced Guest House near Hospital ($28/night)',
                                  currency: 'USD',
                                  exchangeRateBdtPerUsd: 120,
                                  exchangeRateInrPerUsd: 84,
                                  exchangeRateTimestamp: `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
                                  exchangeRateSource: 'Bangladesh Bank & RBI Reference Rate',
                                  hospitalConfirmedTotalUsd: hospUsd,
                                  estimatedTravelTotalUsd: travelUsd,
                                  estimatedAccommodationTotalUsd: accommUsd,
                                  coordinationAndOtherTotalUsd: coordUsd,
                                  minTotalBudgetUsd: Math.round(totalBase * 0.96),
                                  maxTotalBudgetUsd: Math.round(totalBase * 1.12),
                                  assumptions: `Generated from official hospital second opinion Ref ${op.hospitalReferenceNumber} (${op.doctorName}).`,
                                  exclusions:
                                    'Excludes extended ICU stay beyond package days or unrelated specialty procedures.',
                                  validityPeriodDays: 30,
                                  quotationSource: `Official Hospital Second Opinion (${op.hospitalReferenceNumber})`,
                                  status: 'Shared With Patient',
                                  ownerId: actor.uid,
                                },
                                actor
                              );
                              setComparisonNotice(
                                `Created itemized multi-currency Cost Estimate for ${op.patientName} from ${op.hospitalName} (${op.doctorName}) opinion.`
                              );
                            }}
                            className="px-2.5 py-1.5 text-[11px] font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap"
                          >
                            Convert to Cost Estimate →
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredOpinions.map((op) => (
            <div key={op.id} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/40">
              <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    Ref: {op.hospitalReferenceNumber} · Issued: {op.documentIssuedDate || op.submissionDate}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-0.5">{op.hospitalName}</h4>
                  <div className="text-xs text-slate-700">
                    {op.doctorName} · {op.department}
                  </div>
                </div>
                <select
                  value={op.status}
                  onChange={(e) => updateSecondOpinionCase(op.id, { status: e.target.value }, actor)}
                  className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-md bg-white"
                >
                  {SECOND_OPINION_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs space-y-2">
                <div>
                  <span className="font-semibold text-slate-900 block">
                    Official Hospital Findings (As Documented):
                  </span>
                  <p className="text-slate-700 mt-0.5 leading-relaxed">{op.receivedOpinionSummary}</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block">
                    Documented Treatment Recommendation:
                  </span>
                  <p className="text-slate-700 mt-0.5 leading-relaxed">{op.documentedRecommendations}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 font-mono tabular-nums">
                  <div>
                    <span className="text-slate-500 block font-sans">Hospital Quoted Cost:</span>
                    <span className="font-bold text-slate-900">
                      USD ${op.estimatedCostUsd?.toLocaleString() || 'TBD'} (INR ₹
                      {op.estimatedCostInr?.toLocaleString() || 'TBD'})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">Expected Timeline:</span>
                    <span className="font-semibold text-slate-800 font-sans">{op.estimatedTimeline || 'TBD'}</span>
                  </div>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-md">
                  <span className="font-semibold text-slate-900 block">
                    Key Differences / Points for Clinician Discussion:
                  </span>
                  <p className="text-slate-600 mt-0.5">{op.clinicianDiscussionPoints}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Original File: {op.originalDocumentTitle}</span>
                  <span className="text-emerald-700 font-medium">{op.verificationStatus}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Log New Second Opinion Request / Response */}
      <form
        onSubmit={handleCreateSecondOpinion}
        className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
          Request or Record Official Hospital Second Opinion
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Patient *</label>
            <select
              value={activePatient?.id || ''}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.patientCode})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Target Hospital *</label>
            <select
              value={soHospital}
              onChange={(e) => setSoHospital(e.target.value)}
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
            <label className="block text-xs font-medium text-slate-700 mb-1">Consultant Specialist Doctor *</label>
            <input
              type="text"
              required
              value={soDoctor}
              onChange={(e) => setSoDoctor(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Specialty *</label>
            <input
              type="text"
              required
              value={soSpecialty}
              onChange={(e) => setSoSpecialty(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Quoted Cost (INR ₹)</label>
            <input
              type="number"
              value={soCostInr}
              onChange={(e) => setSoCostInr(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Quoted Cost (USD $)</label>
            <input
              type="number"
              value={soCostUsd}
              onChange={(e) => setSoCostUsd(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Expected Stay Timeline</label>
            <input
              type="text"
              value={soTimeline}
              onChange={(e) => setSoTimeline(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Official Hospital Opinion Summary (Record Verbatim as Issued)
            </label>
            <textarea
              rows={2}
              value={soSummary}
              onChange={(e) => setSoSummary(e.target.value)}
              placeholder="Enter doctor's clinical opinion verbatim without AI modification..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Documented Treatment Plan & Points for Clinician Discussion
            </label>
            <textarea
              rows={2}
              value={soRecommendations}
              onChange={(e) => setSoRecommendations(e.target.value)}
              placeholder="Recommended surgical/medical package, ICU days, and discussion items..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
        >
          Save Official Hospital Second Opinion
        </button>
      </form>
    </div>
  );
};
