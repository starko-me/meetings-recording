"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { Play, Pause, Volume2, VolumeX } from "lucide-react"

interface AudioPlayerProps {
  audioUrl: string
}

export function AudioPlayer({ audioUrl }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  // Reset everything when URL changes
  useEffect(() => {
    if (!audioUrl) return
    
    setLoading(true)
    
    // Create a new audio element to avoid browser caching issues
    const audio = new Audio()
    
    // Set up event listeners before setting the src
    // This ensures we catch all events
    const handleLoadedMetadata = () => {
      console.log("Metadata loaded for audio:", audioUrl)
      if (isFinite(audio.duration) && !isNaN(audio.duration)) {
        setDuration(audio.duration)
        setIsReady(true)
        setLoading(false)
        console.log("Duration set:", audio.duration)
      } else {
        console.warn("Invalid duration after metadata loaded:", audio.duration)
      }
    }
    
    const handleLoadedData = () => {
      console.log("Data loaded for audio:", audioUrl)
      // Backup handler in case loadedmetadata doesn't fire
      if (!isReady && isFinite(audio.duration) && !isNaN(audio.duration)) {
        setDuration(audio.duration)
        setIsReady(true)
        setLoading(false)
        console.log("Duration set from loadeddata:", audio.duration)
      }
    }
    
    const handleCanPlay = () => {
      console.log("Can play audio:", audioUrl)
      setLoading(false)
      
      // Another backup for duration
      if (!isReady && isFinite(audio.duration) && !isNaN(audio.duration)) {
        setDuration(audio.duration)
        setIsReady(true)
        console.log("Duration set from canplay:", audio.duration)
      }
    }
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      
      // Last resort fallback for duration
      if (!isReady && isFinite(audio.duration) && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration)
        setIsReady(true)
        console.log("Duration set from timeupdate:", audio.duration)
      }
    }
    
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      audio.currentTime = 0
    }
    
    const handleError = (e: Event) => {
      console.error("Audio error for URL:", audioUrl, e)
      setLoading(false)
      setIsReady(false)
    }
    
    // Configure audio
    audio.volume = volume
    audio.muted = isMuted
    audio.preload = 'auto'
    audio.crossOrigin = 'anonymous'
    
    // Attach event listeners
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('loadeddata', handleLoadedData)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError as EventListener)
    
    // Set as our ref
    if (audioRef.current) {
      audioRef.current.pause()
    }
    audioRef.current = audio
    
    // Reset state
    setIsPlaying(false)
    setCurrentTime(0)
    setIsReady(false)
    
    // Now set src after all event listeners are attached
    console.log("Setting audio src to:", audioUrl)
    audio.src = audioUrl
    
    // Try to load the audio
    try {
      audio.load()
    } catch (error) {
      console.error("Error loading audio:", error)
      setLoading(false)
    }
    
    return () => {
      // Clean up
      try {
        audio.pause()
        audio.src = ''
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
        audio.removeEventListener('loadeddata', handleLoadedData)
        audio.removeEventListener('canplay', handleCanPlay)
        audio.removeEventListener('timeupdate', handleTimeUpdate)
        audio.removeEventListener('ended', handleEnded)
        audio.removeEventListener('error', handleError as EventListener)
      } catch (error) {
        console.error("Error cleaning up audio:", error)
      }
    }
  }, [audioUrl])

  // Handle play/pause changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    
    if (isPlaying) {
      try {
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Play error:", error)
            setIsPlaying(false)
          })
        }
      } catch (error) {
        console.error("Error playing audio:", error)
        setIsPlaying(false)
      }
    } else {
      try {
        audio.pause()
      } catch (error) {
        console.error("Error pausing audio:", error)
      }
    }
  }, [isPlaying])

  // Update volume when it changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    
    try {
      audio.volume = volume
      audio.muted = isMuted
    } catch (error) {
      console.error("Error updating volume:", error)
    }
  }, [volume, isMuted])

  const togglePlayPause = () => {
    if (!isReady || loading) return
    setIsPlaying(!isPlaying)
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current || !isReady || duration <= 0) return
    
    try {
      const rect = progressRef.current.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const newTime = percent * duration
      
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    } catch (error) {
      console.error("Error setting time:", error)
    }
  }

  const toggleMute = () => {
    if (!audioRef.current) return
    
    const newMuted = !isMuted
    setIsMuted(newMuted)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return
    
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return "0:00"
    
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const progressPercent = isReady && duration > 0 
    ? `${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%`
    : "0%"

  return (
    <div className="w-full max-w-[600px] mx-auto">
      <div className="bg-zinc-900/80 backdrop-blur-md rounded-full p-3 w-full">
        <div className="flex items-center gap-3">
          {/* Play/Pause button */}
          <motion.button 
            onClick={togglePlayPause}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white
              ${isReady && !loading ? 'bg-white/10 cursor-pointer' : 'bg-white/5 cursor-not-allowed'}`}
            whileTap={isReady && !loading ? { scale: 0.9 } : undefined}
            disabled={!isReady || loading}
          >
            {loading ? (
              <motion.div 
                className="w-3 h-3 rounded-full bg-white/50"
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            ) : (
              isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />
            )}
          </motion.button>
          
          {/* Time display */}
          <div className="text-white/70 text-xs w-12">
            {formatTime(currentTime)}
          </div>
          
          {/* Progress bar */}
          <div className="flex-grow">
            <div 
              ref={progressRef}
              className={`relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden 
                ${isReady && !loading ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              onClick={isReady && !loading ? handleProgressClick : undefined}
            >
              {loading && (
                <motion.div 
                  className="absolute top-0 left-0 h-full bg-white/20 rounded-full"
                  animate={{ 
                    left: ["-20%", "100%"],
                    width: ["20%", "20%"]
                  }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
              )}
              {/* Progress indicator */}
              <div 
                className="absolute top-0 left-0 h-full bg-white/50 rounded-full transition-all duration-100 ease-linear"
                style={{ width: progressPercent }}
              />
            </div>
          </div>
          
          {/* Duration display */}
          <div className="text-white/70 text-xs w-12 text-right">
            {formatTime(duration)}
          </div>
          
          {/* Volume control */}
          <div className="relative flex items-center">
            <motion.button 
              onClick={toggleMute}
              className="w-8 h-8 flex items-center justify-center text-white/70"
              whileTap={{ scale: 0.9 }}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </motion.button>
            
            <div className="absolute right-0 top-full mt-2 bg-zinc-800 rounded-lg p-2 w-24 opacity-0 hover:opacity-100 transition-opacity invisible hover:visible z-10">
              <div className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-white/50 rounded-full"
                  style={{ width: `${volume * 100}%` }}
                />
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  value={volume} 
                  step="0.05"
                  onChange={handleVolumeChange}
                  className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 