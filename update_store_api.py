import re

with open('src/lib/store.ts', 'r') as f:
    content = f.read()

# I will replace firebaseUpdate calls for signalState to fetch('/api/signal', { method: 'POST', body: JSON.stringify(newSignal) })
# But since firebaseUpdate is used directly, I'll just replace it with the fetch equivalent

api_call = "fetch('/api/signal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSignal) }).catch(console.error);"

content = content.replace('firebaseUpdate("traffic/signalState", newSignal).catch(console.error);', api_call)

with open('src/lib/store.ts', 'w') as f:
    f.write(content)
