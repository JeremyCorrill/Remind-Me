// COMPLETE REMINDER APP - Weeks 1-12
// Includes: Core features, Customization, Onboarding, Security, Testing optimizations

console.log('=== REMINDER APP v1.0 LOADING ===');

// ============= GLOBAL STATE =============
let reminders = [];
let completedToday = [];
let completedHistory = [];
let currentMode = null;
let currentPin = null;
let auditLog = [];
let onboardingComplete = false;
let currentOnboardingStep = 0;
let currentCommentReminderId = null;
let dayOfWeekChart = null;
let modeChart = null;
let trendChart = null;
// PHASE 1 & 2: New Global Variables
let customTemplates = [];
let voiceRecognition = null;
let isRecordingVoice = false;
let userProductivityPatterns = null;
let estimationData = [];
let authManager;
let reminderSync;
let caregiverAccess;


// Settings
let appSettings = {
    theme: 'default',
    fontSize: 'normal',
    soundEnabled: true,
    vibrationEnabled: true,
    voiceGuidance: false,
    pinEnabled: false,
    biometricEnabled: false,
    auditLogEnabled: false
};

// ============= BROWSER TEST MODE CHECK (MUST BE EARLY) =============
const IS_BROWSER = typeof cordova === 'undefined';
console.log('🔍 Environment check:', IS_BROWSER ? '🌐 BROWSER' : '📱 CORDOVA');

// If in browser, set up mock Cordova immediately
if (IS_BROWSER) {
    console.warn('⚠️ BROWSER TEST MODE - Setting up mocks');
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
}

document.addEventListener('deviceready', onDeviceReady, false);

// If browser, trigger deviceready immediately
if (IS_BROWSER) {
    setTimeout(() => {
        console.log('🧪 Triggering mock deviceready event');
        document.dispatchEvent(new Event('deviceready'));
    }, 100);
}

function setupAuthEventListeners() {
    // Sign-in button
    const signInBtn = document.getElementById('googleSignInBtn');
    if (signInBtn) {
        signInBtn.addEventListener('click', async () => {
            try {
                await authManager.signInWithGoogle();
                await onUserSignedIn();
            } catch (error) {
                console.error('Sign-in error:', error);
            }
        });
    }

    // Sign-out button
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to sign out?')) {
                await authManager.signOut();
                if (reminderSync) {
                    reminderSync.stopListening();
                }
            }
        });
    }
}

// NOW place onUserSignedIn OUTSIDE and AFTER setupAuthEventListeners
async function onUserSignedIn() {
    console.log('=== USER SIGNED IN - Post-Auth Setup ===');

    try {
        // Initialize cloud sync
        console.log('Initializing cloud sync...');
        reminderSync = new ReminderSync(authManager);
        reminderSync.initialize();

        // Initialize caregiver access
        console.log('Initializing caregiver access...');
        caregiverAccess = new CaregiverAccess(authManager);
        caregiverAccess.initialize();

        // Sync local reminders to cloud
        console.log('Syncing to cloud...');
        const result = await reminderSync.syncAllToCloud();
        console.log('Sync complete:', result);

        // NOW check for PIN lock
        if (appSettings.pinEnabled && currentPin) {
            console.log('PIN enabled - showing lock screen');
            showPinLock();
            return;
        }

        // Check onboarding status
        onboardingComplete = localStorage.getItem('onboardingComplete') === 'true';

        if (!onboardingComplete) {
            console.log('Onboarding needed - showing onboarding');
            showOnboarding();
        } else {
            console.log('Onboarding complete - mode selection already visible');
            // Don't call anything - showMainApp() already called by auth.js
        }

    } catch (error) {
        console.error('Post-signin setup error:', error);
    }
}

async function onDeviceReady() {
    console.log('=== DEVICE READY - Starting Initialization ===');

    try {
        // Special browser mode handling
        if (IS_BROWSER) {
            console.log('🧪 BROWSER MODE: Skipping authentication');

            // Load settings
            console.log('Step 1: Loading settings...');
            loadSettings();
            loadAuditLog();
            applyTheme(appSettings.theme);
            applyFontSize(appSettings.fontSize);

            // Setup event listeners
            console.log('Step 2: Setting up app listeners...');
            setupEventListeners();

            // Make functions globally accessible
            window.showSettings = showSettings;
            window.closeSettings = closeSettings;
            window.saveSettings = saveSettings;
            window.saveAndCloseSettings = saveAndCloseSettings;
            window.showTab = showTab;
            window.scheduleReminder = scheduleReminder;

            console.log('✅ Browser initialization complete');
            document.body.classList.add('initialized');

            // Check if onboarding is needed
            onboardingComplete = localStorage.getItem('onboardingComplete') === 'true';
            console.log('Onboarding status:', onboardingComplete ? 'completed' : 'needed');

            // Show mode selection after short delay
            setTimeout(() => {
                if (!onboardingComplete) {
                    console.log('🎓 Showing onboarding...');
                    showOnboarding();
                } else {
                    console.log('🎯 Showing mode selection screen...');
                    showMainApp();
                    // Attach mode card listeners
                    attachModeCardListeners();
                }
            }, 500);

            return;
        }

        // 1. Initialize AuthManager
        console.log('Step 1: Initializing AuthManager...');
        authManager = window.authManager;
        await authManager.initialize();
        console.log('âœ" AuthManager initialized');

        // 2. Setup auth event listeners
        console.log('Step 2: Setting up auth listeners...');
        setupAuthEventListeners();
        console.log('âœ" Auth listeners ready');

        // 3. Load settings EARLY
        console.log('Step 3: Loading settings...');
        loadSettings();
        loadAuditLog();
        applyTheme(appSettings.theme);
        applyFontSize(appSettings.fontSize);
        console.log('âœ" Settings loaded');

        // 4. Setup general event listeners
        console.log('Step 4: Setting up app listeners...');
        setupEventListeners();
        console.log('âœ" App listeners ready');

        // 5. Make critical functions globally accessible
        window.showSettings = showSettings;
        window.showTab = showTab;
        window.scheduleReminder = scheduleReminder;

        console.log('=== Initialization Complete - Waiting for auth state ===');

    } catch (error) {
        console.error('âŒ Initialization error:', error);
        alert('Failed to initialize app. Please restart.');
    }
    document.body.classList.add('initialized');
}

function showMainApp() {
    console.log('🏠 showMainApp() - Showing mode selection');

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

    // Show homepage (mode selection)
    if (homepageView) {
        homepageView.style.display = 'flex';
        homepageView.classList.add('active');
    }

    console.log('✅ Mode selection screen now visible');
}

function attachModeCardListeners() {
    console.log('🔗 Attaching mode card listeners...');
    const modeCards = document.querySelectorAll('.mode-card');

    if (modeCards.length === 0) {
        console.error('❌ No mode cards found!');
        setTimeout(() => attachModeCardListeners(), 500); // Retry after delay
        return;
    }

    console.log(`✓ Found ${modeCards.length} mode cards`);

    modeCards.forEach(card => {
        // Remove old listeners by cloning
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);

        // Add new click listener
        newCard.addEventListener('click', function() {
            const mode = this.getAttribute('data-mode');
            console.log(`🎯 Mode card clicked: ${mode}`);

            if (mode && typeof selectMode === 'function') {
                selectMode(mode);
            } else {
                console.error('❌ Cannot select mode:', mode);
            }
        });

        // Visual feedback
        newCard.style.cursor = 'pointer';
        newCard.style.transition = 'transform 0.2s';
        newCard.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
        });
        newCard.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });

    console.log('✅ Mode card listeners successfully attached');
}

// Make it globally accessible
window.showMainApp = showMainApp;

function initializeApp() {
    // Attach event listeners
    setupEventListeners();

    // Load mode
    const savedMode = localStorage.getItem('selectedMode');
    if (savedMode) {
        selectMode(savedMode);
    }

    logAudit('App initialized', 'system');
    console.log('✅ App initialized successfully');
}

// ============= PHASE 1: VOICE INPUT =============
function initializeVoiceInput() {
    const useVoiceCheckbox = document.getElementById('useVoiceInput');
    if (!useVoiceCheckbox) return;

    useVoiceCheckbox.addEventListener('change', function() {
        if (this.checked) {
            startVoiceInput();
        } else {
            stopVoiceInput();
        }
    });

    // Check if browser supports Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        voiceRecognition = new SpeechRecognition();
        voiceRecognition.continuous = false;
        voiceRecognition.interimResults = false;
        voiceRecognition.lang = 'en-US';

        voiceRecognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            console.log('Voice input:', transcript);

            // Show NLP input and populate it
            document.getElementById('nlpInput').style.display = 'block';
            document.getElementById('nlpText').value = transcript;

            // Auto-parse if confident
            parseNaturalLanguage();

            // Stop voice input
            document.getElementById('useVoiceInput').checked = false;
            stopVoiceInput();
        };

        voiceRecognition.onerror = function(event) {
            console.error('Voice recognition error:', event.error);
            alert('Voice recognition error: ' + event.error);
            document.getElementById('useVoiceInput').checked = false;
            stopVoiceInput();
        };
    } else {
        // Disable voice input if not supported
        useVoiceCheckbox.disabled = true;
        useVoiceCheckbox.parentElement.title = 'Voice input not supported in this browser';
    }
}

function startVoiceInput() {
    if (!voiceRecognition) {
        alert('Voice recognition not available');
        return;
    }

    isRecordingVoice = true;

    // Show recording indicator
    const indicator = document.createElement('div');
    indicator.id = 'voiceIndicator';
    indicator.className = 'voice-recording-indicator';
    indicator.textContent = 'Listening... Speak your reminder';
    document.querySelector('.input-section').insertBefore(indicator, document.getElementById('title'));

    try {
        voiceRecognition.start();
        logAudit('Voice input started', 'user');
    } catch (error) {
        console.error('Failed to start voice recognition:', error);
        stopVoiceInput();
    }
}

