'use client';
/* Ledgerline design system: every component, chart and helper. Generated from the published system, now the source of truth. */
import * as React from 'react';

const ICONS = {
"overview": "<rect x=\"3\" y=\"3\" width=\"7\" height=\"8\" rx=\"1.5\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"5\" rx=\"1.5\"/><rect x=\"3\" y=\"15\" width=\"7\" height=\"6\" rx=\"1.5\"/><rect x=\"14\" y=\"12\" width=\"7\" height=\"9\" rx=\"1.5\"/>",
"statement": "<path d=\"M6 3h8l4 4v14H6z\"/><path d=\"M14 3v4h4\"/><path d=\"M9 12h6\"/><path d=\"M9 16h4\"/>",
"balance": "<path d=\"M12 4v16\"/><path d=\"M8 20h8\"/><path d=\"M5 7h14\"/><path d=\"M5 7l-3 6a3 3 0 0 0 6 0z\"/><path d=\"M19 7l-3 6a3 3 0 0 0 6 0z\"/>",
"cashflow": "<path d=\"M4 8h13\"/><path d=\"M14 5l3 3-3 3\"/><path d=\"M20 16H7\"/><path d=\"M10 13l-3 3 3 3\"/>",
"forecast": "<path d=\"M3 18l5-5 4 3 3-4\"/><path d=\"M15 12l6-6\" stroke-dasharray=\"2 2.5\"/><path d=\"M3 21h18\"/>",
"scenario": "<circle cx=\"6\" cy=\"5\" r=\"2\"/><circle cx=\"6\" cy=\"19\" r=\"2\"/><circle cx=\"18\" cy=\"6\" r=\"2\"/><path d=\"M6 7v10\"/><path d=\"M18 8v1a5 5 0 0 1-5 5H8\"/>",
"ledger": "<path d=\"M5 5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2z\"/><path d=\"M5 20a2 2 0 0 0 2 1h12v-3\"/><path d=\"M9 7h6\"/><path d=\"M9 11h4\"/>",
"sync": "<path d=\"M4 12a8 8 0 0 1 14-5.3L20 8\"/><path d=\"M20 3v5h-5\"/><path d=\"M20 12a8 8 0 0 1-14 5.3L4 16\"/><path d=\"M4 21v-5h5\"/>",
"audit": "<rect x=\"5\" y=\"4\" width=\"14\" height=\"17\" rx=\"2\"/><path d=\"M9 2.5h6v3H9z\"/><path d=\"M9 13l2 2 4-4\"/>",
"team": "<circle cx=\"9\" cy=\"8\" r=\"3\"/><path d=\"M3 20a6 6 0 0 1 12 0\"/><circle cx=\"17\" cy=\"9\" r=\"2.5\"/><path d=\"M16 14.1a5 5 0 0 1 5 4.9\"/>",
"settings": "<path d=\"M4 6h9\"/><path d=\"M17 6h3\"/><circle cx=\"15\" cy=\"6\" r=\"2\"/><path d=\"M4 12h3\"/><path d=\"M11 12h9\"/><circle cx=\"9\" cy=\"12\" r=\"2\"/><path d=\"M4 18h11\"/><path d=\"M19 18h1\"/><circle cx=\"17\" cy=\"18\" r=\"2\"/>",
"boardpack": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"12\" rx=\"1.5\"/><path d=\"M12 16v4\"/><path d=\"M8 20h8\"/><path d=\"M7 12l3-3 2 2 4-4\"/>",
"plug": "<path d=\"M9 2v5\"/><path d=\"M15 2v5\"/><path d=\"M6 7h12v4a6 6 0 0 1-12 0z\"/><path d=\"M12 17v5\"/>",
"organisation": "<rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"1.5\"/><path d=\"M9 7h1\"/><path d=\"M14 7h1\"/><path d=\"M9 11h1\"/><path d=\"M14 11h1\"/><path d=\"M10 21v-4h4v4\"/>",
"bank": "<path d=\"M3 10h18\"/><path d=\"M4 10l8-6 8 6\"/><path d=\"M6 10v8\"/><path d=\"M10 10v8\"/><path d=\"M14 10v8\"/><path d=\"M18 10v8\"/><path d=\"M3 20h18\"/>",
"journal": "<path d=\"M9 4L7 20\"/><path d=\"M17 4l-2 16\"/><path d=\"M4 9h16\"/><path d=\"M3 15h16\"/>",
"euro": "<path d=\"M18 6.5A7 7 0 1 0 18 17.5\"/><path d=\"M4 10h9\"/><path d=\"M4 14h9\"/>",
"percent": "<path d=\"M19 5L5 19\"/><circle cx=\"7\" cy=\"7\" r=\"2.5\"/><circle cx=\"17\" cy=\"17\" r=\"2.5\"/>",
"trend-up": "<path d=\"M3 17l6-6 4 4 8-8\"/><path d=\"M15 7h6v6\"/>",
"trend-down": "<path d=\"M3 7l6 6 4-4 8 8\"/><path d=\"M15 17h6v-6\"/>",
"runway": "<path d=\"M3 19h18\"/><path d=\"M5 15l4-4 3 3 7-7\"/><path d=\"M17 7h2v2\"/>",
"invoice": "<path d=\"M6 3h12v18l-3-2-3 2-3-2-3 2z\"/><path d=\"M9 8h6\"/><path d=\"M9 12h6\"/><path d=\"M9 16h3\"/>",
"hire": "<circle cx=\"10\" cy=\"8\" r=\"3.5\"/><path d=\"M3 20a7 7 0 0 1 14 0\"/><path d=\"M19 8v6\"/><path d=\"M16 11h6\"/>",
"reconcile": "<path d=\"M4 7h16\"/><path d=\"M4 12h16\"/><path d=\"M4 17h8\"/><path d=\"M15 17l2 2 4-4\"/>",
"database": "<ellipse cx=\"12\" cy=\"6\" rx=\"7\" ry=\"3\"/><path d=\"M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6\"/><path d=\"M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3\"/>",
"plus": "<path d=\"M12 5v14\"/><path d=\"M5 12h14\"/>",
"search": "<circle cx=\"11\" cy=\"11\" r=\"6\"/><path d=\"M20 20l-4.5-4.5\"/>",
"filter": "<path d=\"M4 5h16l-6 8v6l-4-2v-4z\"/>",
"download": "<path d=\"M12 4v11\"/><path d=\"M7 10l5 5 5-5\"/><path d=\"M5 20h14\"/>",
"upload": "<path d=\"M12 20V9\"/><path d=\"M7 14l5-5 5 5\"/><path d=\"M5 4h14\"/>",
"external": "<path d=\"M14 4h6v6\"/><path d=\"M20 4l-9 9\"/><path d=\"M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5\"/>",
"edit": "<path d=\"M4 20h4L19 9l-4-4L4 16z\"/><path d=\"M13 7l4 4\"/>",
"copy": "<rect x=\"8\" y=\"8\" width=\"12\" height=\"12\" rx=\"2\"/><path d=\"M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3\"/>",
"trash": "<path d=\"M4 7h16\"/><path d=\"M10 3h4\"/><path d=\"M6 7l1 13h10l1-13\"/><path d=\"M10 11v6\"/><path d=\"M14 11v6\"/>",
"refresh": "<path d=\"M20 12a8 8 0 1 1-2.3-5.7L20 8\"/><path d=\"M20 3v5h-5\"/>",
"branch": "<circle cx=\"6\" cy=\"6\" r=\"2\"/><circle cx=\"18\" cy=\"6\" r=\"2\"/><circle cx=\"6\" cy=\"18\" r=\"2\"/><path d=\"M6 8v8\"/><path d=\"M18 8v2a4 4 0 0 1-4 4H8\"/>",
"compare": "<rect x=\"3\" y=\"4\" width=\"7\" height=\"16\" rx=\"1.5\"/><rect x=\"14\" y=\"4\" width=\"7\" height=\"16\" rx=\"1.5\"/><path d=\"M6.5 9v6\"/><path d=\"M17.5 12v3\"/>",
"sparkle": "<path d=\"M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z\"/><path d=\"M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z\"/>",
"link": "<path d=\"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1\"/><path d=\"M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1\"/>",
"logout": "<path d=\"M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4\"/><path d=\"M15 12H4\"/><path d=\"M8 8l-4 4 4 4\"/>",
"more": "<circle cx=\"5\" cy=\"12\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"12\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"19\" cy=\"12\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/>",
"grip": "<circle cx=\"9\" cy=\"6\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"15\" cy=\"6\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"9\" cy=\"12\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"15\" cy=\"12\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"9\" cy=\"18\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"15\" cy=\"18\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/>",
"chevron-down": "<path d=\"M6 9l6 6 6-6\"/>",
"chevron-up": "<path d=\"M6 15l6-6 6 6\"/>",
"chevron-left": "<path d=\"M15 6l-6 6 6 6\"/>",
"chevron-right": "<path d=\"M9 6l6 6-6 6\"/>",
"arrow-up": "<path d=\"M12 19V5\"/><path d=\"M6 11l6-6 6 6\"/>",
"arrow-down": "<path d=\"M12 5v14\"/><path d=\"M6 13l6 6 6-6\"/>",
"arrow-right": "<path d=\"M5 12h14\"/><path d=\"M13 6l6 6-6 6\"/>",
"close": "<path d=\"M6 6l12 12\"/><path d=\"M18 6L6 18\"/>",
"check": "<path d=\"M5 12.5l4.5 4.5L19 7\"/>",
"menu": "<path d=\"M4 7h16\"/><path d=\"M4 12h16\"/><path d=\"M4 17h16\"/>",
"calendar": "<rect x=\"4\" y=\"5\" width=\"16\" height=\"16\" rx=\"2\"/><path d=\"M4 10h16\"/><path d=\"M8 3v4\"/><path d=\"M16 3v4\"/>",
"clock": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>",
"lock": "<rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"/>",
"eye": "<path d=\"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
"bell": "<path d=\"M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z\"/><path d=\"M10 21h4\"/>",
"sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2\"/><path d=\"M12 20v2\"/><path d=\"M4.9 4.9l1.4 1.4\"/><path d=\"M17.7 17.7l1.4 1.4\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"M4.9 19.1l1.4-1.4\"/><path d=\"M17.7 6.3l1.4-1.4\"/>",
"moon": "<path d=\"M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z\"/>",
"command": "<path d=\"M9 6v12\"/><path d=\"M15 6v12\"/><path d=\"M6 9h12\"/><path d=\"M6 15h12\"/>",
"info": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v6\"/><circle cx=\"12\" cy=\"7.8\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/>",
"warning": "<path d=\"M12 3.5l9.5 16.5h-19z\"/><path d=\"M12 10v4.5\"/><circle cx=\"12\" cy=\"17.3\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/>",
"error": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7.5v5.5\"/><circle cx=\"12\" cy=\"16.3\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/>",
"success": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M8 12.5l3 3 5-6\"/>",
"pending": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"8\" cy=\"12\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"12\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"16\" cy=\"12\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/>"
};
const LOGO_MARK = "<rect class=\"lm-bg\" width=\"32\" height=\"32\" rx=\"7\"/><path class=\"lm-rule\" d=\"M7 11.5h18M7 20.5h18\" fill=\"none\" stroke-width=\"1.5\" stroke-linecap=\"round\"/><path class=\"lm-line\" d=\"M7.5 23l5.5-6 4 3 7.5-9.5\" fill=\"none\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle class=\"lm-dot\" cx=\"24.5\" cy=\"10.5\" r=\"2\"/>";

var h = React.createElement;
var Frag = React.Fragment;
var useState = React.useState;

