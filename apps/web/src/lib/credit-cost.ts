// ---------------------------------------------------------------------------
// Centralized credit cost calculation for all modules
// ---------------------------------------------------------------------------
// These functions determine how many credits a job costs based on its
// parameters. The goal is to ensure every job is profitable by matching
// credit cost to actual API expense (LLM, TTS, video gen, storage).
// ---------------------------------------------------------------------------

/**
 * Reels — cost scales with duration due to RunwayML + ElevenLabs
 * 5-15s: ~$0.15-0.25 API cost → 1 credit
 * 30s:   ~$0.40 API cost       → 2 credits
 * 60s:   ~$0.70-1.00 API cost  → 3 credits
 */
export function getReelCreditCost(durationSeconds: number): number {
  if (durationSeconds <= 15) return 1
  if (durationSeconds <= 30) return 2
  return 3
}

/**
 * Long-Form Videos — cost scales with duration (script gen + TTS + AI clips)
 * 5 min:  ~$1.50 API cost → 3 credits
 * 10 min: ~$2.50 API cost → 5 credits
 * 15 min: ~$3.50 API cost → 7 credits
 * 20 min: ~$4.50 API cost → 9 credits
 * 30 min: ~$5.00+ API cost → 12 credits
 */
export function getLongFormCreditCost(durationMinutes: number): number {
  if (durationMinutes <= 5) return 3
  if (durationMinutes <= 10) return 5
  if (durationMinutes <= 15) return 7
  if (durationMinutes <= 20) return 9
  return 12
}

/**
 * Challenges — cost scales with question count + voice
 * 1-3 questions, no voice: ~$0.10 API cost → 1 credit
 * 5 questions OR voice:    ~$0.25 API cost → 2 credits
 * 5 questions + voice:     ~$0.40 API cost → 3 credits
 */
export function getChallengeCreditCost(numQuestions: number, voiceEnabled: boolean): number {
  let cost = 1
  if (numQuestions >= 5) cost += 1
  if (voiceEnabled) cost += 1
  return cost
}

/**
 * Gameplay — cost scales with duration (LLM config gen + canvas rendering + FFmpeg)
 * 15s: ~$0.15 API cost → 1 credit
 * 30s: ~$0.25 API cost → 2 credits
 * 45-60s: ~$0.40 API cost → 3 credits
 */
export function getGameplayCreditCost(duration: number): number {
  if (duration <= 15) return 1
  if (duration <= 30) return 2
  return 3
}

/**
 * Cartoon Studio — flat cost (multiple TTS calls per scene + story gen)
 * 8-10 scenes × TTS: ~$2.00 API cost → 5 credits
 */
export function getCartoonCreditCost(): number {
  return 5
}

/**
 * Quotes — flat cost (cheapest module, just LLM text gen)
 * ~$0.05-0.10 API cost → 1 credit
 */
export function getQuoteCreditCost(): number {
  return 1
}

/**
 * Image Studio — cost scales with image count + voice narration
 * 1 image, no voice:       ~$0.10 API cost → 1 credit
 * 2-3 images OR voice:     ~$0.25 API cost → 2 credits
 * 4-5 images + voice:      ~$0.40 API cost → 3 credits
 */
export function getImageStudioCreditCost(imageCount: number, voiceEnabled: boolean): number {
  if (imageCount <= 1 && !voiceEnabled) return 1
  if (imageCount <= 3 || voiceEnabled) return 2
  return 3
}
