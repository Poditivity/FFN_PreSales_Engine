/* @ds-bundle: {"format":4,"namespace":"FFN","components":[{"name":"Button"},{"name":"Badge"},{"name":"StageBadge"},{"name":"Input"},{"name":"Textarea"},{"name":"Select"},{"name":"Checkbox"},{"name":"Switch"},{"name":"Card"},{"name":"StatCard"},{"name":"DataTable"},{"name":"PipelineStepper"},{"name":"Tabs"},{"name":"Alert"},{"name":"EmptyState"},{"name":"Avatar"},{"name":"ActivityTimeline"},{"name":"Modal"},{"name":"FunnelChart"},{"name":"TrendChart"}]} */
/* Founders First Network component bundle. Classic script, assigns window.FFN. */
(function (global) {
  'use strict';

  var React = global.React;
  var h = React.createElement;

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i]) out.push(arguments[i]);
    }
    return out.join(' ');
  }

  function omit(obj, keys) {
    var out = {};
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k) && keys.indexOf(k) === -1) out[k] = obj[k];
    }
    return out;
  }

  var uid = 0;
  function nextId(prefix) {
    uid += 1;
    return prefix + '-' + uid;
  }

  /* ------------------------------------------------------------- icons */
  /* Lucide-shaped inline paths. The product imports lucide-react instead;
     these exist so the previews do not fetch anything. */

  function Icon(props) {
    var size = props.size || 16;
    return h(
      'svg',
      {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.75,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        style: { flex: 'none', display: 'block' }
      },
      props.children
    );
  }

  var ICONS = {
    check: h('polyline', { points: '20 6 9 17 4 12' }),
    chevronDown: h('polyline', { points: '6 9 12 15 18 9' }),
    chevronUp: h('polyline', { points: '18 15 12 9 6 15' }),
    arrowUp: h('path', { d: 'M12 19V5M5 12l7-7 7 7' }),
    arrowDown: h('path', { d: 'M12 5v14M19 12l-7 7-7-7' }),
    minus: h('path', { d: 'M5 12h14' }),
    users: h('path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' }),
    mail: h('path', { d: 'M4 4h16v16H4zM4 7l8 6 8-6' }),
    x: h('path', { d: 'M18 6 6 18M6 6l12 12' })
  };

  function icon(name, size) {
    return h(Icon, { size: size }, ICONS[name]);
  }

  /* ------------------------------------------------------------ Button */

  function Button(props) {
    var variant = props.variant || 'primary';
    var size = props.size || 'md';
    var rest = omit(props, ['variant', 'size', 'loading', 'block', 'iconLeft', 'iconRight', 'className', 'children']);
    var disabled = props.disabled || props.loading;
    return h(
      'button',
      Object.assign(
        {
          type: props.type || 'button',
          disabled: disabled,
          'aria-busy': props.loading ? 'true' : undefined,
          className: cx('ffn-btn', 'ffn-btn--' + variant, 'ffn-btn--' + size, props.block && 'ffn-btn--block', props.className)
        },
        rest
      ),
      props.loading ? h('span', { className: 'ffn-spinner' }) : props.iconLeft,
      h('span', null, props.children),
      props.loading ? null : props.iconRight
    );
  }

  /* ------------------------------------------------------------- Badge */

  function Badge(props) {
    var tone = props.tone || 'neutral';
    return h(
      'span',
      { className: cx('ffn-badge', 'ffn-badge--' + tone, props.className) },
      props.dot === false ? null : h('span', { className: 'ffn-badge__dot' }),
      props.children
    );
  }

  /* -------------------------------------------------------- StageBadge */

  var STAGES = [
    { id: 'lead', label: 'Lead', tone: 'neutral', hint: 'Captured, not yet spoken to.' },
    { id: 'mql', label: 'MQL', tone: 'brand', hint: 'Qualified on fit by the outreach call.' },
    { id: 'sql', label: 'SQL', tone: 'brand', hint: 'Discovery call done, intent confirmed.' },
    { id: 'customer', label: 'Customer', tone: 'success', hint: 'Paid and enrolled.' },
    { id: 'advocate', label: 'Advocate', tone: 'success', hint: 'Referring or giving testimony.' },
    { id: 'dormant', label: 'Dormant', tone: 'warning', hint: 'No reply past the follow-up window.' },
    { id: 'lost', label: 'Lost', tone: 'danger', hint: 'Declined or disqualified.' }
  ];

  function stageDef(id) {
    for (var i = 0; i < STAGES.length; i++) {
      if (STAGES[i].id === id) return STAGES[i];
    }
    return { id: id, label: String(id), tone: 'neutral', hint: '' };
  }

  function StageBadge(props) {
    var def = stageDef(props.stage);
    return h(Badge, { tone: def.tone, className: props.className }, def.label);
  }

  StageBadge.stages = STAGES;

  /* ------------------------------------------------------------- Field */

  function Field(props) {
    var id = props.htmlFor;
    return h(
      'div',
      { className: cx('ffn-field', props.className) },
      props.label
        ? h(
            'label',
            { className: 'ffn-field__label', htmlFor: id },
            props.label,
            props.required ? h('span', { className: 'ffn-field__req', 'aria-hidden': 'true' }, '*') : null
          )
        : null,
      props.children,
      props.error
        ? h('p', { className: 'ffn-field__error', id: id ? id + '-msg' : undefined }, props.error)
        : props.hint
        ? h('p', { className: 'ffn-field__hint', id: id ? id + '-msg' : undefined }, props.hint)
        : null
    );
  }

  /* ------------------------------------------------------------- Input */

  function Input(props) {
    var id = props.id || nextId('ffn-input');
    var size = props.size || 'md';
    var rest = omit(props, ['label', 'hint', 'error', 'size', 'mono', 'required', 'className', 'id']);
    return h(
      Field,
      { label: props.label, hint: props.hint, error: props.error, required: props.required, htmlFor: id, className: props.className },
      h(
        'input',
        Object.assign(
          {
            id: id,
            required: props.required,
            'aria-invalid': props.error ? 'true' : undefined,
            'aria-describedby': props.error || props.hint ? id + '-msg' : undefined,
            className: cx('ffn-control', 'ffn-control--' + size, props.mono && 'ffn-control--mono', props.error && 'ffn-control--invalid')
          },
          rest
        )
      )
    );
  }

  /* ---------------------------------------------------------- Textarea */

  function Textarea(props) {
    var id = props.id || nextId('ffn-textarea');
    var rest = omit(props, ['label', 'hint', 'error', 'required', 'className', 'id']);
    return h(
      Field,
      { label: props.label, hint: props.hint, error: props.error, required: props.required, htmlFor: id, className: props.className },
      h(
        'textarea',
        Object.assign(
          {
            id: id,
            required: props.required,
            'aria-invalid': props.error ? 'true' : undefined,
            'aria-describedby': props.error || props.hint ? id + '-msg' : undefined,
            className: cx('ffn-control', 'ffn-textarea', props.error && 'ffn-control--invalid')
          },
          rest
        )
      )
    );
  }

  /* ------------------------------------------------------------ Select */

  function Select(props) {
    var id = props.id || nextId('ffn-select');
    var size = props.size || 'md';
    var rest = omit(props, ['label', 'hint', 'error', 'size', 'options', 'placeholder', 'required', 'className', 'id']);
    var options = props.options || [];
    return h(
      Field,
      { label: props.label, hint: props.hint, error: props.error, required: props.required, htmlFor: id, className: props.className },
      h(
        'span',
        { className: 'ffn-select-wrap' },
        h(
          'select',
          Object.assign(
            {
              id: id,
              required: props.required,
              'aria-invalid': props.error ? 'true' : undefined,
              'aria-describedby': props.error || props.hint ? id + '-msg' : undefined,
              className: cx('ffn-control', 'ffn-select', 'ffn-control--' + size, props.error && 'ffn-control--invalid')
            },
            rest
          ),
          props.placeholder ? h('option', { value: '' }, props.placeholder) : null,
          options.map(function (o) {
            return h('option', { key: o.value, value: o.value }, o.label);
          })
        ),
        h('span', { className: 'ffn-select-wrap__caret' }, icon('chevronDown', 16))
      )
    );
  }

  /* ---------------------------------------------------------- Checkbox */

  function Checkbox(props) {
    var id = props.id || nextId('ffn-check');
    return h(
      'label',
      { className: cx('ffn-check', props.disabled && 'ffn-check--disabled', props.className), htmlFor: id },
      h('input', {
        id: id,
        type: 'checkbox',
        className: 'ffn-sr',
        checked: props.checked,
        disabled: props.disabled,
        onChange: props.onChange
      }),
      h(
        'span',
        { className: cx('ffn-check__box', props.checked && !props.disabled && 'ffn-check__box--on'), 'aria-hidden': 'true' },
        props.checked ? icon('check', 12) : null
      ),
      h(
        'span',
        null,
        h('span', { className: 'ffn-check__text' }, props.label),
        props.hint ? h('span', { className: 'ffn-check__hint', style: { display: 'block' } }, props.hint) : null
      )
    );
  }

  /* ------------------------------------------------------------ Switch */

  function Switch(props) {
    return h(
      'label',
      { className: cx('ffn-switch', props.className) },
      h('input', {
        type: 'checkbox',
        role: 'switch',
        className: 'ffn-sr',
        checked: props.checked,
        disabled: props.disabled,
        onChange: props.onChange
      }),
      h(
        'span',
        { className: cx('ffn-switch__track', props.checked && 'ffn-switch__track--on'), 'aria-hidden': 'true' },
        h('span', { className: 'ffn-switch__thumb' })
      ),
      props.label ? h('span', { className: 'ffn-check__text' }, props.label) : null
    );
  }

  /* -------------------------------------------------------------- Card */

  function Card(props) {
    return h(
      'section',
      { className: cx('ffn-card', props.raised && 'ffn-card--raised', props.className) },
      props.title || props.actions
        ? h(
            'header',
            { className: 'ffn-card__head' },
            h(
              'div',
              null,
              h('h3', { className: 'ffn-card__title' }, props.title),
              props.subtitle ? h('p', { className: 'ffn-card__sub' }, props.subtitle) : null
            ),
            props.actions ? h('div', { className: 'ffn-row', style: { gap: 'var(--space-2)' } }, props.actions) : null
          )
        : null,
      h('div', { className: cx('ffn-card__body', props.flush && 'ffn-card__body--flush') }, props.children),
      props.footer ? h('footer', { className: 'ffn-card__foot' }, props.footer) : null
    );
  }

  /* ---------------------------------------------------------- StatCard */

  function StatCard(props) {
    var dir = props.direction || 'flat';
    var arrow = dir === 'up' ? 'arrowUp' : dir === 'down' ? 'arrowDown' : 'minus';
    return h(
      'article',
      { className: cx('ffn-stat', props.className) },
      h('p', { className: 'ffn-stat__label' }, props.label),
      h(
        'div',
        { className: 'ffn-stat__row' },
        h('span', { className: 'ffn-stat__value' }, props.value),
        props.delta
          ? h(
              'span',
              { className: cx('ffn-stat__delta', 'ffn-stat__delta--' + dir) },
              icon(arrow, 14),
              props.delta
            )
          : null
      ),
      props.note ? h('p', { className: 'ffn-stat__note' }, props.note) : null
    );
  }

  /* --------------------------------------------------------- DataTable */

  function DataTable(props) {
    var columns = props.columns || [];
    var rows = props.rows || [];
    var caption = props.caption;
    return h(
      'div',
      { className: cx('ffn-table-wrap', props.className) },
      h(
        'table',
        { className: 'ffn-table' },
        caption ? h('caption', { className: 'ffn-sr' }, caption) : null,
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            columns.map(function (c) {
              var active = props.sortBy === c.key;
              return h(
                'th',
                {
                  key: c.key,
                  scope: 'col',
                  style: c.align === 'right' ? { textAlign: 'right' } : null
                },
                c.sortable
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'ffn-table__sort',
                        'aria-sort-active': active ? 'true' : 'false',
                        onClick: props.onSort ? function () { props.onSort(c.key); } : undefined
                      },
                      c.header,
                      active ? icon(props.sortDir === 'desc' ? 'chevronDown' : 'chevronUp', 14) : null
                    )
                  : c.header
              );
            })
          )
        ),
        h(
          'tbody',
          null,
          rows.map(function (row, i) {
            return h(
              'tr',
              {
                key: row.id || i,
                className: cx(props.selectedId && props.selectedId === row.id && 'ffn-table__row--selected'),
                onClick: props.onRowClick ? function () { props.onRowClick(row); } : undefined
              },
              columns.map(function (c) {
                return h(
                  'td',
                  { key: c.key, className: cx(c.align === 'right' && 'ffn-table__num') },
                  c.render ? c.render(row) : row[c.key]
                );
              })
            );
          })
        )
      )
    );
  }

  /* --------------------------------------------------- PipelineStepper */

  function PipelineStepper(props) {
    var steps = props.steps || STAGES.slice(0, 5).map(function (s) { return { id: s.id, label: s.label }; });
    var currentIndex = 0;
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].id === props.current) currentIndex = i;
    }
    return h(
      'div',
      { className: cx('ffn-pipe', props.className), role: 'group', 'aria-label': props.label || 'Pipeline stage' },
      steps.map(function (s, i) {
        var state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
        return h(
          'div',
          { key: s.id, className: 'ffn-pipe__step' },
          h('div', { className: cx('ffn-pipe__bar', state === 'done' && 'ffn-pipe__bar--done', state === 'current' && 'ffn-pipe__bar--current') }),
          h('span', { className: cx('ffn-pipe__name', i <= currentIndex && 'ffn-pipe__name--active') }, s.label),
          s.meta ? h('span', { className: 'ffn-pipe__meta' }, s.meta) : null,
          i === currentIndex ? h('span', { className: 'ffn-sr' }, 'Current stage') : null
        );
      })
    );
  }

  /* -------------------------------------------------------------- Tabs */

  function Tabs(props) {
    var items = props.items || [];
    return h(
      'div',
      { className: cx('ffn-tabs', props.className), role: 'tablist' },
      items.map(function (t) {
        var active = t.id === props.active;
        return h(
          'button',
          {
            key: t.id,
            type: 'button',
            role: 'tab',
            'aria-selected': active ? 'true' : 'false',
            className: cx('ffn-tab', active && 'ffn-tab--active'),
            onClick: props.onChange ? function () { props.onChange(t.id); } : undefined
          },
          t.label,
          typeof t.count === 'number' ? h('span', { className: 'ffn-tab__count' }, t.count) : null
        );
      })
    );
  }

  /* ------------------------------------------------------------- Alert */

  function Alert(props) {
    var tone = props.tone || 'brand';
    return h(
      'div',
      { className: cx('ffn-alert', 'ffn-alert--' + tone, props.className), role: tone === 'danger' ? 'alert' : 'status' },
      h('span', { className: 'ffn-alert__mark', 'aria-hidden': 'true' }),
      h(
        'div',
        { className: 'ffn-grow' },
        h('p', { className: 'ffn-alert__title' }, props.title),
        props.children ? h('p', { className: 'ffn-alert__body' }, props.children) : null
      ),
      props.action || null
    );
  }

  /* -------------------------------------------------------- EmptyState */

  function EmptyState(props) {
    return h(
      'div',
      { className: cx('ffn-empty', props.className) },
      h('span', { className: 'ffn-empty__mark' }, props.icon || icon('users', 20)),
      h('h3', { className: 'ffn-empty__title' }, props.title),
      props.children ? h('p', { className: 'ffn-empty__body' }, props.children) : null,
      props.action ? h('div', { style: { marginTop: 'var(--space-2)' } }, props.action) : null
    );
  }

  /* ------------------------------------------------------------ Avatar */

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/);
    var first = parts[0] ? parts[0][0] : '';
    var last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  function Avatar(props) {
    var size = props.size || 'md';
    return h(
      'span',
      { className: cx('ffn-avatar', 'ffn-avatar--' + size, props.className), title: props.name, role: 'img', 'aria-label': props.name },
      props.src ? h('img', { src: props.src, alt: '' }) : initials(props.name)
    );
  }

  /* -------------------------------------------------- ActivityTimeline */

  function ActivityTimeline(props) {
    var items = props.items || [];
    return h(
      'ol',
      { className: cx('ffn-timeline', props.className) },
      items.map(function (it, i) {
        return h(
          'li',
          { key: it.id || i, className: 'ffn-timeline__item' },
          h(
            'span',
            { className: 'ffn-timeline__rail', 'aria-hidden': 'true' },
            h('span', { className: cx('ffn-timeline__dot', it.tone && 'ffn-timeline__dot--' + it.tone) }),
            i < items.length - 1 ? h('span', { className: 'ffn-timeline__line' }) : null
          ),
          h(
            'div',
            { className: 'ffn-timeline__body ffn-grow' },
            h('p', { className: 'ffn-timeline__title' }, it.title),
            h('p', { className: 'ffn-timeline__meta' }, it.meta),
            it.note ? h('p', { className: 'ffn-timeline__note' }, it.note) : null
          )
        );
      })
    );
  }

  /* ------------------------------------------------------------- Modal */

  function Modal(props) {
    if (props.open === false) return null;
    return h(
      'div',
      { className: 'ffn-modal__scrim' },
      h(
        'div',
        { className: cx('ffn-modal', props.className), role: 'dialog', 'aria-modal': 'true', 'aria-label': props.title },
        h('header', { className: 'ffn-modal__head' }, h('h2', { className: 'ffn-modal__title' }, props.title)),
        h('div', { className: 'ffn-modal__body' }, props.children),
        props.footer ? h('footer', { className: 'ffn-modal__foot' }, props.footer) : null
      )
    );
  }

  /* ------------------------------------------------------- FunnelChart */

  function FunnelChart(props) {
    var data = props.data || [];
    var top = data.length ? data[0].value : 0;
    /* One measure, one colour. The bar length is the variable; hue is not. */
    var fill = 'var(--chart-1)';
    return h(
      'div',
      { className: cx('ffn-funnel', props.className), role: 'group', 'aria-label': props.label || 'Funnel' },
      data.map(function (d, i) {
        var pct = top ? Math.round((d.value / top) * 1000) / 10 : 0;
        var prev = i > 0 ? data[i - 1].value : null;
        var drop = prev ? Math.round((1 - d.value / prev) * 1000) / 10 : null;
        return h(
          'div',
          { key: d.name, className: 'ffn-funnel__row' },
          h('span', { className: 'ffn-funnel__name' }, d.name),
          h(
            'span',
            { className: 'ffn-funnel__track' },
            h('span', {
              className: 'ffn-funnel__fill',
              style: { width: Math.max(pct, 2) + '%', background: fill }
            })
          ),
          h(
            'span',
            { className: 'ffn-funnel__stat' },
            d.value,
            drop === null ? null : h('span', { className: 'ffn-funnel__drop' }, '  −' + drop + '%')
          )
        );
      })
    );
  }

  /* -------------------------------------------------------- TrendChart */

  function TrendChart(props) {
    var series = props.series || [];
    var labels = props.labels || [];
    var width = props.width || 560;
    var height = props.height || 200;
    var padL = 36;
    var padB = 24;
    var padT = 12;
    var padR = 12;
    var max = 0;
    series.forEach(function (s) {
      s.values.forEach(function (v) { if (v > max) max = v; });
    });
    max = max || 1;
    var colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];
    var innerW = width - padL - padR;
    var innerH = height - padT - padB;
    var n = labels.length || (series[0] ? series[0].values.length : 0);

    function x(i) { return padL + (n > 1 ? (i * innerW) / (n - 1) : innerW / 2); }
    function y(v) { return padT + innerH - (v / max) * innerH; }

    var ticks = [0, 0.5, 1];

    return h(
      'div',
      { className: props.className },
      h(
        'svg',
        { viewBox: '0 0 ' + width + ' ' + height, width: '100%', height: height, role: 'img', 'aria-label': props.label || 'Trend' },
        ticks.map(function (t) {
          var yy = padT + innerH - t * innerH;
          return h(
            'g',
            { key: t },
            h('line', { x1: padL, x2: width - padR, y1: yy, y2: yy, className: 'ffn-chart__grid' }),
            h('text', { x: padL - 8, y: yy + 4, textAnchor: 'end', className: 'ffn-chart__label' }, Math.round(max * t))
          );
        }),
        series.map(function (s, si) {
          var d = s.values
            .map(function (v, i) { return (i ? 'L' : 'M') + x(i) + ' ' + y(v); })
            .join(' ');
          return h(
            'g',
            { key: s.name },
            h('path', { d: d, fill: 'none', stroke: colors[si % colors.length], strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' }),
            s.values.map(function (v, i) {
              return h('circle', { key: i, cx: x(i), cy: y(v), r: 2.5, fill: colors[si % colors.length] });
            })
          );
        }),
        labels.map(function (l, i) {
          return h('text', { key: l + i, x: x(i), y: height - 6, textAnchor: 'middle', className: 'ffn-chart__label' }, l);
        })
      ),
      series.length
        ? h(
            'div',
            { className: 'ffn-legend' },
            series.map(function (s, si) {
              return h(
                'span',
                { key: s.name, className: 'ffn-legend__item' },
                h('span', { className: 'ffn-legend__swatch', style: { background: colors[si % colors.length] } }),
                s.name
              );
            })
          )
        : null
    );
  }

  global.FFN = {
    Button: Button,
    Badge: Badge,
    StageBadge: StageBadge,
    Field: Field,
    Input: Input,
    Textarea: Textarea,
    Select: Select,
    Checkbox: Checkbox,
    Switch: Switch,
    Card: Card,
    StatCard: StatCard,
    DataTable: DataTable,
    PipelineStepper: PipelineStepper,
    Tabs: Tabs,
    Alert: Alert,
    EmptyState: EmptyState,
    Avatar: Avatar,
    ActivityTimeline: ActivityTimeline,
    Modal: Modal,
    FunnelChart: FunnelChart,
    TrendChart: TrendChart,
    stages: STAGES,
    icon: icon
  };
})(window);
