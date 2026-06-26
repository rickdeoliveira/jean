# Performance Patterns

### The `getState()` Pattern (Critical)

**Problem**: Subscribing to frequently-changing store data in component callbacks causes render cascades.

**Solution**: Subscribe only to data that should trigger re-renders. For callbacks that need current state, use `getState()`.

```typescript
// ❌ BAD: Causes render cascade on every keystroke
const { currentFile, isDirty, saveFile } = useEditorStore()

const handleSave = useCallback(() => {
  if (currentFile && isDirty) {
    void saveFile()
  }
}, [currentFile, isDirty, saveFile]) // Re-creates on every change!

// ✅ GOOD: No cascade, stable callback
const { setEditorContent } = useEditorStore() // Only subscribe to needed actions

const handleSave = useCallback(() => {
  const { currentFile, isDirty, saveFile } = useEditorStore.getState()
  if (currentFile && isDirty) {
    void saveFile()
  }
}, []) // Stable dependency array
```

### When to Use `getState()` Pattern

1. **In useCallback dependencies**: When you need current state but don't want re-renders
2. **In event handlers**: For accessing latest state without subscriptions
3. **In useEffect with empty deps**: When you need current state on mount only
4. **In async operations**: When state might change during execution

### Store Subscription Optimization

```typescript
// ❌ BAD: Object destructuring triggers re-renders
const { currentFile } = useEditorStore()

// ✅ GOOD: Primitive selectors only change when needed
const hasCurrentFile = useEditorStore(state => !!state.currentFile)
const currentFileName = useEditorStore(state => state.currentFile?.name)
```

### CSS Visibility vs Conditional Rendering

For stateful UI components (like `react-resizable-panels`), use CSS visibility:

```typescript
// ❌ BAD: Conditional rendering breaks stateful components
{sidebarVisible ? <ResizablePanel /> : null}

// ✅ GOOD: CSS visibility preserves component tree
<ResizablePanel className={sidebarVisible ? '' : 'hidden'} />
```

### Strategic React.memo Placement

Use React.memo to break render cascades at component boundaries:

```typescript
// ✅ GOOD: Breaks cascade propagation
const EditorArea = React.memo(({ panelVisible }) => {
  // Component only re-renders when panelVisible changes
  // Not affected by parent re-renders from unrelated state
})
```

---

### Store no-op guards on hot UI paths

Zustand `set()` notifies subscribers even for logically unchanged values. On hot app surfaces (sidebar rows, chat session state, modal visibility, canvas state), guard primitive/record setters before allocating new objects:

```typescript
set(state => (state.modalOpen === open ? state : { modalOpen: open }))
```

For per-session/worktree records, preserve existing object references when the target value is unchanged. This is especially important for selectors used by `ChatWindow`, `WorktreeItem`, and `ProjectCanvasView`.

### Sidebar row selectors should return primitives

Rows rendered many times (for example `WorktreeItem`) should not subscribe to full global maps like `activeToolCalls`, `sessionWorktreeMap`, or `sendingSessionIds` unless they render the whole map. Prefer a selector that computes and returns the row's primitive status:

```typescript
const isWaiting = useChatStore(state => {
  for (const [sessionId, calls] of Object.entries(state.activeToolCalls)) {
    if (state.sessionWorktreeMap[sessionId] !== worktreeId) continue
    if (calls.some(isWaitingCall)) return true
  }
  return false
})
```

This still re-evaluates on store updates, but unaffected rows avoid re-rendering because their selected boolean remains equal.
