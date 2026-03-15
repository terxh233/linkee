// ============================================================
// Linkee Frontend — API-integrated script.js
// ============================================================

const API_BASE = '/api';

// === API Helper ===
const API = {
  getToken() {
    return localStorage.getItem('linkeeToken');
  },
  getHeaders(json = true) {
    const headers = {};
    if (json) headers['Content-Type'] = 'application/json';
    const token = this.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return headers;
  },
  async get(url) {
    const res = await fetch(API_BASE + url, { headers: this.getHeaders(false) });
    return res;
  },
  async post(url, body) {
    const res = await fetch(API_BASE + url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });
    return res;
  },
  async put(url, body) {
    const res = await fetch(API_BASE + url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });
    return res;
  },
  async delete(url) {
    const res = await fetch(API_BASE + url, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return res;
  }
};

// === Auth State ===
let currentUser = JSON.parse(localStorage.getItem('linkeeCurrentUser')) || null;

// Sample service data (static — always available in the services page)
const defaultServices = [
  {
    id: 1, name: 'Emergency Plumbing', category: 'plumbing',
    description: 'Fix leaks, unclog drains, water heater repair',
    price: '$50-150', icon: 'fas fa-wrench'
  },
  {
    id: 2, name: 'Electrical Wiring', category: 'electrical',
    description: 'Outlet installation, lighting, panel upgrades',
    price: '$75-200', icon: 'fas fa-plug'
  },
  {
    id: 3, name: 'Cabinet Installation', category: 'carpentry',
    description: 'Custom cabinets, furniture assembly, repairs',
    price: '$40-120', icon: 'fas fa-hammer'
  },
  {
    id: 4, name: 'Deep House Cleaning', category: 'cleaning',
    description: 'Full home cleaning, move-out, post-construction',
    price: '$30-80/hr', icon: 'fas fa-broom'
  },
  {
    id: 5, name: 'AC Repair', category: 'electrical',
    description: 'Air conditioning service and maintenance',
    price: '$100-300', icon: 'fas fa-fan'
  },
  {
    id: 6, name: 'Painting Services', category: 'carpentry',
    description: 'Interior/exterior painting, wallpaper removal',
    price: '$25-60/hr', icon: 'fas fa-paint-roller'
  }
];

// DOM elements — initialized on DOMContentLoaded
let servicesGrid, searchInput, categoryFilter, clearFilterBtn, jobForm, postedJobsEl, allJobsEl, loginLinks;

document.addEventListener('DOMContentLoaded', function () {
  loginLinks = document.querySelectorAll('.login-link');

  // Load navbar first
  const navbarScript = document.createElement('script');
  navbarScript.src = 'navbar.js';
  navbarScript.onload = initPage;
  document.head.appendChild(navbarScript);
});

function initPage() {
  const path = window.location.pathname.split('/').pop() || 'index.html';

  setupNavbar();
  checkLoginStatus();

  if ((path === 'services.html' || path === 'index.html' || path === '') && typeof initServices === 'function') {
    initServices();
  } else if (path === 'post-job.html' && typeof initPostJob === 'function') {
    initPostJob();
  } else if (path === 'jobs.html' && typeof initJobs === 'function') {
    initJobs();
  } else if (path === 'post-service.html' && typeof initPostService === 'function') {
    initPostService();
  } else if (path === 'profile.html' && typeof initProfile === 'function') {
    initProfile();
  }
}

// ============================================================
//  AUTH / LOGIN STATUS
// ============================================================

