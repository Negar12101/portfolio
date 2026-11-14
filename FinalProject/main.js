import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// ==================================================
// Configuration
// ==================================================

const YEARS = d3.range(1961, 2025);

const COUNTRY_NAMES = new Map([
  ['USA', 'United States'],
  ['CAN', 'Canada'],
  ['BRA', 'Brazil'],
  ['GBR', 'United Kingdom'],
  ['IRN', 'Iran'],
  ['IND', 'India'],
  ['CHN', 'China'],
  ['AUS', 'Australia'],
]);

const SHORT_NAMES = new Map([
  ['USA', 'US'],
  ['CAN', 'Canada'],
  ['BRA', 'Brazil'],
  ['GBR', 'UK'],
  ['IRN', 'Iran'],
  ['IND', 'India'],
  ['CHN', 'China'],
  ['AUS', 'Australia'],
]);

const color = d3.scaleOrdinal()
  .domain([...COUNTRY_NAMES.keys()])
  .range([
    '#7541a6',
    '#cb598e',
    '#26867e',
    '#be7731',
    '#4966b1',
    '#9b4857',
    '#637b35',
    '#775f51',
  ]);

const signed = d3.format('+.2f');
const status = document.querySelector('#loading-status');

// ==================================================
// Shared helpers
// ==================================================

function caption(id, title, description) {
  const figure = d3.select(id).node().closest('figure');

  d3.select(figure)
    .select('figcaption h3')
    .text(title);

  d3.select(figure)
    .select('figcaption p')
    .text(description);
}

function note(id, text) {
  return d3.select(id)
    .append('p')
    .attr('class', 'chart-note')
    .text(text);
}

function legend(id, items) {
  const list = d3.select(id)
    .append('div')
    .attr('class', 'chart-legend');

  for (const item of items) {
    const entry = list.append('span');

    entry.append('i')
      .style('--swatch', item.color)
      .attr('aria-hidden', 'true');

    entry.append('span').text(item.label);
  }
}

function frame(id, {
  width = 640,
  height = 370,
  left = 65,
  right = 35,
  top = 30,
  bottom = 55,
  label = '',
} = {}) {
  const svg = d3.select(id)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', label);

  svg.append('title').text(label);

  return {
    svg,
    width,
    height,
    left,
    right,
    top,
    bottom,
    xEnd: width - right,
    yEnd: height - bottom,
  };
}

function axes(f, x, y, {
  xLabel = '',
  yLabel = '',
  xFormat,
} = {}) {
  f.svg.append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(${f.left},0)`)
    .call(
      d3.axisLeft(y)
        .ticks(5)
        .tickSize(-(f.xEnd - f.left))
        .tickFormat('')
    );

  const xAxis = d3.axisBottom(x)
    .ticks(6)
    .tickSizeOuter(0);

  if (xFormat) xAxis.tickFormat(xFormat);

  f.svg.append('g')
    .attr('transform', `translate(0,${f.yEnd})`)
    .call(xAxis);

  f.svg.append('g')
    .attr('transform', `translate(${f.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickSizeOuter(0));

  f.svg.append('text')
    .attr('class', 'axis-label')
    .attr('x', (f.left + f.xEnd) / 2)
    .attr('y', f.height - 10)
    .attr('text-anchor', 'middle')
    .text(xLabel);

  f.svg.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(f.top + f.yEnd) / 2)
    .attr('y', 16)
    .attr('text-anchor', 'middle')
    .text(yLabel);
}

function zeroLine(f, y) {
  f.svg.append('line')
    .attr('class', 'zero-line')
    .attr('x1', f.left)
    .attr('x2', f.xEnd)
    .attr('y1', y(0))
    .attr('y2', y(0));
}

function anomalyScale(values, f) {
  return d3.scaleLinear()
    .domain([
      Math.min(0, d3.min(values)),
      Math.max(0, d3.max(values)),
    ])
    .nice()
    .range([f.yEnd, f.top]);
}

function valueAt(country, year) {
  return country.values[year - YEARS[0]].value;
}

function meanPeriod(country, start, end) {
  return d3.mean(
    country.values.filter(
      d => d.year >= start && d.year <= end
    ),
    d => d.value
  );
}