/* ---------- helpers ---------- */
function cx() {
  var out = [];
  for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
  return out.join(' ');
}
function omit(o, keys) {
  var r = {};
  for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k) && keys.indexOf(k) < 0) r[k] = o[k];
  return r;
}
var SYM = { EUR: '€', GBP: '£', USD: '$' };
function formatMoney(v, o) {
  o = o || {};
  if (v === null || v === undefined || isNaN(v)) return '';
  if (Math.abs(v) < 0.005 && !o.showZero) return '–';
  var sym = o.symbol === false ? '' : (SYM[o.currency || 'EUR'] || '');
  var neg = v < 0, a = Math.abs(v), s;
  if (o.compact) {
    var unit = a >= 1e6 ? 1e6 : a >= 1e3 ? 1e3 : 1, q = a / unit;
    var whole = Math.abs(q - Math.round(q)) < 0.05;
    s = (unit === 1 ? a.toFixed(0) : (whole ? String(Math.round(q)) : q.toFixed(1))) + (unit === 1e6 ? 'm' : unit === 1e3 ? 'k' : '');
  } else {
    var d = o.decimals == null ? 0 : o.decimals;
    s = a.toLocaleString('en-IE', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  s = sym + s;
  return neg ? '(' + s + ')' : s;
}
function formatPct(v, d) {
  if (v === null || v === undefined || isNaN(v)) return '';
  return (v * 100).toFixed(d == null ? 1 : d) + '%';
}
function niceScale(min, max, count) {
  if (min === max) { max = min + 1; }
  var span = max - min;
  var step = Math.pow(10, Math.floor(Math.log10(span / count)));
  var err = span / count / step;
  if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
  var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, ticks = [];
  for (var t = lo; t <= hi + step / 2; t += step) ticks.push(+t.toFixed(10));
  return { lo: lo, hi: hi, ticks: ticks };
}
function initials(name) {
  return (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
}

/* ---------- icon + logo ---------- */
function Icon(p) {
  var size = p.size || 20;
  var markup = ICONS[p.name] || ICONS.info;
  return h('svg', {
    className: cx('ll-icon', p.className), width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: p.strokeWidth || 1.75, strokeLinecap: 'round', strokeLinejoin: 'round',
    role: p.title ? 'img' : undefined, 'aria-hidden': p.title ? undefined : true, 'aria-label': p.title,
    dangerouslySetInnerHTML: { __html: markup }
  });
}
function Logo(p) {
  var size = p.size || 28;
  var mark = h('svg', { className: 'll-logo-mark', width: size, height: size, viewBox: '0 0 32 32', 'aria-hidden': true,
    dangerouslySetInnerHTML: { __html: LOGO_MARK } });
  if (p.variant === 'mark') return h('span', { className: 'll-logo', role: 'img', 'aria-label': 'Ledgerline' }, mark);
  return h('span', { className: cx('ll-logo', p.inverse && 'll-logo-inverse'), role: 'img', 'aria-label': 'Ledgerline' }, mark,
    h('span', { className: 'll-logo-word', style: { fontSize: Math.round(size * 0.72) } }, 'Ledgerline'));
}

/* ---------- actions ---------- */
function Spinner(p) {
  return h('span', { className: cx('ll-spinner', p && p.className), role: 'status', 'aria-label': (p && p.label) || 'Loading' });
}
function Button(p) {
  var variant = p.variant || 'secondary', size = p.size || 'md';
  var rest = omit(p, ['variant', 'size', 'icon', 'iconRight', 'loading', 'children', 'className', 'block']);
  return h('button', Object.assign({ type: 'button' }, rest, {
    className: cx('ll-btn', 'll-btn-' + variant, 'll-btn-' + size, p.block && 'll-btn-block', p.loading && 'is-loading', p.className),
    disabled: p.disabled || p.loading, 'aria-busy': p.loading || undefined
  }),
    p.loading ? h(Spinner, { label: 'Working' }) : (p.icon ? h(Icon, { name: p.icon, size: size === 'sm' ? 16 : 18 }) : null),
    p.children ? h('span', null, p.children) : null,
    p.iconRight ? h(Icon, { name: p.iconRight, size: size === 'sm' ? 16 : 18 }) : null);
}
function IconButton(p) {
  var rest = omit(p, ['icon', 'label', 'variant', 'size', 'className']);
  return h('button', Object.assign({ type: 'button' }, rest, {
    className: cx('ll-iconbtn', 'll-iconbtn-' + (p.variant || 'ghost'), p.size === 'sm' && 'll-iconbtn-sm', p.className),
    'aria-label': p.label, title: p.label
  }), h(Icon, { name: p.icon, size: p.size === 'sm' ? 16 : 18 }));
}
function Kbd(p) { return h('kbd', { className: 'll-kbd' }, p.children); }

/* ---------- forms ---------- */
function Field(p) {
  return h('div', { className: cx('ll-field', p.error && 'has-error', p.className) },
    p.label ? h('label', { className: 'll-field-label', htmlFor: p.id }, p.label, p.optional ? h('span', { className: 'll-field-opt' }, ' optional') : null) : null,
    p.children,
    p.error ? h('div', { className: 'll-field-error', id: p.id + '-err' }, h(Icon, { name: 'error', size: 14 }), p.error)
      : (p.hint ? h('div', { className: 'll-field-hint', id: p.id + '-hint' }, p.hint) : null));
}
function Input(p) {
  var rest = omit(p, ['label', 'hint', 'error', 'prefix', 'suffix', 'className', 'optional', 'icon', 'numeric']);
  return h(Field, { id: p.id, label: p.label, hint: p.hint, error: p.error, optional: p.optional, className: p.className },
    h('div', { className: cx('ll-input', p.disabled && 'is-disabled', p.numeric && 'is-numeric') },
      p.icon ? h(Icon, { name: p.icon, size: 16, className: 'll-input-icon' }) : null,
      p.prefix ? h('span', { className: 'll-input-affix' }, p.prefix) : null,
      h('input', Object.assign({ type: 'text' }, rest, { 'aria-invalid': p.error ? true : undefined,
        'aria-describedby': p.error ? p.id + '-err' : (p.hint ? p.id + '-hint' : undefined) })),
      p.suffix ? h('span', { className: 'll-input-affix' }, p.suffix) : null));
}
function Select(p) {
  var rest = omit(p, ['label', 'hint', 'error', 'options', 'className']);
  return h(Field, { id: p.id, label: p.label, hint: p.hint, error: p.error, className: p.className },
    h('div', { className: 'll-select' },
      h('select', rest, (p.options || []).map(function (o) {
        var v = typeof o === 'string' ? o : o.value;
        return h('option', { key: v, value: v }, typeof o === 'string' ? o : o.label);
      })),
      h(Icon, { name: 'chevron-down', size: 16, className: 'll-select-chev' })));
}
function Checkbox(p) {
  var st = useState(!!p.defaultChecked), on = p.checked != null ? p.checked : st[0];
  return h('label', { className: cx('ll-check', p.disabled && 'is-disabled'), htmlFor: p.id },
    h('input', { id: p.id, type: 'checkbox', checked: on, disabled: p.disabled,
      onChange: function (e) { st[1](e.target.checked); p.onChange && p.onChange(e.target.checked); } }),
    h('span', { className: 'll-check-box', 'aria-hidden': true }, h(Icon, { name: 'check', size: 14, strokeWidth: 2.5 })),
    p.label ? h('span', null, p.label) : null);
}
function RadioGroup(p) {
  var st = useState(p.defaultValue || (p.options[0] && p.options[0].value)), val = p.value != null ? p.value : st[0];
  return h('fieldset', { className: 'll-radios' },
    p.label ? h('legend', { className: 'll-field-label' }, p.label) : null,
    p.options.map(function (o) {
      var id = p.name + '-' + o.value;
      return h('label', { key: o.value, className: 'll-radio', htmlFor: id },
        h('input', { id: id, type: 'radio', name: p.name, value: o.value, checked: val === o.value,
          onChange: function () { st[1](o.value); p.onChange && p.onChange(o.value); } }),
        h('span', { className: 'll-radio-dot', 'aria-hidden': true }),
        h('span', null, h('span', { className: 'll-radio-label' }, o.label), o.hint ? h('span', { className: 'll-radio-hint' }, o.hint) : null));
    }));
}
function Switch(p) {
  var st = useState(!!p.defaultChecked), on = p.checked != null ? p.checked : st[0];
  return h('label', { className: cx('ll-switch', p.disabled && 'is-disabled'), htmlFor: p.id },
    h('input', { id: p.id, type: 'checkbox', role: 'switch', checked: on, disabled: p.disabled,
      onChange: function (e) { st[1](e.target.checked); p.onChange && p.onChange(e.target.checked); } }),
    h('span', { className: 'll-switch-track', 'aria-hidden': true }, h('span', { className: 'll-switch-thumb' })),
    h('span', null, h('span', { className: 'll-switch-label' }, p.label), p.hint ? h('span', { className: 'll-switch-hint' }, p.hint) : null));
}
function Slider(p) {
  var st = useState(p.defaultValue != null ? p.defaultValue : p.min), val = p.value != null ? p.value : st[0];
  var pct = ((val - p.min) / (p.max - p.min)) * 100;
  return h('div', { className: 'll-slider' },
    h('div', { className: 'll-slider-head' },
      h('label', { className: 'll-field-label', htmlFor: p.id }, p.label),
      h('output', { className: 'll-slider-value', htmlFor: p.id }, p.format ? p.format(val) : val)),
    h('input', { id: p.id, type: 'range', min: p.min, max: p.max, step: p.step || 1, value: val,
      style: { '--ll-fill': pct + '%' },
      onChange: function (e) { var v = +e.target.value; st[1](v); p.onChange && p.onChange(v); } }),
    p.marks ? h('div', { className: 'll-slider-marks', 'aria-hidden': true }, p.marks.map(function (m) { return h('span', { key: m }, p.format ? p.format(m) : m); })) : null);
}
function SegmentedControl(p) {
  var st = useState(p.defaultValue || p.options[0].value), val = p.value != null ? p.value : st[0];
  return h('div', { className: cx('ll-seg', p.size === 'sm' && 'll-seg-sm'), role: 'radiogroup', 'aria-label': p.label },
    p.options.map(function (o) {
      var on = o.value === val;
      return h('button', { key: o.value, type: 'button', role: 'radio', 'aria-checked': on, className: cx('ll-seg-opt', on && 'is-on'),
        onClick: function () { st[1](o.value); p.onChange && p.onChange(o.value); } }, o.icon ? h(Icon, { name: o.icon, size: 16 }) : null, o.label);
    }));
}
function Tabs(p) {
  var st = useState(p.defaultValue || p.tabs[0].id), val = p.value != null ? p.value : st[0];
  return h('div', { className: 'll-tabs', role: 'tablist', 'aria-label': p.label },
    p.tabs.map(function (t) {
      var on = t.id === val;
      return h('button', { key: t.id, type: 'button', role: 'tab', 'aria-selected': on, className: cx('ll-tab', on && 'is-on'),
        onClick: function () { st[1](t.id); p.onChange && p.onChange(t.id); } },
        t.label, t.count != null ? h('span', { className: 'll-tab-count' }, t.count) : null);
    }));
}

/* ---------- status ---------- */
function Badge(p) {
  return h('span', { className: cx('ll-badge', 'll-badge-' + (p.tone || 'neutral'), p.className) },
    p.icon ? h(Icon, { name: p.icon, size: 13, strokeWidth: 2 }) : null, p.children);
}
var STATUS = {
  synced: ['positive', 'success', 'Synced'], syncing: ['forecast', null, 'Syncing'], error: ['negative', 'error', 'Sync failed'],
  stale: ['warning', 'clock', 'Stale'], draft: ['neutral', 'edit', 'Draft'], actual: ['brand', null, 'Actual'],
  forecast: ['forecast', null, 'Forecast'], matched: ['positive', 'check', 'Matches Xero'], mismatch: ['warning', 'warning', 'Differs from Xero'],
  connected: ['positive', 'link', 'Connected'], disconnected: ['negative', 'error', 'Disconnected']
};
function StatusPill(p) {
  var s = STATUS[p.status] || STATUS.draft;
  return h('span', { className: cx('ll-pill', 'll-badge-' + s[0]) },
    p.status === 'syncing' ? h('span', { className: 'll-pill-pulse', 'aria-hidden': true }) :
      (s[1] ? h(Icon, { name: s[1], size: 13, strokeWidth: 2 }) : h('span', { className: 'll-pill-dot', 'aria-hidden': true })),
    p.children || s[2]);
}
function Avatar(p) {
  var size = p.size || 28;
  return h('span', { className: cx('ll-avatar', p.square && 'll-avatar-sq'), style: { width: size, height: size, fontSize: Math.round(size * 0.4) }, title: p.name }, initials(p.name));
}
function Tooltip(p) {
  return h('span', { className: 'll-tip-wrap', tabIndex: p.focusable ? 0 : undefined },
    p.children, h('span', { className: cx('ll-tip', p.open && 'is-open'), role: 'tooltip' }, p.content));
}
function Skeleton(p) {
  if (p.lines) return h('div', { className: 'll-skel-lines' }, Array.from({ length: p.lines }).map(function (_, i) {
    return h('span', { key: i, className: 'll-skel', style: { width: i === p.lines - 1 ? '60%' : '100%', height: 12 } });
  }));
  return h('span', { className: 'll-skel', style: { width: p.width || '100%', height: p.height || 12 } });
}
function ProgressBar(p) {
  var pct = Math.max(0, Math.min(1, p.value || 0)) * 100;
  return h('div', { className: cx('ll-progress', p.tone && 'll-progress-' + p.tone), role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(pct), 'aria-label': p.label },
    h('span', { style: { width: pct + '%' } }));
}

/* ---------- money ---------- */
function Amount(p) {
  var v = p.value;
  var neg = v < 0;
  return h('span', { className: cx('ll-amount', p.size && 'll-amount-' + p.size, neg && p.tone !== 'plain' && 'is-neg', p.forecast && 'is-forecast', p.strong && 'is-strong', p.className),
    title: p.title }, formatMoney(v, p));
}
function Delta(p) {
  var v = p.value;
  if (v === null || v === undefined) return null;
  var good = p.invert ? v < 0 : v > 0;
  var flat = Math.abs(v) < 0.0005;
  var tone = flat ? 'neutral' : (good ? 'positive' : 'negative');
  return h('span', { className: cx('ll-delta', 'll-delta-' + tone) },
    flat ? null : h(Icon, { name: v > 0 ? 'arrow-up' : 'arrow-down', size: 12, strokeWidth: 2.25 }),
    h('span', null, (v > 0 ? '+' : v < 0 ? '−' : '') + formatPct(Math.abs(v), p.decimals)),
    p.label ? h('span', { className: 'll-delta-label' }, p.label) : null);
}

/* ---------- charts ---------- */
function useWidth(initial) {
  var ref = React.useRef(null), st = useState(initial);
  React.useLayoutEffect(function () {
    var el = ref.current; if (!el) return;
    function measure() { var w = Math.round(el.clientWidth); if (w > 0) st[1](function (old) { return Math.abs(old - w) > 1 ? w : old; }); }
    measure();
    if (window.ResizeObserver) { var ro = new ResizeObserver(measure); ro.observe(el); return function () { ro.disconnect(); }; }
  }, []);
  return [ref, Math.max(300, st[0])];
}
var uidN = 0;
function useUid(prefix) {
  var r = React.useRef(null);
  if (r.current === null) r.current = (prefix || 'll') + (++uidN);
  return r.current;
}
// Monotone cubic interpolation (Fritsch–Carlson): smooth, never overshoots a month's value.
function smoothPath(pts) {
  var n = pts.length;
  if (!n) return '';
  if (n === 1) return 'M' + pts[0][0] + ' ' + pts[0][1];
  if (n === 2) return 'M' + pts[0][0] + ' ' + pts[0][1] + 'L' + pts[1][0] + ' ' + pts[1][1];
  var dx = [], m = [], t = [], i;
  for (i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    var a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { var tau = 3 / Math.sqrt(s); t[i] = tau * a * m[i]; t[i + 1] = tau * b * m[i]; }
  }
  var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  for (i = 0; i < n - 1; i++) {
    var x0 = pts[i][0], y0 = pts[i][1], x1 = pts[i + 1][0], y1 = pts[i + 1][1], h3 = dx[i] / 3;
    d += 'C' + (x0 + h3).toFixed(1) + ' ' + (y0 + t[i] * h3).toFixed(1) + ' ' + (x1 - h3).toFixed(1) + ' ' + (y1 - t[i + 1] * h3).toFixed(1) + ' ' + x1.toFixed(1) + ' ' + y1.toFixed(1);
  }
  return d;
}
function runs(values, X, Y) {
  var out = [], cur = [];
  values.forEach(function (v, i) { if (v == null) { if (cur.length) out.push(cur); cur = []; } else cur.push([X(i), Y(v)]); });
  if (cur.length) out.push(cur);
  return out;
}
function textW(s, size) { return String(s).length * (size || 12) * 0.6 + 2; }
function HatchDef(p) {
  return h('pattern', { id: p.id, width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
    h('rect', { width: 7, height: 7, className: p.ground || 'll-hatch-ground' }),
    h('line', { x1: 0, y1: 0, x2: 0, y2: 7, className: p.line || 'll-hatch-line' }));
}
function ChartTooltip(p) {
  if (!p.show) return null;
  var left = p.x, flip = p.x > p.width - 200;
  return h('div', { className: 'll-ctip', style: { left: left, top: p.y, transform: flip ? 'translate(calc(-100% - 14px), -50%)' : 'translate(14px, -50%)' } },
    h('div', { className: 'll-ctip-title' }, p.title, p.badge ? h('span', { className: cx('ll-ctip-badge', 'is-' + p.badge) }, p.badge === 'forecast' ? 'Forecast' : 'Actual') : null),
    p.rows.map(function (r, i) {
      return h('div', { key: i, className: 'll-ctip-row' },
        h('span', { className: cx('ll-ctip-key', 'll-key-' + (r.kind || 'actual')) }), h('span', { className: 'll-ctip-name' }, r.name),
        h('span', { className: cx('ll-ctip-val', r.value < 0 && 'is-neg') }, r.text));
    }));
}

function Sparkline(p) {
  var data = p.data || [], W = p.width || 120, H = p.height || 36, n = data.length;
  var uid = useUid('sp');
  var min = Math.min.apply(null, data), max = Math.max.apply(null, data), pad = 4;
  if (max - min < Math.abs(max) * 0.02) { var mid = (max + min) / 2, half = Math.abs(mid) * 0.02 || 1; min = mid - half; max = mid + half; }
  function X(i) { return pad + i * (W - pad * 2) / (n - 1); }
  function Y(v) { return H - pad - (v - min) / (max - min) * (H - pad * 2); }
  var split = p.forecastFrom != null ? p.forecastFrom : n;
  var actPts = data.slice(0, split).map(function (v, i) { return [X(i), Y(v)]; });
  var fcPts = split < n ? data.slice(split - 1).map(function (v, i) { return [X(split - 1 + i), Y(v)]; }) : [];
  var line = smoothPath(actPts);
  var area = line + 'L' + actPts[actPts.length - 1][0].toFixed(1) + ' ' + H + 'L' + actPts[0][0].toFixed(1) + ' ' + H + 'Z';
  var li = split - 1;
  var tone = p.tone || 'brand';
  return h('svg', { className: cx('ll-spark', 'll-spark-' + tone), width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': p.label || 'Trend' },
    h('defs', null, h('linearGradient', { id: uid, x1: 0, y1: 0, x2: 0, y2: 1 },
      h('stop', { offset: '0%', className: 'll-stop-' + tone, stopOpacity: 0.28 }), h('stop', { offset: '100%', className: 'll-stop-' + tone, stopOpacity: 0 }))),
    h('path', { d: area, fill: 'url(#' + uid + ')' }),
    h('path', { className: 'll-spark-line', d: line }),
    fcPts.length ? h('path', { className: 'll-spark-fc', d: smoothPath(fcPts) }) : null,
    h('circle', { className: 'll-spark-halo', cx: X(li), cy: Y(data[li]), r: 6 }),
    h('circle', { className: 'll-spark-end', cx: X(li), cy: Y(data[li]), r: 2.75 }));
}

function ChartLegend(p) {
  return h('div', { className: 'll-legend' }, p.items.map(function (it) {
    return h('span', { key: it.name, className: 'll-legend-item' },
      it.swatch != null ? h('span', { className: 'll-legend-sw ll-fill-' + it.swatch }) : h('span', { className: cx('ll-legend-key', 'll-key-' + (it.kind || 'actual')) }), it.name);
  }));
}

/* LineChart: smooth series, gradient areas, uncertainty bands, hatched forecast period, thresholds, hover crosshair. */
function LineChart(p) {
  var mw = useWidth(720), W = mw[1], H = p.height || 280;
  var pl = 60, pr = p.endLabels ? 76 : 20, pt = 34, pb = 30;
  var uid = useUid('lc'), hv = useState(null), hi = hv[0];
  var labels = p.labels, n = labels.length, all = [];
  p.series.forEach(function (s) {
    (s.values || []).forEach(function (v) { if (v != null) all.push(v); });
    (s.lower || []).forEach(function (v) { if (v != null) all.push(v); });
    (s.upper || []).forEach(function (v) { if (v != null) all.push(v); });
  });
  (p.thresholds || []).forEach(function (t) { all.push(t.value); });
  var lo = Math.min.apply(null, all), hiV = Math.max.apply(null, all);
  var sc = niceScale(p.zero ? Math.min(0, lo) : lo, hiV, 5);
  var step = (W - pl - pr) / (n - 1);
  function X(i) { return pl + i * step; }
  function Y(v) { return pt + (1 - (v - sc.lo) / (sc.hi - sc.lo)) * (H - pt - pb); }
  var fmt = p.format || function (v) { return formatMoney(v, { compact: true }); };
  var ff = p.forecastFrom, kids = [], over = [];
  var defs = [h(HatchDef, { key: 'h', id: uid + 'h' }),
    h('linearGradient', { key: 'ga', id: uid + 'a', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: '0%', className: 'll-stop-brand', stopOpacity: 0.32 }), h('stop', { offset: '100%', className: 'll-stop-brand', stopOpacity: 0 })),
    h('linearGradient', { key: 'gb', id: uid + 'b', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: '0%', className: 'll-stop-forecast', stopOpacity: 0.22 }), h('stop', { offset: '100%', className: 'll-stop-forecast', stopOpacity: 0.08 })),
    h('linearGradient', { key: 'gs', id: uid + 's', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: '0%', className: 'll-stop-scenario', stopOpacity: 0.16 }), h('stop', { offset: '100%', className: 'll-stop-scenario', stopOpacity: 0 }))];
  if (ff != null && ff < n) {
    var bx = X(ff - 1);
    kids.push(h('rect', { key: 'fz', x: bx, y: pt - 6, width: W - pr - bx + 8, height: H - pb - pt + 6, fill: 'url(#' + uid + 'h)', className: 'll-ch-hatch' }));
    kids.push(h('line', { key: 'today', className: 'll-ch-today', x1: bx, x2: bx, y1: pt - 18, y2: H - pb }));
    var tl = p.todayLabel || 'Today';
    kids.push(h('g', { key: 'tl', transform: 'translate(' + bx + ',' + (pt - 26) + ')' },
      h('rect', { className: 'll-ch-pill', x: 6, y: 0, width: textW(tl, 10.5) + 12, height: 18, rx: 9 }),
      h('text', { className: 'll-ch-pilltext', x: 12, y: 12.5 }, tl)));
    kids.push(h('text', { key: 'fl', className: 'll-ch-fclabel', x: W - pr, y: pt - 14, textAnchor: 'end' }, 'FORECAST →'));
  }
  sc.ticks.forEach(function (t, i) {
    kids.push(h('line', { key: 'g' + i, className: t === 0 ? 'll-ch-zero' : 'll-ch-grid', x1: pl, x2: W - pr, y1: Y(t), y2: Y(t) }));
    kids.push(h('text', { key: 'y' + i, className: 'll-ch-ylabel', x: pl - 10, y: Y(t) + 4, textAnchor: 'end' }, fmt(t)));
  });
  var longest = Math.max.apply(null, labels.map(function (l) { return String(l).length; }));
  var every = Math.max(1, Math.ceil((longest * 7 + 14) / step));
  labels.forEach(function (l, i) {
    if ((n - 1 - i) % every) return;
    kids.push(h('text', { key: 'x' + i, className: cx('ll-ch-xlabel', hi === i && 'is-hot'), x: X(i), y: H - 8, textAnchor: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }, l));
  });
  (p.thresholds || []).forEach(function (t, i) {
    kids.push(h('line', { key: 't' + i, className: 'll-ch-thresh is-' + (t.tone || 'negative'), x1: pl, x2: W - pr, y1: Y(t.value), y2: Y(t.value) }));
    kids.push(h('text', { key: 'tt' + i, className: 'll-ch-threshtext is-' + (t.tone || 'negative'), x: pl + 6, y: Y(t.value) - 6 }, t.label));
  });
  p.series.forEach(function (s, si) {
    if (s.kind === 'band') {
      var up = [], dn = [];
      s.upper.forEach(function (v, i) { if (v != null) up.push([X(i), Y(v)]); });
      s.lower.forEach(function (v, i) { if (v != null) dn.push([X(i), Y(v)]); });
      if (up.length > 1) {
        var back = smoothPath(dn.slice().reverse()).replace(/^M/, 'L');
        kids.push(h('path', { key: 'band' + si, d: smoothPath(up) + back + 'Z', fill: 'url(#' + uid + 'b)', className: 'll-ch-band', opacity: s.opacity || 1 }));
      }
      return;
    }
    runs(s.values, X, Y).forEach(function (pts, ri) {
      var d = smoothPath(pts);
      if ((s.kind || 'actual') === 'actual' && p.area !== false) {
        var base = Y(Math.max(sc.lo, 0));
        kids.push(h('path', { key: 'a' + si + ri, d: d + 'L' + pts[pts.length - 1][0].toFixed(1) + ' ' + base + 'L' + pts[0][0].toFixed(1) + ' ' + base + 'Z', fill: 'url(#' + uid + 'a)' }));
      }
      if (s.kind === 'scenario' && p.area !== false && p.scenarioArea) {
        var base2 = Y(Math.max(sc.lo, 0));
        kids.push(h('path', { key: 'sa' + si + ri, d: d + 'L' + pts[pts.length - 1][0].toFixed(1) + ' ' + base2 + 'L' + pts[0][0].toFixed(1) + ' ' + base2 + 'Z', fill: 'url(#' + uid + 's)' }));
      }
      kids.push(h('path', { key: 's' + si + ri, className: cx('ll-ch-line', 'll-ch-' + (s.kind || 'actual')), d: d }));
    });
    var last = -1; s.values.forEach(function (v, i) { if (v != null) last = i; });
    if (last >= 0 && s.kind !== 'band') {
      var ex = X(last), ey = Y(s.values[last]);
      over.push(h('circle', { key: 'eh' + si, className: cx('ll-ch-halo', 'is-' + (s.kind || 'actual')), cx: ex, cy: ey, r: 8 }));
      over.push(h('circle', { key: 'e' + si, className: cx('ll-ch-end', 'is-' + (s.kind || 'actual')), cx: ex, cy: ey, r: 4 }));
      if (p.endLabels) {
        var txt = fmt(s.values[last]), tw = textW(txt, 11) + 12;
        over.push(h('g', { key: 'el' + si, transform: 'translate(' + (ex + 10) + ',' + (ey - 10) + ')' },
          h('rect', { className: cx('ll-ch-endpill', 'is-' + (s.kind || 'actual')), width: tw, height: 20, rx: 10 }),
          h('text', { className: 'll-ch-endtext', x: tw / 2, y: 14, textAnchor: 'middle' }, txt)));
      }
    }
  });
  if (hi != null) {
    over.push(h('line', { key: 'xh', className: 'll-ch-cross', x1: X(hi), x2: X(hi), y1: pt - 6, y2: H - pb }));
    p.series.forEach(function (s, si) {
      if (s.kind === 'band' || s.values[hi] == null) return;
      over.push(h('circle', { key: 'hd' + si, className: cx('ll-ch-end', 'is-' + (s.kind || 'actual')), cx: X(hi), cy: Y(s.values[hi]), r: 4.5 }));
    });
  }
  function onMove(e) {
    var r = e.currentTarget.getBoundingClientRect(), mx = (e.clientX - r.left) * (W / r.width);
    var i = Math.round((mx - pl) / step); hv[1](Math.max(0, Math.min(n - 1, i)));
  }
  var tipRows = [], tipY = pt + 20;
  if (hi != null) {
    p.series.forEach(function (s) {
      if (s.kind === 'band') { if (s.lower[hi] != null) tipRows.push({ name: s.name, kind: 'band', text: fmt(s.lower[hi]) + ' – ' + fmt(s.upper[hi]) }); return; }
      if (s.values[hi] != null) tipRows.push({ name: s.name, kind: s.kind, value: s.values[hi], text: fmt(s.values[hi]) });
    });
    var ys = p.series.filter(function (s) { return s.kind !== 'band' && s.values[hi] != null; }).map(function (s) { return Y(s.values[hi]); });
    if (ys.length) tipY = Math.min.apply(null, ys);
  }
  return h('figure', { className: 'll-chart' },
    p.legend !== false ? h(ChartLegend, { items: p.series }) : null,
    h('div', { className: 'll-chart-plot', ref: mw[0] },
      h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, className: 'll-chart-svg', role: 'img', 'aria-label': p.label || 'Line chart', onMouseMove: onMove, onMouseLeave: function () { hv[1](null); } },
        h('defs', null, defs), h('g', { className: 'll-ch-reveal' }, kids), over),
      h(ChartTooltip, { show: hi != null && tipRows.length, x: hi != null ? X(hi) : 0, y: tipY, width: W, title: labels[hi], badge: ff != null ? (hi >= ff ? 'forecast' : 'actual') : null, rows: tipRows })),
    p.caption ? h('figcaption', { className: 'll-chart-cap' }, p.caption) : null);
}

