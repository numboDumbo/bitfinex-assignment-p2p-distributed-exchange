"use strict";

// Import required modules and libraries
const { setTimeout } = require("timers/promises");
const { generateUniqueId, ORDER_TYPES } = require("./utils");
const { PeerRPCServer, PeerRPCClient } = require("grenache-nodejs-http");
const Link = require("grenache-nodejs-link");
const orderBook = require("./orderBook");
const mutex = require("./mutex");

// Create a debug logger
const debug = require("debug")("bfx:client");

// Configure network parameters
const networkIp = "127.0.0.1";
const link = new Link({
  grape: `http://${networkIp}:30001`,
});
link.start();

// Initialize PeerRPCServer and PeerRPCClient
const peerServer = new PeerRPCServer(link, { timeout: 300000 });
peerServer.init();
const peerClient = new PeerRPCClient(link, {});
peerClient.init();

// Generate a unique client ID based on the address and port
const port = 1024 + Math.floor(Math.random() * 1000);
const clientId = `${networkIp}:${port}`;

// Initialize the PeerRPCServer service
const service = peerServer.transport("server");
service.listen(port);
debug(`Client listening on port ${port}`);



// Handle incoming requests
service.on("request", (rid, key, payload, handler) => {
  switch (key) {
    case "mutex:lock":
      mutex.lockClient(payload);
      handler.reply(null, { success: true });
      break;
    case "mutex:unlock":
      mutex.unlockClient(payload);
      handler.reply(null, { success: true });
      break;
    case "book:sync":
      handler.reply(null, { orderBook: orderBook.getAllOrders() });
      break;
    case "order:new":
      debug(
        "Received a new order:",
        payload.type,
        payload.price,
        payload.amount
      );
      const order = {
        ...payload,
      };
      const isFulfilled = orderBook.placeOrder(order);
      debug(`Was the market order fulfilled?`, isFulfilled);
      debug(`Order book length: ${orderBook.getOrderBookLength()}`);
      handler.reply(null, {
        success: true,
        isFulfilled,
        nbOrders: orderBook.getOrderBookLength(),
      });
      break;
    default:
      debug(`Unknown request type: ${key}`);
  }
});

// Function to request a mutex lock from all connected nodes
const askMutexLock = async (clientId) => {
  return new Promise((resolve, reject) => {
    debug("Requesting a mutex lock from all connected nodes");
    peerClient.map("mutex:lock", clientId, { timeout: 10000 }, (err, data) => {
      if (err) {
        if (err.message === "ERR_GRAPE_LOOKUP_EMPTY") {
          // This node is the first node in the network
          resolve();
          return;
        } else {
          console.error("mutex:lock error:", err.message);
          reject(err);
          return;
        }
      }
      debug("mutex:lock response:", data);
      resolve();
    });
  });
};

// Function to release the mutex lock for all connected nodes
const releaseMutexLock = async (clientId) => {
  return new Promise((resolve, reject) => {
    debug("Releasing the mutex lock for all connected nodes");
    peerClient.map(
      "mutex:unlock",
      clientId,
      { timeout: 10000 },
      (err, data) => {
        if (err) {
          if (err.message === "ERR_GRAPE_LOOKUP_EMPTY") {
            // This node is the first node in the network
            resolve();
            return;
          } else {
            console.error("mutex:unlock error:", err.message);
            reject(err);
            return;
          }
        }
        debug("mutex:unlock response:", data);
        resolve();
      }
    );
  });
};

// Function to sync the order book from another node on startup
const syncOrderBook = async () => {
  return new Promise((resolve, reject) => {
    debug("Syncing the order book");
    peerClient.request("book:sync", {}, { timeout: 10000 }, (err, data) => {
      if (err) {
        if (err.message === "ERR_GRAPE_LOOKUP_EMPTY") {
          // This node is the first node in the network, no orders to sync
          resolve();
          return;
        } else {
          console.error("book:sync error:", err.message);
          reject(err);
          return;
        }
      }
      orderBook.init(data.orderBook);
      resolve();
    });
  });
};

// Function to submit a new order
const submitNewOrder = async ({ price, amount, id, type }) => {
  // Wait for all locks to be released
  while (mutex.isAnyClientLocked()) {
    debug("Waiting for client locks to be released...");
    await setTimeout(100);
  }

  // Broadcast the new order to all nodes
  return new Promise((resolve, reject) => {
    debug("Submitting a new order:", type, price, amount);
    peerClient.map(
      "order:new",
      { price, amount, id, type },
      { timeout: 10000 },
      (err, data) => {
        if (err) {
          console.error("order:new error:", err.message);
          reject(err);
          return;
        }
        debug("order:new response:", data);
        resolve();
      }
    );
  });
};

// Function to wait for a client to be registered in the network
const waitForClientToBeRegistered = async (clientId) => {
  let isClientRegistered = false;
  let tries = 0;

  do {
    try {
      await new Promise((resolve, reject) => {
        debug(`Looking up the current client #${tries}`);
        link.lookup("order:new", { timeout: 10000 }, (err, data) => {
          if (err) {
            console.error("lookup error:", err.message);
            reject(err);
            return;
          }
          debug("lookup response:", data);
          isClientRegistered = data.includes(clientId);
          resolve();
        });
      });
    } catch (e) {
      debug("Error in lookup", e.message);
    }
    tries++;
    await setTimeout(10000); // Allow time for a new node to be discoverable by the network
  } while (!isClientRegistered && tries < 100);

  if (!isClientRegistered) {
    throw new Error("Unable to find the client registered on the Grape");
  }
};

// Start the client
(async () => {
  try {
    // Request all nodes to lock order submission while the client is synchronizing on the network
    await askMutexLock(clientId);

    // Announce the client on all services
    link.startAnnouncing("order:new", service.port, {});
    link.startAnnouncing("mutex:lock", service.port, {});
    link.startAnnouncing("mutex:unlock", service.port, {});

    // Ensure the client is accessible to others
    await waitForClientToBeRegistered(clientId);

    // Sync the order book from another node on startup
    await syncOrderBook();
    debug(`Initial order book length: ${orderBook.getOrderBookLength()}`);

    // Release the lock as the client is fully connected and synced
    await releaseMutexLock(clientId);

    // The client can now be requested by others to synchronize the order book
    link.startAnnouncing("book:sync", service.port);

    // Start trading by randomly submitting new orders
    submitRandomOrders();
  } catch (e) {
    console.error("Error while starting the trading client", e);
    process.exit(1);
  }
})();

// Handle SIGINT to stop announcing on the Grape when exiting
["SIGINT", "SIGTERM", "SIGQUIT"].forEach((signal) =>
  process.on(signal, async () => {
    debug("Stopping the client...");
    link.stopAnnouncing("order:new", service.port);
    link.stopAnnouncing("mutex.lock", service.port);
    link.stopAnnouncing("mutex.unlock", service.port);
    link.stopAnnouncing("book:sync", service.port);
    link.stop();

    // Wait for a brief period before exiting to allow for cleanup
    await setTimeout(2000);
    process.exit(0);
  })
);


const submitRandomOrders = async () => {
  try {
    const random = Math.random();
    const type = random < 0.5 ? ORDER_TYPES.BUY : ORDER_TYPES.SELL;
    const delay = 1000 + Math.floor(random * 9000);
    const price = 1000 + Math.floor(random * 100);
    const amount = Math.floor(random * 100);
    const id = generateUniqueId();
    await setTimeout(delay);
    await submitNewOrder({
      type,
      price,
      amount,
      id,
    });
  } catch (err) {
    console.error("submitNewOrder error:", err.message);
  }
  submitRandomOrders();
};
