# Distributed Order Book and Trading Client

This is a distributed order book and trading client application built with Node.js, utilizing the Grenache peer-to-peer communication library for real-time updates and order book synchronization across multiple nodes.

## Features

- **Distributed Order Book**: The order book is synchronized across all connected nodes, ensuring consistency and real-time updates.
- **Order Matching**: Orders are matched based on price and quantity, with partial order fulfillment supported.
- **Locking**: A distributed mutex lock mechanism ensures that when a new node is joining the network, write operations are avoided until the node is completely registered on the network.
- **Random Order Submission**: The client can submit random buy and sell orders at different prices and amounts to simulate a trading environment.

## Additional Dependencies

- lodash
- uuid
- debug

## Installation

1. Clone the repository or download the source code.
2. Navigate to the project directory.
3. Install the required dependencies by running `npm install`.

## Usage

1. Start the client by running `npm run client` or `npm run client:debug` for more detailed logging.
2. The client will automatically connect to the network, synchronize the order book, and start submitting random orders.

## Code Structure

- `client.js`: The main entry point of the application, responsible for initializing the client, handling network communication, and submitting orders.
- `orderBook.js`: Implements the order book functionality, including placing orders, matching orders, and retrieving the order book state.
- `mutex.js`: Handles the distributed mutex lock mechanism to account for locking nodes when nodes need to sync their data.
- `utils.js`: Contains utility functions and constants shared across the app.

## More features/ Known issues/ If I had to do it again

- I might use random gossips among random sets of nodes to ensure synchronization of OrderBooks. However this will involve syncing of each order and its values among nodes since there are two entry points of order add and modification. One is by client `order:new` event and when there is a partial match of orders. So syncing each even is also crucial. Which can be done by using OrderBook hashes to do a quick comparison.
- Adding a new node can temporary halt all nodes due to hard locks.
- Synchronization Delay: The synchronization and discovery of new nodes can take up to 10 seconds, which may be considered slow. Efforts to improve this delay could be explored.
- Client Cache: When a client is aborted, its IP address remains in the DHT cache, which can generate network errors for other clients. Finding a way to correctly and completely disconnect a client from the DHT is a potential improvement. Additionally, a restart of the Grape servers may be required to flush the cache when restarting the client.