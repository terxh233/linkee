function initJobs() {
    allJobsEl = document.getElementById('allJobs');
    if (allJobsEl && typeof loadAllJobs === 'function') {
        loadAllJobs();
    }
}
