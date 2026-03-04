module.exports.activate = async function activate(api) {
  api.log('Activated built-in agent-skills extension');
};

module.exports.deactivate = async function deactivate() {
  // Intentionally empty.
};
