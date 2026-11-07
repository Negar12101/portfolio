console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// Base path for Live Server and GitHub Pages
const BASE_PATH =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1'
    ? '/'
    : '/portfolio/';

// Navigation pages
const pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'contact/', title: 'Contact' },
  { url: 'resume/', title: 'Resume' },
  { url: 'meta/', title: 'Meta' },
  { url: 'https://github.com/negar12101', title: 'GitHub' }
];

// Treat index.html and its directory as the same page
function normalizePath(path) {
  return path.replace(/index\.html$/, '');
}

// Create navigation
const nav = document.createElement('nav');
document.body.prepend(nav);

for (const page of pages) {
  const url = page.url.startsWith('http')
    ? page.url
    : BASE_PATH + page.url;

  const link = document.createElement('a');
  link.href = url;
  link.textContent = page.title;

  if (
    link.host === location.host &&
    normalizePath(link.pathname) === normalizePath(location.pathname)
  ) {
    link.classList.add('current');
    link.setAttribute('aria-current', 'page');
  }

  if (link.host !== location.host) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }

  nav.append(link);
}

// Create theme selector
document.body.insertAdjacentHTML(
  'afterbegin',
  `
  <label class="color-scheme">
    Theme:
    <select>
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
  `
);

const select = document.querySelector('.color-scheme select');

function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty(
    'color-scheme',
    colorScheme
  );

  select.value = colorScheme;
}

// Restore saved theme
if ('colorScheme' in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

// Apply and save theme changes
select.addEventListener('input', (event) => {
  const colorScheme = event.target.value;

  setColorScheme(colorScheme);
  localStorage.colorScheme = colorScheme;
});

// Handle contact form
const form = document.querySelector('form[action^="mailto:"]');

form?.addEventListener('submit', (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const parameters = [];

  for (const [name, value] of data) {
    parameters.push(
      `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
    );
  }

  const url = `${form.action}?${parameters.join('&')}`;
  location.href = url;
});

// Fetch and parse JSON
export async function fetchJSON(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch JSON: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
    throw error;
  }
}

// Render project cards
export function renderProjects(
  projects,
  containerElement,
  headingLevel = 'h2'
) {
  if (!containerElement) {
    console.error('Projects container was not found.');
    return;
  }

  containerElement.innerHTML = '';

  if (!Array.isArray(projects) || projects.length === 0) {
    containerElement.textContent = 'No projects to display.';
    return;
  }

  if (!/^h[1-6]$/.test(headingLevel)) {
    headingLevel = 'h2';
  }

  for (const project of projects) {
    const article = document.createElement('article');

    const heading = document.createElement(headingLevel);
    heading.textContent = project.title || 'Untitled project';

    const image = document.createElement('img');
    image.src =
      project.image ||
      'https://vis-society.github.io/labs/2/images/empty.svg';
    image.alt = project.title || 'Project image';

    const details = document.createElement('div');

    const description = document.createElement('p');
    description.textContent =
      project.description || 'No description available.';

    const year = document.createElement('p');
    year.className = 'project-year';
    year.textContent = project.year ?? 'Year not specified';

    details.append(description, year);
    article.append(heading, image, details);
    containerElement.append(article);
  }
}

// Fetch public GitHub profile data
export async function fetchGitHubData(username) {
  return fetchJSON(
    `https://api.github.com/users/${username}`
  );
}