function barPath(x, y0, y1, w, r) {
  var top = Math.min(y0, y1), bot = Math.max(y0, y1), hgt = bot - top;
  r = Math.min(r, w / 2, hgt);
  if (y1 <= y0) return 'M' + x + ' ' + bot + 'V' + (top + r) + 'Q' + x + ' ' + top + ' ' + (x + r) + ' ' + top + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + top + ' ' + (x + w) + ' ' + (top + r) + 'V' + bot + 'Z';
  return 'M' + x + ' ' + top + 'V' + (bot - r) + 'Q' + x + ' ' + bot + ' ' + (x + r) + ' ' + bot + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + bot + ' ' + (x + w) + ' ' + (bot - r) + 'V' + top + 'Z';
}

/* BarChart: single or stacked series, rounded tops, gradient actuals, hatched forecasts, target line, hover. */
function BarChart(p) {
  var mw = useWidth(720), W = mw[1], H = p.height || 260, pl = 60, pr = 16, pt = 30, pb = 30;
  var uid = useUid('bc'), hv = useState(null), hi = hv[0];
  var stacked = !!p.series, n = p.labels.length;
  var totals = stacked ? p.labels.map(function (_, i) { return p.series.reduce(function (s, se) { return s + (se.values[i] || 0); }, 0); }) : p.values;
  var sc = niceScale(Math.min(0, Math.min.apply(null, totals)), Math.max.apply(null, totals.concat(p.target != null ? [p.target] : [])), 4);
  var slot = (W - pl - pr) / n, bw = Math.min(40, slot * 0.62);
  function Y(v) { return pt + (1 - (v - sc.lo) / (sc.hi - sc.lo)) * (H - pt - pb); }
  var fmt = p.format || function (v) { return formatMoney(v, { compact: true }); };
  var kids = [], ff = p.forecastFrom;
  var defs = [h(HatchDef, { key: 'h', id: uid + 'h', ground: 'll-hatch-ground-fc', line: 'll-hatch-line-fc' }),
    h('linearGradient', { key: 'g', id: uid + 'g', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: '0%', className: 'll-stop-brand', stopOpacity: 1 }), h('stop', { offset: '100%', className: 'll-stop-brand', stopOpacity: 1 }))];
  if (ff != null && ff < n) {
    kids.push(h('rect', { key: 'fz', className: 'll-ch-fczone', x: pl + ff * slot, y: pt - 8, width: W - pr - (pl + ff * slot), height: H - pb - pt + 8, rx: 8 }));
    kids.push(h('text', { key: 'fl', className: 'll-ch-fclabel', x: W - pr - 6, y: pt - 14, textAnchor: 'end' }, 'FORECAST'));
  }
  sc.ticks.forEach(function (t, i) {
    kids.push(h('line', { key: 'g' + i, className: t === 0 ? 'll-ch-zero' : 'll-ch-grid', x1: pl, x2: W - pr, y1: Y(t), y2: Y(t) }));
    kids.push(h('text', { key: 'y' + i, className: 'll-ch-ylabel', x: pl - 10, y: Y(t) + 4, textAnchor: 'end' }, fmt(t)));
  });
  p.labels.forEach(function (lab, i) {
    var x = pl + i * slot + (slot - bw) / 2, isF = ff != null && i >= ff, dim = hi != null && hi !== i;
    if (stacked) {
      var acc = 0;
      p.series.forEach(function (se, si) {
        var v = se.values[i] || 0, y0 = Y(acc), y1 = Y(acc + v), isTop = si === p.series.length - 1;
        kids.push(h('path', { key: 'b' + i + '-' + si, className: cx('ll-ch-seg', 'll-fill-' + (se.swatch != null ? se.swatch : si + 1), isF && 'is-forecast', dim && 'is-dim'), d: isTop ? barPath(x, y0, y1, bw, 5) : 'M' + x + ' ' + y0 + 'V' + y1 + 'H' + (x + bw) + 'V' + y0 + 'Z' }));
        acc += v;
      });
      if (isF) kids.push(h('path', { key: 'bh' + i, d: barPath(x, Y(0), Y(acc), bw, 5), fill: 'url(#' + uid + 'h)', className: 'll-ch-hatchover' }));
    } else {
      var v = p.values[i];
      kids.push(h('path', { key: 'b' + i, d: barPath(x, Y(0), Y(v), bw, 6), fill: isF ? 'url(#' + uid + 'h)' : (v < 0 ? undefined : 'url(#' + uid + 'g)'),
        className: cx('ll-ch-bar', isF && 'is-forecast', v < 0 && 'is-neg', p.highlight === i && 'is-hl', dim && 'is-dim') }));
      if (p.valueLabels || hi === i || p.highlight === i) kids.push(h('text', { key: 'v' + i, className: cx('ll-ch-barval', isF && 'is-forecast'), x: x + bw / 2, y: Y(v) - 7, textAnchor: 'middle' }, fmt(v)));
    }
    if (slot >= 28 || i % 2 === 0) kids.push(h('text', { key: 'x' + i, className: cx('ll-ch-xlabel', (hi === i || p.highlight === i) && 'is-hot'), x: x + bw / 2, y: H - 8, textAnchor: 'middle' }, lab));
    kids.push(h('rect', { key: 'hit' + i, x: pl + i * slot, y: pt, width: slot, height: H - pt - pb, fill: 'transparent', onMouseEnter: function () { hv[1](i); } }));
  });
  if (p.target != null) {
    kids.push(h('line', { key: 'tg', className: 'll-ch-target', x1: pl, x2: W - pr, y1: Y(p.target), y2: Y(p.target) }));
    kids.push(h('text', { key: 'tgt', className: 'll-ch-targettext', x: W - pr, y: Y(p.target) - 6, textAnchor: 'end' }, (p.targetLabel || 'Target') + ' ' + fmt(p.target)));
  }
  var tipRows = [];
  if (hi != null) {
    if (stacked) p.series.slice().reverse().forEach(function (se, k) { var si = p.series.length - 1 - k; tipRows.push({ name: se.name, kind: 'sw' + (se.swatch != null ? se.swatch : si + 1), value: se.values[hi], text: fmt(se.values[hi]) }); });
    tipRows.push({ name: stacked ? 'Total' : (p.seriesName || 'Value'), kind: ff != null && hi >= ff ? 'forecast' : 'actual', value: totals[hi], text: fmt(totals[hi]) });
  }
  return h('figure', { className: 'll-chart' },
    p.legend ? h(ChartLegend, { items: p.legend }) : null,
    h('div', { className: 'll-chart-plot', ref: mw[0] },
      h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, className: 'll-chart-svg', role: 'img', 'aria-label': p.label || 'Bar chart', onMouseLeave: function () { hv[1](null); } },
        h('defs', null, defs), h('g', { className: 'll-ch-grow' }, kids)),
      h(ChartTooltip, { show: hi != null, x: hi != null ? pl + hi * slot + slot / 2 : 0, y: hi != null ? Math.max(pt + 30, Y(totals[hi]) + 10) : 0, width: W, title: p.labels[hi], badge: ff != null ? (hi >= ff ? 'forecast' : 'actual') : null, rows: tipRows })),
    p.caption ? h('figcaption', { className: 'll-chart-cap' }, p.caption) : null);
}

/* WaterfallChart: the cash bridge, rounded floating bars, chips, connectors; asserts the bridge closes. */
function WaterfallChart(p) {
  var mw = useWidth(720), W = mw[1], H = p.height || 320, pl = 60, pr = 16, pt = 36, pb = 52;
  var uid = useUid('wf'), hv = useState(null), hi = hv[0];
  var steps = p.steps, run = 0, bars = [];
  steps.forEach(function (s) {
    if (s.kind === 'start' || s.kind === 'end') { bars.push({ s: s, a: 0, b: s.value }); run = s.value; }
    else { bars.push({ s: s, a: run, b: run + s.value }); run += s.value; }
  });
  var closes = Math.abs(bars[bars.length - 1].b - bars[bars.length - 2].b) < 0.5;
  var vals = []; bars.forEach(function (b) { vals.push(b.a, b.b); });
  var sc = niceScale(Math.min.apply(null, vals.concat([0])), Math.max.apply(null, vals), 4);
  var n = bars.length, slot = (W - pl - pr) / n, bw = Math.min(56, slot * 0.64);
  function Y(v) { return pt + (1 - (v - sc.lo) / (sc.hi - sc.lo)) * (H - pt - pb); }
  var fmt = function (v) { return formatMoney(v, { compact: true }); };
  var kids = [];
  var defs = [h('linearGradient', { key: 't', id: uid + 't', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: '0%', className: 'll-stop-ink', stopOpacity: 0.85 }), h('stop', { offset: '100%', className: 'll-stop-ink', stopOpacity: 0.55 }))];
  sc.ticks.forEach(function (t, i) {
    kids.push(h('line', { key: 'g' + i, className: t === 0 ? 'll-ch-zero' : 'll-ch-grid', x1: pl, x2: W - pr, y1: Y(t), y2: Y(t) }));
    kids.push(h('text', { key: 'y' + i, className: 'll-ch-ylabel', x: pl - 10, y: Y(t) + 4, textAnchor: 'end' }, fmt(t)));
  });
  bars.forEach(function (b, i) {
    var x = pl + i * slot + (slot - bw) / 2, total = b.s.kind === 'start' || b.s.kind === 'end';
    var cls = total ? 'is-total' : (b.s.value >= 0 ? 'is-up' : 'is-down'), dim = hi != null && hi !== i;
    var y0 = Y(b.a), y1 = Y(b.b), top = Math.min(y0, y1), hgt = Math.max(3, Math.abs(y1 - y0));
    kids.push(h('rect', { key: 'b' + i, className: cx('ll-wf-bar', cls, dim && 'is-dim'), x: x, y: top, width: bw, height: hgt, rx: Math.min(6, hgt / 2), fill: total ? 'url(#' + uid + 't)' : undefined }));
    if (i < n - 1) kids.push(h('line', { key: 'c' + i, className: 'll-wf-conn', x1: x + bw, x2: x + slot, y1: Y(b.b), y2: Y(b.b) }));
    var label = total ? fmt(b.s.value) : (b.s.value >= 0 ? '+' : '') + fmt(b.s.value), lw = textW(label, 11) + 10;
    kids.push(h('g', { key: 'v' + i, transform: 'translate(' + (x + bw / 2 - lw / 2) + ',' + (top - 24) + ')' },
      h('rect', { className: cx('ll-wf-chip', cls), width: lw, height: 18, rx: 9 }),
      h('text', { className: cx('ll-wf-chiptext', cls), x: lw / 2, y: 12.5, textAnchor: 'middle' }, label)));
    var words = b.s.label.split(' '), half = Math.ceil(words.length / 2);
    kids.push(h('text', { key: 'x' + i, className: cx('ll-ch-xlabel', hi === i && 'is-hot'), x: x + bw / 2, y: H - 30, textAnchor: 'middle' },
      h('tspan', { x: x + bw / 2, dy: 0 }, words.slice(0, half).join(' ')),
      words.length > 1 ? h('tspan', { x: x + bw / 2, dy: 14 }, words.slice(half).join(' ')) : null));
    kids.push(h('rect', { key: 'hit' + i, x: pl + i * slot, y: pt - 30, width: slot, height: H - pt + 30, fill: 'transparent', onMouseEnter: function () { hv[1](i); } }));
  });
  return h('figure', { className: 'll-chart' },
    h('div', { className: 'll-chart-plot', ref: mw[0] }, h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, className: 'll-chart-svg', role: 'img', 'aria-label': p.label || 'Cash bridge', onMouseLeave: function () { hv[1](null); } }, h('defs', null, defs), h('g', { className: 'll-ch-grow' }, kids))),
    p.caption || !closes ? h('figcaption', { className: cx('ll-chart-cap', !closes && 'is-error') }, closes ? p.caption : 'This bridge does not close: the steps do not add up to the closing balance.') : null);
}

