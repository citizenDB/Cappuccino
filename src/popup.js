/*******************************************************************************

    Cappuccino
    Copyright (C) 2025-present CitizenDB

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see {http://www.gnu.org/licenses/}.

    Home: https://github.com/CitizenDB/Cappuccino
*/

let allTexts = [];
const POPUP_ITEM_LIMIT = 5;

// Format date
function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

// i18n initialization
document.addEventListener('DOMContentLoaded', function () {
  const extensionName = chrome.i18n.getMessage('extensionName');
  const clearDates = chrome.i18n.getMessage('clearDates');
  document.getElementById('searchInput').placeholder = chrome.i18n.getMessage('searchPlaceholder');

  translatePage();
  loadSavedTheme();
});

// Load saved theme from background script
async function loadSavedTheme() {
  try {
    // Request the saved theme from background script
    const response = await chrome.runtime.sendMessage({
      action: 'getTheme'
    });

    if (response && response.theme) {
      applyTheme(response.theme);
    } else {
      // Default to light theme if no saved preference
      applyTheme('light');
    }
  } catch (error) {
    console.error('Error loading theme:', error);
    applyTheme('light'); // Fallback to light theme
  }
}

// Switch theme stylesheets
function applyTheme(theme) {
  const moonIcon = document.getElementById('moonIcon');
  const sunIcon = document.getElementById('sunIcon');
  const themeLink = document.getElementById('theme-stylesheet');

  if (theme === 'dark') {
    themeLink.href = 'css/popup_dark.css';

  } else {
    themeLink.href = 'css/popup_light.css';
  }
}

