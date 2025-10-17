document.addEventListener('deviceready', onDeviceReady, false);

let reminders = [];
let editingReminder = null;

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

    // Load existing reminders
    loadReminders();

    // Attach event listeners
    document.getElementById('scheduleBtn').addEventListener('click', scheduleReminder);
    document.getElementById('saveEditBtn').addEventListener('click', saveEdit);
    document.getElementById('cancelEditBtn').addEventListener('click', cancelEdit);

    // Close modal when clicking outside
    window.addEventListener('click', event => {
        const modal = document.getElementById('editModal');
        if (event.target === modal) {
            modal.style.display = 'none';
            editingReminder = null;
        }
    });

    // Handle notification clicks
    cordova.plugins.notification.local.on('click', function (notification) {
        alert(`Notification clicked: ${notification.text}`);
    });
}

// Schedule a new reminder
function scheduleReminder() {
    const title = document.getElementById('title').value.trim();
    const text = document.getElementById('text').value.trim();
    const datetimeStr = document.getElementById('datetime').value;

    if (!title || !text || !datetimeStr) {
        alert('Please fill in all fields.');
        return;
    }

    const datetime = new Date(datetimeStr);
    if (isNaN(datetime.getTime())) {
        alert('Invalid date/time.');
        return;
    }

    const id = Date.now();

    // Schedule the notification
    cordova.plugins.notification.local.schedule({
        id: id,
        title: title,
        text: text,
        trigger: { at: datetime },
        foreground: true
    });

    // Save reminder
    const reminder = {
        id: id,
        title: title,
        text: text,
        datetime: datetime.toISOString(),
        completed: false
    };
    reminders.push(reminder);
    localStorage.setItem('reminders', JSON.stringify(reminders));
    addReminderToList(reminder);

    // Clear form inputs
    document.getElementById('title').value = '';
    document.getElementById('text').value = '';
    document.getElementById('datetime').value = '';
}

// Load reminders from localStorage
function loadReminders() {
    reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
    reminders.forEach(addReminderToList);
}

// Add reminder to the UI list
function addReminderToList(reminder) {
    const reminderListEl = document.getElementById('reminderList');
    const li = document.createElement('li');
    li.id = 'reminder-' + reminder.id;

    const info = document.createElement('div');
    info.className = 'reminder-info';
    const datetime = new Date(reminder.datetime);
    info.textContent = `${reminder.title} — "${reminder.text}" at ${datetime.toLocaleString()}`;

    const actions = document.createElement('div');
    actions.className = 'reminder-actions';

    const completeBtn = document.createElement('button');
    completeBtn.textContent = 'Complete';
    completeBtn.onclick = () => completeReminder(reminder, li);

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => openEditModal(reminder);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => deleteReminder(reminder.id, li);

    actions.appendChild(completeBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(info);
    li.appendChild(actions);

    if (reminder.completed) {
        info.textContent += ' ✅';
    }

    reminderListEl.appendChild(li);
}

// Mark reminder as complete
function completeReminder(reminder, li) {
    cordova.plugins.notification.local.cancel(reminder.id);
    reminder.completed = true;
    updateReminder(reminder);
    li.querySelector('.reminder-info').textContent += ' ✅';
}

// Delete a reminder
function deleteReminder(id, li) {
    cordova.plugins.notification.local.cancel(id);
    reminders = reminders.filter(r => r.id !== id);
    localStorage.setItem('reminders', JSON.stringify(reminders));
    li.remove();
}

// Open the edit modal
function openEditModal(reminder) {
    editingReminder = reminder;
    document.getElementById('editTitle').value = reminder.title;
    document.getElementById('editText').value = reminder.text;
    document.getElementById('editDatetime').value = reminder.datetime.slice(0, 16);
    document.getElementById('editModal').style.display = 'flex';
}

// Save edited reminder
function saveEdit() {
    if (!editingReminder) return;

    const title = document.getElementById('editTitle').value.trim();
    const text = document.getElementById('editText').value.trim();
    const datetimeStr = document.getElementById('editDatetime').value;

    if (!title || !text || !datetimeStr) {
        alert('Please fill in all fields.');
        return;
    }

    const datetime = new Date(datetimeStr);
    if (isNaN(datetime.getTime())) {
        alert('Invalid date/time.');
        return;
    }

    // Cancel old notification
    cordova.plugins.notification.local.cancel(editingReminder.id);

    // Schedule new notification with same ID
    cordova.plugins.notification.local.schedule({
        id: editingReminder.id,
        title: title,
        text: text,
        trigger: { at: datetime },
        foreground: true
    });

    // Update reminder object
    editingReminder.title = title;
    editingReminder.text = text;
    editingReminder.datetime = datetime.toISOString();

    updateReminder(editingReminder);

    // Update the list item display
    const li = document.getElementById('reminder-' + editingReminder.id);
    li.querySelector('.reminder-info').textContent =
        `${title} — "${text}" at ${datetime.toLocaleString()}` +
        (editingReminder.completed ? ' ✅' : '');

    // Close modal
    document.getElementById('editModal').style.display = 'none';
    editingReminder = null;
}

// Cancel edit and close modal
function cancelEdit() {
    document.getElementById('editModal').style.display = 'none';
    editingReminder = null;
}

// Update a reminder in localStorage
function updateReminder(reminder) {
    const index = reminders.findIndex(r => r.id === reminder.id);
    if (index > -1) {
        reminders[index] = reminder;
        localStorage.setItem('reminders', JSON.stringify(reminders));
    }
}