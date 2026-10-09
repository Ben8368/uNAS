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
  { name: '深海', angle: 125, primaryPosition: '12% 90%', secondaryPosition: '85% 12%', srgb: { primary: '20 121 139', secondary: '59 57 140', baseStart: '7 21 37', baseMiddle: '11 29 51', baseEnd: '23 47 83' }, p3: { primary: '.05 .48 .58', secondary: '.22 .18 .65', baseStart: '.02 .07 .15', baseMiddle: '.04 .12 .25', baseEnd: '.08 .18 .39' } },
  { name: '暮光', angle: 130, primaryPosition: '15% 15%', secondaryPosition: '85% 85%', srgb: { primary: '167 87 117', secondary: '69 66 147', baseStart: '34 30 71', baseMiddle: '58 33 76', baseEnd: '73 36 56' }, p3: { primary: '.70 .30 .46', secondary: '.28 .24 .67', baseStart: '.09 .06 .28', baseMiddle: '.20 .10 .42', baseEnd: '.36 .13 .30' } },
  { name: '极光', angle: 120, primaryPosition: '20% 100%', secondaryPosition: '95% 10%', srgb: { primary: '25 121 111', secondary: '97 115 165', baseStart: '19 32 56', baseMiddle: '21 41 68', baseEnd: '24 43 70' }, p3: { primary: '.05 .48 .43', secondary: '.37 .45 .72', baseStart: '.05 .11 .22', baseMiddle: '.08 .17 .32', baseEnd: '.12 .25 .43' } },
  { name: '沙丘', angle: 140, primaryPosition: '12% 85%', secondaryPosition: '90% 15%', srgb: { primary: '148 117 68', secondary: '169 121 114', baseStart: '51 43 55', baseMiddle: '78 55 63', baseEnd: '98 68 75' }, p3: { primary: '.60 .46 .20', secondary: '.72 .42 .37', baseStart: '.16 .12 .18', baseMiddle: '.27 .18 .27', baseEnd: '.42 .27 .31' } },
  { name: '远山', angle: 140, primaryPosition: '20% 20%', secondaryPosition: '90% 100%', srgb: { primary: '54 95 123', secondary: '84 108 100', baseStart: '20 41 45', baseMiddle: '24 42 53', baseEnd: '28 39 62' }, p3: { primary: '.16 .39 .54', secondary: '.30 .44 .40', baseStart: '.06 .15 .18', baseMiddle: '.09 .21 .27', baseEnd: '.13 .20 .34' } },
  { name: '石墨', angle: 135, primaryPosition: '15% 15%', secondaryPosition: '80% 100%', srgb: { primary: '82 96 113', secondary: '57 69 97', baseStart: '23 28 39', baseMiddle: '29 37 50', baseEnd: '36 44 56' }, p3: { primary: '.26 .32 .42', secondary: '.18 .25 .42', baseStart: '.06 .08 .13', baseMiddle: '.11 .15 .21', baseEnd: '.16 .21 .29' } },
]

export const WALLPAPERS = definitions.map((definition) => ({
  name: definition.name,
  gradientSrgb: createGradient(definition, 'srgb'),
  gradientP3: createGradient(definition, 'p3'),
}))