function checkLoginStatus() {
  const token = API.getToken();
  currentUser = JSON.parse(localStorage.getItem('linkeeCurrentUser')) || null;

  // Update navbar login links
  loginLinks = document.querySelectorAll('.login-link');
  loginLinks.forEach(link => {
    if (!currentUser || !token) {
      link.href = 'login.html';
      link.textContent = 'Login';
      link.onclick = null;
    } else {
      link.href = '#';
      link.textContent = 'Logout';
      link.onclick = logout;
    }
  });

  // Update profile and service links visibility
  const profileNavItems = document.querySelectorAll('.profile-nav-item');
  profileNavItems.forEach(item => {
    item.style.display = (currentUser && token) ? 'block' : 'none';
  });

  const serviceNavItems = document.querySelectorAll('.service-nav-item');
  serviceNavItems.forEach(item => {
    item.style.display = (currentUser && token && currentUser.role === 'provider') ? 'block' : 'none';
  });

  // Show login prompts on protected sections
  if (!currentUser || !token) {
    const protectedSections = document.querySelectorAll('[data-protected]');
    protectedSections.forEach(section => {
      if (!section.querySelector('.login-prompt')) {
        section.innerHTML = '<div class="login-prompt" style="min-height:400px;padding:4rem 2rem;background:white;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.1);text-align:center;"><h3>Login Required</h3><p><a href="login.html" class="login-link btn btn-primary">Login to Continue</a></p></div>';
      }
    });
  }

  // Show/hide protected forms (post-job, post-service)
  const jobFormEl = document.getElementById('jobForm');
  const jobProtection = document.getElementById('jobProtection');
  if (jobFormEl && jobProtection) {
    if (currentUser && token) {
      jobFormEl.style.display = 'block';
      jobProtection.style.display = 'none';
    } else {
      jobFormEl.style.display = 'none';
      jobProtection.style.display = 'block';
    }
  }

  const serviceFormEl = document.getElementById('serviceForm');
  const serviceProtection = document.getElementById('serviceProtection');
  if (serviceFormEl && serviceProtection) {
    if (currentUser && token) {
      serviceFormEl.style.display = 'block';
      serviceProtection.style.display = 'none';
    } else {
      serviceFormEl.style.display = 'none';
      serviceProtection.style.display = 'block';
    }
  }

  const profileFormEl = document.getElementById('profileForm');
  const profileProtection = document.getElementById('profileProtection');
  if (profileFormEl && profileProtection) {
    if (currentUser && token) {
      profileFormEl.style.display = 'block';
      profileProtection.style.display = 'none';
    } else {
      profileFormEl.style.display = 'none';
      profileProtection.style.display = 'block';
    }
  }
}

function logout(e) {
  if (e) e.preventDefault();
  localStorage.removeItem('linkeeToken');
  localStorage.removeItem('linkeeCurrentUser');
  currentUser = null;
  window.location.href = 'login.html';
}

// ============================================================
//  PROFILE PAGE
// ============================================================

