import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: 'How does OpenClip process multi-gigabyte videos entirely inside my browser?',
    answer:
      'OpenClip uses the modern WebCodecs API and the Origin Private File System (OPFS). When you select a video, it is streamed into high-performance private storage managed locally by your browser. No files are ever uploaded to any cloud server. Frame decoding, effects, and encoding run directly on your machine with hardware GPU acceleration.',
  },
  {
    question: 'Is there any cost, subscription, or watermark?',
    answer:
      'No. OpenClip is 100% free and open source under the MIT license. Unlike cloud tools that charge $20 to $50/month and enforce restrictive credit limits or queue wait times, OpenClip gives you unlimited video processing with zero watermarks forever.',
  },
  {
    question: 'What video formats and resolutions are supported?',
    answer:
      'OpenClip accepts MP4, MOV, MKV, and WebM video files. You can import up to 4K 60fps source footage and export crystal-clear 1080x1920 (9:16) vertical MP4 shorts perfectly sized for TikTok, Instagram Reels, and YouTube Shorts.',
  },
  {
    question: 'How does AI speech transcription and face tracking work on-device?',
    answer:
      'We run optimized OpenAI Whisper speech-to-text models directly in your browser using WebAssembly and WebGPU via Transformers.js. For intelligent framing, Google MediaPipe BlazeFace tracks speaker faces in real time to smoothly pan the 9:16 crop box and maintain focus on active speakers.',
  },
  {
    question: 'Can I edit and adjust clips after the AI generates them?',
    answer:
      'Absolutely. OpenClip features a full precision timeline editor and interactive transcript editor. You can delete filler words by clicking text, tweak caption typography and animated highlight styles (such as Alex Hormozi and MrBeast aesthetics), switch between stacked/split layouts, and fine-tune start and end times.',
  },
  {
    question: 'Does OpenClip work offline without an internet connection?',
    answer:
      'Yes. Once the web app and Whisper model weights are cached in your browser, OpenClip can run completely offline. Your media, projects, and transcripts never leave your personal computer.',
  },
];

export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex((curr) => (curr === idx ? null : idx));
  };

  return (
    <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-white/8">
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-text-muted mb-3 font-mono">
          <HelpCircle className="w-3 h-3 text-white" />
          <span>QUESTIONS &amp; ANSWERS</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold text-text tracking-tight mb-4">
          Frequently asked questions
        </h2>
        <p className="text-sm sm:text-base text-text-muted leading-relaxed">
          Everything you need to know about 100% client-side AI video clipping.
        </p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className={cn(
                'rounded-2xl transition-all duration-200 border overflow-hidden',
                isOpen
                  ? 'bg-surface-elevated/90 border-white/20 shadow-glow'
                  : 'glass-subtle border-white/8 hover:border-white/15'
              )}
            >
              <button
                onClick={() => toggle(idx)}
                className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 cursor-pointer"
                aria-expanded={isOpen}
              >
                <span className="text-sm sm:text-base font-semibold text-text">
                  {faq.question}
                </span>
                <div
                  className={cn(
                    'w-7 h-7 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 transition-transform duration-200',
                    isOpen && 'rotate-180 bg-white/10 text-white'
                  )}
                >
                  <ChevronDown className="w-4 h-4 text-text-muted" />
                </div>
              </button>

              {isOpen && (
                <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-text-muted leading-relaxed border-t border-white/5">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
