import { fetchJSON, renderProjects } from '../global.js';

const projectsContainer = document.querySelector('.projects');

try {
  const projects = await fetchJSON('../lib/projects.json');

  renderProjects(projects, projectsContainer, 'h2');

  const projectsTitle = document.querySelector('.projects-title');

  if (projectsTitle) {
    projectsTitle.textContent = `${projects.length} Projects`;
  }
} catch (error) {
  if (projectsContainer) {
    projectsContainer.textContent = 'Unable to load projects.';
  }
}