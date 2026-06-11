let providerDisposable = null;

export function registerPathCompletionProvider(monaco) {
  if (providerDisposable) {
    providerDisposable.dispose();
  }

  providerDisposable = monaco.languages.registerCompletionItemProvider('*', {
    triggerCharacters: ['/', '.', '"', "'"],
    provideCompletionItems: async (model, position) => {
      if (!window.electron) return { suggestions: [] };

      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      });

      // Simple regex to match string literals (single or double quotes)
      const match = textUntilPosition.match(/(['"])([^'"]*)$/);
      if (!match) return { suggestions: [] };

      const quote = match[1];
      const partialPath = match[2];

      // If it doesn't look like a path (e.g. starting with . or /), we might still want to autocomplete if we know it's a path.
      // But let's only trigger if it starts with . or / or if it's explicitly triggered.
      if (!partialPath.startsWith('.') && !partialPath.startsWith('/')) {
         // Maybe just allow it? Let's just allow if there's a slash somewhere, or if they just typed ./ or ../
         if (!partialPath.includes('/') && partialPath !== '') {
            return { suggestions: [] };
         }
      }

      // Determine the directory to read
      let dirToRead = '';
      const currentFilePath = model.uri.fsPath || model.uri.path;
      
      // Remove a leading slash on windows if present
      let normalizedCurrentFile = currentFilePath;
      if (navigator.userAgent.toLowerCase().includes('windows') && normalizedCurrentFile.startsWith('/')) {
         normalizedCurrentFile = normalizedCurrentFile.slice(1);
      }

      const currentDir = normalizedCurrentFile.substring(0, Math.max(normalizedCurrentFile.lastIndexOf('/'), normalizedCurrentFile.lastIndexOf('\\')));

      if (partialPath.startsWith('/')) {
        // Absolute path (not very common in web dev, usually from project root but we don't know the root here easily unless we ask workspace)
        dirToRead = partialPath;
      } else {
        // Relative path
        const parts = partialPath.split('/');
        parts.pop(); // Remove the incomplete filename part
        const relativeDir = parts.join('/');
        dirToRead = currentDir + (relativeDir ? '/' + relativeDir : '');
      }

      try {
        const entries = await window.electron.readDir(dirToRead);
        if (!entries || !Array.isArray(entries)) return { suggestions: [] };

        const wordInfo = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - (partialPath.split('/').pop().length),
          endColumn: position.column
        };

        const suggestions = entries.map(entry => {
          const kind = entry.isDir 
            ? monaco.languages.CompletionItemKind.Folder 
            : monaco.languages.CompletionItemKind.File;
          
          let insertText = entry.name;
          // If it's a directory, maybe append a slash?
          if (entry.isDir) {
            insertText += '/';
          }

          return {
            label: entry.name,
            kind,
            insertText,
            range,
            // Bump folders to the top
            sortText: entry.isDir ? '0-' + entry.name : '1-' + entry.name
          };
        });

        return { suggestions };
      } catch (e) {
        console.warn('Path completion error:', e);
        return { suggestions: [] };
      }
    }
  });

  return providerDisposable;
}
