// API Configuration
const API_BASE = 'http://localhost:3000/api';

// Auth state management
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// Check if user is logged in on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    initializeEventListeners();
    initializeAnimations();
});

// Check authentication status
async function checkAuthStatus() {
    if (authToken) {
        try {
            const response = await fetch(`${API_BASE}/users/profile`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const userData = await response.json();
                currentUser = userData;
                updateUIForLoggedInUser();
            } else {
                // Token is invalid, clear it
                localStorage.removeItem('authToken');
                authToken = null;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('authToken');
            authToken = null;
        }
    }
}

// Update UI for logged in user
function updateUIForLoggedInUser() {
    const navAuth = document.querySelector('.nav-auth');
    if (navAuth && currentUser) {
        navAuth.innerHTML = `
            <span class="user-greeting">Welcome, ${currentUser.first_name}!</span>
            <button class="btn-secondary" onclick="logout()">Logout</button>
        `;
    }
}

// Logout function
function logout() {
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    location.reload(); // Refresh page to reset UI
}

// Modal functionality
function openModal(modalType) {
    const modal = document.getElementById(modalType + 'Modal');
    
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Add animation
        setTimeout(() => {
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.style.transform = 'scale(1)';
                modalContent.style.opacity = '1';
            }
        }, 10);
    } else {
        console.error('Modal not found:', modalType + 'Modal');
    }
}

function closeModal(modalType) {
    const modal = document.getElementById(modalType + 'Modal');
    if (modal) {
        modal.querySelector('.modal-content').style.transform = 'scale(0.9)';
        modal.querySelector('.modal-content').style.opacity = '0';
        
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }
}

function switchModal(targetModal) {
    // Close current modal
    const currentModal = document.querySelector('.modal[style*="block"]');
    if (currentModal) {
        const currentType = currentModal.id.replace('Modal', '');
        closeModal(currentType);
    }
    
    // Open target modal after a brief delay
    setTimeout(() => {
        openModal(targetModal);
    }, 350);
}



// Authentication functions
async function handleLogin(formData) {
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: formData.get('email') || document.getElementById('login-email').value,
                password: formData.get('password') || document.getElementById('login-password').value
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Store token and user data
            localStorage.setItem('authToken', data.session.access_token);
            authToken = data.session.access_token;
            currentUser = data.user;
            
            // Redirect to appropriate dashboard based on role
            if (data.user.role === 'athlete') {
                window.location.href = '/athlete-dashboard.html';
            } else if (data.user.role === 'clinician') {
                window.location.href = '/clinician-dashboard.html';
            } else {
                // Fallback - close modal and update UI
                closeModal('login');
                updateUIForLoggedInUser();
                showMessage('Welcome back! You have been logged in successfully.', 'success');
            }
        } else {
            showMessage(data.error || 'Login failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Connection error. Please try again.', 'error');
    }
}

async function handleSignup(formData, role) {
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: formData.get('email') || document.getElementById('signup-email').value,
                password: formData.get('password') || document.getElementById('signup-password').value,
                firstName: formData.get('firstName') || document.getElementById('signup-firstname').value,
                lastName: formData.get('lastName') || document.getElementById('signup-lastname').value,
                role: role
            })
        });

        const data = await response.json();

        if (response.ok) {
            closeModal('signup');
            showMessage('Account created successfully! Please check your email to verify your account.', 'success');
        } else {
            showMessage(data.error || 'Registration failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Signup error:', error);
        showMessage('Connection error. Please try again.', 'error');
    }
}

