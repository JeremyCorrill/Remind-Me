// MINIMAL WORKING VERSION - Copy this entire file to js/index.js

console.log('=== INDEX.JS LOADING ===');

// Global State
let reminders = [];
let completedToday = [];
let currentMode = null;

// BROWSER TEST MODE
if (typeof cordova === 'undefined') {
    console.warn('⚠️ BROWSER TEST MODE');
    window.cordova = {
        plugins: {
            notification: {
                local: {
                    requestPermission: function(cb) { cb(true); },
                    promptPermission: function() {},
                    schedule: function(o) { console.log('Mock notification:', o.title); },
                    cancel: function(id) { console.log('Mock cancel:', id); },
                    on: function() {}
                }
            }
        }
    };
    
    setTimeout(() => {
        document.dispatchEvent(new Event('deviceready'));
    }, 100);
}

document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    console.log('🚀 DEVICE READY!');
    
    // Attach mode card click handlers
    const modeCards = document.querySelectorAll('.mode-card');
    console.log('Found mode cards:', modeCards.length);
    
    modeCards.forEach((card) => {
        card.addEventListener('click', function() {
            const mode = this.getAttribute('data-mode');
            console.log('Card clicked, mode:', mode);
            if (mode) {
                selectMode(mode);
            }
        });
    });
    
    // Check for saved mode
    const savedMode = localStorage.getItem('selectedMode');
    if (savedMode) {
        console.log('Loading saved mode:', savedMode);
        selectMode(savedMode);
    }
    
    // Attach other event listeners
    setupEventListeners();
    
    console.log('✅ App ready!');
}

function setupEventListeners() {
    // Settings button
    const settingsBtn = document.getElementById('settingsBtnTab');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', showSettings);
    }
    
    // Tab buttons
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            showTab(tabName);
        });
    });
    
    // Schedule button
    const scheduleBtn = document.getElementById('scheduleBtn');
    if (scheduleBtn) {
        scheduleBtn.addEventListener('click', scheduleReminder);
    }
    
    // Edit modal buttons
    const saveEditBtn = document.getElementById('saveEditBtn');
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', function() {
            alert('Save edit functionality');
        });
    }
    
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', function() {
            document.getElementById('editModal').classList.remove('active');
        });
    }
    
    console.log('Event listeners attached');
}

function selectMode(mode) {
    console.log('🎯 SELECT MODE:', mode);
    
    currentMode = mode;
    localStorage.setItem('selectedMode', mode);
    
    // Apply mode styling
    document.body.className = mode + '-mode';
    
    // Hide homepage, show app
    const homepage = document.getElementById('homepageView');
    const mainApp = document.getElementById('mainAppView');
    
    if (homepage && mainApp) {
        homepage.classList.remove('active');
        mainApp.classList.add('active');
        console.log('✅ Views switched');
    } else {
        console.error('Views not found!', {homepage, mainApp});
    }
    
    // Setup UI for mode
    setupModeUI(mode);
    
    // Load reminders
    loadReminders();
    
    // Initialize mode-specific module
    if (mode === 'adhd' && typeof ADHDMode !== 'undefined') {
        ADHDMode.init();
    } else if (mode === 'work' && typeof WorkMode !== 'undefined') {
        WorkMode.init();
    } else if (mode === 'memory' && typeof MemoryMode !== 'undefined') {
        MemoryMode.init();
    }
    
    console.log('✅ Mode loaded:', mode);
}

function setupModeUI(mode) {
    console.log('Setting up UI for:', mode);
    
    const modeTitle = document.getElementById('modeTitle');
    const prioritySection = document.getElementById('prioritySection');
    const memoryOptions = document.getElementById('memoryOptions');
    const projectSection = document.getElementById('projectSection');
    const adhdEscalation = document.getElementById('adhdEscalation');
    
    // Hide all mode-specific sections
    if (prioritySection) prioritySection.style.display = 'none';
    if (memoryOptions) memoryOptions.style.display = 'none';
    if (projectSection) projectSection.style.display = 'none';
    if (adhdEscalation) adhdEscalation.style.display = 'none';
    
    // Show mode-specific sections
    switch(mode) {
        case 'work':
            if (modeTitle) modeTitle.textContent = 'Work Mode 💼';
            if (prioritySection) prioritySection.style.display = 'block';
            if (projectSection) projectSection.style.display = 'block';
            break;
            
        case 'adhd':
            if (modeTitle) modeTitle.textContent = 'ADHD Mode ⚡';
            if (prioritySection) prioritySection.style.display = 'block';
            if (adhdEscalation) adhdEscalation.style.display = 'block';
            break;
            
        case 'memory':
            if (modeTitle) modeTitle.textContent = 'Memory Mode 🧠';
            if (memoryOptions) memoryOptions.style.display = 'block';
            break;
    }
    
    console.log('✅ UI configured');
}

