# Architecture (process boundaries)
Main (shell kernel):
- window/layout, update, policy, secrets, install/verify extensions, OS brokers
Renderer:
- UI only; calls brokers via contextBridge
Extension Host:
- untrusted extension execution; JSON-RPC to main
Agent Host:
- Deep Agents orchestration; calls tools that use broker-client -> broker-main

Rule: Only main touches OS (fs, keychain, process spawn).
