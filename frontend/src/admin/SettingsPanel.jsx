/* Store info, offer pop-up and passcode change. */
import { useEffect, useRef, useState } from 'react';
import { useAdmin } from './store.jsx';
import { useConfirm } from './confirm.jsx';
import { Icon } from '../shared/Icon.jsx';
import { useToast } from '../shared/toast.jsx';

const toForm = (s) => ({
  ...s, promo: { ...s.promo }, currentPass: '', newPass: '',
  lat: s.lat == null ? '' : s.lat, lng: s.lng == null ? '' : s.lng, socialLinks: (s.socialLinks || []).join('\n')
});

export function SettingsPanel({ hidden, onPassChanged, focusPass }) {
  const admin = useAdmin(), toast = useToast(), confirm = useConfirm();
  const [f, setF] = useState(() => toForm(admin.settings));
  const formRef = useRef(null);

  useEffect(() => { setF(toForm(admin.settings)); }, [admin.settings]);
  useEffect(() => { if (focusPass) formRef.current.currentPass.focus(); }, [focusPass]);

  const field = (name, props = {}) => ({
    name, value: f[name] == null ? '' : f[name],
    onChange: (e) => setF((x) => ({ ...x, [name]: e.target.value })), ...props
  });
  const promo = (name, props = {}) => ({
    name: 'promo.' + name, value: f.promo[name] == null ? '' : f.promo[name],
    onChange: (e) => setF((x) => ({ ...x, promo: { ...x.promo, [name]: e.target.value } })), ...props
  });

  async function submit(e) {
    e.preventDefault();
    const form = formRef.current;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const num = (v) => +v;
    const s = {
      phone: f.phone.trim(), whatsapp: String(f.whatsapp).trim(), address: f.address.trim(), hoursOpen: f.hoursOpen, hoursClose: f.hoursClose,
      deliveryMins: num(f.deliveryMins), deliveryFee: num(f.deliveryFee), freeDeliveryOver: num(f.freeDeliveryOver), currency: f.currency.trim(),
      name: admin.settings.name,
      street: f.street.trim(), city: f.city.trim(), region: f.region.trim(), postalCode: f.postalCode.trim(),
      country: f.country.trim(), currencyCode: f.currencyCode.trim(), lat: f.lat === '' ? null : f.lat, lng: f.lng === '' ? null : f.lng,
      mapsUrl: f.mapsUrl.trim(), socialLinks: f.socialLinks.split(/\s+/).filter(Boolean), dineIn: !!f.dineIn, takeaway: !!f.takeaway,
      promo: { enabled: !!f.promo.enabled, headline: f.promo.headline.trim(), code: String(f.promo.code).trim().toUpperCase(), percent: num(f.promo.percent), delaySec: num(f.promo.delaySec) }
    };
    const pass = f.newPass, current = f.currentPass;
    if (pass && pass.length < 8) { toast('New passcode must be at least 8 characters', 'error'); form.newPass.focus(); return; }
    if (pass && !current) { toast('Enter your current passcode to change it', 'error'); form.currentPass.focus(); return; }
    try {
      if (pass) {
        await admin.setPass(current, pass);
        setF((x) => ({ ...x, newPass: '', currentPass: '' }));
        onPassChanged();
      }
      if (await admin.saveSettings(s)) toast(pass ? 'Settings and passcode saved' : 'Settings saved');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function reset() {
    if (await confirm('Reset store info and promo to defaults?', 'Reset')) {
      if (await admin.resetSettings()) toast('Settings reset');
    }
  }

  return (
    <div className="admin-panel" hidden={hidden}>
      <form ref={formRef} className="settings-grid" onSubmit={submit}>
        <fieldset>
          <legend>Store info</legend>
          <label className="field"><span>Phone</span><input type="tel" {...field('phone')} /></label>
          <label className="field"><span>WhatsApp number (country code, digits only)</span><input inputMode="numeric" pattern="[0-9]{8,15}" {...field('whatsapp')} /></label>
          <label className="field"><span>Address</span><input {...field('address')} /></label>
          <div className="field-row">
            <label className="field"><span>Opens</span><input type="time" {...field('hoursOpen')} /></label>
            <label className="field"><span>Closes</span><input type="time" {...field('hoursClose')} /></label>
          </div>
          <div className="field-row">
            <label className="field"><span>Delivery time (min)</span><input type="number" min="5" max="180" {...field('deliveryMins')} /></label>
            <label className="field"><span>Delivery fee</span><input type="number" min="0" {...field('deliveryFee')} /></label>
          </div>
          <div className="field-row">
            <label className="field"><span>Free delivery over</span><input type="number" min="0" {...field('freeDeliveryOver')} /></label>
            <label className="field"><span>Currency</span><input maxLength="5" {...field('currency')} /></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Google &amp; local search</legend>
          <p className="tiny muted"><Icon name="info" /> Shown to Google as your restaurant's details. Keep them identical to your Google Business Profile.</p>
          <label className="field"><span>Street address</span><input maxLength="120" placeholder="e.g. Jhamsikhel Road" {...field('street')} /></label>
          <div className="field-row">
            <label className="field"><span>City</span><input required maxLength="60" {...field('city')} /></label>
            <label className="field"><span>Province / region</span><input maxLength="60" {...field('region')} /></label>
          </div>
          <div className="field-row">
            <label className="field"><span>Postal code</span><input maxLength="12" {...field('postalCode')} /></label>
            <label className="field"><span>Country code</span><input maxLength="2" pattern="[A-Za-z]{2}" {...field('country')} /></label>
          </div>
          <div className="field-row">
            <label className="field"><span>Latitude</span><input type="number" step="any" min="-90" max="90" placeholder="27.7172" {...field('lat')} /></label>
            <label className="field"><span>Longitude</span><input type="number" step="any" min="-180" max="180" placeholder="85.3240" {...field('lng')} /></label>
          </div>
          <label className="field"><span>Google Maps link</span><input type="url" placeholder="https://maps.app.goo.gl/…" {...field('mapsUrl')} /></label>
          <label className="field"><span>Social profiles <em>(one link per line)</em></span>
            <textarea rows="3" placeholder={'https://facebook.com/…\nhttps://instagram.com/…'} value={f.socialLinks} onChange={(e) => setF((x) => ({ ...x, socialLinks: e.target.value }))} />
          </label>
          <div className="field-row">
            <label className="field"><span>Currency code</span><input maxLength="3" pattern="[A-Za-z]{3}" {...field('currencyCode')} /></label>
          </div>
          <label className="switch"><input type="checkbox" checked={!!f.dineIn} onChange={(e) => setF((x) => ({ ...x, dineIn: e.target.checked }))} /><span /> Dine-in tables</label>
          <label className="switch"><input type="checkbox" checked={!!f.takeaway} onChange={(e) => setF((x) => ({ ...x, takeaway: e.target.checked }))} /><span /> Takeaway / pickup</label>
        </fieldset>
        <fieldset>
          <legend>Offer pop-up</legend>
          <label className="switch">
            <input type="checkbox" name="promo.enabled" checked={!!f.promo.enabled} onChange={(e) => setF((x) => ({ ...x, promo: { ...x.promo, enabled: e.target.checked } }))} /><span /> Show offer pop-up
          </label>
          <label className="field"><span>Headline</span><input maxLength="80" {...promo('headline')} /></label>
          <div className="field-row">
            <label className="field"><span>Code</span><input maxLength="20" {...promo('code')} /></label>
            <label className="field"><span>% off (one 22" pizza)</span><input type="number" min="1" max="90" {...promo('percent')} /></label>
          </div>
          <label className="field"><span>Delay before showing (seconds)</span><input type="number" min="0" max="60" {...promo('delaySec')} /></label>
          <a href="/?offer=1" target="_blank" rel="noopener" className="btn btn-outline btn-sm"><Icon name="external" /> Preview pop-up</a>
        </fieldset>
        <fieldset>
          <legend>Security</legend>
          <label className="field"><span>Current passcode</span><input type="password" autoComplete="current-password" {...field('currentPass')} /></label>
          <label className="field"><span>New passcode <em>(8+ characters)</em></span><input type="password" minLength="8" maxLength="128" autoComplete="new-password" {...field('newPass')} /></label>
          <p className="tiny muted"><Icon name="shield" /> Leave both blank to keep the current passcode. Changing it signs out every other device.</p>
        </fieldset>
        <div className="settings-actions">
          <button type="submit" className="btn btn-red">Save settings</button>
          <button type="button" className="btn btn-link danger" onClick={reset}>Reset to defaults</button>
        </div>
      </form>
    </div>
  );
}
