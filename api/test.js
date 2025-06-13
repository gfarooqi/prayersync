module.exports = async function handler(req, res) {
  return res.status(200).json({ 
    message: 'API is working!', 
    method: req.method,
    query: req.query,
    timestamp: new Date().toISOString()
  });
};