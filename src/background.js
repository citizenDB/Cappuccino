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

// Initialize IndexedDB
let db = null;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("Cappuccino", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains("savedItems")) {
        const objectStore = database.createObjectStore("savedItems", {
          keyPath: "id",
          autoIncrement: true
        });
        objectStore.createIndex("timestamp", "timestamp", { unique: false });
        objectStore.createIndex("url", "url", { unique: false });
      }

      if (!database.objectStoreNames.contains("settings")) {
        const settings = database.createObjectStore("settings");
        settings.createIndex("lang", "lang", { unique: false });
        settings.createIndex("appearance", "appearance", { unique: false });
      }

      // save default settings
      const locale = chrome.i18n.getUILanguage();
      saveSettings(locale, 'light');

    };
  });
}


// Save settings to DB
async function saveSettings(lang, appearance) {
  const database = await initDB();

  const tx = database.transaction("settings", "readwrite");
  const store = tx.objectStore("settings");
  store.put({ lang, appearance }, 0);

  await tx.complete;
}

// Initialize DB when extension loads
initDB();

// Helper function to extract YouTube video ID from URL
function getYouTubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Helper function to check if an image URL exists
async function checkImageExists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

// Helper function to get YouTube thumbnail URL
async function getYouTubeThumbnail(videoId) {
  // Try thumbnails in order of quality
  const qualities = [
    'maxresdefault.jpg',  // 1920x1080
    'sddefault.jpg',      // 640x480
    'hqdefault.jpg',      // 480x360
    'mqdefault.jpg',      // 320x180
    'default.jpg'         // 120x90
  ];

  for (const quality of qualities) {
    const url = `https://img.youtube.com/vi/${videoId}/${quality}`;
    if (await checkImageExists(url)) {
      return url;
    }
  }
  
  // If all failed, return the default one anyway
  return `https://img.youtube.com/vi/${videoId}/default.jpg`;
}

// Helper function to check if URL is a YouTube video page
function isYouTubeVideo(url) {
  return url && (
    url.includes('youtube.com/watch') || 
    url.includes('youtu.be/') ||
    url.includes('youtube.com/shorts/')
  );
}

// Recreate action context menus on startup
chrome.runtime.onStartup.addListener(async () => {
    await createActionContextMenus();
});

