import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

// --------------------------------------------------
// Page elements and state
// --------------------------------------------------

const slider = document.querySelector('#commit-progress');
const timeElement = document.querySelector('#commit-time');
const statusElement = document.querySelector('#meta-status');
const tooltip = document.querySelector('#commit-tooltip');

let data = [];
let commits = [];
let filteredCommits = [];

let commitProgress = 100;
let commitMaxTime;
let timeScale;

let chart;
let scroller;

const technologyColor = d3.scaleOrdinal()
  .range([
    '#7541a6',
    '#cb598e',
    '#26867e',
    '#4966b1',
    '#be7731',
    '#637b35',
    '#9b4857',
    '#775f51',
  ]);

const formatCount = d3.format(',');

// --------------------------------------------------
// Load and validate data
// --------------------------------------------------

async function loadData() {
  const url = new URL('./loc.csv', import.meta.url);

  const rows = await d3.csv(url.href, row => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    datetime: new Date(row.datetime),
    type: row.type?.trim() || 'Unknown',
  }));

  if (rows.length === 0) {
    throw new Error('loc.csv contains no data.');
  }

  const invalidRows = rows.filter(
    row =>
      !row.commit ||
      !row.file ||
      !Number.isFinite(+row.datetime) ||
      !Number.isFinite(row.line) ||
      !Number.isFinite(row.depth) ||
      !Number.isFinite(row.length)
  );

  if (invalidRows.length) {
    throw new Error(
      `${invalidRows.length} CSV rows have missing or invalid values.`
    );
  }

  return rows;
}

function processCommits(rows) {
  return d3.groups(rows, d => d.commit)
    .map(([id, lines]) => {
      const first = lines[0];

      const commit = {
        id,
        url:
          'https://github.com/negar12101/portfolio/commit/' +
          encodeURIComponent(id),
        author: first.author || 'Unknown author',
        datetime: first.datetime,
        hourFrac:
          first.datetime.getHours() +
          first.datetime.getMinutes() / 60 +
          first.datetime.getSeconds() / 3600,
        totalLines: lines.length,
      };

      Object.defineProperty(commit, 'lines', {
        value: lines,
        enumerable: false,
      });

      return commit;
    })
    .sort(
      (a, b) =>
        d3.ascending(a.datetime, b.datetime) ||
        d3.ascending(a.id, b.id)
    );
}

// --------------------------------------------------
// Summary statistics
// --------------------------------------------------

function renderStats(visibleCommits) {
  const lines = visibleCommits.flatMap(d => d.lines);

  const stats = [
    ['Surviving lines shown', formatCount(lines.length)],
    ['Files represented', new Set(lines.map(d => d.file)).size],
    ['Commits represented', visibleCommits.length],
    [
      'Longest line',
      `${d3.max(lines, d => d.length) ?? 0} characters`,
    ],
    ['Maximum indentation', d3.max(lines, d => d.depth) ?? 0],
  ];

  const list = d3.select('#stats')
    .selectAll('dl.stats')
    .data([null])
    .join('dl')
    .attr('class', 'stats');

  const items = list.selectAll('div')
    .data(stats, d => d[0])
    .join(enter => {
      const item = enter.append('div');
      item.append('dt');
      item.append('dd');
      return item;
    });

  items.select('dt').text(d => d[0]);
  items.select('dd').text(d => d[1]);
}

// --------------------------------------------------
// Custom tooltip
// --------------------------------------------------

function hideTooltip() {
  tooltip.hidden = true;
}

