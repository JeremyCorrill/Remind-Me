// Authentication Manager for Reminder App
// Handles Google Sign-In with Firebase Authentication

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.db = null;
    }

    /**
     * Initialize the authentication system
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            document.addEventListener('deviceready', async () => {
                try {
                    console.log('Initializing Firebase Authentication...');

                    // Initialize Firebase
                    await this.initializeFirebase();

                    // Check if user is already signed in
                    await this.checkAuthState();

                    console.log('Authentication initialized successfully');
                    resolve();
                } catch (error) {
                    console.error('Auth initialization error:', error);
                    reject(error);
                }
            }, false);
        });
    }

    /**
     * Initialize Firebase services
     */
    async initializeFirebase() {
        try {
            // Firebase is auto-initialized by the cordova-plugin-firebase-authentication
            this.db = window.firebase.firestore();

            // Enable offline persistence
            this.db.enablePersistence()
                .catch((err) => {
                    if (err.code === 'failed-precondition') {
                        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
                    } else if (err.code === 'unimplemented') {
                        console.warn('The current browser does not support persistence.');
                    }
                });

            console.log('Firebase initialized successfully');
        } catch (error) {
            console.error('Firebase initialization error:', error);
            throw error;
        }
    }

    /**
     * Check current authentication state
     */
