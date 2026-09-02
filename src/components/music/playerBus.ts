let active: HTMLAudioElement | null = null

export function requestPlay(el: HTMLAudioElement): void {
  if (active && active !== el && !active.paused) {
    active.pause()
  }
  active = el
}

export function releasePlay(el: HTMLAudioElement): void {
  if (active === el) {
    active = null
  }
}
