import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Clock,
  FileAudio,
  Loader2,
  Mic,
  Play,
  Square,
  Trash2,
  Volume2,
  Wand2,
} from 'lucide-react';
import { SPEAKING_LESSONS } from '../data/lessons';
import { useApp } from '../store/AppContext';
import {
  getSpeechRecognitionConstructor,
  getSupportedAudioMimeType,
  isTTSSupported,
  speakText,
  stopSpeaking,
  type SpeechRecognitionInstance,
} from '../lib/speech';
import { evaluateWithGemini, transcribeAudioWithGemini } from '../lib/gemini';
import { AIFeedbackCard } from '../components/AIFeedbackCard';
import { SpeakingBrazierArt } from '../components/DarkArtworks';
import type { AIFeedbackResult, NavTab } from '../types';

const SPEAKING_DRAFT_PREFIX = 'grimoire_draft_speaking_';

function loadSpeakingDraft(lessonId: string): string {
  try {
    return localStorage.getItem(`${SPEAKING_DRAFT_PREFIX}${lessonId}`) || '';
  } catch {
    return '';
  }
}

function saveSpeakingDraft(lessonId: string, text: string): void {
  try {
    if (text.trim()) {
      localStorage.setItem(`${SPEAKING_DRAFT_PREFIX}${lessonId}`, text);
    } else {
      localStorage.removeItem(`${SPEAKING_DRAFT_PREFIX}${lessonId}`);
    }
  } catch {
    // ignore storage errors
  }
}

function removeSpeakingDraft(lessonId: string): void {
  try {
    localStorage.removeItem(`${SPEAKING_DRAFT_PREFIX}${lessonId}`);
  } catch {
    // ignore storage errors
  }
}

function isIOSWebKit(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iP(hone|ad|od)/i.test(ua) || (/Mac/i.test(ua) && 'ontouchend' in document);
}

