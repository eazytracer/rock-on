/**
 * Reusable selectors for E2E tests
 * Use semantic selectors (data-testid, role, text) where possible
 */

export const selectors = {
  // Authentication
  auth: {
    // Login form
    emailInput:
      '[data-testid="login-email-input"], input[name="email"], input[type="email"]',
    passwordInput:
      '[data-testid="login-password-input"], input[name="password"]',
    signInButton: 'button[type="submit"]:has-text("Log In")',

    // Signup form
    nameInput: '[data-testid="signup-name-input"], input[name="name"]',
    signupEmailInput: '[data-testid="signup-email-input"]',
    signupPasswordInput: '[data-testid="signup-password-input"]',
    confirmPasswordInput:
      '[data-testid="signup-confirm-password-input"], input[name="confirmPassword"]',
    signUpButton: 'button[type="submit"]:has-text("Create Account")',

    // Navigation between forms
    switchToSignUp: 'button:has-text("Don\'t have an account")',
    switchToSignIn: 'button:has-text("Already have an account")',

    // Error messages
    errorMessage: '.text-\\[\\#D7263D\\], [role="alert"]',
  },

  // Bands
  band: {
    // Create band
    nameInput:
      '[data-testid="create-band-name-input"], input[name="bandName"], input[id="band-name"]',
    descriptionInput:
      'textarea[name="description"], textarea[id="description"]',
    createButton:
      '[data-testid="create-band-button"], button:has-text("Create Band")',

    // Join band
    inviteCodeInput:
      '[data-testid="join-band-invite-code-input"], input[name="inviteCode"], input[id="invite-code"]',
    joinButton:
      '[data-testid="join-band-button"], button:has-text("Join Band")',

    // Band management
    inviteCode: '[data-testid="invite-code"], code:has-text("-")',
    bandSelector: '[data-testid="band-selector"]',
    bandOption: '[data-testid="band-option"]',
    bandName: '[data-testid="band-name"]',
    sidebarBandName: '[data-testid="sidebar-band-name"]', // Band name in sidebar header
    memberRow: '[data-testid="member-row"]',
    memberRole: '[data-testid="member-role"]',
  },

  // Songs
  songs: {
    addButton: 'button:has-text("Add Song"), [data-testid="add-song"]',
    titleInput: 'input[name="title"], input[id="title"]',
    artistInput: 'input[name="artist"], input[id="artist"]',
    keySelect: 'select[name="key"], select[id="key"]',
    durationInput: 'input[name="duration"], input[id="duration"]',
    bpmInput:
      'input[name="bpm"], input[id="bpm"], input[name="tempo"], input[id="tempo"]',
    tuningInput: 'input[name="tuning"], input[id="tuning"]',
    saveButton: 'button:has-text("Save"), button[type="submit"]',
    songRow: '[data-testid^="song-row-"]',
    songTitle: '[data-testid="song-title"]',
    emptyState:
      '[data-testid="empty-state"], .text-center:has-text("No songs")',
  },

  // Setlists
  setlists: {
    addButton: 'button:has-text("Add Setlist"), button:has-text("New Setlist")',
    nameInput: 'input[name="name"], input[id="name"]',
    saveButton: 'button:has-text("Save"), button[type="submit"]',
    setlistRow: '[data-testid^="setlist-row-"]',
    setlistName: '[data-testid="setlist-name"]',
  },

  // Shows
  shows: {
    addButton: 'button:has-text("Add Show"), button:has-text("New Show")',
    venueInput: 'input[name="venue"], input[id="venue"]',
    dateInput: 'input[name="date"], input[type="date"]',
    saveButton: 'button:has-text("Save"), button[type="submit"]',
    showRow: '[data-testid^="show-row-"]',
  },

  // Practices
  practices: {
    addButton:
      'button:has-text("Add Practice"), button:has-text("Schedule Practice")',
    dateInput: 'input[name="date"], input[type="date"]',
    timeInput: 'input[name="time"], input[type="time"]',
    saveButton: 'button:has-text("Save"), button[type="submit"]',
    practiceRow: '[data-testid^="practice-row-"]',
    startSessionButton: '[data-testid="start-practice-button"]',
    addSongsButton: 'button:has-text("Add Songs")',
  },

  // Practice Session
  practiceSession: {
    exitButton: '[data-testid="session-exit-button"]',
    timer: '[data-testid="session-timer"]',
    progress: '[data-testid="session-progress"]',
    songTitle: '[data-testid="session-song-title"]',
    songArtist: '[data-testid="session-song-artist"]',
    songKey: '[data-testid="session-song-key"]',
    songTuning: '[data-testid="session-song-tuning"]',
    songBpm: '[data-testid="session-song-bpm"]',
    notes: '[data-testid="session-notes"]',
    prevButton: '[data-testid="session-prev-button"]',
    nextButton: '[data-testid="session-next-button"]',
    endButton: '[data-testid="session-end-button"]',
  },

  // Common UI elements
  common: {
    userMenu: '[data-testid="user-menu"]',
    logoutButton: 'button:has-text("Log Out"), a:has-text("Log Out")',
    toast: '[data-testid^="toast-"]',
    toastSuccess: '[data-testid="toast-success"]',
    toastError: '[data-testid="toast-error"]',
    loading: '[data-testid="loading"], .animate-spin',
    modal: '[role="dialog"], [data-testid="modal"]',
    modalClose: 'button[aria-label="Close"], button:has-text("Close")',
  },

  // Navigation
  nav: {
    songsLink: 'a[href="/songs"], nav a:has-text("Songs")',
    setlistsLink: 'a[href="/setlists"], nav a:has-text("Setlists")',
    showsLink: 'a[href="/shows"], nav a:has-text("Shows")',
    practicesLink: 'a[href="/practices"], nav a:has-text("Practices")',
    bandMembersLink: 'a[href="/band-members"], nav a:has-text("Members")',
  },
}
