(() => {
  const definitions = [
    [125, '12% 90%', '85% 12%', ['79 70 91', '101 82 99', '24 23 30', '31 27 35', '41 34 44'], ['0.3098 0.2745 0.3569', '0.3961 0.3216 0.3882', '0.0941 0.0902 0.1176', '0.1216 0.1059 0.1373', '0.1608 0.1333 0.1725']],
    [130, '15% 15%', '85% 85%', ['111 76 93', '81 76 103', '31 24 34', '41 28 43', '51 33 48'], ['0.4353 0.2980 0.3647', '0.3176 0.2980 0.4039', '0.1216 0.0941 0.1333', '0.1608 0.1098 0.1686', '0.2000 0.1294 0.1882']],
    [120, '20% 100%', '95% 10%', ['70 82 91', '92 82 106', '22 25 32', '29 32 42', '38 36 53'], ['0.2745 0.3216 0.3569', '0.3608 0.3216 0.4157', '0.0863 0.0980 0.1255', '0.1137 0.1255 0.1647', '0.1490 0.1412 0.2078']],
    [140, '12% 85%', '90% 15%', ['105 86 72', '113 82 92', '32 28 29', '42 33 37', '53 38 46'], ['0.4118 0.3373 0.2824', '0.4431 0.3216 0.3608', '0.1255 0.1098 0.1137', '0.1647 0.1294 0.1451', '0.2078 0.1490 0.1804']],
    [140, '20% 20%', '90% 100%', ['71 88 84', '105 91 91', '22 27 29', '29 35 38', '38 42 51'], ['0.2784 0.3451 0.3294', '0.4118 0.3569 0.3569', '0.0863 0.1059 0.1137', '0.1137 0.1373 0.1490', '0.1490 0.1647 0.2000']],
    [135, '15% 15%', '80% 100%', ['81 77 86', '91 84 105', '24 24 29', '31 30 38', '39 37 49'], ['0.3176 0.3020 0.3373', '0.3569 0.3294 0.4118', '0.0941 0.0941 0.1137', '0.1216 0.1176 0.1490', '0.1529 0.1451 0.1922']],
  ]
  const gradient = ([angle, primaryPosition, secondaryPosition, srgb, p3], gamut) => {
    const palette = gamut === 'p3' ? p3 : srgb
    const color = (channels, alpha = '1') => gamut === 'p3' ? `color(display-p3 ${channels} / ${alpha})` : `rgb(${channels} / ${alpha})`
    return [
      `radial-gradient(in oklab ellipse at ${primaryPosition}, ${color(palette[0], '.72')} 0%, ${color(palette[0], '.48')} 30%, ${color(palette[0], '.18')} 57%, ${color(palette[0], '0')} 80%)`,
      `radial-gradient(in oklab ellipse at ${secondaryPosition}, ${color(palette[1], '.64')} 0%, ${color(palette[1], '.42')} 28%, ${color(palette[1], '.16')} 55%, ${color(palette[1], '0')} 78%)`,
      `linear-gradient(in oklab ${angle}deg, ${color(palette[2])} 0%, ${color(palette[3])} 52%, ${color(palette[4])} 100%)`,
    ].join(', ')
  }
  const wallpapers = definitions.map((definition) => ({ srgb: gradient(definition, 'srgb'), p3: gradient(definition, 'p3') }))

  // Tab surfaces are always dark, including before React and with stale preferences.
  const root = document.documentElement
  root.className = 'dark'
  root.dataset.theme = 'dark'
  root.style.colorScheme = 'dark'

  try {
    const storedValue = JSON.parse(localStorage.getItem('unas.appearance.v1') || '{}')
    const value = storedValue.schemaVersion === 1 ? storedValue : {}

    const wallpaper = Number.isInteger(value.wallpaper) && wallpapers[value.wallpaper] ? value.wallpaper : 2
    root.style.setProperty('--mt-wp-srgb', wallpapers[wallpaper].srgb)
    root.style.setProperty('--mt-wp-p3', wallpapers[wallpaper].p3)

  } catch {
    // Invalid or unavailable local storage falls back to the default wallpaper.
  }
})()