function stopVoiceInput() {
    isRecordingVoice = false;

    if (voiceRecognition) {
        try {
            voiceRecognition.stop();
        } catch (error) {
            console.log('Voice recognition already stopped');
        }
    }

    // Remove indicator
    const indicator = document.getElementById('voiceIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// ============= PHASE 1: NATURAL LANGUAGE PROCESSING =============
function parseNaturalLanguage() {
    const nlpText = document.getElementById('nlpText').value.trim().toLowerCase();

    if (!nlpText) {
        alert('Please enter a reminder description');
        return;
    }

    console.log('Parsing:', nlpText);

    // Extract title (everything before time/date indicators or "to" verb)
    let title = nlpText;
    let description = '';
    let datetime = null;
    let priority = 'medium';

    // Common patterns
    const patterns = {
        // "Remind me to [ACTION] [TIME]"
        remindMeTo: /remind me to (.*?)( at | on | tomorrow | today | next | in )/i,
        // "to [ACTION]"
        toAction: /^to (.*?)( at | on | tomorrow | today | next | in |$)/i,
        // Direct action
        action: /^(.*?)( at | on | tomorrow | today | next | in |$)/i
    };

    // Try to extract the main action
    for (const [name, pattern] of Object.entries(patterns)) {
        const match = nlpText.match(pattern);
        if (match && match[1]) {
            title = match[1].trim();
            title = title.charAt(0).toUpperCase() + title.slice(1);
            break;
        }
    }

    // Extract time/date
    const now = new Date();
    let targetDate = new Date();

    // Check for specific times
    const timeMatch = nlpText.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;

        targetDate.setHours(hours, minutes, 0, 0);

        // If time is in the past, move to tomorrow
        if (targetDate < now) {
            targetDate.setDate(targetDate.getDate() + 1);
        }
    }

    // Check for relative times
    if (nlpText.includes('tomorrow')) {
        targetDate.setDate(targetDate.getDate() + 1);
        if (!timeMatch) targetDate.setHours(9, 0, 0, 0); // Default to 9 AM
    } else if (nlpText.includes('today')) {
        if (!timeMatch) targetDate.setHours(now.getHours() + 1, 0, 0, 0); // 1 hour from now
    } else if (nlpText.match(/in (\d+) (hour|hours|minute|minutes)/i)) {
        const match = nlpText.match(/in (\d+) (hour|hours|minute|minutes)/i);
        const amount = parseInt(match[1]);
        const unit = match[2];

        if (unit.startsWith('hour')) {
            targetDate.setHours(targetDate.getHours() + amount);
        } else {
            targetDate.setMinutes(targetDate.getMinutes() + amount);
        }
    } else if (nlpText.match(/next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i)) {
        const match = nlpText.match(/next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
        const dayName = match[1].toLowerCase();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDay = days.indexOf(dayName);
        const currentDay = targetDate.getDay();
        let daysToAdd = (targetDay - currentDay + 7) % 7;
        if (daysToAdd === 0) daysToAdd = 7; // Next week

        targetDate.setDate(targetDate.getDate() + daysToAdd);
        if (!timeMatch) targetDate.setHours(9, 0, 0, 0);
    }

    // Check for priority keywords
    if (nlpText.includes('urgent') || nlpText.includes('important') || nlpText.includes('asap')) {
        priority = 'high';
    } else if (nlpText.includes('low priority') || nlpText.includes('when I can')) {
        priority = 'low';
    }

    // Populate form fields
    document.getElementById('title').value = title;
    document.getElementById('text').value = description || 'Created from voice/text input: ' + nlpText;

    // Format datetime for input
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const hours = String(targetDate.getHours()).padStart(2, '0');
    const minutes = String(targetDate.getMinutes()).padStart(2, '0');

    document.getElementById('datetime').value = `${year}-${month}-${day}T${hours}:${minutes}`;

    // Set priority if visible
    const priorityEl = document.getElementById('priority');
    if (priorityEl && priorityEl.style.display !== 'none') {
        priorityEl.value = priority;
    }

    // Clear NLP input
    document.getElementById('nlpText').value = '';
    document.getElementById('nlpInput').style.display = 'none';

    logAudit('Natural language parsed: ' + nlpText, 'user');
    alert('✓ Reminder details filled! Review and click Schedule.');
}

// Toggle NLP input visibility
function toggleNLPInput() {
    const nlpInput = document.getElementById('nlpInput');
    if (!nlpInput) return;

    const isVisible = nlpInput.style.display !== 'none';
    nlpInput.style.display = isVisible ? 'none' : 'block';
}

// ============= PHASE 1: TEMPLATE SYSTEM =============
function initializeTemplates() {
    loadCustomTemplates();
    loadBuiltInTemplates();
}

function loadCustomTemplates() {
    const saved = localStorage.getItem('customTemplates');
    if (saved) {
        customTemplates = JSON.parse(saved);
        updateTemplateSelect();
    }
}

function loadBuiltInTemplates() {
    // Built-in templates are defined in HTML, just ensure they're available
    console.log('Built-in templates loaded');
}

function updateTemplateSelect() {
    const select = document.getElementById('templateSelect');
    if (!select) return;

    // Add custom templates to select
    const existingCustomGroup = select.querySelector('optgroup[label="Custom Templates"]');
    if (existingCustomGroup) {
        existingCustomGroup.remove();
    }

    if (customTemplates.length > 0) {
        const customGroup = document.createElement('optgroup');
        customGroup.label = 'Custom Templates';

        customTemplates.forEach((template, index) => {
            const option = document.createElement('option');
            option.value = 'custom_' + index;
            option.textContent = template.name;
            customGroup.appendChild(option);
        });

        select.appendChild(customGroup);
    }
}

function loadTemplate() {
    const select = document.getElementById('templateSelect');
    const templateId = select.value;

    if (!templateId) return;

    let template = null;

    // Check if it's a custom template
    if (templateId.startsWith('custom_')) {
        const index = parseInt(templateId.replace('custom_', ''));
        template = customTemplates[index];
    } else {
        // Load built-in template
        template = getBuiltInTemplate(templateId);
    }

    if (!template) {
        console.error('Template not found:', templateId);
        return;
    }

    // Populate form with template data
    document.getElementById('title').value = template.title || '';
    document.getElementById('text').value = template.description || '';

    if (template.priority) {
        const priorityEl = document.getElementById('priority');
        if (priorityEl && priorityEl.style.display !== 'none') {
            priorityEl.value = template.priority;
        }
    }

    if (template.project) {
        const projectEl = document.getElementById('project');
        if (projectEl && projectEl.style.display !== 'none') {
            projectEl.value = template.project;
        }
    }

    if (template.defaultTime) {
        const now = new Date();
        now.setHours(template.defaultTime.hours, template.defaultTime.minutes, 0, 0);

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        document.getElementById('datetime').value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    // Load subtasks if template has them
    if (template.subtasks && template.subtasks.length > 0) {
        document.getElementById('subtasksSection').style.display = 'block';
        document.getElementById('subtasksList').innerHTML = '';

        template.subtasks.forEach(subtask => {
            addSubtaskToList(subtask);
        });
    }

    logAudit('Template loaded: ' + template.name, 'user');
}

function getBuiltInTemplate(templateId) {
    const templates = {
        // Work templates
        work_meeting: {
            name: 'Weekly Team Meeting',
            title: 'Weekly Team Meeting',
            description: 'Attend weekly team standup meeting',
            priority: 'high',
            project: 'work',
            defaultTime: { hours: 14, minutes: 0 },
            recurring: 'weekly'
        },
        work_deadline: {
            name: 'Project Deadline',
            title: 'Project Deadline',
            description: 'Submit project deliverables',
            priority: 'high',
            project: 'work'
        },
        work_invoice: {
            name: 'Invoice Due',
            title: 'Invoice Due',
            description: 'Send invoice to client',
            priority: 'medium',
            project: 'work'
        },
        work_review: {
            name: 'Performance Review',
            title: 'Performance Review',
            description: 'Prepare for and attend performance review meeting',
            priority: 'high',
            project: 'work'
        },

        // ADHD templates
        adhd_morning: {
            name: 'Morning Routine',
            title: 'Morning Routine',
            description: 'Complete morning routine',
            priority: 'high',
            defaultTime: { hours: 7, minutes: 0 },
            subtasks: ['Brush teeth', 'Take medication', 'Eat breakfast', 'Review today\'s tasks']
        },
        adhd_medication: {
            name: 'Take Medication',
            title: 'Take Medication',
            description: 'Remember to take ADHD medication',
            priority: 'high',
            defaultTime: { hours: 8, minutes: 0 }
        },
        adhd_pomodoro: {
            name: 'Pomodoro Session',
            title: 'Pomodoro Focus Session',
            description: '25 minutes of focused work',
            priority: 'medium',
            repeatInterval: 30
        },
        adhd_break: {
            name: 'Take Break',
            title: 'Take a Break',
            description: 'Step away and rest for 5 minutes',
            priority: 'medium',
            repeatInterval: 25
        },

        // Memory templates
        memory_pills: {
            name: 'Take Pills',
            title: 'Take Your Pills',
            description: 'Time to take your daily medication',
            priority: 'high',
            defaultTime: { hours: 9, minutes: 0 },
            requireAcknowledgment: true
        },
        memory_water: {
            name: 'Drink Water',
            title: 'Drink Water',
            description: 'Remember to stay hydrated',
            priority: 'medium',
            repeatInterval: 120
        },
        memory_call: {
            name: 'Call Caregiver',
            title: 'Call Caregiver',
            description: 'Time for daily check-in call',
            priority: 'high',
            defaultTime: { hours: 10, minutes: 0 }
        },
        memory_meal: {
            name: 'Meal Time',
            title: 'Meal Time',
            description: 'Time to eat',
            priority: 'high',
            defaultTime: { hours: 12, minutes: 0 }
        }
    };

    return templates[templateId] || null;
}

function showCreateTemplate() {
    document.getElementById('templateModal').classList.add('active');
}

function cancelTemplateCreation() {
    document.getElementById('templateModal').classList.remove('active');

    // Clear form
    document.getElementById('templateName').value = '';
    document.getElementById('templateTitle').value = '';
    document.getElementById('templateDescription').value = '';
    document.getElementById('templatePriority').value = 'medium';
    document.getElementById('templateCategory').value = 'work';
    document.getElementById('templateHasSubtasks').checked = false;
}

function saveCustomTemplate() {
    const name = document.getElementById('templateName').value.trim();
    const title = document.getElementById('templateTitle').value.trim();
    const description = document.getElementById('templateDescription').value.trim();
    const priority = document.getElementById('templatePriority').value;
    const category = document.getElementById('templateCategory').value;
    const hasSubtasks = document.getElementById('templateHasSubtasks').checked;

    if (!name || !title) {
        alert('Please provide a template name and title');
        return;
    }

    const template = {
        name: name,
        title: title,
        description: description,
        priority: priority,
        category: category,
        subtasks: hasSubtasks ? [] : null,
        createdAt: new Date().toISOString()
    };

    customTemplates.push(template);
    localStorage.setItem('customTemplates', JSON.stringify(customTemplates));

    updateTemplateSelect();
    cancelTemplateCreation();

    alert('✓ Template saved successfully!');
    logAudit('Custom template created: ' + name, 'user');
}

// ============= PHASE 1: SUBTASK SYSTEM =============
let currentSubtasks = [];

function initializeSubtasks() {
    // Show subtasks section when needed
    console.log('Subtasks system initialized');
}

function addSubtask() {
    const subtasksSection = document.getElementById('subtasksSection');
    const subtasksList = document.getElementById('subtasksList');

    subtasksSection.style.display = 'block';

    const subtaskItem = document.createElement('div');
    subtaskItem.className = 'subtask-item';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter subtask description';
    input.className = 'subtask-input';

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    removeBtn.type = 'button';
    removeBtn.onclick = function() {
        subtaskItem.remove();
        updateSubtasksCount();
    };

    subtaskItem.appendChild(input);
    subtaskItem.appendChild(removeBtn);
    subtasksList.appendChild(input);

    input.focus();
    updateSubtasksCount();
}

function addSubtaskToList(text) {
    const subtasksList = document.getElementById('subtasksList');

    const subtaskItem = document.createElement('div');
    subtaskItem.className = 'subtask-item';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = text;
    input.className = 'subtask-input';

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    removeBtn.type = 'button';
    removeBtn.onclick = function() {
        subtaskItem.remove();
        updateSubtasksCount();
    };

    subtaskItem.appendChild(input);
    subtaskItem.appendChild(removeBtn);
    subtasksList.appendChild(subtaskItem);

    updateSubtasksCount();
}

function getSubtasks() {
    const subtaskInputs = document.querySelectorAll('.subtask-input');
    const subtasks = [];

    subtaskInputs.forEach((input, index) => {
        const text = input.value.trim();
        if (text) {
            subtasks.push({
                id: Date.now() + index,
                text: text,
                completed: false,
                createdAt: new Date().toISOString()
            });
        }
    });

    return subtasks;
}

function updateSubtasksCount() {
    const inputs = document.querySelectorAll('.subtask-input');
    const count = Array.from(inputs).filter(i => i.value.trim()).length;

    if (count === 0) {
        document.getElementById('subtasksSection').style.display = 'none';
    }
}

function clearSubtasks() {
    const subtaskContainer = document.getElementById('subtaskContainer');
    if (subtaskContainer) {
        subtaskContainer.innerHTML = '';
    }
}

function displaySubtasks(reminder, container) {
    if (!reminder.subtasks || reminder.subtasks.length === 0) {
        return;
    }

    const subtaskSection = document.createElement('div');
    subtaskSection.className = 'subtask-section';
    subtaskSection.style.cssText = `
        margin-top: 10px;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 6px;
        border-left: 3px solid #007bff;
    `;

    subtaskSection.innerHTML = `
        <strong style="font-size: 14px;">âœ… Subtasks (${reminder.subtasks.filter(s => s.completed).length}/${reminder.subtasks.length})</strong>
    `;

    const subtaskList = document.createElement('div');
    subtaskList.style.marginTop = '8px';

    reminder.subtasks.forEach(subtask => {
        const subtaskItem = document.createElement('div');
        subtaskItem.style.cssText = `
            display: flex;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid #dee2e6;
        `;

        subtaskItem.innerHTML = `
            <input type="checkbox"
                   ${subtask.completed ? 'checked' : ''}
                   onchange="toggleSubtask(${reminder.id}, ${subtask.id})"
                   style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
            <span style="${subtask.completed ? 'text-decoration: line-through; color: #6c757d;' : ''} flex: 1;">
                ${subtask.text}
            </span>
        `;

        subtaskList.appendChild(subtaskItem);
    });

    subtaskSection.appendChild(subtaskList);
    container.appendChild(subtaskSection);
}

function toggleSubtask(reminderId, subtaskId) {
    const reminder = reminders.find(r => r.id === reminderId);
    if (!reminder || !reminder.subtasks) return;

    const subtask = reminder.subtasks.find(s => s.id === subtaskId);
    if (!subtask) return;

    subtask.completed = !subtask.completed;
    subtask.completedAt = subtask.completed ? new Date().toISOString() : null;

    // Save changes
    localStorage.setItem('reminders', JSON.stringify(reminders));

    // Sync to cloud if available
    if (reminderSync && reminderSync.isSyncEnabled()) {
        reminderSync.updateReminder(reminder).catch(err => {
            console.error('Failed to sync subtask update:', err);
        });
    }

    // Refresh display
    addReminderToList(reminder);

    // Check if all subtasks completed
    const allCompleted = reminder.subtasks.every(s => s.completed);
    if (allCompleted) {
        showQuickFeedback(`ðŸŽ‰ All subtasks completed for "${reminder.title}"!`);
    }

    logAudit(`Subtask toggled in: ${reminder.title}`, 'user');
}

// ============= PHASE 1: SMART SCHEDULING ASSISTANT =============
function initializeSmartScheduling() {
    analyzeProductivityPatterns();
}

function analyzeProductivityPatterns() {
    // Analyze completion history to find patterns
    const completed = reminders.filter(r => r.completed && r.completedDate);

    if (completed.length < 5) {
        userProductivityPatterns = null;
        return;
    }

    const hourCounts = {};
    const dayCounts = {};

    completed.forEach(r => {
        const completedDate = new Date(r.completedDate);
        const hour = completedDate.getHours();
        const day = completedDate.getDay();

        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        dayCounts[day] = (dayCounts[day] || 0) + 1;
    });

    // Find peak productivity hours
    const peakHour = Object.keys(hourCounts).reduce((a, b) =>
        hourCounts[a] > hourCounts[b] ? a : b
    );

    // Find best days
    const bestDay = Object.keys(dayCounts).reduce((a, b) =>
        dayCounts[a] > dayCounts[b] ? a : b
    );

    userProductivityPatterns = {
        peakHour: parseInt(peakHour),
        bestDay: parseInt(bestDay),
        hourCounts: hourCounts,
        dayCounts: dayCounts
    };

    console.log('Productivity patterns analyzed:', userProductivityPatterns);
}

function showSmartSuggestions(taskTitle) {
    if (!userProductivityPatterns) {
        console.log('Not enough data for suggestions');
        return;
    }

    const suggestions = generateSmartSuggestions(taskTitle);

    if (suggestions.length === 0) {
        return;
    }

    const modal = document.getElementById('smartSuggestionsModal');
    const list = document.getElementById('smartSuggestionsList');

    list.innerHTML = suggestions.map((suggestion, index) => `
        <div class="smart-suggestion-card" onclick="applySuggestion(${index})">
            <h4>${suggestion.title}</h4>
            <p><strong>Suggested Time:</strong> ${suggestion.time}</p>
            <p class="suggestion-reason">${suggestion.reason}</p>
        </div>
    `).join('');

    modal.classList.add('active');

    // Store suggestions temporarily
    window.currentSuggestions = suggestions;
}

function generateSmartSuggestions(taskTitle) {
    const suggestions = [];
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Suggestion 1: Peak productivity hour today
    if (userProductivityPatterns.peakHour) {
        const peakTime = new Date(now);
        peakTime.setHours(userProductivityPatterns.peakHour, 0, 0, 0);

        if (peakTime > now) {
            suggestions.push({
                title: '🎯 Peak Productivity Time',
                time: peakTime.toLocaleString(),
                datetime: peakTime,
                reason: `You typically complete most tasks around ${userProductivityPatterns.peakHour}:00. Schedule during your peak focus time!`
            });
        }
    }

    // Suggestion 2: Best day of week
    if (userProductivityPatterns.bestDay !== undefined) {
        const bestDayDate = new Date(now);
        const currentDay = now.getDay();
        let daysToAdd = (userProductivityPatterns.bestDay - currentDay + 7) % 7;
        if (daysToAdd === 0) daysToAdd = 7; // Next week

        bestDayDate.setDate(bestDayDate.getDate() + daysToAdd);
        bestDayDate.setHours(userProductivityPatterns.peakHour || 10, 0, 0, 0);

        suggestions.push({
            title: '📅 Your Best Day',
            time: bestDayDate.toLocaleString(),
            datetime: bestDayDate,
            reason: `${dayNames[userProductivityPatterns.bestDay]} is your most productive day based on completion history.`
        });
    }

    // Suggestion 3: Tomorrow morning (fresh start)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    suggestions.push({
        title: '🌅 Fresh Start Tomorrow',
        time: tomorrow.toLocaleString(),
        datetime: tomorrow,
        reason: 'Start your day with this task for maximum focus and energy.'
    });

    // Suggestion 4: Check for conflicts
    const upcomingReminders = reminders.filter(r => {
        const remindDate = new Date(r.datetime);
        return !r.completed && remindDate > now && remindDate < new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    });

    if (upcomingReminders.length > 0) {
        // Find a gap in schedule
        upcomingReminders.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

        // Look for 2-hour gap
        for (let i = 0; i < upcomingReminders.length - 1; i++) {
            const current = new Date(upcomingReminders[i].datetime);
            const next = new Date(upcomingReminders[i + 1].datetime);
            const gap = (next - current) / (1000 * 60 * 60); // hours

            if (gap >= 2) {
                const gapTime = new Date(current.getTime() + (60 * 60 * 1000)); // 1 hour after current

                suggestions.push({
                    title: '📊 Fill Schedule Gap',
                    time: gapTime.toLocaleString(),
                    datetime: gapTime,
                    reason: `Found a ${Math.floor(gap)}-hour gap in your schedule. Optimal time to fit this in!`
                });
                break;
            }
        }
    }

    return suggestions.slice(0, 4); // Return top 4 suggestions
}

function applySuggestion(index) {
    const suggestion = window.currentSuggestions[index];

    if (!suggestion) return;

    const datetime = suggestion.datetime;
    const year = datetime.getFullYear();
    const month = String(datetime.getMonth() + 1).padStart(2, '0');
    const day = String(datetime.getDate()).padStart(2, '0');
    const hours = String(datetime.getHours()).padStart(2, '0');
    const minutes = String(datetime.getMinutes()).padStart(2, '0');

    document.getElementById('datetime').value = `${year}-${month}-${day}T${hours}:${minutes}`;

    closeSmartSuggestions();

    alert('✓ Smart suggestion applied! Review and schedule.');
    logAudit('Smart suggestion applied: ' + suggestion.title, 'user');
}

function closeSmartSuggestions() {
    const modal = document.getElementById('smartSuggestionsModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    window.currentSuggestions = null;
}

// Detect conflicts
function detectScheduleConflicts(datetime) {
    const newTime = new Date(datetime);
    const conflicts = [];

    reminders.filter(r => !r.completed).forEach(r => {
        const existingTime = new Date(r.datetime);
        const timeDiff = Math.abs(newTime - existingTime) / (1000 * 60); // minutes

        if (timeDiff < 30) { // Within 30 minutes
            conflicts.push(r);
        }
    });

    return conflicts;
}

// ============= PHASE 1: RECURRING PATTERNS =============
function handleRecurringChange() {
    const pattern = document.getElementById('recurringPattern').value;
    const customOptions = document.getElementById('customRecurringOptions');

    if (pattern === 'custom') {
        customOptions.style.display = 'block';
    } else {
        customOptions.style.display = 'none';
    }
}

function getRecurringPattern() {
    const pattern = document.getElementById('recurringPattern').value;

    if (pattern === 'none') {
        return null;
    }

    const recurringData = {
        pattern: pattern,
        enabled: true
    };

    if (pattern === 'custom') {
        const checkedDays = Array.from(document.querySelectorAll('.day-selector input:checked'))
            .map(input => parseInt(input.value));

        if (checkedDays.length === 0) {
            return null;
        }

        recurringData.customDays = checkedDays;
    }

    return recurringData;
}

function scheduleRecurringReminder(baseReminder, pattern) {
    // This will create multiple scheduled notifications based on pattern
    const baseDate = new Date(baseReminder.datetime);
    const now = new Date();
    const endDate = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000)); // 90 days ahead

    const recurringDates = [];

    switch(pattern.pattern) {
        case 'daily':
            for (let d = new Date(baseDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                if (d > now) {
                    recurringDates.push(new Date(d));
                }
            }
            break;

        case 'weekdays':
            for (let d = new Date(baseDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const day = d.getDay();
                if (d > now && day >= 1 && day <= 5) {
                    recurringDates.push(new Date(d));
                }
            }
            break;

        case 'weekends':
            for (let d = new Date(baseDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const day = d.getDay();
                if (d > now && (day === 0 || day === 6)) {
                    recurringDates.push(new Date(d));
                }
            }
            break;

        case 'weekly':
            for (let d = new Date(baseDate); d <= endDate; d.setDate(d.getDate() + 7)) {
                if (d > now) {
                    recurringDates.push(new Date(d));
                }
            }
            break;

        case 'biweekly':
            for (let d = new Date(baseDate); d <= endDate; d.setDate(d.getDate() + 14)) {
                if (d > now) {
                    recurringDates.push(new Date(d));
                }
            }
            break;

        case 'monthly':
            for (let d = new Date(baseDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
                if (d > now) {
                    recurringDates.push(new Date(d));
                }
            }
            break;

        case 'custom':
            if (pattern.customDays) {
                for (let d = new Date(baseDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                    if (d > now && pattern.customDays.includes(d.getDay())) {
                        recurringDates.push(new Date(d));
                    }
                }
            }
            break;
    }

    // Schedule first 30 occurrences (to avoid overwhelming notification system)
    const limit = Math.min(recurringDates.length, 30);

    for (let i = 0; i < limit; i++) {
        const scheduleDate = recurringDates[i];
        const recurringId = parseInt(`${baseReminder.id}${i + 1}`);

        cordova.plugins.notification.local.schedule({
            id: recurringId,
            title: `🔁 ${baseReminder.title}`,
            text: baseReminder.text,
            trigger: { at: scheduleDate },
            foreground: true
        });
    }

    console.log(`Scheduled ${limit} recurring reminders`);
    return recurringDates.length;
}

// ============= PHASE 1: LOCATION-BASED REMINDERS =============
function initializeLocationFeatures() {
    const useLocationCheckbox = document.getElementById('useLocation');
    if (!useLocationCheckbox) return;

    useLocationCheckbox.addEventListener('change', function() {
        const locationOptions = document.getElementById('locationOptions');
        locationOptions.style.display = this.checked ? 'block' : 'none';
    });
}

function getCurrentLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            // Use reverse geocoding to get address (would need API in production)
            document.getElementById('locationAddress').value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

            alert('✓ Current location captured!');
            logAudit('Location captured: ' + lat + ',' + lon, 'user');
        },
        (error) => {
            console.error('Geolocation error:', error);
            alert('Could not get location: ' + error.message);
        }
    );
}

function getLocationData() {
    const useLocation = document.getElementById('useLocation').checked;

    if (!useLocation) return null;

    const address = document.getElementById('locationAddress').value.trim();
    const trigger = document.getElementById('locationTrigger').value;

    if (!address) return null;

    return {
        address: address,
        trigger: trigger, // 'arrive' or 'leave'
        enabled: true
    };
}

// ============= EVENT LISTENERS =============
function setupEventListeners() {
    console.log('ðŸ"Œ setupEventListeners() called');

    // Mode card click handlers
    const modeCards = document.querySelectorAll('.mode-card');
    console.log('  â† Mode cards found:', modeCards.length);
    modeCards.forEach((card) => {
        card.addEventListener('click', function() {
            const mode = this.getAttribute('data-mode');
            if (mode) {
                selectMode(mode);
                logAudit(`Selected mode: ${mode}`, 'user');
            }
        });
    });

    // Settings button


    const settingsBtn = document.getElementById('settingsBtnTab');
    console.log('  â† Settings button:', settingsBtn ? 'found' : 'NOT FOUND');
    if (settingsBtn) {
        // Remove any existing listeners first
        const newSettingsBtn = settingsBtn.cloneNode(true);
        settingsBtn.parentNode.replaceChild(newSettingsBtn, settingsBtn);

        // Add listener with proper scope
        newSettingsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('ðŸ–±ï¸ SETTINGS BUTTON CLICKED');
            showSettings();
        });

        // Also ensure the function is globally accessible
        window.showSettings = showSettings;
    }

    // Tab buttons
    const tabs = document.querySelectorAll('.nav-tab');
    console.log('  â† Nav tabs found:', tabs.length);
    tabs.forEach((tab, index) => {
        const tabName = tab.getAttribute('data-tab');
        console.log(`     Tab ${index}: ${tabName}`);
        tab.addEventListener('click', function() {
            const clickedTab = this.getAttribute('data-tab');
            console.log('ðŸ–±ï¸ TAB CLICKED:', clickedTab);
            showTab(clickedTab);
        });
    });

    // Schedule button
    const scheduleBtn = document.getElementById('scheduleBtn');
    console.log('  â† Schedule button:', scheduleBtn ? 'found' : 'NOT FOUND');
    if (scheduleBtn) {
        scheduleBtn.addEventListener('click', function() {
            console.log('ðŸ–±ï¸ SCHEDULE BUTTON CLICKED');
            scheduleReminder();
        });
    }

    // Filter/Search button
    const filterBtn = document.getElementById('filterBtn');
    console.log('  â† Filter button:', filterBtn ? 'found' : 'NOT FOUND');
    if (filterBtn) {
        filterBtn.addEventListener('click', function() {
            openSearch();
        });
    }

    // Export button
    const exportBtn = document.getElementById('exportBtn');
    console.log('  â† Export button:', exportBtn ? 'found' : 'NOT FOUND');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            exportAllData();
        });
    }

    // Tutorial button
    const tutorialBtn = document.getElementById('tutorialBtn');
    console.log('  â† Tutorial button:', tutorialBtn ? 'found' : 'NOT FOUND');
    if (tutorialBtn) {
        tutorialBtn.addEventListener('click', function() {
            restartTutorial();
        });
    }

    // Settings modal close button
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    console.log('  Close settings button:', closeSettingsBtn ? 'found' : 'NOT FOUND');
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('CLOSE SETTINGS CLICKED');
            closeSettings();
        });
    }

    // Settings modal save button
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    console.log('  Save settings button:', saveSettingsBtn ? 'found' : 'NOT FOUND');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('SAVE SETTINGS CLICKED');
            saveAndCloseSettings(); // Use the save AND close function
        });
    }

    console.log('âœ… setupEventListeners() complete');
}



