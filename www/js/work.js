// Work Mode Module
// Implements professional task management features

const WorkMode = {
    projects: ['work', 'personal', 'urgent'],
    collaborators: [],

    init: function() {
        console.log('Work Mode initialized');
        this.loadProjects();
        this.setupProjectFilters();
        this.loadCollaborators();
    },

    loadProjects: function() {
        const saved = localStorage.getItem('workProjects');
        if (saved) {
            this.projects = JSON.parse(saved);
            this.updateProjectSelect();
        }
    },

    saveProjects: function() {
        localStorage.setItem('workProjects', JSON.stringify(this.projects));
    },

    updateProjectSelect: function() {
        const projectSelect = document.getElementById('project');
        const filterSelect = document.getElementById('filterProject');
        const editSelect = document.getElementById('editProject');

        if (!projectSelect) return;

        // Clear existing options except "none"
        projectSelect.innerHTML = '<option value="none">No Project</option>';
        filterSelect.innerHTML = '<option value="all">All Projects</option>';
        editSelect.innerHTML = '<option value="none">No Project</option>';

        this.projects.forEach(project => {
            const opt1 = document.createElement('option');
            opt1.value = project;
            opt1.textContent = project.charAt(0).toUpperCase() + project.slice(1);
            projectSelect.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = project;
            opt2.textContent = project.charAt(0).toUpperCase() + project.slice(1);
            filterSelect.appendChild(opt2);

            const opt3 = document.createElement('option');
            opt3.value = project;
            opt3.textContent = project.charAt(0).toUpperCase() + project.slice(1);
            editSelect.appendChild(opt3);
        });
    },

    setupProjectFilters: function() {
        // Project filters are set up in main index.js
        // This adds work-specific filtering logic
        console.log('Project filters configured');
    },

    addProject: function(projectName) {
        if (!projectName || this.projects.includes(projectName.toLowerCase())) {
            return false;
        }

        this.projects.push(projectName.toLowerCase());
        this.saveProjects();
        this.updateProjectSelect();
        return true;
    },

    removeProject: function(projectName) {
        this.projects = this.projects.filter(p => p !== projectName);
        this.saveProjects();
        this.updateProjectSelect();
    },

    loadCollaborators: function() {
        const saved = localStorage.getItem('workCollaborators');
        if (saved) {
            this.collaborators = JSON.parse(saved);
        }
    },

    saveCollaborators: function() {
        localStorage.setItem('workCollaborators', JSON.stringify(this.collaborators));
    },

    addCollaborator: function(name, email, role = 'colleague') {
        const collaborator = {
            id: Date.now(),
            name: name,
            email: email,
            role: role,
            addedAt: new Date().toISOString()
        };

        this.collaborators.push(collaborator);
        this.saveCollaborators();
        return collaborator;
    },

    removeCollaborator: function(id) {
        this.collaborators = this.collaborators.filter(c => c.id !== id);
        this.saveCollaborators();
    },

    getCollaboratorByEmail: function(email) {
        return this.collaborators.find(c => c.email === email);
    },

    shareReminderWithTeam: function(reminderId, collaboratorIds, permission = 'view') {
        // In production, this would integrate with backend API
        console.log('Sharing reminder', reminderId, 'with collaborators', collaboratorIds);

        const shareLog = {
            reminderId: reminderId,
            collaboratorIds: collaboratorIds,
            permission: permission,
            sharedAt: new Date().toISOString()
        };

        // Save to local storage for tracking
        const shares = JSON.parse(localStorage.getItem('workShares') || '[]');
        shares.push(shareLog);
        localStorage.setItem('workShares', JSON.stringify(shares));

        return shareLog;
    },

    getProjectStats: function() {
        // Get statistics for each project
        const stats = {};

        this.projects.forEach(project => {
            stats[project] = {
                total: 0,
                completed: 0,
                pending: 0,
                overdue: 0
            };
        });

        // Count from reminders array (if available globally)
        if (typeof reminders !== 'undefined') {
            reminders.forEach(r => {
                if (r.project && r.project !== 'none' && stats[r.project]) {
                    stats[r.project].total++;
                    if (r.completed) {
                        stats[r.project].completed++;
                    } else {
                        stats[r.project].pending++;
                        if (new Date(r.datetime) < new Date()) {
                            stats[r.project].overdue++;
                        }
                    }
                }
            });
        }

        return stats;
    },

    generateProjectReport: function(projectName) {
        const stats = this.getProjectStats()[projectName];
        if (!stats) return null;

        const report = {
            project: projectName,
            date: new Date().toISOString(),
            stats: stats,
            completionRate: stats.total > 0 ?
                Math.round((stats.completed / stats.total) * 100) : 0
        };

        return report;
    },

    exportProjectData: function(projectName) {
        const report = this.generateProjectReport(projectName);
        if (!report) {
            alert('No data for this project');
            return;
        }

        let csv = `Project Report: ${projectName}\n`;
        csv += `Generated: ${new Date().toLocaleString()}\n\n`;
        csv += `Total Tasks: ${report.stats.total}\n`;
        csv += `Completed: ${report.stats.completed}\n`;
        csv += `Pending: ${report.stats.pending}\n`;
        csv += `Overdue: ${report.stats.overdue}\n`;
        csv += `Completion Rate: ${report.completionRate}%\n\n`;
        csv += `Task Details:\n`;
        csv += `Title,Status,Due Date,Priority\n`;

        // Add task details
        if (typeof reminders !== 'undefined') {
            const projectTasks = reminders.filter(r => r.project === projectName);
            projectTasks.forEach(r => {
                csv += `"${r.title}","${r.completed ? 'Completed' : 'Pending'}","${r.datetime}","${r.priority}"\n`;
            });
        }

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `project_${projectName}_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();

        console.log('Project data exported:', projectName);
    },

    // Notification delivery methods for work mode
    setDeliveryMethod: function(reminderId, method) {
        // method: 'banner', 'notification', 'popup', 'email'
        const deliverySettings = JSON.parse(localStorage.getItem('workDeliverySettings') || '{}');
        deliverySettings[reminderId] = method;
        localStorage.setItem('workDeliverySettings', JSON.stringify(deliverySettings));

        console.log('Delivery method set for reminder', reminderId, ':', method);
    },

    getDeliveryMethod: function(reminderId) {
        const deliverySettings = JSON.parse(localStorage.getItem('workDeliverySettings') || '{}');
        return deliverySettings[reminderId] || 'notification';
    },

    // Task delegation
    delegateTask: function(reminderId, collaboratorEmail) {
        const collaborator = this.getCollaboratorByEmail(collaboratorEmail);
        if (!collaborator) {
            console.error('Collaborator not found:', collaboratorEmail);
            return false;
        }

        const delegation = {
            reminderId: reminderId,
            delegatedTo: collaborator.id,
            delegatedAt: new Date().toISOString(),
            status: 'pending'
        };

        const delegations = JSON.parse(localStorage.getItem('workDelegations') || '[]');
        delegations.push(delegation);
        localStorage.setItem('workDelegations', JSON.stringify(delegations));

        console.log('Task delegated to', collaborator.name);
        return true;
    },

    // Meeting reminders integration
    createMeetingReminder: function(title, datetime, attendees, location) {
        const meetingData = {
            title: title,
            datetime: datetime,
            attendees: attendees,
            location: location,
            type: 'meeting'
        };

        // This would integrate with calendar APIs in production
        console.log('Meeting reminder created:', meetingData);
        return meetingData;
    }
};

// Auto-initialize when loaded
console.log('Work mode module loaded');

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkMode;
}