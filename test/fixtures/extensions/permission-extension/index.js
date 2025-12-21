module.exports.activate = async function activate(context) {
  if (context && context.extensionId) {
    // eslint-disable-next-line no-console
    console.log(`[permission-extension] Activated ${context.extensionId}`);
  }
};