// Create context menus when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  createActionContextMenus();
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "saveText" && info.selectionText) {
    try {
      if (!db) await initDB();

      // Save to IndexedDB
      const transaction = db.transaction(["savedItems"], "readwrite");
      const objectStore = transaction.objectStore("savedItems");

      const data = {
        text: info.selectionText,
        type: "text",
        url: tab.url,
        pageTitle: tab.title,
        timestamp: new Date().toISOString()
      };

      objectStore.add(data);

      transaction.oncomplete = async () => {
        // Show success feedback
        chrome.action.setBadgeText({ text: "✓", tabId: tab.id });
        chrome.action.setBadgeBackgroundColor({ color: "#4CAF50", tabId: tab.id });

        // Try to send message to content script with error handling
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: "showNotification",
            message: chrome.i18n.getMessage("saveVideoSuccess"),
          }).catch(() => {
            console.log("Content script not available for notification");
          });
        } catch (error) {
          console.log("Could not send notification to content script");
        }

        // Clear badge after 2 seconds
        setTimeout(() => {
          chrome.action.setBadgeText({ text: "", tabId: tab.id });
        }, 2000);
      };

      transaction.onerror = () => {
        console.error("Transaction error:", transaction.error);
        chrome.tabs.sendMessage(tab.id, {
          action: "showNotification",
          message: chrome.i18n.getMessage("saveTextError"),
          isError: true
        }).catch(() => {
          console.log("Content script not available for error notification");
        });
      };

    } catch (error) {
      console.error("Error saving text:", error);
      chrome.tabs.sendMessage(tab.id, {
        action: "showNotification",
        message: chrome.i18n.getMessage("saveTextError"),
        isError: true
      }).catch(() => {
        console.log("Content script not available for error notification");
      });
    }
  }
  
  if (info.menuItemId === "saveImage" && info.srcUrl) {
    try {
      if (!db) await initDB();

      // Check if this is a YouTube video page
      if (isYouTubeVideo(tab.url)) {
        const videoId = getYouTubeVideoId(tab.url);
        if (videoId) {
          const thumbnailUrl = await getYouTubeThumbnail(videoId);
          const data = {
            imageUrl: thumbnailUrl,
            videoUrl: tab.url,
            videoId: videoId,
            type: "video",
            url: tab.url,
            pageTitle: tab.title,
            timestamp: new Date().toISOString()
          };

          const transaction = db.transaction(["savedItems"], "readwrite");
          const objectStore = transaction.objectStore("savedItems");
          objectStore.add(data);

          transaction.oncomplete = async () => {
            chrome.action.setBadgeText({ text: "✓", tabId: tab.id });
            chrome.action.setBadgeBackgroundColor({ color: "#4CAF50", tabId: tab.id });

            try {
              await chrome.tabs.sendMessage(tab.id, {
                action: "showNotification",
                message: chrome.i18n.getMessage("saveVideoSuccess"),
              }).catch(() => {
                console.log("Content script not available for notification");
              });
            } catch (error) {
              console.log("Could not send notification to content script");
            }

            setTimeout(() => {
              chrome.action.setBadgeText({ text: "", tabId: tab.id });
            }, 2000);
          };

          transaction.onerror = () => {
            console.error("Transaction error:", transaction.error);
            chrome.tabs.sendMessage(tab.id, {
              action: "showNotification",
              message: chrome.i18n.getMessage("saveVideoError"),
              isError: true
            }).catch(() => {
              console.log("Content script not available for error notification");
            });
          };

          return; // Exit early after handling YouTube video
        }
      }

      // Regular image saving
      const transaction = db.transaction(["savedItems"], "readwrite");
      const objectStore = transaction.objectStore("savedItems");

      const data = {
        imageUrl: info.srcUrl,
        type: "image",
        url: tab.url,
        pageTitle: tab.title,
        timestamp: new Date().toISOString()
      };

      objectStore.add(data);

      transaction.oncomplete = async () => {
        chrome.action.setBadgeText({ text: "✓", tabId: tab.id });
        chrome.action.setBadgeBackgroundColor({ color: "#4CAF50", tabId: tab.id });

        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: "showNotification",
            message: chrome.i18n.getMessage("saveImageSuccess"),
          }).catch(() => {
            console.log("Content script not available for notification");
          });
        } catch (error) {
          console.log("Could not send notification to content script");
        }

        setTimeout(() => {
          chrome.action.setBadgeText({ text: "", tabId: tab.id });
        }, 2000);
      };

      transaction.onerror = () => {
        console.error("Transaction error:", transaction.error);
        chrome.tabs.sendMessage(tab.id, {
          action: "showNotification",
          message: chrome.i18n.getMessage("saveImageError"),
          isError: true
        }).catch(() => {
          console.log("Content script not available for error notification");
        });
      };

    } catch (error) {
      console.error("Error saving image URL:", error);
      chrome.tabs.sendMessage(tab.id, {
        action: "showNotification",
        message: chrome.i18n.getMessage("saveImageError"),
        isError: true
      }).catch(() => {
        console.log("Content script not available for error notification");
      });
    }
  }
  
  // Handle YouTube video saving from context menu
  if (info.menuItemId === "saveYouTubeVideo") {
    try {
      if (!db) await initDB();

      const videoId = getYouTubeVideoId(tab.url);
      if (!videoId) {
        console.error("Could not extract YouTube video ID");
        return;
      }

      // Await the thumbnail URL since it's async
      const thumbnailUrl = await getYouTubeThumbnail(videoId);

      const transaction = db.transaction(["savedItems"], "readwrite");
      const objectStore = transaction.objectStore("savedItems");

      const data = {
        imageUrl: thumbnailUrl,
        videoUrl: tab.url,
        videoId: videoId,
        type: "video",
        url: tab.url,
        pageTitle: tab.title,
        timestamp: new Date().toISOString()
      };

      objectStore.add(data);

      transaction.oncomplete = async () => {
        chrome.action.setBadgeText({ text: "✓", tabId: tab.id });
        chrome.action.setBadgeBackgroundColor({ color: "#4CAF50", tabId: tab.id });

        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: "showNotification",
            message: chrome.i18n.getMessage("saveVideoSuccess"),
          }).catch(() => {
            console.log("Content script not available for notification");
          });
        } catch (error) {
          console.log("Could not send notification to content script");
        }

        setTimeout(() => {
          chrome.action.setBadgeText({ text: "", tabId: tab.id });
        }, 2000);
      };

      transaction.onerror = () => {
        console.error("Transaction error:", transaction.error);
        chrome.tabs.sendMessage(tab.id, {
          action: "showNotification",
          message: chrome.i18n.getMessage("saveVideoError"),
          isError: true
        }).catch(() => {
          console.log("Content script not available for error notification");
        });
      };

    } catch (error) {
      console.error("Error saving YouTube video:", error);
      chrome.tabs.sendMessage(tab.id, {
        action: "showNotification",
        message: chrome.i18n.getMessage("saveVideoError"),
        isError: true
      }).catch(() => {
        console.log("Content script not available for error notification");
      });
    }
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getAllTexts") {
    if (!db) {
      initDB().then(() => getAllTexts(sendResponse));
    } else {
      getAllTexts(sendResponse);
    }
    return true;
  }

  if (request.action === "deleteText") {
    if (!db) {
      initDB().then(() => deleteText(request.id, sendResponse));
    } else {
      deleteText(request.id, sendResponse);
    }
    return true;
  }

  if (request.action === "clearAll") {
    if (!db) {
      initDB().then(() => clearAll(sendResponse));
    } else {
      clearAll(sendResponse);
    }
    return true;
  }