// ============= MODE MANAGEMENT =============
function selectMode(mode) {
    console.log('🎯 SELECT MODE:', mode);

    currentMode = mode;
    localStorage.setItem('selectedMode', mode);

    document.body.className = mode + '-mode';
    applyTheme(appSettings.theme);

    // Hide homepage, show app
    const homepage = document.getElementById('homepageView');
    const mainApp = document.getElementById('mainAppView');

    if (homepage && mainApp) {
        console.log('🔄 Switching from homepage to main app');
        homepage.classList.remove('active');
        homepage.style.display = 'none';
        mainApp.classList.add('active');
        mainApp.style.display = 'block';
        console.log('✅ Main app now visible');
    } else {
        console.error('❌ Homepage or mainApp not found!');
        if (!homepage) console.error('  - homepage element missing');
        if (!mainApp) console.error('  - mainApp element missing');
    }

    setupModeUI(mode);
    loadReminders();

    // Initialize mode-specific module
    if (mode === 'adhd' && typeof ADHDMode !== 'undefined') {
        ADHDMode.init();
    } else if (mode === 'work' && typeof WorkMode !== 'undefined') {
        WorkMode.init();
    } else if (mode === 'memory' && typeof MemoryMode !== 'undefined') {
        MemoryMode.init();
    }

    logAudit(`Mode activated: ${mode}`, 'user');
    console.log('✅ Mode loaded:', mode);
}

function setupModeUI(mode) {
    const elements = {
        modeTitle: document.getElementById('modeTitle'),
        prioritySection: document.getElementById('prioritySection'),
        memoryOptions: document.getElementById('memoryOptions'),
        projectSection: document.getElementById('projectSection'),
        adhdEscalation: document.getElementById('adhdEscalation'),
        streakCard: document.getElementById('streakCard')
    };

    // Hide all mode-specific sections
    if (elements.prioritySection) elements.prioritySection.style.display = 'none';
    if (elements.memoryOptions) elements.memoryOptions.style.display = 'none';
    if (elements.projectSection) elements.projectSection.style.display = 'none';
    if (elements.adhdEscalation) elements.adhdEscalation.style.display = 'none';
    if (elements.streakCard) elements.streakCard.style.display = 'none';

    switch(mode) {
        case 'work':
            if (elements.modeTitle) elements.modeTitle.textContent = 'Work Mode 💼';
            if (elements.prioritySection) elements.prioritySection.style.display = 'block';
            if (elements.projectSection) elements.projectSection.style.display = 'block';
            break;

        case 'adhd':
            if (elements.modeTitle) elements.modeTitle.textContent = 'ADHD Mode ⚡';
            if (elements.prioritySection) elements.prioritySection.style.display = 'block';
            if (elements.adhdEscalation) elements.adhdEscalation.style.display = 'block';
            if (elements.streakCard) elements.streakCard.style.display = 'block';
            break;

        case 'memory':
            if (elements.modeTitle) elements.modeTitle.textContent = 'Memory Mode 🧠';
            if (elements.memoryOptions) elements.memoryOptions.style.display = 'block';
            break;
    }
}

function changeMode() {
    if (confirm('Change mode? Your reminders will be kept.')) {
        const homepage = document.getElementById('homepageView');
        const mainApp = document.getElementById('mainAppView');

        if (homepage && mainApp) {
            homepage.classList.add('active');
            homepage.style.display = 'block';
            mainApp.classList.remove('active');
            mainApp.style.display = 'none';
        }

        closeSettings();
        logAudit('Returned to mode selection', 'user');
    }
}

// ============= WEEK 8: CUSTOMIZATION & ACCESSIBILITY =============

function changeTheme() {
    const theme = document.getElementById('themeSelect').value;
    appSettings.theme = theme;
    applyTheme(theme);
    saveSettings();
    logAudit(`Theme changed to: ${theme}`, 'user');
}

function applyTheme(theme) {
    // Remove all theme classes
    document.body.classList.remove('dark-theme', 'high-contrast-theme', 'colorblind-theme');

    // Apply selected theme
    switch(theme) {
        case 'dark':
            document.body.classList.add('dark-theme');
            break;
        case 'high-contrast':
            document.body.classList.add('high-contrast-theme');
            break;
        case 'colorblind':
            document.body.classList.add('colorblind-theme');
            break;
    }

    console.log('Theme applied:', theme);
}

function changeFontSize() {
    const size = document.getElementById('fontSize').value;
    appSettings.fontSize = size;
    applyFontSize(size);
    saveSettings();
    logAudit(`Font size changed to: ${size}`, 'user');
}

function applyFontSize(size) {
    document.body.classList.remove('font-large', 'font-xlarge');
    if (size === 'large') {
        document.body.classList.add('font-large');
    } else if (size === 'xlarge') {
        document.body.classList.add('font-xlarge');
    }
}

function speakText(text) {
    if (!appSettings.voiceGuidance) return;

    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        window.speechSynthesis.speak(utterance);
        console.log('Speaking:', text);
    }
}

// ============= WEEK 9: ONBOARDING & TUTORIAL =============

function checkOnboarding() {
    onboardingComplete = localStorage.getItem('onboardingComplete') === 'true';

    if (!onboardingComplete) {
        showOnboarding();
    } else {
        // If onboarding is complete, just show the mode selection
        // (which should already be visible from showMainApp)
        console.log('Onboarding already complete');
    }
}

function showOnboarding() {
    const onboardingView = document.getElementById('onboardingView');
    const homepage = document.getElementById('homepageView');
    const mainApp = document.getElementById('mainAppView');

    // Hide everything else
    if (homepage) {
        homepage.classList.remove('active');
        homepage.style.display = 'none';
    }
    if (mainApp) {
        mainApp.classList.remove('active');
        mainApp.style.display = 'none';
    }

    // Show onboarding
    if (onboardingView) {
        onboardingView.classList.add('active');
        onboardingView.style.display = 'block';
    }

    currentOnboardingStep = 0;
    showOnboardingStep(0);

    // Setup onboarding buttons - remove old listeners first
    const nextBtn = document.getElementById('onboardingNext');
    const skipBtn = document.getElementById('onboardingSkip');

    if (nextBtn) {
        // Clone to remove old listeners
        const newNextBtn = nextBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
        newNextBtn.addEventListener('click', nextOnboardingStep);
    }

    if (skipBtn) {
        // Clone to remove old listeners
        const newSkipBtn = skipBtn.cloneNode(true);
        skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);
        newSkipBtn.addEventListener('click', skipOnboarding);
    }
}

function showOnboardingStep(step) {
    const steps = [
        {
            title: 'Welcome to Reminder App! 👋',
            content: 'This quick tutorial will help you get started. Choose your mode and create your first reminder in just a few steps!',
            progress: 20
        },
        {
            title: 'Choose Your Mode',
            content: 'Select Work Mode for professional tasks, ADHD Mode for focus-friendly reminders, or Memory Mode for supportive care.',
            progress: 40
        },
        {
            title: 'Create a Reminder',
            content: 'Fill in the title, description, and due date. You can also set priorities, repeat intervals, and more!',
            progress: 60
        },
        {
            title: 'Complete & Track',
            content: 'Mark tasks as complete to see them in the Completed tab. View your progress and analytics!',
            progress: 80
        },
        {
            title: 'You\'re All Set! 🎉',
            content: 'You\'re ready to stay organized! Access settings anytime by clicking the ⚙️ icon. Let\'s get started!',
            progress: 100
        }
    ];

    if (step >= steps.length) {
        completeOnboarding();
        return;
    }

    const stepData = steps[step];
    const content = document.getElementById('onboardingContent');
    const progress = document.getElementById('onboardingProgress');
    const stepText = document.getElementById('onboardingStep');

    content.innerHTML = `
        <h2>${stepData.title}</h2>
        <p>${stepData.content}</p>
    `;

    progress.style.width = stepData.progress + '%';
    stepText.textContent = `Step ${step + 1} of ${steps.length}`;

    if (appSettings.voiceGuidance) {
        speakText(stepData.title + '. ' + stepData.content);
    }

    currentOnboardingStep = step;
}

function nextOnboardingStep() {
    showOnboardingStep(currentOnboardingStep + 1);
}

function skipOnboarding() {
    if (confirm('Skip the tutorial? You can restart it anytime from Settings.')) {
        completeOnboarding();
    }
}

function completeOnboarding() {
    localStorage.setItem('onboardingComplete', 'true');
    onboardingComplete = true;

    const onboardingView = document.getElementById('onboardingView');
    const homepage = document.getElementById('homepageView');

    if (onboardingView && homepage) {
        onboardingView.classList.remove('active');
        onboardingView.style.display = 'none';
        homepage.classList.add('active');
        homepage.style.display = 'block';
    }

    logAudit('Onboarding completed', 'system');
}

function restartTutorial() {
    // Add confirmation dialog
    if (confirm('Would you like to restart the tutorial?\n\nThis will guide you through all features of the app.')) {
        // User clicked OK - start tutorial
        currentOnboardingStep = 0;
        showOnboarding(); // Fixed: was startOnboarding()
        logAudit('Tutorial restarted', 'user');
    } else {
        // User clicked Cancel - do nothing
        console.log('Tutorial restart cancelled by user');
    }
}

// ============= WEEK 10: SECURITY & PIN/BIOMETRIC =============

function togglePinLock() {
    const enabled = document.getElementById('pinEnabled').checked;
    appSettings.pinEnabled = enabled;

    const setPinBtn = document.getElementById('setPinBtn');
    const changePinBtn = document.getElementById('changePinBtn');

    if (enabled) {
        if (!currentPin) {
            setPinBtn.style.display = 'block';
            changePinBtn.style.display = 'none';
        } else {
            setPinBtn.style.display = 'none';
            changePinBtn.style.display = 'block';
        }
    } else {
        setPinBtn.style.display = 'none';
        changePinBtn.style.display = 'none';
        currentPin = null;
        localStorage.removeItem('appPin');
    }

    saveSettings();
    logAudit(`PIN lock ${enabled ? 'enabled' : 'disabled'}`, 'security');
}

function setupPin() {
    const pin = prompt('Set a 4-digit PIN:');
    if (pin && /^\d{4}$/.test(pin)) {
        const confirmPin = prompt('Confirm PIN:');
        if (pin === confirmPin) {
            // In production, hash the PIN
            currentPin = pin;
            localStorage.setItem('appPin', btoa(pin)); // Basic encoding (use proper encryption in production)
            alert('✅ PIN set successfully!');

            document.getElementById('setPinBtn').style.display = 'none';
            document.getElementById('changePinBtn').style.display = 'block';

            logAudit('PIN created', 'security');
        } else {
            alert('PINs do not match. Please try again.');
        }
    } else {
        alert('Please enter a valid 4-digit PIN.');
    }
}

function changePin() {
    const oldPin = prompt('Enter current PIN:');
    if (oldPin === currentPin) {
        setupPin();
    } else {
        alert('❌ Incorrect PIN');
        logAudit('Failed PIN change attempt', 'security');
    }
}

let enteredPin = '';

