
import { useEffect, useRef } from 'react';

interface AudioManagerProps {
  currentZone: string;
}

export const AudioManager = ({ currentZone }: AudioManagerProps) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    // Initialize Web Audio API
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const audioContext = audioContextRef.current;
    
    // Stop previous audio
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
    }

    // Create new audio based on zone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillatorRef.current = oscillator;
    gainNodeRef.current = gainNode;

    // Configure audio based on emotional zone
    const zoneAudioConfig = getZoneAudioConfig(currentZone);
    
    oscillator.frequency.setValueAtTime(zoneAudioConfig.frequency, audioContext.currentTime);
    oscillator.type = zoneAudioConfig.waveType;
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(zoneAudioConfig.volume, audioContext.currentTime + 0.5);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();

    return () => {
      if (oscillatorRef.current) {
        gainNodeRef.current?.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
        setTimeout(() => {
          oscillatorRef.current?.stop();
        }, 500);
      }
    };
  }, [currentZone]);

  const getZoneAudioConfig = (zone: string) => {
    const configs: { [key: string]: { frequency: number; waveType: OscillatorType; volume: number } } = {
      joy: { frequency: 440, waveType: 'sine', volume: 0.1 },
      sadness: { frequency: 220, waveType: 'triangle', volume: 0.08 },
      anger: { frequency: 880, waveType: 'sawtooth', volume: 0.12 },
      fear: { frequency: 110, waveType: 'square', volume: 0.06 },
      love: { frequency: 523, waveType: 'sine', volume: 0.09 },
      surprise: { frequency: 660, waveType: 'triangle', volume: 0.11 },
      peace: { frequency: 330, waveType: 'sine', volume: 0.07 },
      nostalgia: { frequency: 294, waveType: 'triangle', volume: 0.08 }
    };
    
    return configs[zone] || configs.peace;
  };

  return null; // This component only manages audio
};
