/**
 * Web Speech API integration for interactive museum-style audio guides.
 * Zero external dependencies, zero latency, works offline in all modern browsers.
 */

let synth: SpeechSynthesis | null = null;
let currentBtn: HTMLElement | null = null;

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  synth = window.speechSynthesis;
}

function getEnglishVoice(): SpeechSynthesisVoice | null {
  if (!synth) return null;
  const voices = synth.getVoices();
  // Prefer premium natural sounding English voices
  const preferred = voices.find(
    (v) =>
      v.lang.startsWith('en') &&
      (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel')),
  );
  return preferred || voices.find((v) => v.lang.startsWith('en')) || null;
}

export function stopSpeaking(): void {
  if (!synth) return;
  synth.cancel();
  if (currentBtn) {
    currentBtn.classList.remove('playing');
    currentBtn.textContent = currentBtn.dataset.originalText || '🎧 Listen Guide';
    currentBtn = null;
  }
}

export function isSpeaking(): boolean {
  return synth ? synth.speaking : false;
}

/**
 * Clean and prepare text for pleasant, natural text-to-speech cadence.
 */
function prepareText(text: string): string {
  return text
    .replace(/UNESCO/g, 'U-N-E-S-C-O')
    .replace(/≈/g, 'approximately')
    .replace(/×/g, ' times ')
    .replace(/km\/day/g, 'kilometers per day')
    .replace(/km/g, 'kilometers')
    .replace(/\bc\.\b/g, 'century')
    .replace(/[★⭐📍🏛️🕌📜🐫🏰🖼️🗿⏱️🧭]/g, '')
    .trim();
}

/**
 * Toggle audio narration for an element.
 */
export function toggleAudioGuide(text: string, btn: HTMLElement): void {
  if (!synth) {
    alert('Audio guide is not supported in this browser.');
    return;
  }

  // If already speaking this button's text, pause/stop
  if (currentBtn === btn && synth.speaking) {
    stopSpeaking();
    return;
  }

  // Stop any other active speech
  stopSpeaking();

  const cleaned = prepareText(text);
  if (!cleaned) return;

  const utter = new SpeechSynthesisUtterance(cleaned);
  const voice = getEnglishVoice();
  if (voice) utter.voice = voice;
  utter.rate = 0.95; // slightly slower for clear educational narration
  utter.pitch = 1.0;

  if (!btn.dataset.originalText) {
    btn.dataset.originalText = btn.textContent || '🎧 Listen Guide';
  }

  utter.onstart = () => {
    currentBtn = btn;
    btn.classList.add('playing');
    btn.textContent = '⏹ Stop Audio';
  };

  utter.onend = () => {
    stopSpeaking();
  };

  utter.onerror = () => {
    stopSpeaking();
  };

  synth.speak(utter);
}