function showPinLock() {
    console.log('=== SHOWING PIN LOCK ===');
    const pinLockView = document.getElementById('pinLockView');
    const homepage = document.getElementById('homepageView');
    const mainApp = document.getElementById('mainAppView');
    const signInScreen = document.getElementById('signInScreen');
    const onboardingView = document.getElementById('onboardingView');

    // Hide everything
    if (homepage) {
        homepage.style.display = 'none';
        homepage.classList.remove('active');
    }
    if (mainApp) {
        mainApp.style.display = 'none';
        mainApp.classList.remove('active');
    }
    if (signInScreen) {
        signInScreen.style.display = 'none';
    }
    if (onboardingView) {
        onboardingView.style.display = 'none';
        onboardingView.classList.remove('active');
    }

    // Show PIN lock
    if (pinLockView) {
        pinLockView.classList.add('active');
        pinLockView.style.display = 'block';
        enteredPin = '';
        updatePinDisplay();
    }
}

function enterPin(digit) {
    if (enteredPin.length < 4) {
        enteredPin += digit;
        updatePinDisplay();

        if (enteredPin.length === 4) {
            checkPin();
        }
    }
}

function clearPin() {
    enteredPin = '';
    updatePinDisplay();
    document.getElementById('pinError').style.display = 'none';
}

function updatePinDisplay() {
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById('pin' + i);
        if (dot) {
            dot.classList.toggle('filled', i <= enteredPin.length);
        }
    }
}

function checkPin() {
    const savedPin = localStorage.getItem('appPin');
    const decodedPin = savedPin ? atob(savedPin) : null;

    if (enteredPin === decodedPin) {
        unlockApp();
        logAudit('Successful PIN unlock', 'security');
    } else {
        document.getElementById('pinError').textContent = '❌ Incorrect PIN';
        document.getElementById('pinError').style.display = 'block';
        enteredPin = '';
        updatePinDisplay();
        logAudit('Failed PIN attempt', 'security');

        setTimeout(() => {
            document.getElementById('pinError').style.display = 'none';
        }, 2000);
    }
}

function unlockApp() {
    console.log('=== UNLOCKING APP ===');
    const pinLockView = document.getElementById('pinLockView');
    if (pinLockView) {
        pinLockView.classList.remove('active');
        pinLockView.style.display = 'none';
    }

    // Check onboarding
    onboardingComplete = localStorage.getItem('onboardingComplete') === 'true';

    if (!onboardingComplete) {
        showOnboarding();
    } else {
        // Show mode selection (should have been set by showMainApp earlier)
        const homepage = document.getElementById('homepageView');
        if (homepage) {
            homepage.style.display = 'flex';
            homepage.classList.add('active');
        }
    }
}

function useBiometric() {
    // In production, use cordova-plugin-fingerprint-aio or similar
    alert('Biometric authentication would verify fingerprint/face here');

    // Simulate success
    if (confirm('Simulate successful biometric auth?')) {
        unlockApp();
        logAudit('Biometric unlock (simulated)', 'security');
    }
}

function toggleBiometric() {
    appSettings.biometricEnabled = document.getElementById('biometricEnabled').checked;
    saveSettings();
    logAudit(`Biometric ${appSettings.biometricEnabled ? 'enabled' : 'disabled'}`, 'security');
}

// ============= AUDIT LOG (Week 10) =============

function logAudit(action, category) {
    if (!appSettings.auditLogEnabled && category !== 'security') return;

    const entry = {
        timestamp: new Date().toISOString(),
        action: action,
        category: category,
        mode: currentMode,
        user: 'current_user' // In production, use actual user ID
    };

    auditLog.push(entry);

    // Keep only last 1000 entries
    if (auditLog.length > 1000) {
        auditLog = auditLog.slice(-1000);
    }

    localStorage.setItem('auditLog', JSON.stringify(auditLog));
}

function loadAuditLog() {
    try {
        auditLog = JSON.parse(localStorage.getItem('auditLog') || '[]');
    } catch (error) {
        console.error('Failed to load audit log:', error);
        auditLog = [];
    }
}

function viewAuditLog() {
    const modal = document.getElementById('auditLogModal');
    const content = document.getElementById('auditLogContent');

    if (!modal || !content) return;

    if (auditLog.length === 0) {
        content.innerHTML = '<p>No audit log entries yet.</p>';
    } else {
        let html = '<div class="audit-entries">';
        auditLog.slice(-50).reverse().forEach(entry => {
            const date = new Date(entry.timestamp).toLocaleString();
            html += `
                <div class="audit-entry">
                    <span class="audit-time">${date}</span>
                    <span class="audit-category">[${entry.category}]</span>
                    <span class="audit-action">${entry.action}</span>
                </div>
            `;
        });
        html += '</div>';
        content.innerHTML = html;
    }

    modal.classList.add('active');
}

