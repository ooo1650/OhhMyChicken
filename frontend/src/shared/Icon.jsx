import { dietLabel, esc } from './format.js';

// Icon from the shared SVG sprite (name without the "i-" prefix).
export function Icon({ name, className }) {
  return <svg className={'i' + (className ? ' ' + className : '')} aria-hidden="true"><use href={'/assets/icons.svg#i-' + name} /></svg>;
}
// Same icon as an HTML string, for chatbot replies.
export const iconHtml = (name) => '<svg class="i" aria-hidden="true"><use href="/assets/icons.svg#i-' + name + '"/></svg>';

// Veg / non-veg mark as used on food packaging in Nepal & India:
// green square with a dot = veg, red square with a triangle = non-veg.
export function DietMark({ diet }) {
  const label = dietLabel(diet);
  return <span className={'diet-mark ' + (diet === 'veg' ? 'is-veg' : 'is-nonveg')} role="img" aria-label={label} title={label} />;
}
export const dietMarkHtml = (d) => {
  const label = esc(dietLabel(d));
  return '<span class="diet-mark ' + (d === 'veg' ? 'is-veg' : 'is-nonveg') + '" role="img" aria-label="' + label + '" title="' + label + '"></span>';
};