function showTab(tabName) {
    console.log('Showing tab:', tabName);
    
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(t => {
        t.classList.remove('active');
    });
    document.querySelectorAll('.nav-tab').forEach(b => {
        b.classList.remove('active');
    });
    
    // Show selected tab
    const tabs = {
        'reminders': 'remindersTab',
        'completed': 'completedTab',
        'analytics': 'analyticsTab'
    };
    
    const tabElement = document.getElementById(tabs[tabName]);
    if (tabElement) {
        tabElement.classList.add('active');
        event.target.classList.add('active');
    }
}

function scheduleReminder() {
    console.log('Schedule reminder clicked');
    
    const title = document.getElementById('title').value.trim();
    const text = document.getElementById('text').value.trim();
    const datetime = document.getElementById('datetime').value;
    
    if (!title || !text || !datetime) {
        alert('Please fill in title, description, and date/time');
        return;
    }
    
    const reminder = {
        id: Date.now(),
        title: title,
        text: text,
        datetime: datetime,
        mode: currentMode,
        completed: false
    };
    
    // Save reminder
    reminders.push(reminder);
    localStorage.setItem('reminders', JSON.stringify(reminders));
    
    // Schedule notification
    try {
        cordova.plugins.notification.local.schedule({
            id: reminder.id,
            title: title,
            text: text,
            trigger: { at: new Date(datetime) },
            foreground: true
        });
    } catch (error) {
        console.error('Notification error:', error);
    }
    
    // Add to list
    addReminderToList(reminder);
    
    // Clear form
    document.getElementById('title').value = '';
    document.getElementById('text').value = '';
    document.getElementById('datetime').value = '';
    
    alert('✅ Reminder created: ' + title);
}

function addReminderToList(reminder) {
    const list = document.getElementById('reminderList');
    if (!list) return;
    
    const li = document.createElement('li');
    li.id = 'reminder-' + reminder.id;
    
    const info = document.createElement('div');
    info.className = 'reminder-info';
    info.innerHTML = `
        <strong>${reminder.title}</strong><br>
        ${reminder.text}<br>
        <small>⏰ ${new Date(reminder.datetime).toLocaleString()}</small>
    `;
    
    const actions = document.createElement('div');
    actions.className = 'reminder-actions';
    
    const completeBtn = document.createElement('button');
    completeBtn.textContent = '✓ Complete';
    completeBtn.onclick = () => completeReminder(reminder.id);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️ Delete';
    deleteBtn.onclick = () => deleteReminder(reminder.id);
    
    actions.appendChild(completeBtn);
    actions.appendChild(deleteBtn);
    
    li.appendChild(info);
    li.appendChild(actions);
    list.appendChild(li);
}

function completeReminder(id) {
    console.log('Completing reminder:', id);
    
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;
    
    reminder.completed = true;
    reminder.completedAt = new Date().toISOString();
    
    // Move to completed
    completedToday.push(reminder);
    reminders = reminders.filter(r => r.id !== id);
    
    localStorage.setItem('reminders', JSON.stringify(reminders));
    localStorage.setItem('completedToday', JSON.stringify(completedToday));
    
    // Remove from list
    const li = document.getElementById('reminder-' + id);
    if (li) li.remove();
    
    // Cancel notification
    try {
        cordova.plugins.notification.local.cancel(id);
    } catch (error) {
        console.error('Cancel notification error:', error);
    }
    
    alert('✅ Task completed!');
}

function deleteReminder(id) {
    if (!confirm('Delete this reminder?')) return;
    
    reminders = reminders.filter(r => r.id !== id);
    localStorage.setItem('reminders', JSON.stringify(reminders));
    
    const li = document.getElementById('reminder-' + id);
    if (li) li.remove();
    
    try {
        cordova.plugins.notification.local.cancel(id);
    } catch (error) {
        console.error('Cancel notification error:', error);
    }
}

function loadReminders() {
    console.log('Loading reminders...');
    
    try {
        reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
        completedToday = JSON.parse(localStorage.getItem('completedToday') || '[]');
        
        const list = document.getElementById('reminderList');
        if (list) {
            list.innerHTML = '';
            reminders.forEach(addReminderToList);
        }
        
        console.log('Loaded', reminders.length, 'reminders');
    } catch (error) {
        console.error('Load error:', error);
    }
}

function showSettings() {
    console.log('Show settings');
    
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.classList.add('active');
        
        const modeText = document.getElementById('currentMode');
        if (modeText) {
            const modes = {
                work: 'Work Mode 💼',
                adhd: 'ADHD Mode ⚡',
                memory: 'Memory Mode 🧠'
            };
            modeText.textContent = modes[currentMode] || 'None';
        }
    }
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function changeMode() {
    if (confirm('Change mode? Your reminders will be kept.')) {
        const homepage = document.getElementById('homepageView');
        const mainApp = document.getElementById('mainAppView');
        
        if (homepage && mainApp) {
            homepage.classList.add('active');
            mainApp.classList.remove('active');
        }
        
        closeSettings();
    }
}

// Make functions globally accessible
window.selectMode = selectMode;
window.showSettings = showSettings;
window.closeSettings = closeSettings;
window.changeMode = changeMode;

console.log('=== INDEX.JS LOADED ===');