if (request.action === 'saveTheme') {
  initDB().then(database => {
    const tx = database.transaction("settings", "readwrite");
    const store = tx.objectStore("settings");

    const getRequest = store.get(0);

    getRequest.onsuccess = () => {
      const existingSettings = getRequest.result || {};

      const putRequest = store.put({
        lang: existingSettings.lang || 'en',
        appearance: request.theme
      }, 0);

      putRequest.onsuccess = () => {
        sendResponse({ success: true });
      };

      putRequest.onerror = () => {
        console.error('Error saving settings:', putRequest.error);
        sendResponse({ success: false, error: putRequest.error });
      };
    };

    getRequest.onerror = () => {
      console.error('Error getting settings:', getRequest.error);
      sendResponse({ success: false, error: getRequest.error });
    };
  }).catch(error => {
    console.error('Error initializing DB:', error);
    sendResponse({ success: false, error: error });
  });

  return true;
}

  if (request.action === 'getTheme') {
    initDB().then(database => {
      const tx = database.transaction("settings", "readonly");
      const store = tx.objectStore("settings");
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const settings = getAllRequest.result;
        const theme = settings[0]?.appearance || 'light';
        sendResponse({ theme: theme });
      };
      
      getAllRequest.onerror = () => {
        console.error('Error getting theme:', getAllRequest.error);
        sendResponse({ theme: 'light' });
      };
    });
    
    return true; 
  }

  // Export to CSV handler
  if (request.action === "exportToCSV") {
    if (!db) {
      initDB().then(() => exportToCSV(sendResponse));
    } else {
      exportToCSV(sendResponse);
    }
    return true;
  }

});