function closeAuditLog() {
    const modal = document.getElementById('auditLogModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

function exportAuditLog() {
    const csv = 'Timestamp,Category,Action,Mode\n' +
        auditLog.map(e => `"${e.timestamp}","${e.category}","${e.action}","${e.mode || 'N/A'}"`).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();

    logAudit('Audit log exported', 'system');
}

// ============= SETTINGS MANAGEMENT =============

function loadSettings() {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
        appSettings = JSON.parse(saved);
    }

    // FORCE audit log to always be enabled
    appSettings.auditLogEnabled = true;

    // Save to ensure it's persisted
    saveSettings();
}

function saveSettings() {
    // This is called by onChange events - just save without closing
    appSettings.soundEnabled = document.getElementById('soundEnabled')?.checked ?? true;
    appSettings.vibrationEnabled = document.getElementById('vibrationEnabled')?.checked ?? true;
    appSettings.voiceGuidance = document.getElementById('voiceGuidance')?.checked ?? false;
    appSettings.auditLogEnabled = true;

    localStorage.setItem('appSettings', JSON.stringify(appSettings));
    applyTheme(appSettings.theme);
    applyFontSize(appSettings.fontSize);
    console.log('Settings auto-saved');
}

function saveAndCloseSettings() {
    // This is called by the Save button - save AND close
    saveSettings(); // Save the settings
    closeSettings(); // Close the modal
    showQuickFeedback('✓ Settings saved');
    logAudit('Settings saved', 'user');
}

// ============= REMINDER MANAGEMENT =============

async function scheduleReminder() {  // ← Add async here
    const title = document.getElementById('title').value.trim();
    const text = document.getElementById('text').value.trim();
    const datetimeStr = document.getElementById('datetime').value;

    if (!title || !text || !datetimeStr) {
        alert('Please fill in all required fields');
        return;
    }

    const datetime = new Date(datetimeStr);
    if (isNaN(datetime.getTime())) {
        alert('Invalid date/time.');
        return;
    }

    // Check for conflicts
    const conflicts = detectScheduleConflicts(datetime);
    if (conflicts.length > 0) {
        const conflictTitles = conflicts.map(r => r.title).join(', ');
        if (!confirm(`Warning: This conflicts with: ${conflictTitles}.\n\nSchedule anyway?`)) {
            return;
        }
    }

    const id = Date.now();

    // Get priority
    const priorityEl = document.getElementById('priority');
    const priority = priorityEl && priorityEl.style.display !== 'none' ?
        priorityEl.value : 'medium';

    // Get project
    const projectEl = document.getElementById('project');
    const project = projectEl && projectEl.style.display !== 'none' ?
        projectEl.value : 'none';

    // PHASE 1: Get subtasks
    const subtasks = getSubtasks();

    // PHASE 1: Get recurring pattern
    const recurring = getRecurringPattern();

    // PHASE 1: Get location data
    const location = getLocationData();

    const repeatMinutes = parseInt(document.getElementById('repeatInterval').value) || 0;

    // Save reminder
    const reminder = {
        id: id,
        title: title,
        text: text,
        datetime: datetime.toISOString(),
        repeatMinutes: repeatMinutes,
        mode: currentMode,
        priority: priority,
        project: project,
        completed: false,
        completedDate: null,
        createdDate: new Date().toISOString(),  // ADD THIS
        lastModified: new Date().toISOString(), // ADD THIS
        modificationHistory: [],                // ADD THIS
        comments: [],
        subtasks: subtasks,
        recurring: recurring,
        location: location
    };

    // Get all reminders from storage (not just current mode)
    const allReminders = JSON.parse(localStorage.getItem('reminders') || '[]');

    // Add new reminder
    allReminders.push(reminder);

    // Save all reminders
    localStorage.setItem('reminders', JSON.stringify(allReminders));

    // Add to current mode's reminders array in memory
    reminders.push(reminder);

    // Schedule the notification
    cordova.plugins.notification.local.schedule({
        id: id,
        title: title,
        text: text,
        trigger: {
            at: datetime,
            every: repeatMinutes > 0 ? { minutes: repeatMinutes } : null
        },
        foreground: true
    });

    // 🆕 NEW: Sync to cloud if user is signed in
    if (reminderSync && reminderSync.isSyncEnabled()) {
        try {
            await reminderSync.saveReminder(reminder);
            console.log('Reminder synced to cloud');
        } catch (error) {
            console.error('Cloud sync failed:', error);
            // Continue - already saved locally
        }
    }

    // PHASE 1: Schedule recurring if applicable
    if (recurring) {
        const count = scheduleRecurringReminder(reminder, recurring);
        console.log(`Recurring reminder scheduled ${count} times`);
    }

    addReminderToList(reminder);

    // Clear form inputs
    document.getElementById('title').value = '';
    document.getElementById('text').value = '';
    document.getElementById('datetime').value = '';
    document.getElementById('repeatInterval').value = '';
    document.getElementById('recurringPattern').value = 'none';
    clearSubtasks();

    if (document.getElementById('useLocation')) {
        document.getElementById('useLocation').checked = false;
        document.getElementById('locationOptions').style.display = 'none';
    }

    console.log('Reminder scheduled successfully:', title);
    logAudit('Reminder created: ' + title, 'user');

    // PHASE 1: Update productivity patterns
    analyzeProductivityPatterns();
}
// Success feedback - ADD THIS
    showQuickFeedback(`✅ Success! "${title}" scheduled for ${datetime.toLocaleString()} 🎯`);

function addReminderToList(reminder) {
    const reminderListEl = document.getElementById('reminderList');

    // Remove existing if present
    const existing = document.getElementById('reminder-' + reminder.id);
    if (existing) {
        existing.remove();
    }

    const li = document.createElement('li');
    li.id = 'reminder-' + reminder.id;
    li.className = reminder.priority ? 'priority-' + reminder.priority : '';

    const info = document.createElement('div');
    info.className = 'reminder-info';
    const datetime = new Date(reminder.datetime);

    // Mode badge
    const modeBadge = reminder.mode ?
        `<span class="mode-badge ${reminder.mode}">${getModeIcon(reminder.mode)} ${reminder.mode.toUpperCase()}</span>` : '';

    // Location badge - NEW!
    const locationBadge = reminder.location && reminder.location.enabled ?
        `<span class="location-badge" style="background: #17a2b8; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-left: 5px;">
            ðŸ" ${reminder.location.trigger === 'arrive' ? 'When arriving' : 'When leaving'}: ${reminder.location.address}
        </span>` : '';

    info.innerHTML = `
        <strong>${reminder.title}${modeBadge}${locationBadge}</strong><br>
        ${reminder.text}<br>
        <small>ðŸ"… ${datetime.toLocaleString()}</small>
        ${reminder.repeatMinutes > 0 ? `<br><small>ðŸ" Repeats every ${reminder.repeatMinutes} min</small>` : ''}
        ${reminder.project && reminder.project !== 'none' ? `<br><small>ðŸ" ${reminder.project}</small>` : ''}
        ${reminder.subtasks && reminder.subtasks.length > 0 ? `<br><small>âœ… ${reminder.subtasks.filter(s => s.completed).length}/${reminder.subtasks.length} subtasks completed</small>` : ''}
    `;

    // UPDATED: Show comments if any
    if (reminder.comments && reminder.comments.length > 0) {
        const commentSection = document.createElement('div');
        commentSection.className = 'comment-section';
        commentSection.innerHTML = `
            <strong>💬 Comments (${reminder.comments.length}):</strong>
            ${reminder.comments.slice(-2).map(c => `
                <div class="comment-item">
                    <div class="comment-text">${c.text}</div>
                    <div class="comment-meta">${new Date(c.timestamp).toLocaleString()}</div>
                </div>
            `).join('')}
        `;
        info.appendChild(commentSection);
    }

    const actions = document.createElement('div');
    actions.className = 'reminder-actions';

    // Complete button
    const completeBtn = document.createElement('button');
    completeBtn.textContent = '✓ Complete';
    completeBtn.onclick = () => completeReminder(reminder);

    // ADDED: Comment button
    const commentBtn = document.createElement('button');
    commentBtn.textContent = '💬 Comment';
    commentBtn.onclick = () => openCommentModal(reminder.id);

displaySubtasks(reminder, info);

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️ Edit';
    editBtn.onclick = () => openEditModal(reminder);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️ Delete';
    deleteBtn.onclick = () => deleteReminder(reminder.id);

    actions.appendChild(completeBtn);
    actions.appendChild(commentBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(info);
    li.appendChild(actions);

    reminderListEl.appendChild(li);
    updateReminderCount();

    // Apply current filters
    applyModeFilters();
}

// Helper function for mode icons
function getModeIcon(mode) {
    const icons = {
        'work': '💼',
        'adhd': '⚡',
        'memory': '🧠'
    };
    return icons[mode] || '';
}

// ============= COMMENT FUNCTIONALITY =============
function openCommentModal(reminderId) {
    currentCommentReminderId = reminderId;
    const reminder = reminders.find(r => r.id === reminderId);

    if (!reminder) return;

    const commentsContainer = document.getElementById('existingComments');

    if (reminder.comments && reminder.comments.length > 0) {
        commentsContainer.innerHTML = reminder.comments.map(comment => `
            <div class="comment-item">
                <div class="comment-text">${comment.text}</div>
                <div class="comment-meta">${new Date(comment.timestamp).toLocaleString()}</div>
            </div>
        `).join('');
    } else {
        commentsContainer.innerHTML = '<div class="no-comments">No comments yet</div>';
    }

    document.getElementById('newCommentText').value = '';
    const commentModal = document.getElementById('commentModal');
    commentModal.style.display = 'flex';
    commentModal.classList.add('active');

    logAudit('Opened comments for: ' + reminder.title, 'user');
}

function saveComment() {
    const commentText = document.getElementById('newCommentText').value.trim();

    if (!commentText) {
        alert('Please enter a comment before saving.');
        return;
    }

    const reminder = reminders.find(r => r.id === currentCommentReminderId);
    if (!reminder) {
        alert('Error: Reminder not found.');
        return;
    }

    if (!reminder.comments) {
        reminder.comments = [];
    }

    const comment = {
        text: commentText,
        timestamp: new Date().toISOString(),
        user: authManager && authManager.getCurrentUser() ? authManager.getCurrentUser().email : 'local user'
    };

    reminder.comments.push(comment);

    // Save to localStorage
    localStorage.setItem('reminders', JSON.stringify(reminders));

    // Sync to cloud if available
    if (reminderSync && reminderSync.isSyncEnabled()) {
        reminderSync.updateReminder(reminder).catch(err => {
            console.error('Failed to sync comment:', err);
        });
    }

    // Refresh the reminder display
    addReminderToList(reminder);

    // Close modal properly
    const modal = document.getElementById('commentModal');
    modal.style.display = 'none';
    modal.classList.remove('active');

    // Clear the input
    document.getElementById('newCommentText').value = '';
    currentCommentReminderId = null;

    logAudit('Comment added to: ' + reminder.title, 'user');

    // Show success feedback
    showQuickFeedback(`💬 Comment added to "${reminder.title}"!`);
}

function cancelComment() {
    const modal = document.getElementById('commentModal');
    modal.style.display = 'none';
    modal.classList.remove('active');
    currentCommentReminderId = null;
}

// ============= EDIT MODAL FUNCTIONS =============
let editingReminder = null;

function openEditModal(reminder) {
    console.log('📝 Opening edit modal for:', reminder.title);
    editingReminder = reminder;

    // Populate form fields
    document.getElementById('editTitle').value = reminder.title;
    document.getElementById('editText').value = reminder.text;

    // Format datetime for input
    const dt = new Date(reminder.datetime);
    const formatted = dt.toISOString().slice(0, 16);
    document.getElementById('editDatetime').value = formatted;

    document.getElementById('editRepeatInterval').value = reminder.repeatMinutes || '';

    // Show priority section if in work/adhd mode
    const prioritySection = document.getElementById('editPrioritySection');
    if (currentMode === 'work' || currentMode === 'adhd') {
        prioritySection.style.display = 'block';
        document.getElementById('editPriority').value = reminder.priority || 'medium';
    } else {
        prioritySection.style.display = 'none';
    }

    // Show modal
    const modal = document.getElementById('editModal');
    modal.style.display = 'flex';
    modal.classList.add('active');

    logAudit('Opened edit modal for: ' + reminder.title, 'user');
}

async function saveEdit() {
    console.log('💾 Saving edit');
    if (!editingReminder) {
        console.error('No reminder being edited');
        return;
    }

    const title = document.getElementById('editTitle').value.trim();
    const text = document.getElementById('editText').value.trim();
    const datetimeStr = document.getElementById('editDatetime').value;
    const repeatMinutes = parseInt(document.getElementById('editRepeatInterval').value) || 0;

    if (!title || !text || !datetimeStr) {
        alert('Please fill in all required fields to update the reminder.');
        return;
    }

    const datetime = new Date(datetimeStr);
    if (isNaN(datetime.getTime())) {
        alert('Invalid date/time format. Please check your input.');
        return;
    }

    // Track what changed
    const changes = [];
    if (editingReminder.title !== title) changes.push(`Title: "${editingReminder.title}" → "${title}"`);
    if (editingReminder.text !== text) changes.push(`Description updated`);
    if (editingReminder.datetime !== datetime.toISOString()) {
        const oldDate = new Date(editingReminder.datetime);
        changes.push(`Date/Time: ${oldDate.toLocaleString()} → ${datetime.toLocaleString()}`);
    }
    if (editingReminder.repeatMinutes !== repeatMinutes) {
        changes.push(`Repeat interval: ${editingReminder.repeatMinutes || 0} → ${repeatMinutes} minutes`);
    }

    // Create modification record
    const modification = {
        timestamp: new Date().toISOString(),
        changes: changes,
        user: authManager && authManager.getCurrentUser() ? authManager.getCurrentUser().email : 'local user'
    };

    // Initialize modification history if it doesn't exist
    if (!editingReminder.modificationHistory) {
        editingReminder.modificationHistory = [];
    }

    // Add to modification history
    editingReminder.modificationHistory.push(modification);

    // Update reminder fields
    editingReminder.title = title;
    editingReminder.text = text;
    editingReminder.datetime = datetime.toISOString();
    editingReminder.repeatMinutes = repeatMinutes;
    editingReminder.lastModified = new Date().toISOString();

    if (currentMode === 'work' || currentMode === 'adhd') {
        const priorityEl = document.getElementById('editPriority');
        if (priorityEl && editingReminder.priority !== priorityEl.value) {
            changes.push(`Priority: ${editingReminder.priority} → ${priorityEl.value}`);
            editingReminder.priority = priorityEl.value;
        }
    }

    // Save to localStorage
    localStorage.setItem('reminders', JSON.stringify(reminders));

    // Sync to cloud if available
    if (reminderSync && reminderSync.isSyncEnabled()) {
        try {
            await reminderSync.updateReminder(editingReminder);
            console.log('Update synced to cloud');
        } catch (error) {
            console.error('Cloud sync failed:', error);
        }
    }

    // Re-schedule notification
    cordova.plugins.notification.local.cancel(editingReminder.id);
    cordova.plugins.notification.local.schedule({
        id: editingReminder.id,
        title: title,
        text: text,
        trigger: {
            at: datetime,
            every: repeatMinutes > 0 ? { minutes: repeatMinutes } : null
        },
        foreground: true
    });

    // Refresh display
    addReminderToList(editingReminder);

    // Close modal
    cancelEdit();

    console.log('✅ Reminder updated');
    logAudit('Edited reminder: ' + title + ' - Changes: ' + changes.join(', '), 'user');

    // Show success feedback
    showQuickFeedback(`✅ Reminder "${title}" updated successfully!`);
}

function cancelEdit() {
    const modal = document.getElementById('editModal');
    modal.style.display = 'none';
    modal.classList.remove('active');
    editingReminder = null;
}

// =============  COMPLETE REMINDER =============
function completeReminder(reminder) {
    cordova.plugins.notification.local.cancel(reminder.id);

    reminder.completed = true;
    reminder.completedDate = new Date().toISOString(); // ADDED

    localStorage.setItem('reminders', JSON.stringify(reminders));

    const li = document.getElementById('reminder-' + reminder.id);
    if (li) {
        li.remove();
    }

    completedToday.push(reminder);
    completedHistory.push(reminder);

    updateCompletedList();
    updateReminderCount();

    // Mode-specific celebrations
    if (currentMode === 'adhd' && typeof ADHDMode !== 'undefined') {
        showCelebration(reminder.title);
        ADHDMode.updateStreak();
    }

    logAudit('Completed: ' + reminder.title, 'user');
}

// ============= COMPLETED TAB ENHANCEMENTS =============
function updateCompletedList() {
    const completedList = document.getElementById('completedList');
    if (!completedList) return;

    completedList.innerHTML = '';

    const completed = reminders.filter(r => r.completed);

    if (completed.length === 0) {
        completedList.innerHTML = '<li>No completed tasks yet</li>';
        return;
    }

    completed.forEach(reminder => {
        const li = document.createElement('li');
        li.setAttribute('data-mode', reminder.mode);
        li.setAttribute('data-completed-date', reminder.completedDate);

        const datetime = new Date(reminder.datetime);
        const completedDate = new Date(reminder.completedDate);

        const modeBadge = reminder.mode ?
            `<span class="mode-badge ${reminder.mode}">${getModeIcon(reminder.mode)} ${reminder.mode.toUpperCase()}</span>` : '';

        li.innerHTML = `
            <div class="reminder-info">
                <strong>${reminder.title}${modeBadge}</strong><br>
                ${reminder.text}<br>
                <small>📅 Due: ${datetime.toLocaleString()}</small><br>
                <small>✅ Completed: ${completedDate.toLocaleString()}</small>
                ${reminder.comments && reminder.comments.length > 0 ? `<br><small>💬 ${reminder.comments.length} comment(s)</small>` : ''}
            </div>
        `;

        // Show comments if any
        if (reminder.comments && reminder.comments.length > 0) {
            const commentSection = document.createElement('div');
            commentSection.className = 'comment-section';
            commentSection.innerHTML = `
                <strong>💬 Comments:</strong>
                ${reminder.comments.map(c => `
                    <div class="comment-item">
                        <div class="comment-text">${c.text}</div>
                        <div class="comment-meta">${new Date(c.timestamp).toLocaleString()}</div>
                    </div>
                `).join('')}
            `;
            li.querySelector('.reminder-info').appendChild(commentSection);
        }

        completedList.appendChild(li);
    });

    // Update stats
    updateCompletedStats();

    // Apply filters
    filterCompleted();
}

function filterCompleted() {
    const showWork = document.getElementById('completedFilterWork').checked;
    const showAdhd = document.getElementById('completedFilterAdhd').checked;
    const showMemory = document.getElementById('completedFilterMemory').checked;

    const items = document.querySelectorAll('#completedList li');

    items.forEach(li => {
        const mode = li.getAttribute('data-mode');

        if (!mode) {
            li.style.display = 'flex';
            return;
        }

        const shouldShow =
            (mode === 'work' && showWork) ||
            (mode === 'adhd' && showAdhd) ||
            (mode === 'memory' && showMemory);

        li.style.display = shouldShow ? 'flex' : 'none';
    });
}

function applyDateFilter() {
    const startDate = document.getElementById('completedDateStart').value;
    const endDate = document.getElementById('completedDateEnd').value;

    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);

    const items = document.querySelectorAll('#completedList li');

    items.forEach(li => {
        const completedDateStr = li.getAttribute('data-completed-date');

        if (!completedDateStr) {
            li.style.display = 'flex';
            return;
        }

        const completedDate = new Date(completedDateStr);
        const inRange = completedDate >= start && completedDate <= end;

        li.style.display = inRange ? 'flex' : 'none';
    });

    logAudit('Date filter applied', 'user');
}

function clearDateFilter() {
    document.getElementById('completedDateStart').value = '';
    document.getElementById('completedDateEnd').value = '';
    updateCompletedList();
}

function updateCompletedStats() {
    const completed = reminders.filter(r => r.completed);
    const today = new Date().toDateString();

    const todayCompleted = completed.filter(r => {
        const completedDate = new Date(r.completedDate);
        return completedDate.toDateString() === today;
    });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekCompleted = completed.filter(r => {
        const completedDate = new Date(r.completedDate);
        return completedDate >= weekAgo;
    });

    document.getElementById('todayCount').textContent = todayCompleted.length;
    document.getElementById('weekCount').textContent = weekCompleted.length;

    // Update streak for ADHD mode
    if (currentMode === 'adhd' && typeof ADHDMode !== 'undefined') {
        const streakCard = document.getElementById('streakCard');
        const streakCount = document.getElementById('streakCount');
        if (streakCard && streakCount) {
            streakCard.style.display = 'block';
            streakCount.textContent = ADHDMode.focusStreak || 0;
        }
    }
}

function deleteReminder(id) {
    if (!confirm('Delete this reminder?')) return;

    const reminder = reminders.find(r => r.id === id);
    reminders = reminders.filter(r => r.id !== id);
    localStorage.setItem('reminders', JSON.stringify(reminders));

    const li = document.getElementById('reminder-' + id);
    if (li) li.remove();

    updateReminderCount();

    try {
        cordova.plugins.notification.local.cancel(id);
    } catch (error) {
        console.error('Cancel notification error:', error);
    }

    logAudit(`Reminder deleted: ${reminder?.title || id}`, 'user');
}

function loadReminders() {
    console.log('📂 Loading reminders for mode:', currentMode);

    // Load all reminders from storage
    const allReminders = JSON.parse(localStorage.getItem('reminders') || '[]');

    // SECURITY: Filter to only current mode (protects PHI in memory mode)
    reminders = allReminders.filter(r => r.mode === currentMode);

    completedHistory = JSON.parse(localStorage.getItem('completedHistory') || '[]');

    // Display active reminders for current mode only
    const reminderListEl = document.getElementById('reminderList');
    if (reminderListEl) {
        reminderListEl.innerHTML = '';
        reminders.filter(r => !r.completed).forEach(addReminderToList);
    }

    // Update completed list
    updateCompletedList();

    // Update counts
    updateReminderCount();

    console.log(`✅ Loaded ${reminders.length} reminders for ${currentMode} mode (${allReminders.length} total)`);
}

// ============= MODE FILTERING =============
function applyModeFilters() {
    const showWork = document.getElementById('filterWork').checked;
    const showAdhd = document.getElementById('filterAdhd').checked;
    const showMemory = document.getElementById('filterMemory').checked;

    const reminderItems = document.querySelectorAll('#reminderList li');

    reminderItems.forEach(li => {
        const reminderId = parseInt(li.id.replace('reminder-', ''));
        const reminder = reminders.find(r => r.id === reminderId);

        if (!reminder) return;

        const shouldShow =
            (reminder.mode === 'work' && showWork) ||
            (reminder.mode === 'adhd' && showAdhd) ||
            (reminder.mode === 'memory' && showMemory);

        li.style.display = shouldShow ? 'flex' : 'none';
    });

    logAudit('Mode filters applied', 'user');
}

function addToCompletedList(reminder) {
    const list = document.getElementById('completedList');
    if (!list) return;

    const li = document.createElement('li');
    li.className = 'completed-item';

    const info = document.createElement('div');
    info.className = 'reminder-info';

    const completedTime = new Date(reminder.completedAt).toLocaleTimeString();
    info.innerHTML = `
        <strong>${reminder.title}</strong><br>
        ${reminder.text}<br>
        <small>✅ Completed at ${completedTime}</small>
    `;

    li.appendChild(info);
    list.appendChild(li);
}

function updateReminderCount() {
    const count = reminders.filter(r => !r.completed).length;
    const countElement = document.getElementById('reminderCount');
    if (countElement) {
        countElement.textContent = count;
    }
}

function updateCompletedCounts() {
    const todayCount = document.getElementById('todayCount');
    if (todayCount) {
        todayCount.textContent = completedToday.length;
    }

    const weekCount = document.getElementById('weekCount');
    if (weekCount) {
        weekCount.textContent = completedToday.length;
    }

    updateAnalytics();
}

function updateAnalytics() {
    const totalCompleted = document.getElementById('totalCompleted');
    if (totalCompleted) {
        totalCompleted.textContent = completedToday.length;
    }

    const completionRate = document.getElementById('completionRate');
    if (completionRate) {
        const total = reminders.length + completedToday.length;
        const rate = total > 0 ? Math.round((completedToday.length / total) * 100) : 0;
        completionRate.textContent = rate + '%';
    }

    const avgPerDay = document.getElementById('avgPerDay');
    if (avgPerDay) {
        avgPerDay.textContent = completedToday.length;
    }

    if (currentMode === 'adhd') {
        const streakCount = document.getElementById('streakCount');
        if (streakCount) {
            const streak = completedToday.length > 0 ? 1 : 0;
            streakCount.textContent = streak;
        }
    }
}

// ============= TAB MANAGEMENT =============

function showTab(tabName) {
    console.log('📑 SHOW TAB:', tabName);

    // Hide all tab contents
    const allTabContents = document.querySelectorAll('.tab-content');
    allTabContents.forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });

    // Remove active class from all tab buttons
    const allTabs = document.querySelectorAll('.nav-tab');
    allTabs.forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab content
    const selectedTab = document.getElementById(tabName + 'Tab');
    if (selectedTab) {
        selectedTab.classList.add('active');
        selectedTab.style.display = 'block';
        console.log('✅ Tab shown:', tabName);
    } else {
        console.error('❌ Tab not found:', tabName + 'Tab');
    }

    // Activate corresponding tab button
    const tabButton = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
    if (tabButton) {
        tabButton.classList.add('active');
    }

    // Update analytics if switching to analytics tab
    if (tabName === 'analytics') {
        updateAnalytics();
    }

    logAudit('Switched to tab: ' + tabName, 'user');
}

function loadCompletedTab() {
    const completedList = document.getElementById('completedList');
    if (completedList) {
        completedList.innerHTML = '';
        completedToday.forEach(addToCompletedList);
    }

    updateCompletedCounts();
}

// ============= CELEBRATION (ADHD MODE) =============

function showCelebration(reminder) {
    const modal = document.getElementById('celebrationModal');
    if (!modal) {
        alert('🎉 Amazing! You completed: ' + reminder.title);
        return;
    }

    const messages = [
        '🎉 Amazing! You crushed it!',
        '⚡ Great job staying focused!',
        '🔥 You\'re on fire today!',
        '💪 Awesome work! Keep it up!',
        '✨ That\'s how it\'s done!',
        '🌟 Fantastic! You\'re unstoppable!',
        '🎯 Nailed it! Keep going!'
    ];

    const message = messages[Math.floor(Math.random() * messages.length)];

    const messageEl = document.getElementById('celebrationMessage');
    if (messageEl) {
        messageEl.textContent = message;
    }

    speakText(message);
    modal.classList.add('active');

    setTimeout(() => {
        modal.classList.remove('active');
    }, 3000);
}

function closeCelebration() {
    const modal = document.getElementById('celebrationModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

// ============= ANALYTICS & CHARTS =============
function refreshAnalytics() {
    const days = parseInt(document.getElementById('analyticsRange').value);
    const now = new Date();
    const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

    const completed = reminders.filter(r => {
        if (!r.completed || !r.completedDate) return false;
        const completedDate = new Date(r.completedDate);
        return completedDate >= startDate && completedDate <= now;
    });

    const allInRange = reminders.filter(r => {
        const reminderDate = new Date(r.datetime);
        return reminderDate >= startDate && reminderDate <= now;
    });

    // Calculate stats
    const totalCompleted = completed.length;
    const completionRate = allInRange.length > 0 ?
        Math.round((totalCompleted / allInRange.length) * 100) : 0;
    const avgPerDay = days > 0 ? (totalCompleted / days).toFixed(1) : 0;

    // Find most productive day
    const dayCount = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    completed.forEach(r => {
        const day = new Date(r.completedDate).getDay();
        dayCount[day] = (dayCount[day] || 0) + 1;
    });

    let maxDay = -1;
    let maxCount = 0;
    Object.keys(dayCount).forEach(day => {
        if (dayCount[day] > maxCount) {
            maxCount = dayCount[day];
            maxDay = day;
        }
    });

    const mostProductiveDay = maxDay >= 0 ? dayNames[maxDay] : 'N/A';

    // Update stats display
    document.getElementById('totalCompleted').textContent = totalCompleted;
    document.getElementById('completionRate').textContent = completionRate + '%';
    document.getElementById('avgPerDay').textContent = avgPerDay;
    document.getElementById('mostProductiveDay').textContent = mostProductiveDay;

    // Create charts
    createDayOfWeekChart(completed, dayCount, dayNames);
    createModeChart(completed);
    createTrendChart(completed, days);

    // Generate insights
    generateInsights(completed, dayCount, dayNames, days);

    logAudit('Analytics refreshed', 'user');
}

function createDayOfWeekChart(completed, dayCount, dayNames) {
    const ctx = document.getElementById('dayOfWeekChart');
    if (!ctx) return;

    const dayCounts = [0, 0, 0, 0, 0, 0, 0];

    Object.keys(dayCount).forEach(day => {
        dayCounts[day] = dayCount[day];
    });

    // Calculate averages
    const weekdayAvg = (dayCounts[1] + dayCounts[2] + dayCounts[3] + dayCounts[4] + dayCounts[5]) / 5;
    const weekendAvg = (dayCounts[0] + dayCounts[6]) / 2;

    // Destroy existing chart
    if (dayOfWeekChart) {
        dayOfWeekChart.destroy();
    }

    dayOfWeekChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dayNames,
            datasets: [{
                label: 'Tasks Completed',
                data: dayCounts,
                backgroundColor: [
                    '#9C27B0', // Sunday (weekend)
                    '#2196F3', // Monday (weekday)
                    '#2196F3',
                    '#2196F3',
                    '#2196F3',
                    '#2196F3', // Friday
                    '#9C27B0'  // Saturday (weekend)
                ],
                borderColor: [
                    '#7B1FA2',
                    '#1976D2',
                    '#1976D2',
                    '#1976D2',
                    '#1976D2',
                    '#1976D2',
                    '#7B1FA2'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: `Weekday Avg: ${weekdayAvg.toFixed(1)} | Weekend Avg: ${weekendAvg.toFixed(1)}`,
                    font: {
                        size: 14
                    }
                },
                legend: {
                    display: false
                }
            }
        }
    });
}

function createModeChart(completed) {
    const ctx = document.getElementById('modeChart');
    if (!ctx) return;

    const modeCounts = {
        work: 0,
        adhd: 0,
        memory: 0
    };

    completed.forEach(r => {
        if (r.mode && modeCounts.hasOwnProperty(r.mode)) {
            modeCounts[r.mode]++;
        }
    });

    // Destroy existing chart
    if (modeChart) {
        modeChart.destroy();
    }

    modeChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['💼 Work Mode', '⚡ ADHD Mode', '🧠 Memory/Caregiver Mode'],
            datasets: [{
                data: [modeCounts.work, modeCounts.adhd, modeCounts.memory],
                backgroundColor: [
                    '#2196F3',
                    '#FF9800',
                    '#9C27B0'
                ],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                            return `${label}: ${value} tasks (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function createTrendChart(completed, days) {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    const now = new Date();
    const dates = [];
    const counts = [];

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
        const dateStr = date.toLocaleDateString();
        dates.push(dateStr);

        const count = completed.filter(r => {
            const completedDate = new Date(r.completedDate);
            return completedDate.toLocaleDateString() === dateStr;
        }).length;

        counts.push(count);
    }

    // Destroy existing chart
    if (trendChart) {
        trendChart.destroy();
    }

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Tasks Completed',
                data: counts,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#4CAF50',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// ============= PHASE 2: ADVANCED ANALYTICS & INSIGHTS =============

// Productivity Heatmap
function createProductivityHeatmap() {
    const heatmapContainer = document.getElementById('productivityHeatmap');
    if (!heatmapContainer) return;

    const days = 90; // Last 90 days
    const now = new Date();
    const heatmapData = [];

    // Generate heatmap for last 90 days
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
        const dateStr = date.toISOString().split('T')[0];

        const tasksOnDay = reminders.filter(r => {
            if (!r.completed || !r.completedDate) return false;
            const completedDate = new Date(r.completedDate).toISOString().split('T')[0];
            return completedDate === dateStr;
        }).length;

        heatmapData.push({
            date: dateStr,
            count: tasksOnDay,
            day: date.getDay(),
            weekOfYear: getWeekOfYear(date)
        });
    }

    // Render heatmap
    renderHeatmap(heatmapContainer, heatmapData);
}

function getWeekOfYear(date) {
    const onejan = new Date(date.getFullYear(), 0, 1);
    return Math.ceil((((date - onejan) / 86400000) + onejan.getDay() + 1) / 7);
}

function renderHeatmap(container, data) {
    container.innerHTML = '';

    // Group by week
    const weeks = {};
    data.forEach(day => {
        if (!weeks[day.weekOfYear]) weeks[day.weekOfYear] = [];
        weeks[day.weekOfYear].push(day);
    });

    // Create heatmap grid
    const heatmapGrid = document.createElement('div');
    heatmapGrid.className = 'heatmap-grid';

    // Day labels
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const labelColumn = document.createElement('div');
    labelColumn.className = 'heatmap-labels';
    dayLabels.forEach(label => {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'heatmap-label';
        labelDiv.textContent = label;
        labelColumn.appendChild(labelDiv);
    });
    heatmapGrid.appendChild(labelColumn);

    // Render weeks
    Object.keys(weeks).forEach(weekNum => {
        const weekColumn = document.createElement('div');
        weekColumn.className = 'heatmap-week';

        // Fill in days for this week
        const daysInWeek = weeks[weekNum];

        for (let day = 0; day < 7; day++) {
            const dayData = daysInWeek.find(d => d.day === day);
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';

            if (dayData) {
                const intensity = Math.min(dayData.count, 10);
                cell.className += ` intensity-${Math.floor(intensity / 2)}`;
                cell.title = `${dayData.date}: ${dayData.count} tasks`;
                cell.setAttribute('data-count', dayData.count);
            } else {
                cell.className += ' intensity-0';
            }

            weekColumn.appendChild(cell);
        }

        heatmapGrid.appendChild(weekColumn);
    });

    container.appendChild(heatmapGrid);

    // Add legend
    const legend = document.createElement('div');
    legend.className = 'heatmap-legend';
    legend.innerHTML = `
        <span>Less</span>
        <div class="heatmap-cell intensity-0"></div>
        <div class="heatmap-cell intensity-1"></div>
        <div class="heatmap-cell intensity-2"></div>
        <div class="heatmap-cell intensity-3"></div>
        <div class="heatmap-cell intensity-4"></div>
        <div class="heatmap-cell intensity-5"></div>
        <span>More</span>
    `;
    container.appendChild(legend);
}

// Focus Score Calculation
function calculateFocusScore() {
    const days = 30;
    const now = new Date();
    const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

    const completed = reminders.filter(r => {
        if (!r.completed || !r.completedDate) return false;
        const completedDate = new Date(r.completedDate);
        return completedDate >= startDate && completedDate <= now;
    });

    const scheduled = reminders.filter(r => {
        const reminderDate = new Date(r.datetime);
        return reminderDate >= startDate && reminderDate <= now;
    });

    if (scheduled.length === 0) return 0;

    // Calculate components
    const completionRate = (completed.length / scheduled.length) * 100;

    // On-time completion
    const onTime = completed.filter(r => {
        const due = new Date(r.datetime);
        const completedDate = new Date(r.completedDate);
        return completedDate <= due;
    }).length;

    const onTimeRate = completed.length > 0 ? (onTime / completed.length) * 100 : 0;

    // Consistency (tasks completed per day variance)
    const dailyCounts = {};
    for (let i = 0; i < days; i++) {
        const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
        const dateStr = date.toDateString();
        dailyCounts[dateStr] = 0;
    }

    completed.forEach(r => {
        const dateStr = new Date(r.completedDate).toDateString();
        if (dailyCounts[dateStr] !== undefined) {
            dailyCounts[dateStr]++;
        }
    });

    const counts = Object.values(dailyCounts);
    const avgDaily = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - avgDaily, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);
    const consistency = Math.max(0, 100 - (stdDev * 10));

    // Calculate overall focus score (weighted average)
    const focusScore = Math.round(
        (completionRate * 0.4) +
        (onTimeRate * 0.4) +
        (consistency * 0.2)
    );

    return Math.min(100, Math.max(0, focusScore));
}

// On-Time Rate Calculation
function calculateOnTimeRate() {
    const days = 30;
    const now = new Date();
    const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

    const completed = reminders.filter(r => {
        if (!r.completed || !r.completedDate) return false;
        const completedDate = new Date(r.completedDate);
        return completedDate >= startDate && completedDate <= now;
    });

    if (completed.length === 0) return 0;

    const onTime = completed.filter(r => {
        const due = new Date(r.datetime);
        const completedDate = new Date(r.completedDate);
        return completedDate <= due;
    }).length;

    return Math.round((onTime / completed.length) * 100);
}

// Period Comparison
function generatePeriodComparison() {
    const now = new Date();

    // This week vs last week
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setMilliseconds(-1);

    const thisWeekTasks = reminders.filter(r => {
        if (!r.completed || !r.completedDate) return false;
        const completedDate = new Date(r.completedDate);
        return completedDate >= thisWeekStart && completedDate <= now;
    }).length;

    const lastWeekTasks = reminders.filter(r => {
        if (!r.completed || !r.completedDate) return false;
        const completedDate = new Date(r.completedDate);
        return completedDate >= lastWeekStart && completedDate < thisWeekStart;
    }).length;

    const weekDiff = thisWeekTasks - lastWeekTasks;
    const weekPercent = lastWeekTasks > 0 ? Math.round((weekDiff / lastWeekTasks) * 100) : 0;

    // This month vs last month
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthTasks = reminders.filter(r => {
        if (!r.completed || !r.completedDate) return false;
        const completedDate = new Date(r.completedDate);
        return completedDate >= thisMonthStart && completedDate <= now;
    }).length;

    const lastMonthTasks = reminders.filter(r => {
        if (!r.completed || !r.completedDate) return false;
        const completedDate = new Date(r.completedDate);
        return completedDate >= lastMonthStart && completedDate <= lastMonthEnd;
    }).length;

    const monthDiff = thisMonthTasks - lastMonthTasks;
    const monthPercent = lastMonthTasks > 0 ? Math.round((monthDiff / lastMonthTasks) * 100) : 0;

    return {
        week: {
            thisWeek: thisWeekTasks,
            lastWeek: lastWeekTasks,
            diff: weekDiff,
            percent: weekPercent
        },
        month: {
            thisMonth: thisMonthTasks,
            lastMonth: lastMonthTasks,
            diff: monthDiff,
            percent: monthPercent
        }
    };
}

function displayPeriodComparison() {
    const comparison = generatePeriodComparison();

    const weekContainer = document.getElementById('weekComparison');
    const monthContainer = document.getElementById('monthComparison');

    if (weekContainer) {
        const weekTrend = comparison.week.diff >= 0 ? '📈' : '📉';
        const weekColor = comparison.week.diff >= 0 ? '#4CAF50' : '#f44336';

        weekContainer.innerHTML = `
            <div class="comparison-stat">
                <div class="comparison-value">
                    <span class="current">${comparison.week.thisWeek}</span> vs
                    <span class="previous">${comparison.week.lastWeek}</span>
                </div>
                <div class="comparison-change" style="color: ${weekColor}">
                    ${weekTrend} ${comparison.week.diff >= 0 ? '+' : ''}${comparison.week.diff} tasks
                    (${comparison.week.percent >= 0 ? '+' : ''}${comparison.week.percent}%)
                </div>
            </div>
        `;
    }

    if (monthContainer) {
        const monthTrend = comparison.month.diff >= 0 ? '📈' : '📉';
        const monthColor = comparison.month.diff >= 0 ? '#4CAF50' : '#f44336';

        monthContainer.innerHTML = `
            <div class="comparison-stat">
                <div class="comparison-value">
                    <span class="current">${comparison.month.thisMonth}</span> vs
                    <span class="previous">${comparison.month.lastMonth}</span>
                </div>
                <div class="comparison-change" style="color: ${monthColor}">
                    ${monthTrend} ${comparison.month.diff >= 0 ? '+' : ''}${comparison.month.diff} tasks
                    (${comparison.month.percent >= 0 ? '+' : ''}${comparison.month.percent}%)
                </div>
            </div>
        `;
    }
}

// Burnout Detection
function detectBurnout() {
    const days = 14; // Look at last 2 weeks
    const now = new Date();
    const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

    const recentTasks = reminders.filter(r => {
        const reminderDate = new Date(r.datetime);
        return reminderDate >= startDate && reminderDate <= now;
    });

    const completed = recentTasks.filter(r => r.completed);

    // Calculate daily averages
    const tasksPerDay = recentTasks.length / days;
    const completedPerDay = completed.length / days;
    const completionRate = recentTasks.length > 0 ? (completed.length / recentTasks.length) * 100 : 0;

    // Burnout indicators
    const indicators = [];
    let burnoutScore = 0;

    // High task load
    if (tasksPerDay > 15) {
        indicators.push('You have a very high task load (averaging ' + tasksPerDay.toFixed(1) + ' tasks per day)');
        burnoutScore += 30;
    }

    // Low completion rate
    if (completionRate < 50 && recentTasks.length > 5) {
        indicators.push('Your completion rate is low (' + completionRate.toFixed(0) + '%)');
        burnoutScore += 25;
    }

    // Check for continuous work (no rest days)
    const dailyActivity = {};
    for (let i = 0; i < days; i++) {
        const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
        const dateStr = date.toDateString();
        dailyActivity[dateStr] = 0;
    }

    recentTasks.forEach(r => {
        const dateStr = new Date(r.datetime).toDateString();
        if (dailyActivity[dateStr] !== undefined) {
            dailyActivity[dateStr]++;
        }
    });

    const daysWithTasks = Object.values(dailyActivity).filter(count => count > 0).length;
    if (daysWithTasks === days) {
        indicators.push('You haven\'t taken a break in ' + days + ' days');
        burnoutScore += 25;
    }

    // Check for late completions
    const lateTasks = completed.filter(r => {
        const due = new Date(r.datetime);
        const completedDate = new Date(r.completedDate);
        return completedDate > due;
    }).length;

    if (lateTasks > completed.length * 0.6) {
        indicators.push('Most of your tasks are completed late');
        burnoutScore += 20;
    }

    // Display burnout alert if score is high
    const burnoutAlert = document.getElementById('burnoutAlert');
    const burnoutMessage = document.getElementById('burnoutMessage');

    if (burnoutScore >= 50 && burnoutAlert && burnoutMessage) {
        burnoutAlert.style.display = 'block';
        burnoutMessage.innerHTML = `
            <p><strong>Burnout risk detected (Score: ${burnoutScore}/100)</strong></p>
            <ul>
                ${indicators.map(ind => `<li>${ind}</li>`).join('')}
            </ul>
        `;
    } else if (burnoutAlert) {
        burnoutAlert.style.display = 'none';
    }

    return {
        score: burnoutScore,
        indicators: indicators
    };
}

function showBurnoutSuggestions() {
    const suggestions = [
        '🌴 Take a day off to rest and recharge',
        '📊 Review your task list and remove non-essential items',
        '🎯 Focus on completing fewer tasks with higher quality',
        '⏰ Set realistic deadlines and avoid over-committing',
        '🧘 Practice mindfulness or meditation',
        '💬 Talk to someone about your workload',
        '📅 Schedule regular breaks throughout your day',
        '🚶 Take walks and get physical exercise',
        '😴 Ensure you\'re getting enough sleep',
        '🎨 Engage in hobbies outside of work/tasks'
    ];

    alert('Burnout Prevention Suggestions:\n\n' + suggestions.join('\n'));
}

// Update the main refreshAnalytics function to include Phase 2 features
function refreshAnalyticsPhase2() {
    // Call existing refreshAnalytics
    refreshAnalytics();

    // Add Phase 2 analytics
    const focusScore = calculateFocusScore();
    const onTimeRate = calculateOnTimeRate();

    // Update displays
    document.getElementById('focusScore').textContent = focusScore;
    document.getElementById('onTimeRate').textContent = onTimeRate + '%';

    // Generate heatmap
    createProductivityHeatmap();

    // Display comparisons
    displayPeriodComparison();

    // Check for burnout
    detectBurnout();

    logAudit('Phase 2 analytics refreshed', 'system');
}

// Export Analytics Report (Phase 2)
function exportAnalytics() {
    const days = parseInt(document.getElementById('analyticsRange').value);
    const now = new Date();
    const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

    const completed = reminders.filter(r => {
        if (!r.completed || !r.completedDate) return false;
        const completedDate = new Date(r.completedDate);
        return completedDate >= startDate && completedDate <= now;
    });

    const allInRange = reminders.filter(r => {
        const reminderDate = new Date(r.datetime);
        return reminderDate >= startDate && reminderDate <= now;
    });

    const focusScore = calculateFocusScore();
    const onTimeRate = calculateOnTimeRate();
    const comparison = generatePeriodComparison();
    const burnout = detectBurnout();

    // Generate report
    let report = `PRODUCTIVITY ANALYTICS REPORT\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `Period: Last ${days} days\n\n`;

    report += `=== SUMMARY ===\n`;
    report += `Total Tasks Scheduled: ${allInRange.length}\n`;
    report += `Total Tasks Completed: ${completed.length}\n`;
    report += `Completion Rate: ${allInRange.length > 0 ? Math.round((completed.length / allInRange.length) * 100) : 0}%\n`;
    report += `Average Per Day: ${(completed.length / days).toFixed(1)}\n`;
    report += `Focus Score: ${focusScore}/100\n`;
    report += `On-Time Completion Rate: ${onTimeRate}%\n\n`;

    report += `=== PERIOD COMPARISON ===\n`;
    report += `This Week: ${comparison.week.thisWeek} tasks\n`;
    report += `Last Week: ${comparison.week.lastWeek} tasks\n`;
    report += `Weekly Change: ${comparison.week.diff >= 0 ? '+' : ''}${comparison.week.diff} (${comparison.week.percent}%)\n\n`;
    report += `This Month: ${comparison.month.thisMonth} tasks\n`;
    report += `Last Month: ${comparison.month.lastMonth} tasks\n`;
    report += `Monthly Change: ${comparison.month.diff >= 0 ? '+' : ''}${comparison.month.diff} (${comparison.month.percent}%)\n\n`;

    report += `=== BURNOUT ASSESSMENT ===\n`;
    report += `Burnout Risk Score: ${burnout.score}/100\n`;
    if (burnout.indicators.length > 0) {
        report += `Indicators:\n`;
        burnout.indicators.forEach(ind => {
            report += `- ${ind}\n`;
        });
    } else {
        report += `No burnout indicators detected. Keep up the good work!\n`;
    }
    report += `\n`;

    report += `=== TASK BREAKDOWN BY MODE ===\n`;
    const modeCounts = { work: 0, adhd: 0, memory: 0 };
    completed.forEach(r => {
        if (r.mode && modeCounts.hasOwnProperty(r.mode)) {
            modeCounts[r.mode]++;
        }
    });
    report += `Work Mode: ${modeCounts.work}\n`;
    report += `ADHD Mode: ${modeCounts.adhd}\n`;
    report += `Memory/Caregiver Mode: ${modeCounts.memory}\n\n`;

    report += `=== RECOMMENDATIONS ===\n`;
    if (focusScore < 50) {
        report += `- Your focus score is low. Consider reducing distractions and breaking tasks into smaller pieces.\n`;
    }
    if (onTimeRate < 60) {
        report += `- Many tasks are completed late. Try setting more realistic deadlines or using reminders earlier.\n`;
    }
    if (burnout.score >= 50) {
        report += `- High burnout risk detected. Please take breaks and reduce your task load.\n`;
    }
    if (focusScore >= 80 && onTimeRate >= 80) {
        report += `- Excellent productivity! You're maintaining high focus and completing tasks on time.\n`;
    }

    // Download report
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `productivity_report_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();

    logAudit('Analytics report exported', 'user');
}

// Make functions globally accessible
window.refreshAnalyticsPhase2 = refreshAnalyticsPhase2;
window.exportAnalytics = exportAnalytics;
window.showBurnoutSuggestions = showBurnoutSuggestions;

function generateInsights(completed, dayCount, dayNames, days) {
    const insightsContainer = document.getElementById('analyticsInsights');
    if (!insightsContainer) return;

    const insights = [];

    // Weekday vs Weekend analysis
    const weekdayCount = (dayCount[1] || 0) + (dayCount[2] || 0) + (dayCount[3] || 0) +
                        (dayCount[4] || 0) + (dayCount[5] || 0);
    const weekendCount = (dayCount[0] || 0) + (dayCount[6] || 0);

    if (weekdayCount > weekendCount * 2) {
        insights.push({
            icon: '📊',
            title: 'Weekday Focus',
            text: 'You complete more tasks during weekdays. Consider spreading workload more evenly or taking advantage of weekend productivity.'
        });
    } else if (weekendCount > weekdayCount) {
        insights.push({
            icon: '🌴',
            title: 'Weekend Warrior',
            text: 'You\'re more productive on weekends. You might benefit from reducing weekday commitments or scheduling important tasks for weekends.'
        });
    }

    // Productivity consistency
    const avgPerDay = completed.length / days;
    if (avgPerDay > 5) {
        insights.push({
            icon: '🔥',
            title: 'High Productivity',
            text: `You're averaging ${avgPerDay.toFixed(1)} tasks per day! Make sure to maintain a healthy work-life balance.`
        });
    } else if (avgPerDay < 2) {
        insights.push({
            icon: '💡',
            title: 'Room for Growth',
            text: 'Consider breaking larger tasks into smaller, manageable pieces to increase your completion rate.'
        });
    }

    // Mode usage
    const modeCounts = { work: 0, adhd: 0, memory: 0 };
    completed.forEach(r => {
        if (r.mode && modeCounts.hasOwnProperty(r.mode)) {
            modeCounts[r.mode]++;
        }
    });

    const dominantMode = Object.keys(modeCounts).reduce((a, b) =>
        modeCounts[a] > modeCounts[b] ? a : b
    );

    if (modeCounts[dominantMode] > completed.length * 0.7) {
        insights.push({
            icon: getModeIcon(dominantMode),
            title: `${dominantMode.charAt(0).toUpperCase() + dominantMode.slice(1)} Mode Focus`,
            text: `You primarily use ${dominantMode} mode. Consider exploring other modes for different types of tasks.`
        });
    }

    // Display insights
    if (insights.length === 0) {
        insightsContainer.innerHTML = '<p>Complete more tasks to generate insights!</p>';
    } else {
        insightsContainer.innerHTML = insights.map(insight => `
            <div class="insight-item">
                <strong>${insight.icon} ${insight.title}</strong>
                <p>${insight.text}</p>
            </div>
        `).join('');
    }
}

