import React, { useState, useRef } from 'react';
import {
  MessageSquare,
  Mic,
  Square,
  Send,
  Sparkles,
  BookOpen,
  FlaskConical,
  Pill,
  ExternalLink,
  Search,
  AlertTriangle,
  Loader2,
  Trash2,
} from 'lucide-react';
import type { PatientRecord, LeadRecord, HospitalSecondOpinionRecord } from '../types/crm';

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
}

interface ClinicalTrialStudy {
  nctId: string;
  briefTitle: string;
  overallStatus: string;
  phases: string[];
  conditions: string[];
  interventions: string[];
  eligibilityCriteria: string;
  leadSponsor: string;
}

interface EuropePmcArticle {
  id: string;
  pmid?: string;
  doi?: string;
  title: string;
  authorString?: string;
  journalTitle?: string;
  pubYear?: string;
  citedByCount?: number;
  isOpenAccess?: string;
}

interface OpenFdaDrugLabel {
  brandName: string;
  genericName: string;
  indications: string;
  boxedWarning: string;
  warnings: string;
  adverseReactions: string;
}

interface ClinicalIntelligencePanelProps {
  patients: PatientRecord[];
  leads: LeadRecord[];
  secondOpinions: HospitalSecondOpinionRecord[];
}

export const ClinicalIntelligencePanel: React.FC<ClinicalIntelligencePanelProps> = ({
  patients,
  leads,
  secondOpinions,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'trials' | 'literature' | 'openfda'>('chat');

  // 1. Multi-Turn Gemini Chat State
  const [chatModel, setChatModel] = useState<string>('gemini-3.8-flash');
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0]?.id || '');
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      role: 'model',
      text: 'Hello! I am the QureWays Trip Clinical & Coordination AI Assistant. You can ask me about patient dossiers, Apollo Hospitals Chennai coordination steps, Med-1/Med-2 visa checklists, or dictate clinical notes using your microphone.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'gemini-3.8-flash',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Voice Recording / Audio Transcription State (gemini-3.5-transcribe)
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 2. ClinicalTrials.gov API v2 State
  const [trialCondition, setTrialCondition] = useState('Coronary Artery Bypass Grafting');
  const [trialIntervention, setTrialIntervention] = useState('');
  const [trialStatusFilter, setTrialStatusFilter] = useState('RECRUITING');
  const [trials, setTrials] = useState<ClinicalTrialStudy[]>([]);
  const [isSearchingTrials, setIsSearchingTrials] = useState(false);
  const [trialsError, setTrialsError] = useState('');
  const [expandedNctId, setExpandedNctId] = useState<string | null>(null);

  // 3. Europe PMC Literature Search State
  const [litQuery, setLitQuery] = useState('off-pump CABG diabetes outcomes');
  const [articles, setArticles] = useState<EuropePmcArticle[]>([]);
  const [isSearchingLit, setIsSearchingLit] = useState(false);
  const [litError, setLitError] = useState('');

  // 4. openFDA Pharmacovigilance State
  const [drugQuery, setDrugQuery] = useState('clopidogrel');
  const [drugLabels, setDrugLabels] = useState<OpenFdaDrugLabel[]>([]);
  const [isSearchingDrug, setIsSearchingDrug] = useState(false);
  const [drugError, setDrugError] = useState('');

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  // Voice recording handler using MediaRecorder + /api/ai/transcribe-audio (gemini-3.5-transcribe)
  const handleStartRecording = async () => {
    setTranscriptionError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        await transcribeAudioBlob(audioBlob, recorder.mimeType || 'audio/webm');
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setTranscriptionError(
        err instanceof Error
          ? `Microphone access failed: ${err.message}`
          : 'Unable to access microphone for voice transcription.'
      );
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudioBlob = async (blob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    try {
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const response = await fetch('/api/ai/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Audio,
          mimeType,
          languageHint: 'English or Bengali clinical coordination note',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Audio transcription failed');
      }

      if (data.transcript) {
        setChatInput((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript));
      }
    } catch (err) {
      setTranscriptionError(
        err instanceof Error ? err.message : 'Failed to transcribe voice note'
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSendingChat) return;

    const userText = chatInput.trim();
    setChatInput('');
    const newUserTurn: ChatTurn = {
      role: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...messages, newUserTurn];
    setMessages(updatedHistory);
    setIsSendingChat(true);

    try {
      const crmContext = selectedPatient
        ? `Selected Patient: ${selectedPatient.fullName} (${selectedPatient.patientCode}), ${selectedPatient.age}y ${selectedPatient.gender}, City: ${selectedPatient.city}, Preferred Hospital: ${selectedPatient.preferredHospital}, Journey Stage: ${selectedPatient.journeyStage}. Diagnoses: ${selectedPatient.existingDiagnoses}. Medical History: ${selectedPatient.medicalHistorySummary}. Active Leads in CRM: ${leads.length}.`
        : `Total Leads in CRM: ${leads.length}, Total Patients: ${patients.length}, Hospital Second Opinions: ${secondOpinions.length}.`;

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedHistory.map((m) => ({ role: m.role, text: m.text })),
          model: chatModel,
          crmContext,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gemini chat request failed');
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: data.modelUsed || chatModel,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: `Error: ${err instanceof Error ? err.message : 'Unable to reach Gemini assistant'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: chatModel,
        },
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Search ClinicalTrials.gov REST API v2
  const handleSearchClinicalTrials = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!trialCondition.trim()) return;
    setIsSearchingTrials(true);
    setTrialsError('');
    try {
      const params = new URLSearchParams({
        'query.cond': trialCondition.trim(),
        pageSize: '6',
      });
      if (trialIntervention.trim()) {
        params.set('query.intr', trialIntervention.trim());
      }
      if (trialStatusFilter !== 'ALL') {
        params.set('filter.overallStatus', trialStatusFilter);
      }

      const res = await fetch(`https://clinicaltrials.gov/api/v2/studies?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`ClinicalTrials.gov API returned HTTP ${res.status}`);
      }
      const data = await res.json();
      const studiesRaw = Array.isArray(data.studies) ? data.studies : [];

      const parsed: ClinicalTrialStudy[] = studiesRaw.map((st: Record<string, any>) => {
        const proto = st.protocolSection || {};
        const idMod = proto.identificationModule || {};
        const statusMod = proto.statusModule || {};
        const designMod = proto.designModule || {};
        const condMod = proto.conditionsModule || {};
        const armsMod = proto.armsInterventionsModule || {};
        const eligMod = proto.eligibilityModule || {};
        const sponsorMod = proto.sponsorCollaboratorsModule || {};

        return {
          nctId: idMod.nctId || 'NCT-UNKNOWN',
          briefTitle: idMod.briefTitle || 'Untitled Clinical Study',
          overallStatus: statusMod.overallStatus || 'UNKNOWN',
          phases: Array.isArray(designMod.phases) ? designMod.phases : ['Not Applicable'],
          conditions: Array.isArray(condMod.conditions) ? condMod.conditions : [],
          interventions: Array.isArray(armsMod.interventions)
            ? armsMod.interventions.map((i: Record<string, any>) => `${i.type || 'Intervention'}: ${i.name || ''}`)
            : [],
          eligibilityCriteria: eligMod.eligibilityCriteria || 'No eligibility criteria listed.',
          leadSponsor: sponsorMod.leadSponsor?.name || 'Clinical Sponsor',
        };
      });

      setTrials(parsed);
    } catch (err) {
      setTrialsError(err instanceof Error ? err.message : 'Failed to query ClinicalTrials.gov');
    } finally {
      setIsSearchingTrials(false);
    }
  };

  // Search Europe PMC Biomedical Literature API
  const handleSearchLiterature = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!litQuery.trim()) return;
    setIsSearchingLit(true);
    setLitError('');
    try {
      const encoded = encodeURIComponent(litQuery.trim());
      const res = await fetch(
        `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encoded}&format=json&pageSize=6&resultType=core`
      );
      if (!res.ok) {
        throw new Error(`Europe PMC API returned HTTP ${res.status}`);
      }
      const data = await res.json();
      const list = data?.resultList?.result || [];
      setArticles(list);
    } catch (err) {
      setLitError(err instanceof Error ? err.message : 'Failed to query Europe PMC');
    } finally {
      setIsSearchingLit(false);
    }
  };

  // Search openFDA Drug Labeling API
  const handleSearchOpenFda = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!drugQuery.trim()) return;
    setIsSearchingDrug(true);
    setDrugError('');
    try {
      const clean = encodeURIComponent(drugQuery.trim());
      const res = await fetch(
        `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${clean}"+openfda.brand_name:"${clean}"&limit=3`
      );
      if (!res.ok) {
        throw new Error(`openFDA API returned HTTP ${res.status}`);
      }
      const data = await res.json();
      const results = Array.isArray(data.results) ? data.results : [];
      const parsed: OpenFdaDrugLabel[] = results.map((item: Record<string, any>) => ({
        brandName: item.openfda?.brand_name?.[0] || drugQuery.toUpperCase(),
        genericName: item.openfda?.generic_name?.[0] || drugQuery,
        indications: (item.indications_and_usage?.[0] || 'Not specified in label.').slice(0, 650),
        boxedWarning: (item.boxed_warning?.[0] || 'No boxed warning listed.').slice(0, 500),
        warnings: (item.warnings?.[0] || item.warnings_and_cautions?.[0] || 'Standard clinical precautions apply.').slice(0, 500),
        adverseReactions: (item.adverse_reactions?.[0] || 'See full prescribing information.').slice(0, 500),
      }));
      setDrugLabels(parsed);
    } catch (err) {
      setDrugError(
        err instanceof Error ? err.message : 'No FDA drug label found for the specified query'
      );
    } finally {
      setIsSearchingDrug(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-700" />
            <h2 className="text-base font-bold text-slate-900">
              AI Clinical Intelligence, Voice Transcription & Biomedical Evidence Hub
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Multi-turn Gemini clinical assistant with voice dictation (gemini-3.5-transcribe) and live ClinicalTrials.gov, Europe PMC, and openFDA verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'chat'
                ? 'bg-sky-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Gemini Assistant & Voice</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('trials');
              if (trials.length === 0) handleSearchClinicalTrials();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'trials'
                ? 'bg-sky-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>ClinicalTrials.gov</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('literature');
              if (articles.length === 0) handleSearchLiterature();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'literature'
                ? 'bg-sky-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Europe PMC Literature</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('openfda');
              if (drugLabels.length === 0) handleSearchOpenFda();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'openfda'
                ? 'bg-sky-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            <span>openFDA Drug Safety</span>
          </button>
        </div>
      </div>

      {/* TAB 1: GEMINI CHATBOT + VOICE TRANSCRIPTION */}
      {activeTab === 'chat' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 font-medium text-slate-700">
                <span>Patient Context:</span>
                <select
                  value={selectedPatient?.id || ''}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="px-2.5 py-1 border border-slate-300 rounded-md bg-white text-slate-900 font-semibold"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.patientCode})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-1.5 font-medium text-slate-700">
                <span>AI Model:</span>
                <select
                  value={chatModel}
                  onChange={(e) => setChatModel(e.target.value)}
                  className="px-2.5 py-1 border border-slate-300 rounded-md bg-white text-slate-900 font-mono text-xs"
                >
                  <option value="gemini-3.8-flash">gemini-3.8-flash (Balanced Clinical)</option>
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast Low-Latency)</option>
                  <option value="gemini-4-argon">gemini-4-argon (Deep Reasoning)</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={() =>
                setMessages([
                  {
                    role: 'model',
                    text: 'Conversation reset. Select a patient context or dictate a clinical coordination query below.',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    modelUsed: chatModel,
                  },
                ])
              }
              className="flex items-center gap-1 text-slate-600 hover:text-slate-900"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Chat</span>
            </button>
          </div>

          <div className="h-64 overflow-y-auto border border-slate-200 rounded-lg p-3.5 space-y-3 bg-slate-50/50">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-2xl rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-sky-700 text-white'
                      : 'bg-white border border-slate-200 text-slate-800'
                  }`}
                >
                  {m.text}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">
                  {m.role === 'user' ? 'Coordinator' : `AI (${m.modelUsed || 'gemini'})`} · {m.timestamp}
                </div>
              </div>
            ))}
            {isSendingChat && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-700" />
                <span>Generating response with {chatModel}...</span>
              </div>
            )}
          </div>

          {transcriptionError && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
              <span>{transcriptionError}</span>
            </div>
          )}

          <form onSubmit={handleSendChat} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <button
              type="button"
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              disabled={isTranscribing}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                isRecording
                  ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Record audio and transcribe with gemini-3.5-transcribe"
            >
              {isTranscribing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-700" />
                  <span>Transcribing (gemini-3.5-transcribe)...</span>
                </>
              ) : isRecording ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Recording</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-sky-700" />
                  <span>Dictate Voice Note</span>
                </>
              )}
            </button>

            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about patient lab trends, Apollo Chennai pre-travel checklist, or dictate voice..."
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            />

            <button
              type="submit"
              disabled={isSendingChat || !chatInput.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: CLINICALTRIALS.GOV API V2 */}
      {activeTab === 'trials' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <span className="font-semibold text-slate-800">
              Global Clinical Trial Registry Search (Reference Evidence for Complex Second Opinions)
            </span>
            <span className="font-mono text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              Source: ClinicalTrials.gov API v2 · Live
            </span>
          </div>

          <form onSubmit={handleSearchClinicalTrials} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <input
              type="text"
              value={trialCondition}
              onChange={(e) => setTrialCondition(e.target.value)}
              placeholder="Condition (e.g., Coronary Artery Disease)"
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              value={trialIntervention}
              onChange={(e) => setTrialIntervention(e.target.value)}
              placeholder="Intervention (optional, e.g., CABG, Stent)"
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <select
              value={trialStatusFilter}
              onChange={(e) => setTrialStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="RECRUITING">Recruiting Only</option>
              <option value="COMPLETED">Completed</option>
              <option value="ACTIVE_NOT_RECRUITING">Active, Not Recruiting</option>
              <option value="ALL">All Statuses</option>
            </select>
            <button
              type="submit"
              disabled={isSearchingTrials}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isSearchingTrials ? 'Querying Registry...' : 'Search ClinicalTrials.gov'}</span>
            </button>
          </form>

          {trialsError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              {trialsError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {trials.map((t) => (
              <div key={t.nctId} className="p-3.5 border border-slate-200 rounded-lg space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={`https://clinicaltrials.gov/study/${t.nctId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono font-bold text-sky-700 hover:underline flex items-center gap-1"
                  >
                    <span>{t.nctId}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                    {t.overallStatus} · {t.phases.join(', ')}
                  </span>
                </div>
                <div className="font-bold text-slate-900 leading-snug">{t.briefTitle}</div>
                <div className="text-slate-600">
                  <strong>Sponsor:</strong> {t.leadSponsor}
                </div>
                {t.interventions.length > 0 && (
                  <div className="text-slate-600">
                    <strong>Interventions:</strong> {t.interventions.slice(0, 3).join('; ')}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setExpandedNctId(expandedNctId === t.nctId ? null : t.nctId)}
                  className="text-sky-700 font-medium hover:underline"
                >
                  {expandedNctId === t.nctId ? 'Hide Eligibility Criteria' : 'Inspect Eligibility Criteria'}
                </button>
                {expandedNctId === t.nctId && (
                  <pre className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700 whitespace-pre-wrap max-h-40 overflow-y-auto font-sans">
                    {t.eligibilityCriteria}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: EUROPE PMC BIOMEDICAL LITERATURE */}
      {activeTab === 'literature' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <span className="font-semibold text-slate-800">
              Peer-Reviewed Biomedical Literature & Clinical Guidelines (Europe PMC / PubMed)
            </span>
            <span className="font-mono text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              Source: Europe PMC REST API · Live
            </span>
          </div>

          <form onSubmit={handleSearchLiterature} className="flex gap-2">
            <input
              type="text"
              value={litQuery}
              onChange={(e) => setLitQuery(e.target.value)}
              placeholder="Search PubMed / Europe PMC clinical literature..."
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <button
              type="submit"
              disabled={isSearchingLit}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isSearchingLit ? 'Searching...' : 'Search Literature'}</span>
            </button>
          </form>

          {litError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              {litError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {articles.map((art) => (
              <div key={art.id} className="p-3.5 border border-slate-200 rounded-lg space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>
                    {art.journalTitle || 'Biomedical Journal'} ({art.pubYear || 'N/A'})
                  </span>
                  <span>Cited by: {art.citedByCount ?? 0}</span>
                </div>
                <div className="font-bold text-slate-900 leading-snug">{art.title}</div>
                {art.authorString && (
                  <div className="text-slate-600 truncate">{art.authorString}</div>
                )}
                <div className="flex items-center gap-3 pt-1">
                  {art.pmid && (
                    <a
                      href={`https://pubmed.ncbi.nlm.nih.gov/${art.pmid}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-sky-700 hover:underline flex items-center gap-1"
                    >
                      <span>PMID: {art.pmid}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {art.doi && (
                    <a
                      href={`https://doi.org/${art.doi}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-slate-600 hover:underline flex items-center gap-1"
                    >
                      <span>DOI: {art.doi}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: OPENFDA DRUG SAFETY & LABELING */}
      {activeTab === 'openfda' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <span className="font-semibold text-slate-800">
              openFDA Drug Labeling, Indications & Peri-Operative Medication Warnings
            </span>
            <span className="font-mono text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              Source: openFDA Drug Label API · Live
            </span>
          </div>

          <form onSubmit={handleSearchOpenFda} className="flex gap-2">
            <input
              type="text"
              value={drugQuery}
              onChange={(e) => setDrugQuery(e.target.value)}
              placeholder="Enter generic or brand drug name (e.g., clopidogrel, ticagrelor, metformin)..."
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <button
              type="submit"
              disabled={isSearchingDrug}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isSearchingDrug ? 'Checking FDA...' : 'Inspect Drug Label'}</span>
            </button>
          </form>

          {drugError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              {drugError}
            </div>
          )}

          <div className="space-y-3">
            {drugLabels.map((d, index) => (
              <div key={index} className="p-4 border border-slate-200 rounded-lg space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-sm font-bold text-slate-900">
                    {d.brandName} ({d.genericName})
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">FDA Approved Prescribing Info</span>
                </div>
                {d.boxedWarning && d.boxedWarning !== 'No boxed warning listed.' && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-900">
                    <strong>Boxed Warning:</strong> {d.boxedWarning}
                  </div>
                )}
                <div>
                  <strong className="text-slate-900">Indications & Usage:</strong>{' '}
                  <span className="text-slate-700">{d.indications}</span>
                </div>
                <div>
                  <strong className="text-slate-900">Warnings & Precautions:</strong>{' '}
                  <span className="text-slate-700">{d.warnings}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
