export function Kpi({ label, val, cls }) {
  return <div className={'kpi ' + (cls || '')}><b>{val}</b><span>{label}</span></div>;
}