function pearson(a, b) {
  if (a.length !== b.length || a.length < 3) {
    return null;
  }

  const meanA = d3.mean(a);
  const meanB = d3.mean(b);

  let numerator = 0;
  let varianceA = 0;
  let varianceB = 0;

  for (let i = 0; i < a.length; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;

    numerator += da * db;
    varianceA += da * da;
    varianceB += db * db;
  }

  const denominator = Math.sqrt(varianceA * varianceB);

  if (denominator === 0) return null;

  return Math.max(-1, Math.min(1, numerator / denominator));
}

// ==================================================
// 1. Annual selected-country mean
// ==================================================

function drawTrend(countries) {
  const id = '#chart-trend';

  caption(
    id,
    '1. A Shared Pattern Across Selected Countries',
    'An unweighted annual mean summarizes the same eight countries. ' +
    'It does not represent global average temperature.'
  );

  const annual = YEARS.map(year => ({
    year,
    value: d3.mean(countries, c => valueAt(c, year)),
  }));

  const f = frame(id, {
    top: 40,
    label: 'Annual mean temperature anomaly for eight selected countries',
  });

  const x = d3.scaleLinear()
    .domain([1961, 2024])
    .range([f.left, f.xEnd]);

  const y = anomalyScale(annual.map(d => d.value), f);

  axes(f, x, y, {
    xLabel: 'Year',
    yLabel: 'Temperature anomaly (°C)',
    xFormat: d3.format('d'),
  });

  zeroLine(f, y);

  f.svg.append('path')
    .datum(annual)
    .attr('fill', 'none')
    .attr('stroke', '#7541a6')
    .attr('stroke-width', 2.5)
    .attr('stroke-linejoin', 'round')
    .attr(
      'd',
      d3.line()
        .x(d => x(d.year))
        .y(d => y(d.value))
    );

  const last = annual.at(-1);

  f.svg.append('circle')
    .attr('cx', x(last.year))
    .attr('cy', y(last.value))
    .attr('r', 4.5)
    .attr('fill', '#cb598e');

  f.svg.append('text')
    .attr('x', x(last.year) - 6)
    .attr('y', y(last.value) - 13)
    .attr('text-anchor', 'end')
    .attr('font-size', 12)
    .attr('font-weight', 700)
    .attr('fill', '#7541a6')
    .text(`2024: ${signed(last.value)} °C`);

  note(
    id,
    'Each country receives equal weight. The sample is fixed across ' +
    'all 64 years. Baseline: 1951–1980.'
  );
}

// ==================================================
// 2. Country panels
// ==================================================

