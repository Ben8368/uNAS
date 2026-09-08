(() => {
  const definitions = [
    [125, '12% 90%', '85% 12%', ['20 121 139', '59 57 140', '7 21 37', '11 29 51', '23 47 83'], ['.05 .48 .58', '.22 .18 .65', '.02 .07 .15', '.04 .12 .25', '.08 .18 .39']],
    [130, '15% 15%', '85% 85%', ['167 87 117', '69 66 147', '34 30 71', '58 33 76', '73 36 56'], ['.70 .30 .46', '.28 .24 .67', '.09 .06 .28', '.20 .10 .42', '.36 .13 .30']],
    [120, '20% 100%', '95% 10%', ['25 121 111', '97 115 165', '19 32 56', '21 41 68', '24 43 70'], ['.05 .48 .43', '.37 .45 .72', '.05 .11 .22', '.08 .17 .32', '.12 .25 .43']],
    [140, '12% 85%', '90% 15%', ['148 117 68', '169 121 114', '51 43 55', '78 55 63', '98 68 75'], ['.60 .46 .20', '.72 .42 .37', '.16 .12 .18', '.27 .18 .27', '.42 .27 .31']],
    [140, '20% 20%', '90% 100%', ['54 95 123', '84 108 100', '20 41 45', '24 42 53', '28 39 62'], ['.16 .39 .54', '.30 .44 .40', '.06 .15 .18', '.09 .21 .27', '.13 .20 .34']],
    [135, '15% 15%', '80% 100%', ['82 96 113', '57 69 97', '23 28 39', '29 37 50', '36 44 56'], ['.26 .32 .42', '.18 .25 .42', '.06 .08 .13', '.11 .15 .21', '.16 .21 .29']],
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

  try {
    const storedValue = JSON.parse(localStorage.getItem('unas.appearance.v1') || '{}')
    const value = storedValue.schemaVersion === 1 ? storedValue : {}

    const wallpaper = Number.isInteger(value.wallpaper) && wallpapers[value.wallpaper] ? value.wallpaper : 2
    const theme = value.themeMode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : value.themeMode
    const root = document.documentElement
    root.style.setProperty('--mt-wp-srgb', wallpapers[wallpaper].srgb)
    root.style.setProperty('--mt-wp-p3', wallpapers[wallpaper].p3)

    if (theme === 'light' || theme === 'dark') {
      root.className = theme
      root.dataset.theme = theme
      root.style.colorScheme = theme
    }
  } catch {
    // Invalid or unavailable local storage falls back to the default wallpaper.
  }
})()
