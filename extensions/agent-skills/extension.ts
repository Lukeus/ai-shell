module.exports.activate = async function activate(contextOrApi) {
  const api = contextOrApi?.api ?? contextOrApi;
  if (api && typeof api.log === 'function') {
    api.log('Activated built-in agent-skills extension');
  }
};

module.exports.deactivate = async function deactivate() {
  // Intentionally empty.
};
