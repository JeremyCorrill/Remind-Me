// Caregiver Access Manager
// Handles granting, revoking, and managing caregiver access to patient reminders

class CaregiverAccess {
    constructor(authManager) {
        this.authManager = authManager;
        this.db = null;
    }

    /**
     * Initialize caregiver access manager
     */
    initialize() {
        if (!this.authManager.isSignedIn()) {
            console.error('Cannot initialize caregiver access: User not authenticated');
            return false;
        }

        try {
            this.db = window.firebase.firestore();
            console.log('Caregiver access manager initialized');
            return true;
        } catch (error) {
            console.error('Error initializing caregiver access:', error);
            return false;
        }
    }

    /**
     * Grant access to a caregiver
     * @param {string} patientUserId - The patient's user ID
     * @param {string} caregiverEmail - The caregiver's email
     * @param {string} accessLevel - 'view', 'edit', or 'full'
     */
    async grantAccess(patientUserId, caregiverEmail, accessLevel = 'view') {
        try {
            console.log(`Granting ${accessLevel} access to ${caregiverEmail}`);

            // Validate access level
            if (!['view', 'edit', 'full'].includes(accessLevel)) {
                throw new Error('Invalid access level. Must be "view", "edit", or "full"');
            }

            // Find caregiver by email
            const caregiverQuery = await this.db.collection('users')
                .where('email', '==', caregiverEmail.toLowerCase())
                .limit(1)
                .get();

            if (caregiverQuery.empty) {
                throw new Error('Caregiver not found. They must sign up first.');
            }

            const caregiverDoc = caregiverQuery.docs[0];
            const caregiverId = caregiverDoc.id;
            const caregiverData = caregiverDoc.data();

            // Prevent self-assignment
            if (caregiverId === patientUserId) {
                throw new Error('Cannot grant access to yourself');
            }

            // Create access record in caregiverAccess collection
            const accessRef = this.db
                .collection('caregiverAccess')
                .doc(patientUserId)
                .collection('caregivers')
                .doc(caregiverId);

            const accessData = {
                caregiverEmail: caregiverData.email,
                caregiverName: caregiverData.displayName || 'Caregiver',
                caregiverPhotoURL: caregiverData.photoURL || '',
                accessLevel: accessLevel,
                grantedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                grantedBy: patientUserId,
                status: 'active',
                patientUserId: patientUserId
            };

            await accessRef.set(accessData, { merge: true });
            console.log('Access record created');

            // Add reverse reference (caregiver -> patient)
            const patientUser = await this.db.collection('users').doc(patientUserId).get();
            const patientData = patientUser.data();

            await this.db
                .collection('users')
                .doc(caregiverId)
                .collection('patients')
                .doc(patientUserId)
                .set({
                    patientEmail: patientData.email,
                    patientName: patientData.displayName || 'Patient',
                    patientPhotoURL: patientData.photoURL || '',
                    accessLevel: accessLevel,
                    grantedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'active'
                }, { merge: true });

            console.log('Access granted successfully');

            // Send notification to caregiver (optional - implement push notifications)
            await this.sendAccessNotification(caregiverId, patientData, 'granted');

            return {
                success: true,
                caregiverId,
                message: 'Access granted successfully'
            };
        } catch (error) {
            console.error('Error granting access:', error);
            throw error;
        }
    }

    /**
     * Revoke caregiver access
     * @param {string} patientUserId - The patient's user ID
     * @param {string} caregiverId - The caregiver's user ID
     */
    async revokeAccess(patientUserId, caregiverId) {
        try {
            console.log(`Revoking access for caregiver ${caregiverId}`);

            // Update status in caregiverAccess collection (keep for audit trail)
            await this.db
                .collection('caregiverAccess')
                .doc(patientUserId)
                .collection('caregivers')
                .doc(caregiverId)
                .update({
                    status: 'revoked',
                    revokedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                    revokedBy: this.authManager.getUserId()
                });

            // Update reverse reference
            await this.db
                .collection('users')
                .doc(caregiverId)
                .collection('patients')
                .doc(patientUserId)
                .update({
                    status: 'revoked',
                    revokedAt: window.firebase.firestore.FieldValue.serverTimestamp()
                });

            console.log('Access revoked successfully');

            // Send notification to caregiver
            await this.sendAccessNotification(caregiverId, null, 'revoked');

            return {
                success: true,
                message: 'Access revoked successfully'
            };
        } catch (error) {
            console.error('Error revoking access:', error);
            throw error;
        }
    }

