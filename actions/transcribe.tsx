"use server"

import { experimental_transcribe as transcribe } from "ai"
import { createAzure } from '@ai-sdk/azure'

// Fallback MP3 URL for testing
const TEST_MP3_URL = "https://download.samplelib.com/mp3/sample-3s.mp3"

export async function transcribeAudio(formData: FormData) {
  try {
    const audioFile = formData.get("audio") as File
    const useTestAudio = formData.get("useTestAudio") === "true"

    if (!audioFile && !useTestAudio) {
      return { error: "No audio file provided" }
    }

    // Azure client setup
    const azure = createAzure({
      resourceName: process.env.AZURE_RESOURCE_NAME || 'your-resource-name',
      apiKey: process.env.AZURE_RESOURCE_KEY || 'your-api-key',
    })
    
    // If useTestAudio is true or we've failed before, use the test MP3
    if (useTestAudio) {
      console.log("Using test MP3 URL for transcription")
      
      const result = await transcribe({
        model: azure.transcription('whisper'),
        audio: new URL(TEST_MP3_URL),
        providerOptions: {
          azure: {
            language: 'en',
         fileName: audioFile.name,  
        }
        },
      })
      
      return {
        text: result.text + " (NOTE: This is from a test audio, not your recording)",
        durationInSeconds: result.durationInSeconds,
        segments: result.segments,
        language: result.language,
      }
    }
    
    // Otherwise try with the provided audio file
    console.log(`Received audio file: ${audioFile.name}, type: ${audioFile.type}, size: ${audioFile.size} bytes`)
    
    // Extract file extension and handle the buffer
    let fileExtension = 'mp3'
    if (audioFile.name && audioFile.name.includes('.')) {
      const nameParts = audioFile.name.split('.')
      fileExtension = nameParts[nameParts.length - 1].toLowerCase()
    } else if (audioFile.type) {
      if (audioFile.type.includes('webm')) fileExtension = 'webm'
      else if (audioFile.type.includes('mp3')) fileExtension = 'mp3'
      else if (audioFile.type.includes('wav')) fileExtension = 'wav'
    }
    
    console.log(`Using file extension: ${fileExtension}`)

    const arrayBuffer = await audioFile.arrayBuffer()
    const audioData = Buffer.from(arrayBuffer)
    
    // Critical fix: Add the name property to the buffer
    Object.defineProperty(audioData, 'name', { value: `audio.${fileExtension}` })
    console.log(`Added name property to buffer: ${(audioData as any).name}`)
    
    try {
      const result = await transcribe({
        model: azure.transcription('whisper'),
        audio: audioData,
        providerOptions: {
          azure: {
            language: 'en',
            fileName: audioFile.name,
          }
        },
      })
  
      return {
        text: result.text,
        durationInSeconds: result.durationInSeconds,
        segments: result.segments,
        language: result.language,
      }
    } catch (fileError: any) {
      console.error("Error with file transcription, falling back to test audio:", fileError)
      
      // If file transcription fails, try with the test MP3
      const result = await transcribe({
        model: azure.transcription('whisper'),
        audio: new URL(TEST_MP3_URL),
        providerOptions: {
          azure: {
            language: 'en',
         fileName: audioFile.name,  
        }
        },
      })
      
      return {
        text: result.text + " (NOTE: This is from a test audio, not your recording)",
        durationInSeconds: result.durationInSeconds,
        segments: result.segments,
        language: result.language,
      }
    }
  } catch (error: any) {
    console.error("Transcription error:", error)
    return { error: `Failed to transcribe audio: ${error?.message || error}` }
  }
}