/* SankeyChart: a tree-shaped flow (revenue → costs and profit) with gradient ribbons. */
function SankeyChart(p) {
  var mw = useWidth(720), W = mw[1], H = p.height || 380, pl = 16, pr = p.labelWidth || 168, pt = 30, pb = 12, nodeW = 12, gap = 10;
  var uid = useUid('sk'), hv = useState(null), hot = hv[0];
  var fmt = p.format || function (v) { return formatMoney(v, { compact: true }); };
  var byId = {}; p.nodes.forEach(function (nd) { byId[nd.id] = Object.assign({ ins: [], outs: [], value: 0 }, nd); });
  p.links.forEach(function (l) { byId[l.source].outs.push(l); byId[l.target].ins.push(l); });
  Object.keys(byId).forEach(function (k) {
    var nd = byId[k], vin = nd.ins.reduce(function (s, l) { return s + l.value; }, 0), vout = nd.outs.reduce(function (s, l) { return s + l.value; }, 0);
    nd.value = Math.max(vin, vout);
  });
  var cols = Math.max.apply(null, p.nodes.map(function (nd) { return nd.col; })) + 1;
  var root = p.nodes.filter(function (nd) { return nd.col === 0; }).map(function (nd) { return byId[nd.id]; });
  var maxChildren = Math.max.apply(null, p.nodes.map(function (nd) { return byId[nd.id].outs.length; }));
  var k = (H - pt - pb - gap * (maxChildren + 2)) / root.reduce(function (s, nd) { return s + nd.value; }, 0);
  var colX = function (c) { return pl + c * (W - pl - pr - nodeW) / (cols - 1); };
  var y = pt; root.forEach(function (nd) { nd.x = colX(0); nd.y = y; nd.h = Math.max(2, nd.value * k); y += nd.h + gap; });
  var links = [];
  function place(nd) {
    var off = 0, cy = nd.y;
    nd.outs.forEach(function (l, i) {
      var t = byId[l.target], lh = Math.max(1.5, l.value * k);
      t.x = colX(t.col); t.y = cy; t.h = Math.max(2, t.value * k);
      links.push({ l: l, s: nd, t: t, sy: nd.y + off, ty: t.y, lh: lh });
      off += lh; cy += t.h + gap;
      place(t);
    });
  }
  root.forEach(place);
  var defs = [], ribbons = [], rects = [], labels = [];
  var usedH = pt; Object.keys(byId).forEach(function (id) { var nd = byId[id]; if (nd.x != null) usedH = Math.max(usedH, nd.y + nd.h); });
  H = Math.min(H, Math.ceil(usedH + 18));
  links.forEach(function (L, i) {
    var x0 = L.s.x + nodeW, x1 = L.t.x, mx = (x0 + x1) / 2, gid = uid + 'g' + i;
    defs.push(h('linearGradient', { key: gid, id: gid, gradientUnits: 'userSpaceOnUse', x1: x0, x2: x1, y1: 0, y2: 0 },
      h('stop', { offset: '0%', className: 'll-stop-' + (L.s.tone || 'chart-1'), stopOpacity: 0.42 }), h('stop', { offset: '100%', className: 'll-stop-' + (L.t.tone || 'chart-1'), stopOpacity: 0.5 })));
    var d = 'M' + x0 + ' ' + L.sy + 'C' + mx + ' ' + L.sy + ' ' + mx + ' ' + L.ty + ' ' + x1 + ' ' + L.ty + 'V' + (L.ty + L.lh) + 'C' + mx + ' ' + (L.ty + L.lh) + ' ' + mx + ' ' + (L.sy + L.lh) + ' ' + x0 + ' ' + (L.sy + L.lh) + 'Z';
    var on = hot == null || hot === L.t.id || hot === L.s.id;
    ribbons.push(h('path', { key: 'r' + i, d: d, fill: 'url(#' + gid + ')', className: cx('ll-sk-ribbon', !on && 'is-dim'), onMouseEnter: function () { hv[1](L.t.id); } },
      h('title', null, L.s.label + ' → ' + L.t.label + ': ' + formatMoney(L.l.value))));
  });
  var byCol = {};
  Object.keys(byId).forEach(function (id) {
    var nd = byId[id]; if (nd.x == null) return;
    var on = hot == null || hot === nd.id || nd.outs.some(function (l) { return l.target === hot; });
    rects.push(h('rect', { key: 'n' + id, x: nd.x, y: nd.y, width: nodeW, height: nd.h, rx: Math.min(3, nd.h / 2), className: cx('ll-sk-node', 'll-fill-' + (nd.tone || 'chart-1').replace('chart-', ''), !on && 'is-dim'), onMouseEnter: function () { hv[1](nd.id); } }));
    (byCol[nd.col] = byCol[nd.col] || []).push(nd);
  });
  Object.keys(byCol).forEach(function (c) {
    var list = byCol[c].slice().sort(function (a, b) { return a.y - b.y; }), last = -1e9;
    list.forEach(function (nd) {
      var terminal = !nd.outs.length;
      if (terminal) {
        var ly = Math.max(nd.y + nd.h / 2 - 7, last + 30); last = ly;
        labels.push(h('g', { key: 'l' + nd.id, transform: 'translate(' + (nd.x + nodeW + 8) + ',' + ly + ')', className: hot != null && hot !== nd.id ? 'is-dim' : undefined },
          h('text', { className: 'll-sk-label', y: 4 }, nd.label),
          h('text', { className: cx('ll-sk-value', nd.emphasis && 'is-strong'), y: 19 }, fmt(nd.value), h('tspan', { className: 'll-sk-pct', dx: 6 }, formatPct(nd.value / root[0].value, 0)))));
      } else {
        labels.push(h('g', { key: 'l' + nd.id, transform: 'translate(' + nd.x + ',' + (nd.y - 10) + ')' },
          h('text', { className: 'll-sk-label is-head' }, nd.label, h('tspan', { className: 'll-sk-value', dx: 8 }, fmt(nd.value)))));
      }
    });
  });
  return h('figure', { className: 'll-chart' },
    h('div', { className: 'll-chart-plot', ref: mw[0] },
      h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, className: 'll-chart-svg', role: 'img', 'aria-label': p.label || 'Flow of revenue', onMouseLeave: function () { hv[1](null); } },
        h('defs', null, defs), h('g', { className: 'll-ch-reveal' }, ribbons, rects), labels)),
    p.caption ? h('figcaption', { className: 'll-chart-cap' }, p.caption) : null);
}

/* RunwayGauge: a 270° dial with risk zones, a progress arc, ticks and a scenario marker. */
function polar(cx0, cy0, r, deg) { var a = (deg - 90) * Math.PI / 180; return [cx0 + r * Math.cos(a), cy0 + r * Math.sin(a)]; }
function arc(cx0, cy0, r, a0, a1) {
  var s = polar(cx0, cy0, r, a0), e = polar(cx0, cy0, r, a1), large = a1 - a0 > 180 ? 1 : 0;
  return 'M' + s[0].toFixed(2) + ' ' + s[1].toFixed(2) + 'A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + e[0].toFixed(2) + ' ' + e[1].toFixed(2);
}
function RunwayGauge(p) {
  var size = p.size || 240, c = size / 2, r = size / 2 - 34, max = p.max || 24, A0 = -135, A1 = 135;
  var uid = useUid('rg');
  function ang(m) { return A0 + Math.min(1, Math.max(0, m / max)) * (A1 - A0); }
  var tone = p.months < 6 ? 'negative' : p.months < 12 ? 'warning' : 'brand';
  var ticks = []; for (var m = 0; m <= max; m += 3) {
    var outer = polar(c, c, r + 16, ang(m)), inner = polar(c, c, r + (m % 6 ? 12 : 9), ang(m)), lab = polar(c, c, r + 27, ang(m));
    ticks.push(h('line', { key: 't' + m, className: 'll-g-tick', x1: inner[0], y1: inner[1], x2: outer[0], y2: outer[1] }));
    if (m % 6 === 0) ticks.push(h('text', { key: 'l' + m, className: 'll-g-ticklabel', x: lab[0], y: lab[1] + 3.5, textAnchor: 'middle' }, m));
  }
  var mk = p.compare != null ? polar(c, c, r, ang(p.compare)) : null;
  return h('div', { className: 'll-gauge', style: { width: size } },
    h('svg', { width: size, height: size * 0.9, viewBox: '0 0 ' + size + ' ' + (size * 0.9), role: 'img', 'aria-label': 'Runway ' + p.months.toFixed(1) + ' months' },
      h('defs', null, h('linearGradient', { id: uid, x1: 0, y1: 1, x2: 1, y2: 0 }, h('stop', { offset: '0%', className: 'll-stop-' + tone + '-deep' }), h('stop', { offset: '100%', className: 'll-stop-' + tone }))),
      h('path', { className: 'll-g-zone is-negative', d: arc(c, c, r + 16, ang(0), ang(6) - 1) }),
      h('path', { className: 'll-g-zone is-warning', d: arc(c, c, r + 16, ang(6) + 1, ang(12) - 1) }),
      h('path', { className: 'll-g-zone is-ok', d: arc(c, c, r + 16, ang(12) + 1, ang(max)) }),
      h('path', { className: 'll-g-track', d: arc(c, c, r, A0, A1) }),
      h('path', { className: 'll-g-value', d: arc(c, c, r, A0, ang(p.months)), stroke: 'url(#' + uid + ')' }),
      ticks,
      mk ? h('g', null, h('circle', { className: 'll-g-marker', cx: mk[0], cy: mk[1], r: 7 }), h('circle', { className: 'll-g-markerdot', cx: mk[0], cy: mk[1], r: 3 })) : null),
    h('div', { className: 'll-gauge-center' },
      h('div', { className: 'll-gauge-value' }, p.months.toFixed(1)),
      h('div', { className: 'll-gauge-unit' }, 'months of runway'),
      p.cashOut ? h('div', { className: cx('ll-gauge-out', 'is-' + tone) }, 'Cash out ' + p.cashOut) : null),
    p.compare != null ? h('div', { className: 'll-gauge-cmp' }, h('span', { className: 'll-legend-key ll-key-scenario' }), (p.compareLabel || 'Scenario') + ' · ' + p.compare.toFixed(1) + ' mo') : null);
}
function RunwayBar(p) {
  var max = p.max || 24, pct = Math.min(1, p.months / max) * 100;
  var ticks = []; for (var t = 0; t <= max; t += 6) ticks.push(t);
  var tone = p.months < 6 ? 'negative' : p.months < 12 ? 'warning' : 'brand';
  return h('div', { className: 'll-runway' },
    h('div', { className: 'll-runway-head' },
      h('span', { className: 'll-runway-val' }, p.months.toFixed(1), h('span', null, ' months')),
      p.compare != null ? h('span', { className: 'll-runway-cmp' }, h('span', { className: 'll-legend-key ll-key-scenario' }), (p.compareLabel || 'Scenario') + ': ' + p.compare.toFixed(1) + ' months') : null),
    h('div', { className: 'll-runway-track', role: 'img', 'aria-label': 'Runway ' + p.months.toFixed(1) + ' months' },
      h('span', { className: 'll-runway-zones', 'aria-hidden': true }, h('i', null), h('i', null), h('i', null)),
      h('span', { className: cx('ll-runway-fill', 'll-runway-' + tone), style: { width: pct + '%' } }),
      p.compare != null ? h('span', { className: 'll-runway-mark', style: { left: Math.min(100, p.compare / max * 100) + '%' } }) : null),
    h('div', { className: 'll-runway-ticks', 'aria-hidden': true }, ticks.map(function (t) {
      return h('span', { key: t, style: { left: (t / max * 100) + '%' } }, t === 0 ? 'Now' : t + ' mo');
    })),
    p.caption ? h('div', { className: 'll-runway-cap' }, p.caption) : null);
}

/* TornadoChart: which drivers move runway most, low and high case either side of the base. */
function TornadoChart(p) {
  var rows = p.rows.slice().sort(function (a, b) { return (Math.abs(b.high) + Math.abs(b.low)) - (Math.abs(a.high) + Math.abs(a.low)); });
  var ext = Math.max.apply(null, rows.map(function (r) { return Math.max(Math.abs(r.low), Math.abs(r.high)); }));
  ext = Math.ceil(ext);
  function pos(v) { return 50 + v / ext * 50; }
  var unit = p.unit || ' mo';
  var axis = [-ext, 0, ext];
  return h('div', { className: 'll-tornado' },
    h('div', { className: 'll-tornado-head' }, h('span', null, p.lowLabel || 'Downside'), h('span', { className: 'll-tornado-base' }, (p.baseLabel || 'Base') + ' ' + p.base.toFixed(1) + unit), h('span', null, p.highLabel || 'Upside')),
    rows.map(function (r) {
      return h('div', { key: r.label, className: 'll-tornado-row' },
        h('div', { className: 'll-tornado-label' }, h('span', null, r.label), h('span', { className: 'll-tornado-range' }, r.range)),
        h('div', { className: 'll-tornado-track' },
          h('span', { className: 'll-tornado-bar is-low', style: { left: pos(r.low) + '%', width: (50 - pos(r.low)) + '%' } }, h('em', null, '−' + Math.abs(r.low).toFixed(1))),
          h('span', { className: 'll-tornado-bar is-high', style: { left: '50%', width: (pos(r.high) - 50) + '%' } }, h('em', null, '+' + r.high.toFixed(1)))));
    }),
    h('div', { className: 'll-tornado-axis' }, h('div', null), h('div', { className: 'll-tornado-ticks' }, axis.map(function (a) {
      return h('span', { key: a, style: { left: pos(a) + '%' } }, (p.base + a).toFixed(0) + unit);
    }))));
}