function drawCountries(countries) {
  const id = '#chart-countries';
  const container = d3.select(id);

  caption(
    id,
    '2. Eight Countries, One Shared Scale',
    'Separate panels reveal country patterns. All panels use identical ' +
    'axes; the thick line shows a trailing 10-year average.'
  );

  const allValues = countries.flatMap(
    c => c.values.map(d => d.value)
  );

  const sharedDomain = [
    Math.min(0, d3.min(allValues)),
    Math.max(0, d3.max(allValues)),
  ];

  const grid = container.append('div')
    .attr('class', 'country-small-multiples');

  for (const country of countries) {
    const panel = grid.append('section')
      .attr('class', 'country-panel');

    panel.append('h4').text(country.name);

    const width = 440;
    const height = 270;
    const margin = { top: 24, right: 18, bottom: 35, left: 44 };

    const x = d3.scaleLinear()
      .domain([1961, 2024])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain(sharedDomain)
      .nice()
      .range([height - margin.bottom, margin.top]);

    const svg = panel.append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr(
        'aria-label',
        `${country.name}: annual anomalies and trailing 10-year average`
      );

    svg.append('title')
      .text(`${country.name}, 1961–2024; anomaly baseline 1951–1980`);

    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(${margin.left},0)`)
      .call(
        d3.axisLeft(y)
          .ticks(4)
          .tickSize(-(width - margin.left - margin.right))
          .tickFormat('')
      );

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(
        d3.axisBottom(x)
          .tickValues([1961, 1980, 2000, 2024])
          .tickFormat(d3.format('d'))
          .tickSizeOuter(0)
      );

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSizeOuter(0));

    svg.append('line')
      .attr('class', 'zero-line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', y(0))
      .attr('y2', y(0));

    svg.append('text')
      .attr('x', margin.left)
      .attr('y', 12)
      .attr('font-size', 11)
      .attr('fill', '#686174')
      .text('°C');

    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.value));

    svg.append('path')
      .datum(country.values)
      .attr('fill', 'none')
      .attr('stroke', '#b6a6c7')
      .attr('stroke-width', 1.3)
      .attr('d', line);

    const rolling = country.values
      .slice(9)
      .map((d, i) => ({
        year: d.year,
        value: d3.mean(
          country.values.slice(i, i + 10),
          item => item.value
        ),
      }));

    svg.append('path')
      .datum(rolling)
      .attr('fill', 'none')
      .attr('stroke', '#7541a6')
      .attr('stroke-width', 3)
      .attr('stroke-linejoin', 'round')
      .attr('d', line);

    const last = rolling.at(-1);

    svg.append('circle')
      .attr('cx', x(last.year))
      .attr('cy', y(last.value))
      .attr('r', 4)
      .attr('fill', '#7541a6');

    const difference =
      meanPeriod(country, 2005, 2024) -
      meanPeriod(country, 1961, 1980);

    const metrics = panel.append('div')
      .attr('class', 'country-panel-metrics');

    metrics.append('span')
      .text('2005–2024 mean minus 1961–1980 mean');

    metrics.append('strong')
      .text(`${signed(difference)} °C`);
  }

  legend(id, [
    { label: 'Annual anomaly', color: '#b6a6c7' },
    { label: 'Trailing 10-year average', color: '#7541a6' },
  ]);

  note(
    id,
    'The rolling average begins in 1970 and includes the displayed ' +
    'year plus the preceding nine years. Panel values compare two ' +
    '20-year means; they are not annual warming rates.'
  );
}

// ==================================================
// 3. Period heatmap
// ==================================================

function drawHeatmap(countries) {
  const id = '#chart-heatmap';

  const periods = [
    { label: '1961–69', start: 1961, end: 1969 },
    { label: '1970s', start: 1970, end: 1979 },
    { label: '1980s', start: 1980, end: 1989 },
    { label: '1990s', start: 1990, end: 1999 },
    { label: '2000s', start: 2000, end: 2009 },
    { label: '2010s', start: 2010, end: 2019 },
    { label: '2020–24', start: 2020, end: 2024 },
  ];

  const cells = countries.flatMap(country =>
    periods.map(period => ({
      country: country.name,
      period: period.label,
      value: meanPeriod(country, period.start, period.end),
    }))
  );

  const f = frame(id, {
    height: 390,
    left: 125,
    label: 'Mean temperature anomalies by country and period',
  });

  const x = d3.scaleBand()
    .domain(periods.map(d => d.label))
    .range([f.left, f.xEnd])
    .padding(0.04);

  const y = d3.scaleBand()
    .domain(countries.map(d => d.name))
    .range([f.top, f.yEnd])
    .padding(0.06);

  const limit = d3.max(cells, d => Math.abs(d.value)) || 1;

  const fill = d3.scaleLinear()
    .domain([-limit, 0, limit])
    .range(['#427c9b', '#faf7fb', '#7541a6']);

  f.svg.append('g')
    .attr('transform', `translate(0,${f.yEnd})`)
    .call(d3.axisBottom(x).tickSize(0))
    .call(g => g.select('.domain').remove());

  f.svg.append('g')
    .attr('transform', `translate(${f.left},0)`)
    .call(d3.axisLeft(y).tickSize(0))
    .call(g => g.select('.domain').remove());

  f.svg.selectAll('rect.cell')
    .data(cells)
    .join('rect')
    .attr('class', 'cell')
    .attr('x', d => x(d.period))
    .attr('y', d => y(d.country))
    .attr('width', x.bandwidth())
    .attr('height', y.bandwidth())
    .attr('rx', 4)
    .attr('fill', d => fill(d.value))
    .attr('stroke', '#e7dfed')
    .append('title')
    .text(d => `${d.country}, ${d.period}: ${signed(d.value)} °C`);

  f.svg.selectAll('text.cell-value')
    .data(cells)
    .join('text')
    .attr('class', 'cell-value')
    .attr('x', d => x(d.period) + x.bandwidth() / 2)
    .attr('y', d => y(d.country) + y.bandwidth() / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', 11)
    .attr(
      'fill',
      d => Math.abs(d.value) > limit * 0.6 ? 'white' : '#292339'
    )
    .attr('pointer-events', 'none')
    .text(d => d.value.toFixed(1));

  legend(id, [
    { label: 'Below baseline', color: '#427c9b' },
    { label: 'Near baseline', color: '#faf7fb' },
    { label: 'Above baseline', color: '#7541a6' },
  ]);

  note(
    id,
    'Labels show mean anomalies in °C. The first and last periods ' +
    'are partial decades containing 9 and 5 years respectively.'
  );
}

// ==================================================
// 4. Equal-length period comparison
// ==================================================

function drawPeriods(countries) {
  const id = '#chart-periods';

  const data = countries.map(country => ({
    name: country.name,
    early: meanPeriod(country, 1961, 1980),
    recent: meanPeriod(country, 2005, 2024),
  }));

  const f = frame(id, {
    left: 125,
    height: 390,
    label: 'Country mean anomalies in 1961–1980 and 2005–2024',
  });

  const values = data.flatMap(d => [d.early, d.recent]);

  const x = d3.scaleLinear()
    .domain([
      Math.min(0, d3.min(values)),
      Math.max(0, d3.max(values)),
    ])
    .nice()
    .range([f.left, f.xEnd]);

  const y = d3.scalePoint()
    .domain(data.map(d => d.name))
    .range([f.top + 12, f.yEnd - 12]);

  f.svg.append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(0,${f.yEnd})`)
    .call(
      d3.axisBottom(x)
        .ticks(6)
        .tickSize(-(f.yEnd - f.top))
        .tickFormat('')
    );

  f.svg.append('g')
    .attr('transform', `translate(0,${f.yEnd})`)
    .call(d3.axisBottom(x).ticks(6).tickSizeOuter(0));

  f.svg.append('g')
    .attr('transform', `translate(${f.left},0)`)
    .call(d3.axisLeft(y).tickSize(0))
    .call(g => g.select('.domain').remove());

  f.svg.selectAll('line.connector')
    .data(data)
    .join('line')
    .attr('class', 'connector')
    .attr('x1', d => x(d.early))
    .attr('x2', d => x(d.recent))
    .attr('y1', d => y(d.name))
    .attr('y2', d => y(d.name))
    .attr('stroke', '#cbbbd8')
    .attr('stroke-width', 3);

  for (const [key, fill, period] of [
    ['early', '#9a91a6', '1961–1980'],
    ['recent', '#7541a6', '2005–2024'],
  ]) {
    f.svg.selectAll(`circle.${key}`)
      .data(data)
      .join('circle')
      .attr('class', key)
      .attr('cx', d => x(d[key]))
      .attr('cy', d => y(d.name))
      .attr('r', 5.5)
      .attr('fill', fill)
      .append('title')
      .text(d => `${d.name}, ${period}: ${signed(d[key])} °C`);
  }

  f.svg.append('text')
    .attr('class', 'axis-label')
    .attr('x', (f.left + f.xEnd) / 2)
    .attr('y', f.height - 10)
    .attr('text-anchor', 'middle')
    .text('Mean temperature anomaly (°C)');

  legend(id, [
    { label: '1961–1980', color: '#9a91a6' },
    { label: '2005–2024', color: '#7541a6' },
  ]);

  note(
    id,
    'Each mean uses 20 observations. Both periods retain the ' +
    '1951–1980 anomaly baseline.'
  );
}

