/* Menu drawings (shared/food-art.js) rendered from strings that never contain user input. */
import { artSvg } from '../shared/food-art.js';

export const iconFor = artSvg;

// An SVG string, inside a wrapper element.
export function Art({ html, as: Tag = 'div', ...rest }) {
  return <Tag {...rest} dangerouslySetInnerHTML={{ __html: html }} />;
}
