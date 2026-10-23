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
let pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'contact/', title: 'Contact' },
  { url: 'resume/', title: 'Resume' },
  { url: 'https://github.com/negar12101', title: 'GitHub' }
];

// Create navigation
let nav = document.createElement('nav');
document.body.prepend(nav);

// Treat index.html and its directory as the same page
function normalizePath(path) {
  return path.replace(/index\.html$/, '');
}

// Create links
for (let page of pages) {
  let url = page.url;

  if (!url.startsWith('http')) {
    url = BASE_PATH + url;
  }

  let a = document.createElement('a');
  a.href = url;
  a.textContent = page.title;

  if (
    a.host === location.host &&
    normalizePath(a.pathname) === normalizePath(location.pathname)
  ) {
    a.classList.add('current');
  }

  if (a.host !== location.host) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }

  nav.append(a);
}
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

// Restore the saved preference
if ('colorScheme' in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

// Apply and save changes
select.addEventListener('input', (event) => {
  const colorScheme = event.target.value;

  setColorScheme(colorScheme);
  localStorage.colorScheme = colorScheme;
});
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
export async function fetchJSON(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch JSON: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
    throw error;
  }
}
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

    const description = document.createElement('p');
    description.textContent =
      project.description || 'No description available.';

    article.append(heading, image, description);
    containerElement.append(article);
  }
}
export async function fetchGitHubData(username) {
  return fetchJSON(
    `https://api.github.com/users/${username}`
  );
}