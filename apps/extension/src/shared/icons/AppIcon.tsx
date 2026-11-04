import { FALLBACK_ICON } from './appIcons'

type AppIconProps = {
  src: string
  /** Empty for decorative icons beside a visible label or inside a named button. */
  alt?: string
  variant?: 'desktop' | 'launcher' | 'dock' | 'window'
}

/** Shared local artwork, sizing and bounded fallback for every App surface. */
export function AppIcon({ src, alt = '', variant = 'desktop' }: AppIconProps) {
  return (
    <img
      key={src}
      className={`app-icon-img app-icon-img--${variant}`}
      src={src}
      alt={alt}
      draggable={false}
      onError={(event) => {
        const image = event.currentTarget
        // Compare the attribute, not the browser-resolved URL; stop if fallback also fails.
        if (image.getAttribute('src') !== FALLBACK_ICON) image.src = FALLBACK_ICON
      }}
    />
  )
}
