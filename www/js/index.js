document.addEventListener('deviceready', onDeviceReady, false);

let reminders = [];
let completedReminders = [];
let editingReminder = null;

function onDeviceReady() {
    console.log('Cordova ready!');

    if (!cordova.plugins?.notification?.local) {
        alert('Local Notifications plugin NOT available!');
        return;
    }

    cordova.plugins.notification.local.requestPermission(granted => {
        console.log('Notification permission granted:', granted);
    });

    loadReminders();

    document.getElementById('scheduleBtn').addEventListener('click', scheduleReminder);
    document.getElementById('saveEditBtn').addEventListener('click', saveEdit);
    document.getElementById('cancelEditBtn').addEventListener('click', cancelEdit);

    const completedSection = document.getElementById('completedReminders');
    const toggleCompletedBtn = document.getElementById('toggleCompletedBtn');

    toggleCompletedBtn.addEventListener('click', () => {
        const isActive = completedSection.classList.toggle('active');
        completedSection.classList.toggle('collapsed', !isActive);
        toggleCompletedBtn.textContent = isActive ? 'Hide' : 'Show';
    });

    window.addEventListener('click', event => {
        const modal = document.getElementById('editModal');
        if (event.target === modal) {
            modal.style.display = 'none';
            editingReminder = null;
        }
    });

    cordova.plugins.notification.local.on('click', notification => {
        const reminder = reminders.find(r => r.id === notification.id);
        if (!reminder || reminder.completed) return;
        alert(`Reminder: ${reminder.text}`);
    });
}

// === LOAD REMINDERS ===
function loadReminders() {
    try {
        reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
        completedReminders = JSON.parse(localStorage.getItem('completedReminders') || '[]');

        document.getElementById('reminderList').innerHTML = '';
        document.getElementById('completedReminders').innerHTML = '';

        // Only show active reminders
        reminders = reminders.filter(r => !r.completed);
        reminders.forEach(addReminderToList);

        renderCompletedReminders();
        console.log('Loaded reminders:', reminders.length, 'completed:', completedReminders.length);
    } catch (err) {
        console.error('Failed to load reminders:', err);
        reminders = [];
        completedReminders = [];
    }
}

// === CREATE NEW REMINDER ===
function scheduleReminder() {
    const title = document.getElementById('title').value.trim();
    const text = document.getElementById('text').value.trim();
    const datetimeStr = document.getElementById('datetime').value;
    const repeat = document.getElementById('repeatInterval').value;

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

    try {
        const trigger = repeat ? { every: repeat, firstAt: datetime } : { at: datetime };

        cordova.plugins.notification.local.schedule({
            id,
            title,
            text,
            trigger: trigger,
            foreground: true
        });

        const reminder = {
            id,
            title,
            text,
            datetime: datetime.toISOString(),
            repeat: repeat || '',
            completed: false,
            completedAt: null
        };

        reminders.push(reminder);
        localStorage.setItem('reminders', JSON.stringify(reminders));
        addReminderToList(reminder);

        ['title', 'text', 'datetime', 'repeatInterval'].forEach(id => document.getElementById(id).value = '');
        console.log('Reminder scheduled:', reminder);
    } catch (err) {
        console.error('Failed to schedule reminder:', err);
        alert('Failed to schedule reminder. Please try again.');
    }
}

// === ADD ACTIVE REMINDER TO LIST ===
function addReminderToList(reminder) {
    const reminderListEl = document.getElementById('reminderList');
    const li = document.createElement('li');
    li.id = 'reminder-' + reminder.id;
    li.className = 'reminder-item';

    const info = document.createElement('div');
    info.className = 'reminder-info';
    const datetime = new Date(reminder.datetime);
    info.textContent = `${reminder.title} — "${reminder.text}" at ${datetime.toLocaleString()}` +
        (reminder.repeat ? ` (Repeats every ${reminder.repeat})` : '');

    const actions = document.createElement('div');
    actions.className = 'reminder-actions';

    const completeBtn = document.createElement('button');
    completeBtn.type = 'button';
    completeBtn.textContent = 'Complete';
    completeBtn.addEventListener('click', () => completeReminder(reminder, li));

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openEditModal(reminder));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteReminder(reminder.id, li));

    actions.append(completeBtn, editBtn, deleteBtn);
    li.append(info, actions);
    reminderListEl.appendChild(li);
}

// === COMPLETE REMINDER ===
function completeReminder(reminder, li) {
    try {
        cordova.plugins.notification.local.cancel(reminder.id);

        reminder.completed = true;
        reminder.completedAt = new Date().toISOString();

        reminders = reminders.filter(r => r.id !== reminder.id);
        completedReminders.push(reminder);

        localStorage.setItem('reminders', JSON.stringify(reminders));
        localStorage.setItem('completedReminders', JSON.stringify(completedReminders));

        li.remove();
        renderCompletedReminders();

        console.log('Reminder completed:', reminder.id);
        alert('Reminder marked as completed!');
    } catch (err) {
        console.error('Failed to complete reminder:', err);
        alert('Failed to complete reminder. Please try again.');
    }
}

