module.exports = {
  v4: () => "test-uuid-" + Math.random().toString(36).substr(2, 9),
  validate: () => true,
  parse: () => [],
  stringify: () => "",
};