function initProfile() {
  const profileForm = document.getElementById('profileForm');
  if (!profileForm) return;

  const profileImagePreview = document.getElementById('profileImagePreview');
  const profileDescription = document.getElementById('profileDescription');
  const profilePictureInput = document.getElementById('profilePicture');
  const profileMessage = document.getElementById('profileMessage');

  // Load existing profile via API
  API.get('/me').then(res => {
    if (res.ok) {
      res.json().then(data => {
        if (data.description) profileDescription.value = data.description;
        if (data.profilePicture) {
           profileImagePreview.innerHTML = `<img src="${data.profilePicture}" style="width:100%; height:100%; object-fit:cover;">`;
        }
      });
    }
  });

  // Handle picture preview dynamically
  profilePictureInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        profileImagePreview.innerHTML = `<img src="${event.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
      }
      reader.readAsDataURL(file);
    }
  });

  // Submit profile updates
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveProfileBtn');
    const description = profileDescription.value;
    const file = profilePictureInput.files[0];

    btn.disabled = true;
    btn.textContent = 'Saving...';

    // Helper definition inline here or reuse
    const fileToBase64 = (f) => new Promise((resolve, reject) => {
      if (!f) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(f);
    });

    const profileData = { description };
    if (file) {
      profileData.profilePicture = await fileToBase64(file);
    }

    try {
      const res = await API.put('/me', profileData);
      if (res.ok) {
        profileMessage.textContent = 'Profile updated successfully!';
        profileMessage.style.backgroundColor = '#e0ffe0';
        profileMessage.style.color = '#070';
        profileMessage.style.display = 'block';
      } else {
        profileMessage.textContent = 'Failed to update profile.';
        profileMessage.style.backgroundColor = '#ffe0e0';
        profileMessage.style.color = '#c00';
        profileMessage.style.display = 'block';
      }
    } catch (err) {
      profileMessage.textContent = 'Error saving profile.';
      profileMessage.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Profile';
    }
  });

  // Load and display Inbox Messages (for all logged in users)
  const providerInboxSection = document.getElementById('providerInboxSection');
  const inboxMessagesDiv = document.getElementById('inboxMessages');
  
  if (currentUser && providerInboxSection && inboxMessagesDiv) {
      providerInboxSection.style.display = 'block';
      
      API.get('/messages').then(res => {
          if (res.ok) {
              res.json().then(messages => {
                  if (messages.length === 0) {
                      inboxMessagesDiv.innerHTML = '<p style="text-align:center; color:#777; font-style:italic;">Your inbox is empty.</p>';
                  } else {
                      inboxMessagesDiv.innerHTML = messages.map(msg => `
                          <div class="message-card" style="background:#f8f9fa; border-left:4px solid #667eea; padding:15px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                              <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                                  <h4 style="margin:0; font-size:16px;">From: ${msg.senderName} (<a href="mailto:${msg.senderEmail}" style="color:#667eea;">${msg.senderEmail}</a>)</h4>
                                  <small style="color:#888;">${new Date(msg.createdAt).toLocaleString()}</small>
                              </div>
                              <p style="margin:0; line-height:1.5; color:#444; margin-bottom:10px;">${msg.content}</p>
                              ${msg.senderId ? `<button class="btn btn-secondary btn-sm" onclick="replyToMessage('${msg.senderId}', '${msg.senderName}')">Reply</button>` : ''}
                          </div>
                      `).join('');
                  }
              });
          } else {
              inboxMessagesDiv.innerHTML = '<p style="text-align:center; color:#c00;">Failed to load messages.</p>';
          }
      }).catch(err => {
          inboxMessagesDiv.innerHTML = '<p style="text-align:center; color:#c00;">Error connecting to message server.</p>';
      });
  }

  // Setup Message Modal listeners if on Profile page
  const messageModal = document.getElementById('messageModal');
  if (messageModal) {
    document.getElementById('closeMessageModal').addEventListener('click', () => {
        messageModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target == messageModal) messageModal.style.display = 'none';
    });
    document.getElementById('sendMessageForm').addEventListener('submit', handleSendMessage);
  }
}

// Helper to open reply modal
function replyToMessage(receiverId, senderName) {
  const messageModal = document.getElementById('messageModal');
  if (messageModal) {
      document.getElementById('messageReceiverId').value = receiverId;
      document.getElementById('messageModalTitle').textContent = `Reply to ${senderName}`;
      
      document.getElementById('msgContent').value = '';
      document.getElementById('messageStatus').style.display = 'none';
      document.getElementById('sendMessageBtn').disabled = false;
      document.getElementById('sendMessageBtn').textContent = 'Send Message';
      
      messageModal.style.display = 'block';
  }
}

// ============================================================
//  SERVICES PAGE
// ============================================================

let allServices = [];

async function initServices() {
  servicesGrid = document.getElementById('servicesGrid');
  searchInput = document.getElementById('searchInput');
  categoryFilter = document.getElementById('categoryFilter');
  clearFilterBtn = document.getElementById('clearFilter');

  if (!servicesGrid) return;
  
  if (searchInput) searchInput.addEventListener('input', filterServices);
  if (categoryFilter) categoryFilter.addEventListener('change', filterServices);
  if (clearFilterBtn) clearFilterBtn.addEventListener('click', clearFilters);

  // Setup Message Modal listeners if on Services page
  const messageModal = document.getElementById('messageModal');
  if (messageModal) {
    document.getElementById('closeMessageModal').addEventListener('click', () => {
        messageModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target == messageModal) messageModal.style.display = 'none';
    });
    document.getElementById('sendMessageForm').addEventListener('submit', handleSendMessage);
  }

  try {
    const res = await API.get('/providers');
    if (res.ok) {
        const providers = await res.json();
        // Map backend users to UI service objects
        allServices = providers.map(p => ({
            id: p.id,
            category: p.providerCategory || 'other',
            name: p.name || 'Anonymous Provider',
            description: p.description || 'No description provided.',
            price: 'Contact for Quote',
            profilePicture: p.profilePicture,
            createdAt: p.createdAt
        }));
        renderServices(allServices);
    } else {
        servicesGrid.innerHTML = '<p>Failed to load services.</p>';
    }
  } catch (err) {
      servicesGrid.innerHTML = '<p>Error loading providers from background API.</p>';
  }
}

function renderServices(serviceList) {
  if (!servicesGrid) return;
  
  if (serviceList.length === 0) {
      servicesGrid.innerHTML = '<p style="text-align:center; padding: 2rem; width: 100%;">No service providers found.</p>';
      return;
  }
  
  servicesGrid.innerHTML = serviceList.map(service => {
    // Generate avatar/initials or use uploaded picture
    let avatarHTML = '';
    if (service.profilePicture) {
        avatarHTML = `<img src="${service.profilePicture}" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
        avatarHTML = `<i class="fas fa-user" style="color:white; font-size:32px;"></i>`;
    }
    
    const joinedDate = service.createdAt ? new Date(service.createdAt).toLocaleDateString() : 'Recently';

    return `
    <div class="service-card" data-category="${service.category}" style="display:flex; flex-direction:column;">
      <div style="display:flex; align-items:center; gap: 15px; margin-bottom: 15px;">
          <div class="service-icon" style="flex-shrink:0; margin-bottom:0; overflow:hidden; border: 3px solid #667eea; padding:0; width:64px; height:64px; display:flex; align-items:center; justify-content:center;">
             ${avatarHTML}
          </div>
          <div style="text-align: left;">
             <h3 style="margin-bottom:0; font-size:18px;">${service.name}</h3>
             <small style="color: #667eea; font-weight: 600; text-transform: capitalize;">${service.category}</small>
          </div>
      </div>
      <p style="flex-grow:1;">${service.description}</p>
      <small style="color:#718096; margin-bottom: 10px; display:block;">Joined: ${joinedDate}</small>
      <button class="btn btn-secondary" style="width:100%;" onclick="hirePro('${service.id}')">Contact Provider</button>
    </div>
  `}).join('');
}