// === RENDER COMPLETED REMINDERS ===
function renderCompletedReminders() {
    const container = document.getElementById('completedReminders');
    container.innerHTML = '';

    if (completedReminders.length === 0) return;

    const grouped = {};
    completedReminders.forEach(reminder => {
        const date = new Date(reminder.completedAt);
        const dayKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        if (!grouped[dayKey]) grouped[dayKey] = [];
        grouped[dayKey].push(reminder);
    });

    Object.keys(grouped).forEach(day => {
        const daySection = document.createElement('div');
        daySection.classList.add('day-section');

        const dayHeader = document.createElement('button');
        dayHeader.classList.add('collapsible');
        dayHeader.textContent = day;
        daySection.appendChild(dayHeader);

        const remindersContent = document.createElement('div');
        remindersContent.classList.add('content');

        grouped[day].forEach(reminder => {
            const item = document.createElement('div');
            item.classList.add('completed-item');

            const info = document.createElement('div');
            info.className = 'completed-info';
            info.innerHTML = `
                <strong>${reminder.title}</strong><br>
                ${reminder.text}<br>
                <small>Generated at: ${new Date(reminder.datetime).toLocaleString()}</small><br>
                <small>Completed at: ${new Date(reminder.completedAt).toLocaleTimeString()}</small>
            `;

            const commentIcon = document.createElement('span');
            commentIcon.classList.add('comment-icon');
            commentIcon.textContent = '💬';

            const commentBox = document.createElement('textarea');
            commentBox.classList.add('comment-box');
            commentBox.style.display = 'none';
            commentBox.placeholder = 'Add a comment...';
            commentBox.value = reminder.comment || '';
            commentBox.addEventListener('input', () => {
                reminder.comment = commentBox.value;
                localStorage.setItem('completedReminders', JSON.stringify(completedReminders));
            });

            commentIcon.addEventListener('click', () => {
                commentBox.style.display = commentBox.style.display === 'block' ? 'none' : 'block';
            });

            item.append(info, commentIcon, commentBox);
            remindersContent.appendChild(item);
        });

        daySection.appendChild(remindersContent);
        container.appendChild(daySection);
    });

    container.querySelectorAll('.collapsible').forEach(btn => {
        btn.onclick = function () {
            this.classList.toggle('active');
            const content = this.nextElementSibling;
            content.style.display = content.style.display === 'block' ? 'none' : 'block';
        };
    });
}

// === DELETE REMINDER ===
function deleteReminder(id, li) {
    try {
        cordova.plugins.notification.local.cancel(id);
        reminders = reminders.filter(r => r.id !== id);
        localStorage.setItem('reminders', JSON.stringify(reminders));
        li.remove();
        console.log('Reminder deleted:', id);
    } catch (err) {
        console.error('Failed to delete reminder:', err);
        alert('Failed to delete reminder. Please try again.');
    }
}

// === EDIT REMINDER ===
function openEditModal(reminder) {
    editingReminder = reminder;
    document.getElementById('editTitle').value = reminder.title;
    document.getElementById('editText').value = reminder.text;
    document.getElementById('editDatetime').value = reminder.datetime.slice(0, 16);
    document.getElementById('editRepeatInterval').value = reminder.repeat || '';
    document.getElementById('editModal').style.display = 'flex';
}

function saveEdit() {
    if (!editingReminder) return;

    const title = document.getElementById('editTitle').value.trim();
    const text = document.getElementById('editText').value.trim();
    const datetimeStr = document.getElementById('editDatetime').value;
    const repeat = document.getElementById('editRepeatInterval').value;

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
        // Cancel existing notification
        cordova.plugins.notification.local.cancel(editingReminder.id);

        // Proper trigger for Android repeating notifications
        const trigger = repeat ? { every: repeat, firstAt: datetime } : { at: datetime };

        // Reschedule notification
        cordova.plugins.notification.local.schedule({
            id: editingReminder.id,
            title,
            text,
            trigger: trigger,
            foreground: true
        });

        // Update reminder object
        editingReminder.title = title;
        editingReminder.text = text;
        editingReminder.datetime = datetime.toISOString();
        editingReminder.repeat = repeat || '';

        // Update local storage
        updateReminder(editingReminder);

        // Update UI
        const li = document.getElementById('reminder-' + editingReminder.id);
        if (li) {
            const infoDiv = li.querySelector('.reminder-info');
            let infoText = `${title} — "${text}" at ${datetime.toLocaleString()}`;
            if (editingReminder.repeat)
                infoText += ` (Repeats every ${editingReminder.repeat})`;
            infoDiv.textContent = infoText;
        }

        document.getElementById('editModal').style.display = 'none';
        editingReminder = null;
    } catch (err) {
        console.error('Failed to update reminder:', err);
        alert('Failed to update reminder. Please try again.');
    }
}


function cancelEdit() {
    document.getElementById('editModal').style.display = 'none';
    editingReminder = null;
}

// === UPDATE LOCAL STORAGE ===
function updateReminder(reminder) {
    const index = reminders.findIndex(r => r.id === reminder.id);
    if (index > -1) {
        reminders[index] = reminder;
        localStorage.setItem('reminders', JSON.stringify(reminders));
    }
}
