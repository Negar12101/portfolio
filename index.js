import {
  fetchJSON,
  renderProjects,
  fetchGitHubData
} from './global.js';

// Display the first three projects
const projectsContainer = document.querySelector('.projects');

try {
  const projects = await fetchJSON('./lib/projects.json');

  renderProjects(
    projects.slice(0, 3),
    projectsContainer,
    'h3'
  );
} catch (error) {
  if (projectsContainer) {
    projectsContainer.textContent = 'Unable to load projects.';
  }
}

// Display GitHub profile statistics
const profileStats = document.querySelector('#profile-stats');

if (profileStats) {
  try {
    const githubData = await fetchGitHubData('negar12101');

    profileStats.innerHTML = `
      <dl>
        <dt>Public Repos</dt>
        <dd>${githubData.public_repos}</dd>

        <dt>Public Gists</dt>
        <dd>${githubData.public_gists}</dd>

        <dt>Followers</dt>
        <dd>${githubData.followers}</dd>

        <dt>Following</dt>
        <dd>${githubData.following}</dd>
      </dl>
    `;
  } catch (error) {
    profileStats.textContent = 'Unable to load GitHub statistics.';
  }
}