function showTooltip(event, commit) {
  tooltip.textContent = [
    `Commit: ${commit.id.slice(0, 7)}`,
    `Author: ${commit.author}`,
    commit.datetime.toLocaleString('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    }),
    `Surviving lines: ${formatCount(commit.totalLines)}`,
    `Files represented: ${new Set(
      commit.lines.map(d => d.file)
    ).size}`,
  ].join('\n');

  tooltip.hidden = false;

  let clientX = event.clientX;
  let clientY = event.clientY;

  // Keyboard focus does not supply pointer coordinates.
  if (event.type === 'focus') {
    const bounds = event.currentTarget.getBoundingClientRect();
    clientX = bounds.right;
    clientY = bounds.top;
  }

  const bounds = tooltip.getBoundingClientRect();

  const left = Math.max(
    12,
    Math.min(clientX + 14, window.innerWidth - bounds.width - 12)
  );

  const top = Math.max(
    12,
    Math.min(clientY + 14, window.innerHeight - bounds.height - 12)
  );

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

// --------------------------------------------------
// Brush selection and language breakdown
// --------------------------------------------------

function updateSelection(selection) {
  if (!chart) return;

  const selected = selection
    ? filteredCommits.filter(commit => {
        const [[x0, y0], [x1, y1]] = selection;

        const x = chart.xScale(commit.datetime);
        const y = chart.yScale(commit.hourFrac);

        return x >= x0 && x <= x1 && y >= y0 && y <= y1;
      })
    : [];

  const selectedIds = new Set(selected.map(d => d.id));

  chart.dots.selectAll('circle')
    .classed('selected', d => selectedIds.has(d.id));

  d3.select('#selection-count')
    .text(
      selection
        ? `${selected.length} commits selected`
        : 'No commits selected'
    );

  const selectedLines = selected.flatMap(d => d.lines);

  const breakdown = d3.rollups(
    selectedLines,
    lines => lines.length,
    line => line.type
  ).sort((a, b) => b[1] - a[1]);

  const list = d3.select('#language-breakdown');
  list.selectAll('*').remove();

  for (const [language, count] of breakdown) {
    list.append('dt').text(language);

    list.append('dd').text(
      `${formatCount(count)} lines ` +
      `(${d3.format('.1%')(count / selectedLines.length)})`
    );
  }
}

// --------------------------------------------------
// Create scatterplot once
// --------------------------------------------------

function createScatterplot() {
  const width = 1000;
  const height = 560;

  const margin = {
    top: 35,
    right: 45,
    bottom: 70,
    left: 75,
  };

  const svg = d3.select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr(
      'aria-label',
      'Commit dates and browser-local times of day. ' +
      'Circle area represents surviving line count.'
    );

  svg.append('title')
    .text('Portfolio commits over time');

  const xScale = d3.scaleTime()
    .range([
      margin.left + 28,
      width - margin.right - 28,
    ]);

  const yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([height - margin.bottom, margin.top]);

  // Keep sizes comparable across all timeline cutoffs.
  const radiusScale = d3.scaleSqrt()
    .domain([0, d3.max(commits, d => d.totalLines)])
    .range([0, 25]);

  svg.append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${margin.left},0)`)
    .call(
      d3.axisLeft(yScale)
        .tickValues(d3.range(0, 25, 3))
        .tickSize(-(width - margin.left - margin.right))
        .tickFormat('')
    );

  const xAxis = svg.append('g')
    .attr('class', 'x-axis')
    .attr(
      'transform',
      `translate(0,${height - margin.bottom})`
    );

  svg.append('g')
    .attr('class', 'y-axis')
    .attr('transform', `translate(${margin.left},0)`)
    .call(
      d3.axisLeft(yScale)
        .tickValues(d3.range(0, 25, 3))
        .tickFormat(
          hour => `${String(hour).padStart(2, '0')}:00`
        )
    );

  svg.append('text')
    .attr('class', 'axis-label')
    .attr('x', (margin.left + width - margin.right) / 2)
    .attr('y', height - 14)
    .attr('text-anchor', 'middle')
    .text('Commit date');

  svg.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(margin.top + height - margin.bottom) / 2)
    .attr('y', 19)
    .attr('text-anchor', 'middle')
    .text('Time of day (browser local time)');

  const brush = d3.brush()
    .extent([
      [margin.left, margin.top],
      [width - margin.right, height - margin.bottom],
    ])
    .on('start brush end', event => {
      hideTooltip();
      updateSelection(event.selection);
    });

  // The brush sits behind the circles so circle hover still works.
  const brushGroup = svg.append('g')
    .attr('class', 'brush')
    .call(brush);

  const dots = svg.append('g')
    .attr('class', 'dots');

  chart = {
    svg,
    xScale,
    yScale,
    radiusScale,
    xAxis,
    dots,
    brush,
    brushGroup,
  };
}

// --------------------------------------------------
// Update existing scatterplot
// --------------------------------------------------

function updateScatterplot() {
  hideTooltip();

  // Remove stale selections when the time cutoff changes.
  chart.brushGroup.call(chart.brush.move, null);

  let [start, end] = d3.extent(
    filteredCommits,
    d => d.datetime
  );

  if (!start) {
    start = commits[0].datetime;
    end = start;
  }

  if (+start === +end) {
    start = new Date(+start - 86400000);
    end = new Date(+end + 86400000);
  }

  chart.xScale.domain([start, end]).nice();

  // Update the existing axis; do not append another axis.
  chart.xAxis.call(
    d3.axisBottom(chart.xScale)
      .ticks(5)
      .tickFormat(d3.timeFormat('%b %d, %Y'))
      .tickSizeOuter(0)
  );

  const sorted = [...filteredCommits].sort(
    (a, b) =>
      d3.descending(a.totalLines, b.totalLines) ||
      d3.ascending(a.id, b.id)
  );

  chart.dots.selectAll('circle')
    .data(sorted, d => d.id)
    .join(
      enter => enter.append('circle'),
      update => update,
      exit => exit.remove()
    )
    .attr('cx', d => chart.xScale(d.datetime))
    .attr('cy', d => chart.yScale(d.hourFrac))
    .attr('r', d => chart.radiusScale(d.totalLines))
    .attr('tabindex', 0)
    .attr(
      'aria-label',
      d =>
        `Commit ${d.id.slice(0, 7)}, ` +
        `${d.datetime.toLocaleString()}, ` +
        `${formatCount(d.totalLines)} surviving lines`
    )
    .on('pointerenter', showTooltip)
    .on('pointermove', showTooltip)
    .on('pointerleave', hideTooltip)
    .on('focus', showTooltip)
    .on('blur', hideTooltip)
    .on('keydown', event => {
      if (event.key === 'Escape') hideTooltip();
    })
    .order();

  updateSelection(null);
}

// --------------------------------------------------
// Technology legend
// --------------------------------------------------

function renderFileLegend() {
  const types = [...new Set(data.map(d => d.type))]
    .sort(d3.ascending);

  technologyColor.domain(types);

  const items = d3.select('#file-legend')
    .selectAll('.legend-item')
    .data(types, d => d)
    .join('span')
    .attr('class', 'legend-item');

  items.selectAll('*').remove();

  items.append('span')
    .attr('class', 'legend-swatch')
    .style('--color', d => technologyColor(d))
    .attr('aria-hidden', 'true');

  items.append('span').text(d => d);
}

// --------------------------------------------------
// Unit visualization: one dot per surviving line
// --------------------------------------------------

function updateFileDisplay() {
  const lines = filteredCommits.flatMap(d => d.lines);

  const files = d3.groups(lines, d => d.file)
    .map(([name, fileLines]) => ({
      name,
      lines: fileLines.sort(
        (a, b) => d3.ascending(a.line, b.line)
      ),
    }))
    .sort(
      (a, b) =>
        d3.descending(a.lines.length, b.lines.length) ||
        d3.ascending(a.name, b.name)
    );

  const fileRows = d3.select('#files')
    .selectAll('div.file-row')
    .data(files, d => d.name)
    .join(
      enter => {
        const row = enter.append('div')
          .attr('class', 'file-row');

        const term = row.append('dt');
        term.append('code');
        term.append('small');

        row.append('dd');

        return row;
      },
      update => update,
      exit => exit.remove()
    )
    .order();

  fileRows.select('dt code')
    .text(d => d.name);

  fileRows.select('dt small')
    .text(d => `${formatCount(d.lines.length)} surviving lines`);

  fileRows.select('dd')
    .attr('role', 'img')
    .attr(
      'aria-label',
      d => `${d.name}: ${formatCount(d.lines.length)} lines`
    )
    .selectAll('div.loc')
    .data(
      d => d.lines,
      d => `${d.file}:${d.line}`
    )
    .join('div')
    .attr('class', 'loc')
    .attr('aria-hidden', 'true')
    .style('--color', d => technologyColor(d.type))
    .attr(
      'title',
      d =>
        `${d.file}, line ${d.line}\n` +
        `${d.type}\nCommit: ${d.commit.slice(0, 7)}`
    );
}

// --------------------------------------------------
// Shared time filter
// --------------------------------------------------

function applyCutoff(cutoff, progress) {
  commitMaxTime = new Date(+cutoff);
  commitProgress = progress;

  slider.value = String(progress);

  timeElement.dateTime = commitMaxTime.toISOString();
  timeElement.textContent = commitMaxTime.toLocaleString(
    'en-US',
    {
      dateStyle: 'long',
      timeStyle: 'short',
    }
  );

  slider.setAttribute(
    'aria-valuetext',
    timeElement.textContent
  );

  filteredCommits = commits.filter(
    d => d.datetime <= commitMaxTime
  );

  renderStats(filteredCommits);
  updateScatterplot();
  updateFileDisplay();
}

function onTimeSliderChange() {
  const progress = Number(slider.value);

  applyCutoff(
    timeScale.invert(progress),
    progress
  );

  // Manual exploration temporarily overrides the active story step.
  d3.selectAll('#scatter-story .step')
    .classed('is-active', false);
}

// --------------------------------------------------
// Narrative text
// --------------------------------------------------

function renderStory() {
  const steps = d3.select('#scatter-story')
    .selectAll('.step')
    .data(commits, d => d.id)
    .join('div')
    .attr('class', 'step');

  steps.each(function (commit, index) {
    const step = d3.select(this);

    step.selectAll('*').remove();

    step.append('h3')
      .text(`Commit ${index + 1} of ${commits.length}`);

    step.append('time')
      .attr('datetime', commit.datetime.toISOString())
      .text(
        commit.datetime.toLocaleString('en-US', {
          dateStyle: 'long',
          timeStyle: 'short',
        })
      );

    step.append('p')
      .text(
        `This commit is associated with ` +
        `${formatCount(commit.totalLines)} surviving lines ` +
        `across ${new Set(commit.lines.map(d => d.file)).size} files ` +
        'in the current snapshot.'
      );

    step.append('p')
      .append('a')
      .attr('href', commit.url)
      .attr('target', '_blank')
      .attr('rel', 'noopener noreferrer')
      .text(`View commit ${commit.id.slice(0, 7)} →`);

    step.append('p')
      .attr('class', 'meta-note')
      .text(
        'At this step, the chart and file dots reveal surviving ' +
        'lines attributed to commits up to this time.'
      );
  });
}

// --------------------------------------------------
// Scrollytelling
// --------------------------------------------------

function setupScrollytelling() {
  scroller = scrollama();

  scroller.setup({
    step: '#scatter-story .step',
    offset: 0.6,
  }).onStepEnter(response => {
    const commit = d3.select(response.element).datum();

    d3.selectAll('#scatter-story .step')
      .classed(
        'is-active',
        function () {
          return this === response.element;
        }
      );

    // Use the exact commit timestamp to avoid rounding it out.
    applyCutoff(
      commit.datetime,
      timeScale(commit.datetime)
    );
  });

  window.addEventListener('resize', () => {
    hideTooltip();
    scroller.resize();
  });

  // Recalculate after fonts finish loading.
  document.fonts?.ready.then(() => {
    scroller.resize();
  });
}

// --------------------------------------------------
// Initialize
// --------------------------------------------------

async function initialize() {
  try {
    slider.disabled = true;

    data = await loadData();
    commits = processCommits(data);

    const firstTime = commits[0].datetime;
    const lastTime = commits.at(-1).datetime;

    // A nonzero domain also handles a one-commit snapshot.
    const domainStart = +firstTime === +lastTime
      ? new Date(+firstTime - 86400000)
      : firstTime;

    timeScale = d3.scaleTime()
      .domain([domainStart, lastTime])
      .range([0, 100])
      .clamp(true);

    createScatterplot();
    renderFileLegend();
    renderStory();

    applyCutoff(lastTime, 100);

    slider.disabled = false;
    slider.addEventListener('input', onTimeSliderChange);

    setupScrollytelling();

    statusElement.textContent =
      `Loaded ${formatCount(data.length)} surviving lines ` +
      `across ${commits.length} represented commits. ` +
      'Scroll through the narrative or explore with the slider.';

    window.addEventListener('scroll', hideTooltip, {
      passive: true,
    });

    window.addEventListener('pagehide', () => {
      hideTooltip();
      scroller?.destroy();
    });
  } catch (error) {
    console.error('Could not initialize the Meta page:', error);

    statusElement.textContent =
      `Could not load code history: ${error.message} ` +
      'Check that loc.csv is inside the meta folder and use Live Server.';

    slider.disabled = true;
  }
}

initialize();