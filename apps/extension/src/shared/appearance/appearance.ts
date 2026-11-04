/** Original procedural backgrounds: no remote resources or decoded bitmap allocation. */
type WallpaperPalette = {
  primary: string
  secondary: string
  baseStart: string
  baseMiddle: string
  baseEnd: string
}

type WallpaperDefinition = {
  name: string
  angle: number
  primaryPosition: string
  secondaryPosition: string
  srgb: WallpaperPalette
  p3: WallpaperPalette
}

function createGradient(definition: WallpaperDefinition, gamut: 'srgb' | 'p3') {
  const palette = definition[gamut]
  const color = (channels: string, alpha = '1') => gamut === 'p3'
    ? `color(display-p3 ${channels} / ${alpha})`
    : `rgb(${channels} / ${alpha})`

  return [
    `radial-gradient(in oklab ellipse at ${definition.primaryPosition}, ${color(palette.primary, '.72')} 0%, ${color(palette.primary, '.48')} 30%, ${color(palette.primary, '.18')} 57%, ${color(palette.primary, '0')} 80%)`,
    `radial-gradient(in oklab ellipse at ${definition.secondaryPosition}, ${color(palette.secondary, '.64')} 0%, ${color(palette.secondary, '.42')} 28%, ${color(palette.secondary, '.16')} 55%, ${color(palette.secondary, '0')} 78%)`,
    `linear-gradient(in oklab ${definition.angle}deg, ${color(palette.baseStart)} 0%, ${color(palette.baseMiddle)} 52%, ${color(palette.baseEnd)} 100%)`,
  ].join(', ')
}

const definitions: readonly WallpaperDefinition[] = [
  { name: '深海', angle: 125, primaryPosition: '12% 90%', secondaryPosition: '85% 12%', srgb: { primary: '79 70 91', secondary: '101 82 99', baseStart: '24 23 30', baseMiddle: '31 27 35', baseEnd: '41 34 44' }, p3: { primary: '0.3098 0.2745 0.3569', secondary: '0.3961 0.3216 0.3882', baseStart: '0.0941 0.0902 0.1176', baseMiddle: '0.1216 0.1059 0.1373', baseEnd: '0.1608 0.1333 0.1725' } },
  { name: '暮光', angle: 130, primaryPosition: '15% 15%', secondaryPosition: '85% 85%', srgb: { primary: '111 76 93', secondary: '81 76 103', baseStart: '31 24 34', baseMiddle: '41 28 43', baseEnd: '51 33 48' }, p3: { primary: '0.4353 0.2980 0.3647', secondary: '0.3176 0.2980 0.4039', baseStart: '0.1216 0.0941 0.1333', baseMiddle: '0.1608 0.1098 0.1686', baseEnd: '0.2000 0.1294 0.1882' } },
  { name: '极光', angle: 120, primaryPosition: '20% 100%', secondaryPosition: '95% 10%', srgb: { primary: '70 82 91', secondary: '92 82 106', baseStart: '22 25 32', baseMiddle: '29 32 42', baseEnd: '38 36 53' }, p3: { primary: '0.2745 0.3216 0.3569', secondary: '0.3608 0.3216 0.4157', baseStart: '0.0863 0.0980 0.1255', baseMiddle: '0.1137 0.1255 0.1647', baseEnd: '0.1490 0.1412 0.2078' } },
  { name: '沙丘', angle: 140, primaryPosition: '12% 85%', secondaryPosition: '90% 15%', srgb: { primary: '105 86 72', secondary: '113 82 92', baseStart: '32 28 29', baseMiddle: '42 33 37', baseEnd: '53 38 46' }, p3: { primary: '0.4118 0.3373 0.2824', secondary: '0.4431 0.3216 0.3608', baseStart: '0.1255 0.1098 0.1137', baseMiddle: '0.1647 0.1294 0.1451', baseEnd: '0.2078 0.1490 0.1804' } },
  { name: '远山', angle: 140, primaryPosition: '20% 20%', secondaryPosition: '90% 100%', srgb: { primary: '71 88 84', secondary: '105 91 91', baseStart: '22 27 29', baseMiddle: '29 35 38', baseEnd: '38 42 51' }, p3: { primary: '0.2784 0.3451 0.3294', secondary: '0.4118 0.3569 0.3569', baseStart: '0.0863 0.1059 0.1137', baseMiddle: '0.1137 0.1373 0.1490', baseEnd: '0.1490 0.1647 0.2000' } },
  { name: '石墨', angle: 135, primaryPosition: '15% 15%', secondaryPosition: '80% 100%', srgb: { primary: '81 77 86', secondary: '91 84 105', baseStart: '24 24 29', baseMiddle: '31 30 38', baseEnd: '39 37 49' }, p3: { primary: '0.3176 0.3020 0.3373', secondary: '0.3569 0.3294 0.4118', baseStart: '0.0941 0.0941 0.1137', baseMiddle: '0.1216 0.1176 0.1490', baseEnd: '0.1529 0.1451 0.1922' } },
]

export const WALLPAPERS = definitions.map((definition) => ({
  name: definition.name,
  gradientSrgb: createGradient(definition, 'srgb'),
  gradientP3: createGradient(definition, 'p3'),
}))