function filterServices() {
  const searchTerm = searchInput.value.toLowerCase();
  const category = categoryFilter.value;

  const filtered = allServices.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm) ||
      service.description.toLowerCase().includes(searchTerm);
    const matchesCategory = !category || service.category === category;
    return matchesSearch && matchesCategory;
  });

  renderServices(filtered);
  if (clearFilterBtn) clearFilterBtn.style.display = (searchTerm || category) ? 'block' : 'none';
}

function clearFilters() {
  if (searchInput) searchInput.value = '';
  if (categoryFilter) categoryFilter.value = '';
  renderServices(allServices);
  if (clearFilterBtn) clearFilterBtn.style.display = 'none';
}

function hirePro(serviceId) {
  const service = allServices.find(s => s.id == serviceId);
  const messageModal = document.getElementById('messageModal');
  
  if (service && messageModal) {
      document.getElementById('messageReceiverId').value = service.id;
      document.getElementById('messageModalTitle').textContent = `Contact ${service.name}`;
      
      document.getElementById('msgContent').value = '';
      document.getElementById('messageStatus').style.display = 'none';
      document.getElementById('sendMessageBtn').disabled = false;
      document.getElementById('sendMessageBtn').textContent = 'Send Message';
      
      messageModal.style.display = 'block';
  } else {
      alert("Could not open messaging. Please try again later.");
  }
}

async function handleSendMessage(e) {
    e.preventDefault();
    
    // Check if user is logged in
    if (!API.getToken()) {
        const statusDiv = document.getElementById('messageStatus');
        statusDiv.textContent = 'You must be logged in to send a message.';
        statusDiv.style.backgroundColor = '#ffe0e0';
        statusDiv.style.color = '#c00';
        statusDiv.style.display = 'block';
        setTimeout(() => window.location.href = 'login.html', 2000);
        return;
    }

    const receiverId = document.getElementById('messageReceiverId').value;
    const content = document.getElementById('msgContent').value;
    const btn = document.getElementById('sendMessageBtn');
    const statusDiv = document.getElementById('messageStatus');

    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        const res = await API.post('/messages', {
            receiverId,
            content
        });

        const data = await res.json();

        if (res.ok) {
            statusDiv.textContent = 'Message sent successfully!';
            statusDiv.style.backgroundColor = '#e0ffe0';
            statusDiv.style.color = '#070';
            statusDiv.style.display = 'block';
            
            setTimeout(() => {
                document.getElementById('messageModal').style.display = 'none';
            }, 2000);
        } else {
            statusDiv.textContent = data.error || 'Failed to send message.';
            statusDiv.style.backgroundColor = '#ffe0e0';
            statusDiv.style.color = '#c00';
            statusDiv.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Send Message';
        }
    } catch (err) {
        statusDiv.textContent = 'Connection error. Please try again.';
        statusDiv.style.backgroundColor = '#ffe0e0';
        statusDiv.style.color = '#c00';
        statusDiv.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Send Message';
    }
}

// ============================================================
//  POST JOB PAGE
// ============================================================