function getAllTexts(sendResponse) {
  const transaction = db.transaction(["savedItems"], "readonly");
  const objectStore = transaction.objectStore("savedItems");
  const request = objectStore.getAll();

  request.onsuccess = () => {
    sendResponse({ success: true, data: request.result });
  };

  request.onerror = () => {
    sendResponse({ success: false, error: request.error });
  };
}

function deleteText(id, sendResponse) {
  const transaction = db.transaction(["savedItems"], "readwrite");
  const objectStore = transaction.objectStore("savedItems");
  const request = objectStore.delete(id);

  request.onsuccess = () => {
    sendResponse({ success: true });
  };

  request.onerror = () => {
    sendResponse({ success: false, error: request.error });
  };
}

function clearAll(sendResponse) {
  const transaction = db.transaction(["savedItems"], "readwrite");
  const objectStore = transaction.objectStore("savedItems");
  const request = objectStore.clear();

  request.onsuccess = () => {
    sendResponse({ success: true });
  };

  request.onerror = () => {
    sendResponse({ success: false, error: request.error });
  };
}

// Remove and recreate context menus for extension action button
async function removeAllContextMenus() {
    return new Promise((resolve) => {
        chrome.contextMenus.removeAll(() => {
            resolve();
        });
    });
}

// Create context menus for extension actions
async function createActionContextMenus() {
    await removeAllContextMenus();
    
    chrome.contextMenus.create({
      id: "saveText",
      title: "Cappucino - " + chrome.i18n.getMessage("saveSelectedText"),
      contexts: ["selection"]
    });
    
    chrome.contextMenus.create({
      id: "saveImage",
      title: "Cappucino - " + chrome.i18n.getMessage("saveImageUrl"),
      contexts: ["image"]
    });
    
    chrome.contextMenus.create({
      id: "saveYouTubeVideo",
      title: "Cappucino - " + chrome.i18n.getMessage("saveYouTubeVideo"),
      contexts: ["page", "link", "video"],
      documentUrlPatterns: ["*://*.youtube.com/*", "*://*.youtu.be/*"]
    });

    chrome.contextMenus.create({
        id: "github",
        title: "🌐 GitHub",
        contexts: ["action"]
    });

    chrome.contextMenus.create({
        id: "donate",
        title: "🧋 " + chrome.i18n.getMessage("buyMeACappuccino"),
        contexts: ["action"]
    });

    chrome.contextMenus.create({
        id: "review",
        title: "⭐ " + chrome.i18n.getMessage("leaveReview"),
        contexts: ["action"]
    });
}

// Handle action context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    switch (info.menuItemId) {
        case "github":
            chrome.tabs.create({ url: 'https://github.com/citizenDB/Cappuccino' });
            break;
        case "donate":
            chrome.tabs.create({ url: 'https://buymeacoffee.com/citizenDB' });
            break;
        case "review":
            chrome.tabs.create({ url: `https://microsoftedge.microsoft.com/addons/detail/cappuccino/hflhjjnblgkeekddnfnhmkakbopgbemf` });
            break;
    }
});

// Export saved items to CSV
function exportToCSV(sendResponse) {
  const transaction = db.transaction(["savedItems"], "readonly");
  const objectStore = transaction.objectStore("savedItems");
  const request = objectStore.getAll();

  request.onsuccess = () => {
    const items = request.result;
    
    const headers = ['ID', 'Type', 'Content', 'Page Title', 'URL', 'Timestamp'];
    
    const rows = items.map(item => {
      const content = item.type === 'text' 
        ? item.text 
        : item.type === 'video' 
          ? item.videoUrl 
          : item.imageUrl;
      
      return [
        item.id,
        item.type,
        `"${(content || '').replace(/"/g, '""')}"`,
        `"${(item.pageTitle || '').replace(/"/g, '""')}"`,
        item.url,
        item.timestamp
      ].join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    
    sendResponse({ success: true, csv: csv });
  };

  request.onerror = () => {
    sendResponse({ success: false, error: request.error });
  };
}