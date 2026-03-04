module.exports.activate = async function activate(context) {
  if (context && context.extensionId) {
    // eslint-disable-next-line no-console
    console.log(`[skill-extension] Activated ${context.extensionId}`);
  }
};

module.exports.deactivate = async function deactivate() {
  // eslint-disable-next-line no-console
  console.log('[skill-extension] Deactivated');
};
