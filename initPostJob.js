function initPostJob() {
    const jobFormEl = document.getElementById('jobForm');
    const jobProtection = document.getElementById('jobProtection');
    const token = API.getToken();

    if (currentUser && token) {
        if (jobFormEl) jobFormEl.style.display = 'block';
        if (jobProtection) jobProtection.style.display = 'none';
        
        // Load user's jobs (requires the function in script.js)
        if (typeof loadUserJobs === 'function') loadUserJobs();
    } else {
        if (jobFormEl) jobFormEl.style.display = 'none';
        if (jobProtection) jobProtection.style.display = 'block';
    }
}
