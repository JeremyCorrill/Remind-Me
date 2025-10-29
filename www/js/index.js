document.addEventListener('deviceready', onDeviceReady, false);

let reminders = [];
let completedToday = [];
let editingReminder = null;
let currentMode = null;

function onDeviceReady() {
    console.log('Cordova ready!');

    // Check if the notification plugin is available
    if (!cordova.plugins || !cordova.plugins.notification || !cordova.plugins.notification.local) {
        alert('Local Notifications plugin NOT available!');
        return;
    }

    // Request notification permission
    cordova.plugins.notification.local.requestPermission(granted => {
        console.log('Notification permission granted:', granted);
    });

    // Load saved mode or show homepage
    loadMode();

    // Attach event listeners
    document.getElementById('scheduleBtn').addEventListener('click', scheduleReminder);
    document.getElementById('saveEditBtn').addEventListener('click', saveEdit);
    document.getElementById('cancelEditBtn').addEventListener('click', cancelEdit);

    // Memory mode specific listeners
    const recordBtn = document.getElementById('recordVoiceBtn');
    if (recordBtn) {
        recordBtn.addEventListener('click', recordVoiceNote);
    }

    cordova.plugins.notification.local.promptPermission();

    // Close modals when clicking outside
    window.addEventListener('click', event => {
        const editModal = document.getElementById('editModal');
        const settingsModal = document.getElementById('settingsModal');

        if (event.target === editModal) {
            editModal.classList.remove('active');
            editingReminder = null;
        }

        if (event.target === settingsModal) {
            settingsModal.classList.remove('active');
        }
    });

    // Handle notification clicks
    cordova.plugins.notification.local.on('click', function (notification) {
        const reminder = reminders.find(r => r.id === notification.id);
        if (!reminder || reminder.completed) return;

        alert(`Reminder: ${reminder.text}`);
    });
}

// ============= MODE MANAGEMENT =============

function selectMode(mode) {
    currentMode = mode;
    localStorage.setItem('selectedMode', mode);

    // Apply mode-specific styling
    document.body.className = mode + '-mode';

    // Update UI for selected mode
    setupModeUI(mode);

    // Switch to main app view
    document.getElementById('homepageView').classList.remove('active');
    document.getElementById('mainAppView').classList.add('active');

    // Load reminders
    loadReminders();

    console.log('Mode selected:', mode);
}

function setupModeUI(mode) {
    const modeTitle = document.getElementById('modeTitle');
    const prioritySection = document.getElementById('prioritySection');
    const memoryOptions = document.getElementById('memoryOptions');
    const editPrioritySection = document.getElementById('editPrioritySection');

    switch(mode) {
        case 'work':
            modeTitle.textContent = 'Work Mode - Reminder App';
            prioritySection.style.display = 'block';
            editPrioritySection.style.display = 'block';
            memoryOptions.style.display = 'none';
            break;

        case 'adhd':
            modeTitle.textContent = 'ADHD Mode - Stay Focused! ⚡';
            prioritySection.style.display = 'block';
            editPrioritySection.style.display = 'block';
            memoryOptions.style.display = 'none';
            break;

        case 'memory':
            modeTitle.textContent = 'Memory Support Mode 🧠';
            prioritySection.style.display = 'none';
            editPrioritySection.style.display = 'none';
            memoryOptions.style.display = 'block';
            break;
    }

    // Show completed section
    document.getElementById('completedSection').style.display = 'block';
}

function loadMode() {
    const savedMode = localStorage.getItem('selectedMode');

    if (savedMode) {
        selectMode(savedMode);
    } else {
        // Show homepage for first-time users
        document.getElementById('homepageView').classList.add('active');
    }
}

function changeMode() {
    if (confirm('Changing modes will keep your reminders but may change how they appear. Continue?')) {
        closeSettings();
        document.getElementById('mainAppView').classList.remove('active');
        document.getElementById('homepageView').classList.add('active');
    }
}

function showSettings() {
    const modal = document.getElementById('settingsModal');
    const modeText = document.getElementById('currentMode');

    const modeNames = {
        'work': 'Work Mode 💼',
        'adhd': 'ADHD Mode ⚡',
        'memory': 'Memory/Caregiver Mode 🧠'
    };

    modeText.textContent = modeNames[currentMode] || 'None';
    modal.classList.add('active');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
}

// ============= REMINDER MANAGEMENT =============