/* CalendarHeatmap: daily net cash movement, inflows teal, outflows red, by week. */
function CalendarHeatmap(p) {
  var days = p.days, cell = p.cell || 13, gapC = 3, first = new Date(days[0].date + 'T00:00:00Z');
  var offset = (first.getUTCDay() + 6) % 7;
  var maxAbs = Math.max.apply(null, days.map(function (d) { return Math.abs(d.value); }));
  var hv = useState(null), hot = hv[0];
  var weeks = Math.ceil((days.length + offset) / 7), Wd = 34 + weeks * (cell + gapC), Hd = 22 + 7 * (cell + gapC);
  var MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var cells = [], months = [], lastMonth = -1;
  days.forEach(function (d, i) {
    var k = i + offset, wk = Math.floor(k / 7), dow = k % 7, x = 34 + wk * (cell + gapC), y = 22 + dow * (cell + gapC);
    var lvl = d.value === 0 ? 0 : Math.min(4, Math.ceil(Math.abs(d.value) / maxAbs * 4 + 0.0001)) * (d.value > 0 ? 1 : -1);
    var dt = new Date(d.date + 'T00:00:00Z');
    if (dt.getUTCMonth() !== lastMonth && dow < 4) { lastMonth = dt.getUTCMonth(); months.push(h('text', { key: 'm' + i, className: 'll-heat-month', x: x, y: 12 }, MN[lastMonth])); }
    cells.push(h('rect', { key: i, x: x, y: y, width: cell, height: cell, rx: 3, className: cx('ll-heat', 'll-heat-' + (lvl < 0 ? 'n' + (-lvl) : lvl > 0 ? 'p' + lvl : '0'), hot === i && 'is-hot'), onMouseEnter: function () { hv[1](i); } }));
  });
  var hd = hot != null ? days[hot] : null;
  return h('div', { className: 'll-heatmap' },
    h('div', { className: 'll-chart-plot' },
      h('svg', { width: Wd, height: Hd, viewBox: '0 0 ' + Wd + ' ' + Hd, role: 'img', 'aria-label': p.label || 'Daily cash movement', onMouseLeave: function () { hv[1](null); } },
        months, ['Mon', 'Wed', 'Fri'].map(function (dn, i) { return h('text', { key: dn, className: 'll-heat-dow', x: 0, y: 22 + (i * 2) * (cell + gapC) + 10 }, dn); }), cells)),
    h('div', { className: 'll-heat-foot' },
      h('span', { className: 'll-heat-readout' }, hd ? h(React.Fragment, null, h('strong', null, hd.label || hd.date), ' · ', h(Amount, { value: hd.value }), hd.note ? ' · ' + hd.note : '') : (p.hint || 'Hover a day to see its net movement')),
      h('span', { className: 'll-heat-legend' }, 'Out', [4, 3, 2, 1].map(function (l) { return h('i', { key: 'n' + l, className: 'll-heat-n' + l }); }), h('i', { className: 'll-heat-0' }), [1, 2, 3, 4].map(function (l) { return h('i', { key: 'p' + l, className: 'll-heat-p' + l }); }), 'In')));
}

/* Treemap: squarified, labelled where there is room. */
function squarify(items, x, y, w, hgt) {
  var total = items.reduce(function (s, it) { return s + it.value; }, 0), out = [];
  var scale = (w * hgt) / total, rest = items.map(function (it) { return { it: it, a: it.value * scale }; });
  function worst(row, len) {
    var s = row.reduce(function (t, r) { return t + r.a; }, 0), mx = Math.max.apply(null, row.map(function (r) { return r.a; })), mn = Math.min.apply(null, row.map(function (r) { return r.a; }));
    return Math.max(len * len * mx / (s * s), (s * s) / (len * len * mn));
  }
  while (rest.length) {
    var len = Math.min(w, hgt), row = [rest[0]], i = 1;
    while (i < rest.length && worst(row.concat([rest[i]]), len) <= worst(row, len)) { row.push(rest[i]); i++; }
    var s = row.reduce(function (t, r) { return t + r.a; }, 0);
    if (w >= hgt) { var cw = s / hgt, yy = y; row.forEach(function (r) { var ch = r.a / cw; out.push({ it: r.it, x: x, y: yy, w: cw, h: ch }); yy += ch; }); x += cw; w -= cw; }
    else { var rh = s / w, xx = x; row.forEach(function (r) { var rw = r.a / rh; out.push({ it: r.it, x: xx, y: y, w: rw, h: rh }); xx += rw; }); y += rh; hgt -= rh; }
    rest = rest.slice(row.length);
  }
  return out;
}
function Treemap(p) {
  var mw = useWidth(640), W = mw[1], H = p.height || 260, hv = useState(null), hot = hv[0];
  var items = p.items.slice().sort(function (a, b) { return b.value - a.value; });
  var total = items.reduce(function (s, it) { return s + it.value; }, 0);
  var tiles = squarify(items, 0, 0, W, H);
  return h('figure', { className: 'll-chart' },
    h('div', { className: 'll-chart-plot', ref: mw[0] },
      h('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, className: 'll-chart-svg', role: 'img', 'aria-label': p.label || 'Breakdown', onMouseLeave: function () { hv[1](null); } },
        tiles.map(function (t, i) {
          var mid = textW(t.it.label, 12.5) < t.w - 26 && t.h > 34, big = mid && t.h > 56;
          return h('g', { key: i, onMouseEnter: function () { hv[1](i); }, className: hot != null && hot !== i ? 'is-dim' : undefined },
            h('rect', { x: t.x + 2, y: t.y + 2, width: Math.max(0, t.w - 4), height: Math.max(0, t.h - 4), rx: 10, className: 'll-tm-tile ll-fill-' + (t.it.swatch || (i % 6) + 1) }),
            mid ? h('text', { className: 'll-tm-label', x: t.x + 14, y: t.y + 24 }, t.it.label) : null,
            big ? h('text', { className: 'll-tm-value', x: t.x + 14, y: t.y + 44 }, formatMoney(t.it.value, { compact: true }), h('tspan', { className: 'll-tm-pct', dx: 6 }, formatPct(t.it.value / total, 0))) : null,
            h('title', null, t.it.label + ': ' + formatMoney(t.it.value)));
        }))),
    p.caption ? h('figcaption', { className: 'll-chart-cap' }, p.caption) : null);
}

/* DonutChart: rounded segments with gaps, total in the middle, legend with amounts. */
function DonutChart(p) {
  var size = p.size || 180, c = size / 2, r = c - 14, sw = p.thickness || 18, hv = useState(null), hot = hv[0];
  var total = p.items.reduce(function (s, it) { return s + it.value; }, 0), a = 0, gapDeg = p.items.length > 1 ? 4 : 0;
  var segs = p.items.map(function (it, i) {
    var sweep = it.value / total * 360, a0 = a + gapDeg / 2, a1 = a + sweep - gapDeg / 2; a += sweep;
    return h('path', { key: i, d: arc(c, c, r, a0, Math.max(a0 + 0.5, a1)), className: cx('ll-donut-seg', 'll-stroke-' + (it.swatch || i + 1), hot != null && hot !== i && 'is-dim'), strokeWidth: hot === i ? sw + 4 : sw, onMouseEnter: function () { hv[1](i); } });
  });
  var cur = hot != null ? p.items[hot] : null;
  return h('div', { className: 'll-donut' },
    h('div', { className: 'll-donut-ring', style: { width: size, height: size } },
      h('svg', { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, role: 'img', 'aria-label': p.label || 'Breakdown', onMouseLeave: function () { hv[1](null); } }, h('circle', { cx: c, cy: c, r: r, className: 'll-donut-track', strokeWidth: sw }), segs),
      h('div', { className: 'll-donut-center' }, h('div', { className: 'll-donut-k' }, cur ? cur.label : (p.centerLabel || 'Total')), h('div', { className: 'll-donut-v' }, formatMoney(cur ? cur.value : total, { compact: true })))),
    p.legend !== false ? h('div', { className: 'll-donut-legend' }, p.items.map(function (it, i) {
      return h('div', { key: i, className: cx('ll-donut-row', hot === i && 'is-hot'), onMouseEnter: function () { hv[1](i); }, onMouseLeave: function () { hv[1](null); } },
        h('span', { className: 'll-legend-sw ll-fill-' + (it.swatch || i + 1) }), h('span', { className: 'll-donut-name' }, it.label),
        h('span', { className: 'll-donut-pct' }, formatPct(it.value / total, 0)), h(Amount, { value: it.value, compact: true }));
    })) : null);
}

/* BulletChart: actual against target with qualitative bands. */
function BulletChart(p) {
  return h('div', { className: 'll-bullets' }, p.rows.map(function (r) {
    var max = r.max, f = r.format || function (v) { return formatMoney(v, { compact: true }); };
    var good = r.invert ? r.actual <= r.target : r.actual >= r.target;
    return h('div', { key: r.label, className: 'll-bullet' },
      h('div', { className: 'll-bullet-head' }, h('span', { className: 'll-bullet-label' }, r.label),
        h('span', { className: 'll-bullet-figs' }, h('strong', { className: good ? 'is-good' : 'is-bad' }, f(r.actual)), h('span', null, ' of ' + f(r.target) + ' target'))),
      h('div', { className: 'll-bullet-track' },
        (r.bands || []).map(function (b, i) { return h('span', { key: i, className: 'll-bullet-band b' + i, style: { width: (b / max * 100) + '%' } }); }),
        h('span', { className: cx('ll-bullet-bar', good ? 'is-good' : 'is-bad'), style: { width: Math.min(100, r.actual / max * 100) + '%' } }),
        h('span', { className: 'll-bullet-target', style: { left: (r.target / max * 100) + '%' } })));
  }));
}

/* BalanceBars: assets beside liabilities plus equity, the same height because they balance. */
function BalanceBars(p) {
  var total = p.assets.reduce(function (s, a) { return s + a.value; }, 0);
  var claims = p.liabilities.concat(p.equity), total2 = claims.reduce(function (s, a) { return s + a.value; }, 0);
  var ok = Math.abs(total - total2) < 0.5;
  function col(title, items, tot, kind) {
    return h('div', { className: 'll-bal-col' },
      h('div', { className: 'll-bal-title' }, h('span', null, title), h(Amount, { value: tot, strong: true })),
      h('div', { className: 'll-bal-stack' }, items.map(function (it, i) {
        return h('div', { key: i, title: it.label + ': ' + formatMoney(it.value), className: cx('ll-bal-seg', 'll-fill-' + it.swatch, it.group === 'equity' && 'is-equity'), style: { flexGrow: it.value } },
          it.value / tot > 0.07 ? h('span', { className: 'll-bal-seglabel' }, h('span', null, it.label), h('b', null, formatMoney(it.value, { compact: true }))) : null);
      })));
  }
  return h('div', { className: 'll-bal' }, col('Assets', p.assets, total),
    h('div', { className: cx('ll-bal-eq', ok ? 'is-ok' : 'is-bad') }, h('span', null, ok ? '=' : '≠'), h('small', null, ok ? 'Balances' : 'Off by ' + formatMoney(total - total2))),
    col('Liabilities and equity', claims, total2));
}

/* ---------- data display ---------- */
function FinancialStatement(p) {
  var cols = p.columns, ff = p.forecastFrom;
  var st = useState(p.selected || null), sel = st[0];
  function cell(v, ci, row, ri) {
    var isF = ff != null && ci >= ff && ci < cols.length - (p.totalColumn ? 1 : 0);
    var clickable = row.type === 'line' && p.drillable !== false;
    var key = ri + ':' + ci;
    var inner = h(Amount, { value: v, forecast: isF, strong: row.type !== 'line', tone: row.tone });
    return h('td', { key: ci, className: cx('ll-fs-num', isF && 'is-forecast', p.totalColumn && ci === cols.length - 1 && 'is-totalcol', sel === key && 'is-selected') },
      clickable && !isF ? h('button', { type: 'button', className: 'll-fs-drill', 'aria-label': 'Show ledger lines for ' + row.label + ', ' + cols[ci].label,
        onClick: function () { st[1](key); p.onDrill && p.onDrill(row, ci); } }, inner) : inner);
  }
  return h('div', { className: 'll-fs-wrap' },
    h('table', { className: cx('ll-fs', p.dense && 'll-fs-dense') },
      h('thead', null, h('tr', null,
        h('th', { className: 'll-fs-labelh', scope: 'col' }, p.title || 'Account'),
        cols.map(function (c, ci) {
          var isF = ff != null && ci >= ff && !(p.totalColumn && ci === cols.length - 1);
          return h('th', { key: ci, scope: 'col', className: cx('ll-fs-colh', isF && 'is-forecast', p.totalColumn && ci === cols.length - 1 && 'is-totalcol') },
            h('span', { className: 'll-fs-colname' }, c.label),
            h('span', { className: cx('ll-fs-colkind', isF && 'is-forecast') }, c.kind || (isF ? 'F' : 'A')));
        }))),
      h('tbody', null, p.rows.map(function (r, ri) {
        if (r.type === 'section') return h('tr', { key: ri, className: 'll-fs-section' }, h('th', { scope: 'rowgroup', colSpan: cols.length + 1 }, r.label));
        if (r.type === 'spacer') return h('tr', { key: ri, className: 'll-fs-spacer' }, h('td', { colSpan: cols.length + 1 }));
        return h('tr', { key: ri, className: cx('ll-fs-row', 'll-fs-' + r.type) },
          h('th', { scope: 'row', className: 'll-fs-label' },
            r.code ? h('span', { className: 'll-fs-code' }, r.code) : null, h('span', null, r.label),
            r.note ? h('span', { className: 'll-fs-note' }, r.note) : null),
          r.values.map(function (v, ci) { return cell(v, ci, r, ri); }));
      }))));
}

function LedgerTable(p) {
  var dr = 0, cr = 0, hide = p.hide || [];
  var heads = ['Date', 'Journal', 'Account', 'Contact', 'Description'].filter(function (c) { return hide.indexOf(c.toLowerCase()) < 0; });
  p.lines.forEach(function (l) { dr += l.debit || 0; cr += l.credit || 0; });
  return h('div', { className: 'll-table-wrap' },
    h('table', { className: 'll-table ll-ledger' },
      h('thead', null, h('tr', null,
        heads.map(function (c) { return h('th', { key: c, scope: 'col' }, c); }),
        h('th', { scope: 'col', className: 'is-num' }, 'Debit'), h('th', { scope: 'col', className: 'is-num' }, 'Credit'))),
      h('tbody', null, p.lines.map(function (l, i) {
        return h('tr', { key: i },
          h('td', { className: 'll-nowrap' }, l.date),
          h('td', null, h('span', { className: 'll-code' }, l.journal)),
          hide.indexOf('account') < 0 ? h('td', { className: 'll-nowrap' }, h('span', { className: 'll-fs-code' }, l.code), ' ', l.account) : null,
          h('td', null, l.contact || h('span', { className: 'll-muted' }, '—')),
          h('td', { className: 'll-desc' }, l.description),
          h('td', { className: 'is-num' }, l.debit ? h(Amount, { value: l.debit, decimals: 2 }) : null),
          h('td', { className: 'is-num' }, l.credit ? h(Amount, { value: l.credit, decimals: 2 }) : null));
      })),
      p.totals !== false ? h('tfoot', null, h('tr', null,
        h('th', { scope: 'row', colSpan: heads.length }, 'Total · ', p.lines.length, ' lines'),
        h('td', { className: 'is-num' }, h(Amount, { value: dr, decimals: 2, strong: true })),
        h('td', { className: 'is-num' }, h(Amount, { value: cr, decimals: 2, strong: true })))) : null));
}

function DataTable(p) {
  return h('div', { className: 'll-table-wrap' },
    h('table', { className: 'll-table' },
      h('thead', null, h('tr', null, p.columns.map(function (c) { return h('th', { key: c.key, scope: 'col', className: c.numeric ? 'is-num' : undefined }, c.label); }))),
      h('tbody', null, p.rows.map(function (r, i) {
        return h('tr', { key: i, className: p.selected === i ? 'is-selected' : undefined }, p.columns.map(function (c) {
          return h('td', { key: c.key, className: c.numeric ? 'is-num' : undefined }, c.render ? c.render(r) : r[c.key]);
        }));
      }))));
}

function AgedDebtors(p) {
  var total = p.buckets.reduce(function (s, b) { return s + b.value; }, 0);
  return h('div', { className: 'll-aged' },
    h('div', { className: 'll-aged-bar', role: 'img', 'aria-label': 'Debtors by age' }, p.buckets.map(function (b, i) {
      return h('span', { key: i, className: 'll-aged-' + i, style: { width: (b.value / total * 100) + '%' } });
    })),
    h('div', { className: 'll-aged-rows' }, p.buckets.map(function (b, i) {
      return h('div', { key: i, className: 'll-aged-row' }, h('span', { className: 'll-aged-key ll-aged-' + i }), h('span', { className: 'll-aged-label' }, b.label),
        h('span', { className: 'll-aged-pct' }, formatPct(b.value / total, 0)), h(Amount, { value: b.value }));
    })),
    h('div', { className: 'll-aged-total' }, h('span', null, p.totalLabel || 'Owed to you'), h(Amount, { value: total, strong: true })));
}
function ReconcileCheck(p) {
  var ok = p.status !== 'mismatch';
  return h('div', { className: cx('ll-recon', ok ? 'is-ok' : 'is-diff') },
    h(Icon, { name: ok ? 'reconcile' : 'warning', size: 18 }),
    h('div', null,
      h('div', { className: 'll-recon-title' }, ok ? 'Matches Xero’s ' + (p.report || 'P&L') + ' to the cent' : 'Differs from Xero’s ' + (p.report || 'P&L') + ' by ' + formatMoney(p.diff, { decimals: 2 })),
      h('div', { className: 'll-recon-meta' }, ok ? 'Checked ' + p.checkedAt + ' · ' + p.lines + ' accounts compared' : p.detail)),
    p.action || null);
}