export function SpeakingPage({ onNavigate }: { onNavigate: (tab: NavTab) => void }) {
  const { lessonProgress, completeLesson, geminiApiKey, addPracticeSubmission, profile } = useApp();
  const [selectedId, setSelectedId] = useState(SPEAKING_LESSONS[0].id);
  const lesson = SPEAKING_LESSONS.find((l) => l.id === selectedId) ?? SPEAKING_LESSONS[0];

  const [phase, setPhase] = useState<'idle' | 'prep' | 'speaking'>('idle');
  const [secondsLeft, setSecondsLeft] = useState(SPEAKING_LESSONS[0].prepSeconds);

  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [draftState, setDraftState] = useState<{ lessonId: string; text: string }>(() => ({
    lessonId: SPEAKING_LESSONS[0].id,
    text: loadSpeakingDraft(SPEAKING_LESSONS[0].id),
  }));
  const transcript =
    draftState.lessonId === lesson.id ? draftState.text : loadSpeakingDraft(lesson.id);
  const setTranscript = useCallback(
    (updater: string | ((prev: string) => string)) => {
      setDraftState((prev) => {
        const base = prev.lessonId === lesson.id ? prev.text : loadSpeakingDraft(lesson.id);
        const nextText = typeof updater === 'function' ? updater(base) : updater;
        return { lessonId: lesson.id, text: nextText };
      });
    },
    [lesson.id]
  );
  const [interimTranscript, setInterimTranscript] = useState('');
  const [sttStatus, setSttStatus] = useState<'idle' | 'listening' | 'unsupported' | 'error'>('idle');
  const [sttNote, setSttNote] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorNeedsAiSettings, setErrorNeedsAiSettings] = useState(false);
  const [showSample, setShowSample] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<AIFeedbackResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isRecordingRef = useRef(false);
  const interimTranscriptRef = useRef('');
  const sttFatalErrorRef = useRef(false);
  const sttRestartTimerRef = useRef<number | null>(null);
  const sttFlushTimerRef = useRef<number | null>(null);
  const sessionIdRef = useRef(0);
  const aiRequestIdRef = useRef(0);
  const audioUrlRef = useRef<string | null>(null);

  const clearSttTimers = useCallback(() => {
    if (sttRestartTimerRef.current !== null) {
      window.clearTimeout(sttRestartTimerRef.current);
      sttRestartTimerRef.current = null;
    }
    if (sttFlushTimerRef.current !== null) {
      window.clearTimeout(sttFlushTimerRef.current);
      sttFlushTimerRef.current = null;
    }
  }, []);

  const clearAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);
    setAudioBlob(null);
  }, []);

  const stopRecordingCleanup = useCallback(
    (invalidateSession = false) => {
      isRecordingRef.current = false;
      clearSttTimers();

      if (invalidateSession) {
        sessionIdRef.current += 1;
      }

      const recorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      let willFireOnStop = false;
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop();
          willFireOnStop = true;
        } catch {
          // ignore stop errors
        }
      }

      if ((invalidateSession || !willFireOnStop) && activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((t) => t.stop());
        activeStreamRef.current = null;
      }

      const rec = recognitionRef.current;
      if (rec) {
        if (invalidateSession) {
          recognitionRef.current = null;
          rec.onresult = null;
          rec.onerror = null;
          rec.onend = null;
          try {
            if (rec.abort) {
              rec.abort();
            } else {
              rec.stop();
            }
          } catch {
            // ignore
          }
          interimTranscriptRef.current = '';
          setInterimTranscript('');
          setSttStatus('idle');
          setSttNote(null);
        } else {
          // Giữ nguyên onresult/onend để hứng đoạn chữ cuối cùng khi gọi rec.stop()
          try {
            rec.stop();
          } catch {
            if (recognitionRef.current === rec) {
              recognitionRef.current = null;
            }
          }
          sttFlushTimerRef.current = window.setTimeout(() => {
            sttFlushTimerRef.current = null;
            const leftover = interimTranscriptRef.current.trim();
            if (leftover) {
              setTranscript((prev) => `${prev.trim()} ${leftover}`.trim());
              interimTranscriptRef.current = '';
              setInterimTranscript('');
            }
            if (recognitionRef.current === rec) {
              rec.onresult = null;
              rec.onerror = null;
              rec.onend = null;
              recognitionRef.current = null;
            }
            setSttStatus((prev) => (prev === 'listening' ? 'idle' : prev));
          }, 1200);
        }
      } else if (invalidateSession) {
        interimTranscriptRef.current = '';
        setInterimTranscript('');
        setSttStatus('idle');
        setSttNote(null);
      }

      setIsRecording(false);
    },
    [clearSttTimers]
  );

  // Reset trạng thái khi đổi bài hoặc unmount (giữ nháp theo bài)
  useEffect(() => {
    aiRequestIdRef.current += 1;
    stopRecordingCleanup(true);
    clearAudioUrl();
    stopSpeaking();
    setPhase('idle');
    setSecondsLeft(lesson.prepSeconds);
    setDraftState({ lessonId: lesson.id, text: loadSpeakingDraft(lesson.id) });
    setInterimTranscript('');
    setSttStatus('idle');
    setSttNote(null);
    setTranscribing(false);
    setErrorMsg(null);
    setErrorNeedsAiSettings(false);
    setShowSample(false);
    setAiLoading(false);
    setAiFeedback(null);
    setNotice(null);
    return () => {
      aiRequestIdRef.current += 1;
      stopRecordingCleanup(true);
      clearAudioUrl();
      stopSpeaking();
    };
  }, [lesson.id, lesson.prepSeconds, stopRecordingCleanup, clearAudioUrl]);

  // Tự lưu nháp Transcript vào localStorage theo từng bài (chỉ khi draft thuộc đúng bài đang mở)
  useEffect(() => {
    if (draftState.lessonId === lesson.id) {
      saveSpeakingDraft(lesson.id, draftState.text);
    }
  }, [lesson.id, draftState]);

  // Bộ đếm giây ổn định — không khởi tạo lại interval mỗi giây
  useEffect(() => {
    if (phase === 'idle') return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  // Xử lý chuyển pha: hết giờ chuẩn bị thì về idle nhắc bấm THU ÂM; hết giờ nói thì dừng ghi âm
  useEffect(() => {
    if (phase === 'idle' || secondsLeft > 0) return;
    if (phase === 'prep') {
      setPhase('idle');
      setSecondsLeft(lesson.speakSeconds);
      setNotice('Hết giờ chuẩn bị! Hãy nhấn nút THU ÂM bên dưới khi bạn sẵn sàng trả lời.');
    } else if (phase === 'speaking') {
      stopRecordingCleanup(false);
      setPhase('idle');
    }
  }, [phase, secondsLeft, lesson.speakSeconds, stopRecordingCleanup]);

  const startRecording = async () => {
    setErrorMsg(null);
    setErrorNeedsAiSettings(false);
    setNotice(null);
    stopSpeaking();

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setErrorMsg(
        'Trình duyệt chặn Micro vì trang chưa chạy qua HTTPS (hoặc localhost). Hãy triển khai HTTPS (Vercel/Cloudflare Pages) hoặc mở trên localhost để thu âm.'
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMsg(
        'Trình duyệt hiện tại không hỗ trợ ghi âm (MediaRecorder). Bạn vẫn có thể gõ câu trả lời vào ô Transcript bên dưới để AI chấm điểm.'
      );
      return;
    }

    // Dừng phiên cũ (nếu có), xóa bản thu cũ và tạo sessionId mới để chống race condition
    stopRecordingCleanup(true);
    clearAudioUrl();
    sttFatalErrorRef.current = false;
    const currentSession = ++sessionIdRef.current;

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (currentSession !== sessionIdRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      activeStreamRef.current = stream;
      const mimeType = getSupportedAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (currentSession !== sessionIdRef.current) return;
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream?.getTracks().forEach((t) => t.stop());
        if (activeStreamRef.current === stream) {
          activeStreamRef.current = null;
        }

        // Nếu người dùng đã chuyển bài hoặc rời trang trước khi onstop chạy, hủy bản thu cũ
        if (currentSession !== sessionIdRef.current || chunksRef.current.length === 0) {
          chunksRef.current = [];
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType || recorder.mimeType || 'audio/mp4' });
        const url = URL.createObjectURL(blob);
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
        }
        audioUrlRef.current = url;
        setAudioUrl(url);
        setAudioBlob(blob);
      };

      recorder.onerror = () => {
        isRecordingRef.current = false;
        stream?.getTracks().forEach((t) => t.stop());
        if (currentSession === sessionIdRef.current) {
          setIsRecording(false);
          setPhase('idle');
          setErrorMsg('Quá trình ghi âm bị gián đoạn. Vui lòng thử thu lại.');
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      isRecordingRef.current = true;
      setIsRecording(true);
      setPhase('speaking');
      setSecondsLeft(lesson.speakSeconds);

      const SpeechRec = getSpeechRecognitionConstructor();
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.lang = 'en-US';
          // Tránh continuous = true trên iOS WebKit gây treo micro hoặc xung đột MediaRecorder
          rec.continuous = !isIOSWebKit();
          rec.interimResults = true;
          rec.maxAlternatives = 1;

          rec.onresult = (event) => {
            if (currentSession !== sessionIdRef.current) return;
            let finalAdded = '';
            let interimAdded = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const result = event.results[i];
              const piece = result[0]?.transcript ?? '';
              if (!piece) continue;
              if (result.isFinal) {
                finalAdded += `${piece} `;
              } else {
                interimAdded += `${piece} `;
              }
            }
            if (finalAdded.trim()) {
              setTranscript((prev) => `${prev.trim()} ${finalAdded.trim()}`.trim());
            }
            const cleanInterim = interimAdded.trim();
            interimTranscriptRef.current = cleanInterim;
            setInterimTranscript(cleanInterim);
          };

          rec.onerror = (event) => {
            if (currentSession !== sessionIdRef.current) return;
            const err = event?.error;
            if (err === 'no-speech' || err === 'aborted') {
              return;
            }
            sttFatalErrorRef.current = true;
            if (sttRestartTimerRef.current !== null) {
              window.clearTimeout(sttRestartTimerRef.current);
              sttRestartTimerRef.current = null;
            }
            setSttStatus('error');
            if (err === 'network') {
              setSttNote(
                'Trình duyệt không kết nối được dịch vụ nhận dạng giọng nói trực tiếp (lỗi mạng/chặn trên Edge/Safari). Bản thu âm vẫn thu bình thường — hãy bấm "Chép lời từ bản thu (AI)" hoặc "AI Chấm Speaking" sau khi dừng.'
              );
            } else if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture') {
              setSttNote(
                'Trình duyệt từ chối hoặc xung đột micro cho nhận dạng trực tiếp (thường gặp trên iOS Safari khi thu âm). Bản thu âm vẫn hoạt động — hãy bấm "Chép lời từ bản thu (AI)" hoặc "AI Chấm Speaking" sau khi dừng.'
              );
            } else {
              setSttNote(
                `Nhận dạng giọng nói trực tiếp tạm ngưng (${err || 'lỗi không xác định'}). Bản thu âm vẫn thu bình thường — hãy bấm "Chép lời từ bản thu (AI)" sau khi dừng.`
              );
            }
          };

          rec.onend = () => {
            if (currentSession !== sessionIdRef.current) {
              if (recognitionRef.current === rec) {
                recognitionRef.current = null;
              }
              return;
            }
            const leftover = interimTranscriptRef.current.trim();
            if (leftover) {
              setTranscript((prev) => `${prev.trim()} ${leftover}`.trim());
              interimTranscriptRef.current = '';
              setInterimTranscript('');
            }
            if (isRecordingRef.current && !sttFatalErrorRef.current) {
              if (sttRestartTimerRef.current !== null) {
                window.clearTimeout(sttRestartTimerRef.current);
              }
              sttRestartTimerRef.current = window.setTimeout(() => {
                sttRestartTimerRef.current = null;
                if (!isRecordingRef.current || currentSession !== sessionIdRef.current || sttFatalErrorRef.current) {
                  return;
                }
                try {
                  rec.start();
                } catch {
                  if (recognitionRef.current === rec) {
                    recognitionRef.current = null;
                  }
                  setSttStatus('error');
                  setSttNote(
                    'Trình duyệt không giữ được nhận dạng trực tiếp khi đang ghi âm. Sau khi bấm DỪNG, hãy dùng nút "Chép lời từ bản thu (AI)" hoặc "AI Chấm Speaking".'
                  );
                }
              }, 250);
            } else {
              if (sttFlushTimerRef.current !== null) {
                window.clearTimeout(sttFlushTimerRef.current);
                sttFlushTimerRef.current = null;
              }
              if (recognitionRef.current === rec) {
                recognitionRef.current = null;
              }
              setSttStatus((prev) => (prev === 'listening' ? 'idle' : prev));
            }
          };

          rec.start();
          recognitionRef.current = rec;
          setSttStatus('listening');
          setSttNote(null);
        } catch {
          setSttStatus('error');
          setSttNote(
            'Không thể bật nhận dạng chữ trực tiếp trên trình duyệt này. Bản thu âm vẫn chạy bình thường — hãy bấm "Chép lời từ bản thu (AI)" sau khi dừng.'
          );
        }
      } else {
        setSttStatus('unsupported');
        setSttNote(
          'Trình duyệt này không hỗ trợ chuyển giọng nói trực tiếp khi đang thu. Hãy thu âm xong rồi bấm "Chép lời từ bản thu (AI)" hoặc "AI Chấm Speaking".'
        );
      }
    } catch {
      isRecordingRef.current = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (activeStreamRef.current === stream) {
        activeStreamRef.current = null;
      }
      setIsRecording(false);
      setErrorMsg(
        'Không thể truy cập micro. Hãy cấp quyền Micro cho trình duyệt (trên iOS Safari: Cài đặt → Safari → Micro) hoặc gõ lời nói vào ô Transcript.'
      );
    }
  };

  const stopRecording = () => {
    stopRecordingCleanup(false);
    setPhase('idle');
  };

  const startPrepTimer = () => {
    stopRecordingCleanup(false);
    setPhase('prep');
    setSecondsLeft(lesson.prepSeconds);
  };

  const handleSpeakPrompt = (text: string) => {
    if (!isTTSSupported()) {
      setErrorMsg('Trình duyệt hiện tại không hỗ trợ đọc giọng nói (Text-to-Speech).');
      setErrorNeedsAiSettings(false);
      return;
    }
    if (isRecordingRef.current) {
      stopRecordingCleanup(false);
      setPhase('idle');
    }
    speakText(text, { lang: 'en-GB', rate: 0.92 });
  };

  const handleCompletePractice = () => {
    if (isRecording) return;
    setErrorMsg(null);
    setErrorNeedsAiSettings(false);
    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    const hasAudio = Boolean(audioBlob && audioBlob.size > 0);
    if (!hasAudio && wordCount < 5) {
      setErrorMsg('Hãy thu âm câu trả lời hoặc nhập ít nhất 5 từ vào ô Transcript trước khi bấm Hoàn Thành.');
      return;
    }
    completeLesson(lesson.id, 'speaking', 85, lesson.xpReward, 10, { updateBand: false });
    addPracticeSubmission({
      skill: 'speaking',
      promptId: lesson.id,
      promptTitle: lesson.title,
      content: transcript.trim() || '[Speaking Audio — Tự luyện]',
      bandEstimate: 0,
    });
    removeSpeakingDraft(lesson.id);
    setNotice(`Hoàn thành luyện nói và cộng +${lesson.xpReward} XP (Chế độ tự luyện không tự cộng Band — hãy dùng AI Chấm Speaking để đo Band thực tế).`);
  };

  const handleTranscribeAudio = async () => {
    if (!audioBlob) return;
    setErrorMsg(null);
    setErrorNeedsAiSettings(false);
    setNotice(null);
    if (!geminiApiKey) {
      setErrorMsg('Bạn chưa nhập Gemini API Key trong mục Cài đặt.');
      setErrorNeedsAiSettings(true);
      return;
    }
    const reqId = ++aiRequestIdRef.current;
    const currentBlob = audioBlob;
    const currentLesson = lesson;
    setTranscribing(true);
    try {
      const text = await transcribeAudioWithGemini({
        apiKey: geminiApiKey,
        audioBlob: currentBlob,
        promptHint: currentLesson.title,
      });
      if (reqId !== aiRequestIdRef.current) return;
      setTranscript(text);
      setSttNote(null);
      setNotice('Đã chép lời từ bản ghi âm bằng Gemini AI. Bạn có thể kiểm tra lại hoặc bấm AI Chấm Speaking.');
    } catch (err) {
      if (reqId !== aiRequestIdRef.current) return;
      const msg = err instanceof Error ? err.message : 'Lỗi chép lời từ bản ghi âm.';
      setErrorMsg(msg);
      if (/api key|khóa/i.test(msg)) {
        setErrorNeedsAiSettings(true);
      }
    } finally {
      if (reqId === aiRequestIdRef.current) {
        setTranscribing(false);
      }
    }
  };

  const handleEvaluateAI = async () => {
    setErrorNeedsAiSettings(false);
    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    const hasAudio = Boolean(audioBlob && audioBlob.size > 0);
    if (!hasAudio && wordCount < 12) {
      setErrorMsg('Hãy thu âm giọng nói hoặc nhập ít nhất 12 từ vào ô Transcript để AI chấm điểm Speaking.');
      return;
    }
    if (!geminiApiKey) {
      setErrorMsg('Bạn chưa nhập Gemini API Key trong mục Cài đặt.');
      setErrorNeedsAiSettings(true);
      return;
    }
    const reqId = ++aiRequestIdRef.current;
    const currentLesson = lesson;
    const currentTranscript = transcript;
    const currentAudioBlob = audioBlob;
    setAiLoading(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      const result = await evaluateWithGemini({
        apiKey: geminiApiKey,
        skill: 'speaking',
        promptTitle: currentLesson.title,
        promptText: `${currentLesson.questions.join('\n')}${currentLesson.cueCardBullets ? `\nCue card: ${currentLesson.cueCardBullets.join(', ')}` : ''}`,
        userResponse: currentTranscript,
        targetBand: profile.targetBand,
        audioBlob: currentAudioBlob,
      });
      if (reqId !== aiRequestIdRef.current) return;
      const hasNewAudio = Boolean(currentAudioBlob && currentAudioBlob.size > 0);
      const effectiveTranscript =
        hasNewAudio && result.transcriptEn
          ? result.transcriptEn
          : currentTranscript.trim() || result.transcriptEn || '';
      if (hasNewAudio && result.transcriptEn) {
        setTranscript(result.transcriptEn);
      }
      setAiFeedback(result);
      completeLesson(
        currentLesson.id,
        'speaking',
        Math.min(100, Math.round((result.overallBand / 7.0) * 100)),
        currentLesson.xpReward,
        12,
        { updateBand: false }
      );
      addPracticeSubmission({
        skill: 'speaking',
        promptId: currentLesson.id,
        promptTitle: currentLesson.title,
        content: effectiveTranscript || '[Speaking Audio Submission]',
        bandEstimate: result.overallBand,
        aiFeedback: result,
      });
      removeSpeakingDraft(currentLesson.id);
    } catch (err) {
      if (reqId !== aiRequestIdRef.current) return;
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối Gemini AI.';
      setErrorMsg(msg);
      if (/api key|khóa/i.test(msg)) {
        setErrorNeedsAiSettings(true);
      }
    } finally {
      if (reqId === aiRequestIdRef.current) {
        setAiLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="ornate-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-hidden">
        <div className="p-5 sm:p-7">
          <p className="font-fantasy text-[11px] uppercase tracking-[0.24em] text-[#C5A059]">
            Điện IV ◆ Speaking
          </p>
          <h1 className="font-fantasy text-2xl sm:text-3xl text-[#F4EFE4] mt-1">
            Lò Luyện Thanh Âm
          </h1>
          <p className="text-sm text-[#968D80] mt-1.5 max-w-xl">
            Ghi âm trực tiếp trên iPhone & Windows, nghe lại phát âm của chính mình và luyện nhịp chuẩn phòng thi IELTS.
          </p>
        </div>
        <div className="hidden sm:block w-52 h-32 shrink-0 border-l border-[#C5A059]/20">
          <SpeakingBrazierArt className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Chọn chủ đề */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SPEAKING_LESSONS.map((item) => {
          const done = lessonProgress[item.id];
          const active = item.id === lesson.id;
          return (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={`p-4 text-left border transition cursor-pointer ${
                active
                  ? 'bg-[#C5A059]/12 border-[#E2C88D]'
                  : 'sanctuary-panel hover:border-[#C5A059]/50'
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-fantasy uppercase tracking-wider text-[#C5A059]">
                  Chương {item.act} • {item.part}
                </span>
                {done ? (
                  <Check className="w-3.5 h-3.5 text-[#7BC2A0]" />
                ) : (
                  <span className="text-[#968D80]">{item.bandTarget}</span>
                )}
              </div>
              <p className="text-sm font-medium text-[#ECE6D8] mt-1.5 line-clamp-2">{item.title}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* CỘT TRÁI: THẺ ĐỀ SPEAKING */}
        <div className="lg:col-span-6 sanctuary-panel p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#C5A059]/15">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#C5A059] font-semibold">
              {lesson.part} • {lesson.bandTarget}
            </span>
            <button
              onClick={() => handleSpeakPrompt(lesson.questions.join('. '))}
              className="btn-ghost-brass px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" /> Nghe câu hỏi
            </button>
          </div>

          <h2 className="font-fantasy text-xl text-[#F4EFE4]">{lesson.title}</h2>

          <div className="p-4 bg-[#0B0A08] border-l-2 border-[#C5A059] space-y-2.5">
            {lesson.questions.map((q, idx) => (
              <p key={idx} className="text-sm sm:text-base text-[#ECE6D8] leading-relaxed">
                {q}
              </p>
            ))}
            {lesson.cueCardBullets && (
              <ul className="pt-2 space-y-1.5 text-sm text-[#E2C88D] list-disc pl-5">
                {lesson.cueCardBullets.map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C5A059]">
              Từ vựng ăn điểm (Chạm để nghe)
            </p>
            <div className="flex flex-wrap gap-2">
              {lesson.keyVocab.map((v, i) => (
                <button
                  key={i}
                  onClick={() => handleSpeakPrompt(v.word)}
                  className="px-3 py-2 bg-[#0B0A08] hover:border-[#E2C88D] border border-[#C5A059]/20 text-left cursor-pointer"
                >
                  <p className="text-xs font-semibold text-[#ECE6D8] flex items-center gap-1.5">
                    {v.word} <Volume2 className="w-3 h-3 text-[#C5A059]" />
                  </p>
                  <p className="text-[11px] text-[#968D80]">
                    {v.ipa} • {v.meaningVi}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-[#0B0A08] border border-[#C5A059]/15 space-y-1.5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#E2C88D] font-semibold">
              Chiến thuật phòng thi
            </p>
            <ul className="text-xs text-[#C8BFB0] list-disc pl-4 space-y-1">
              {lesson.tipsVi.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>

          <div className="pt-2 border-t border-[#C5A059]/15">
            <button
              onClick={() => setShowSample((v) => !v)}
              className="text-xs uppercase tracking-[0.14em] font-semibold text-[#E2C88D] hover:underline cursor-pointer"
            >
              {showSample ? '▼ Ẩn câu trả lời mẫu' : '▶ Xem & nghe bài mẫu Band 6.5+'}
            </button>
            {showSample && (
              <div className="mt-3 p-4 bg-[#0B0A08] border border-[#C5A059]/18 space-y-2.5">
                <div className="flex justify-end">
                  <button
                    onClick={() => handleSpeakPrompt(lesson.sampleAnswerEn)}
                    className="btn-ghost-brass px-3 py-1 text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" /> Nghe bài mẫu
                  </button>
                </div>
                <p className="text-sm text-[#ECE6D8] leading-relaxed">{lesson.sampleAnswerEn}</p>
                <p className="text-xs text-[#968D80] leading-relaxed pt-2 border-t border-[#C5A059]/12">
                  {lesson.sampleAnswerVi}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: PHÒNG THU ÂM */}
        <div className="lg:col-span-6 space-y-4">
          <div className="sanctuary-panel p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between gap-3 p-4 bg-[#0B0A08] border border-[#C5A059]/20">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#968D80]">
                  {phase === 'prep'
                    ? 'Đang chuẩn bị ý tưởng'
                    : phase === 'speaking'
                    ? 'Thời gian trả lời'
                    : `Chuẩn bị ${lesson.prepSeconds}s • Nói ${lesson.speakSeconds}s`}
                </p>
                <p className="font-fantasy text-2xl text-[#E2C88D] mt-1 flex items-center gap-2 tabular-nums">
                  <Clock className="w-5 h-5 text-[#C5A059]" />
                  {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:
                  {String(secondsLeft % 60).padStart(2, '0')}
                </p>
              </div>

              <button
                onClick={startPrepTimer}
                className="btn-ghost-brass px-3.5 py-2 text-xs cursor-pointer"
              >
                Đếm chuẩn bị ({lesson.prepSeconds}s)
              </button>
            </div>

            {/* Nút thu âm dấu ấn hình tròn cổ đồng - đỏ huyết */}
            <div className="flex flex-col items-center py-4">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="w-24 h-24 rounded-full bg-[#15120F] hover:bg-[#1E1914] border-2 border-[#C5A059] shadow-[0_0_0_5px_rgba(197,160,89,0.12)] flex flex-col items-center justify-center text-[#E2C88D] transition active:scale-95 cursor-pointer"
                >
                  <Mic className="w-7 h-7" />
                  <span className="font-fantasy text-[10px] tracking-[0.2em] mt-1.5">THU ÂM</span>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="w-24 h-24 rounded-full bg-[#8E2933] border-2 border-[#E2C88D] shadow-[0_0_0_6px_rgba(142,41,51,0.3)] flex flex-col items-center justify-center text-[#F6EFE2] animate-pulse cursor-pointer"
                >
                  <Square className="w-6 h-6 fill-current" />
                  <span className="font-fantasy text-[10px] tracking-[0.2em] mt-1.5">DỪNG</span>
                </button>
              )}
              <p className="text-xs text-[#968D80] mt-3.5 text-center">
                {isRecording
                  ? 'Đang ghi âm giọng nói của bạn...'
                  : 'Nhấn để bắt đầu nói, sau đó nghe lại bản thu ngay tại đây.'}
              </p>
            </div>

            {audioUrl && (
              <div className="p-3.5 bg-[#0B0A08] border border-[#4E8A6E]/40 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#7BC2A0]">Bản ghi âm của bạn:</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {audioBlob && (
                      <button
                        type="button"
                        onClick={handleTranscribeAudio}
                        disabled={isRecording || transcribing || aiLoading}
                        className="btn-ghost-brass px-3 py-1 text-[11px] flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        {transcribing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang chép lời...
                          </>
                        ) : (
                          <>
                            <FileAudio className="w-3.5 h-3.5" /> Chép lời từ bản thu (AI)
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={clearAudioUrl}
                      disabled={isRecording || transcribing || aiLoading}
                      className="px-2.5 py-1 bg-[#090807] border border-[#8E2933]/45 hover:border-[#B83B47] text-[11px] text-[#F2B5BC] flex items-center gap-1 cursor-pointer disabled:opacity-60"
                    >
                      <Trash2 className="w-3 h-3" /> Xóa bản thu
                    </button>
                  </div>
                </div>
                <audio controls src={audioUrl} className="w-full h-10" />
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#968D80]">
                  Transcript (Hiện chữ khi nói hoặc chép từ bản thu)
                </label>
                {transcript.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setTranscript('');
                      setInterimTranscript('');
                      interimTranscriptRef.current = '';
                      removeSpeakingDraft(lesson.id);
                    }}
                    className="text-[11px] text-[#968D80] hover:text-[#E2C88D] flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Xóa chữ
                  </button>
                )}
              </div>

              {isRecording && sttStatus === 'listening' && (
                <div className="px-3 py-2 bg-[#0B0A08] border border-[#C5A059]/30 text-xs text-[#E2C88D] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#B83B47] animate-pulse shrink-0" />
                  <span className="truncate">
                    {interimTranscript
                      ? `Đang nghe: "${interimTranscript}"`
                      : 'Đang lắng nghe giọng nói tiếng Anh của bạn...'}
                  </span>
                </div>
              )}

              {sttNote && (
                <div className="p-2.5 bg-[#0B0A08] border border-[#C5A059]/30 text-[11px] text-[#C8BFB0] leading-relaxed">
                  {sttNote}
                </div>
              )}

              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={4}
                placeholder="Nội dung bạn nói sẽ xuất hiện tại đây (hoặc bấm 'Chép lời từ bản thu (AI)' sau khi thu xong)..."
                className="w-full bg-[#090807] border border-[#C5A059]/22 focus:border-[#E2C88D] focus:outline-none p-3.5 text-base sm:text-sm text-[#ECE6D8]"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-[#8E2933]/15 border border-[#8E2933]/50 text-xs text-[#F2C3C8] flex items-start justify-between gap-2">
                <span className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#E28A93]" />
                  {errorMsg}
                </span>
                {errorNeedsAiSettings && (
                  <button
                    onClick={() => onNavigate('settings')}
                    className="shrink-0 btn-ghost-brass px-2.5 py-1 text-[11px] cursor-pointer"
                  >
                    Cài đặt AI
                  </button>
                )}
              </div>
            )}

            {notice && (
              <div className="p-3 bg-[#4E8A6E]/12 border border-[#4E8A6E]/40 text-xs text-[#B9E6D0] flex items-center gap-2">
                <Check className="w-4 h-4 text-[#7BC2A0]" />
                {notice}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleEvaluateAI}
                disabled={isRecording || aiLoading || transcribing}
                className="flex-1 min-w-[190px] btn-crimson py-3 px-4 text-xs uppercase tracking-[0.14em] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang phân tích...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" /> AI Chấm Speaking
                  </>
                )}
              </button>

              <button
                onClick={handleCompletePractice}
                disabled={isRecording}
                className="btn-brass py-3 px-5 text-xs uppercase tracking-[0.14em] cursor-pointer disabled:opacity-60"
              >
                Hoàn Thành (+{lesson.xpReward} XP)
              </button>
            </div>
          </div>

          {aiFeedback && <AIFeedbackCard feedback={aiFeedback} />}
        </div>
      </div>
    </div>
  );
}
