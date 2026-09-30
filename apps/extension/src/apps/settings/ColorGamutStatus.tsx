import { getColorGamutLabel, useColorGamut } from 'unas-src/hooks/useColorGamut'

export function ColorGamutStatus() {
  const gamut = useColorGamut()
  const label = getColorGamutLabel(gamut)
  return <span className="mt-window-status mt-window-color-gamut" title={`当前渲染色域：${label}`} aria-label={`当前渲染色域：${label}`}>{label}</span>
}