function initPostJob() {
  jobForm = document.getElementById('jobForm');
  postedJobsEl = document.getElementById('postedJobs');

  if (jobForm) {
    jobForm.addEventListener('submit', handleJobSubmit);
  }

  // Load user's posted jobs from the API
  if (currentUser && API.getToken()) {
    loadUserJobs();
  }
}

async function handleJobSubmit(e) {
  e.preventDefault();

  const jobData = {
    title: document.getElementById('jobTitle').value,
    category: document.getElementById('jobCategory').value,
    description: document.getElementById('jobDescription').value,
    budget: document.getElementById('budget').value,
    location: document.getElementById('location').value
  };

  try {
    const res = await API.post('/jobs', jobData);
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Failed to post job');
      return;
    }

    alert('Job posted successfully! Pros will contact you soon.');
    jobForm.reset();
    loadUserJobs();
  } catch (err) {
    alert('Could not connect to server. Is the backend running?');
  }
}

async function loadUserJobs() {
  if (!postedJobsEl) return;

  try {
    const res = await API.get('/jobs/user');
    if (!res.ok) return;

    const jobs = await res.json();
    renderPostedJobs(jobs);
  } catch (err) {
    console.error('Error loading user jobs:', err);
  }
}

function renderPostedJobs(jobs) {
  if (!postedJobsEl) return;

  if (!jobs || jobs.length === 0) {
    postedJobsEl.style.display = 'block';
    postedJobsEl.innerHTML = '<h3>Your Posted Jobs</h3><p>No jobs posted yet. Post your first job above!</p>';
    return;
  }

  postedJobsEl.style.display = 'block';
  postedJobsEl.innerHTML = `
    <h3>Your Posted Jobs (${jobs.length})</h3>
    ${jobs.map(job => `
      <div class="job-item">
        <div>
          <h4>${job.title}</h4>
          <p>${job.category} • $${job.budget} • ${job.location}</p>
          <small>Posted: ${job.date || new Date(job.createdAt).toLocaleDateString()}</small>
        </div>
        <div>
          <button class="btn" style="background:#ff6b6b;color:white;" onclick="deleteJob(${job.id})">Delete</button>
        </div>
      </div>
    `).join('')}
  `;
}

async function deleteJob(jobId) {
  if (!confirm('Delete this job?')) return;

  try {
    const res = await API.delete('/jobs/' + jobId);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to delete job');
      return;
    }

    loadUserJobs();
  } catch (err) {
    alert('Could not connect to server.');
  }
}

// ============================================================
//  JOBS LIST PAGE
// ============================================================

function initJobs() {
  allJobsEl = document.getElementById('allJobs');
  if (!allJobsEl) return;

  loadAllJobs();
}

async function loadAllJobs() {
  if (!allJobsEl) return;

  try {
    const res = await API.get('/jobs');
    if (!res.ok) return;

    const jobs = await res.json();
    const noJobsMsg = document.getElementById('noJobsMsg');

    if (jobs.length === 0) {
      if (noJobsMsg) noJobsMsg.style.display = 'block';
      return;
    }

    if (noJobsMsg) noJobsMsg.style.display = 'none';

    // Job Template Helper
    const createJobHTML = (job, isRecommended = false) => {
      let actionHTML = '';
      if (currentUser && currentUser.role === 'provider') {
        actionHTML = `<button class="btn btn-primary btn-sm" onclick="applyForJob(${job.id})">Apply for Job</button>`;
      } else {
        actionHTML = `<button class="btn-ai btn-ai-sm" data-match-btn="${job.id}" onclick="findMatchingServices(${job.id})">✨ Find Services</button>`;
      }

      return `
      <div class="job-item" style="flex-wrap:wrap; ${isRecommended ? 'border-left: 4px solid #667eea; background: #f8faff;' : ''}">
        <div style="flex:1;">
          <h4 style="margin-bottom:0;">
            ${job.title}
            ${isRecommended ? '<span style="font-size:12px; background:#667eea; color:white; padding:2px 8px; border-radius:12px; margin-left:8px; vertical-align:middle;">Match</span>' : ''}
          </h4>
          <p>${job.category} • $${job.budget} • ${job.location}</p>
          <small>Posted: ${job.date || new Date(job.createdAt).toLocaleDateString()}</small>
        </div>
        <div>
          ${actionHTML}
        </div>
        <div class="ai-suggestion" data-match-result="${job.id}" style="display:none;width:100%;"></div>
      </div>
    `};

    // Personalized display for providers
    if (currentUser && currentUser.role === 'provider') {
      const userCategory = currentUser.providerCategory ? currentUser.providerCategory.toLowerCase() : '';
      
      const recommendedJobs = jobs.filter(j => j.category.toLowerCase() === userCategory);
      const otherJobs = jobs.filter(j => j.category.toLowerCase() !== userCategory);

      let html = '';
      
      if (recommendedJobs.length > 0) {
        html += `
          <h3 style="color:#667eea; display:flex; align-items:center; justify-content:center; gap:8px;">
            ✨ Recommended for You (${recommendedJobs.length})
          </h3>
          ${recommendedJobs.map(j => createJobHTML(j, true)).join('')}
          <div class="divider"><span>Other Jobs</span></div>
        `;
      }

      html += `
        <h3>Browse All Jobs (${otherJobs.length})</h3>
        ${otherJobs.map(j => createJobHTML(j, false)).join('')}
      `;
      
      allJobsEl.innerHTML = html;
      
    } else {
      // Standard display for customers
      allJobsEl.innerHTML = `
        <h3>Recent Jobs (${jobs.length})</h3>
        ${jobs.map(job => createJobHTML(job, false)).join('')}
      `;
    }
  } catch (err) {
    allJobsEl.innerHTML = '<h3>Recent Jobs</h3><p>Could not load jobs. Is the backend running?</p>';
  }
}

