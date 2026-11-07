import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Load and convert CSV values
async function loadData() {
  return d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(`${row.date}T00:00${row.timezone}`),
    datetime: new Date(row.datetime),
  }));
}

// Group lines by commit
function processCommits(data) {
  return d3.groups(data, (d) => d.commit).map(([id, lines]) => {
    const first = lines[0];

    const commit = {
      id,
      url: `https://github.com/negar12101/portfolio/commit/${id}`,
      author: first.author,
      date: first.date,
      time: first.time,
      timezone: first.timezone,
      datetime: first.datetime,
      hourFrac:
        first.datetime.getHours() +
        first.datetime.getMinutes() / 60,
      totalLines: lines.length,
    };

    Object.defineProperty(commit, 'lines', {
      value: lines,
      enumerable: false,
    });

    return commit;
  });
}

// Display summary statistics
function renderStats(data, commits) {
  const container = d3.select('#stats');
  container.selectAll('*').remove();

  const stats = [
    ['Lines of code', d3.format(',')(data.length)],
    ['Files', new Set(data.map((d) => d.file)).size],
    ['Commits represented', commits.length],
    [
      'Longest line',
      `${d3.max(data, (d) => d.length) ?? 0} characters`,
    ],
    ['Maximum indentation', d3.max(data, (d) => d.depth) ?? 0],
  ];

  const list = container.append('dl').attr('class', 'stats');

  for (const [label, value] of stats) {
    const item = list.append('div');
    item.append('dt').text(label);
    item.append('dd').text(value);
  }
}

// Draw commit scatterplot
function renderScatterplot(commits) {
  const width = 1000;
  const height = 500;
  const margin = {
    top: 35,
    right: 35,
    bottom: 65,
    left: 65,
  };

  const container = d3.select('#chart');
  container.selectAll('*').remove();

  if (commits.length === 0) {
    container.text('No commits to display.');
    return;
  }

  const svg = container
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr(
      'aria-label',
      'Commits by date and local time of day. Circle area represents surviving lines attributed to each commit.'
    );

  // Date scale
  let [start, end] = d3.extent(commits, (d) => d.datetime);

  // Provide a useful date range if all commits share one timestamp
  if (+start === +end) {
    start = new Date(+start - 86400000);
    end = new Date(+end + 86400000);
  }

  const xScale = d3
    .scaleTime()
    .domain([start, end])
    .nice()
    .range([
      margin.left + 25,
      width - margin.right - 25,
    ]);

  // Time of day scale
  const yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([
      height - margin.bottom,
      margin.top,
    ]);

  // Square-root radius makes circle area proportional to line count
  const radiusScale = d3
    .scaleSqrt()
    .domain([
      0,
      d3.max(commits, (d) => d.totalLines),
    ])
    .range([0, 25]);

  // Horizontal gridlines
  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(
      d3
        .axisLeft(yScale)
        .tickValues(d3.range(0, 25, 3))
        .tickSize(
          -(width - margin.left - margin.right)
        )
        .tickFormat('')
    )
    .call((g) => g.select('.domain').remove());

  // Date axis
  svg
    .append('g')
    .attr(
      'transform',
      `translate(0, ${height - margin.bottom})`
    )
    .call(
      d3
        .axisBottom(xScale)
        .ticks(6)
        .tickFormat(d3.timeFormat('%b %d'))
    );

  // Time axis
  svg
    .append('g')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(
      d3
        .axisLeft(yScale)
        .tickValues(d3.range(0, 25, 3))
        .tickFormat(
          (hour) => `${String(hour).padStart(2, '0')}:00`
        )
    );

  // Horizontal axis label
  svg
    .append('text')
    .attr(
      'x',
      (margin.left + width - margin.right) / 2
    )
    .attr('y', height - 12)
    .attr('text-anchor', 'middle')
    .attr('fill', 'currentColor')
    .text('Commit date');

  // Vertical axis label
  svg
    .append('text')
    .attr('transform', 'rotate(-90)')
    .attr(
      'x',
      -(margin.top + height - margin.bottom) / 2
    )
    .attr('y', 16)
    .attr('text-anchor', 'middle')
    .attr('fill', 'currentColor')
    .text('Time of day (browser local time)');
  // Add the brush before the circles so hover still works
  const brush = d3
    .brush()
    .extent([
      [margin.left, margin.top],
      [width - margin.right, height - margin.bottom],
    ])
    .on('start brush end', (event) => {
      const selection = event.selection;

      const selectedCommits = selection
        ? commits.filter((commit) => {
            const x = xScale(commit.datetime);
            const y = yScale(commit.hourFrac);
            const [[x0, y0], [x1, y1]] = selection;

            return x >= x0 && x <= x1 && y >= y0 && y <= y1;
          })
        : [];

      const selectedIds = new Set(
        selectedCommits.map((commit) => commit.id)
      );

      svg
        .selectAll('.commit-dots circle')
        .classed('selected', (d) => selectedIds.has(d.id));

      d3.select('#selection-count').text(
        selection
          ? `${selectedCommits.length} commits selected`
          : 'No commits selected'
      );

      const selectedLines = selectedCommits.flatMap(
        (commit) => commit.lines
      );

      const breakdown = d3
        .rollups(
          selectedLines,
          (lines) => lines.length,
          (line) => line.type || 'Unknown'
        )
        .sort((a, b) => b[1] - a[1]);

      const list = d3.select('#language-breakdown');
      list.selectAll('*').remove();

      for (const [language, count] of breakdown) {
        list.append('dt').text(language);
        list.append('dd').text(
          `${d3.format(',')(count)} lines (${d3.format('.1%')(
            count / selectedLines.length
          )})`
        );
      }
    });

  svg.append('g').attr('class', 'brush').call(brush);
  // Draw larger circles first so smaller circles remain visible
  const sortedCommits = [...commits].sort(
    (a, b) => b.totalLines - a.totalLines
  );

  svg
    .append('g')
    .attr('class', 'commit-dots')
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => radiusScale(d.totalLines))
    .attr('fill', 'steelblue')
    .attr('fill-opacity', 0.75)
.append('title')
.text((d) => [
  `Commit: ${d.id.slice(0, 7)}`,
  `Author: ${d.author}`,
  `Date: ${d.datetime.toLocaleDateString()}`,
  `Time: ${d.datetime.toLocaleTimeString()}`,
  `Surviving lines: ${d.totalLines}`,
].join('\n'));
}

// Initialize page
try {
  const data = await loadData();
  const commits = processCommits(data);

  renderStats(data, commits);
  renderScatterplot(commits);

  console.log('Loaded code data:', data);
  console.log('Processed commits:', commits);
} catch (error) {
  console.error('Could not initialize Meta page:', error);

  d3.select('#stats').text(
    'Could not display code statistics. Check the browser console.'
  );
}