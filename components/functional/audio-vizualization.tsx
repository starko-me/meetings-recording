"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"

interface AudioVisualizerProps {
  isRecording: boolean
}

export function AudioVisualizer({ isRecording }: AudioVisualizerProps) {
  const [amplitudes, setAmplitudes] = useState<number[]>([0, 0, 0])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  // Keep track of recent max values for dynamic scaling
  const recentMaxValues = useRef<number[]>([0, 0, 0]);

  useEffect(() => {
    if (isRecording) {
      startVisualization()
    } else {
      stopVisualization()
    }

    return () => stopVisualization()
  }, [isRecording])

  const startVisualization = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)

      analyser.fftSize = 256 // Increased for more detailed visualization
      analyser.smoothingTimeConstant = 0.4 // Reduced for more responsive visualization

      source.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser
      sourceRef.current = source

      updateAmplitudes()
    } catch (error) {
      console.error("Error accessing microphone:", error)
    }
  }

  const stopVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setAmplitudes([0, 0, 0])
  }

  const updateAmplitudes = () => {
    const analyser = analyserRef.current
    if (!analyser) return

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    
    const adaptationRate = 0.05; // How quickly we adapt to new max values
    
    const update = () => {
      animationFrameRef.current = requestAnimationFrame(update)
      analyser.getByteFrequencyData(dataArray)

      // Define ranges more appropriate for human hearing and typical audio
      const bassRange = { start: 0, end: 10 }; // Low frequencies (0-10)
      const midRange = { start: 10, end: 30 }; // Mid frequencies (10-30)
      const trebleRange = { start: 30, end: 80 }; // High frequencies (30-80)
      
      // Get maximum values for each range
      const getMaxForRange = (start: number, end: number) => {
        let max = 0;
        for (let i = start; i < Math.min(end, dataArray.length); i++) {
          if (dataArray[i] > max) max = dataArray[i];
        }
        return max;
      };
      
      // Get raw values
      const bassRaw = getMaxForRange(bassRange.start, bassRange.end);
      const midRaw = getMaxForRange(midRange.start, midRange.end);
      const trebleRaw = getMaxForRange(trebleRange.start, trebleRange.end);
      
      // Apply non-linear scaling (square root) to compress dynamic range
      // This prevents maxing out while still being responsive
      const compressDynamicRange = (value: number) => Math.sqrt(value / 255) * 100;
      
      // Apply different base gains for each range
      const bassGain = 1.2;
      const midGain = 1.7;
      const trebleGain = 2.2;
      
      // Calculate final values with compression
      const bassVal = compressDynamicRange(bassRaw) * bassGain;
      const midVal = compressDynamicRange(midRaw) * midGain;
      const trebleVal = compressDynamicRange(trebleRaw) * trebleGain;
      
      // Update recent max values with smoothing
      if (recentMaxValues.current) {
        recentMaxValues.current = recentMaxValues.current.map((val, idx) => {
          const newVal = [bassVal, midVal, trebleVal][idx];
          return val + (Math.max(val, newVal) - val) * adaptationRate;
        });
      }
      
      // Apply adaptive gain reduction when values get too high
      const adaptiveGain = (value: number, idx: number) => {
        if (!recentMaxValues.current) return value;
        const maxVal = recentMaxValues.current[idx];
        // If recent max is high, reduce gain to prevent maxing out
        const adaptiveScale = maxVal > 80 ? 80 / maxVal : 1;
        return value * adaptiveScale;
      };
      
      // Set final amplitudes with min/max constraints
      setAmplitudes([
        Math.min(90, Math.max(5, adaptiveGain(bassVal, 0))),
        Math.min(90, Math.max(5, adaptiveGain(midVal, 1))),
        Math.min(90, Math.max(5, adaptiveGain(trebleVal, 2)))
      ]);
    }

    update()
  }

  // Calculate max bar height based on container size (60% of container)
  const maxBarHeight = 60

  return (
    <div className="flex items-center justify-center w-full aspect-square max-w-[320px] mx-auto bg-zinc-900/90 backdrop-blur-md rounded-full border border-zinc-700/50 shadow-lg">
      <div className="relative flex items-center justify-center gap-4 h-full w-full max-w-[240px] p-0">
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-800/50 via-transparent to-zinc-800/50 opacity-70 rounded-full" />
        <div className="flex items-center justify-center gap-4 h-full">
          {amplitudes.map((amplitude, index) => {
            const barHeight = Math.min(maxBarHeight, Math.max(8, (amplitude / 100) * maxBarHeight))
            return (
              <motion.div
                key={index}
                className="relative w-4 rounded-full overflow-hidden z-10"
                initial={{ height: 10, y: 0 }}
                animate={{ 
                  height: `${barHeight}%`, 
                  y: 0 // Fixed position for proper centering
                }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 15,
                  mass: 0.5,
                  velocity: 2
                }}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                style={{
                  opacity: isRecording ? 1 : 0.5,
                  background: "linear-gradient(to top, rgba(220, 220, 255, 0.9), rgba(180, 180, 255, 0.6))"
                }}
              >
                <motion.div 
                  className="absolute inset-0"
                  initial={{ opacity: 0.6 }}
                  animate={{ 
                    opacity: [0.6, 0.9, 0.6]
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    ease: "easeInOut"
                  }}
                  style={{
                    background: "linear-gradient(to top, rgba(255, 255, 255, 0.7), rgba(200, 200, 255, 0.4))"
                  }}
                />
                <motion.div 
                  className="absolute inset-0 border-2 border-white/60 rounded-full"
                  animate={{
                    borderColor: ["rgba(255,255,255,0.4)", "rgba(255,255,255,0.8)", "rgba(255,255,255,0.4)"]
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    ease: "easeInOut"
                  }}
                />
                <motion.div
                  className="absolute bottom-0 w-full h-3/4"
                  animate={{
                    opacity: [0.5, 0.8, 0.5]
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    delay: index * 0.3,
                    ease: "easeInOut"
                  }}
                  style={{
                    background: "linear-gradient(to top, rgba(255, 255, 255, 0.7), transparent)"
                  }}
                />
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