// ==================================================
// 5. Interactive correlation matrix
// ==================================================

function drawCorrelation(countries) {
  const id = '#chart-distribution';

  caption(
    id,
    '5. Do Countries Change Together?',
    'Explore Pearson correlations between countries. Change the period ' +
    'or compare annual anomalies with year-to-year changes.'
  );

  const container = d3.select(id);

  const controls = container.append('div')
    .attr('class', 'analysis-controls');

  const startLabel = controls.append('label');
  startLabel.append('span').text('Start year');

  const startInput = startLabel.append('input')
    .attr('type', 'number')
    .attr('min', 1961)
    .attr('max', 2024)
    .attr('step', 1)
    .property('value', 1961);

  const endLabel = controls.append('label');
  endLabel.append('span').text('End year');

  const endInput = endLabel.append('input')
    .attr('type', 'number')
    .attr('min', 1961)
    .attr('max', 2024)
    .attr('step', 1)
    .property('value', 2024);

  const modeLabel = controls.append('label');
  modeLabel.append('span').text('Compare');

  const modeSelect = modeLabel.append('select');

  modeSelect.append('option')
    .attr('value', 'levels')
    .text('Annual anomalies');

  modeSelect.append('option')
    .attr('value', 'changes')
    .text('Year-to-year changes');

  const reset = controls.append('button')
    .attr('type', 'button')
    .text('Reset');

  const validation = container.append('p')
    .attr('class', 'chart-note')
    .attr('role', 'status');

  const f = frame(id, {
    width: 700,
    height: 610,
    left: 125,
    right: 35,
    top: 65,
    bottom: 50,
    label: 'Pearson correlation matrix for eight countries',
  });

  const codes = countries.map(d => d.code);

  const x = d3.scaleBand()
    .domain(codes)
    .range([f.left, f.xEnd])
    .padding(0.04);

  const y = d3.scaleBand()
    .domain(codes)
    .range([f.top, f.yEnd])
    .padding(0.04);

  const correlationColor = d3.scaleLinear()
    .domain([-1, 0, 1])
    .range(['#267f91', '#f8f5fa', '#7541a6'])
    .clamp(true);

  f.svg.append('g')
    .attr('transform', `translate(0,${f.top - 8})`)
    .call(
      d3.axisTop(x)
        .tickSize(0)
        .tickFormat(code => SHORT_NAMES.get(code))
    )
    .call(g => g.select('.domain').remove())
    .selectAll('text')
    .attr('transform', 'rotate(-30)')
    .attr('text-anchor', 'start');

  f.svg.append('g')
    .attr('transform', `translate(${f.left - 8},0)`)
    .call(
      d3.axisLeft(y)
        .tickSize(0)
        .tickFormat(code => COUNTRY_NAMES.get(code))
    )
    .call(g => g.select('.domain').remove());

  const cellsLayer = f.svg.append('g');

  const summary = container.append('p')
    .attr('class', 'analysis-summary')
    .attr('role', 'status');

  legend(id, [
    { label: '−1: opposite linear variation', color: '#267f91' },
    { label: '0: no linear association', color: '#f8f5fa' },
    { label: '+1: same-direction linear variation', color: '#7541a6' },
  ]);

  note(
    id,
    'Pearson r measures linear association, not causation or equal ' +
    'warming rates. Correlations of annual levels can reflect a shared ' +
    'time trend. First differences compare consecutive-year changes ' +
    'within the selected period; they do not remove every source of ' +
    'dependence. Results are descriptive, with no significance tests. ' +
    'The diagonal compares each country with itself.'
  );

  function update() {
    const start = startInput.node().valueAsNumber;
    const end = endInput.node().valueAsNumber;

    const valid =
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 1961 &&
      end <= 2024 &&
      end - start >= 9;

    if (!valid) {
      validation.text(
        'Choose a valid period of at least 10 years within 1961–2024. ' +
        'The matrix below retains the last valid selection.'
      );
      return;
    }

    validation.text('');

    const mode = modeSelect.property('value');
    const selectedYears = d3.range(start, end + 1);

    const series = countries.map(country => {
      const levels = selectedYears.map(
        year => valueAt(country, year)
      );

      const values = mode === 'levels'
        ? levels
        : levels.slice(1).map(
            (value, i) => value - levels[i]
          );

      return { ...country, series: values };
    });

    const cells = series.flatMap((a, i) =>
      series.map((b, j) => ({
        a: a.code,
        b: b.code,
        i,
        j,
        r: pearson(a.series, b.series),
        n: a.series.length,
      }))
    );

    function description(d) {
      const result = d.r === null ? 'undefined' : d.r.toFixed(2);

      return (
        `${COUNTRY_NAMES.get(d.a)} and ${COUNTRY_NAMES.get(d.b)}: ` +
        `r = ${result}; ${d.n} paired observations; ${start}–${end}. ` +
        (mode === 'levels'
          ? 'Annual anomalies.'
          : 'Year-to-year changes within the selected period.')
      );
    }

    const groups = cellsLayer.selectAll('g.correlation-cell')
      .data(cells, d => `${d.a}-${d.b}`)
      .join(enter => {
        const group = enter.append('g')
          .attr('class', 'correlation-cell');

        group.append('rect').attr('rx', 5);
        group.append('text');
        group.append('title');

        return group;
      })
      .attr('tabindex', 0)
      .attr('role', 'img')
      .attr('aria-label', description)
      .on('pointerenter', (_, d) => summary.text(description(d)))
      .on('focus', (_, d) => summary.text(description(d)));

    groups.select('rect')
      .attr('x', d => x(d.b))
      .attr('y', d => y(d.a))
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('stroke', '#e7dfed')
      .attr('fill', d =>
        d.r === null ? '#ddd8e1' : correlationColor(d.r)
      );

    groups.select('text')
      .attr('x', d => x(d.b) + x.bandwidth() / 2)
      .attr('y', d => y(d.a) + y.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 13)
      .attr('font-weight', 600)
      .attr('pointer-events', 'none')
      .attr('fill', d =>
        d.r !== null && Math.abs(d.r) >= 0.6
          ? 'white'
          : '#292339'
      )
      .text(d => d.r === null ? 'N/A' : d.r.toFixed(2));

    groups.select('title').text(description);

    const pairs = cells.filter(
      d => d.i < d.j && d.r !== null
    );

    const strongest = pairs.slice().sort(
      (a, b) => Math.abs(b.r) - Math.abs(a.r)
    )[0];

    const n = series[0].series.length;
    const modeText = mode === 'levels'
      ? 'annual anomalies'
      : 'year-to-year changes';

    summary.text(
      `${start}–${end} · ${n} paired observations · ${modeText}. ` +
      (strongest
        ? `Largest absolute off-diagonal correlation: ` +
          `${COUNTRY_NAMES.get(strongest.a)} and ` +
          `${COUNTRY_NAMES.get(strongest.b)}, ` +
          `r = ${strongest.r.toFixed(2)}.`
        : 'Correlation is undefined for the selected series.')
    );

    f.svg.attr(
      'aria-label',
      `Pearson correlation matrix, ${start}–${end}, ${modeText}`
    );
  }

  startInput.on('input', update);
  endInput.on('input', update);
  modeSelect.on('change', update);

  reset.on('click', () => {
    startInput.property('value', 1961);
    endInput.property('value', 2024);
    modeSelect.property('value', 'levels');
    update();
  });

  update();
}

