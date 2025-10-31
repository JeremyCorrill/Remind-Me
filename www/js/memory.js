// Memory/Caregiver Mode Module
// Implements supportive features for memory-challenged users and caregiver oversight

const MemoryMode = {
    caregivers: [],
    acknowledgmentRequired: [],
    voiceReminders: [],
    photoReminders: [],

    init: function() {
        console.log('Memory/Caregiver Mode initialized');
        this.loadCaregivers();
        this.setupAcknowledgmentSystem();
        this.loadSettings();
        this.applyLargeTextMode();
        this.setupCaregiverNotifications();
    },

    loadSettings: function() {
        const saved = localStorage.getItem('memorySettings');
        if (saved) {
            const settings = JSON.parse(saved);
            this.voiceGuidanceEnabled = settings.voiceGuidanceEnabled !== false;
            this.autoRepeatEnabled = settings.autoRepeatEnabled !== false;
            this.repeatInterval = settings.repeatInterval || 5; // minutes
        }
    },

    saveSettings: function() {
        const settings = {
            voiceGuidanceEnabled: this.voiceGuidanceEnabled,
            autoRepeatEnabled: this.autoRepeatEnabled,
            repeatInterval: this.repeatInterval,
            lastUpdated: new Date().toISOString()
        };
        localStorage.setItem('memorySettings', JSON.stringify(settings));
    },

    loadCaregivers: function() {
        const saved = localStorage.getItem('memoryCaregivers');
        if (saved) {
            this.caregivers = JSON.parse(saved);
        }
    },

    saveCaregivers: function() {
        localStorage.setItem('memoryCaregivers', JSON.stringify(this.caregivers));
    },

    addCaregiver: function(name, email, phone, relationship) {
        const caregiver = {
            id: Date.now(),
            name: name,
            email: email,
            phone: phone,
            relationship: relationship,
            addedAt: new Date().toISOString(),
            permissions: {
                viewTasks: true,
                addTasks: true,
                editTasks: true,
                receiveAlerts: true
            }
        };

        this.caregivers.push(caregiver);
        this.saveCaregivers();

        console.log('Caregiver added:', name);
        return caregiver;
    },

    removeCaregiver: function(id) {
        this.caregivers = this.caregivers.filter(c => c.id !== id);
        this.saveCaregivers();
    },

    updateCaregiverPermissions: function(caregiverId, permissions) {
        const caregiver = this.caregivers.find(c => c.id === caregiverId);
        if (caregiver) {
            caregiver.permissions = { ...caregiver.permissions, ...permissions };
            this.saveCaregivers();
        }
    },

    setupAcknowledgmentSystem: function() {
        // Track reminders that require acknowledgment
        const saved = localStorage.getItem('memoryAcknowledgmentRequired');
        if (saved) {
            this.acknowledgmentRequired = JSON.parse(saved);
        }

        // Check for unacknowledged reminders
        this.checkUnacknowledged();
    },

    requireAcknowledgment: function(reminderId) {
        if (!this.acknowledgmentRequired.includes(reminderId)) {
            this.acknowledgmentRequired.push(reminderId);
            localStorage.setItem('memoryAcknowledgmentRequired',
                JSON.stringify(this.acknowledgmentRequired));
        }
    },

    acknowledgeReminder: function(reminderId) {
        this.acknowledgmentRequired = this.acknowledgmentRequired.filter(id => id !== reminderId);
        localStorage.setItem('memoryAcknowledgmentRequired',
            JSON.stringify(this.acknowledgmentRequired));

        // Log acknowledgment
        const log = {
            reminderId: reminderId,
            acknowledgedAt: new Date().toISOString()
        };

        const ackLog = JSON.parse(localStorage.getItem('memoryAcknowledgmentLog') || '[]');
        ackLog.push(log);
        localStorage.setItem('memoryAcknowledgmentLog', JSON.stringify(ackLog));

        console.log('Reminder acknowledged:', reminderId);
        return log;
    },

    checkUnacknowledged: function() {
        // Check for overdue acknowledgments
        if (typeof reminders === 'undefined') return;

        const unacknowledged = reminders.filter(r =>
            this.acknowledgmentRequired.includes(r.id) && !r.acknowledged
        );

        if (unacknowledged.length > 0) {
            console.log(`${unacknowledged.length} unacknowledged reminders`);
            this.alertCaregivers(unacknowledged);
        }
    },

    alertCaregivers: function(unacknowledgedReminders) {
        this.caregivers.forEach(caregiver => {
            if (caregiver.permissions.receiveAlerts) {
                this.sendCaregiverAlert(caregiver, unacknowledgedReminders);
            }
        });
    },

    sendCaregiverAlert: function(caregiver, reminders) {
        const alert = {
            caregiverId: caregiver.id,
            reminderCount: reminders.length,
            reminders: reminders.map(r => ({
                id: r.id,
                title: r.title,
                dueDate: r.datetime
            })),
            sentAt: new Date().toISOString()
        };

        // In production, this would send email/SMS via API
        console.log(`Alert sent to caregiver ${caregiver.name}:`, alert);

        // Save alert log
        const alertLog = JSON.parse(localStorage.getItem('memoryCaregiverAlerts') || '[]');
        alertLog.push(alert);
        localStorage.setItem('memoryCaregiverAlerts', JSON.stringify(alertLog));

        return alert;
    },

    setupCaregiverNotifications: function() {
        // Set up periodic checks for missed tasks
        setInterval(() => {
            this.checkMissedTasks();
        }, 15 * 60 * 1000); // Check every 15 minutes
    },

    checkMissedTasks: function() {
        if (typeof reminders === 'undefined') return;

        const now = new Date();
        const missed = reminders.filter(r => {
            const due = new Date(r.datetime);
            return !r.completed && due < now && !r.acknowledged;
        });

        if (missed.length > 0) {
            console.log(`${missed.length} missed tasks detected`);
            this.alertCaregivers(missed);
        }
    },

    // Hybrid reminders with photo and voice
    createHybridReminder: function(title, text, datetime, photoData, voiceData) {
        const hybridReminder = {
            id: Date.now(),
            title: title,
            text: text,
            datetime: datetime,
            photo: photoData,
            voice: voiceData,
            type: 'hybrid',
            requiresAcknowledgment: true,
            createdAt: new Date().toISOString()
        };

        if (photoData) {
            this.photoReminders.push(hybridReminder.id);
        }
        if (voiceData) {
            this.voiceReminders.push(hybridReminder.id);
        }

        this.requireAcknowledgment(hybridReminder.id);

        console.log('Hybrid reminder created:', title);
        return hybridReminder;
    },

    // Auto-replay reminders
    scheduleAutoReplay: function(reminderId, intervalMinutes = 5, maxReplays = 5) {
        const replayConfig = {
            reminderId: reminderId,
            interval: intervalMinutes,
            maxReplays: maxReplays,
            currentReplay: 0,
            startedAt: new Date().toISOString()
        };

        const replays = JSON.parse(localStorage.getItem('memoryAutoReplays') || '[]');
        replays.push(replayConfig);
        localStorage.setItem('memoryAutoReplays', JSON.stringify(replays));

        this.executeAutoReplay(replayConfig);

        console.log('Auto-replay scheduled for reminder:', reminderId);
        return replayConfig;
    },

    executeAutoReplay: function(config) {
        if (config.currentReplay >= config.maxReplays) {
            console.log('Max replays reached for:', config.reminderId);
            return;
        }

        setTimeout(() => {
            // Check if reminder is acknowledged
            if (!this.acknowledgmentRequired.includes(config.reminderId)) {
                console.log('Reminder already acknowledged');
                return;
            }

            // Trigger notification again
            if (typeof cordova !== 'undefined' && cordova.plugins.notification) {
                cordova.plugins.notification.local.schedule({
                    id: parseInt(`${config.reminderId}${config.currentReplay}`),
                    title: 'Reminder (Replay)',
                    text: 'Please acknowledge this reminder',
                    trigger: { at: new Date(Date.now() + 1000) },
                    foreground: true,
                    priority: 2
                });
            }

            config.currentReplay++;

            // Schedule next replay
            if (config.currentReplay < config.maxReplays) {
                this.executeAutoReplay(config);
            }
        }, config.interval * 60 * 1000);
    },

    applyLargeTextMode: function() {
        // Apply large text and high contrast for better visibility
        document.body.classList.add('memory-large-text');

        const style = document.createElement('style');
        style.textContent = `
            body.memory-large-text {
                font-size: 20px;
                line-height: 1.8;
            }
            body.memory-large-text button {
                font-size: 18px;
                padding: 15px 20px;
                min-height: 50px;
            }
            body.memory-large-text input,
            body.memory-large-text textarea,
            body.memory-large-text select {
                font-size: 18px;
                padding: 15px;
            }
            body.memory-large-text .reminder-info {
                font-size: 22px;
                line-height: 2;
            }
        `;
        document.head.appendChild(style);

        console.log('Large text mode applied');
    },

    // Voice guidance
    speakText: function(text) {
        if (!this.voiceGuidanceEnabled) return;

        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9; // Slightly slower for clarity
            utterance.pitch = 1;
            utterance.volume = 1;

            window.speechSynthesis.speak(utterance);
            console.log('Speaking:', text);
        } else {
            console.log('Speech synthesis not available');
        }
    },

    speakReminder: function(reminder) {
        const text = `Reminder: ${reminder.title}. ${reminder.text}`;
        this.speakText(text);
    },

    // Medication reminders (critical)
    createMedicationReminder: function(medicationName, dosage, time, instructions) {
        const medReminder = {
            id: Date.now(),
            type: 'medication',
            medication: medicationName,
            dosage: dosage,
            time: time,
            instructions: instructions,
            critical: true,
            requiresAcknowledgment: true,
            requiresPhoto: true, // Photo proof of taking medication
            createdAt: new Date().toISOString()
        };

        this.requireAcknowledgment(medReminder.id);

        // Schedule with high priority
        if (typeof cordova !== 'undefined' && cordova.plugins.notification) {
            cordova.plugins.notification.local.schedule({
                id: medReminder.id,
                title: `💊 Medication: ${medicationName}`,
                text: `Time to take ${dosage}. ${instructions}`,
                trigger: { at: new Date(time) },
                foreground: true,
                priority: 2,
                sound: true,
                vibrate: true
            });
        }

        // Auto-replay every 5 minutes until acknowledged
        this.scheduleAutoReplay(medReminder.id, 5, 10);

        console.log('Medication reminder created:', medicationName);
        return medReminder;
    },

    recordMedicationTaken: function(reminderId, photoProof) {
        const record = {
            reminderId: reminderId,
            takenAt: new Date().toISOString(),
            photoProof: photoProof,
            confirmed: true
        };

        const log = JSON.parse(localStorage.getItem('memoryMedicationLog') || '[]');
        log.push(record);
        localStorage.setItem('memoryMedicationLog', JSON.stringify(log));

        // Acknowledge reminder
        this.acknowledgeReminder(reminderId);

        // Notify caregivers
        this.notifyCaregiversMedication(record);

        console.log('Medication taken recorded');
        return record;
    },

    notifyCaregiversMedication: function(record) {
        this.caregivers.forEach(caregiver => {
            if (caregiver.permissions.receiveAlerts) {
                const notification = {
                    caregiverId: caregiver.id,
                    type: 'medication_taken',
                    record: record,
                    sentAt: new Date().toISOString()
                };

                console.log(`Medication notification sent to ${caregiver.name}`);
            }
        });
    },

    // Routine reminders (morning/evening routines)
    createRoutineReminder: function(routineName, tasks, time) {
        const routine = {
            id: Date.now(),
            name: routineName,
            tasks: tasks, // Array of task names
            time: time,
            type: 'routine',
            createdAt: new Date().toISOString()
        };

        // Schedule notification for routine
        if (typeof cordova !== 'undefined' && cordova.plugins.notification) {
            const taskList = tasks.join(', ');
            cordova.plugins.notification.local.schedule({
                id: routine.id,
                title: `📋 ${routineName}`,
                text: `Time for: ${taskList}`,
                trigger: { at: new Date(time) },
                foreground: true
            });
        }

        console.log('Routine reminder created:', routineName);
        return routine;
    },

    // Caregiver dashboard data
    getCaregiverDashboard: function() {
        const dashboard = {
            activeReminders: 0,
            completedToday: 0,
            missedTasks: 0,
            unacknowledged: this.acknowledgmentRequired.length,
            adherenceRate: 0,
            recentActivity: []
        };

        if (typeof reminders !== 'undefined') {
            dashboard.activeReminders = reminders.filter(r => !r.completed).length;

            const now = new Date();
            dashboard.missedTasks = reminders.filter(r => {
                return !r.completed && new Date(r.datetime) < now;
            }).length;
        }

        if (typeof completedToday !== 'undefined') {
            dashboard.completedToday = completedToday.length;
        }

        // Calculate adherence
        const total = dashboard.activeReminders + dashboard.completedToday;
        dashboard.adherenceRate = total > 0 ?
            Math.round((dashboard.completedToday / total) * 100) : 0;

        // Get recent activity
        const ackLog = JSON.parse(localStorage.getItem('memoryAcknowledgmentLog') || '[]');
        dashboard.recentActivity = ackLog.slice(-10).reverse();

        return dashboard;
    },

    // Export caregiver report
    exportCaregiverReport: function() {
        const dashboard = this.getCaregiverDashboard();
        const date = new Date().toLocaleString();

        let report = '📊 CAREGIVER REPORT\n';
        report += '═'.repeat(50) + '\n\n';
        report += `Generated: ${date}\n\n`;
        report += `CURRENT STATUS:\n`;
        report += `Active Reminders: ${dashboard.activeReminders}\n`;
        report += `Completed Today: ${dashboard.completedToday}\n`;
        report += `Missed Tasks: ${dashboard.missedTasks}\n`;
        report += `Unacknowledged: ${dashboard.unacknowledged}\n`;
        report += `Adherence Rate: ${dashboard.adherenceRate}%\n\n`;
        report += `RECENT ACTIVITY:\n`;

        dashboard.recentActivity.forEach((activity, index) => {
            const time = new Date(activity.acknowledgedAt).toLocaleString();
            report += `${index + 1}. Acknowledged at ${time}\n`;
        });

        // Download report
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `caregiver_report_${new Date().toISOString().slice(0,10)}.txt`;
        a.click();

        console.log('Caregiver report exported');
    }
};

// Auto-initialize when loaded
console.log('Memory/Caregiver mode module loaded');

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemoryMode;
}