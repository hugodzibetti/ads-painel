// Simple frontend router and page loader
import { renderDashboard } from '../pages/dashboard.ts';
import { renderMessages } from '../pages/messages.ts';
import { renderStatus } from '../pages/status.ts';

const app = document.getElementById('app');
const navLinks = document.querySelectorAll('.nav-link');

// Page map
const pages = {
  dashboard: renderDashboard,
  messages: renderMessages,
  status: renderStatus,
};

// Set default theme based on system preference
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.setAttribute('data-theme', 'dark');
} else {
  document.documentElement.setAttribute('data-theme', 'light');
}

// Handle nav link clicks
navLinks.forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.getAttribute('data-page');

    // Update active link
    navLinks.forEach((l) => l.classList.remove('active'));
    link.classList.add('active');

    // Load page
    if (pages[page]) {
      pages[page](app);
    }
  });
});

// Load dashboard by default
if (app) {
  renderDashboard(app);
  document.querySelector('[data-page="dashboard"]')?.classList.add('active');
}