function scheduleReminder() {
    const title = document.getElementById('title').value.trim();
    const text = document.getElementById('text').value.trim();
    const datetimeStr = document.getElementById('datetime').value;
    const repeatMinutes = parseInt(document.getElementById('repeatInterval').value);

    let priority = 'medium';
    if (currentMode === 'work' || currentMode === 'adhd') {
        priority = document.getElementById('priority').value;
    }

    if (!title || !text || !datetimeStr) {
        alert('Please fill in all required fields.');
        return;
    }

    const datetime = new Date(datetimeStr);
    if (isNaN(datetime.getTime())) {
        alert('Invalid date/time.');
        return;
    }

    const id = Date.now();

    try {
        cordova.plugins.notification.local.schedule({
            id: id,
            title: title,
            text: text,
            trigger: {
                at: datetime,
                every: repeatMinutes > 0 ? { minute: repeatMinutes } : undefined
            },
            foreground: true
        });

        const reminder = {
            id: id,
            title: title,
            text: text,
            datetime: datetime.toISOString(),
            repeatMinutes: repeatMinutes || 0,
            priority: priority,
            mode: currentMode,
            completed: false,
            photo: null,
            voiceNote: null
        };

        reminders.push(reminder);
        localStorage.setItem('reminders', JSON.stringify(reminders));
        addReminderToList(reminder);

        // Clear form
        document.getElementById('title').value = '';
        document.getElementById('text').value = '';
        document.getElementById('datetime').value = '';
        document.getElementById('repeatInterval').value = '';
        if (currentMode === 'work' || currentMode === 'adhd') {
            document.getElementById('priority').value = 'medium';
        }

        console.log('Reminder scheduled:', reminder);
    } catch (error) {
        console.error('Failed to schedule reminder:', error);
        alert('Failed to schedule reminder. Please try again.');
    }
}

function loadReminders() {
    try {
        reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
        completedToday = JSON.parse(localStorage.getItem('completedToday') || '[]');

        document.getElementById('reminderList').innerHTML = '';
        document.getElementById('completedList').innerHTML = '';

        reminders.forEach(reminder => {
            if (!reminder.completed) {
                addReminderToList(reminder);
            }
        });

        completedToday.forEach(reminder => {
            addToCompletedList(reminder);
        });

        console.log('Loaded reminders:', reminders.length);
    } catch (error) {
        console.error('Failed to load reminders:', error);
        reminders = [];
        completedToday = [];
    }
}

