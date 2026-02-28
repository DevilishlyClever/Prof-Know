import { useEffect, useRef, useState } from 'react';

export function useAudioProcessor() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = async (onAudioData: (base64Data: string) => void) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      }

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Simple script processor fallback or custom worklet
      // For simplicity in this environment, we'll use a ScriptProcessorNode if available or a simple worklet
      // Actually, let's use a standard ScriptProcessor for maximum compatibility in this sandbox if possible, 
      // but it's deprecated. Let's try to do it properly with a basic worklet if we can, 
      // or just use the simplest way to get PCM data.
      
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert to 16-bit PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        onAudioData(base64Data);
      };

      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
    }
  };

  const stopRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  return { startRecording, stopRecording, isRecording };
}

export function useAudioPlayer() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const filterChainRef = useRef<{
    hp: BiquadFilterNode;
    peak1: BiquadFilterNode;
    peak2: BiquadFilterNode;
    comp: DynamicsCompressorNode;
  } | null>(null);

  const playAudioChunk = (base64Data: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      nextStartTimeRef.current = audioContextRef.current.currentTime;
      
      // Create filter chain once
      const hp = audioContextRef.current.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 400;

      const peak1 = audioContextRef.current.createBiquadFilter();
      peak1.type = 'peaking';
      peak1.frequency.value = 1200;
      peak1.Q.value = 4;
      peak1.gain.value = 8;

      const peak2 = audioContextRef.current.createBiquadFilter();
      peak2.type = 'peaking';
      peak2.frequency.value = 2500;
      peak2.Q.value = 3;
      peak2.gain.value = 6;

      const comp = audioContextRef.current.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-24, audioContextRef.current.currentTime);
      comp.knee.setValueAtTime(40, audioContextRef.current.currentTime);
      comp.ratio.setValueAtTime(12, audioContextRef.current.currentTime);
      comp.attack.setValueAtTime(0, audioContextRef.current.currentTime);
      comp.release.setValueAtTime(0.25, audioContextRef.current.currentTime);

      hp.connect(peak1);
      peak1.connect(peak2);
      peak2.connect(comp);
      comp.connect(audioContextRef.current.destination);

      filterChainRef.current = { hp, peak1, peak2, comp };
    }

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const pcmData = new Int16Array(bytes.buffer);
    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 32768.0;
    }

    const buffer = audioContextRef.current.createBuffer(1, floatData.length, 24000);
    buffer.copyToChannel(floatData, 0);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;

    if (filterChainRef.current) {
      source.connect(filterChainRef.current.hp);
    } else {
      source.connect(audioContextRef.current.destination);
    }

    const now = audioContextRef.current.currentTime;
    // If we're too far behind, catch up to now
    const startTime = Math.max(nextStartTimeRef.current, now);
    
    // Safety: if the scheduled time is more than 0.5s in the past, jump to now
    // This prevents "catching up" lag if there was a network hiccup
    const finalStartTime = (startTime < now - 0.1) ? now : startTime;

    source.start(finalStartTime);
    nextStartTimeRef.current = finalStartTime + buffer.duration;
  };

  const stopAll = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      nextStartTimeRef.current = 0;
      filterChainRef.current = null;
    }
  };

  return { playAudioChunk, stopAll };
}
