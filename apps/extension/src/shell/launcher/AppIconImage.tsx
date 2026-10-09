type AppIconImageProps = {
  src: string
  alt: string
  variant?: 'desktop' | 'launcher'
}

export function AppIconImage({ src, alt, variant = 'desktop' }: AppIconImageProps) {
  return (
    <div className={`app-icon-img app-icon-img--${variant}`}>
      <img src={src} alt={alt} draggable={false} onError={(event) => {
        const fallback = '/static/app/icons/default/settings.svg'
        if (!event.currentTarget.src.endsWith(fallback)) event.currentTarget.src = fallback
      }} />
    </div>
  )
}
