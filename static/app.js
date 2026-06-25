document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let updates = [];
  let selectedUpdateId = null;
  let activeFilter = 'all';
  let searchQuery = '';

  // DOM Elements
  const refreshBtn = document.getElementById('refresh-btn');
  const searchInput = document.getElementById('search-input');
  const filterChips = document.querySelectorAll('.chip');
  const updatesList = document.getElementById('updates-list');
  const lastFetchedTime = document.getElementById('last-fetched-time');
  
  // Sidebar elements
  const emptyState = document.getElementById('empty-state');
  const workspaceActive = document.getElementById('workspace-active');
  const detailBadge = document.getElementById('detail-badge');
  const detailDate = document.getElementById('detail-date');
  const detailBody = document.getElementById('detail-body');
  const detailLink = document.getElementById('detail-link');
  
  // Tweet Composer elements
  const tweetTextarea = document.getElementById('tweet-textarea');
  const charCount = document.getElementById('char-count');
  const tweetBtn = document.getElementById('tweet-btn');
  
  // Stats elements
  const statTotal = document.getElementById('stat-total');
  const statFeatures = document.getElementById('stat-features');
  const statChanges = document.getElementById('stat-changes');
  const statBreaking = document.getElementById('stat-breaking');
  
  // Toast Notification
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');

  // Fetch release notes from Flask API
  async function fetchReleaseNotes(forceRefresh = false) {
    setLoadingState(true);
    try {
      const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      
      if (result.status === 'error') {
        throw new Error(result.message);
      }
      
      updates = result.updates || [];
      
      // Update fetch timestamp
      if (result.last_fetched) {
        const time = new Date(result.last_fetched);
        lastFetchedTime.textContent = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      
      if (result.status === 'warning') {
        showToast(result.message, 'warning');
      } else if (forceRefresh) {
        showToast('Release notes successfully refreshed!', 'success');
      }
      
      renderStats();
      renderFeed();
      
      // Auto-select first item if available
      if (updates.length > 0) {
        selectUpdate(updates[0].id);
      } else {
        clearSelection();
      }
    } catch (error) {
      console.error('Fetch error:', error);
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      setLoadingState(false);
    }
  }

  // Set loading state on refresh button
  function setLoadingState(isLoading) {
    if (isLoading) {
      refreshBtn.classList.add('loading');
      refreshBtn.disabled = true;
    } else {
      refreshBtn.classList.remove('loading');
      refreshBtn.disabled = false;
    }
  }

  // Show status toasts
  function showToast(message, type = 'error') {
    toastText.textContent = message;
    toast.className = 'toast'; // reset
    if (type === 'success') {
      toast.classList.add('toast-success');
    }
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  // Calculate and render stats in the sidebar
  function renderStats() {
    statTotal.textContent = updates.length;
    statFeatures.textContent = updates.filter(u => u.type === 'Feature').length;
    statChanges.textContent = updates.filter(u => u.type === 'Change').length;
    statBreaking.textContent = updates.filter(u => u.type === 'Breaking').length;
  }

  // Render updates list feed
  function renderFeed() {
    updatesList.innerHTML = '';
    
    // Filter updates
    const filteredUpdates = updates.filter(update => {
      const matchesFilter = activeFilter === 'all' || update.type === activeFilter;
      const matchesSearch = update.raw_text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            update.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            update.date.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });

    if (filteredUpdates.length === 0) {
      updatesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <p>No release notes found matching your criteria.</p>
        </div>
      `;
      return;
    }

    filteredUpdates.forEach(update => {
      const card = document.createElement('div');
      card.className = `update-card ${selectedUpdateId === update.id ? 'selected' : ''}`;
      card.setAttribute('data-id', update.id);
      card.setAttribute('data-type', update.type);
      
      const badgeClass = getBadgeClass(update.type);
      
      card.innerHTML = `
        <div class="card-header">
          <span class="date-text">${update.date}</span>
          <span class="badge ${badgeClass}">${update.type}</span>
        </div>
        <div class="card-title-preview">${update.raw_text}</div>
      `;
      
      card.addEventListener('click', () => {
        selectUpdate(update.id);
      });
      
      updatesList.appendChild(card);
    });
  }

  // Map update types to CSS classes
  function getBadgeClass(type) {
    switch (type) {
      case 'Feature': return 'badge-feature';
      case 'Change': return 'badge-change';
      case 'Breaking': return 'badge-breaking';
      case 'Issue': return 'badge-issue';
      case 'Announcement': return 'badge-announcement';
      default: return 'badge-update';
    }
  }

  // Select a specific release note card
  function selectUpdate(id) {
    selectedUpdateId = id;
    
    // Toggle active classes in DOM list
    document.querySelectorAll('.update-card').forEach(card => {
      if (card.getAttribute('data-id') === id) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });

    const update = updates.find(u => u.id === id);
    if (!update) return;

    // Show details pane in sidebar
    emptyState.style.display = 'none';
    workspaceActive.style.display = 'flex';

    // Populate details
    detailBadge.className = `badge ${getBadgeClass(update.type)}`;
    detailBadge.textContent = update.type;
    detailDate.textContent = update.date;
    detailBody.innerHTML = update.content_html;
    detailLink.href = update.link;

    // Set up tweet template
    setupTweetComposer(update);
  }

  // Deselect / Clear detailed panel
  function clearSelection() {
    selectedUpdateId = null;
    emptyState.style.display = 'flex';
    workspaceActive.style.display = 'none';
    
    document.querySelectorAll('.update-card').forEach(card => {
      card.classList.remove('selected');
    });
  }

  // Format draft for Twitter
  function setupTweetComposer(update) {
    const prefix = `BigQuery [${update.date}] ${update.type.toUpperCase()}: `;
    const hashtags = " #GCP #BigQuery";
    
    // URL limit: Twitter counts any URL as 23 characters
    // Max text length = 280 limit - 23 (for URL) - 1 (for space) = 256 characters.
    const maxTextLen = 256 - prefix.length - hashtags.length;
    
    let textBody = update.raw_text;
    if (textBody.length > maxTextLen) {
      textBody = textBody.substring(0, maxTextLen - 3) + "...";
    }
    
    const draftText = `${prefix}${textBody}${hashtags}`;
    
    tweetTextarea.value = draftText;
    updateCharCount();
  }

  // Calculate remaining characters for Twitter limit
  function updateCharCount() {
    const text = tweetTextarea.value;
    
    // Note: Twitter's URL count is handled by treating it as 23 chars, 
    // but here we just count characters in the textarea and warn/disable.
    // If the user wants to add their own links, we keep the limit at 250 characters.
    const len = text.length;
    // We append the URL outside this input when clicking the Tweet button, 
    // or let it be part of the text. Let's make sure the text input doesn't exceed 250 characters,
    // since the URL is appended at the end of the text.
    const limit = 250;
    const remaining = limit - len;
    
    charCount.textContent = `${len}/${limit}`;
    
    if (remaining < 0) {
      charCount.className = 'char-counter danger';
      tweetBtn.disabled = true;
    } else if (remaining < 30) {
      charCount.className = 'char-counter warning';
      tweetBtn.disabled = false;
    } else {
      charCount.className = 'char-counter';
      tweetBtn.disabled = false;
    }
    
    if (len === 0) {
      tweetBtn.disabled = true;
    }
  }

  // Event Listeners
  refreshBtn.addEventListener('click', () => {
    fetchReleaseNotes(true);
  });

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderFeed();
  });

  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.getAttribute('data-type');
      renderFeed();
    });
  });

  tweetTextarea.addEventListener('input', updateCharCount);

  tweetBtn.addEventListener('click', () => {
    const update = updates.find(u => u.id === selectedUpdateId);
    if (!update) return;
    
    const tweetText = encodeURIComponent(tweetTextarea.value);
    const tweetUrl = encodeURIComponent(update.link);
    
    const xUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${tweetUrl}`;
    window.open(xUrl, '_blank');
  });

  // Init
  fetchReleaseNotes();
});