// Render texts
function renderTexts(texts, totalCount = null) {
  const content = document.getElementById("content");
  const itemCount = document.getElementById("itemCount");

  const filterResult = chrome.i18n.getMessage('filterResult');
  const filterResults = chrome.i18n.getMessage('filterResults');
  // Use totalCount if provided (for search results), otherwise use texts length
  const displayCount = totalCount !== null ? totalCount : texts.length;

  const count = texts.length;
  const pr = new Intl.PluralRules(navigator.language);
  const pluralForm = pr.select(count);

  const messages = {
    one: `${count} ${filterResult}`,
    other: `${count} ${filterResults}`
  };

  itemCount.textContent = messages[pluralForm];

  const errorNoSavedItems = chrome.i18n.getMessage('errorNoSavedItems');
  const rightClickSave = chrome.i18n.getMessage('rightClickSave');

  if (texts.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <p>${errorNoSavedItems}</p>
        <p style="font-size: 12px; color: #999; margin-top: 8px;">
          ${rightClickSave}
        </p>
      </div>
    `;
    return;
  }

  // Items are already sorted by timestamp from the database query
  content.innerHTML = texts.map(item => {
    // Extract domain or website name from URL
    const urlObj = new URL(item.url);
    const domain = urlObj.hostname.replace('www.', '').split('.')[0];
    const siteName = domain.charAt(0).toUpperCase() + domain.slice(1);

    // Render differently based on type
    if (item.type === 'image' || item.type === 'video') {
      const isYouTube = item.type === 'video';
      const imageUrl = isYouTube ? item.imageUrl : item.imageUrl;
      const linkUrl = isYouTube ? item.videoUrl : item.imageUrl;

      return `
      <div class="text-item image-item${isYouTube ? ' youtube-item' : ''}">
        <div class="image-preview">
        <!--  <img src="${escapeHtml(imageUrl)}" alt="${isYouTube ? 'YouTube thumbnail' : 'Saved image'}" 
               onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">-->
          <div class="image-error" style="display:none;">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <span>${isYouTube ? 'Thumbnail unavailable' : 'Image unavailable'}</span>
          </div>
        </div>
        <div class="text-meta">

          <div class="page-img">
            <img width=30" height=30" src="${escapeHtml(imageUrl)}" alt="${isYouTube ? 'YouTube thumbnail' : 'Saved image'}" 
               onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          </div>

          <div class="page-info">
            <a href="${escapeHtml(item.url)}" class="page-title" target="_blank" title="${escapeHtml(item.pageTitle)}">
              ${escapeHtml(item.pageTitle || item.url)}
            </a>
            <div class="timestamp"><span class="site-name">${siteName}</span> | ${formatDate(item.timestamp)}</div> 
          </div>
          <div class="actions">
            <button class="btn-icon copy-btn" data-text="${escapeHtml(linkUrl)}" title="Copy URL">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </button>
            <button class="btn-icon open-image-btn" data-url="${escapeHtml(linkUrl)}" title="${isYouTube ? 'Open Video' : 'Open Image'}">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
            </button>
            <button class="btn-icon delete" data-id="${item.id}" title="Delete">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
      `;
    } else {
      // Text item
      return `
      <div class="text-item">
      <div class="text-meta">
        <div class="page-img">
            <div class="placeholder"></div> 
        </div>
        <div class="page-info">
          <a href="${escapeHtml(item.url)}" class="page-title" target="_blank" title="${escapeHtml(item.text)}">
          ${escapeHtml(item.text.length > 50 ? item.text.substring(0, 60) + '...' : item.text)}
          </a>
          <div class="timestamp">  <span class="site-name">${siteName}</span> | ${formatDate(item.timestamp)}</div> 
        </div>
        <div class="actions">
          <button class="btn-icon copy-btn" data-text="${escapeHtml(item.text)}" title="Copy">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          </button>
              <button class="btn-icon open-image-btn" data-url="${escapeHtml(item.url)}" title="Open URL">
             <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
          </button>
          <button class="btn-icon delete" data-id="${item.id}" title="Delete">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
          </button>
        </div>
        </div>
      </div>
      `;
    }
  }).join('');

  // Add event listeners
  document.querySelectorAll('.delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = parseInt(e.currentTarget.dataset.id);
      chrome.runtime.sendMessage({ action: "deleteText", id: id }, (response) => {
        if (response.success) {
          loadTexts();
        }
      });
    });
  });

  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const text = e.currentTarget.dataset.text;
      const button = e.currentTarget;

      try {
        // Add temporary class for visual feedback
        button.classList.add('copying');

        // Try to write to clipboard
        await navigator.clipboard.writeText(text);

        // Success feedback
        button.classList.remove('copying');
        button.classList.add('copied');

        // Reset after animation
        setTimeout(() => {
          button.classList.remove('copied');
        }, 1500);
      } catch (err) {
        console.error('Failed to copy:', err);

        // Error feedback
        button.classList.remove('copying');
        button.classList.add('copy-error');

        // Reset after animation
        setTimeout(() => {
          button.classList.remove('copy-error');
        }, 1500);

        // Fallback method
        try {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);

          // Show success even for fallback
          button.classList.add('copied');
          setTimeout(() => {
            button.classList.remove('copied');
          }, 1500);
        } catch (fallbackErr) {
          console.error('Fallback copy failed:', fallbackErr);
        }
      }
    });
  });

  document.querySelectorAll('.open-image-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const url = e.currentTarget.dataset.url;
      chrome.tabs.create({ url: url });
    });
  });
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load texts (limited to 5 most recent)
function loadTexts() {
  chrome.runtime.sendMessage({
    action: "getAllTexts"
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Runtime error:", chrome.runtime.lastError);
      return;
    }
    if (response && response.success) {
      const allItems = response.data;
      const totalCount = allItems.length;

      // Sort by timestamp (newest first) and limit to 5
      const sortedItems = allItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const limitedItems = sortedItems.slice(0, POPUP_ITEM_LIMIT);

      allTexts = limitedItems;
      renderTexts(limitedItems, totalCount);
    } else {
      console.error("Error loading texts:", response?.error || "No response");
    }
  });
}

// Search functionality (also limited to 5 results)
document.getElementById('searchInput').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  if (!query) {
    loadTexts(); // Reload the latest 5 items
    return;
  }

  // Get all texts and filter locally
  chrome.runtime.sendMessage({
    action: "getAllTexts"
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Runtime error:", chrome.runtime.lastError);
      return;
    }
    if (response && response.success) {
      const allItems = response.data;

      const filtered = allItems.filter(item => {
        const pageTitle = (item.pageTitle || '').toLowerCase();
        const url = item.url.toLowerCase();

        switch (item.type) {
          case 'video':
            return item.videoUrl.toLowerCase().includes(query) ||
              pageTitle.includes(query) ||
              url.includes(query);
          case 'image':
            return item.imageUrl.toLowerCase().includes(query) ||
              pageTitle.includes(query) ||
              url.includes(query);
          default: // text
            return item.text.toLowerCase().includes(query) ||
              pageTitle.includes(query) ||
              url.includes(query);
        }
      });

      const totalMatches = filtered.length;
      const sortedFiltered = filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const limitedResults = sortedFiltered.slice(0, POPUP_ITEM_LIMIT);

      renderTexts(limitedResults, totalMatches);
    } else {
      console.error("Error searching texts:", response?.error || "No response");
    }
  });
});

// View all handler
document.getElementById('viewAll').addEventListener('click', () => {
  chrome.tabs.create({ url: 'overview.html' });
});

// Initialize
loadTexts();

// Translate page content
function translatePage() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      // For option elements and other form elements, set textContent
      element.textContent = message;
    }
  });
}