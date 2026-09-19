import 'unas-src/styles/material-lab.css'

const materials = [
  { id: 'unipass', label: 'UniPass 参考', detail: 'rgba(.42) · blur 18 · saturate 155%' },
  { id: 'current', label: '原 uNAS', detail: 'navigation rgba(.88) · blur 16' },
  { id: 'candidate', label: 'Liquid Glass 候选', detail: '独立 window / navigation / dialog token' },
] as const

export function MaterialLab() {
  return (
    <main className="mt-material-lab" aria-labelledby="material-lab-title">
      <header className="mt-material-lab__header">
        <p>开发专用 · 不会打包为产品入口</p>
        <h1 id="material-lab-title">Liquid Glass 材质对比</h1>
        <span>同一高细节环境分别检视深色、浅色与高频背景采样。</span>
      </header>
      <div className="mt-material-lab__scenes">
        {(['dark', 'light', 'detail'] as const).map((scene) => (
          <section key={scene} className={`mt-material-lab__scene mt-material-lab__scene--${scene}`} aria-label={`${scene} 材质场景`}>
            <h2>{scene === 'dark' ? '深色环境' : scene === 'light' ? '浅色环境' : '高细节环境'}</h2>
            <div className="mt-material-lab__samples">
              {materials.map((material) => (
                <article key={material.id} className={`mt-material-lab__glass mt-material-lab__glass--${material.id}`}>
                  <div className="mt-material-lab__reflection" />
                  <div className="mt-material-lab__card-copy">
                    <strong>{material.label}</strong>
                    <span>{material.detail}</span>
                  </div>
                  <div className="mt-material-lab__readable">正文保持可读，不再遮住整块外壳。</div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