/* ---------- feedback ---------- */
var TONE_ICON = { info: 'info', positive: 'success', negative: 'error', warning: 'warning' };
function Banner(p) {
  var tone = p.tone || 'info';
  return h('div', { className: cx('ll-banner', 'll-banner-' + tone), role: tone === 'negative' ? 'alert' : 'status' },
    h(Icon, { name: p.icon || TONE_ICON[tone], size: 18 }),
    h('div', { className: 'll-banner-body' }, p.title ? h('div', { className: 'll-banner-title' }, p.title) : null, p.children ? h('div', null, p.children) : null),
    p.action ? h('div', { className: 'll-banner-action' }, p.action) : null,
    p.onClose ? h(IconButton, { icon: 'close', label: 'Dismiss', size: 'sm', onClick: p.onClose }) : null);
}
function Toast(p) {
  var tone = p.tone || 'info';
  return h('div', { className: cx('ll-toast', 'll-toast-' + tone), role: 'status' },
    h(Icon, { name: TONE_ICON[tone], size: 18 }),
    h('div', { className: 'll-toast-body' }, h('div', { className: 'll-toast-title' }, p.title), p.children ? h('div', { className: 'll-toast-text' }, p.children) : null),
    p.action || null,
    h(IconButton, { icon: 'close', label: 'Dismiss', size: 'sm', onClick: p.onClose }));
}
function EmptyState(p) {
  return h('div', { className: cx('ll-empty', p.compact && 'll-empty-compact') },
    h('span', { className: 'll-empty-icon' }, h(Icon, { name: p.icon || 'ledger', size: 24 })),
    h('div', { className: 'll-empty-title' }, p.title),
    p.children ? h('p', { className: 'll-empty-text' }, p.children) : null,
    p.action ? h('div', { className: 'll-empty-action' }, p.action) : null);
}
function SyncProgress(p) {
  var pct = p.pagesTotal ? p.pagesDone / p.pagesTotal : 0;
  var phases = p.phases || ['Accounts', 'Journals', 'Invoices', 'Reports', 'Check against Xero'];
  return h('div', { className: 'll-syncp' },
    h('div', { className: 'll-syncp-head' },
      h('div', null, h('div', { className: 'll-syncp-title' }, p.title || 'Syncing ' + (p.org || 'your organisation')),
        h('div', { className: 'll-syncp-meta' }, 'Page ' + p.pagesDone + (p.pagesTotal ? ' of ' + p.pagesTotal : '') + ' · ' + (p.journals || 0).toLocaleString('en-IE') + ' journals' + (p.eta ? ' · about ' + p.eta + ' left' : ''))),
      h(StatusPill, { status: 'syncing' })),
    p.pagesTotal ? h(ProgressBar, { value: pct, label: 'Sync progress', tone: 'forecast' }) : h('div', { className: 'll-progress ll-progress-indeterminate', role: 'progressbar', 'aria-label': 'Sync progress' }, h('span', null)),
    h('ol', { className: 'll-syncp-steps' }, phases.map(function (ph, i) {
      var state = i < p.phase ? 'done' : i === p.phase ? 'now' : 'next';
      return h('li', { key: ph, className: 'is-' + state },
        state === 'done' ? h(Icon, { name: 'check', size: 14, strokeWidth: 2.25 }) : state === 'now' ? h(Spinner, null) : h('span', { className: 'll-syncp-dot' }), ph);
    })));
}
function Stepper(p) {
  return h('ol', { className: 'll-stepper' }, p.steps.map(function (s, i) {
    var state = i < p.current ? 'done' : i === p.current ? 'now' : 'next';
    return h('li', { key: s.title, className: 'is-' + state, 'aria-current': state === 'now' ? 'step' : undefined },
      h('span', { className: 'll-step-num' }, state === 'done' ? h(Icon, { name: 'check', size: 14, strokeWidth: 2.5 }) : i + 1),
      h('span', { className: 'll-step-text' }, h('span', { className: 'll-step-title' }, s.title), s.hint ? h('span', { className: 'll-step-hint' }, s.hint) : null));
  }));
}

/* ---------- overlays ---------- */
function Dialog(p) {
  var body = h('div', { className: cx('ll-dialog', p.size === 'sm' && 'll-dialog-sm'), role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'll-dlg-t' },
    h('div', { className: 'll-dialog-head' }, h('h2', { id: 'll-dlg-t', className: 'll-dialog-title' }, p.title), h(IconButton, { icon: 'close', label: 'Close', onClick: p.onClose })),
    h('div', { className: 'll-dialog-body' }, p.children),
    p.footer ? h('div', { className: 'll-dialog-foot' }, p.footer) : null);
  return h('div', { className: cx('ll-scrim', p.inline && 'is-inline') }, body);
}
function Drawer(p) {
  return h('div', { className: cx('ll-drawer-layer', p.inline && 'is-inline') },
    p.inline ? null : h('div', { className: 'll-scrim-plain', onClick: p.onClose }),
    h('aside', { className: 'll-drawer', role: 'dialog', 'aria-label': p.title },
      h('div', { className: 'll-drawer-head' },
        h('div', null, p.eyebrow ? h('div', { className: 'll-eyebrow' }, p.eyebrow) : null, h('h2', { className: 'll-drawer-title' }, p.title), p.subtitle ? h('div', { className: 'll-drawer-sub' }, p.subtitle) : null),
        h(IconButton, { icon: 'close', label: 'Close', onClick: p.onClose })),
      h('div', { className: 'll-drawer-body' }, p.children),
      p.footer ? h('div', { className: 'll-drawer-foot' }, p.footer) : null));
}
function Menu(p) {
  return h('div', { className: 'll-menu', role: 'menu', 'aria-label': p.label }, p.items.map(function (it, i) {
    if (it.divider) return h('div', { key: i, className: 'll-menu-div', role: 'separator' });
    if (it.heading) return h('div', { key: i, className: 'll-menu-head' }, it.heading);
    return h('button', { key: i, type: 'button', role: 'menuitem', className: cx('ll-menu-item', it.danger && 'is-danger', it.active && 'is-active'), onClick: it.onClick },
      it.icon ? h(Icon, { name: it.icon, size: 16 }) : h('span', { className: 'll-menu-pad' }),
      h('span', { className: 'll-menu-label' }, it.label),
      it.kbd ? h(Kbd, null, it.kbd) : null,
      it.active ? h(Icon, { name: 'check', size: 16 }) : null);
  }));
}
function CommandPalette(p) {
  return h('div', { className: 'll-cmd', role: 'dialog', 'aria-label': 'Command palette' },
    h('div', { className: 'll-cmd-input' }, h(Icon, { name: 'search', size: 18 }), h('input', { id: 'll-cmd-q', placeholder: 'Search reports, accounts and actions', defaultValue: p.query || '' }), h(Kbd, null, 'Esc')),
    p.groups.map(function (g) {
      return h('div', { key: g.label, className: 'll-cmd-group' }, h('div', { className: 'll-menu-head' }, g.label),
        g.items.map(function (it, i) {
          return h('div', { key: i, className: cx('ll-cmd-item', it.active && 'is-active') }, h(Icon, { name: it.icon, size: 16 }),
            h('span', { className: 'll-menu-label' }, it.label), it.meta ? h('span', { className: 'll-cmd-meta' }, it.meta) : null, it.kbd ? h(Kbd, null, it.kbd) : null);
        }));
    }));
}

function fmtKpi(p) {
  if (p.value === null || p.value === undefined) return '\u2013';
  return p.format === 'pct' ? formatPct(p.value) : p.format === 'months' ? p.value.toFixed(1) + ' mo' : p.format === 'days' ? p.value + ' days'
    : p.format === 'ratio' ? p.value.toFixed(2) + '×' : formatMoney(p.value, { compact: p.compact !== false });
}
function KpiTile(p) {
  return h('div', { className: cx('ll-kpi', p.tone && 'is-' + p.tone, p.className) },
    h('div', { className: 'll-kpi-head' },
      p.icon ? h('span', { className: cx('ll-kpi-icon', 'is-' + (p.tone || 'brand')) }, h(Icon, { name: p.icon, size: 16 })) : null,
      h('span', { className: 'll-kpi-label' }, p.label),
      p.status ? h(StatusPill, { status: p.status }) : null),
    h('div', { className: cx('ll-kpi-value', p.value < 0 && (p.format == null || p.format === 'money') && 'is-neg') }, fmtKpi(p)),
    h('div', { className: 'll-kpi-foot' },
      p.delta != null ? h(DeltaPill, { value: p.delta, invert: p.invert, label: p.deltaLabel }) : h('span', { className: 'll-kpi-note' }, p.note || '')),
    p.spark ? h('div', { className: 'll-kpi-spark' }, h(SparkFill, { data: p.spark, forecastFrom: p.forecastFrom, tone: p.sparkTone, label: p.label + ' trend' })) : null);
}
function DeltaPill(p) {
  var v = p.value, good = p.invert ? v < 0 : v > 0, flat = Math.abs(v) < 0.0005, tone = flat ? 'neutral' : good ? 'positive' : 'negative';
  return h('span', { className: 'll-dpill-wrap' },
    h('span', { className: cx('ll-dpill', 'is-' + tone) }, flat ? null : h(Icon, { name: v > 0 ? 'trend-up' : 'trend-down', size: 13, strokeWidth: 2.25 }),
      (v > 0 ? '+' : v < 0 ? '−' : '') + formatPct(Math.abs(v), p.decimals)),
    p.label ? h('span', { className: 'll-delta-label' }, p.label) : null);
}
function SparkFill(p) {
  var mw = useWidth(200), W = mw[1];
  return h('div', { ref: mw[0], className: 'll-sparkfill' }, h(Sparkline, { data: p.data, forecastFrom: p.forecastFrom, width: W, height: p.height || 44, tone: p.tone, label: p.label }));
}
function HeroMetric(p) {
  return h('div', { className: 'll-hero' },
    h('div', { className: 'll-hero-top' },
      h('div', null,
        h('div', { className: 'll-hero-label' }, p.icon ? h(Icon, { name: p.icon, size: 16 }) : null, p.label),
        h('div', { className: 'll-hero-value' }, formatMoney(p.value), p.cents ? h('span', { className: 'll-hero-cents' }, p.cents) : null),
        h('div', { className: 'll-hero-meta' }, p.delta != null ? h(DeltaPill, { value: p.delta, invert: p.invert, label: p.deltaLabel }) : null, p.meta ? h('span', null, p.meta) : null)),
      p.aside || null),
    p.children ? h('div', { className: 'll-hero-body' }, p.children) : null);
}

/* ---------- navigation ---------- */
function Breadcrumbs(p) {
  return h('nav', { className: 'll-crumbs', 'aria-label': 'Breadcrumb' }, h('ol', null, p.items.map(function (it, i) {
    var last = i === p.items.length - 1;
    return h('li', { key: i }, last ? h('span', { 'aria-current': 'page' }, it) : h('a', { href: '#' + i }, it), last ? null : h(Icon, { name: 'chevron-right', size: 14 }));
  })));
}
function Pagination(p) {
  return h('nav', { className: 'll-pager', 'aria-label': 'Pagination' },
    h('span', { className: 'll-pager-info' }, p.from + '–' + p.to + ' of ' + p.total.toLocaleString('en-IE')),
    h(IconButton, { icon: 'chevron-left', label: 'Previous page', size: 'sm', variant: 'outline', disabled: p.page <= 1 }),
    h('span', { className: 'll-pager-page' }, 'Page ' + p.page + ' of ' + p.pages),
    h(IconButton, { icon: 'chevron-right', label: 'Next page', size: 'sm', variant: 'outline', disabled: p.page >= p.pages }));
}
function NavItem(p) {
  return h(p.linkAs || 'a', { href: p.href || '#' + p.id, className: cx('ll-nav-item', p.active && 'is-active'), 'aria-current': p.active ? 'page' : undefined, title: p.rail ? p.label : undefined },
    h('span', { className: 'll-nav-ico' }, h(Icon, { name: p.icon, size: 18 })), p.rail ? null : h('span', { className: 'll-nav-label' }, p.label),
    !p.rail && p.badge ? h('span', { className: 'll-nav-badge' }, p.badge) : null,
    !p.rail && p.kbd ? h('span', { className: 'll-nav-kbd' }, p.kbd) : null,
    p.rail && p.badge ? h('span', { className: 'll-nav-dot' }) : null);
}
function OrgSwitcher(p) {
  return h('button', { type: 'button', className: 'll-org', 'aria-haspopup': 'menu' },
    h('span', { className: 'll-org-avatar' }, initials(p.name)),
    h('span', { className: 'll-org-text' }, h('span', { className: 'll-org-name' }, p.name), h('span', { className: 'll-org-meta' }, p.meta)),
    h(Icon, { name: 'chevron-down', size: 16 }));
}
var NAV = [
  { heading: 'Reports' },
  { id: 'overview', label: 'Overview', icon: 'overview', kbd: 'G O' },
  { id: 'pnl', label: 'Profit and loss', icon: 'statement', kbd: 'G P' },
  { id: 'balance', label: 'Balance sheet', icon: 'balance', kbd: 'G B' },
  { id: 'cashflow', label: 'Cash flow', icon: 'cashflow', kbd: 'G C' },
  { heading: 'Plan' },
  { id: 'forecast', label: 'Forecast', icon: 'forecast' },
  { id: 'scenarios', label: 'Scenarios', icon: 'scenario', badge: '4' },
  { id: 'boardpack', label: 'Board pack', icon: 'boardpack' },
  { heading: 'Data' },
  { id: 'ledger', label: 'Ledger', icon: 'ledger' },
  { id: 'sync', label: 'Sync and Xero', icon: 'sync' },
  { id: 'audit', label: 'Audit log', icon: 'audit' }
];
function MiniRunway(p) {
  var pct = Math.min(1, p.months / 24), r = 15, c = 2 * Math.PI * r;
  var tone = p.months < 6 ? 'negative' : p.months < 12 ? 'warning' : 'brand';
  return h('div', { className: 'll-minirun' },
    h('svg', { width: 40, height: 40, viewBox: '0 0 40 40', 'aria-hidden': true },
      h('circle', { cx: 20, cy: 20, r: r, className: 'll-minirun-track' }),
      h('circle', { cx: 20, cy: 20, r: r, className: 'll-minirun-val is-' + tone, strokeDasharray: (c * pct).toFixed(1) + ' ' + c.toFixed(1), transform: 'rotate(-90 20 20)' })),
    h('div', { className: 'll-minirun-text' },
      h('div', { className: 'll-minirun-k' }, 'Runway'),
      h('div', { className: 'll-minirun-v' }, p.months.toFixed(1), h('span', null, ' months'))),
    h('div', { className: 'll-minirun-sync' }, h('span', { className: cx('ll-sync-dot', p.syncing && 'is-live') }), p.syncText || 'Synced 4 min ago'));
}
function Sidebar(p) {
  var items = p.items || NAV;
  if (p.rail) return h('nav', { className: 'll-sidebar is-rail', 'aria-label': 'Main' },
    h('div', { className: 'll-rail-logo' }, h(Logo, { size: 30, variant: 'mark' })),
    h('span', { className: 'll-org-avatar', title: p.org || 'Kestrel Joinery Ltd' }, initials(p.org || 'Kestrel Joinery Ltd')),
    h(IconButton, { icon: 'search', label: 'Search', className: 'll-rail-btn' }),
    h('div', { className: 'll-sidebar-nav' }, items.filter(function (it) { return !it.heading; }).map(function (it) { return h(NavItem, Object.assign({ key: it.id, rail: true, linkAs: p.linkAs }, it, { active: it.id === p.active })); })),
    h('div', { className: 'll-sidebar-foot' }, h(NavItem, { id: 'settings', label: 'Settings', icon: 'settings', rail: true, href: p.settingsHref, linkAs: p.linkAs }), h(Avatar, { name: p.user || 'Aoife Byrne', size: 32 })));
  return h('nav', { className: 'll-sidebar', 'aria-label': 'Main' },
    h('div', { className: 'll-sidebar-top' }, h(Logo, { size: 28 }), h(IconButton, { icon: 'menu', label: 'Collapse sidebar', size: 'sm' })),
    p.orgSwitcher || h(OrgSwitcher, { name: p.org || 'Kestrel Joinery Ltd', meta: p.orgMeta || 'Xero · EUR · FY Jan–Dec' }),
    h('button', { type: 'button', className: 'll-search', onClick: p.onSearch }, h(Icon, { name: 'search', size: 16 }), h('span', null, 'Search'), h(Kbd, null, 'Ctrl K')),
    h('div', { className: 'll-sidebar-nav' }, items.map(function (it, i) {
      if (it.heading) return h('div', { key: i, className: 'll-nav-head' }, it.heading);
      return h(NavItem, Object.assign({ key: it.id, linkAs: p.linkAs }, it, { active: it.id === p.active }));
    })),
    h('div', { className: 'll-sidebar-foot' },
      p.runway === null ? null : h(MiniRunway, { months: p.runway != null ? p.runway : 14.0, syncText: p.syncText, syncing: p.syncing }),
      h('div', { className: 'll-user' }, h(Avatar, { name: p.user || 'Aoife Byrne', size: 32 }),
        h('span', { className: 'll-user-text' }, h('span', { className: 'll-user-name' }, p.user || 'Aoife Byrne'), h('span', { className: 'll-user-role' }, p.role || 'Owner')),
        p.userMenu || h(IconButton, { icon: 'settings', label: 'Settings', size: 'sm', onClick: p.onSettings }))));
}
function PeriodPicker(p) {
  return h('button', { type: 'button', className: 'll-picker', 'aria-haspopup': 'dialog' },
    h(Icon, { name: 'calendar', size: 16 }), h('span', null, p.label || 'Jan – Dec 2026'), h(Icon, { name: 'chevron-down', size: 14 }));
}
function MonthGrid(p) {
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return h('div', { className: 'll-monthgrid' },
    h('div', { className: 'll-monthgrid-head' }, h(IconButton, { icon: 'chevron-left', label: 'Previous year', size: 'sm' }), h('span', null, p.year || 2026), h(IconButton, { icon: 'chevron-right', label: 'Next year', size: 'sm' })),
    h('div', { className: 'll-monthgrid-cells' }, months.map(function (m, i) {
      var inRange = i >= p.from && i <= p.to, edge = i === p.from || i === p.to, fc = p.forecastFrom != null && i >= p.forecastFrom;
      return h('button', { key: m, type: 'button', className: cx('ll-month', inRange && 'is-range', edge && 'is-edge', fc && 'is-forecast') }, m);
    })),
    h('div', { className: 'll-monthgrid-foot' }, h('span', { className: 'll-legend-item' }, h('span', { className: 'll-legend-sw ll-hatch-sw' }), 'Forecast months'), h('span', null, 'Presets: This year · Last 12 months · Q3')));
}
function ScenarioSwitcher(p) {
  return h('button', { type: 'button', className: 'll-picker ll-picker-scenario', 'aria-haspopup': 'menu' },
    h('span', { className: 'll-picker-dot' }), h('span', { className: 'll-picker-k' }, 'Scenario'), h('span', null, p.name || 'Base case'), h(Icon, { name: 'chevron-down', size: 14 }));
}
function Topbar(p) {
  return h('header', { className: 'll-topbar' },
    h('div', { className: 'll-topbar-l' },
      p.breadcrumbs ? h(Breadcrumbs, { items: p.breadcrumbs }) : null,
      h('div', { className: 'll-topbar-titlerow' }, h('h1', { className: 'll-page-title' }, p.title), p.status || null),
      p.subtitle ? h('div', { className: 'll-page-sub' }, p.subtitle) : null),
    h('div', { className: 'll-topbar-r' }, p.children));
}
function AppShell(p) {
  return h('div', { className: cx('ll-shell', p.rail && 'is-rail') },
    h(Sidebar, Object.assign({ active: p.active, org: p.org, rail: p.rail, runway: p.runway, syncText: p.syncText, syncing: p.syncing }, p.sidebar || {})),
    h('main', { className: 'll-main' },
      h(Topbar, { title: p.title, subtitle: p.subtitle, breadcrumbs: p.breadcrumbs, status: p.status }, p.actions),
      h('div', { className: 'll-page' }, p.children)),
    p.overlay || null);
}
function Panel(p) {
  return h('section', { className: cx('ll-panel', p.flush && 'll-panel-flush', p.tone && 'is-' + p.tone, p.className) },
    p.title || p.actions ? h('div', { className: 'll-panel-head' },
      h('div', { className: 'll-panel-titles' },
        p.icon ? h('span', { className: 'll-panel-icon' }, h(Icon, { name: p.icon, size: 16 })) : null,
        h('div', null, h('h2', { className: 'll-panel-title' }, p.title), p.subtitle ? h('div', { className: 'll-panel-sub' }, p.subtitle) : null)),
      p.actions ? h('div', { className: 'll-panel-actions' }, p.actions) : null) : null,
    h('div', { className: 'll-panel-body' }, p.children));
}