// Show message function
function showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessage = document.querySelector('.toast-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `toast-message toast-${type}`;
    messageEl.textContent = message;
    
    // Add styles
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        ${type === 'success' ? 'background-color: #10b981;' : ''}
        ${type === 'error' ? 'background-color: #ef4444;' : ''}
        ${type === 'info' ? 'background-color: #3b82f6;' : ''}
    `;

    document.body.appendChild(messageEl);

    // Animate in
    setTimeout(() => {
        messageEl.style.transform = 'translateX(0)';
    }, 100);

    // Remove after 5 seconds
    setTimeout(() => {
        messageEl.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 300);
    }, 5000);
}

// Smooth scrolling functionality
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        const offsetTop = section.offsetTop - 80; // Account for fixed navbar
        window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
        });
    }
}

// Initialize event listeners
function initializeEventListeners() {
    // Main navigation buttons
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', () => openModal('login'));
    }
    if (signupBtn) {
        signupBtn.addEventListener('click', () => openModal('signup'));
    }

    // Hero section buttons
    const joinNetworkBtn = document.getElementById('join-network-btn');
    const learnMoreBtn = document.getElementById('learn-more-btn');
    const getStartedBtn = document.getElementById('get-started-btn');
    
    if (joinNetworkBtn) joinNetworkBtn.addEventListener('click', () => openModal('signup'));
    if (learnMoreBtn) learnMoreBtn.addEventListener('click', () => scrollToSection('features'));
    if (getStartedBtn) getStartedBtn.addEventListener('click', () => openModal('signup'));

    // Modal close buttons
    const closeLogin = document.getElementById('close-login');
    const closeSignup = document.getElementById('close-signup');
    
    if (closeLogin) closeLogin.addEventListener('click', () => closeModal('login'));
    if (closeSignup) closeSignup.addEventListener('click', () => closeModal('signup'));

    // Modal switch links
    const switchToSignup = document.getElementById('switch-to-signup');
    const switchToLogin = document.getElementById('switch-to-login');
    
    if (switchToSignup) {
        switchToSignup.addEventListener('click', function(e) {
            e.preventDefault();
            switchModal('signup');
        });
    }
    
    if (switchToLogin) {
        switchToLogin.addEventListener('click', function(e) {
            e.preventDefault();
            switchModal('login');
        });
    }



    // Close modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            const modalType = event.target.id.replace('Modal', '');
            closeModal(modalType);
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const openModal = document.querySelector('.modal[style*="block"]');
            if (openModal) {
                const modalType = openModal.id.replace('Modal', '');
                closeModal(modalType);
            }
        }
    });

    // Form submission handlers
    document.querySelectorAll('.auth-form').forEach(form => {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            // Show loading state
            submitBtn.textContent = 'Loading...';
            submitBtn.disabled = true;
            
            try {
                const formData = new FormData(this);
                const modalType = this.closest('.modal').id.replace('Modal', '');
                
                if (modalType === 'login') {
                    await handleLogin(formData);
                } else if (modalType === 'signup') {
                    // Get role from the select dropdown
                    const roleSelect = this.querySelector('#signup-role');
                    const role = roleSelect ? roleSelect.value : 'athlete';
                    
                    if (!role) {
                        showMessage('Please select your role (Athlete or Coach/Trainer)', 'error');
                        return;
                    }
                    
                    await handleSignup(formData, role);
                }
            } catch (error) {
                console.error('Form submission error:', error);
                showMessage('An error occurred. Please try again.', 'error');
            } finally {
                // Reset button state
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    });

    // Smooth scroll for navigation links (only for internal anchors)
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Only prevent default and smooth scroll for internal section links
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                scrollToSection(targetId);
            }
            // For external links like /about.html, /contact.html, let them navigate normally
        });
    });

    // Add loading animation to buttons on click
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', function() {
            if (this.type !== 'submit') {
                this.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 150);
            }
        });
    });
}

// Initialize animations and UI effects
function initializeAnimations() {
    // Set initial modal content styles for smooth animations
    document.querySelectorAll('.modal-content').forEach(content => {
        content.style.transform = 'scale(0.9)';
        content.style.opacity = '0';
        content.style.transition = 'all 0.3s ease';
    });

    // Add scroll effect to navbar
    let lastScrollTop = 0;
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling down
            navbar.style.transform = 'translateY(-100%)';
        } else {
            // Scrolling up
            navbar.style.transform = 'translateY(0)';
        }
        
        lastScrollTop = scrollTop;
    });
    
    // Add transition to navbar
    navbar.style.transition = 'transform 0.3s ease';

    // Add intersection observer for fade-in animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe feature cards for scroll animations
    document.querySelectorAll('.feature-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'all 0.6s ease';
        observer.observe(card);
    });
} 