// ============= SETTINGS & MODALS =============

function showSettings() {
    const modal = document.getElementById('settingsModal');
    const modeText = document.getElementById('currentMode');

    const modeNames = {
        'work': 'Work Mode 💼',
        'adhd': 'ADHD Mode ⚡',
        'memory': 'Memory Mode 🧠'
    };

    if (modeText) {
        modeText.textContent = modeNames[currentMode] || 'None';
    }

    // Update PIN buttons visibility
    const setPinBtn = document.getElementById('setPinBtn');
    const changePinBtn = document.getElementById('changePinBtn');

    if (appSettings.pinEnabled) {
        if (currentPin) {
            if (setPinBtn) setPinBtn.style.display = 'none';
            if (changePinBtn) changePinBtn.style.display = 'block';
        } else {
            if (setPinBtn) setPinBtn.style.display = 'block';
            if (changePinBtn) changePinBtn.style.display = 'none';
        }
    } else {
        if (setPinBtn) setPinBtn.style.display = 'none';
        if (changePinBtn) changePinBtn.style.display = 'none';
    }

    if (modal) {
        modal.classList.add('active');
    }

    const auditToggle = document.querySelector('input[type="checkbox"][onchange*="auditLog"]');
    if (auditToggle) {
        const auditToggleContainer = auditToggle.closest('label');
        if (auditToggleContainer) {
            auditToggleContainer.style.display = 'none';
        }
    }

    modal.style.display = 'flex';
    modal.classList.add('active');

    logAudit('Settings opened', 'user');
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    logAudit('Settings closed', 'user');
}

