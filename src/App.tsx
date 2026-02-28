import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Brain, Sparkles, BookOpen, Volume2, Info, X } from 'lucide-react';
import { createLiveSession, LiveSession } from './services/geminiLive';
import { useAudioProcessor, useAudioPlayer } from './hooks/useAudio';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<{ role: 'user' | 'professor', text: string }[]>([]);
  const [currentProfessorText, setCurrentProfessorText] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  
  const sessionRef = useRef<LiveSession | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  
  const { startRecording, stopRecording, isRecording } = useAudioProcessor();
  const { playAudioChunk, stopAll: stopAudioPlayback } = useAudioPlayer();

  const scrollToBottom = () => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [transcript, currentProfessorText]);

  const handleConnect = async () => {
    if (isConnected) {
      sessionRef.current?.close();
      stopRecording();
      stopAudioPlayback();
      setIsConnected(false);
      return;
    }

    setIsConnecting(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('API Key missing');

      const session = await createLiveSession(apiKey, {
        onopen: () => {
          console.log('Live session opened');
          setIsConnected(true);
          setIsConnecting(false);
          
          // Trigger the initial greeting from The Omniscient
          try {
            (session as any).sendRealtimeInput({
              parts: [{ text: "Introduce yourself." }]
            });
          } catch (e) {
            console.warn('Failed to send initial trigger:', e);
          }

          // Small delay before opening the mic to prevent interruption of the greeting
          setTimeout(() => {
            startRecording((base64Data) => {
              try {
                session.sendRealtimeInput({
                  media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              } catch (e) {
                console.error('Failed to send audio data:', e);
              }
            });
          }, 500);
        },
        onmessage: (message: any) => {
          if (message.serverContent?.modelTurn) {
            const parts = message.serverContent.modelTurn.parts;
            parts.forEach((part: any) => {
              if (part.inlineData) {
                playAudioChunk(part.inlineData.data);
              }
              if (part.text) {
                setCurrentProfessorText(prev => prev + part.text);
              }
            });
          }

          if (message.serverContent?.turnComplete) {
            if (currentProfessorText) {
              setTranscript(prev => [...prev, { role: 'professor', text: currentProfessorText }]);
              setCurrentProfessorText('');
            }
          }

          if (message.serverContent?.interrupted) {
            stopAudioPlayback();
            setCurrentProfessorText('');
          }
        },
        onclose: () => {
          setIsConnected(false);
          stopRecording();
          stopAudioPlayback();
        },
        onerror: (err: any) => {
          console.error('Live API Error:', err);
          setIsConnected(false);
          setIsConnecting(false);
        }
      });

      sessionRef.current = session;
    } catch (err) {
      console.error('Failed to connect:', err);
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden relative">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
      </div>

      {/* SVG Filter for Plasma Effect */}
      <svg className="hidden">
        <defs>
          <filter id="plasma-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <main className="z-10 w-full max-w-4xl flex flex-col items-center gap-8">
        {/* Header */}
        <header className="text-center space-y-2">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-mono uppercase tracking-widest"
          >
            <Brain size={14} />
            The Ultimate Intellect
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-6xl md:text-8xl font-serif font-bold tracking-tighter text-white"
          >
            The <span className="text-emerald-500 italic">Omniscient</span>
          </motion.h1>
          <p className="text-zinc-400 font-serif italic text-lg max-w-md mx-auto whitespace-pre-line">
            "I'm not just a genius. I'm the solution.{"\n"}Try to keep up, if your primitive mind can manage it."
          </p>
        </header>

        {/* Central Interaction Area */}
        <div className="flex flex-col items-center gap-12 w-full max-w-md">
          <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
            {/* Plasma Ball Container */}
            <div className="absolute inset-0 rounded-full overflow-visible" style={{ filter: 'url(#plasma-goo)' }}>
              <AnimatePresence>
                {isConnected && (
                  <>
                    {/* Plasma Tendrils */}
                    {[...Array(8)].map((_, i) => (
                      <motion.div
                        key={`tendril-${i}`}
                        initial={{ opacity: 0, scale: 0.5, rotate: i * 45 }}
                        animate={{ 
                          opacity: [0, 0.6, 0],
                          scale: [0.8, 1.2, 0.8],
                          rotate: [i * 45, i * 45 + 20, i * 45 - 20, i * 45],
                          width: ['100%', '140%', '100%'],
                        }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 2 + Math.random() * 2, 
                          ease: "easeInOut",
                          delay: i * 0.2
                        }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-purple-400 rounded-full blur-[2px] origin-center"
                        style={{ width: '100%' }}
                      />
                    ))}
                    
                    {/* Core Glow */}
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.1, 1],
                        opacity: [0.3, 0.5, 0.3]
                      }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      className="absolute inset-0 bg-gradient-to-tr from-emerald-500/40 to-purple-500/40 rounded-full blur-2xl"
                    />
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Visualizer Rings around Avatar */}
            <AnimatePresence>
              {isConnected && (
                <>
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.3, opacity: 0.2 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                    className="absolute inset-0 border-4 border-emerald-500 rounded-full"
                  />
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.6, opacity: 0.1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeOut", delay: 0.5 }}
                    className="absolute inset-0 border-2 border-emerald-500 rounded-full"
                  />
                  
                  {/* Rising Green and Purple Particles */}
                  {[...Array(15)].map((_, i) => (
                    <motion.div
                      key={`particle-${i}`}
                      initial={{ 
                        opacity: 0, 
                        y: 0, 
                        x: (Math.random() - 0.5) * 120 
                      }}
                      animate={{ 
                        opacity: [0, 0.8, 0],
                        y: -250 - Math.random() * 150,
                        x: (Math.random() - 0.5) * 200
                      }}
                      transition={{ 
                        repeat: Infinity, 
                        duration: 1.5 + Math.random() * 2, 
                        delay: i * 0.15,
                        ease: "easeOut"
                      }}
                      className={`absolute w-2 h-2 rounded-full blur-[2px] ${
                        i % 2 === 0 ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-purple-400 shadow-[0_0_10px_#c084fc]'
                      }`}
                    />
                  ))}
                </>
              )}
            </AnimatePresence>

            {/* Avatar Image */}
            <motion.div 
              animate={isConnected ? { 
                scale: [1, 1.02, 1],
                rotate: [0, 1, -1, 0]
              } : {}}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className={`relative z-20 w-full h-full rounded-full overflow-hidden border-4 transition-colors duration-500 shadow-2xl ${
                isConnected ? 'border-emerald-500 shadow-emerald-500/40' : 'border-zinc-800 shadow-black/60'
              }`}
            >
              <img 
                src="https://vignette.wikia.nocookie.net/marsattacks/images/d/d2/Mars_Attacks_Alien.png/revision/latest?cb=20150117181617" 
                alt="The Omniscient"
                className={`w-full h-full object-cover transition-all duration-700 ${isConnected ? 'grayscale-0 scale-110' : 'grayscale opacity-60'}`}
                referrerPolicy="no-referrer"
              />
              {/* Glass Bowl Reflection */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-white/10 pointer-events-none" />
              <div className="absolute top-0 left-1/4 w-1/2 h-1/4 bg-white/10 rounded-full blur-md -rotate-12" />
              
              {/* Overlay for "active" state */}
              <div className={`absolute inset-0 bg-emerald-500/10 transition-opacity duration-500 ${isConnected ? 'opacity-100' : 'opacity-0'}`} />
            </motion.div>
          </div>

          {/* Start/Stop Button - Moved Below Avatar */}
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleConnect}
            disabled={isConnecting}
            className={`relative z-30 px-12 py-5 rounded-2xl flex items-center gap-4 transition-all duration-500 shadow-xl font-bold uppercase tracking-[0.2em] text-sm ${
              isConnected 
                ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20' 
                : 'bg-emerald-500 text-black shadow-emerald-500/20 hover:bg-emerald-400'
            }`}
          >
            {isConnecting ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current" />
            ) : isConnected ? (
              <>
                <MicOff size={20} />
                <span>End Audience</span>
              </>
            ) : (
              <>
                <Mic size={20} />
                <span>Request Enlightenment</span>
              </>
            )}
          </motion.button>
        </div>

        {/* Transcript Toggle */}
        <div className="flex gap-4">
          <button 
            onClick={() => setShowTranscript(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
          >
            <Info size={18} />
            View Lecture Notes
          </button>
        </div>
      </main>

      {/* Transcript Modal */}
      <AnimatePresence>
        {showTranscript && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-2xl h-[80vh] bg-zinc-900 border border-zinc-800 rounded-3xl flex flex-col overflow-hidden"
            >
              <div className="p-6 border-bottom border-zinc-800 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-bold text-white">The Omniscient's Notes</h3>
                    <p className="text-xs text-zinc-500 font-mono">Session Log: {new Date().toLocaleTimeString()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowTranscript(false)}
                  className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                {transcript.length === 0 && !currentProfessorText && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                    <Brain size={48} />
                    <p className="font-serif italic">The chalkboard is currently empty...</p>
                  </div>
                )}
                
                {transcript.map((entry, i) => (
                  <div key={i} className={`flex flex-col ${entry.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl ${
                      entry.role === 'user' 
                        ? 'bg-emerald-500 text-black rounded-tr-none' 
                        : 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700'
                    }`}>
                      <p className="text-sm leading-relaxed">{entry.text}</p>
                    </div>
                  </div>
                ))}

                {currentProfessorText && (
                  <div className="flex flex-col items-start">
                    <div className="max-w-[85%] p-4 rounded-2xl bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700">
                      <p className="text-sm leading-relaxed">
                        {currentProfessorText}
                        <span className="inline-block w-1 h-4 bg-emerald-500 ml-1 animate-pulse" />
                      </p>
                    </div>
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>

              <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 text-center">
                <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                  End of Current Transcription
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Branding */}
      <footer className="fixed bottom-8 left-0 right-0 z-10 flex justify-center pointer-events-none">
        <div className="px-6 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/5 text-[10px] text-zinc-500 font-mono uppercase tracking-[0.3em]">
          Knowledge is for those who can handle it.
        </div>
      </footer>
    </div>
  );
}
