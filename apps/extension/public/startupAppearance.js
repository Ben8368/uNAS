(() => {
  const wallpapers = [
    'radial-gradient(ellipse at 12% 90%, #14798b 0%, transparent 58%), radial-gradient(ellipse at 85% 12%, #3b398c 0%, transparent 55%), linear-gradient(125deg, #071525, #172f53)',
    'radial-gradient(ellipse at 15% 15%, #a75775 0%, transparent 60%), radial-gradient(ellipse at 85% 85%, #454293 0%, transparent 55%), linear-gradient(130deg, #221e47, #492438)',
    'radial-gradient(ellipse at 20% 100%, #19796f 0%, transparent 62%), radial-gradient(ellipse at 95% 10%, #6173a5 0%, transparent 55%), linear-gradient(120deg, #132038, #182b46)',
    'radial-gradient(ellipse at 12% 85%, #947544 0%, transparent 60%), radial-gradient(ellipse at 90% 15%, #a97972 0%, transparent 55%), linear-gradient(140deg, #332b37, #62444b)',
    'radial-gradient(ellipse at 20% 20%, #365f7b 0%, transparent 60%), radial-gradient(ellipse at 90% 100%, #546c64 0%, transparent 50%), linear-gradient(140deg, #14292d, #1c273e)',
    'radial-gradient(ellipse at 15% 15%, #526071 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, #394561 0%, transparent 55%), linear-gradient(135deg, #171c27, #242c38)',
  ]

  try {
    const value = JSON.parse(localStorage.getItem('unas.appearance.v1') || '{}')
    if (value.schemaVersion !== 1) return

    const wallpaper = Number.isInteger(value.wallpaper) && wallpapers[value.wallpaper] ? value.wallpaper : 2
    const theme = value.themeMode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : value.themeMode
    const root = document.documentElement
    root.style.setProperty('--mt-wp', wallpapers[wallpaper])

    if (theme === 'light' || theme === 'dark') {
      root.className = theme
      root.dataset.theme = theme
      root.style.colorScheme = theme
    }
  } catch {
    // Invalid or unavailable local storage falls back to the default wallpaper.
  }
})()
