let allTexts = [];
let currentSearchQuery = '';
let currentDomain = '';
let currentCategory = 'all';
let startDate = null;
let endDate = null;

// Get all texts from extension
chrome.runtime.sendMessage({ action: "getAllTexts" }, (response) => {
    if (response.success) {
        allTexts = response.data;
        updateDomainFilter();
        updateStats();
        renderTexts(filterTexts());
    }
});

// i18n initialization
document.addEventListener('DOMContentLoaded', function() {
    const extensionName = chrome.i18n.getMessage('extensionName');
    const clearDates = chrome.i18n.getMessage('clearDates');
     document.getElementById('searchInput').placeholder = chrome.i18n.getMessage('searchPlaceholder');
     
    translatePage();
    loadSavedTheme();

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
       themeToggle.addEventListener('click', toggleTheme);
    }

    const authorURL = "<a href='https://www.github.com/citizenDB/Cappucino' target='_blank'>CitizenDB</a>";
    const footerElement = document.querySelector('[data-i18n="footer"]');
    footerElement.innerHTML = chrome.i18n.getMessage("footer", [authorURL]);

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
    themeLink.href = 'css/theme_dark.css';
    document.body.classList.add('dark-theme');
    moonIcon.style.display = 'none';
    sunIcon.style.display = 'block';
  } else {
    themeLink.href = 'css/theme_light.css';
    document.body.classList.remove('dark-theme');
    moonIcon.style.display = 'block';
    sunIcon.style.display = 'none';
  }
}

// Toggle theme and save preference
async function toggleTheme() {
  const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';

  applyTheme(newTheme);
  
  try {
    await chrome.runtime.sendMessage({
      action: 'saveTheme',
      theme: newTheme
    });
    //console.log('Theme saved successfully:', newTheme);
  } catch (error) {
    console.error('Error saving theme:', error);
  }
}

function updateDomainFilter() {
    const domains = [...new Set(allTexts.map(item => {
        const url = new URL(item.url);
        return url.hostname.replace('www.', '');
    }))].sort();

    const allWebsites = chrome.i18n.getMessage('allWebsites');
    const select = document.getElementById('domainFilter');

    select.innerHTML = `<option value="">${allWebsites}</option>` + 
        domains.map(domain => `<option value="${domain}">${domain}</option>`).join('');
}

function updateStats() {
    const textCount = allTexts.filter(item => item.type !== 'image' && item.type !== 'video').length;
    const imageCount = allTexts.filter(item => item.type === 'image').length;
    const videoCount = allTexts.filter(item => item.type === 'video').length;

    const documentCount = allTexts.filter(item => {
        const url = item.pageTitle.toLowerCase();
        return url.endsWith('.pdf') || 
               url.endsWith('.doc') || 
               url.endsWith('.docx') ||
               url.endsWith('.xls') ||
               url.endsWith('.xlsx') ||
               url.endsWith('.ppt') ||
               url.endsWith('.pptx');
    }).length;
    
    document.getElementById('textCount').textContent = ' (' + textCount + ')';
    document.getElementById('imageCount').textContent = ' (' + imageCount + ')';
    document.getElementById('videoCount').textContent = ' (' + videoCount + ')';
    document.getElementById('totalCount').textContent = '(' + allTexts.length + ')';
}

function filterTexts() {
    return allTexts.filter(item => {
        // Category filter
        if (currentCategory === 'text' && (item.type === 'image' || item.type === 'video')) return false;
        if (currentCategory === 'image' && item.type !== 'image') return false;
        if (currentCategory === 'video' && item.type !== 'video') return false;

        // Search filter
     const searchText = 
    item.type === 'image' ? item.imageUrl : 
    item.type === 'video' ? (item.videoTitle || item.url) : 
    item.text;

const matchesSearch = !currentSearchQuery || 
    searchText.toLowerCase().includes(currentSearchQuery) ||
    (item.pageTitle && item.pageTitle.toLowerCase().includes(currentSearchQuery)) ||
    item.url.toLowerCase().includes(currentSearchQuery);

        // Domain filter
        const matchesDomain = !currentDomain || 
            new URL(item.url).hostname.replace('www.', '') === currentDomain;

        // Date filter
        let matchesDate = true;
        if (startDate || endDate) {
            const itemDate = new Date(item.timestamp);
            itemDate.setHours(0, 0, 0, 0); // Reset time for date comparison
            
            if (startDate && endDate) {
                matchesDate = itemDate >= startDate && itemDate <= endDate;
            } else if (startDate) {
                matchesDate = itemDate >= startDate;
            } else if (endDate) {
                matchesDate = itemDate <= endDate;
            }
        }

        return matchesSearch && matchesDomain && matchesDate;
    });
}

// Update search functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.toLowerCase();
    renderTexts(filterTexts());
});

// Add domain filter functionality
document.getElementById('domainFilter').addEventListener('change', (e) => {
    currentDomain = e.target.value;
    renderTexts(filterTexts());
});

// Category filter functionality
document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentCategory = e.currentTarget.dataset.category;
        renderTexts(filterTexts());
    });
});

// Date filter functionality
document.getElementById('startDate').addEventListener('change', (e) => {
    if (e.target.value) {
        startDate = new Date(e.target.value);
        startDate.setHours(0, 0, 0, 0);
    } else {
        startDate = null;
    }
    renderTexts(filterTexts());
});

