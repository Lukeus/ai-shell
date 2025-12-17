# Monaco performance
- Monaco must be code-split and lazy-loaded via dynamic import.
- No monaco imports in startup code.
- Workers must be configured (vite plugin) so editor works when loaded.
- Verify by checking build output: monaco chunk absent from initial renderer bundle.
