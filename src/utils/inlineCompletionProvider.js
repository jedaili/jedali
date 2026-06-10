import { requestInlineCompletion } from './aiApi'
import { getActiveProvider } from './modelProviders'

let providerDisposable = null

function isInlineCompletionsEnabled() {
  return localStorage.getItem('myAiDesktop.inlineCompletionsEnabled') === 'true'
}

export function registerInlineCompletionProvider(monaco) {
  if (providerDisposable) {
    providerDisposable.dispose()
  }

  let timeoutId = null
  let cachedCompletions = {} // simplistic cache keyed by document version and position

  providerDisposable = monaco.languages.registerInlineCompletionsProvider('*', {
    provideInlineCompletions: async (model, position, context, token) => {
      // 1. Check if feature is enabled
      if (!isInlineCompletionsEnabled()) {
        return { items: [] }
      }

      // 2. Extract context
      const textBefore = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      })

      const textAfter = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: model.getLineCount(),
        endColumn: model.getLineMaxColumn(model.getLineCount())
      })

      // Skip if at the very beginning of the document or inside a word (simplistic check)
      const lastChar = textBefore.slice(-1)
      if (textBefore.trim() === '' || /[a-zA-Z0-9_]/.test(lastChar)) {
        // If we are actively typing a word, autocomplete might be annoying, but often users want it.
        // We'll allow it but debounce heavily.
      }

      const activeProvider = getActiveProvider()
      if (!activeProvider) return { items: [] }

      // 3. Debounce the request (800ms)
      return new Promise((resolve) => {
        if (timeoutId) clearTimeout(timeoutId)
        
        timeoutId = setTimeout(async () => {
          if (token.isCancellationRequested) {
            resolve({ items: [] })
            return
          }

          // Generate cache key
          const cacheKey = `${model.getAlternativeVersionId()}:${position.lineNumber}:${position.column}`
          if (cachedCompletions[cacheKey]) {
            resolve({ items: cachedCompletions[cacheKey] })
            return
          }

          const language = model.getLanguageId()
          
          try {
            let completionText = await requestInlineCompletion(
              activeProvider,
              textBefore,
              textAfter,
              language
            )

            if (!completionText) {
              resolve({ items: [] })
              return
            }

            // Clean up common AI artifacts
            completionText = completionText.replace(/^```[a-z]*\n/i, '')
            completionText = completionText.replace(/\n```$/i, '')
            // Ensure no leading spaces if we are mid-line and AI added them incorrectly
            if (lastChar !== ' ' && lastChar !== '\n' && completionText.startsWith(' ')) {
               completionText = completionText.trimStart()
            }

            // We only take the first few lines if it's very long
            const lines = completionText.split('\n')
            if (lines.length > 5) {
              completionText = lines.slice(0, 5).join('\n')
            }

            if (!completionText.trim()) {
              resolve({ items: [] })
              return
            }

            const items = [{
              insertText: completionText,
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              )
            }]

            cachedCompletions[cacheKey] = items
            resolve({ items })

          } catch (err) {
            console.warn('Inline Completion Error:', err)
            resolve({ items: [] })
          }
        }, 800)
      })
    },
    freeInlineCompletions: () => {
      // Clean up cache periodically or when completions are rejected
      // For now, we just rely on standard GC or limit cache size if needed
      if (Object.keys(cachedCompletions).length > 50) {
        cachedCompletions = {}
      }
    }
  })

  return providerDisposable
}