document.getElementById('endDate').addEventListener('change', (e) => {
    if (e.target.value) {
        endDate = new Date(e.target.value);
        endDate.setHours(23, 59, 59, 999);
    } else {
        endDate = null;
    }
    renderTexts(filterTexts());
});

// Clear date filters
// document.getElementById('clearDates').addEventListener('click', () => {
//     document.getElementById('startDate').value = '';
//     document.getElementById('endDate').value = '';
//     startDate = null;
//     endDate = null;
//     renderTexts(filterTexts());
// });

function renderTexts(texts) {
    const content = document.getElementById("content");
    const resultsCount = document.getElementById('resultsCount');

    const errorNoItems = chrome.i18n.getMessage('errorNoItems');
    const errorAdjustFilters = chrome.i18n.getMessage('errorAdjustFilters');
    const copyItem = chrome.i18n.getMessage('copyItem');
    const deleteItem = chrome.i18n.getMessage('deleteItem');
    const openVideo = chrome.i18n.getMessage('openVideo');
    const openImage = chrome.i18n.getMessage('openImage');
    const filterResult = chrome.i18n.getMessage('filterResult');
    const filterResults = chrome.i18n.getMessage('filterResults');

    const count = texts.length;
    const pr = new Intl.PluralRules(navigator.language);
    const pluralForm = pr.select(count);

    const messages = {
    one: `${count} ${filterResult}`,
    other: `${count} ${filterResults}`
    };

    resultsCount.textContent = messages[pluralForm];


    //resultsCount.textContent = `${texts.length} result${texts.length !== 1 ? 's' : ''}`;
    
    if (texts.length === 0) {
        content.innerHTML = `
            <div class="no-items">
                <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin: 0 auto 20px;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p style="font-size: 18px; margin: 0;">${errorNoItems}</p>
                <p style="font-size: 14px; margin-top: 8px;">${errorAdjustFilters}</p>
            </div>
        `;
        return;
    }
    
    // Sort by timestamp (newest first)
    texts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    content.innerHTML = texts.map(item => {
        // Extract hostname from URL
        const url = new URL(item.url);
        const domain = url.hostname.replace('www.', '').split('.')[0];
        const siteName = domain.charAt(0).toUpperCase() + domain.slice(1);

        // Render differently based on type
        if (item.type === 'image' || item.type === 'video') {
            const isYouTube = item.type === 'video';
            const imageUrl = isYouTube ? item.imageUrl : item.imageUrl;
            const linkUrl = isYouTube ? item.videoUrl : item.imageUrl;
            
            return `
            <div class="text-item image-item${isYouTube ? ' youtube-item' : ''}">
                <div class="image-preview">
                    <img src="${escapeHtml(imageUrl)}" alt="${isYouTube ? 'YouTube thumbnail' : 'Saved image'}" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="image-error" style="display:none;">
                        <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        <span>${isYouTube ? 'Thumbnail unavailable' : 'Image unavailable'}</span>
                    </div>
                </div>
                <div class="text-meta">
                    <div class="page-info">
                        <a href="${escapeHtml(item.url)}" class="page-title" target="_blank" title="${escapeHtml(item.pageTitle)}">
                            ${escapeHtml(item.pageTitle || item.url)}
                        </a>
                        <div class="timestamp">
                            <span class="site-name">${siteName}</span> | ${new Date(item.timestamp).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                            })}
                        </div> 
                    </div>
                    <div class="actions">
                        <button class="btn-icon copy-btn" data-text="${escapeHtml(linkUrl)}" title="${copyItem} URL">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon open-image-btn" data-url="${escapeHtml(linkUrl)}" title="${isYouTube ? openVideo : openImage}">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                            </svg>
                        </button>
                        <button class="btn-icon delete" data-id="${item.id}" title="${deleteItem}">
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
                <div class="text-content">${escapeHtml(item.text)}</div>
                <div class="text-meta">
                    <div class="page-info">
                        <a href="${escapeHtml(item.url)}" class="page-title" target="_blank" title="${escapeHtml(item.pageTitle)}">
                            ${escapeHtml(item.pageTitle || item.url)}
                        </a>
                        <div class="timestamp">
                            <span class="site-name">${siteName}</span> | ${new Date(item.timestamp).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                            })}
                        </div> 
                    </div>
                    <div class="actions">
                        <button class="btn-icon copy-btn" data-text="${escapeHtml(item.text)}" title="${copyItem}">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon delete" data-id="${item.id}" title="${deleteItem}">
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

    // Add event listeners for buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const text = e.currentTarget.dataset.text;
            try {
                await navigator.clipboard.writeText(text);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    });

    document.querySelectorAll('.open-image-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = e.currentTarget.dataset.url;
            window.open(url, '_blank');
        });
    });

    document.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = parseInt(e.currentTarget.dataset.id);

            const confirmDelete = chrome.i18n.getMessage('confirmDelete');

            if (confirm(`${confirmDelete}`)) {
                chrome.runtime.sendMessage({ action: "deleteText", id: id }, (response) => {
                    if (response.success) {
                        allTexts = allTexts.filter(item => item.id !== id);
                        updateDomainFilter();
                        updateStats();
                        renderTexts(filterTexts());
                    }
                });
            }
        });
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Translate page content
function translatePage() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      element.textContent = message;
    }
  });
}
