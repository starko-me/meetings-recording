'use client'
import { AudioRecorder } from "@/components/functional/recorder";
import { useState, useEffect } from "react";
import { AudioPlayer } from "@/components/functional/audio-player";
import { transcribeAudio } from "@/actions/transcribe";
import { Button } from "@/components/ui/button";

// Define types for transcription result
type TranscriptionResult = {
  text: string;
  durationInSeconds: number;
  segments: any[];
  language: string;
};

type TranscriptionError = {
  error: string;
};

// Helper function to ensure type safety
function isTranscriptionError(result: any): result is TranscriptionError {
  return 'error' in result;
}

export default function Home() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Clean up the URL when component unmounts
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleRecordingComplete = async (blob: Blob) => {
    // Revoke previous URL to prevent memory leaks
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    
    // Save the blob for later use
    setAudioBlob(blob);
    
    // Create a URL for the audio player
    const url = URL.createObjectURL(blob);
    console.log("Created URL for blob:", url, "with type:", blob.type, "size:", blob.size);
    setAudioUrl(url);
    
    // Create a file from the blob - maintain the original blob type
    // This ensures the file format is correctly preserved
    const fileExtension = blob.type.includes('webm') ? 'webm' : 
                         blob.type.includes('mp3') ? 'mp3' : 
                         blob.type.includes('wav') ? 'wav' : 'mp3';
                         
    console.log(`Using extension: ${fileExtension} based on type: ${blob.type}`);
    
    const audioFile = new File([blob], `recording.${fileExtension}`, { 
      type: blob.type || `audio/${fileExtension}` 
    });
    
    // Process the file for transcription
    await handleFileSelected(audioFile);
  };
  
  const handleFileSelected = async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
      
      const formData = new FormData();
      formData.append("audio", file);

      const result = await transcribeAudio(formData);

      if (isTranscriptionError(result)) {
        // Result is an error
        const errorResult = result as TranscriptionError;
        setError(errorResult.error);
        setTranscription(null);
      } else {
        // Result is a successful transcription
        const transcriptionResult = result as TranscriptionResult;
        // Ensure we always have a string
        if (typeof transcriptionResult.text === 'string') {
          setTranscription(transcriptionResult.text);
        } else {
          setTranscription("Transcription successful but no text was returned");
        }
        setError(null);
      }
    } catch (err) {
      console.error("Error processing file:", err);
      setError("Failed to process file");
      setTranscription(null);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Function to test with sample audio
  const handleTestSampleAudio = async () => {
    try {
      // Use a well-known sample MP3
      const sampleAudioUrl = "https://download.samplelib.com/mp3/sample-3s.mp3";
      
      // Fetch the sample audio to create a proper file
      const response = await fetch(sampleAudioUrl);
      const audioBlob = await response.blob();
      
      // Save the blob for playback
      setAudioBlob(audioBlob);
      
      // Create a URL for the audio player
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      
      // Create a file from the blob
      const audioFile = new File([audioBlob], "sample-audio.mp3", { type: "audio/mp3" });
      
      // Process the file
      await handleFileSelected(audioFile);
    } catch (error) {
      console.error("Sample audio error:", error);
      setError("Error processing sample audio");
    }
  };
  
  // Use server-side test audio directly
  const handleUseTestAudio = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      // Create a FormData with only the useTestAudio flag
      const formData = new FormData();
      formData.append("useTestAudio", "true");
      
      const result = await transcribeAudio(formData);
      
      if (isTranscriptionError(result)) {
        setError(result.error);
        setTranscription(null);
      } else {
        // Ensure we always have a string
        if (typeof result.text === 'string') {
          setTranscription(result.text);
        } else {
          setTranscription("Transcription successful but no text was returned");
        }
        setError(null);
      }
    } catch (err) {
      console.error("Error using test audio:", err);
      setError("Failed to transcribe test audio");
      setTranscription(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white container mx-auto px-4">
      <div className="py-8">
        <AudioRecorder 
          onRecordingComplete={handleRecordingComplete}
          onStreamingTranscription={() => {}}
          isProcessing={isProcessing}
        />
        
        <div className="mt-6 flex justify-center gap-4">
          <Button 
            onClick={handleTestSampleAudio}
            disabled={isProcessing}
            variant="outline"
            className="text-sm"
          >
            Test with Sample Audio
          </Button>
          
          <Button 
            onClick={handleUseTestAudio}
            disabled={isProcessing}
            variant="secondary"
            className="text-sm bg-green-100 hover:bg-green-200"
          >
            Use Server Test Audio
          </Button>
        </div>
        
        {error && (
          <div className="mt-4 flex justify-center">
            <Button
              onClick={handleUseTestAudio}
              variant="destructive"
              size="sm"
              className="text-xs"
            >
              Transcription Failed - Try with Server Audio Instead
            </Button>
          </div>
        )}
        
        {audioUrl && (
          <div className="mt-10">
            <AudioPlayer audioUrl={audioUrl} />
            <div className="mt-4 text-center">
              <a 
                href={audioUrl}
                download={audioBlob?.type.includes('webm') ? "recording.webm" : "recording.mp3"}
                className="text-sm text-zinc-600 hover:text-zinc-900 underline"
              >
                Download Recording
              </a>
            </div>
          </div>
        )}
        
        {isProcessing && (
          <div className="mt-10 p-4 bg-gray-50 rounded-xl flex items-center justify-center">
            <div className="animate-pulse">Transcribing audio...</div>
          </div>
        )}
        
        {error && !isProcessing && (
          <div className="mt-10 p-4 bg-red-50 rounded-xl">
            <h3 className="text-lg font-medium text-red-800 mb-2">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}
        
        {!isProcessing && transcription && (
          <div className="mt-10 p-4 bg-gray-50 rounded-xl">
            <h3 className="text-lg font-medium mb-2">Transcription</h3>
            <p className="text-gray-700">{transcription}</p>
          </div>
        )}
      </div>
    </div>
  );
}
