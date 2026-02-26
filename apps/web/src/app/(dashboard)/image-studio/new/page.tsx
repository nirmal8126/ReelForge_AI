'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ImagePlus,
  Film,
  Sparkles,
  Upload,
  X,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Mic,
  Volume2,
  VolumeX,
  Check,
} from 'lucide-react'
import { SUPPORTED_LANGUAGES, ASPECT_RATIOS } from '@/lib/constants'
import { getImageStudioCreditCost } from '@/lib/credit-cost'

const TRANSITION_STYLES = [
  { value: 'fade', label: 'Fade', description: 'Smooth cross-fade between images' },
  { value: 'slide', label: 'Slide', description: 'Slide images left to right' },
  { value: 'zoom', label: 'Zoom', description: 'Zoom in/out between images' },
  { value: 'ken_burns', label: 'Ken Burns', description: 'Slow pan and zoom effect' },
]

const MAX_IMAGES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export default function ImageStudioNewPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Step 1: Images
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])

  // Step 2: Settings
  const [mode, setMode] = useState<'video' | 'enhance'>('video')
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [language, setLanguage] = useState('hi')
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<string>('9:16')
  const [transitionStyle, setTransitionStyle] = useState('fade')

  const creditCost = getImageStudioCreditCost(imageFiles.length || 1, voiceEnabled)

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return

    const newFiles: File[] = []
    const newPreviews: string[] = []

    for (let i = 0; i < files.length; i++) {
      if (imageFiles.length + newFiles.length >= MAX_IMAGES) break

      const file = files[i]
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        toast.error(`${file.name}: Invalid format. Use PNG, JPEG, or WebP`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: Too large. Maximum 10MB`)
        continue
      }

      newFiles.push(file)
      newPreviews.push(URL.createObjectURL(file))
    }

    setImageFiles((prev) => [...prev, ...newFiles])
    setImagePreviews((prev) => [...prev, ...newPreviews])
  }, [imageFiles.length])

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index])
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
    setUploadedUrls((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const uploadImages = async (): Promise<string[]> => {
    if (uploadedUrls.length === imageFiles.length) return uploadedUrls

    setUploading(true)
    try {
      const formData = new FormData()
      imageFiles.forEach((file) => formData.append('images', file))

      const res = await fetch('/api/image-studio/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Upload failed')
      }

      const data = await res.json()
      setUploadedUrls(data.urls)
      return data.urls
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload images')
      throw err
    } finally {
      setUploading(false)
    }
  }

  const handleNext = async () => {
    if (step === 1) {
      if (imageFiles.length === 0) {
        toast.error('Please upload at least one image')
        return
      }
      // Upload images before proceeding
      try {
        await uploadImages()
        setStep(2)
      } catch {
        // Error already shown via toast
      }
    } else if (step === 2) {
      setStep(3)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      let urls = uploadedUrls
      if (urls.length !== imageFiles.length) {
        urls = await uploadImages()
      }

      const res = await fetch('/api/image-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          title: title || undefined,
          prompt: prompt || undefined,
          imageUrls: urls,
          language,
          voiceEnabled,
          aspectRatio,
          transitionStyle,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create job')
      }

      const data = await res.json()
      toast.success('Image Studio job started!')
      router.push(`/image-studio/${data.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create job')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/image-studio')}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Image Studio
        </button>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
            <ImagePlus className="h-5 w-5 text-brand-400" />
          </div>
          New Image Studio Project
        </h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => s < step && setStep(s)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              s === step
                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                : s < step
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20 cursor-pointer'
                  : 'bg-white/[0.03] text-gray-600 border border-white/[0.06]'
            }`}
          >
            {s < step ? <Check className="h-4 w-4" /> : <span className="w-4 text-center">{s}</span>}
            {s === 1 ? 'Upload' : s === 2 ? 'Settings' : 'Review'}
          </button>
        ))}
      </div>

      {/* Step 1: Upload Images */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Drop zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="relative rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] p-8 text-center hover:border-brand-500/30 transition cursor-pointer"
            onClick={() => document.getElementById('image-input')?.click()}
          >
            <input
              id="image-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <Upload className="h-10 w-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-1">
              Drag & drop images or click to browse
            </p>
            <p className="text-xs text-gray-600">
              PNG, JPEG, WebP up to 10MB each ({imageFiles.length}/{MAX_IMAGES})
            </p>
          </div>

          {/* Image previews */}
          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {imagePreviews.map((preview, idx) => (
                <div key={idx} className="relative group rounded-lg overflow-hidden border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt={`Upload ${idx + 1}`} className="w-full aspect-square object-cover" />
                  <button
                    onClick={(e) => { e.stopPropagation(); removeImage(idx) }}
                    className="absolute top-2 right-2 h-6 w-6 rounded-full bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-xs text-gray-300">
                    {imageFiles[idx]?.name.substring(0, 20)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Settings */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Mode selector */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-3 block">Output Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('video')}
                className={`flex items-center gap-3 p-4 rounded-xl border transition text-left ${
                  mode === 'video'
                    ? 'border-brand-500/40 bg-brand-500/10'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
                }`}
              >
                <Film className={`h-6 w-6 ${mode === 'video' ? 'text-brand-400' : 'text-gray-500'}`} />
                <div>
                  <p className={`text-sm font-medium ${mode === 'video' ? 'text-white' : 'text-gray-400'}`}>Create Video</p>
                  <p className="text-xs text-gray-600">Narrated slideshow with transitions</p>
                </div>
              </button>
              <button
                onClick={() => setMode('enhance')}
                className={`flex items-center gap-3 p-4 rounded-xl border transition text-left ${
                  mode === 'enhance'
                    ? 'border-brand-500/40 bg-brand-500/10'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
                }`}
              >
                <Sparkles className={`h-6 w-6 ${mode === 'enhance' ? 'text-brand-400' : 'text-gray-500'}`} />
                <div>
                  <p className={`text-sm font-medium ${mode === 'enhance' ? 'text-white' : 'text-gray-400'}`}>Enhance Images</p>
                  <p className="text-xs text-gray-600">AI-powered image enhancement</p>
                </div>
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="text-sm font-medium text-gray-300 mb-2 block">
              Title <span className="text-gray-600">(optional)</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your project a name..."
              maxLength={255}
              className="w-full rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 transition"
            />
          </div>

          {/* Prompt */}
          <div>
            <label htmlFor="prompt" className="text-sm font-medium text-gray-300 mb-2 block">
              Description / Context <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what these images are about to help AI generate better narration..."
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500 transition resize-none"
            />
          </div>

          {/* Language */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Language</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                    language === lang.code
                      ? 'border-brand-500/40 bg-brand-500/10 text-brand-300'
                      : 'border-white/[0.06] bg-white/[0.02] text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>

          {/* Voice toggle */}
          {mode === 'video' && (
            <div>
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border transition ${
                  voiceEnabled
                    ? 'border-green-500/30 bg-green-500/10'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
                }`}
              >
                {voiceEnabled ? (
                  <Volume2 className="h-5 w-5 text-green-400" />
                ) : (
                  <VolumeX className="h-5 w-5 text-gray-500" />
                )}
                <div className="flex-1 text-left">
                  <p className={`text-sm font-medium ${voiceEnabled ? 'text-white' : 'text-gray-400'}`}>
                    Voice Narration
                  </p>
                  <p className="text-xs text-gray-600">
                    {voiceEnabled ? 'AI will narrate the slideshow' : 'Enable AI voice narration'}
                  </p>
                </div>
                <div className={`h-5 w-9 rounded-full transition ${voiceEnabled ? 'bg-green-500' : 'bg-gray-700'}`}>
                  <div className={`h-4 w-4 rounded-full bg-white mt-0.5 transition-all ${voiceEnabled ? 'ml-4.5' : 'ml-0.5'}`} />
                </div>
              </button>
            </div>
          )}

          {/* Video-only settings */}
          {mode === 'video' && (
            <>
              {/* Aspect ratio */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Aspect Ratio</label>
                <div className="flex gap-3">
                  {ASPECT_RATIOS.map((ar) => (
                    <button
                      key={ar}
                      onClick={() => setAspectRatio(ar)}
                      className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition ${
                        aspectRatio === ar
                          ? 'border-brand-500/40 bg-brand-500/10 text-brand-300'
                          : 'border-white/[0.06] bg-white/[0.02] text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {ar}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transition style */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Transition Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {TRANSITION_STYLES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTransitionStyle(t.value)}
                      className={`p-3 rounded-lg border text-left transition ${
                        transitionStyle === t.value
                          ? 'border-brand-500/40 bg-brand-500/10'
                          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
                      }`}
                    >
                      <p className={`text-sm font-medium ${transitionStyle === t.value ? 'text-white' : 'text-gray-400'}`}>
                        {t.label}
                      </p>
                      <p className="text-xs text-gray-600">{t.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Review Your Project</h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Mode</p>
                <p className="text-white capitalize">{mode === 'video' ? 'Create Video' : 'Enhance Images'}</p>
              </div>
              <div>
                <p className="text-gray-500">Images</p>
                <p className="text-white">{imageFiles.length} image{imageFiles.length > 1 ? 's' : ''}</p>
              </div>
              <div>
                <p className="text-gray-500">Language</p>
                <p className="text-white">{SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name || language}</p>
              </div>
              {mode === 'video' && (
                <>
                  <div>
                    <p className="text-gray-500">Voice Narration</p>
                    <p className="text-white">{voiceEnabled ? 'Enabled' : 'Disabled'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Aspect Ratio</p>
                    <p className="text-white">{aspectRatio}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Transition</p>
                    <p className="text-white capitalize">{transitionStyle.replace('_', ' ')}</p>
                  </div>
                </>
              )}
              {title && (
                <div className="col-span-2">
                  <p className="text-gray-500">Title</p>
                  <p className="text-white">{title}</p>
                </div>
              )}
              {prompt && (
                <div className="col-span-2">
                  <p className="text-gray-500">Description</p>
                  <p className="text-white">{prompt}</p>
                </div>
              )}
            </div>

            {/* Image thumbnails */}
            <div className="flex gap-2 pt-2">
              {imagePreviews.map((preview, idx) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={idx}
                  src={preview}
                  alt={`Image ${idx + 1}`}
                  className="h-16 w-16 rounded-lg object-cover border border-white/10"
                />
              ))}
            </div>
          </div>

          {/* Cost */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Estimated Cost</p>
              <p className="text-xs text-gray-500">Or 1 job from your monthly quota</p>
            </div>
            <p className="text-lg font-bold text-brand-400">{creditCost} credit{creditCost > 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]">
        {step > 1 ? (
          <button
            onClick={() => setStep(step - 1)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/[0.06] transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          <div />
        )}

        {step < 3 ? (
          <button
            onClick={handleNext}
            disabled={uploading || (step === 1 && imageFiles.length === 0)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-green-600/20"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Start Processing
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
