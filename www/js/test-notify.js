document.addEventListener('deviceready', function () {
    cordova.plugins.notification.local.schedule({
        title: 'Reminder Test',
        text: 'If you see this, notifications are working!',
        foreground: true
    });
});