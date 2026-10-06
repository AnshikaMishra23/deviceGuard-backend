function errorHandler(err, req, res, next) {
  console.error(err);
  if (err?.code === 11000) return res.status(409).json({ message: "A record with this value already exists" });
  return res.status(500).json({ message: "Internal server error" });
}
module.exports = errorHandler;
