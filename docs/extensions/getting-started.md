# Getting Started

This guide walks you through creating a minimal extension and installing it in
ai-shell.

## 1) Create an extension folder

Create a folder under your extensions directory:

```
~/.ai-shell/extensions/hello-extension
```

## 2) Create package.json

```json
{
  "id": "acme.hello-extension",
  "name": "hello-extension",
  "version": "1.0.0",
  "publisher": "acme",
  "main": "index.js",
  "activationEvents": ["onStartup"],
  "permissions": ["ui"]
}
```

## 3) Create index.js

```js
module.exports.activate = async function activate(context) {
  console.log(`[hello-extension] Activated ${context.extensionId}`);
};
```

## 4) Launch the app

Restart ai-shell. The Extension Registry will load the extension manifest from
`~/.ai-shell/extensions/hello-extension/package.json`.

## 5) Verify

Open the Extensions panel. Your extension should appear in the list.
