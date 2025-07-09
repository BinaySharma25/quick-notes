let notes = []
let editingNoteId = null
let noteIdToDelete = null;
let searchQuery = '';
let inTrashView = false;

// Sanitize HTML to prevent XSS attacks
function sanitizeHTML(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function loadNotes() {
  const savedNotes = localStorage.getItem('quickNotes')
  return savedNotes ? JSON.parse(savedNotes) : []
}

function saveNote(event) {
  event.preventDefault()

  const title = document.getElementById('noteTitle').value.trim();
  const content = document.getElementById('noteContent').value.trim();
  const color = document.getElementById('noteColor').value || '#fff176';
  const now = new Date().toISOString();
  // If editing, preserve pin state
  let pinState = false;
  if(editingNoteId) {
    const noteToEdit = notes.find(note => note.id === editingNoteId);
    pinState = noteToEdit && noteToEdit.pinned;
  }

  if(editingNoteId) {
    // Update existing Note
    const noteIndex = notes.findIndex(note => note.id === editingNoteId)
    notes[noteIndex] = {
      ...notes[noteIndex],
      title: title,
      content: content,
      lastEditedAt: now,
      pinned: pinState,
      color: color
    }
  } else {
    // Add New Note
    notes.unshift({
      id: generateId(),
      title: title,
      content: content,
      createdAt: now,
      pinned: false,
      color: color
    })
  }

  closeNoteDialog()
  saveNotes()
  renderNotes()
}

function generateId() {
  return Date.now().toString()
}

function saveNotes() {
  localStorage.setItem('quickNotes', JSON.stringify(notes))
}

function deleteNote(noteId) {
  noteIdToDelete = noteId;
  document.getElementById('deleteConfirmDialog').showModal();
}

function confirmDelete() {
  if (noteIdToDelete) {
    // Soft delete: move to trash
    const noteIndex = notes.findIndex(note => note.id == noteIdToDelete);
    if (noteIndex !== -1) {
      notes[noteIndex].trashed = true;
      notes[noteIndex].pinned = false;
    }
    saveNotes();
    renderNotes();
    noteIdToDelete = null;
  }
  document.getElementById('deleteConfirmDialog').close();
}

function restoreNote(noteId) {
  const noteIndex = notes.findIndex(note => note.id == noteId);
  if (noteIndex !== -1) {
    notes[noteIndex].trashed = false;
    saveNotes();
    renderNotes();
  }
}

function deleteForeverNote(noteId) {
  notes = notes.filter(note => note.id != noteId);
  saveNotes();
  renderNotes();
}

function cancelDelete() {
  noteIdToDelete = null;
  document.getElementById('deleteConfirmDialog').close();
}

function renderNotes() {
  const notesContainer = document.getElementById('notesContainer');
  const trashHeading = document.getElementById('trashHeading');
  if (trashHeading) {
    trashHeading.style.display = inTrashView ? '' : 'none';
  }

  // Filter notes by search query and trash state
  let filteredNotes = notes.filter(note => inTrashView ? note.trashed : !note.trashed);
  if (searchQuery.trim() !== '') {
    const q = searchQuery.trim().toLowerCase();
    filteredNotes = filteredNotes.filter(note =>
      note.title.toLowerCase().includes(q) ||
      note.content.toLowerCase().includes(q)
    );
  }

  if(filteredNotes.length === 0) {
    notesContainer.innerHTML = `
      <div class="empty-state">
        <h2>${inTrashView ? 'Trash is empty' : 'No notes found'}</h2>
        <p>${inTrashView ? 'No deleted notes to show.' : 'Try a different search or create a new note!'}</p>
        ${inTrashView ? '' : '<button class="add-note-btn" onclick="openNoteDialog()">+ Add Note</button>'}
      </div>
    `
    return
  }

  // Sort: pinned notes first, then by createdAt desc (no pin in trash)
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (!inTrashView && a.pinned === b.pinned) {
      return (b.createdAt || 0).localeCompare(a.createdAt || 0);
    }
    if (!inTrashView) return b.pinned - a.pinned;
    return (b.createdAt || 0).localeCompare(a.createdAt || 0);
  });

  notesContainer.innerHTML = sortedNotes.map(note => {
    const createdAt = note.createdAt ? formatDate(note.createdAt) : '';
    const lastEditedAt = note.lastEditedAt ? formatDate(note.lastEditedAt) : '';
    const borderColor = note.color || '#fff176';
    if (inTrashView) {
      return `
        <div class="note-card" style="border-top: 8px solid ${borderColor}; opacity: 0.7;">
          <h3 class="note-title">${sanitizeHTML(note.title)}</h3>
          <p class="note-content">${sanitizeHTML(note.content)}</p>
          <div class="note-meta">
            <small>Created: ${createdAt}</small>
            ${lastEditedAt ? `<br><small>Edited: ${lastEditedAt}</small>` : ''}
          </div>
          <div class="note-actions">
            <button class="icon-btn restore-btn" onclick="restoreNote('${note.id}')" title="Restore Note" aria-label="Restore Note"><i class="fa-solid fa-rotate-left"></i></button>
            <button class="icon-btn delete-forever-btn" onclick="deleteForeverNote('${note.id}')" title="Delete Forever" aria-label="Delete Forever"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      `
    } else {
      return `
        <div class="note-card" style="border-top: 8px solid ${borderColor};">
          <h3 class="note-title">${sanitizeHTML(note.title)}</h3>
          <p class="note-content">${sanitizeHTML(note.content)}</p>
          <div class="note-meta">
            <small>Created: ${createdAt}</small>
            ${lastEditedAt ? `<br><small>Edited: ${lastEditedAt}</small>` : ''}
          </div>
          <div class="note-actions">
            <button class="pin-btn icon-btn" onclick="togglePin('${note.id}')" title="${note.pinned ? 'Unpin' : 'Pin'} Note" aria-label="${note.pinned ? 'Unpin' : 'Pin'} Note">
              <i class="fa-solid fa-thumbtack" style="${note.pinned ? '' : 'transform: rotate(45deg); color: #b0b3c0;'}"></i>
            </button>
            <button class="edit-btn icon-btn" onclick="openNoteDialog('${note.id}')" title="Edit Note" aria-label="Edit Note">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="delete-btn icon-btn" onclick="deleteNote('${note.id}')" title="Delete Note" aria-label="Delete Note">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `
    }
  }).join('')
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function openNoteDialog(noteId = null) {
  const dialog = document.getElementById('noteDialog');
  const titleInput = document.getElementById('noteTitle');
  const contentInput = document.getElementById('noteContent');
  const colorInput = document.getElementById('noteColor');

  if(noteId) {
    // Edit Mode
    const noteToEdit = notes.find(note => note.id === noteId)
    editingNoteId = noteId
    document.getElementById('dialogTitle').textContent = 'Edit Note'
    titleInput.value = noteToEdit.title
    contentInput.value = noteToEdit.content
    colorInput.value = noteToEdit.color || '#fff176';
    if (window._highlightSwatchOnDialog) window._highlightSwatchOnDialog(colorInput.value);
  }
  else {
    // Add Mode
    editingNoteId = null
    document.getElementById('dialogTitle').textContent = 'Add New Note'
    titleInput.value = ''
    contentInput.value = ''
    colorInput.value = '#fff176';
    if (window._highlightSwatchOnDialog) window._highlightSwatchOnDialog(colorInput.value);
  }

  dialog.showModal()
  titleInput.focus()

}

