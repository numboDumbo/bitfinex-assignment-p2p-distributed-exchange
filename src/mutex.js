"use strict";

// Import the required debugging module
const debug = require("debug")("bfx:mutex");

// Mutex class for managing client locks
class Mutex {
  // Initialize a Set to store locked client IDs
  lockedClients = new Set();

  // Constructor for the Mutex class
  constructor() {}

  // Method to lock a client
  lockClient(clientId) {
    this.lockedClients.add(clientId);
    // Debugging: Log locked client IDs
    debug("Client locked => Locked Clients:", this.lockedClients);
  }

  // Method to unlock a client
  unlockClient(clientId) {
    this.lockedClients.delete(clientId);
    // Debugging: Log unlocked client IDs
    debug("Client unlocked => Locked Clients:", this.lockedClients);
  }

  // Method to check if any clients are currently locked
  isAnyClientLocked() {
    // Debugging: Log the current set of locked client IDs
    debug("Locked Clients:", this.lockedClients);
    return this.lockedClients.size > 0;
  }
}

// Export the singleton mutex object for use in other modules
module.exports = new Mutex();
