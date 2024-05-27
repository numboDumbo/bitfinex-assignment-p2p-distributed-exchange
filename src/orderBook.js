"use strict";
const _ = require("lodash");
const { ORDER_TYPES } = require("./utils");
// Import the required debugging module
const debug = require("debug")("bfx:orderBook");

// OrderBook class for managing buy and sell orders
class OrderBook {
  // Initialize arrays to store buy and sell orders
  buyOrders = [];
  sellOrders = [];

  // Constructor for the OrderBook class
  constructor() {}

  // Method to initialize the order book with existing orders
  init(book) {
    // Iterate through the provided orders and add them to the order book
    book.forEach((order) => this.addOrder(order));
  }

  // Method to add an order to the order book
  addOrder(order) {
    if (order.type === ORDER_TYPES.BUY) {
      // Storing buy in descending order of price
      const index = _.sortedIndexOf(this.buyOrders, order, (x) => -x.price);
      this.buyOrders.splice(index, 0, order);
    } else {
      // Storing buy in ascending order of price
      const index = _.sortedIndexOf(this.buyOrders, order, (x) => x.price);
      this.sellOrders.splice(index, 0, order);
    }
    // Debugging: Log the buy and sell orders
    debug("Buy orders", this.buyOrders);
    debug("Sell orders", this.sellOrders);
  }

  // Method to fulfill an order
  matchOrder(order) {
    // const matchedOrders = [];
    let remainingAmountToMatch = order.amount;

    //choosing the opposite trade type to focus on. Example: Focus on sellOrders for BUY orders
    const focusTradeType =
      order.type === ORDER_TYPES.BUY ? ORDER_TYPES.SELL : ORDER_TYPES.BUY;
    const focusOrdersList =
      focusTradeType === ORDER_TYPES.BUY ? this.buyOrders : this.sellOrders;

    debug(
      `${order.type} lookup for ${remainingAmountToMatch} at ${order.price}`
    );
    debug(`First ${focusTradeType} order: `, focusOrdersList[0]);

    while (
      remainingAmountToMatch > 0 &&
      focusOrdersList.length > 0 &&
      order.price >= focusOrdersList[0].price
    ) {
      const matchedOrder = focusOrdersList.shift();
      debug("Matching order:", matchedOrder);

      if (remainingAmountToMatch === matchedOrder.amount) {
        // Exact match
        // matchedOrders.push(matchedOrder);
        remainingAmountToMatch = 0;
      } else if (remainingAmountToMatch < matchedOrder.amount) {
        // Partial match, reduce the remaining part of the sell order
        matchedOrder.amount -= remainingAmountToMatch;
        focusOrdersList.unshift(matchedOrder);
        remainingAmountToMatch = 0;
      } else {
        // Partial match, deduct the matched order's amount
        remainingAmountToMatch -= matchedOrder.amount;
        // matchedOrders.push(matchedOrder);
      }
      debug("Amount remaining to match", remainingAmountToMatch);
    }
    return { remainingAmountToMatch };
  }

  // Method to place a market order
  placeOrder(order) {
    const { remainingAmountToMatch } = this.matchOrder(order);

    if (remainingAmountToMatch !== 0) {
      // Place the remaining part of the order in the order book
      this.addOrder({ ...order, amount: remainingAmountToMatch });
    }

    debug("Orderbook state after placeOrder");
    debug("buys: ", this.buyOrders);
    debug("sells: ", this.sellOrders);
    // Return true if any orders were matched, otherwise false
    return remainingAmountToMatch < order.amount;
  }

  // Method to get the total number of orders in the order book
  getOrderBookLength() {
    return this.buyOrders.length + this.sellOrders.length;
  }

  // Method to retrieve all orders in the order book
  getAllOrders() {
    return [...this.buyOrders, ...this.sellOrders];
  }
}

// Export the singleton object of OrderBook class for use in other modules
module.exports = new OrderBook();