async checkAuthState() {
    return new Promise((resolve) => {
        window.firebase.auth().onAuthStateChanged(async (user) => {
            console.log('=== AUTH STATE CHANGED ===');
            console.log('User:', user ? user.email : 'No user');

            if (user) {
                this.currentUser = user;
                await this.loadUserProfile();
                this.showMainApp();

                // Call the global onUserSignedIn function if it exists
                if (typeof window.onUserSignedIn === 'function') {
                    await window.onUserSignedIn();
                }
            } else {
                this.currentUser = null;
                this.userProfile = null;
                this.showSignInScreen();
            }

            resolve(user);
        });
    });
}

    /**
     * Sign in with Google
     */
    async signInWithGoogle() {
        try {
            console.log('Starting Google Sign-In...');
            this.showLoading('Signing in with Google...');

            // Google Sign-In using cordova-plugin-googleplus
const googleUser = await window.plugins.googleplus.login({
    webClientId: '1031307273535-b2c0e85ff152da38135f8a.apps.googleusercontent.com',  // Your actual Web Client ID
    offline: true,
    scopes: 'profile email'
});

            console.log('Google Sign-In successful:', googleUser.email);

            // Get Firebase credential
            const credential = window.firebase.auth.GoogleAuthProvider.credential(
                googleUser.idToken
            );

            // Sign in to Firebase
            const userCredential = await window.firebase.auth()
                .signInWithCredential(credential);

            this.currentUser = userCredential.user;
            console.log('Firebase sign-in successful:', this.currentUser.email);

            // Create or update user profile in Firestore
            await this.createOrUpdateUserProfile();

            this.hideLoading();
            this.showMainApp();

            return this.currentUser;
        } catch (error) {
            this.hideLoading();
            console.error('Sign-in error:', error);

            let errorMessage = 'Sign-in failed. Please try again.';

            if (error.code === 'auth/account-exists-with-different-credential') {
                errorMessage = 'An account already exists with this email address.';
            } else if (error.code === 'auth/invalid-credential') {
                errorMessage = 'Invalid credentials. Please try again.';
            } else if (error === 12501) {
                errorMessage = 'Sign-in cancelled.';
            }

            alert(errorMessage);
            throw error;
        }
    }

    /**
     * Create or update user profile in Firestore
     */
    async createOrUpdateUserProfile() {
        try {
            const userRef = this.db.collection('users').doc(this.currentUser.uid);
            const userDoc = await userRef.get();

            const userData = {
                email: this.currentUser.email,
                displayName: this.currentUser.displayName || 'User',
                photoURL: this.currentUser.photoURL || '',
                lastLogin: window.firebase.firestore.FieldValue.serverTimestamp()
            };

            if (!userDoc.exists) {
                console.log('Creating new user profile...');

                // New user - set defaults
                userData.role = 'user'; // 'user' or 'caregiver'
                userData.createdAt = window.firebase.firestore.FieldValue.serverTimestamp();
                userData.settings = {
                    mode: 'work', // 'work', 'adhd', 'memory'
                    notificationPreferences: {
                        sound: true,
                        vibration: true,
                        banner: true,
                        escalation: true
                    },
                    theme: 'default',
                    fontSize: 'medium',
                    colorCoded: false,
                    quietHoursStart: '22:00',
                    quietHoursEnd: '07:00'
                };

                await userRef.set(userData);
                console.log('New user profile created');
            } else {
                console.log('Updating existing user profile...');
                await userRef.update(userData);
                console.log('User profile updated');
            }
        } catch (error) {
            console.error('Error creating/updating user profile:', error);
            throw error;
        }
    }

    /**
     * Load user profile from Firestore
     */
    async loadUserProfile() {
        try {
            const userDoc = await this.db.collection('users')
                .doc(this.currentUser.uid)
                .get();

            if (userDoc.exists) {
                this.userProfile = userDoc.data();
                console.log('User profile loaded:', this.userProfile.email);
                return this.userProfile;
            } else {
                console.warn('User profile not found in Firestore');
                return null;
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            throw error;
        }
    }

    /**
     * Update user settings
     */
    async updateSettings(settings) {
        try {
            await this.db.collection('users')
                .doc(this.currentUser.uid)
                .update({
                    settings: settings,
                    updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
                });

            this.userProfile.settings = settings;
            console.log('Settings updated successfully');
        } catch (error) {
            console.error('Error updating settings:', error);
            throw error;
        }
    }

    /**
     * Sign out
     */
    async signOut() {
        try {
            console.log('Signing out...');
            this.showLoading('Signing out...');

            // Sign out from Firebase
            await window.firebase.auth().signOut();

            // Sign out from Google
            try {
                await window.plugins.googleplus.logout();
            } catch (error) {
                console.warn('Google logout warning:', error);
            }

            this.currentUser = null;
            this.userProfile = null;

            this.hideLoading();
            this.showSignInScreen();

            console.log('Sign-out successful');
        } catch (error) {
            this.hideLoading();
            console.error('Sign-out error:', error);
            alert('Sign-out failed. Please try again.');
            throw error;
        }
    }

    /**
     * Show sign-in screen
     */
showSignInScreen() {
    console.log('Showing sign-in screen');
    const signInScreen = document.getElementById('signInScreen');
    const homepageView = document.getElementById('homepageView');
    const mainAppView = document.getElementById('mainAppView');
    const onboardingView = document.getElementById('onboardingView');
    const pinLockView = document.getElementById('pinLockView');

    // Hide everything first
    if (homepageView) homepageView.style.display = 'none';
    if (mainAppView) mainAppView.style.display = 'none';
    if (onboardingView) onboardingView.style.display = 'none';
    if (pinLockView) pinLockView.style.display = 'none';

    // Show only sign-in
    if (signInScreen) {
        signInScreen.style.display = 'flex';
    }
}

    /**
     * Show main app
     */
showMainApp() {
    console.log('Showing main app (mode selection)');
    const signInScreen = document.getElementById('signInScreen');
    const homepageView = document.getElementById('homepageView');
    const mainAppView = document.getElementById('mainAppView');
    const onboardingView = document.getElementById('onboardingView');
    const pinLockView = document.getElementById('pinLockView');

    // Hide everything first
    if (signInScreen) signInScreen.style.display = 'none';
    if (mainAppView) mainAppView.style.display = 'none';
    if (onboardingView) onboardingView.style.display = 'none';
    if (pinLockView) pinLockView.style.display = 'none';

    // Show only homepage (mode selection)
    if (homepageView) {
        homepageView.style.display = 'flex';
        homepageView.classList.add('active');
    }

    this.updateUserUI();
}

    /**
     * Update user UI elements
     */
    updateUserUI() {
        if (!this.currentUser) return;

        const displayNameEl = document.getElementById('userDisplayName');
        const photoEl = document.getElementById('userPhoto');

        if (displayNameEl) {
            displayNameEl.textContent = this.currentUser.displayName || 'User';
        }

        if (photoEl && this.currentUser.photoURL) {
            photoEl.src = this.currentUser.photoURL;
            photoEl.onerror = () => {
                photoEl.src = 'img/default-avatar.png';
            };
        }
    }

    /**
     * Show loading overlay
     */
    showLoading(message = 'Loading...') {
        const loader = document.getElementById('loadingOverlay');
        const messageEl = document.getElementById('loadingMessage');

        if (messageEl) {
            messageEl.textContent = message;
        }

        if (loader) {
            loader.style.display = 'flex';
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const loader = document.getElementById('loadingOverlay');
        if (loader) {
            loader.style.display = 'none';
        }
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Get user profile
     */
    getUserProfile() {
        return this.userProfile;
    }

    /**
     * Check if user is signed in
     */
    isSignedIn() {
        return this.currentUser !== null;
    }

    /**
     * Get user ID
     */
    getUserId() {
        return this.currentUser ? this.currentUser.uid : null;
    }
}

// Create and export global instance
window.authManager = new AuthManager();