"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Mic, Square, Loader2 } from "lucide-react"
import { AudioVisualizer } from "@/components/functional/audio-vizualization"
import { transcribeAudio } from "@/actions/transcribe"


interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void
  onStreamingTranscription: (text: string) => void
  isProcessing: boolean
}

export function AudioRecorder({ onRecordingComplete, onStreamingTranscription, isProcessing }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current)
      }
      if (processorNodeRef.current && audioContextRef.current) {
        processorNodeRef.current.disconnect()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // Update parent component's recording state
  useEffect(() => {
    // This is a way to communicate the recording state to the parent component
    if (isRecording) {
      window.parent.postMessage({ type: "RECORDING_STATE", isRecording: true }, "*")
    } else {
      window.parent.postMessage({ type: "RECORDING_STATE", isRecording: false }, "*")
    }
  }, [isRecording])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Set up MediaRecorder for full recording with compatible format
      let mediaRecorder: MediaRecorder;
      let mimeType = '';
      
      // Check for supported formats - prioritize those explicitly supported by the transcription service
      const formats = [
        'audio/webm',
        'audio/ogg',
        'audio/mp3',
        'audio/mp4',
        'audio/wav',
        'audio/ogg;codecs=opus',
        'audio/mpeg',
        'audio/mpga',
        'audio/oga',
        'audio/flac',
        'audio/m4a'
      ];
      
      for (const format of formats) {
        if (MediaRecorder.isTypeSupported(format)) {
          mimeType = format;
          console.log(`Using format: ${format}`);
          break;
        }
      }
      
      if (mimeType) {
        mediaRecorder = new MediaRecorder(stream, { mimeType });
        console.log(`MediaRecorder initialized with MIME type: ${mimeType}`);
      } else {
        console.warn("No preferred formats supported, using default");
        mediaRecorder = new MediaRecorder(stream);
        console.log(`MediaRecorder initialized with default MIME type: ${mediaRecorder.mimeType}`);
      }
      
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { 
          type: mediaRecorder.mimeType
        })
        console.log("Recording completed, blob type:", audioBlob.type, "size:", audioBlob.size);
        onRecordingComplete(audioBlob)
      }

      // Request data every second to ensure we get chunks during recording
      mediaRecorder.start(1000)
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)

      // Set up streaming transcription
      setIsStreaming(true)
      setupStreamingTranscription(stream)
    } catch (error) {
      console.error("Error accessing microphone:", error)
    }
  }

  const setupStreamingTranscription = (stream: MediaStream) => {
    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    audioContextRef.current = audioContext

    // Create source node
    const source = audioContext.createMediaStreamSource(stream)

    // Create processor node for audio processing
    const processorNode = audioContext.createScriptProcessor(4096, 1, 1)
    processorNodeRef.current = processorNode

    // Buffer to collect audio data
    const audioChunks: Float32Array[] = []

    // Process audio data
    processorNode.onaudioprocess = (e) => {
      const audioData = e.inputBuffer.getChannelData(0)
      audioChunks.push(new Float32Array(audioData))
    }

    // Connect nodes
    source.connect(processorNode)
    processorNode.connect(audioContext.destination)

    // // Set up interval to process and send audio chunks every 2 seconds
    // streamingIntervalRef.current = setInterval(async () => {
    //   if (audioChunks.length > 0 && isRecording) {
    //     // Combine audio chunks
    //     const combinedLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0)
    //     const combinedAudio = new Float32Array(combinedLength)

    //     let offset = 0
    //     for (const chunk of audioChunks) {
    //       combinedAudio.set(chunk, offset)
    //       offset += chunk.length
    //     }

    //     // Convert to 16-bit PCM (required format for Whisper)
    //     const pcmData = new Int16Array(combinedAudio.length)
    //     for (let i = 0; i < combinedAudio.length; i++) {
    //       // Convert float to int16
    //       const s = Math.max(-1, Math.min(1, combinedAudio[i]))
    //       pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    //     }

    //     // Convert to Uint8Array for transmission
    //     const uint8Array = new Uint8Array(pcmData.buffer)

    //     // Send to server for transcription
    //     const result = await transcribeAudio(uint8Array)

    //     if (result.text && !result.error) {
    //       onStreamingTranscription(result.text)
    //     }

    //     // Clear processed chunks
    //     audioChunks.length = 0
    //   }
    // }, 2000) // Process every 2 seconds
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsStreaming(false)

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      // Clear streaming interval
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current)
        streamingIntervalRef.current = null
      }

      // Clean up audio processing
      if (processorNodeRef.current && audioContextRef.current) {
        processorNodeRef.current.disconnect()
      }

      // Stop all tracks of the stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return (
  
      <div className="p-6">
        <div className="flex flex-col items-center gap-6">
          <div className="w-full flex flex-col items-center justify-center gap-4 py-6">
            <div className="relative w-full">
              <AudioVisualizer isRecording={isRecording} />
             
            </div>

            {isRecording ? (
              <div className="flex flex-col items-center mt-4">
                <div className="text-2xl font-medium text-gray-900">{formatTime(recordingTime)}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {isStreaming ? "Recording & Transcribing..." : "Recording..."}
                </div>
              </div>
            ) : (
              <div className="text-base text-gray-600 mt-4">Ready to Record</div>
            )}
          </div>

          <div className="flex gap-4">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                disabled={isProcessing}
                size="lg"
                className="bg-gray-900 hover:bg-gray-800 text-white font-medium px-6 py-4 rounded-lg transition-colors duration-200"
              >
                <Mic className="mr-2 h-4 w-4" />
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                variant="outline"
                size="lg"
                className="border-gray-900 text-gray-900 hover:bg-gray-50 font-medium px-6 py-4 rounded-lg transition-colors duration-200"
              >
                <Square className="mr-2 h-4 w-4" />
                Stop Recording
              </Button>
            )}
          </div>

          {isProcessing && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing audio...
            </div>
          )}
        </div>
      </div>
   
  )
}