function applyForJob(jobId) {
  alert(`Application sent for Job #${jobId}! The customer will review your profile shortly.`);
}

// ============================================================
//  POST SERVICE PAGE
// ============================================================

function initPostService() {
  const serviceForm = document.getElementById('serviceForm');
  const postedServices = document.getElementById('postedServices');

  if (serviceForm) {
    serviceForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const serviceData = {
        businessName: document.getElementById('businessName').value,
        category: document.getElementById('serviceCategory').value,
        location: document.getElementById('businessLocation').value,
        email: document.getElementById('businessEmail').value,
        phone: document.getElementById('businessPhone').value,
        description: document.getElementById('serviceDescription').value,
        servicesOffered: document.getElementById('servicesOffered').value
      };

      try {
        const res = await API.post('/services', serviceData);
        const data = await res.json();

        if (!res.ok) {
          alert(data.error || 'Failed to post service');
          return;
        }

        alert('Service posted successfully!');
        serviceForm.reset();
        loadUserServices();
      } catch (err) {
        alert('Could not connect to server. Is the backend running?');
      }
    });
  }

  // Load user's services
  if (currentUser && API.getToken()) {
    loadUserServices();
  }
}

async function loadUserServices() {
  const postedServices = document.getElementById('postedServices');
  if (!postedServices) return;

  try {
    const res = await API.get('/services/user');
    if (!res.ok) return;

    const services = await res.json();

    if (services.length === 0) {
      postedServices.style.display = 'block';
      postedServices.innerHTML = '<h3>Your Posted Services</h3><p>No services posted yet.</p>';
      return;
    }

    postedServices.style.display = 'block';
    postedServices.innerHTML = `
      <h3>Your Posted Services (${services.length})</h3>
      ${services.map(svc => `
        <div class="job-item">
          <div>
            <h4>${svc.businessName}</h4>
            <p>${svc.category} • ${svc.location}</p>
            <p>${svc.description}</p>
            <small>Posted: ${new Date(svc.createdAt).toLocaleDateString()}</small>
          </div>
          <div>
            <button class="btn" style="background:#ff6b6b;color:white;" onclick="deleteService(${svc.id})">Delete</button>
          </div>
        </div>
      `).join('')}
    `;
  } catch (err) {
    console.error('Error loading user services:', err);
  }
}

async function deleteService(serviceId) {
  if (!confirm('Delete this service?')) return;

  try {
    const res = await API.delete('/services/' + serviceId);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to delete service');
      return;
    }

    loadUserServices();
  } catch (err) {
    alert('Could not connect to server.');
  }
}

// ============================================================
//  NAVBAR SETUP
// ============================================================

function setupNavbar() {
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');

  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('active');
    });
  }
}

// ============================================================
//  SCROLL ANIMATIONS
// ============================================================

const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, observerOptions);

document.querySelectorAll('.service-card, .post-job, .services h2, .feature-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(30px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});
