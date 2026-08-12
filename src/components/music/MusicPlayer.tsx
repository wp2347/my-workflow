"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Play, Pause, Loader2, RotateCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/i18n"
import { requestPlay, releasePlay } from "@/components/music/playerBus"

interface MusicPlayerProps {
  audioUrl: string
  fileName?: string
  compact?: boolean
  className?: string
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

const RADIUS = 15
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function MusicPlayer({ audioUrl, fileName, compact = false, className }: MusicPlayerProps) {
  const { t } = useTranslation()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(false)
  const [seekValue, setSeekValue] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onPlay = () => {
      requestPlay(audio)
      setPlaying(true)
    }
    const onPause = () => {
      releasePlay(audio)
      setPlaying(false)
    }
    const onEnded = () => { releasePlay(audio); setPlaying(false); setSeekValue(0); setCurrentTime(0) }
    const onTime = () => { setCurrentTime(audio.currentTime); setSeekValue(audio.currentTime) }
    const onLoaded = () => setDuration(audio.duration || 0)
    const onWaiting = () => setLoading(true)
    const onCanPlay = () => { setLoading(false); setError(false) }
    const onError = () => { setLoading(false); setError(true) }
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("timeupdate", onTime)
    audio.addEventListener("loadedmetadata", onLoaded)
    audio.addEventListener("durationchange", onLoaded)
    audio.addEventListener("waiting", onWaiting)
    audio.addEventListener("canplay", onCanPlay)
    audio.addEventListener("error", onError)
    return () => {
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("timeupdate", onTime)
      audio.removeEventListener("loadedmetadata", onLoaded)
      audio.removeEventListener("durationchange", onLoaded)
      audio.removeEventListener("waiting", onWaiting)
      audio.removeEventListener("canplay", onCanPlay)
      audio.removeEventListener("error", onError)
      releasePlay(audio)
    }
  }, [audioUrl])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play().catch(() => setError(true))
    } else {
      audio.pause()
    }
  }, [])

  const handleSeek = (value: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = value
    setCurrentTime(value)
    setSeekValue(value)
  }

  const handleRetry = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setError(false)
    setLoading(true)
    audio.load()
    audio.play().catch(() => setError(true))
  }, [])

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0
  const dashOffset = CIRCUMFERENCE * (1 - progress)
  const timeLabel = duration > 0 ? `${formatTime(currentTime)} / ${formatTime(duration)}` : formatTime(currentTime)

  const equalizerBars = Array.from({ length: 5 })

  return (
    <div className={cn("select-none", className)}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className={cn("flex items-center gap-3", compact ? "px-0.5 py-0.5" : "px-1")}>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={togglePlay}
            disabled={error}
            aria-label={playing ? t("audioResult.pause") : t("audioResult.play")}
            className={cn(
              "relative grid place-items-center rounded-full bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-md shadow-purple-500/25 transition-transform hover:scale-105 active:scale-95 disabled:opacity-60 disabled:hover:scale-100",
              compact ? "h-9 w-9" : "h-10 w-10",
            )}
          >
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 48 48" aria-hidden>
              <circle cx="24" cy="24" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3.5" />
              <circle
                cx="24"
                cy="24"
                r={RADIUS}
                fill="none"
                stroke="white"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                className="transition-[stroke-dashoffset] duration-150"
              />
            </svg>
            {loading ? (
              <Loader2 className={cn(compact ? "h-4 w-4" : "h-4.5 w-4.5") + " animate-spin"} />
            ) : playing ? (
              <Pause className={cn(compact ? "h-4 w-4" : "h-4.5 w-4.5")} />
            ) : (
              <Play className={cn(compact ? "h-4 w-4" : "h-4.5 w-4.5") + " translate-x-[0.5px]"} />
            )}
          </button>
          {!compact && playing && (
            <div className="absolute -right-1.5 -bottom-1 flex items-end gap-[2px] rounded-md bg-card p-1 shadow-sm">
              {equalizerBars.map((_, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-purple-600 animate-equalizer"
                  style={{ height: `${4 + i * 2}px`, animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              {fileName && (
                <div className={cn("truncate font-mono text-foreground", compact ? "text-[10px]" : "text-xs")}>{fileName}</div>
              )}
            </div>
            {!compact && (
              <div className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">{timeLabel}</div>
            )}
          </div>

          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 0}
            step={0.1}
            value={seekValue}
            onChange={(e) => handleSeek(Number(e.target.value))}
            disabled={duration <= 0}
            aria-label={t("audioResult.seek")}
            className={cn(
              "mt-1.5 w-full cursor-pointer appearance-none rounded-full",
              "h-1.5 bg-purple-100 dark:bg-purple-950",
              "disabled:opacity-50",
              "[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-600 [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white",
            )}
            style={{
              backgroundImage: duration > 0
                ? `linear-gradient(to right, #7c3aed ${progress * 100}%, transparent ${progress * 100}%)`
                : undefined,
            }}
          />
          {compact && (
            <div className="mt-0.5 font-mono text-[9px] text-muted-foreground tabular-nums">{timeLabel}</div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-1 flex items-center gap-2">
          <p className="text-[10px] text-destructive">{t("audioResult.unavailable")}</p>
          <button
            type="button"
            onClick={handleRetry}
            aria-label={t("audioResult.retry")}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RotateCw className="h-3 w-3" />
            {t("audioResult.retry")}
          </button>
        </div>
      )}
    </div>
  )
}
