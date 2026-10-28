import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

import { fetchJSON, renderProjects } from '../global.js';

const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const searchInput = document.querySelector('.searchBar');

try {
  const projects = await fetchJSON('../lib/projects.json');

  let query = searchInput.value;
  let selectedYear = null;

  const years = [...new Set(
    projects.map((project) => String(project.year))
  )].sort((a, b) => Number(a) - Number(b));

  const colors = d3.scaleOrdinal()
    .domain(years)
    .range(d3.schemeTableau10);

  function toggleYear(year) {
    selectedYear = selectedYear === year ? null : year;
    updateProjects();
  }

  function renderPieChart(projectsGiven) {
    const data = d3.rollups(
      projectsGiven,
      (group) => group.length,
      (project) => String(project.year)
    )
      .map(([year, count]) => ({
        label: year,
        value: count
      }))
      .sort((a, b) => Number(a.label) - Number(b.label));

    const arcGenerator = d3.arc()
      .innerRadius(0)
      .outerRadius(50);

    const sliceGenerator = d3.pie()
      .sort(null)
      .value((item) => item.value);

    const svg = d3.select('#projects-pie-plot');
    const legend = d3.select('.legend');

    svg.selectAll('*').remove();
    legend.selectAll('*').remove();

    sliceGenerator(data).forEach((slice) => {
      const year = slice.data.label;
      const isSelected = selectedYear === year;

      const path = svg.append('path')
        .attr('d', arcGenerator(slice))
        .attr('fill', colors(year))
        .classed('selected', isSelected)
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-pressed', String(isSelected))
        .attr(
          'aria-label',
          `${year}: ${slice.data.value} projects. Filter by year.`
        )
        .on('click', () => toggleYear(year))
        .on('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleYear(year);
          }
        });

      path.append('title')
        .text(`${year}: ${slice.data.value} projects`);
    });

    data.forEach((item) => {
      const li = legend.append('li')
        .attr('class', 'legend-item')
        .classed('selected', selectedYear === item.label)
        .style('--color', colors(item.label));

      const button = li.append('button')
        .attr('type', 'button')
        .attr('aria-pressed', String(selectedYear === item.label))
        .on('click', () => toggleYear(item.label));

      button.append('span')
        .attr('class', 'swatch')
        .attr('aria-hidden', 'true');

      button.append('span')
        .text(`${item.label} (${item.value})`);
    });
  }

  function updateProjects() {
    // First apply the search query
    const searchedProjects = projects.filter((project) => {
      const metadata = Object.values(project)
        .join('\n')
        .toLowerCase();

      return metadata.includes(query.trim().toLowerCase());
    });

    // Clear a selection if that year has no search matches
    if (
      selectedYear !== null &&
      !searchedProjects.some(
        (project) => String(project.year) === selectedYear
      )
    ) {
      selectedYear = null;
    }

    // Then apply the selected year to the search results
    const visibleProjects = searchedProjects.filter(
      (project) =>
        selectedYear === null ||
        String(project.year) === selectedYear
    );

    renderProjects(visibleProjects, projectsContainer, 'h2');

    // Keep all matching years available for selection
    renderPieChart(searchedProjects);

    if (projectsTitle) {
      projectsTitle.textContent =
        `${visibleProjects.length} Projects`;
    }
  }

  searchInput.addEventListener('input', (event) => {
    query = event.target.value;
    updateProjects();
  });

  updateProjects();
} catch (error) {
  console.error(error);

  if (projectsContainer) {
    projectsContainer.textContent = 'Unable to load projects.';
  }
}