import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MANDATORY_MEDICAL_DISCLAIMER =
  'This report is an AI-assisted informational summary based on the medical documents and information provided. It is not a definitive diagnosis, a substitute for an examination by a qualified medical professional, or a guarantee of treatment suitability or outcome. All clinical interpretations and treatment decisions must be reviewed and confirmed by an appropriately qualified healthcare professional. Medical records may be incomplete or inaccurate. Do not delay urgent medical care while awaiting this report.';

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  // Health & integration status endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'QureWays Trip Medical Tourism CRM API',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      timestamp: new Date().toISOString(),
    });
  });

  // 1. OCR & Medical Document Extraction Endpoint
  app.post('/api/ai/extract-document', async (req: Request, res: Response) => {
    try {
      const { title, category, fileName, rawNotes, fileBase64, mimeType } = req.body || {};

      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        res.status(503).json({
          error: 'Gemini API key is not configured on the server. Please check Settings > Secrets.',
        });
        return;
      }

      const ai = getGenAIClient();
      const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];

      if (fileBase64 && mimeType && (mimeType.startsWith('image/') || mimeType === 'application/pdf')) {
        parts.push({
          inlineData: {
            data: fileBase64,
            mimeType,
          },
        });
      }

      parts.push({
        text: `You are a clinical document verification and OCR extraction assistant for QureWays Trip Medical Tourism CRM.
Document Title: ${title || 'Untitled Medical Document'}
Category: ${category || 'Clinical Document'}
File Name: ${fileName || 'uploaded_file'}
Coordinator / Provided Clinical Text:
${rawNotes || 'No manual text provided. Extract from attached file if present.'}

Instructions:
1. Extract factual clinical observations, dates, test values, medications, or hospital notes strictly from the provided input.
2. Never fabricate clinical findings, lab results, or diagnoses.
3. If the input is too brief, incomplete, or unreadable, set isReadableAndComplete to false and explain what clearer copies or missing pages are needed in completenessFollowUpPrompt.
4. Provide source references indicating which part of the document each extracted fact came from.`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              extractedText: {
                type: Type.STRING,
                description: 'Structured factual clinical text extracted from the document with source tags.',
              },
              isReadableAndComplete: {
                type: Type.BOOLEAN,
                description: 'True if the document has sufficient readable clinical detail; false if blurry, incomplete, or missing key pages.',
              },
              recommendedReviewStatus: {
                type: Type.STRING,
                description: 'Either Verified, Pending Review, or Incomplete/Unreadable',
              },
              completenessFollowUpPrompt: {
                type: Type.STRING,
                description: 'Specific message asking the patient or coordinator for clearer copies or missing details if incomplete.',
              },
            },
            required: [
              'extractedText',
              'isReadableAndComplete',
              'recommendedReviewStatus',
              'completenessFollowUpPrompt',
            ],
          },
        },
      });

      const jsonText = response.text?.trim() || '{}';
      const parsed = JSON.parse(jsonText);
      res.json(parsed);
    } catch (error: unknown) {
      console.error('Error in /api/ai/extract-document:', error);
      const message = error instanceof Error ? error.message : 'Failed to extract document data via Gemini API';
      res.status(500).json({ error: message });
    }
  });

  // 2. AI-Assisted Preliminary Medical Report Generation Endpoint (Section 9)
  app.post('/api/ai/preliminary-report', async (req: Request, res: Response) => {
    try {
      const {
        patientName,
        age,
        gender,
        country,
        city,
        reportedSymptoms,
        existingDiagnoses,
        previousTreatments,
        preferredHospital,
        preferredDestination,
        currencyPreference,
        documents,
      } = req.body || {};

      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        res.status(503).json({
          error: 'Gemini API key is not configured on the server. Please check Settings > Secrets.',
        });
        return;
      }

      const ai = getGenAIClient();

      const docsContext = Array.isArray(documents) && documents.length > 0
        ? documents
            .map(
              (d: { title?: string; category?: string; fileName?: string; extractedText?: string; createdAt?: string }, idx: number) =>
                `[Doc #${idx + 1}: "${d.title || d.fileName}" | Category: ${d.category} | Date: ${d.createdAt || 'N/A'}]\nExtracted Content: ${d.extractedText || 'No text extracted'}`
            )
            .join('\n\n')
        : 'No uploaded clinical documents linked yet. Rely only on patient-reported intake and flag missing diagnostic documents.';

      const prompt = `You are the AI Medical Report Assistant for QureWays Trip (International Patient Coordination from Bangladesh to Apollo Hospitals, Chennai, India and verified international hospitals).
You are a clinical-support and patient-navigation tool, NOT an autonomous doctor.

STRICT SAFETY & CLINICAL RULES:
1. Clearly distinguish among:
   - [Documented Fact]: Facts explicitly documented in the patient's uploaded records (cite [Doc #N]).
   - [Patient-Reported]: Information reported verbally/textually by the patient.
   - [AI Summary]: Informational synthesis for navigation.
   - [Clinician Assessment Required]: Items requiring evaluation by a qualified specialist doctor.
2. Do NOT claim to establish a definitive diagnosis or determine actual current clinical condition.
3. Do NOT prescribe medication, change dosages, recommend stopping prescribed treatment, or independently determine medical necessity.
4. Do NOT fabricate test results, diagnoses, hospital prices, or success rates.
5. Check if any emergency warning signs are reported (e.g., acute chest pain, severe shortness of breath, active hemorrhage, stroke symptoms, unstable vitals, loss of consciousness). If so, set emergencyWarningDetected = true and instruct immediate local emergency medical assessment in Bangladesh before any travel planning.

PATIENT CASE INPUT:
- Patient Name: ${patientName || 'Unnamed Patient'}
- Age / Gender: ${age || 'Not specified'} / ${gender || 'Not specified'}
- Origin: ${city || 'Dhaka'}, ${country || 'Bangladesh'}
- Preferred Hospital: ${preferredHospital || 'Apollo Hospitals, Greams Road, Chennai'}
- Preferred Destination: ${preferredDestination || 'Chennai, India'}
- Currency Preference: ${currencyPreference || 'USD / BDT / INR'}
- Patient-Reported Symptoms: ${reportedSymptoms || 'None reported'}
- Existing Documented Diagnoses: ${existingDiagnoses || 'None documented'}
- Previous Treatment History: ${previousTreatments || 'None documented'}

REVIEWED SOURCE DOCUMENTS:
${docsContext}

Generate a comprehensive, structured 15-part Preliminary Medical Report in JSON format.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sourceDocumentsSummary: {
                type: Type.STRING,
                description: 'Sections 2 & 15: Itemized list of documents reviewed with explicit source reference tags [Doc #1, etc.].',
              },
              documentedHistorySummary: {
                type: Type.STRING,
                description: 'Section 3: Summary of available medical history clearly separating [Documented Fact] vs [Patient-Reported].',
              },
              reportedSymptomsAndFindings: {
                type: Type.STRING,
                description: 'Section 4: Reported symptoms and documented clinical/laboratory/imaging findings with source references.',
              },
              currentDocumentedStatus: {
                type: Type.STRING,
                description: 'Section 5: Current documented medical status without claiming a definitive new AI diagnosis.',
              },
              missingInformation: {
                type: Type.STRING,
                description: 'Section 6: Important missing clinical information, investigations, or clearer reports needed before specialist confirmation.',
              },
              questionsForDoctor: {
                type: Type.STRING,
                description: 'Section 7: Specific, practical questions for the patient and coordinator to ask the treating specialist doctor.',
              },
              recommendedSpecialty: {
                type: Type.STRING,
                description: 'Section 8: Potential specialty or hospital department to consult (e.g., Apollo Heart Institute / Medical Oncology / Hepatobiliary Surgery).',
              },
              secondOpinionWorkflow: {
                type: Type.STRING,
                description: 'Section 9: Step-by-step Hospital Second Opinion Recommendation Workflow for Apollo Hospitals Chennai or partner center.',
              },
              potentialTreatmentPathways: {
                type: Type.STRING,
                description: 'Section 10: Potential treatment pathways strictly framed for discussion with a qualified doctor [Clinician Assessment Required].',
              },
              suggestedNextSteps: {
                type: Type.STRING,
                description: 'Section 11: Suggested next coordination steps for the QureWays Trip team and patient.',
              },
              estimatedBudgetRange: {
                type: Type.STRING,
                description: 'Section 12: Indicative planning guidance in USD/INR/BDT clearly labeled as requiring official hospital quotation.',
              },
              travelConsiderations: {
                type: Type.STRING,
                description: 'Section 13: Medical visa (Med-1/Med-2), fitness-to-fly, companion, and Chennai accommodation considerations.',
              },
              emergencyWarningDetected: {
                type: Type.BOOLEAN,
                description: 'True if red-flag emergency symptoms are present requiring urgent local emergency care.',
              },
              emergencyWarningText: {
                type: Type.STRING,
                description: 'Urgent warning directing patient to immediate local medical care in Bangladesh if emergency signs are present, or standard safety note.',
              },
            },
            required: [
              'sourceDocumentsSummary',
              'documentedHistorySummary',
              'reportedSymptomsAndFindings',
              'currentDocumentedStatus',
              'missingInformation',
              'questionsForDoctor',
              'recommendedSpecialty',
              'secondOpinionWorkflow',
              'potentialTreatmentPathways',
              'suggestedNextSteps',
              'estimatedBudgetRange',
              'travelConsiderations',
              'emergencyWarningDetected',
              'emergencyWarningText',
            ],
          },
        },
      });

      const rawJson = response.text?.trim() || '{}';
      const parsed = JSON.parse(rawJson);

      res.json({
        ...parsed,
        disclaimer: MANDATORY_MEDICAL_DISCLAIMER,
        reviewStatus: 'DRAFT — NOT CLINICIAN-APPROVED',
        modelVersion: 'gemini-3.8-flash',
        generatedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      console.error('Error in /api/ai/preliminary-report:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate AI preliminary report';
      res.status(500).json({ error: message });
    }
  });

  // 3. Audio Transcription Endpoint using gemini-3.5-transcribe
  app.post('/api/ai/transcribe-audio', async (req: Request, res: Response) => {
    try {
      const { base64Audio, mimeType } = req.body || {};
      if (!base64Audio) {
        res.status(400).json({ error: 'Missing base64Audio payload' });
        return;
      }

      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        res.status(503).json({
          error: 'Gemini API key is not configured on the server. Please check Settings > Secrets.',
        });
        return;
      }

      const ai = getGenAIClient();
      const audioPart = {
        inlineData: {
          mimeType: mimeType || 'audio/webm',
          data: base64Audio,
        },
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            audioPart,
            {
              text: 'Transcribe this clinical or medical tourism coordination audio accurately into clean text.',
            },
          ],
        },
      });

      res.json({
        transcript: response.text?.trim() || '',
        model: 'gemini-3.5-transcribe',
      });
    } catch (error: unknown) {
      console.error('Error in /api/ai/transcribe-audio:', error);
      const message = error instanceof Error ? error.message : 'Failed to transcribe audio';
      res.status(500).json({ error: message });
    }
  });

  // 4. Multi-Turn Gemini Chatbot Endpoint (gemini-3.8-flash / gemini-3.1-flash-lite / gemini-4-argon)
  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    try {
      const { messages, model, rolePersona, crmContextSummary } = req.body || {};

      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        res.status(503).json({
          error: 'Gemini API key is not configured on the server. Please check Settings > Secrets.',
        });
        return;
      }

      const allowedModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-4-argon'];
      const selectedModel = allowedModels.includes(model) ? model : 'gemini-3.8-flash';

      const personaInstructions: Record<string, string> = {
        coordinator:
          'You are the Senior International Patient Coordinator Assistant for QureWays Trip (Bangladesh to Apollo Hospitals, Chennai, India). Help staff draft follow-up messages, structure clinical case dossiers, compare hospital second opinions, and coordinate appointments without claiming autonomous medical authority.',
        visa_travel:
          'You are the Medical Visa (Med-1 / Med-2) & Travel Logistics Specialist for QureWays Trip. Guide staff and patients on Indian Medical Visa invitation letter requirements, IVAC Bangladesh document checklists, Dhaka-to-Chennai flight transfers, and Greams Road / Taramani accommodation planning. Never guarantee visa issuance.',
        clinical_prep:
          'You are the Clinical Dossier & Second Opinion Preparation Assistant for QureWays Trip. Help coordinators identify missing diagnostic investigations, prepare questions for Apollo Chennai specialists, and summarize clinical timelines with strict adherence to medical disclaimers.',
      };

      const systemInstruction = `${
        personaInstructions[rolePersona] || personaInstructions.coordinator
      }\n\nIMPORTANT SAFETY RULE: Always distinguish documented facts from patient-reported symptoms. Never prescribe medications or diagnose conditions. Active CRM Context: ${
        crmContextSummary || 'QureWays Trip CRM Workspace'
      }`;

      const formattedContents = Array.isArray(messages)
        ? messages.map((m: { role: string; text: string }) => ({
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{ text: String(m.text || '') }],
          }))
        : [{ role: 'user', parts: [{ text: 'Hello' }] }];

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: formattedContents,
        config: {
          systemInstruction,
        },
      });

      res.json({
        reply: response.text || 'No response generated.',
        modelUsed: selectedModel,
      });
    } catch (error: unknown) {
      console.error('Error in /api/ai/chat:', error);
      const message = error instanceof Error ? error.message : 'Failed to process Gemini chat request';
      res.status(500).json({ error: message });
    }
  });

  // 5. Bilingual Bengali (বাংলা) Patient Summary Translator Endpoint (Item 4)
  app.post('/api/ai/translate-bengali-report', async (req: Request, res: Response) => {
    try {
      const {
        patientName,
        hospitalName,
        documentedHistorySummary,
        questionsForDoctor,
        suggestedNextSteps,
        travelConsiderations,
      } = req.body || {};

      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        res.status(503).json({
          error: 'Gemini API key is not configured on the server.',
        });
        return;
      }

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Translate and explain the following clinical navigation report into clear, compassionate, medically accurate Bengali (বাংলা) for Bangladeshi patient "${
          patientName || 'Patient'
        }" preparing for evaluation at "${hospitalName || 'Apollo Hospitals, Chennai'}".
Include:
1. সংক্ষিপ্ত চিকিৎসা ইতিহাস ও বর্তমান অবস্থা (Documented Clinical Summary in Bengali)
2. চেন্নাইয়ের বিশেষজ্ঞ ডাক্তারের কাছে গুরুত্বপূর্ণ প্রশ্নসমূহ (Key Questions for the Specialist in Bengali)
3. পরবর্তী করণীয় ও ভ্রমণ প্রস্তুতি (Suggested Next Steps & Travel Preparation in Bengali)
4. বাধ্যতামূলক চিকিৎসা সতর্কীকরণ (Mandatory Medical Disclaimer in Bengali)

Source Clinical Summary: ${documentedHistorySummary || ''}
Questions for Doctor: ${questionsForDoctor || ''}
Suggested Next Steps: ${suggestedNextSteps || ''}
Travel Considerations: ${travelConsiderations || ''}`,
      });

      res.json({
        bengaliSummary: response.text?.trim() || '',
        modelUsed: 'gemini-3.8-flash',
      });
    } catch (error: unknown) {
      console.error('Error in /api/ai/translate-bengali-report:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to generate Bengali summary';
      res.status(500).json({ error: message });
    }
  });

  // 6. AI Flight Ticket Reader & Airport Pickup Extractor Endpoint (Step 4 Optional Self-Service)
  app.post('/api/ai/parse-flight-ticket', async (req: Request, res: Response) => {
    try {
      const { fileBase64, mimeType, fileName, rawTicketText, patientName } = req.body || {};

      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        res.status(503).json({
          error: 'Gemini API key is not configured on the server. Please check Settings > Secrets.',
        });
        return;
      }

      const ai = getGenAIClient();
      const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];

      if (fileBase64 && mimeType && (mimeType.startsWith('image/') || mimeType === 'application/pdf')) {
        parts.push({
          inlineData: {
            data: fileBase64,
            mimeType,
          },
        });
      }

      parts.push({
        text: `You are an AI Flight Ticket & Travel Logistics Reader for QureWays Trip Medical Tourism CRM (assisting Bangladeshi patients traveling from Dhaka/Chattogram/Kolkata to Chennai International Airport - MAA, India for treatment at Apollo Hospitals).

Patient Name: ${patientName || 'Patient'}
Attached File Name: ${fileName || 'flight_ticket'}
Provided Ticket / PNR / Itinerary Text:
${rawTicketText || 'Extract details directly from the attached ticket image/PDF.'}

Instructions:
1. Read the flight ticket image, PDF, or text carefully and extract:
   - flightDate: Departure flight date in YYYY-MM-DD format.
   - flightNumber: Flight number (e.g., "BS-205", "BG-363", "6E-1859", "AI-274").
   - airlineName: Airline name with route summary (e.g., "US-Bangla Airlines (BS-205 Dhaka → Chennai)").
   - chennaiArrivalDate: Date of arrival at Chennai (MAA) in YYYY-MM-DD format.
   - chennaiArrivalTime: Time of arrival at Chennai (e.g., "12:45 IST" or "14:20 IST").
   - pnrOrTicketNumber: PNR or E-Ticket reference number if visible.
   - passengerCount: Passenger count matching one of: "1 (Patient Only)", "2 (Patient + 1 Attendant)", or "3 (Patient + 2 Attendants)".
   - passengerNames: Names of passengers listed on the ticket.
   - wheelchairRequired: Boolean (true if ticket mentions WCHR, WCHS, WCHC, Wheelchair, Special Assistance, Mobility Support, Elderly/Medical Passenger needing wheelchair, or false if none mentioned).
   - mobilitySupportOption: Must be one of:
     * "Wheelchair Assistance + AC SUV" (if wheelchairRequired is true)
     * "Apollo ACLS Stretcher Ambulance at Airport" (if stretcher / MEDA is mentioned)
     * "Standard AC Sedan / SUV Pickup" (if no wheelchair or stretcher is mentioned)
   - summaryBn: A clear, reassuring Bengali (বাংলা) summary of the extracted ticket details and the airport pickup + wheelchair arrangement being prepared at Chennai Airport (MAA).
   - summaryEn: A clear English summary of the extracted ticket details and Chennai Airport (MAA) pickup arrangement.`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              flightDate: {
                type: Type.STRING,
                description: 'Flight departure date in YYYY-MM-DD format.',
              },
              flightNumber: {
                type: Type.STRING,
                description: 'Extracted flight number such as BS-205, BG-363, 6E-1859.',
              },
              airlineName: {
                type: Type.STRING,
                description: 'Full airline name and route.',
              },
              chennaiArrivalDate: {
                type: Type.STRING,
                description: 'Arrival date in Chennai (MAA) in YYYY-MM-DD format.',
              },
              chennaiArrivalTime: {
                type: Type.STRING,
                description: 'Arrival time in Chennai (MAA), e.g., 12:45 IST.',
              },
              pnrOrTicketNumber: {
                type: Type.STRING,
                description: 'Booking PNR or E-Ticket number.',
              },
              passengerCount: {
                type: Type.STRING,
                description: 'One of: "1 (Patient Only)", "2 (Patient + 1 Attendant)", "3 (Patient + 2 Attendants)".',
              },
              passengerNames: {
                type: Type.STRING,
                description: 'Names of passengers found on the ticket.',
              },
              wheelchairRequired: {
                type: Type.BOOLEAN,
                description: 'True if wheelchair assistance (WCHR/WCHS/WCHC/Wheelchair) is indicated or requested.',
              },
              mobilitySupportOption: {
                type: Type.STRING,
                description: 'One of: "Standard AC Sedan / SUV Pickup", "Wheelchair Assistance + AC SUV", "Apollo ACLS Stretcher Ambulance at Airport".',
              },
              summaryBn: {
                type: Type.STRING,
                description: 'Bengali summary of extracted flight details and airport pickup action.',
              },
              summaryEn: {
                type: Type.STRING,
                description: 'English summary of extracted flight details and airport pickup action.',
              },
            },
            required: [
              'flightDate',
              'flightNumber',
              'airlineName',
              'chennaiArrivalDate',
              'chennaiArrivalTime',
              'pnrOrTicketNumber',
              'passengerCount',
              'passengerNames',
              'wheelchairRequired',
              'mobilitySupportOption',
              'summaryBn',
              'summaryEn',
            ],
          },
        },
      });

      const rawJson = response.text?.trim() || '{}';
      const parsed = JSON.parse(rawJson);
      res.json(parsed);
    } catch (error: unknown) {
      console.error('Error in /api/ai/parse-flight-ticket:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to parse flight ticket via Gemini AI';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QureWays Trip CRM Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