// ==================================================
// 6. Animated annual comparison
// ==================================================

function drawTimeline(countries) {
  const id = '#chart-rates';

  caption(
    id,
    '6. Warming Through Time',
    'Play the timeline to compare annual anomalies and changing ' +
    'rankings. The temperature scale stays fixed across all years.'
  );

  const container = d3.select(id);

  const controls = container.append('div')
    .attr('class', 'timeline-controls');

  const play = controls.append('button')
    .attr('type', 'button')
    .attr('class', 'timeline-play')
    .text('▶ Play');

  const reset = controls.append('button')
    .attr('type', 'button')
    .attr('class', 'timeline-reset')
    .text('↺ Reset');

  const output = controls.append('output')
    .attr('class', 'timeline-year')
    .attr('aria-label', 'Selected year');

  const sliderLabel = container.append('label')
    .attr('class', 'timeline-slider-label');

  sliderLabel.append('span').text('Explore year');

  const slider = sliderLabel.append('input')
    .attr('type', 'range')
    .attr('min', 1961)
    .attr('max', 2024)
    .attr('step', 1)
    .attr('aria-label', 'Year of temperature comparison');

  const f = frame(id, {
    height: 430,
    left: 125,
    right: 60,
    top: 45,
    label: 'Annual temperature anomaly comparison',
  });

  const allValues = countries.flatMap(
    c => c.values.map(d => d.value)
  );

  const x = d3.scaleLinear()
    .domain([
      Math.min(0, d3.min(allValues)),
      Math.max(0, d3.max(allValues)),
    ])
    .nice()
    .range([f.left, f.xEnd]);

  const y = d3.scaleBand()
    .range([f.top, f.yEnd])
    .padding(0.28);

  f.svg.append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(0,${f.yEnd})`)
    .call(
      d3.axisBottom(x)
        .ticks(6)
        .tickSize(-(f.yEnd - f.top))
        .tickFormat('')
    );

  f.svg.append('g')
    .attr('transform', `translate(0,${f.yEnd})`)
    .call(
      d3.axisBottom(x)
        .ticks(6)
        .tickFormat(d3.format('.1f'))
        .tickSizeOuter(0)
    );

  f.svg.append('line')
    .attr('x1', x(0))
    .attr('x2', x(0))
    .attr('y1', f.top)
    .attr('y2', f.yEnd)
    .attr('stroke', '#8b7d99')
    .attr('stroke-width', 1.5);

  f.svg.append('text')
    .attr('x', x(0))
    .attr('y', f.top - 15)
    .attr('text-anchor', 'middle')
    .attr('font-size', 10)
    .attr('fill', '#74677e')
    .text('Baseline');

  f.svg.append('text')
    .attr('class', 'axis-label')
    .attr('x', (f.left + f.xEnd) / 2)
    .attr('y', f.height - 10)
    .attr('text-anchor', 'middle')
    .text('Annual temperature anomaly (°C)');

  const yearLabel = f.svg.append('text')
    .attr('x', f.xEnd)
    .attr('y', f.top - 15)
    .attr('text-anchor', 'end')
    .attr('font-size', 25)
    .attr('font-weight', 700)
    .attr('fill', '#b9a0cc');

  const layer = f.svg.append('g');

  const summary = container.append('p')
    .attr('class', 'timeline-summary');

  note(
    id,
    'Bars show annual anomalies, not absolute temperatures or warming ' +
    'rates. Rankings apply only to the eight selected countries. ' +
    'Playback changes between annual observations; the animation ' +
    'does not represent measurements between years.'
  );

  let currentYear = 1961;
  let timer = null;

  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  function stop() {
    if (timer !== null) window.clearInterval(timer);
    timer = null;

    play.text('▶ Play')
      .attr('aria-label', 'Play annual temperature comparison');
  }

  function update(year, animate = true) {
    currentYear = year;

    slider.property('value', year)
      .attr('aria-valuetext', String(year));

    output.text(year);
    yearLabel.text(year);

    const data = countries.map(country => ({
      ...country,
      value: valueAt(country, year),
    })).sort(
      (a, b) =>
        d3.descending(a.value, b.value) ||
        d3.ascending(a.name, b.name)
    );

    y.domain(data.map(d => d.code));

    const rows = layer.selectAll('g.country-row')
      .data(data, d => d.code)
      .join(enter => {
        const row = enter.append('g')
          .attr('class', 'country-row');

        row.append('rect')
          .attr('rx', 5);

        row.append('text')
          .attr('class', 'country-name')
          .attr('text-anchor', 'end')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', 11)
          .attr('fill', '#51465f');

        row.append('text')
          .attr('class', 'country-value')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', 11)
          .attr('font-weight', 700)
          .attr('fill', '#51465f');

        row.append('title');

        return row;
      });

    rows.interrupt();
    rows.selectAll('*').interrupt();

    const duration =
      animate && !reducedMotion.matches ? 550 : 0;

    const movingRows = duration
      ? rows.transition().duration(duration)
      : rows;

    movingRows.attr(
      'transform',
      d => `translate(0,${y(d.code)})`
    );

    const bars = rows.select('rect')
      .attr('fill', d => color(d.code));

    const movingBars = duration
      ? bars.transition().duration(duration)
      : bars;

    movingBars
      .attr('x', d => x(Math.min(0, d.value)))
      .attr('width', d => Math.abs(x(d.value) - x(0)))
      .attr('height', y.bandwidth());

    rows.select('.country-name')
      .attr('x', f.left - 12)
      .attr('y', y.bandwidth() / 2)
      .text(d => d.name);

    const labels = rows.select('.country-value')
      .attr('y', y.bandwidth() / 2)
      .attr('text-anchor', d => d.value >= 0 ? 'start' : 'end')
      .text(d => signed(d.value));

    const movingLabels = duration
      ? labels.transition().duration(duration)
      : labels;

    movingLabels.attr(
      'x',
      d => x(d.value) + (d.value >= 0 ? 7 : -7)
    );

    rows.select('title')
      .text(d => `${d.name}, ${year}: ${signed(d.value)} °C`);

    summary.text(
      `${year}: ${data[0].name} has the highest anomaly ` +
      `(${signed(data[0].value)} °C); ` +
      `${data.at(-1).name} has the lowest ` +
      `(${signed(data.at(-1).value)} °C) among these countries.`
    );

    const description =
      `${year}. ` +
      data.map(d => `${d.name}: ${signed(d.value)} °C`).join('; ');

    f.svg.attr('aria-label', description);
    f.svg.select('title').text(description);
  }

  play.on('click', () => {
    if (timer !== null) {
      stop();
      return;
    }

    if (currentYear === 2024) update(1961, false);

    play.text('❚❚ Pause')
      .attr('aria-label', 'Pause annual temperature comparison');

    timer = window.setInterval(() => {
      update(currentYear + 1);
      if (currentYear >= 2024) stop();
    }, 850);
  });

  slider.on('input', event => {
    stop();
    update(Number(event.target.value), false);
  });

  reset.on('click', () => {
    stop();
    update(1961, false);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });

  window.addEventListener('beforeprint', () => {
    stop();
    update(currentYear, false);
  });

  window.addEventListener('pagehide', stop);

  update(1961, false);
}

// ==================================================
// Initialize
// ==================================================

async function initialize() {
  try {
    const url = new URL(
      './data/climate_temperature.csv',
      import.meta.url
    );

    const rows = await d3.csv(url.href);

    if (!rows.length) {
      throw new Error('The CSV contains no data rows');
    }

    const required = ['ISO3', ...YEARS.map(String)];

    const missingColumns = required.filter(
      column => !rows.columns.includes(column)
    );

    if (missingColumns.length) {
      throw new Error(
        `Missing columns: ${missingColumns.join(', ')}`
      );
    }

    const countries = [...COUNTRY_NAMES].map(([code, name]) => {
      const matches = rows.filter(
        row => String(row.ISO3).trim().toUpperCase() === code
      );

      if (matches.length !== 1) {
        throw new Error(
          `Expected one row for ${name}; found ${matches.length}`
        );
      }

      const row = matches[0];

      const values = YEARS.map(year => {
        const raw = String(row[String(year)] ?? '').trim();

        return {
          year,
          value: raw === '' ? NaN : Number(raw),
        };
      });

      const invalid = values.filter(
        d => !Number.isFinite(d.value)
      );

      if (invalid.length) {
        throw new Error(
          `${name}: missing or invalid values in ` +
          invalid.map(d => d.year).join(', ')
        );
      }

      return { code, name, values };
    });

    d3.selectAll('.chart').selectAll('*').remove();

    // Keep overview wording consistent with the revised fifth chart.
    d3.selectAll('#overview-heading ~ p')
      .filter(function () {
        return this.textContent.includes('Six visualizations');
      })
      .text(
        'Six visualizations examine a selected-country average, ' +
        'individual trajectories, period means, country correlations, ' +
        'and changing annual rankings.'
      );

    drawTrend(countries);
    drawCountries(countries);
    drawHeatmap(countries);
    drawPeriods(countries);
    drawCorrelation(countries);
    drawTimeline(countries);

    status.textContent =
      'Six visualizations loaded. All comparisons use the same eight ' +
      'countries with complete observations for 1961–2024.';

    console.log('CSV rows:', rows.length);
    console.log('Validated countries:', countries);
  } catch (error) {
    console.error('Visualization error:', error);

    status.textContent =
      `Could not load the charts: ${error.message}. ` +
      'Check the CSV location and open this page through Live Server.';
  }
}

initialize();