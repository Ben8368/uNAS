// Hidden grid items still count towards Bilibili's nth-of-type margins.
// Floor cards render live/anime recommendations beside regular feed cards;
// lazy loading also renders bare video skeletons and an anchor in this grid.
// Keep this compatibility CSS bundled; feeds cannot supply declarations.
export function bilibiliLayoutStyle(host: string, selectors: readonly string[]): string {
  if (host !== 'www.bilibili.com') return '';
  const filtersGridCards = selectors.some((selector) =>
    ['.feed-card:has(', '.bili-feed-card:has(', '.bili-video-card:has('].some((prefix) => selector.startsWith(prefix))
    && ['a[href^="https://cm.bilibili.com/"]', 'a[href^="//cm.bilibili.com/"]'].some((anchor) => selector.includes(anchor)));
  if (!filtersGridCards) return '';
  return '.recommended-container_floor-aside .container:has(a[href^="https://cm.bilibili.com/"],a[href^="//cm.bilibili.com/"]) > :is(.feed-card,.bili-feed-card,.floor-single-card,.bili-video-card,.load-more-anchor){margin-top:0!important}';
}
