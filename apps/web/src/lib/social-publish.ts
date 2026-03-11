import { readFile } from 'fs/promises'
import path from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PublishOptions {
  accessToken: string
  accountId: string
  videoUrl: string
  title: string
  description?: string
  format?: string // 'video' | 'shorts' | 'reels' | 'post'
  isImage?: boolean
  textContent?: string // For text-only content (e.g. quotes)
}

export interface PublishResult {
  success: boolean
  platformPostId?: string
  platformUrl?: string
  errorMessage?: string
}

// ---------------------------------------------------------------------------
// Media resolver — file:// / relative / http URLs → Buffer
// ---------------------------------------------------------------------------

async function getMediaData(
  url: string
): Promise<{ data: ArrayBuffer; contentType: string }> {
  // Handle file:// URLs (dev mode stores videos locally)
  if (url.startsWith('file://')) {
    const filePath = url.replace('file://', '')
    const buf = await readFile(filePath)
    // Copy to a plain ArrayBuffer (not SharedArrayBuffer)
    const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    const ext = path.extname(filePath).toLowerCase()
    const contentType =
      ext === '.mp4'
        ? 'video/mp4'
        : ext === '.webm'
          ? 'video/webm'
          : ext === '.mov'
            ? 'video/quicktime'
            : ext === '.png'
              ? 'image/png'
              : ext === '.jpg' || ext === '.jpeg'
                ? 'image/jpeg'
                : ext === '.webp'
                  ? 'image/webp'
                  : 'application/octet-stream'
    return { data, contentType }
  }

  // Handle relative API URLs (e.g. /api/reels/xxx/video)
  let resolvedUrl = url
  if (url.startsWith('/')) {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    resolvedUrl = `${baseUrl}${url}`
  }

  const res = await fetch(resolvedUrl)
  if (!res.ok) {
    throw new Error(`Failed to fetch media: ${res.status} ${res.statusText}`)
  }

  const data = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') || 'video/mp4'
  return { data, contentType }
}

// ---------------------------------------------------------------------------
// YouTube — Data API v3 resumable upload
// ---------------------------------------------------------------------------