// ============= DATA EXPORT & MANAGEMENT =============

async function exportAllData() {
    console.log('ðŸ"¥ Exporting all data...');

    try {
        // Gather all data
        const exportData = {
            reminders: reminders,
            completedToday: completedToday,
            completedHistory: completedHistory,
            settings: appSettings,
            currentMode: currentMode,
            auditLog: auditLog,
            customTemplates: customTemplates || [],
            exportDate: new Date().toISOString(),
            appVersion: '1.0.0'
        };

        const jsonData = JSON.stringify(exportData, null, 2);
        const fileName = `reminder-app-backup-${new Date().toISOString().slice(0,10)}.json`;

        // Check if we're on Cordova (mobile)
        if (typeof cordova !== 'undefined' && cordova.file) {
            // Mobile: Use Cordova File plugin
            try {
                const directory = cordova.file.externalDataDirectory || cordova.file.dataDirectory;

                window.resolveLocalFileSystemURL(directory, function(dirEntry) {
                    dirEntry.getFile(fileName, { create: true, exclusive: false }, function(fileEntry) {
                        fileEntry.createWriter(function(fileWriter) {
                            fileWriter.onwriteend = function() {
                                console.log('âœ… File written successfully');

                                // Show success with file location
                                const filePath = fileEntry.nativeURL || fileEntry.toURL();
                                alert(`âœ… Export Successful!\n\nFile saved to:\n${filePath}\n\nYou can find this file in your device's file manager or connect to a computer to access it.`);

                                logAudit('Data exported to: ' + fileName, 'user');

                                // Try to open/share the file
                                if (window.plugins && window.plugins.socialsharing) {
                                    window.plugins.socialsharing.shareWithOptions({
                                        message: 'Reminder App Backup',
                                        subject: 'Reminder App Data Export',
                                        files: [filePath]
                                    });
                                }
                            };

                            fileWriter.onerror = function(e) {
                                console.error('File write error:', e);
                                alert('âŒ Failed to write file: ' + e.toString());
                            };

                            const blob = new Blob([jsonData], { type: 'application/json' });
                            fileWriter.write(blob);

                        }, function(error) {
                            console.error('Create writer error:', error);
                            alert('âŒ Failed to create file writer: ' + error.message);
                        });
                    }, function(error) {
                        console.error('Get file error:', error);
                        alert('âŒ Failed to access file: ' + error.message);
                    });
                }, function(error) {
                    console.error('Directory error:', error);
                    alert('âŒ Failed to access storage: ' + error.message);
                });

            } catch (error) {
                console.error('Cordova file error:', error);
                // Fallback to browser method
                downloadViaBrowser(jsonData, fileName);
            }
        } else {
            // Browser: Use download link
            downloadViaBrowser(jsonData, fileName);
        }

    } catch (error) {
        console.error('Export error:', error);
        alert('âŒ Export failed: ' + error.message);
    }
}

function downloadViaBrowser(data, fileName) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showQuickFeedback(`✅ Data exported! Check your Downloads folder for ${fileName}`);
    logAudit('Data exported (browser): ' + fileName, 'user');
}

function clearAllData() {
    const confirmation = prompt('Type "DELETE" to permanently delete all data:');

    if (confirmation === 'DELETE') {
        // Clear all data
        reminders = [];
        completedToday = [];
        completedHistory = [];
        auditLog = [];

        localStorage.removeItem('reminders');
        localStorage.removeItem('completedToday');
        localStorage.removeItem('completedHistory');
        localStorage.removeItem('auditLog');
        localStorage.removeItem('selectedMode');
        localStorage.removeItem('onboardingComplete');

        // Cancel all notifications
        try {
            cordova.plugins.notification.local.cancelAll();
        } catch (error) {
            console.error('Cancel all notifications error:', error);
        }

        // Reload lists
        loadReminders();

        alert('✅ All data cleared');
        logAudit('All data cleared', 'system');

        // Go back to homepage
        changeMode();
    } else {
        alert('Data not deleted');
    }
}

// ============= FILTERS =============

function toggleFilters() {
    const filterSection = document.getElementById('filterSection');
    if (filterSection) {
        filterSection.style.display = filterSection.style.display === 'none' ? 'block' : 'none';
    }
}

function applyFilters() {
    const priority = document.getElementById('filterPriority')?.value || 'all';

    const list = document.getElementById('reminderList');
    if (!list) return;

    list.innerHTML = '';

    const filtered = reminders.filter(r => {
        if (priority !== 'all' && r.priority !== priority) return false;
        return true;
    });

    filtered.forEach(addReminderToList);

    logAudit(`Filters applied: priority=${priority}`, 'user');
}

function clearFilters() {
    const filterPriority = document.getElementById('filterPriority');
    if (filterPriority) {
        filterPriority.value = 'all';
    }

    loadReminders();
    logAudit('Filters cleared', 'user');
}

// ============= MEMORY MODE HELPERS =============

function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('photoPreview');
        if (preview) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Photo preview" style="max-width: 200px; border-radius: 8px; margin-top: 10px;">`;
        }

        logAudit('Photo uploaded for reminder', 'user');
    };
    reader.readAsDataURL(file);
}

let voiceRecording = false;

function toggleVoiceRecording() {
    if (!voiceRecording) {
        startVoiceRecording();
    } else {
        stopVoiceRecording();
    }
}

function startVoiceRecording() {
    voiceRecording = true;

    const btn = document.getElementById('recordVoiceBtn');
    const status = document.getElementById('voiceStatus');

    if (btn) {
        btn.textContent = '⏹️ Stop Recording';
        btn.classList.add('recording');
    }

    if (status) {
        status.textContent = '🎙️ Recording...';
        status.style.display = 'block';
        status.style.background = '#ffebee';
        status.style.color = '#c62828';
        status.style.padding = '10px';
        status.style.borderRadius = '8px';
        status.style.marginTop = '10px';
    }

    speakText('Voice recording started');
    logAudit('Voice recording started', 'user');
}

function stopVoiceRecording() {
    voiceRecording = false;

    const btn = document.getElementById('recordVoiceBtn');
    const status = document.getElementById('voiceStatus');

    if (btn) {
        btn.textContent = '🎤 Record Voice Note';
        btn.classList.remove('recording');
    }

    if (status) {
        status.textContent = '✅ Voice note recorded';
        status.style.background = '#e8f5e9';
        status.style.color = '#2e7d32';
    }

    speakText('Voice recording stopped');
    logAudit('Voice recording completed', 'user');
}

// ============= WEEK 11: TESTING & OPTIMIZATION =============

// Performance monitoring
let performanceMetrics = {
    loadTime: 0,
    renderTime: 0,
    apiCalls: 0
};

function trackPerformance() {
    if (performance && performance.timing) {
        performanceMetrics.loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        console.log('App load time:', performanceMetrics.loadTime + 'ms');
    }
}

// Error boundary
window.addEventListener('error', function(event) {
    console.error('Global error caught:', event.error);
    logAudit(`Error: ${event.error?.message || 'Unknown error'}`, 'system');

    // Don't let errors crash the app
    event.preventDefault();
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    logAudit(`Promise rejection: ${event.reason}`, 'system');
    event.preventDefault();
});

// Memory cleanup on pause (Cordova)
document.addEventListener('pause', function() {
    console.log('App paused - cleaning up');
    // Save state
    saveSettings();
    localStorage.setItem('reminders', JSON.stringify(reminders));
    localStorage.setItem('completedToday', JSON.stringify(completedToday));
}, false);

document.addEventListener('resume', function() {
    console.log('App resumed - reloading data');
    loadReminders();
    updateAnalytics();
}, false);

// Input validation helpers
function validateInput(value, type) {
    switch(type) {
        case 'title':
            return value.length > 0 && value.length <= 100;
        case 'text':
            return value.length > 0 && value.length <= 500;
        case 'datetime':
            const date = new Date(value);
            return !isNaN(date.getTime()) && date > new Date();
        default:
            return true;
    }
}

// Sanitize user input to prevent XSS
function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

// ============= WEEK 12: ADVANCED FEATURES =============

// Adaptive escalation based on user behavior
function analyzeUserBehavior() {
    const completionTimes = completedToday.map(r => {
        const due = new Date(r.datetime);
        const completed = new Date(r.completedAt);
        return completed - due;
    });

    const avgDelay = completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length;

    // If user consistently completes tasks late, suggest more aggressive escalation
    if (avgDelay > 3600000 && currentMode === 'adhd') { // 1 hour
        console.log('Suggesting stronger escalation based on behavior');
        // Could show a tip or automatically adjust settings
    }
}

// Advanced gamification for ADHD mode
function checkAchievements() {
    const achievements = [
        { id: 'first_task', name: 'First Steps', condition: () => completedToday.length >= 1 },
        { id: 'five_tasks', name: 'Getting Started', condition: () => completedToday.length >= 5 },
        { id: 'ten_tasks', name: 'On a Roll', condition: () => completedToday.length >= 10 },
        { id: 'perfect_day', name: 'Perfect Day', condition: () => reminders.length === 0 && completedToday.length > 0 }
    ];

    achievements.forEach(achievement => {
        if (achievement.condition()) {
            const achieved = JSON.parse(localStorage.getItem('achievements') || '[]');
            if (!achieved.includes(achievement.id)) {
                achieved.push(achievement.id);
                localStorage.setItem('achievements', JSON.stringify(achieved));

                if (currentMode === 'adhd') {
                    alert(`🏆 Achievement Unlocked: ${achievement.name}!`);
                    speakText(`Achievement unlocked: ${achievement.name}`);
                }
            }
        }
    });
}

