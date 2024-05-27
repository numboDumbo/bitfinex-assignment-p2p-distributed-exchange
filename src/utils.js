const { v4: uuidv4 } = require('uuid');
const generateUniqueId = () => {
  return uuidv4();
};
const ORDER_TYPES = {
  BUY: 'buy',
  SELL: 'sell'
}


module.exports ={
  generateUniqueId,
  ORDER_TYPES
}