async function publishToYouTube(options: PublishOptions): Promise<PublishResult> {
  try {
    if (!options.videoUrl) {
      return { success: false, errorMessage: 'YouTube requires a video file to publish' }
    }

    const { data, contentType } = await getMediaData(options.videoUrl)
    const blob = new Blob([data], { type: contentType })

    const isShorts = options.format === 'shorts'
    let title =
      isShorts && !options.title.includes('#Shorts')
        ? `${options.title} #Shorts`
        : options.title

    // YouTube title limit is 100 characters
    if (title.length > 100) {
      title = title.slice(0, 97).replace(/\s+\S*$/, '') + '...'
    }

    // Step 1 — Initiate resumable upload session
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': contentType,
          'X-Upload-Content-Length': String(data.byteLength),
        },
        body: JSON.stringify({
          snippet: {
            title,
            description: options.description || '',
            categoryId: '22', // People & Blogs
          },
          status: {
            privacyStatus: 'public',
            selfDeclaredMadeForKids: false,
          },
        }),
      }
    )

    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}))
      return {
        success: false,
        errorMessage: `YouTube upload init failed: ${(err as Record<string, { message?: string }>).error?.message || initRes.statusText}`,
      }
    }

    const uploadUrl = initRes.headers.get('location')
    if (!uploadUrl) {
      return { success: false, errorMessage: 'YouTube did not return an upload URL' }
    }

    // Step 2 — Upload the video binary
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(data.byteLength),
      },
      body: blob,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}))
      return {
        success: false,
        errorMessage: `YouTube upload failed: ${(err as Record<string, { message?: string }>).error?.message || uploadRes.statusText}`,
      }
    }

    const video = await uploadRes.json()

    return {
      success: true,
      platformPostId: video.id,
      platformUrl: isShorts
        ? `https://www.youtube.com/shorts/${video.id}`
        : `https://www.youtube.com/watch?v=${video.id}`,
    }
  } catch (err) {
    return {
      success: false,
      errorMessage: `YouTube error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ---------------------------------------------------------------------------
// Facebook — Graph API v21.0
// ---------------------------------------------------------------------------

async function publishToFacebook(options: PublishOptions): Promise<PublishResult> {
  try {
    // Text-only post (e.g. quotes without images)
    if (!options.videoUrl && options.textContent) {
      const textRes = await fetch(
        `https://graph.facebook.com/v21.0/${options.accountId}/feed`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: options.textContent,
            access_token: options.accessToken,
          }),
        }
      )
      const textData = await textRes.json()

      if (!textRes.ok || textData.error) {
        return {
          success: false,
          errorMessage: `Facebook text post failed: ${textData.error?.message || textRes.statusText}`,
        }
      }

      return {
        success: true,
        platformPostId: textData.id,
        platformUrl: textData.id
          ? `https://www.facebook.com/${textData.id.replace('_', '/posts/')}`
          : undefined,
      }
    }

    // Image post (e.g. quote images)
    if (options.isImage) {
      const { data: mediaData } = await getMediaData(options.videoUrl)
      const formData = new FormData()
      formData.append('source', new Blob([mediaData]), 'photo.jpg')
      formData.append('message', options.description || options.title)
      formData.append('access_token', options.accessToken)

      const photoRes = await fetch(
        `https://graph.facebook.com/v21.0/${options.accountId}/photos`,
        { method: 'POST', body: formData }
      )
      const photoData = await photoRes.json()

      if (!photoRes.ok || photoData.error) {
        return {
          success: false,
          errorMessage: `Facebook photo failed: ${photoData.error?.message || photoRes.statusText}`,
        }
      }

      return {
        success: true,
        platformPostId: photoData.post_id || photoData.id,
        platformUrl: photoData.post_id
          ? `https://www.facebook.com/${photoData.post_id}`
          : `https://www.facebook.com/photo/?fbid=${photoData.id}`,
      }
    }

    // Video upload
    const { data } = await getMediaData(options.videoUrl)
    const isReels = options.format === 'reels'

    if (isReels) {
      // Facebook Reels — 3-step upload
      // Step 1: Initialize
      const initRes = await fetch(
        `https://graph.facebook.com/v21.0/${options.accountId}/video_reels`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            upload_phase: 'start',
            access_token: options.accessToken,
          }),
        }
      )
      const initData = await initRes.json()
      if (!initRes.ok || initData.error) {
        return {
          success: false,
          errorMessage: `Facebook Reels init failed: ${initData.error?.message || initRes.statusText}`,
        }
      }

      const videoId = initData.video_id

      // Step 2: Upload binary
      const uploadRes = await fetch(
        `https://rupload.facebook.com/video-upload/v21.0/${videoId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `OAuth ${options.accessToken}`,
            'Content-Type': 'application/octet-stream',
            offset: '0',
            file_size: String(data.byteLength),
          },
          body: new Blob([data], { type: 'application/octet-stream' }),
        }
      )
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || uploadData.error) {
        return {
          success: false,
          errorMessage: `Facebook Reels upload failed: ${uploadData.error?.message || uploadRes.statusText}`,
        }
      }

      // Step 3: Finish and publish
      const finishRes = await fetch(
        `https://graph.facebook.com/v21.0/${options.accountId}/video_reels`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            upload_phase: 'finish',
            video_id: videoId,
            title: options.title,
            description: options.description || '',
            access_token: options.accessToken,
          }),
        }
      )
      const finishData = await finishRes.json()
      if (!finishRes.ok || finishData.error) {
        return {
          success: false,
          errorMessage: `Facebook Reels publish failed: ${finishData.error?.message || finishRes.statusText}`,
        }
      }

      return {
        success: true,
        platformPostId: videoId,
        platformUrl: `https://www.facebook.com/reel/${videoId}`,
      }
    }

    // Regular video post
    const formData = new FormData()
    formData.append('source', new Blob([data]), 'video.mp4')
    formData.append('title', options.title)
    formData.append('description', options.description || '')
    formData.append('access_token', options.accessToken)

    const videoRes = await fetch(
      `https://graph.facebook.com/v21.0/${options.accountId}/videos`,
      { method: 'POST', body: formData }
    )
    const videoData = await videoRes.json()

    if (!videoRes.ok || videoData.error) {
      return {
        success: false,
        errorMessage: `Facebook video failed: ${videoData.error?.message || videoRes.statusText}`,
      }
    }

    return {
      success: true,
      platformPostId: videoData.id,
      platformUrl: `https://www.facebook.com/${options.accountId}/videos/${videoData.id}`,
    }
  } catch (err) {
    return {
      success: false,
      errorMessage: `Facebook error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ---------------------------------------------------------------------------
// Instagram — Content Publishing API via Graph API v21.0
// ---------------------------------------------------------------------------

async function publishToInstagram(options: PublishOptions): Promise<PublishResult> {
  try {
    if (!options.videoUrl) {
      return { success: false, errorMessage: 'Instagram requires media (image or video) to publish' }
    }

    const isReels = options.format === 'reels'

    // Instagram API requires a publicly accessible URL for media
    // For local file:// or relative URLs, we can't use Instagram directly
    if (options.videoUrl.startsWith('file://') || options.videoUrl.startsWith('/')) {
      return {
        success: false,
        errorMessage:
          'Instagram requires a publicly accessible media URL. Upload your content to a CDN first.',
      }
    }

    const caption = options.description || options.title

    if (options.isImage) {
      // Image post
      const createRes = await fetch(
        `https://graph.facebook.com/v21.0/${options.accountId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: options.videoUrl,
            caption,
            access_token: options.accessToken,
          }),
        }
      )
      const createData = await createRes.json()
      if (!createRes.ok || createData.error) {
        return {
          success: false,
          errorMessage: `Instagram media failed: ${createData.error?.message || createRes.statusText}`,
        }
      }

      const publishRes = await fetch(
        `https://graph.facebook.com/v21.0/${options.accountId}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: createData.id,
            access_token: options.accessToken,
          }),
        }
      )
      const publishData = await publishRes.json()
      if (!publishRes.ok || publishData.error) {
        return {
          success: false,
          errorMessage: `Instagram publish failed: ${publishData.error?.message || publishRes.statusText}`,
        }
      }

      return {
        success: true,
        platformPostId: publishData.id,
        platformUrl: `https://www.instagram.com/`,
      }
    }

    // Video / Reels — create media container
    const createRes = await fetch(
      `https://graph.facebook.com/v21.0/${options.accountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: isReels ? 'REELS' : 'VIDEO',
          video_url: options.videoUrl,
          caption,
          access_token: options.accessToken,
        }),
      }
    )
    const createData = await createRes.json()
    if (!createRes.ok || createData.error) {
      return {
        success: false,
        errorMessage: `Instagram media failed: ${createData.error?.message || createRes.statusText}`,
      }
    }

    // Poll for processing completion (Instagram processes async)
    const containerId = createData.id
    let status = 'IN_PROGRESS'
    let attempts = 0

    while (status === 'IN_PROGRESS' && attempts < 30) {
      await new Promise((r) => setTimeout(r, 5000))

      const statusRes = await fetch(
        `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${options.accessToken}`
      )
      const statusData = await statusRes.json()
      status = statusData.status_code || 'ERROR'
      attempts++
    }

    if (status !== 'FINISHED') {
      return {
        success: false,
        errorMessage: `Instagram processing failed (status: ${status})`,
      }
    }

    // Publish the container
    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${options.accountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: options.accessToken,
        }),
      }
    )
    const publishData = await publishRes.json()
    if (!publishRes.ok || publishData.error) {
      return {
        success: false,
        errorMessage: `Instagram publish failed: ${publishData.error?.message || publishRes.statusText}`,
      }
    }

    return {
      success: true,
      platformPostId: publishData.id,
      platformUrl: `https://www.instagram.com/`,
    }
  } catch (err) {
    return {
      success: false,
      errorMessage: `Instagram error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function publishToPlatform(
  platform: string,
  options: PublishOptions
): Promise<PublishResult> {
  switch (platform) {
    case 'YOUTUBE':
      return publishToYouTube(options)
    case 'FACEBOOK':
      return publishToFacebook(options)
    case 'INSTAGRAM':
      return publishToInstagram(options)
    default:
      return { success: false, errorMessage: `Unsupported platform: ${platform}` }
  }
}