function addReminderToList(reminder) {
    const reminderListEl = document.getElementById('reminderList');
    const li = document.createElement('li');
    li.id = 'reminder-' + reminder.id;

    if (reminder.priority && (currentMode === 'work' || currentMode === 'adhd')) {
        li.classList.add('priority-' + reminder.priority);
    }

    const info = document.createElement('div');
    info.className = 'reminder-info';
    const datetime = new Date(reminder.datetime);

    let infoText = `${reminder.title} — "${reminder.text}" at ${datetime.toLocaleString()}`;

    if (reminder.repeatMinutes > 0) {
        infoText += ` (Repeats every ${reminder.repeatMinutes} min)`;
    }

    info.textContent = infoText;

    const actions = document.createElement('div');
    actions.className = 'reminder-actions';

    const completeBtn = document.createElement('button');
    completeBtn.textContent = 'Complete';
    completeBtn.onclick = () => completeReminder(reminder);

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => openEditModal(reminder);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => deleteReminder(reminder.id);

    actions.appendChild(completeBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(info);
    li.appendChild(actions);

    reminderListEl.appendChild(li);
}

function addToCompletedList(reminder) {
    const completedListEl = document.getElementById('completedList');
    const li = document.createElement('li');

    const info = document.createElement('div');
    info.className = 'reminder-info';
    const datetime = new Date(reminder.completedAt || reminder.datetime);

    info.textContent = `${reminder.title} — "${reminder.text}" (Completed at ${datetime.toLocaleTimeString()}) ✅`;

    li.appendChild(info);
    completedListEl.appendChild(li);
}

function completeReminder(reminder) {
    try {
        cordova.plugins.notification.local.cancel(reminder.id);

        reminder.completed = true;
        reminder.completedAt = new Date().toISOString();

        completedToday.push(reminder);
        localStorage.setItem('completedToday', JSON.stringify(completedToday));

        reminders = reminders.filter(r => r.id !== reminder.id);
        localStorage.setItem('reminders', JSON.stringify(reminders));

        const li = document.getElementById('reminder-' + reminder.id);
        if (li) li.remove();

        addToCompletedList(reminder);

        if (currentMode === 'adhd') {
            showCelebration(reminder);
        }

        console.log('Reminder completed:', reminder.id);
    } catch (error) {
        console.error('Failed to complete reminder:', error);
        alert('Failed to complete reminder. Please try again.');
    }
}

function deleteReminder(id) {
    if (!confirm('Are you sure you want to delete this reminder?')) return;

    try {
        cordova.plugins.notification.local.cancel(id);
        reminders = reminders.filter(r => r.id !== id);
        localStorage.setItem('reminders', JSON.stringify(reminders));

        const li = document.getElementById('reminder-' + id);
        if (li) li.remove();

        console.log('Reminder deleted:', id);
    } catch (error) {
        console.error('Failed to delete reminder:', error);
        alert('Failed to delete reminder. Please try again.');
    }
}

// ============= EDIT MODAL =============

function openEditModal(reminder) {
    editingReminder = reminder;
    document.getElementById('editTitle').value = reminder.title;
    document.getElementById('editText').value = reminder.text;
    document.getElementById('editDatetime').value = reminder.datetime.slice(0, 16);
    document.getElementById('editRepeatInterval').value = reminder.repeatMinutes || '';

    if (reminder.priority && (currentMode === 'work' || currentMode === 'adhd')) {
        document.getElementById('editPriority').value = reminder.priority;
    }

    document.getElementById('editModal').classList.add('active');
}

function saveEdit() {
    if (!editingReminder) return;

    const title = document.getElementById('editTitle').value.trim();
    const text = document.getElementById('editText').value.trim();
    const datetimeStr = document.getElementById('editDatetime').value;
    const repeatMinutes = parseInt(document.getElementById('editRepeatInterval').value);

    if (!title || !text || !datetimeStr) {
        alert('Please fill in all fields.');
        return;
    }

    const datetime = new Date(datetimeStr);
    if (isNaN(datetime.getTime())) {
        alert('Invalid date/time.');
        return;
    }

    try {
        cordova.plugins.notification.local.cancel(editingReminder.id);

        cordova.plugins.notification.local.schedule({
            id: editingReminder.id,
            title: title,
            text: text,
            trigger: {
                at: datetime,
                every: repeatMinutes > 0 ? { minute: repeatMinutes } : undefined
            },
            foreground: true
        });

        editingReminder.title = title;
        editingReminder.text = text;
        editingReminder.datetime = datetime.toISOString();
        editingReminder.repeatMinutes = repeatMinutes || 0;

        if (currentMode === 'work' || currentMode === 'adhd') {
            editingReminder.priority = document.getElementById('editPriority').value;
        }

        updateReminder(editingReminder);

        const li = document.getElementById('reminder-' + editingReminder.id);
        if (li) {
            li.remove();
            addReminderToList(editingReminder);
        }

        document.getElementById('editModal').classList.remove('active');
        editingReminder = null;

        console.log('Reminder updated');
    } catch (error) {
        console.error('Failed to update reminder:', error);
        alert('Failed to update reminder. Please try again.');
    }
}

function cancelEdit() {
    document.getElementById('editModal').classList.remove('active');
    editingReminder = null;
}

function updateReminder(reminder) {
    const index = reminders.findIndex(r => r.id === reminder.id);
    if (index > -1) {
        reminders[index] = reminder;
        localStorage.setItem('reminders', JSON.stringify(reminders));
    }
}

// ============= ADHD MODE CELEBRATION =============

function showCelebration(reminder) {
    const modal = document.getElementById('celebrationModal');
    const message = document.getElementById('celebrationMessage');

    const messages = [
        'Amazing! You crushed it! 🎉',
        'Great job staying focused! ⚡',
        'You\'re on fire today! 🔥',
        'Awesome work! Keep it up! 💪',
        'That\'s how it\'s done! ✨'
    ];

    message.textContent = messages[Math.floor(Math.random() * messages.length)];
    modal.classList.add('active');

    setTimeout(() => {
        modal.classList.remove('active');
    }, 3000);
}

function closeCelebration() {
    document.getElementById('celebrationModal').classList.remove('active');
}

// ============= MEMORY MODE FEATURES (Placeholder) =============

function recordVoiceNote() {
    alert('Voice recording feature coming soon! This will allow you to record audio reminders.');
    // TODO: Implement voice recording with Cordova media plugin
}