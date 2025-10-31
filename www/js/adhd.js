// ADHD Mode Module
// Implements focus-friendly features with escalating reminders and positive reinforcement

const ADHDMode = {
    focusStreak: 0,
    dailyGoal: 5,
    rewards: [],
    motivationalQuotes: [
        "You've got this! One task at a time! 💪",
        "Progress, not perfection! ⭐",
        "Every step counts! Keep going! 🚀",
        "You're doing amazing! 🌟",
        "Focus is your superpower! ⚡",
        "Small wins lead to big victories! 🏆",
        "Believe in yourself! You can do it! 💫",
        "Stay strong, you're crushing it! 🔥"
    ],

    init: function() {
        console.log('ADHD Mode initialized');
        this.loadSettings();
        this.setupEscalationSystem();
        this.loadStreak();
        this.setupDailyGoals();
        this.applyFocusFriendlyUI();
    },

    loadSettings: function() {
        const saved = localStorage.getItem('adhdSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            this.dailyGoal = settings.dailyGoal || 5;
            this.focusStreak = settings.focusStreak || 0;
        }
    },

    saveSettings: function() {
        const settings = {
            dailyGoal: this.dailyGoal,
            focusStreak: this.focusStreak,
            lastActive: new Date().toISOString()
        };
        localStorage.setItem('adhdSettings', JSON.stringify(settings));
    },

    setupEscalationSystem: function() {
        // Escalation intervals in minutes
        this.escalationIntervals = {
            gentle: [5, 10],
            moderate: [3, 6, 10],
            strong: [2, 4, 6, 8, 10]
        };

        console.log('Escalation system configured');
    },

    scheduleEscalatingReminders: function(reminder) {
        const level = reminder.escalationLevel || 'moderate';
        const intervals = this.escalationIntervals[level];

        if (!intervals) return;

        intervals.forEach((minutes, index) => {
            const escalationTime = new Date(reminder.datetime);
            escalationTime.setMinutes(escalationTime.getMinutes() + minutes);

            const escalationId = parseInt(`${reminder.id}${index + 1}`);

            try {
                if (typeof cordova !== 'undefined' && cordova.plugins.notification) {
                    cordova.plugins.notification.local.schedule({
                        id: escalationId,
                        title: `⚡ Reminder ${index + 2}: ${reminder.title}`,
                        text: `Don't forget! ${reminder.text}`,
                        trigger: { at: escalationTime },
                        foreground: true,
                        priority: 2
                    });
                }
            } catch (error) {
                console.error('Failed to schedule escalation:', error);
            }
        });

        console.log('Escalating reminders scheduled for:', reminder.title);
    },

    applyFocusFriendlyUI: function() {
        // Add visual cues and animations
        document.body.classList.add('adhd-focus-mode');

        // Highlight urgent tasks
        this.highlightUrgentTasks();

        // Add motivational messages
        this.showDailyMotivation();
    },

    highlightUrgentTasks: function() {
        if (typeof reminders === 'undefined') return;

        const now = new Date();
        const urgent = reminders.filter(r => {
            const due = new Date(r.datetime);
            const hoursDiff = (due - now) / (1000 * 60 * 60);
            return !r.completed && hoursDiff > 0 && hoursDiff < 2; // Within 2 hours
        });

        urgent.forEach(r => {
            const el = document.getElementById('reminder-' + r.id);
            if (el) {
                el.style.animation = 'pulse 2s ease infinite';
                el.style.borderColor = '#ff6f00';
                el.style.borderWidth = '3px';
            }
        });
    },

    showDailyMotivation: function() {
        const quote = this.motivationalQuotes[
            Math.floor(Math.random() * this.motivationalQuotes.length)
        ];

        // Show motivational quote on page load
        setTimeout(() => {
            if (typeof showQuickFeedback === 'function') {
                showQuickFeedback(quote);
            }
        }, 1000);
    },

    loadStreak: function() {
        const saved = localStorage.getItem('adhdStreak');
        if (saved) {
            const data = JSON.parse(saved);
            this.focusStreak = data.streak || 0;

            // Check if streak is still valid (completed task today)
            const lastDate = data.lastDate;
            const today = new Date().toDateString();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            if (lastDate !== today && lastDate !== yesterday.toDateString()) {
                // Streak broken
                this.focusStreak = 0;
            }
        }
    },

    updateStreak: function() {
        const today = new Date().toDateString();

        // Increment streak
        this.focusStreak++;

        const streakData = {
            streak: this.focusStreak,
            lastDate: today
        };
        localStorage.setItem('adhdStreak', JSON.stringify(streakData));

        // Show streak milestone celebrations
        if (this.focusStreak % 7 === 0) {
            this.showStreakMilestone(this.focusStreak);
        }

        this.saveSettings();
    },

    showStreakMilestone: function(days) {
        const milestones = {
            7: '🎉 One week streak! Amazing!',
            14: '🏆 Two weeks! You\'re unstoppable!',
            30: '⭐ One month! Incredible dedication!',
            60: '🌟 Two months! You\'re a champion!',
            100: '👑 100 days! Legendary focus!'
        };

        const message = milestones[days] || `🔥 ${days} day streak! Keep it up!`;

        if (typeof showQuickFeedback === 'function') {
            showQuickFeedback(message);
        }
    },

    setupDailyGoals: function() {
        // Load today's progress
        const today = new Date().toDateString();
        const progress = this.getDailyProgress();

        console.log(`Daily goal: ${progress}/${this.dailyGoal} tasks completed`);

        // Check if goal reached
        if (progress >= this.dailyGoal) {
            this.celebrateGoalReached();
        }
    },

    getDailyProgress: function() {
        if (typeof completedToday === 'undefined') return 0;
        return completedToday.length;
    },

    celebrateGoalReached: function() {
        const celebration = {
            title: '🎯 Daily Goal Reached!',
            message: `You completed ${this.dailyGoal} tasks today! Outstanding!`,
            timestamp: new Date().toISOString()
        };

        // Save celebration to history
        const celebrations = JSON.parse(localStorage.getItem('adhdCelebrations') || '[]');
        celebrations.push(celebration);
        localStorage.setItem('adhdCelebrations', JSON.stringify(celebrations));

        console.log('Daily goal reached!');
    },

    addReward: function(taskTitle) {
        const rewards = [
            '⭐ Star earned!',
            '🏆 Trophy unlocked!',
            '💎 Gem collected!',
            '🎖️ Badge achieved!',
            '👑 Crown earned!'
        ];

        const reward = {
            type: rewards[Math.floor(Math.random() * rewards.length)],
            task: taskTitle,
            earnedAt: new Date().toISOString()
        };

        this.rewards.push(reward);
        this.saveRewards();

        return reward;
    },

    saveRewards: function() {
        localStorage.setItem('adhdRewards', JSON.stringify(this.rewards));
    },

    loadRewards: function() {
        const saved = localStorage.getItem('adhdRewards');
        if (saved) {
            this.rewards = JSON.parse(saved);
        }
    },

    getRewardCount: function() {
        return this.rewards.length;
    },

    // Break reminders for ADHD users
    suggestBreak: function() {
        const now = new Date();
        const lastBreak = localStorage.getItem('adhdLastBreak');

        if (!lastBreak) {
            this.scheduleBreakReminder();
            return;
        }

        const lastBreakTime = new Date(lastBreak);
        const minutesSinceBreak = (now - lastBreakTime) / (1000 * 60);

        // Suggest break every 25 minutes (Pomodoro technique)
        if (minutesSinceBreak >= 25) {
            this.scheduleBreakReminder();
        }
    },

    scheduleBreakReminder: function() {
        const breakTime = new Date();
        breakTime.setMinutes(breakTime.getMinutes() + 25);

        if (typeof cordova !== 'undefined' && cordova.plugins.notification) {
            cordova.plugins.notification.local.schedule({
                id: Date.now(),
                title: '☕ Time for a break!',
                text: 'You\'ve been focused for 25 minutes. Take a 5-minute break!',
                trigger: { at: breakTime },
                foreground: true
            });
        }

        localStorage.setItem('adhdLastBreak', new Date().toISOString());
        console.log('Break reminder scheduled');
    },

    // Focus timer
    startFocusTimer: function(minutes = 25) {
        const focusSession = {
            startTime: new Date().toISOString(),
            duration: minutes,
            completed: false
        };

        localStorage.setItem('adhdFocusSession', JSON.stringify(focusSession));

        // Schedule completion notification
        const endTime = new Date();
        endTime.setMinutes(endTime.getMinutes() + minutes);

        if (typeof cordova !== 'undefined' && cordova.plugins.notification) {
            cordova.plugins.notification.local.schedule({
                id: Date.now(),
                title: '✅ Focus session complete!',
                text: `Great job! You focused for ${minutes} minutes!`,
                trigger: { at: endTime },
                foreground: true
            });
        }

        console.log(`Focus timer started: ${minutes} minutes`);
        return focusSession;
    },

    endFocusTimer: function() {
        const session = localStorage.getItem('adhdFocusSession');
        if (!session) return null;

        const focusSession = JSON.parse(session);
        focusSession.completed = true;
        focusSession.endTime = new Date().toISOString();

        // Save to history
        const history = JSON.parse(localStorage.getItem('adhdFocusHistory') || '[]');
        history.push(focusSession);
        localStorage.setItem('adhdFocusHistory', JSON.stringify(history));

        localStorage.removeItem('adhdFocusSession');

        return focusSession;
    },

    // Visual/audio cues
    playSuccessSound: function() {
        // In production, this would play an actual sound file
        console.log('🔊 Success sound played');

        // Vibration pattern for success (if available)
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
    },

    // Task chunking helper
    suggestTaskBreakdown: function(taskTitle, estimatedMinutes) {
        const chunkSize = 15; // 15-minute chunks
        const chunks = Math.ceil(estimatedMinutes / chunkSize);

        const breakdown = {
            originalTask: taskTitle,
            chunks: chunks,
            chunkDuration: chunkSize,
            suggestions: []
        };

        for (let i = 1; i <= chunks; i++) {
            breakdown.suggestions.push({
                step: i,
                title: `${taskTitle} - Part ${i}/${chunks}`,
                duration: chunkSize
            });
        }

        return breakdown;
    },

    // Accountability partner feature
    setAccountabilityPartner: function(name, email) {
        const partner = {
            name: name,
            email: email,
            addedAt: new Date().toISOString()
        };

        localStorage.setItem('adhdAccountabilityPartner', JSON.stringify(partner));
        console.log('Accountability partner set:', name);
        return partner;
    },

    notifyAccountabilityPartner: function(taskCompleted) {
        const partner = localStorage.getItem('adhdAccountabilityPartner');
        if (!partner) return;

        const partnerData = JSON.parse(partner);

        // In production, this would send actual notification via API
        console.log(`Notify ${partnerData.name}: Task completed - ${taskCompleted}`);

        const notification = {
            to: partnerData.email,
            task: taskCompleted,
            sentAt: new Date().toISOString()
        };

        return notification;
    }
};

// Auto-initialize when loaded
console.log('ADHD mode module loaded');

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ADHDMode;
}