    /**
     * Update access level for a caregiver
     * @param {string} patientUserId - The patient's user ID
     * @param {string} caregiverId - The caregiver's user ID
     * @param {string} newAccessLevel - The new access level
     */
    async updateAccessLevel(patientUserId, caregiverId, newAccessLevel) {
        try {
            console.log(`Updating access level to ${newAccessLevel}`);

            // Validate access level
            if (!['view', 'edit', 'full'].includes(newAccessLevel)) {
                throw new Error('Invalid access level');
            }

            // Update access record
            await this.db
                .collection('caregiverAccess')
                .doc(patientUserId)
                .collection('caregivers')
                .doc(caregiverId)
                .update({
                    accessLevel: newAccessLevel,
                    updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
                });

            // Update reverse reference
            await this.db
                .collection('users')
                .doc(caregiverId)
                .collection('patients')
                .doc(patientUserId)
                .update({
                    accessLevel: newAccessLevel,
                    updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
                });

            console.log('Access level updated successfully');

            return {
                success: true,
                message: 'Access level updated successfully'
            };
        } catch (error) {
            console.error('Error updating access level:', error);
            throw error;
        }
    }

    /**
     * Get all caregivers for a patient
     * @param {string} patientUserId - The patient's user ID
     */
    async getCaregivers(patientUserId) {
        try {
            console.log('Getting caregivers for patient:', patientUserId);

            const snapshot = await this.db
                .collection('caregiverAccess')
                .doc(patientUserId)
                .collection('caregivers')
                .where('status', '==', 'active')
                .orderBy('grantedAt', 'desc')
                .get();

            const caregivers = [];
            snapshot.forEach(doc => {
                caregivers.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log(`Found ${caregivers.length} active caregivers`);
            return caregivers;
        } catch (error) {
            console.error('Error getting caregivers:', error);
            throw error;
        }
    }

    /**
     * Get all patients for a caregiver
     * @param {string} caregiverId - The caregiver's user ID
     */
    async getPatients(caregiverId) {
        try {
            console.log('Getting patients for caregiver:', caregiverId);

            const snapshot = await this.db
                .collection('users')
                .doc(caregiverId)
                .collection('patients')
                .where('status', '==', 'active')
                .orderBy('grantedAt', 'desc')
                .get();

            const patients = [];
            snapshot.forEach(doc => {
                patients.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log(`Found ${patients.length} active patients`);
            return patients;
        } catch (error) {
            console.error('Error getting patients:', error);
            throw error;
        }
    }

    /**
     * Get patient reminders (for caregivers)
     * @param {string} patientUserId - The patient's user ID
     * @param {string} caregiverId - The caregiver's user ID
     */
    async getPatientReminders(patientUserId, caregiverId) {
        try {
            console.log('Getting reminders for patient:', patientUserId);

            // Check if caregiver has access
            const accessDoc = await this.db
                .collection('caregiverAccess')
                .doc(patientUserId)
                .collection('caregivers')
                .doc(caregiverId)
                .get();

            if (!accessDoc.exists) {
                throw new Error('Access not found');
            }

            const accessData = accessDoc.data();

            if (accessData.status !== 'active') {
                throw new Error('Access denied or revoked');
            }

            // Get reminders
            const snapshot = await this.db
                .collection('users')
                .doc(patientUserId)
                .collection('reminders')
                .orderBy('datetime', 'asc')
                .get();

            const reminders = [];
            snapshot.forEach(doc => {
                reminders.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log(`Retrieved ${reminders.length} reminders`);

            return {
                reminders,
                accessLevel: accessData.accessLevel,
                patientName: accessData.patientName || 'Patient'
            };
        } catch (error) {
            console.error('Error getting patient reminders:', error);
            throw error;
        }
    }

    /**
     * Update patient reminder (for caregivers with edit or full access)
     * @param {string} patientUserId - The patient's user ID
     * @param {string} caregiverId - The caregiver's user ID
     * @param {object} reminder - The reminder data
     */
    async updatePatientReminder(patientUserId, caregiverId, reminder) {
        try {
            // Check access level
            const accessDoc = await this.db
                .collection('caregiverAccess')
                .doc(patientUserId)
                .collection('caregivers')
                .doc(caregiverId)
                .get();

            if (!accessDoc.exists || accessDoc.data().status !== 'active') {
                throw new Error('Access denied');
            }

            const accessLevel = accessDoc.data().accessLevel;

            if (accessLevel !== 'edit' && accessLevel !== 'full') {
                throw new Error('Insufficient permissions. Edit or full access required.');
            }

            // Update the reminder
            await this.db
                .collection('users')
                .doc(patientUserId)
                .collection('reminders')
                .doc(reminder.id.toString())
                .update({
                    ...reminder,
                    updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: caregiverId
                });

            console.log('Reminder updated by caregiver');

            return { success: true };
        } catch (error) {
            console.error('Error updating patient reminder:', error);
            throw error;
        }
    }

    /**
     * Check if user has caregiver access to a patient
     * @param {string} patientUserId - The patient's user ID
     * @param {string} caregiverId - The caregiver's user ID
     */
    async checkAccess(patientUserId, caregiverId) {
        try {
            const accessDoc = await this.db
                .collection('caregiverAccess')
                .doc(patientUserId)
                .collection('caregivers')
                .doc(caregiverId)
                .get();

            if (!accessDoc.exists) {
                return { hasAccess: false, accessLevel: null };
            }

            const accessData = accessDoc.data();

            return {
                hasAccess: accessData.status === 'active',
                accessLevel: accessData.accessLevel,
                grantedAt: accessData.grantedAt
            };
        } catch (error) {
            console.error('Error checking access:', error);
            return { hasAccess: false, accessLevel: null };
        }
    }

    /**
     * Send access notification (placeholder - implement with push notifications)
     * @param {string} recipientId - The recipient's user ID
     * @param {object} patientData - Patient data
     * @param {string} action - 'granted' or 'revoked'
     */
    async sendAccessNotification(recipientId, patientData, action) {
        try {
            // Create a notification document
            await this.db
                .collection('users')
                .doc(recipientId)
                .collection('notifications')
                .add({
                    type: 'access_' + action,
                    patientName: patientData ? patientData.displayName : 'Patient',
                    message: action === 'granted'
                        ? `You've been granted access to ${patientData.displayName}'s reminders`
                        : 'Your access has been revoked',
                    createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                    read: false
                });

            console.log('Notification sent');
        } catch (error) {
            console.error('Error sending notification:', error);
            // Don't throw - notification failure shouldn't stop the main operation
        }
    }

    /**
     * Get completion statistics for a patient (for caregivers)
     * @param {string} patientUserId - The patient's user ID
     * @param {string} caregiverId - The caregiver's user ID
     * @param {number} days - Number of days to analyze
     */
    async getPatientStatistics(patientUserId, caregiverId, days = 7) {
        try {
            // Check access
            const access = await this.checkAccess(patientUserId, caregiverId);
            if (!access.hasAccess) {
                throw new Error('Access denied');
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const snapshot = await this.db
                .collection('users')
                .doc(patientUserId)
                .collection('reminders')
                .where('datetime', '>=', startDate.toISOString())
                .get();

            let total = 0;
            let completed = 0;
            let overdue = 0;
            const now = new Date();

            snapshot.forEach(doc => {
                const reminder = doc.data();
                total++;

                if (reminder.completed) {
                    completed++;
                } else if (new Date(reminder.datetime) < now) {
                    overdue++;
                }
            });

            return {
                total,
                completed,
                overdue,
                pending: total - completed - overdue,
                completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
                days
            };
        } catch (error) {
            console.error('Error getting patient statistics:', error);
            throw error;
        }
    }
}

// Export for global use
window.CaregiverAccess = CaregiverAccess;