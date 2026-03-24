import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Helper to create a WAV header for raw PCM data (16-bit, mono, 24000Hz)
function createWavHeader(dataLength: number, sampleRate: number = 24000) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + dataLength, true); // File size
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // Chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataLength, true); // Data size
  return header;
}

export const generateQuizQuestion = async (topic: string, lang: string, level: number, mode: 'quiz' | 'study' = 'quiz', difficulty: 'easy' | 'hard' | 'advance' = 'easy') => {
  const languageText = lang === 'hi' ? 'Hindi' : 'English';
  const prompt = mode === 'quiz' 
    ? `Generate a tricky, conceptual multiple-choice question for a competitive exam about "${topic}". Difficulty level: ${difficulty} (User Level ${level}/10). Language: ${languageText}. Make options plausible. Ensure it is completely unique. Return the response in JSON format.`
    : `Generate a comprehensive educational multiple-choice question for learning about "${topic}". Focus on explaining a key concept at a ${difficulty} difficulty level. The explanation must be very detailed, covering the 'why' and 'how'. Language: ${languageText}. Return the response in JSON format.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          questionText: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          correctIndex: { type: "INTEGER" },
          explanation: { type: "STRING" }
        },
        required: ["questionText", "options", "correctIndex", "explanation"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text);
};

export const generateSpeech = async (text: string, lang: string, settings?: { voice: 'male' | 'female', rate: number }, retries = 2): Promise<string> => {
  if (!text || !text.trim()) throw new Error("Text is required for speech generation");
  
  // Truncate if too long (Gemini TTS has limits, typically around 3000-5000 chars)
  const truncatedText = text.slice(0, 3000);
  
  // Map male/female to Gemini voices
  let voiceName = lang === 'hi' ? 'Kore' : 'Zephyr'; 
  if (settings?.voice === 'male') {
    voiceName = lang === 'hi' ? 'Fenrir' : 'Puck';
  }
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: truncatedText }] }],
      config: {
        responseModalities: ["AUDIO"] as any,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated");

    // Convert base64 to Uint8Array
    const binaryString = atob(base64Audio);
    const pcmData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      pcmData[i] = binaryString.charCodeAt(i);
    }

    // Add WAV header
    const wavHeader = createWavHeader(pcmData.length);
    const wavData = new Uint8Array(wavHeader.byteLength + pcmData.length);
    wavData.set(new Uint8Array(wavHeader), 0);
    wavData.set(pcmData, wavHeader.byteLength);

    // Create Blob URL
    const blob = new Blob([wavData], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  } catch (err: any) {
    if (retries > 0 && err.message?.includes('500')) {
      console.warn("Retrying speech generation due to 500 error...");
      return generateSpeech(text, lang, settings, retries - 1);
    }
    throw err;
  }
};

export const getTutorResponse = async (message: string, lang: string, topic?: string) => {
  const languageText = lang === 'hi' ? 'Hindi' : 'English';
  const systemInstruction = `You are EduQuest AI, an expert tutor for competitive exams. 
  Provide helpful, concise, and encouraging explanations. 
  Respond in ${languageText}. 
  If a topic is provided (${topic}), focus on that.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: message }] }],
    config: {
      systemInstruction
    }
  });

  return response.text || "I'm sorry, I couldn't process that request.";
};

export const translateQuizQuestion = async (questionData: any, targetLang: string) => {
  const languageText = targetLang === 'hi' ? 'Hindi' : 'English';
  const prompt = `Translate the following quiz question data into ${languageText}. 
  Keep the same JSON structure. 
  Data: ${JSON.stringify(questionData)}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          questionText: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          correctIndex: { type: "INTEGER" },
          explanation: { type: "STRING" }
        },
        required: ["questionText", "options", "correctIndex", "explanation"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text);
};