/* ---------- planning ---------- */
function AssumptionField(p) {
  var st = useState(p.defaultValue), val = p.value != null ? p.value : st[0];
  var changed = p.base != null && val !== p.base;
  return h('div', { className: cx('ll-assume', changed && 'is-changed') },
    h('div', { className: 'll-assume-head' },
      h('label', { className: 'll-assume-label', htmlFor: p.id }, p.label),
      changed ? h('span', { className: 'll-assume-base' }, 'Base ' + (p.format ? p.format(p.base) : p.base)) : null),
    h('div', { className: 'll-assume-row' },
      h('input', { id: p.id + '-r', type: 'range', min: p.min, max: p.max, step: p.step || 1, value: val, 'aria-label': p.label,
        style: { '--ll-fill': ((val - p.min) / (p.max - p.min) * 100) + '%' }, onChange: function (e) { var v = +e.target.value; st[1](v); p.onChange && p.onChange(v); } }),
      h('div', { className: 'll-input is-numeric ll-assume-num' },
        h('input', { id: p.id, type: 'text', inputMode: 'decimal', value: val, onChange: function (e) { var v = parseFloat(e.target.value); if (!isNaN(v)) { st[1](v); p.onChange && p.onChange(v); } } }),
        p.unit ? h('span', { className: 'll-input-affix' }, p.unit) : null)),
    p.help ? h('div', { className: 'll-field-hint' }, p.help) : null);
}
function HireRow(p) {
  return h('div', { className: 'll-hire' },
    h('span', { className: 'll-hire-grip', 'aria-hidden': true }, h(Icon, { name: 'grip', size: 16 })),
    h('span', { className: 'll-hire-icon' }, h(Icon, { name: 'hire', size: 18 })),
    h('div', { className: 'll-hire-main' }, h('div', { className: 'll-hire-role' }, p.role), h('div', { className: 'll-hire-meta' }, 'Starts ' + p.start + ' · ' + (p.count || 1) + ' × ' + formatMoney(p.salary) + ' a year')),
    h('div', { className: 'll-hire-cost' }, h(Amount, { value: -p.monthly, forecast: true }), h('span', null, 'per month, loaded')),
    p.onRemove ? h(IconButton, { icon: 'trash', label: 'Remove ' + p.role, size: 'sm', onClick: p.onRemove }) : null);
}
function ScenarioCard(p) {
  var months = function (v) { return v === null || v === undefined ? (p.horizon ? p.horizon + '+ mo' : '\u2013') : v.toFixed(1) + ' mo'; };
  return h('div', { className: cx('ll-scn', p.active && 'is-active', p.compare && 'is-compare', p.onSelect && 'is-selectable'), onClick: p.onSelect, role: p.onSelect ? 'button' : undefined, tabIndex: p.onSelect ? 0 : undefined,
      onKeyDown: p.onSelect ? function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.onSelect(); } } : undefined },
    h('div', { className: 'll-scn-head' },
      h('span', { className: cx('ll-scn-chip', p.compare ? 'is-compare' : p.base ? 'is-base' : '') }, h(Icon, { name: p.base ? 'statement' : 'branch', size: 14 }), p.base ? 'Base' : p.compare ? 'Compared' : 'Branch'),
      p.menu || null),
    h('div', { className: 'll-scn-name' }, p.name),
    p.parent ? h('div', { className: 'll-scn-parent' }, 'From ' + p.parent + ' \u00b7 ' + p.changes + (p.changes === 1 ? ' change' : ' changes')) : h('div', { className: 'll-scn-parent' }, 'Built from synced actuals'),
    h('dl', { className: 'll-scn-stats' },
      h('div', null, h('dt', null, 'Runway'), h('dd', null, months(p.runway))),
      h('div', null, h('dt', null, p.cashLabel || 'Cash in 12 months'), h('dd', null, p.cash === null || p.cash === undefined ? '\u2013' : h(Amount, { value: p.cash, compact: true }))),
      h('div', null, h('dt', null, p.ebitdaLabel || 'EBITDA, next 12 months'), h('dd', null, p.ebitda === null || p.ebitda === undefined ? '\u2013' : h(Amount, { value: p.ebitda, compact: true })))));
}
function ScenarioCompare(p) {
  var a = p.a, b = p.b;
  function cell(v, kind) {
    if (v === null || v === undefined) return kind === 'mo' ? (p.horizon ? p.horizon + '+ mo' : '\u2013') : '\u2013';
    return kind === 'mo' ? v.toFixed(1) + ' mo' : h(Amount, { value: v, compact: true });
  }
  function row(label, va, vb, kind) {
    var known = va !== null && va !== undefined && vb !== null && vb !== undefined;
    var diff = known ? vb - va : null;
    var tone = diff === null || diff === 0 ? 'll-delta-neutral' : diff > 0 ? 'll-delta-positive' : 'll-delta-negative';
    return h('tr', { key: label },
      h('th', { scope: 'row' }, label),
      h('td', { className: 'is-num' }, cell(va, kind)),
      h('td', { className: 'is-num ll-cmp-b' }, cell(vb, kind)),
      h('td', { className: 'is-num' }, diff === null ? '\u2013' : h('span', { className: cx('ll-delta', tone) },
        (diff > 0 ? '+' : diff < 0 ? '\u2212' : '') + (kind === 'mo' ? Math.abs(diff).toFixed(1) + ' mo' : formatMoney(Math.abs(diff), { compact: true })))));
  }
  return h('div', { className: 'll-table-wrap' }, h('table', { className: 'll-table ll-cmp' },
    h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Measure'),
      h('th', { scope: 'col', className: 'is-num' }, h('span', { className: 'll-legend-key ll-key-forecast' }), a.name),
      h('th', { scope: 'col', className: 'is-num' }, h('span', { className: 'll-legend-key ll-key-scenario' }), b.name),
      h('th', { scope: 'col', className: 'is-num' }, 'Difference'))),
    h('tbody', null,
      row('Runway', a.runway, b.runway, 'mo'),
      row('Lowest cash balance', a.minCash, b.minCash),
      row(p.cashLabel || 'Cash in 12 months', a.cash, b.cash),
      row('Revenue, next 12 months', a.revenue, b.revenue),
      row('EBITDA, next 12 months', a.ebitda, b.ebitda))));
}
function AuditItem(p) {
  return h('li', { className: 'll-audit-item' },
    h('span', { className: cx('ll-audit-icon', p.tone && 'is-' + p.tone) }, h(Icon, { name: p.icon || 'edit', size: 16 })),
    h('div', { className: 'll-audit-main' },
      h('div', { className: 'll-audit-text' }, h('strong', null, p.actor), ' ', p.action, ' ', p.target ? h('span', { className: 'll-audit-target' }, p.target) : null),
      p.detail ? h('div', { className: 'll-audit-detail' }, p.detail) : null),
    h('time', { className: 'll-audit-time' }, p.at));
}
function AuditTimeline(p) {
  return h('div', { className: 'll-audit' }, p.groups.map(function (g) {
    return h('div', { key: g.day, className: 'll-audit-day' }, h('div', { className: 'll-audit-dayh' }, g.day),
      h('ol', null, g.items.map(function (it, i) { return h(AuditItem, Object.assign({ key: i }, it)); })));
  }));
}
function IntegrationCard(p) {
  return h('div', { className: 'll-integ' },
    h('div', { className: 'll-integ-head' },
      h('span', { className: 'll-integ-logo', 'aria-hidden': true }, h(Icon, { name: 'plug', size: 20 })),
      h('div', { className: 'll-integ-name' }, h('div', { className: 'll-integ-title' }, p.name), h('div', { className: 'll-integ-sub' }, p.org)),
      h(StatusPill, { status: p.status })),
    h('dl', { className: 'll-integ-facts' }, (p.facts || []).map(function (f) { return h('div', { key: f[0] }, h('dt', null, f[0]), h('dd', null, f[1])); })),
    h('div', { className: 'll-integ-actions' }, p.actions));
}
function CommentaryCard(p) {
  return h('div', { className: 'll-comm' },
    h('div', { className: 'll-comm-head' }, h('span', { className: 'll-comm-tag' }, h(Icon, { name: 'sparkle', size: 14 }), 'Draft commentary'),
      h('span', { className: 'll-comm-meta' }, p.meta || 'Written from computed figures · every number links to its source')),
    h('div', { className: 'll-comm-body' }, p.paragraphs.map(function (para, i) {
      return h('p', { key: i }, para.map(function (part, j) {
        return typeof part === 'string' ? part : h('button', { key: j, type: 'button', className: 'll-cite', title: part.source }, part.text);
      }));
    })),
    h('div', { className: 'll-comm-foot' }, h(Button, { size: 'sm', icon: 'check', variant: 'primary' }, 'Accept'), h(Button, { size: 'sm', icon: 'edit' }, 'Edit'), h(Button, { size: 'sm', variant: 'ghost', icon: 'refresh' }, 'Redraft')));
}