function initializeApp() {
    // Attach event listeners
    setupEventListeners();

    // Load mode
    const savedMode = localStorage.getItem('selectedMode');
    if (savedMode) {
        selectMode(savedMode);
    }

    // ADDED: Initialize analytics if on that tab
    const analyticsTab = document.getElementById('analyticsTab');
    if (analyticsTab && analyticsTab.classList.contains('active')) {
        refreshAnalytics();
    }

    logAudit('App initialized', 'system');
    console.log('✅ App initialized successfully');
}

// Add to setupEventListeners() function:

// Completed filters
const completedFilterWork = document.getElementById('completedFilterWork');
if (completedFilterWork) {
    completedFilterWork.addEventListener('change', filterCompleted);
}

const completedFilterAdhd = document.getElementById('completedFilterAdhd');
if (completedFilterAdhd) {
    completedFilterAdhd.addEventListener('change', filterCompleted);
}

const completedFilterMemory = document.getElementById('completedFilterMemory');
if (completedFilterMemory) {
    completedFilterMemory.addEventListener('change', filterCompleted);
}

// Mode filters
const filterWork = document.getElementById('filterWork');
if (filterWork) {
    filterWork.addEventListener('change', applyModeFilters);
}

const filterAdhd = document.getElementById('filterAdhd');
if (filterAdhd) {
    filterAdhd.addEventListener('change', applyModeFilters);
}

const filterMemory = document.getElementById('filterMemory');
if (filterMemory) {
    filterMemory.addEventListener('change', applyModeFilters);
}


// ============= GLOBAL FUNCTIONS =============

// Make functions globally accessible
window.onUserSignedIn = onUserSignedIn;
window.selectMode = selectMode;
window.showSettings = showSettings;
window.closeSettings = closeSettings;
window.changeMode = changeMode;
window.showTab = showTab;
window.closeCelebration = closeCelebration;
window.scheduleReminder = scheduleReminder;
window.enterPin = enterPin;
window.clearPin = clearPin;
window.useBiometric = useBiometric;
window.changeTheme = changeTheme;
window.changeFontSize = changeFontSize;
window.togglePinLock = togglePinLock;
window.setupPin = setupPin;
window.changePin = changePin;
window.toggleBiometric = toggleBiometric;
window.restartTutorial = restartTutorial;
window.viewAuditLog = viewAuditLog;
window.closeAuditLog = closeAuditLog;
window.exportAuditLog = exportAuditLog;
window.exportAllData = exportAllData;
window.clearAllData = clearAllData;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.handlePhotoUpload = handlePhotoUpload;
window.toggleVoiceRecording = toggleVoiceRecording;
window.saveSettings = saveSettings;
window.saveAndCloseSettings = saveAndCloseSettings;
window.closeSmartSuggestions = closeSmartSuggestions;
window.cancelEdit = function() {
    document.getElementById('editModal')?.classList.remove('active');
};
window.saveEdit = function() {
    alert('Edit functionality - Update reminder here');
};

// Track performance on load
window.addEventListener('load', trackPerformance);

// Check achievements periodically in ADHD mode
setInterval(() => {
    if (currentMode === 'adhd') {
        checkAchievements();
    }
}, 60000); // Every minute

console.log('=== REMINDER APP v1.0 LOADED ===');
console.log('📱 All 12 weeks of features implemented');
console.log('✅ Core reminders, Modes, Customization, Onboarding, Security, Testing');

function saveFilterSettings() {
    const filterSettings = {
        work: document.getElementById('filterWork').checked,
        adhd: document.getElementById('filterAdhd').checked,
        memory: document.getElementById('filterMemory').checked,
        showPriority: document.getElementById('settingsFilterPriority').checked,
        showAllModes: document.getElementById('settingsShowAllModes').checked
    };

    localStorage.setItem('filterSettings', JSON.stringify(filterSettings));
    applyModeFilters(); // Reapply filters immediately

    logAudit('Filter settings updated', 'user');
}

function loadFilterSettings() {
    const saved = localStorage.getItem('filterSettings');
    if (saved) {
        const settings = JSON.parse(saved);

        const filterWork = document.getElementById('filterWork');
        const filterAdhd = document.getElementById('filterAdhd');
        const filterMemory = document.getElementById('filterMemory');
        const filterPriority = document.getElementById('settingsFilterPriority');
        const showAllModes = document.getElementById('settingsShowAllModes');

        if (filterWork) filterWork.checked = settings.work !== false;
        if (filterAdhd) filterAdhd.checked = settings.adhd !== false;
        if (filterMemory) filterMemory.checked = settings.memory !== false;
        if (filterPriority) filterPriority.checked = settings.showPriority !== false;
        if (showAllModes) showAllModes.checked = settings.showAllModes !== false;
    }
}

// Update applyModeFilters function to check settings:
function applyModeFilters() {
    const filterWork = document.getElementById('filterWork');
    const filterAdhd = document.getElementById('filterAdhd');
    const filterMemory = document.getElementById('filterMemory');

    if (!filterWork || !filterAdhd || !filterMemory) {
        console.log('Filter checkboxes not found');
        return;
    }

    const showWork = filterWork.checked;
    const showAdhd = filterAdhd.checked;
    const showMemory = filterMemory.checked;

    // Get all reminder list items
    const allReminders = document.querySelectorAll('#reminderList li');

    allReminders.forEach(li => {
        const reminderId = parseInt(li.id.replace('reminder-', ''));
        const reminder = reminders.find(r => r.id === reminderId);

        if (!reminder) {
            li.style.display = 'none';
            return;
        }

        let shouldShow = false;

        if (reminder.mode === 'work' && showWork) shouldShow = true;
        if (reminder.mode === 'adhd' && showAdhd) shouldShow = true;
        if (reminder.mode === 'memory' && showMemory) shouldShow = true;

        // If no mode specified, default to showing if current mode filter is on
        if (!reminder.mode) {
            shouldShow = true;
        }

        li.style.display = shouldShow ? 'block' : 'none';
    });

    updateReminderCount();
}

// Call loadFilterSettings in the loadSettings function:
function loadSettings() {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
        appSettings = JSON.parse(saved);
    }

    // Enable audit log by default (FIX #12)
    if (appSettings.auditLogEnabled === undefined) {
        appSettings.auditLogEnabled = true;
        saveSettings();
    }

    loadFilterSettings(); // Add this line
}

// Add styles to document
const styleElement = document.createElement('style');
styleElement.textContent = templateStyles;
document.head.appendChild(styleElement);

// Update the template display function:
function displayTemplates() {
    const container = document.getElementById('templateList');
    if (!container) return;

    container.innerHTML = ''; // Clear existing

    if (customTemplates.length === 0) {
        container.innerHTML = `
            <div class="template-empty-state">
                <p>ðŸ" No templates yet!</p>
                <p>Create your first template to save time on recurring tasks.</p>
            </div>
        `;
        return;
    }

    customTemplates.forEach((template, index) => {
        const item = document.createElement('div');
        item.className = 'template-item';
        item.onclick = () => applyTemplate(index);

        const categoryIcon = {
            work: 'ðŸ',
            adhd: 'âš¡',
            memory: 'ðŸ§ ',
            personal: 'ðŸ"'
        }[template.category] || 'ðŸ"‹';

        item.innerHTML = `
            <h4>${categoryIcon} ${template.name}</h4>
            <p>${template.description || 'Quick template'}</p>
            <small style="color: #adb5bd;">${template.category.toUpperCase()}</small>
        `;

        container.appendChild(item);
    });
}

function openSearch() {
    const modal = document.getElementById('searchModal');
    if (!modal) {
        console.error('Search modal not found');
        return;
    }

    modal.style.display = 'flex';
    modal.classList.add('active');

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();

        // Add real-time search
        searchInput.addEventListener('input', performSearch);
    }

    logAudit('Opened search', 'user');
}

function closeSearch() {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

function performSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('searchResults');

    if (!searchTerm) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: #666;">Enter search terms above to find reminders</p>';
        return;
    }

    // Search through all reminders (active and completed)
    const allReminders = [...reminders, ...completedHistory];

    const results = allReminders.filter(reminder => {
        const titleMatch = reminder.title.toLowerCase().includes(searchTerm);
        const textMatch = reminder.text.toLowerCase().includes(searchTerm);
        const projectMatch = reminder.project && reminder.project.toLowerCase().includes(searchTerm);
        const modeMatch = reminder.mode && reminder.mode.toLowerCase().includes(searchTerm);

        return titleMatch || textMatch || projectMatch || modeMatch;
    });

    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <p style="text-align: center; color: #666;">
                No reminders found matching "${searchTerm}"
            </p>
        `;
        return;
    }

    // Display results
    resultsContainer.innerHTML = results.map(reminder => {
        const date = new Date(reminder.datetime);
        const status = reminder.completed ? 'âœ… Completed' : 'â³ Active';
        const modeIcon = getModeIcon(reminder.mode);

        return `
            <div class="search-result-item" style="
                border: 1px solid #ddd;
                border-radius: 6px;
                padding: 15px;
                margin: 10px 0;
                background: ${reminder.completed ? '#f0f0f0' : 'white'};
                cursor: pointer;
            " onclick="goToReminder(${reminder.id})">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 8px 0;">
                            ${modeIcon} ${reminder.title}
                        </h4>
                        <p style="margin: 0 0 8px 0; color: #666;">
                            ${reminder.text}
                        </p>
                        <small style="color: #999;">
                            ðŸ"… ${date.toLocaleString()}
                            ${reminder.project && reminder.project !== 'none' ? ` • ðŸ" ${reminder.project}` : ''}
                        </small>
                    </div>
                    <div style="margin-left: 15px;">
                        <span style="
                            padding: 4px 12px;
                            border-radius: 12px;
                            font-size: 12px;
                            background: ${reminder.completed ? '#28a745' : '#ffc107'};
                            color: white;
                            white-space: nowrap;
                        ">
                            ${status}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    logAudit(`Search performed: "${searchTerm}" - ${results.length} results`, 'user');
}

function goToReminder(reminderId) {
    closeSearch();

    // Check if reminder is active or completed
    const activeReminder = reminders.find(r => r.id === reminderId);

    if (activeReminder) {
        // Switch to reminders tab
        showTab('reminders');

        // Highlight the reminder
        const reminderElement = document.getElementById('reminder-' + reminderId);
        if (reminderElement) {
            reminderElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            reminderElement.style.animation = 'highlight 1s ease';

            // Add highlight animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes highlight {
                    0%, 100% { background: inherit; }
                    50% { background: #ffffcc; }
                }
            `;
            if (!document.getElementById('highlightAnimation')) {
                style.id = 'highlightAnimation';
                document.head.appendChild(style);
            }
        }
    } else {
        // Must be in completed history
        showTab('completed');
        showQuickFeedback(`ðŸ"Ž Found in completed tasks!`);
    }
}

// Update the filter button event listener to open search:
// In setupEventListeners function:
const filterBtn = document.getElementById('filterBtn');
if (filterBtn) {
    filterBtn.addEventListener('click', function() {
        openSearch(); // Changed from toggleFilters
    });
}
function showSmartSchedulingAssistant() {
    const title = document.getElementById('title').value.trim();

    if (!title) {
        alert('ðŸ" Please enter a task title first so the assistant can provide relevant scheduling suggestions.');
        document.getElementById('title').focus();
        return;
    }

    // Analyze productivity patterns if not already done
    if (!userProductivityPatterns) {
        analyzeProductivityPatterns();
    }

    // Check if we have enough data
    if (!userProductivityPatterns || reminders.length < 5) {
        showSmartSchedulingIntro();
        return;
    }

    // Show smart suggestions
    showSmartSuggestions(title);
}

function showSmartSchedulingIntro() {
    const modal = document.getElementById('smartSuggestionsModal');
    const list = document.getElementById('smartSuggestionsList');

    list.innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <div style="font-size: 64px; margin-bottom: 20px;">ðŸ¤–</div>
            <h3>Smart Scheduling Assistant</h3>
            <p style="color: #666; margin: 20px 0;">
                I'll learn your productivity patterns as you complete more tasks!
            </p>
            <p style="color: #666;">
                Once you have completed 5 or more tasks, I'll be able to suggest optimal times
                for scheduling based on when you're most productive.
            </p>
            <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                <strong>Current Progress:</strong><br>
                ${completedHistory.length} tasks completed<br>
                ${completedHistory.length < 5 ? `${5 - completedHistory.length} more to unlock smart suggestions!` : 'Ready to use!'}
            </div>
            <div style="margin-top: 20px;">
                <button onclick="closeSmartSuggestions()" class="btn-primary">Got it!</button>
            </div>
        </div>
    `;

    modal.classList.add('active');
    modal.style.display = 'flex';
}

function showQuickFeedback(message, duration = 3000) {
    let feedback = document.getElementById('quickFeedback');

    if (!feedback) {
        feedback = document.createElement('div');
        feedback.id = 'quickFeedback';
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #4CAF50;
            color: white;
            padding: 15px 30px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-size: 16px;
            font-weight: 500;
            max-width: 80%;
            text-align: center;
            animation: slideDown 0.3s ease;
        `;
        document.body.appendChild(feedback);
    }

    feedback.textContent = message;
    feedback.style.display = 'block';

    setTimeout(() => {
        feedback.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => {
            feedback.style.display = 'none';
        }, 300);
    }, duration);
}

function viewModificationHistory(reminderId) {
    const reminder = reminders.find(r => r.id === reminderId);
    if (!reminder || !reminder.modificationHistory) return;

    let historyHTML = `
        <div style="max-height: 400px; overflow-y: auto;">
            <h3>📄 Modification History: ${reminder.title}</h3>
    `;

    reminder.modificationHistory.forEach((mod, index) => {
        historyHTML += `
            <div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px;">
                <strong>Change #${index + 1}</strong><br>
                <small>${new Date(mod.timestamp).toLocaleString()}</small><br>
                <ul style="margin: 10px 0;">
                    ${mod.changes.map(change => `<li>${change}</li>`).join('')}
                </ul>
                <small>By: ${mod.user}</small>
            </div>
        `;
    });

    historyHTML += '</div>';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            ${historyHTML}
            <button onclick="this.closest('.modal').remove()" class="btn-primary">Close</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function displaySubtasks(reminder, container) {
    if (!reminder.subtasks || reminder.subtasks.length === 0) {
        return;
    }

    const subtaskSection = document.createElement('div');
    subtaskSection.className = 'subtask-section';

    subtaskSection.innerHTML = `
        <strong style="font-size: 14px;">✅ Subtasks (${reminder.subtasks.filter(s => s.completed).length}/${reminder.subtasks.length})</strong>
    `;

    const subtaskList = document.createElement('div');
    subtaskList.style.marginTop = '8px';

    reminder.subtasks.forEach(subtask => {
        const subtaskItem = document.createElement('div');
        subtaskItem.style.cssText = `
            display: flex;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid #dee2e6;
        `;

        subtaskItem.innerHTML = `
            <input type="checkbox"
                   ${subtask.completed ? 'checked' : ''}
                   onchange="toggleSubtask(${reminder.id}, ${subtask.id})"
                   style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
            <span style="${subtask.completed ? 'text-decoration: line-through; color: #6c757d;' : ''} flex: 1;">
                ${subtask.text}
            </span>
        `;

        subtaskList.appendChild(subtaskItem);
    });

    subtaskSection.appendChild(subtaskList);
    container.appendChild(subtaskSection);
}

function goToReminder(reminderId) {
    closeSearch();

    const activeReminder = reminders.find(r => r.id === reminderId);

    if (activeReminder) {
        showTab('reminders');

        const reminderElement = document.getElementById('reminder-' + reminderId);
        if (reminderElement) {
            reminderElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            reminderElement.style.animation = 'highlight 1s ease';
        }
    } else {
        showTab('completed');
        showQuickFeedback(`🔎 Found in completed tasks!`);
    }
}

function debugViewState() {
    console.log('=== VIEW STATE DEBUG ===');
    const views = {
        signInScreen: document.getElementById('signInScreen'),
        homepageView: document.getElementById('homepageView'),
        mainAppView: document.getElementById('mainAppView'),
        onboardingView: document.getElementById('onboardingView'),
        pinLockView: document.getElementById('pinLockView')
    };

    Object.keys(views).forEach(name => {
        const el = views[name];
        if (el) {
            const display = window.getComputedStyle(el).display;
            const visible = display !== 'none';
            console.log(`  ${name}: ${visible ? '✅ VISIBLE' : '❌ HIDDEN'} (display: ${display})`);
        } else {
            console.log(`  ${name}: ❌ NOT FOUND`);
        }
    });
    console.log('======================');
}

// Make it globally accessible for testing
window.debugViewState = debugViewState;

console.log('✅ Reminder app fully loaded');