function closeNoteDialog() {
  document.getElementById('noteDialog').close()
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme')
  localStorage.setItem('theme', isDark ? 'dark' : 'light')
  document.getElementById('themeToggleBtn').textContent = isDark ? '☀️' : '🌙'
}

function applyStoredTheme() {
  if(localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme')
    document.getElementById('themeToggleBtn').textContent = '☀️'
  }
}

function togglePin(noteId) {
  const noteIndex = notes.findIndex(note => note.id === noteId);
  if (noteIndex !== -1) {
    notes[noteIndex].pinned = !notes[noteIndex].pinned;
    saveNotes();
    renderNotes();
  }
}

document.addEventListener('DOMContentLoaded', function() {
  applyStoredTheme()
  notes = loadNotes()
  renderNotes()

  document.getElementById('noteForm').addEventListener('submit', saveNote)
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme)
  document.getElementById('searchInput').addEventListener('input', function(e) {
    searchQuery = e.target.value;
    renderNotes();
  });

  document.getElementById('noteDialog').addEventListener('click', function(event) {
    if(event.target === this) {
      closeNoteDialog()
    }
  })

  document.getElementById('deleteConfirmDialog').addEventListener('click', function(event) {
    if(event.target === this) {
      cancelDelete();
    }
  });

  // Color picker and swatch sync logic
  const colorInput = document.getElementById('noteColor');
  const swatchContainer = document.getElementById('presetColors');
  const swatches = swatchContainer.querySelectorAll('.color-swatch');

  function highlightSwatch(color) {
    swatches.forEach(btn => {
      if (btn.getAttribute('data-color').toLowerCase() === color.toLowerCase()) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }

  swatches.forEach(btn => {
    btn.addEventListener('click', function() {
      const color = btn.getAttribute('data-color');
      colorInput.value = color;
      highlightSwatch(color);
    });
  });

  colorInput.addEventListener('input', function() {
    highlightSwatch(colorInput.value);
  });

  // When dialog opens, highlight correct swatch
  window._highlightSwatchOnDialog = function(color) {
    highlightSwatch(color);
  }

  document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
  document.getElementById('cancelDeleteBtn').addEventListener('click', cancelDelete);

  const trashFab = document.getElementById('trashFab');
  const trashIcon = trashFab.querySelector('i');
  trashFab.addEventListener('click', function() {
    inTrashView = !inTrashView;
    if (inTrashView) {
      trashIcon.className = 'fa-solid fa-arrow-left';
      trashFab.title = 'Back to Notes';
    } else {
      trashIcon.className = 'fa-solid fa-trash';
      trashFab.title = 'View Trash';
    }
    renderNotes();
  });
})