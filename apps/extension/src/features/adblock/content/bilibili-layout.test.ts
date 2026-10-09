import { expect, it } from 'vitest';
import { bilibiliLayoutStyle } from './bilibili-layout';

it('limits layout repair to Bilibili with active grid-card filters', () => {
  const selectors = ['.feed-card:has(.bili-video-card a[href^="https://cm.bilibili.com/"])'];
  expect(bilibiliLayoutStyle('www.bilibili.com', selectors)).toContain('margin-top:0!important');
  expect(bilibiliLayoutStyle('example.org', selectors)).toBe('');
  expect(bilibiliLayoutStyle('www.bilibili.com', [])).toBe('');
  expect(bilibiliLayoutStyle('www.bilibili.com', ['.ad-report.strip-ad'])).toBe('');
});