/* ---------- sample company ---------- */
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var demo = (function () {
  var revenue = [182400, 176100, 198300, 205200, 214800, 221500, 209300, 197600, 228900, 236000, 244100, 251300];
  var cogs = revenue.map(function (r) { return -Math.round(r * 0.58 / 100) * 100; });
  var gp = revenue.map(function (r, i) { return r + cogs[i]; });
  var salaries = MONTHS.map(function (_, i) { return i < 5 ? -48500 : -49200; });
  var rent = MONTHS.map(function () { return -6200; });
  var software = MONTHS.map(function () { return -2900; });
  var marketing = [-4000, -4000, -4800, -5200, -6500, -6500, -5100, -4400, -6100, -6000, -6000, -6000];
  var fees = MONTHS.map(function (_, i) { return i === 2 ? -6400 : -1800; });
  var other = MONTHS.map(function () { return -2100; });
  var opex = MONTHS.map(function (_, i) { return salaries[i] + rent[i] + software[i] + marketing[i] + fees[i] + other[i]; });
  var ebitda = gp.map(function (g, i) { return g + opex[i]; });
  var dep = MONTHS.map(function () { return -3100; });
  var interest = MONTHS.map(function () { return -600; });
  var pbt = ebitda.map(function (e, i) { return e + dep[i] + interest[i]; });
  var tax = pbt.map(function (p) { return p > 0 ? -Math.round(p * 0.125) : 0; });
  var net = pbt.map(function (p, i) { return p + tax[i]; });
  function sum(a) { return a.reduce(function (s, v) { return s + v; }, 0); }
  function withTotal(a) { return a.concat([sum(a)]); }
  var cashBase = [], cashHire = [], cashBoth = [], fcLabels = [];
  var fcMonths = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
  var c1 = 412300, c2 = 412300, c3 = 302300;
  for (var k = 0; k < 12; k++) {
    c1 -= 29400; c2 -= k >= 3 ? 41900 : 29400; c3 -= k >= 3 ? 41900 : 29400;
    cashBase.push(c1); cashHire.push(c2); cashBoth.push(c3);
    fcLabels.push(fcMonths[k] + (k >= 3 ? ' 27' : ''));
  }
  var cashHist = [498200, 487600, 472100, 466900, 461000, 455300, 448700, 441300, 412300];

  // uncertainty cone around the base case: P10–P90 and P25–P75, widening with the square root of time
  var fanOuter = { lower: [], upper: [] }, fanInner = { lower: [], upper: [] };
  cashHist.forEach(function (v, i) { var e = i === 8 ? v : null; fanOuter.lower.push(e); fanOuter.upper.push(e); fanInner.lower.push(e); fanInner.upper.push(e); });
  cashBase.forEach(function (v, k) { var s = 14000 * Math.sqrt(k + 1); fanOuter.lower.push(v - 2 * s); fanOuter.upper.push(v + 2 * s); fanInner.lower.push(v - s); fanInner.upper.push(v + s); });
  // daily net cash movement, 1 Apr – 30 Sep 2026 (sample): receipts on weekdays, payroll on the 25th, rent on the 1st, VAT on the 19th of odd months
  var heat = [], seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  var MD = [30, 31, 30, 31, 31, 30];
  for (var mi = 0; mi < 6; mi++) for (var dd = 1; dd <= MD[mi]; dd++) {
    var mo = mi + 4, iso = '2026-' + (mo < 10 ? '0' : '') + mo + '-' + (dd < 10 ? '0' : '') + dd;
    var dow = new Date(iso + 'T00:00:00Z').getUTCDay(), v = 0, note = '';
    if (dow !== 0 && dow !== 6) v = Math.round((rnd() * 14000 - 4200) / 100) * 100;
    if (dd === 25) { v = -49200; note = 'Payroll'; }
    if (dd === 1) { v = -6200; note = 'Rent'; }
    if (dd === 19 && mo % 2 === 1) { v = -38900; note = 'VAT return'; }
    if (rnd() > 0.93 && dow > 0 && dow < 6) { v = Math.round(18000 + rnd() * 30000); note = 'Large receipt'; }
    heat.push({ date: iso, value: v, note: note, label: dd + ' ' + MONTHS[mo - 1] });
  }
  return {
    company: 'Kestrel Joinery Ltd', currency: 'EUR', months: MONTHS, forecastFrom: 9, asAt: '30 Sep 2026', today: '20 Oct 2026',
    revenue: revenue, cogs: cogs, grossProfit: gp, opex: opex, ebitda: ebitda, netProfit: net,
    cashHistory: cashHist, cashForecast: { labels: fcLabels, base: cashBase, hire: cashHire, combined: cashBoth },
    cashChart: {
      labels: MONTHS.slice(0, 9).map(function (m) { return m; }).concat(fcLabels),
      actual: cashHist.concat(fcLabels.map(function () { return null; })),
      base: cashHist.map(function (v, i) { return i === 8 ? v : null; }).concat(cashBase),
      hire: cashHist.map(function (v, i) { return i === 8 ? v : null; }).concat(cashHire)
    },
    balanceColumns: [{ label: '31 Dec 2025', kind: 'Closing' }, { label: '30 Sep 2026', kind: 'Actual' }],
    fan: { outer: fanOuter, inner: fanInner },
    heatmap: heat,
    sankey: {
      nodes: [
        { id: 'rev', label: 'Revenue', col: 0, tone: 'chart-1' },
        { id: 'gp', label: 'Gross profit', col: 1, tone: 'chart-1' },
        { id: 'cogs', label: 'Cost of sales', col: 1, tone: 'chart-6' },
        { id: 'ebitda', label: 'EBITDA', col: 2, tone: 'chart-1' },
        { id: 'wages', label: 'Wages and salaries', col: 2, tone: 'chart-2' },
        { id: 'rent', label: 'Rent and rates', col: 2, tone: 'chart-3' },
        { id: 'mkt', label: 'Marketing', col: 2, tone: 'chart-5' },
        { id: 'soft', label: 'Software', col: 2, tone: 'chart-4' },
        { id: 'gen', label: 'General', col: 2, tone: 'chart-6' },
        { id: 'fees', label: 'Accountancy and legal', col: 2, tone: 'chart-6' },
        { id: 'np', label: 'Net profit', col: 3, tone: 'chart-1', emphasis: true },
        { id: 'tax', label: 'Corporation tax', col: 3, tone: 'chart-5' },
        { id: 'dep', label: 'Depreciation', col: 3, tone: 'chart-6' },
        { id: 'int', label: 'Interest', col: 3, tone: 'chart-6' }
      ],
      links: [
        { source: 'rev', target: 'gp', value: 96100 }, { source: 'rev', target: 'cogs', value: 132800 },
        { source: 'gp', target: 'ebitda', value: 27800 }, { source: 'gp', target: 'wages', value: 49200 }, { source: 'gp', target: 'rent', value: 6200 },
        { source: 'gp', target: 'mkt', value: 6100 }, { source: 'gp', target: 'soft', value: 2900 }, { source: 'gp', target: 'gen', value: 2100 }, { source: 'gp', target: 'fees', value: 1800 },
        { source: 'ebitda', target: 'np', value: 21087 }, { source: 'ebitda', target: 'tax', value: 3013 }, { source: 'ebitda', target: 'dep', value: 3100 }, { source: 'ebitda', target: 'int', value: 600 }
      ]
    },
    tornado: { base: 14.0, rows: [
      { label: 'Debtor days', range: '31 ↔ 51 days', low: -3.1, high: 2.4 },
      { label: 'Revenue growth', range: '1.5% ↔ 3.5% a month', low: -2.6, high: 2.9 },
      { label: 'Gross margin', range: '40% ↔ 44%', low: -1.9, high: 2.1 },
      { label: 'Timing of hires', range: '3 months earlier ↔ later', low: -1.2, high: 1.5 },
      { label: 'Creditor days', range: '22 ↔ 42 days', low: -1.0, high: 0.9 },
      { label: 'Overheads growth', range: '9% ↔ 0% a year', low: -0.8, high: 0.7 }
    ] },
    opexYtd: [
      { label: 'Wages and salaries', value: 439300, swatch: 2 }, { label: 'Rent and rates', value: 55800, swatch: 3 },
      { label: 'Advertising and marketing', value: 46600, swatch: 5 }, { label: 'Software', value: 26100, swatch: 4 },
      { label: 'Accountancy and legal', value: 20800, swatch: 6 }, { label: 'General expenses', value: 18900, swatch: 1 }
    ],
    opexStack: [
      { name: 'Wages and salaries', swatch: 2, values: salaries.map(function (v) { return -v; }) },
      { name: 'Rent and rates', swatch: 3, values: rent.map(function (v) { return -v; }) },
      { name: 'Marketing', swatch: 5, values: marketing.map(function (v) { return -v; }) },
      { name: 'Software and other', swatch: 4, values: MONTHS.map(function (_, i) { return -(software[i] + fees[i] + other[i]); }) }
    ],
    bullets: [
      { label: 'Revenue, Q3', actual: 635800, target: 660000, max: 720000, bands: [560000, 640000, 720000] },
      { label: 'Gross margin', actual: 42.0, target: 44.0, max: 50, bands: [38, 43, 50], format: function (v) { return v.toFixed(1) + '%'; } },
      { label: 'Debtor days', actual: 41, target: 35, max: 60, bands: [35, 45, 60], invert: true, format: function (v) { return v + ' days'; } },
      { label: 'Operating costs, Q3', actual: 202200, target: 205000, max: 240000, bands: [205000, 220000, 240000], invert: true }
    ],
    balanceBars: {
      assets: [{ label: 'Cash', value: 412300, swatch: 1 }, { label: 'Trade debtors', value: 268400, swatch: 4 }, { label: 'Machinery', value: 184000, swatch: 6 }, { label: 'Stock', value: 96200, swatch: 3 }],
      liabilities: [{ label: 'Trade creditors', value: 142700, swatch: 5 }, { label: 'Bank loan', value: 120000, swatch: 2 }, { label: 'VAT and tax', value: 60500, swatch: 3 }],
      equity: [{ label: 'Equity', value: 637700, swatch: 1, group: 'equity' }]
    },
    agedDebtors: [{ label: 'Not yet due', value: 142300 }, { label: '1\u201330 days overdue', value: 71900 }, { label: '31\u201360 days overdue', value: 34800 }, { label: '61\u201390 days overdue', value: 12600 }, { label: 'Over 90 days', value: 6800 }],
    kpis: { revenue: 228900, revenueDelta: 0.158, grossMargin: 0.42, ebitda: ebitda[8], cash: 412300, runway: 14.0, debtorDays: 41, creditorDays: 32 },
    columns: MONTHS.map(function (m) { return { label: m + ' 26' }; }).concat([{ label: 'FY 2026', kind: 'A+F' }]),
    pnlRows: [
      { type: 'section', label: 'Trading income' },
      { type: 'line', code: '4000', label: 'Sales', values: withTotal(revenue) },
      { type: 'line', code: '5000', label: 'Cost of sales', values: withTotal(cogs) },
      { type: 'subtotal', label: 'Gross profit', values: withTotal(gp) },
      { type: 'section', label: 'Operating expenses' },
      { type: 'line', code: '6100', label: 'Wages and salaries', values: withTotal(salaries) },
      { type: 'line', code: '6200', label: 'Rent and rates', values: withTotal(rent) },
      { type: 'line', code: '6300', label: 'Software subscriptions', values: withTotal(software) },
      { type: 'line', code: '6400', label: 'Advertising and marketing', values: withTotal(marketing) },
      { type: 'line', code: '6500', label: 'Accountancy and legal', values: withTotal(fees) },
      { type: 'line', code: '6900', label: 'General expenses', values: withTotal(other) },
      { type: 'subtotal', label: 'Total operating expenses', values: withTotal(opex) },
      { type: 'subtotal', label: 'EBITDA', values: withTotal(ebitda) },
      { type: 'line', code: '7100', label: 'Depreciation', values: withTotal(dep) },
      { type: 'line', code: '7200', label: 'Interest paid', values: withTotal(interest) },
      { type: 'line', code: '8200', label: 'Corporation tax at 12.5%', values: withTotal(tax) },
      { type: 'total', label: 'Net profit', values: withTotal(net) }
    ],
    balanceRows: [
      { type: 'section', label: 'Assets' },
      { type: 'line', code: '0710', label: 'Plant and machinery (net)', values: [161500, 184000] },
      { type: 'line', code: '1200', label: 'Bank: current account', values: [505000, 412300] },
      { type: 'line', code: '1100', label: 'Trade debtors', values: [101990, 268400] },
      { type: 'line', code: '1001', label: 'Stock', values: [70300, 96200] },
      { type: 'subtotal', label: 'Total assets', values: [838790, 960900] },
      { type: 'section', label: 'Liabilities' },
      { type: 'line', code: '2100', label: 'Trade creditors', values: [-118400, -142700] },
      { type: 'line', code: '2201', label: 'VAT', values: [-41200, -38900] },
      { type: 'line', code: '2300', label: 'Corporation tax', values: [-16800, -21600] },
      { type: 'line', code: '2900', label: 'Bank loan', values: [-138000, -120000] },
      { type: 'subtotal', label: 'Total liabilities', values: [-314400, -323200] },
      { type: 'total', label: 'Net assets', values: [524390, 637700] },
      { type: 'section', label: 'Equity' },
      { type: 'line', code: '3000', label: 'Share capital', values: [100, 100] },
      { type: 'line', code: '3200', label: 'Retained earnings', values: [524290, 637600] },
      { type: 'total', label: 'Total equity', values: [524390, 637700] }
    ],
    bridge: [
      { label: 'Opening cash 1 Sep', value: 441300, kind: 'start' },
      { label: 'Net profit', value: 21087 }, { label: 'Depreciation', value: 3100 },
      { label: 'Tax not yet paid', value: 3013 }, { label: 'Trade debtors', value: -38400 },
      { label: 'Stock', value: -4100 }, { label: 'Trade creditors', value: 12800 },
      { label: 'New machinery', value: -24500 }, { label: 'Loan repayment', value: -2000 },
      { label: 'Closing cash 30 Sep', value: 412300, kind: 'end' }
    ],
    cashFlowColumns: [{ label: 'Sep 2026', kind: 'Actual' }, { label: 'Jan\u2013Sep 2026', kind: 'Year to date' }],
    cashFlowRows: [
      { type: 'section', label: 'Operating activities' },
      { type: 'line', label: 'Net profit', values: [21087, 113310] },
      { type: 'line', label: 'Add back depreciation', values: [3100, 27900] },
      { type: 'line', label: 'Corporation tax accrued, not yet paid', values: [3013, 4800] },
      { type: 'line', label: 'Increase in trade debtors', values: [-38400, -166410] },
      { type: 'line', label: 'Increase in stock', values: [-4100, -25900] },
      { type: 'line', label: 'Increase in trade creditors', values: [12800, 24300] },
      { type: 'line', label: 'Change in VAT owed', values: [0, -2300] },
      { type: 'subtotal', label: 'Cash from operations', values: [-2500, -24300] },
      { type: 'section', label: 'Investing activities' },
      { type: 'line', label: 'Purchase of machinery', values: [-24500, -50400] },
      { type: 'subtotal', label: 'Cash used in investing', values: [-24500, -50400] },
      { type: 'section', label: 'Financing activities' },
      { type: 'line', label: 'Bank loan repayments', values: [-2000, -18000] },
      { type: 'subtotal', label: 'Cash used in financing', values: [-2000, -18000] },
      { type: 'spacer' },
      { type: 'subtotal', label: 'Net change in cash', values: [-29000, -92700] },
      { type: 'line', label: 'Opening cash', values: [441300, 505000] },
      { type: 'total', label: 'Closing cash', values: [412300, 412300] }
    ],
    ledgerLines: [
      { date: '02 Sep 2026', journal: 'JNL-004712', code: '4000', account: 'Sales', contact: 'Harbourview Hotels', description: 'INV-2291 Bespoke reception desk', debit: 0, credit: 48600 },
      { date: '05 Sep 2026', journal: 'JNL-004731', code: '4000', account: 'Sales', contact: 'Ostrander Architects', description: 'INV-2294 Oak panelling, phase 2', debit: 0, credit: 36250 },
      { date: '09 Sep 2026', journal: 'JNL-004750', code: '4000', account: 'Sales', contact: 'Corrib Dental Group', description: 'INV-2297 Surgery fit-out, 3 rooms', debit: 0, credit: 52400 },
      { date: '12 Sep 2026', journal: 'JNL-004768', code: '4000', account: 'Sales', contact: 'Harbourview Hotels', description: 'CN-0141 Credit: damaged veneer', debit: 2150, credit: 0 },
      { date: '16 Sep 2026', journal: 'JNL-004781', code: '4000', account: 'Sales', contact: 'Liffey Coffee Co', description: 'INV-2301 Counter and shelving', debit: 0, credit: 18900 },
      { date: '23 Sep 2026', journal: 'JNL-004799', code: '4000', account: 'Sales', contact: 'Ostrander Architects', description: 'INV-2306 Staircase balustrade', debit: 0, credit: 41300 },
      { date: '29 Sep 2026', journal: 'JNL-004812', code: '4000', account: 'Sales', contact: 'Various', description: 'Card sales, showroom, September', debit: 0, credit: 33600 }
    ],
    scenarios: [
      { name: 'Base case', base: true, runway: 14.0, cash: 59500, ebitda: 271800, minCash: 59500, revenue: 3062000 },
      { name: 'Hire 2 engineers in January', parent: 'Base case', changes: 2, runway: 10.7, cash: -53000, ebitda: 159300, minCash: -53000, revenue: 3062000 },
      { name: 'Slower collections', parent: 'Base case', changes: 1, runway: 10.3, cash: -50500, ebitda: 271800, minCash: -50500, revenue: 3062000 },
      { name: 'Hires + slower collections', parent: 'Hire 2 engineers in January', changes: 3, runway: 8.1, cash: -163000, ebitda: 159300, minCash: -163000, revenue: 3062000 }
    ]
  };
})();

var api = {
  Icon: Icon, Logo: Logo, Spinner: Spinner, Button: Button, IconButton: IconButton, Kbd: Kbd,
  Field: Field, Input: Input, Select: Select, Checkbox: Checkbox, RadioGroup: RadioGroup, Switch: Switch, Slider: Slider,
  SegmentedControl: SegmentedControl, Tabs: Tabs, Badge: Badge, StatusPill: StatusPill, Avatar: Avatar, Tooltip: Tooltip,
  Skeleton: Skeleton, ProgressBar: ProgressBar, Amount: Amount, Delta: Delta, Sparkline: Sparkline, ChartLegend: ChartLegend,
  LineChart: LineChart, BarChart: BarChart, WaterfallChart: WaterfallChart, RunwayBar: RunwayBar, KpiTile: KpiTile,
  SankeyChart: SankeyChart, RunwayGauge: RunwayGauge, TornadoChart: TornadoChart, CalendarHeatmap: CalendarHeatmap, Treemap: Treemap,
  DonutChart: DonutChart, BulletChart: BulletChart, BalanceBars: BalanceBars, HeroMetric: HeroMetric, DeltaPill: DeltaPill, MiniRunway: MiniRunway,
  FinancialStatement: FinancialStatement, LedgerTable: LedgerTable, AgedDebtors: AgedDebtors, DataTable: DataTable, ReconcileCheck: ReconcileCheck,
  Banner: Banner, Toast: Toast, EmptyState: EmptyState, SyncProgress: SyncProgress, Stepper: Stepper,
  Dialog: Dialog, Drawer: Drawer, Menu: Menu, CommandPalette: CommandPalette, Breadcrumbs: Breadcrumbs, Pagination: Pagination,
  NavItem: NavItem, OrgSwitcher: OrgSwitcher, Sidebar: Sidebar, PeriodPicker: PeriodPicker, MonthGrid: MonthGrid,
  ScenarioSwitcher: ScenarioSwitcher, Topbar: Topbar, AppShell: AppShell, Panel: Panel,
  AssumptionField: AssumptionField, HireRow: HireRow, ScenarioCard: ScenarioCard, ScenarioCompare: ScenarioCompare,
  AuditItem: AuditItem, AuditTimeline: AuditTimeline, IntegrationCard: IntegrationCard, CommentaryCard: CommentaryCard,
  formatMoney: formatMoney, formatPct: formatPct, iconNames: Object.keys(ICONS), demo: demo
};

export {
  Icon,
  Logo,
  Spinner,
  Button,
  IconButton,
  Kbd,
  Field,
  Input,
  Select,
  Checkbox,
  RadioGroup,
  Switch,
  Slider,
  SegmentedControl,
  Tabs,
  Badge,
  StatusPill,
  Avatar,
  Tooltip,
  Skeleton,
  ProgressBar,
  Amount,
  Delta,
  Sparkline,
  ChartLegend,
  LineChart,
  BarChart,
  WaterfallChart,
  RunwayBar,
  KpiTile,
  SankeyChart,
  RunwayGauge,
  TornadoChart,
  CalendarHeatmap,
  Treemap,
  DonutChart,
  BulletChart,
  BalanceBars,
  HeroMetric,
  DeltaPill,
  MiniRunway,
  FinancialStatement,
  LedgerTable,
  AgedDebtors,
  DataTable,
  ReconcileCheck,
  Banner,
  Toast,
  EmptyState,
  SyncProgress,
  Stepper,
  Dialog,
  Drawer,
  Menu,
  CommandPalette,
  Breadcrumbs,
  Pagination,
  NavItem,
  OrgSwitcher,
  Sidebar,
  PeriodPicker,
  MonthGrid,
  ScenarioSwitcher,
  Topbar,
  AppShell,
  Panel,
  AssumptionField,
  HireRow,
  ScenarioCard,
  ScenarioCompare,
  AuditItem,
  AuditTimeline,
  IntegrationCard,
  CommentaryCard,
  formatMoney,
  formatPct,
  demo
};
export const iconNames = Object.keys(ICONS);
export default api;
