// Reminder Sync Manager
// Handles synchronization of reminders with Firebase Firestore

class ReminderSync {
    constructor(authManager) {
        this.authManager = authManager;
        this.db = null;
        this.storage = null;
        this.remindersRef = null;
        this.unsubscribe = null;
        this.syncEnabled = false;
    }

    /**
     * Initialize reminder sync
     */
    initialize() {
        if (!this.authManager.isSignedIn()) {
            console.error('Cannot initialize sync: User not authenticated');
            return false;
        }

        try {
            this.db = window.firebase.firestore();
            this.storage = window.firebase.storage();

            this.remindersRef = this.db
                .collection('users')
                .doc(this.authManager.getUserId())
                .collection('reminders');

            // Start listening for real-time updates
            this.listenToReminders();

            this.syncEnabled = true;
            console.log('Reminder sync initialized successfully');

            return true;
        } catch (error) {
            console.error('Error initializing reminder sync:', error);
            return false;
        }
    }

    /**
     * Listen for real-time reminder updates
     */
    listenToReminders() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        console.log('Starting to listen for reminder updates...');

        this.unsubscribe = this.remindersRef
            .orderBy('datetime', 'asc')
            .onSnapshot((snapshot) => {
                console.log('Received snapshot with', snapshot.docChanges().length, 'changes');

                snapshot.docChanges().forEach((change) => {
                    const reminder = {
                        id: change.doc.id,
                        ...change.doc.data()
                    };

                    if (change.type === 'added') {
                        console.log('Reminder added:', reminder.title);
                        this.handleReminderAdded(reminder);
                    } else if (change.type === 'modified') {
                        console.log('Reminder modified:', reminder.title);
                        this.handleReminderModified(reminder);
                    } else if (change.type === 'removed') {
                        console.log('Reminder removed:', reminder.title);
                        this.handleReminderRemoved(reminder);
                    }
                });
            }, (error) => {
                console.error('Firestore listener error:', error);
                alert('Error syncing reminders. Please check your connection.');
            });
    }

    /**
     * Save a new reminder to Firestore
     */
    async saveReminder(reminder) {
        if (!this.syncEnabled) {
            console.warn('Sync not enabled, skipping cloud save');
            return null;
        }

        try {
            console.log('Saving reminder to cloud:', reminder.title);

            const reminderData = {
                id: reminder.id,
                title: reminder.title,
                text: reminder.text,
                datetime: reminder.datetime,
                repeatMinutes: reminder.repeatMinutes || 0,
                completed: reminder.completed || false,
                category: reminder.category || 'general',
                priority: reminder.priority || 'medium',
                userId: this.authManager.getUserId(),
                createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
            };

            // Upload photo if exists
            if (reminder.photoBlob) {
                console.log('Uploading photo...');
                reminderData.photoURL = await this.uploadPhoto(
                    reminder.id,
                    reminder.photoBlob
                );
            }

            // Upload voice if exists
            if (reminder.voiceBlob) {
                console.log('Uploading voice recording...');
                reminderData.voiceURL = await this.uploadVoice(
                    reminder.id,
                    reminder.voiceBlob
                );
            }

            await this.remindersRef.doc(reminder.id.toString()).set(reminderData, { merge: true });

            console.log('Reminder saved to cloud successfully');
            return reminderData;
        } catch (error) {
            console.error('Error saving reminder to cloud:', error);
            throw error;
        }
    }

    /**
     * Update an existing reminder in Firestore
     */
    async updateReminder(reminder) {
        if (!this.syncEnabled) {
            console.warn('Sync not enabled, skipping cloud update');
            return;
        }

        try {
            console.log('Updating reminder in cloud:', reminder.title);

            const updateData = {
                title: reminder.title,
                text: reminder.text,
                datetime: reminder.datetime,
                repeatMinutes: reminder.repeatMinutes || 0,
                completed: reminder.completed || false,
                category: reminder.category || 'general',
                priority: reminder.priority || 'medium',
                updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
            };

            // Upload new photo if provided
            if (reminder.photoBlob) {
                console.log('Uploading updated photo...');
                updateData.photoURL = await this.uploadPhoto(
                    reminder.id,
                    reminder.photoBlob
                );
            }

            // Upload new voice if provided
            if (reminder.voiceBlob) {
                console.log('Uploading updated voice recording...');
                updateData.voiceURL = await this.uploadVoice(
                    reminder.id,
                    reminder.voiceBlob
                );
            }

            await this.remindersRef.doc(reminder.id.toString()).update(updateData);

            console.log('Reminder updated in cloud successfully');
        } catch (error) {
            console.error('Error updating reminder in cloud:', error);
            throw error;
        }
    }

    /**
     * Delete a reminder from Firestore
     */
    async deleteReminder(reminderId) {
        if (!this.syncEnabled) {
            console.warn('Sync not enabled, skipping cloud delete');
            return;
        }

        try {
            console.log('Deleting reminder from cloud:', reminderId);

            // Delete associated files first
            await this.deleteReminderFiles(reminderId);

            // Delete the reminder document
            await this.remindersRef.doc(reminderId.toString()).delete();

            console.log('Reminder deleted from cloud successfully');
        } catch (error) {
            console.error('Error deleting reminder from cloud:', error);
            throw error;
        }
    }

    /**
     * Upload photo to Firebase Storage
     */
    async uploadPhoto(reminderId, photoBlob) {
        try {
            const storageRef = this.storage.ref();
            const photoPath = `users/${this.authManager.getUserId()}/reminders/${reminderId}/photo.jpg`;
            const photoRef = storageRef.child(photoPath);

            const snapshot = await photoRef.put(photoBlob, {
                contentType: 'image/jpeg'
            });

            const downloadURL = await snapshot.ref.getDownloadURL();
            console.log('Photo uploaded successfully:', downloadURL);

            return downloadURL;
        } catch (error) {
            console.error('Error uploading photo:', error);
            throw error;
        }
    }

    /**
     * Upload voice recording to Firebase Storage
     */
    async uploadVoice(reminderId, voiceBlob) {
        try {
            const storageRef = this.storage.ref();
            const voicePath = `users/${this.authManager.getUserId()}/reminders/${reminderId}/voice.mp3`;
            const voiceRef = storageRef.child(voicePath);

            const snapshot = await voiceRef.put(voiceBlob, {
                contentType: 'audio/mpeg'
            });

            const downloadURL = await snapshot.ref.getDownloadURL();
            console.log('Voice recording uploaded successfully:', downloadURL);

            return downloadURL;
        } catch (error) {
            console.error('Error uploading voice recording:', error);
            throw error;
        }
    }

    /**
     * Delete reminder files from Firebase Storage
     */
    async deleteReminderFiles(reminderId) {
        try {
            const storageRef = this.storage.ref();
            const userId = this.authManager.getUserId();

            // Try to delete photo
            try {
                const photoRef = storageRef.child(`users/${userId}/reminders/${reminderId}/photo.jpg`);
                await photoRef.delete();
                console.log('Photo deleted');
            } catch (error) {
                if (error.code !== 'storage/object-not-found') {
                    console.warn('Error deleting photo:', error);
                }
            }

            // Try to delete voice
            try {
                const voiceRef = storageRef.child(`users/${userId}/reminders/${reminderId}/voice.mp3`);
                await voiceRef.delete();
                console.log('Voice recording deleted');
            } catch (error) {
                if (error.code !== 'storage/object-not-found') {
                    console.warn('Error deleting voice:', error);
                }
            }
        } catch (error) {
            console.error('Error deleting reminder files:', error);
        }
    }

    /**
     * Handle reminder added from Firestore
     */
    handleReminderAdded(reminder) {
        // Get local reminders
        const localReminders = JSON.parse(localStorage.getItem('reminders') || '[]');

        // Check if reminder already exists locally
        const exists = localReminders.find(r => r.id.toString() === reminder.id.toString());

        if (!exists) {
            // Add to local storage
            localReminders.push(reminder);
            localStorage.setItem('reminders', JSON.stringify(localReminders));

            // Update UI if function exists
            if (typeof window.addReminderToList === 'function') {
                window.addReminderToList(reminder);
            }

            console.log('Reminder synced to local storage');
        }
    }

    /**
     * Handle reminder modified from Firestore
     */
    handleReminderModified(reminder) {
        // Get local reminders
        const localReminders = JSON.parse(localStorage.getItem('reminders') || '[]');

        // Find and update the reminder
        const index = localReminders.findIndex(r => r.id.toString() === reminder.id.toString());

        if (index > -1) {
            localReminders[index] = reminder;
            localStorage.setItem('reminders', JSON.stringify(localReminders));

            // Update UI
            const li = document.getElementById('reminder-' + reminder.id);
            if (li) {
                const datetime = new Date(reminder.datetime);
                const infoEl = li.querySelector('.reminder-info');
                if (infoEl) {
                    let displayText = `${reminder.title} — "${reminder.text}" at ${datetime.toLocaleString()}`;

                    if (reminder.repeatMinutes && reminder.repeatMinutes > 0) {
                        displayText += ` (Repeats every ${reminder.repeatMinutes} min)`;
                    }

                    if (reminder.completed) {
                        displayText += ' ✅';
                    }

                    infoEl.textContent = displayText;
                }
            }

            console.log('Reminder updated in local storage');
        }
    }

    /**
     * Handle reminder removed from Firestore
     */
    handleReminderRemoved(reminder) {
        // Get local reminders
        let localReminders = JSON.parse(localStorage.getItem('reminders') || '[]');

        // Remove the reminder
        localReminders = localReminders.filter(r => r.id.toString() !== reminder.id.toString());
        localStorage.setItem('reminders', JSON.stringify(localReminders));

        // Update UI
        const li = document.getElementById('reminder-' + reminder.id);
        if (li) {
            li.remove();
        }

        console.log('Reminder removed from local storage');
    }

    /**
     * Sync all local reminders to cloud
     */
    async syncAllToCloud() {
        if (!this.syncEnabled) {
            console.warn('Sync not enabled');
            return;
        }

        try {
            console.log('Starting full sync to cloud...');

            const localReminders = JSON.parse(localStorage.getItem('reminders') || '[]');
            let synced = 0;
            let errors = 0;

            for (const reminder of localReminders) {
                try {
                    await this.saveReminder(reminder);
                    synced++;
                } catch (error) {
                    console.error('Error syncing reminder:', reminder.id, error);
                    errors++;
                }
            }

            console.log(`Sync complete: ${synced} synced, ${errors} errors`);

            return { synced, errors };
        } catch (error) {
            console.error('Error in full sync:', error);
            throw error;
        }
    }

    /**
     * Stop listening for updates
     */
    stopListening() {
        if (this.unsubscribe) {
            console.log('Stopping reminder sync listener');
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.syncEnabled = false;
    }

    /**
     * Check if sync is enabled
     */
    isSyncEnabled() {
        return this.syncEnabled;
    }
}

// Export for global use
window.ReminderSync = ReminderSync;